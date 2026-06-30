/**
 * Session Init Greeting Step — Pipeline Integration (V3)
 * 
 * Bridges the legacy stores (Backpack, UserDat, diary) and new memory-layer stores
 * to the Session Greeting Engine V3. Called at session start in chat.tsx.
 * 
 * V3 changes:
 * - Uses sessionGreetingEngineV3 (synthesis model) instead of V1 (single-anchor)
 * - Passes synthesis prompt OR override prompt to server endpoint
 * - Applies output safety filter (enforceGreetingOutputRulesV3)
 */

import type { Backpack, UserDat, DiaryEntry } from '@/lib/ai/types';
import { LocalDeviceTimeService } from '@/lib/core/time';
// detectRecurringPatterns removed — greeting now uses only most recent logs.dat session
import type {
  SessionGreetingInitInput,
  GreetingUserDatSnapshot,
  GreetingStateDatSnapshot,
  GreetingProjectionsDatSnapshot,
  GreetingDiaryMetadata,
  GreetingGratitudeMetadata,
  GreetingLogsDatSnapshot,
  GreetingSchemaTendency,
  GreetingSchemaRotationState,
  GreetingVspSectionSnapshot,
} from './sessionGreeting.types';
import { sessionGreetingEngineV3, type SessionGreetingV3EngineResult } from './sessionGreetingEngineV3';
import { enforceGreetingOutputRulesV3 } from './buildGreetingSynthesisPrompt';
import { detectUserLanguageFromContent, getGreetingLanguageInstruction } from './detectUserLanguage';
import { extractGreetingFacts, type GreetingFactExtractionResult } from './greetingFactExtractor';
import { validateGreetingAgainstFacts } from './greetingFactValidator';

export interface SessionInitGreetingInput {
  backpack: Backpack;
  userDat: UserDat;
  diaryEntries: DiaryEntry[];
  apiBaseUrl: string;
  timezone?: string;
  clinicalModeActive?: boolean;
  /** Real logs.dat session summaries (loaded from lifecycle manager) */
  lastSessionSummary?: {
    compressedNarrative: string;
    discussedTopics: string[];
    unresolvedTensions: string[];
    suggestedFollowUp: string[];
    emotionalArc?: string;
    turnCount?: number;
  } | null;
  /** All sessions from logs.dat for cross-session pattern detection */
  allSessions?: import('@/lib/types/memory/logsDat.types').SessionLogSummary[];
  /** VSP Insight context string (for clinical annotation injection) */
  vspInsightContext?: string | null;
  /** Raw previous session messages (from chatHistory) — fallback when logs.dat is empty */
  previousSessionMessages?: Array<{ role: string; content: string; timestamp?: string }>;
  /** User-selected app language (from i18n provider). Overrides content-based detection. */
  locale?: 'nl' | 'en' | 'fr';
}

export interface SessionInitGreetingOutput {
  greeting: string;
  debugLog: string;
}

/**
 * Main entry point called from chat.tsx at session start.
 * Adapts legacy data shapes into the V3 greeting engine's expected input format.
 */
export async function sessionInitGreetingStep(
  input: SessionInitGreetingInput,
): Promise<SessionInitGreetingOutput> {
  const { backpack, userDat, diaryEntries, apiBaseUrl, timezone = 'Europe/Amsterdam', clinicalModeActive = false, vspInsightContext = null } = input;

  // Use central time source — all fields from same base instant
  const timeSnapshot = LocalDeviceTimeService.now();
  const nowIso = timeSnapshot.utcIso;
  // Use device timezone from central service if not explicitly overridden
  const effectiveTimezone = timezone === 'Europe/Amsterdam' ? timeSnapshot.timeZone : timezone;
  const localCalendarDate = timeSnapshot.localDate;

  // Adapt legacy stores to greeting engine snapshots
  const greetingUserDat = adaptUserDat(backpack, userDat);
  const greetingStateDat = adaptStateDat(userDat);
  const greetingProjectionsDat = adaptProjectionsDat();
  const logsDatAdaptResult = adaptLogsDat(input.lastSessionSummary, input.allSessions, input.previousSessionMessages);
  const greetingLogsDat = logsDatAdaptResult.snapshot;
  const logsDatSource = logsDatAdaptResult.source;
  const diaryMetadata = adaptDiaryMetadata(diaryEntries);
  const gratitudeMetadata = adaptGratitudeMetadata(diaryEntries);

  // Adapt structured VSP section for the greeting engine
  const vspSection = adaptVspSection(backpack, greetingStateDat?.vspZone);

  const engineInput: SessionGreetingInitInput = {
    nowIso,
    localCalendarDate,
    timezone: effectiveTimezone,
    userDat: greetingUserDat,
    stateDat: greetingStateDat,
    projectionsDat: greetingProjectionsDat,
    logsDat: greetingLogsDat,
    diaryMetadata,
    gratitudeMetadata,
    vspSection,
  };

  // Run V3 engine (deterministic)
  const engineResult: SessionGreetingV3EngineResult = sessionGreetingEngineV3(engineInput);

  // Determine greeting language: prefer user-selected locale, fallback to content detection
  const userLocale = input.locale;
  let langInstruction: string;
  if (userLocale) {
    const LOCALE_LANG_NAMES: Record<string, string> = { nl: 'Dutch (Nederlands)', en: 'English', fr: 'French (Français)' };
    langInstruction = `You MUST respond in ${LOCALE_LANG_NAMES[userLocale] ?? 'Dutch (Nederlands)'}. This is the user's chosen app language.`;
    console.log(`[SessionGreetingV3] Using user-selected locale: ${userLocale}`);
  } else {
    const langResult = detectUserLanguageFromContent(backpack, diaryEntries);
    langInstruction = getGreetingLanguageInstruction(langResult);
    console.log(`[SessionGreetingV3] Detected language: ${langResult.language} (hasContent=${langResult.hasContent}, confidence=${langResult.confidence})`);
  }

  // Build the GPT prompt based on mode
  const userName = greetingUserDat?.userName ?? 'there';
  let systemPrompt: string;

  if ((engineResult.mode === 'SYNTHESIS' || engineResult.mode === 'RETURN_AFTER_ABSENCE') && engineResult.synthesisPayload) {
    systemPrompt = engineResult.synthesisPayload.synthesisInstruction;
  } else if (engineResult.overridePrompt) {
    systemPrompt = engineResult.overridePrompt;
  } else {
    // Fallback: generic greeting prompt
    systemPrompt = `You are Elias. Write a warm, short greeting for ${userName}. Max 3 sentences. No emoji.`;
  }

  // Append language instruction to the prompt — this OVERRIDES any earlier language instructions
  systemPrompt += `\n\n=== CRITICAL LANGUAGE OVERRIDE ===\nIGNORE any earlier language instructions in this prompt.\n${langInstruction}\nThis is the FINAL and BINDING language rule. All output MUST be in this language.`;

  // Extract facts BEFORE GPT call so we can use contextual fallback on connection failure
  const factResult: GreetingFactExtractionResult = extractGreetingFacts(
    engineResult.selectedSources,
    userName,
    vspSection ?? undefined,
    greetingStateDat?.vspZone,
  );

  // Call GPT via server endpoint
  let rawGreeting: string;
  let connectionFailed = false;
  try {
    rawGreeting = await callSessionGreetingEndpoint(apiBaseUrl, systemPrompt, userName, clinicalModeActive, vspInsightContext);
  } catch (error) {
    connectionFailed = true;
    console.warn('[SessionGreetingV3] GPT call failed, using contextual fallback:', error);
    // Use deterministic fallback WITH context (mood, diary, session) instead of generic string
    rawGreeting = factResult.fallbackGreeting;
  }

  // FIX 3: Blocking validation with retry (max 2x) + deterministic fallback
  // Skip validation if connection failed — fallback is already deterministic and safe
  const MAX_RETRIES = 2;
  let greeting = rawGreeting;
  let validation = connectionFailed
    ? { valid: true, reason: 'connection_failed_deterministic_fallback' }
    : validateGreetingAgainstFacts(rawGreeting, factResult.facts);
  let retryCount = 0;

  while (!validation.valid && retryCount < MAX_RETRIES) {
    retryCount++;
    console.warn(`[SessionGreetingV3] Output REJECTED (attempt ${retryCount}): ${validation.reason}. Retrying...`);
    try {
      // Retry with stricter prompt: append fact-only constraint
      const stricterPrompt = systemPrompt + `\n\n=== RETRY — VORIGE OUTPUT AFGEWEZEN (${validation.reason}) ===\nJe vorige output bevatte informatie die NIET in de brondata staat. Probeer opnieuw.\nGebruik UITSLUITEND de feiten die hierboven staan. Voeg NIETS toe.`;
      const retryGreeting = await callSessionGreetingEndpoint(apiBaseUrl, stricterPrompt, userName, clinicalModeActive, vspInsightContext);
      validation = validateGreetingAgainstFacts(retryGreeting, factResult.facts);
      if (validation.valid) {
        greeting = retryGreeting;
      }
    } catch (retryError) {
      console.warn(`[SessionGreetingV3] Retry ${retryCount} failed:`, retryError);
      break;
    }
  }

  // If still invalid after retries: use deterministic fallback (no GPT)
  if (!validation.valid) {
    console.warn(`[SessionGreetingV3] All retries failed. Using deterministic fallback.`);
    greeting = factResult.fallbackGreeting;
    validation = { valid: true, reason: 'deterministic_fallback' };
  }

  // Build debug log
  const debugLog = buildV3DebugLog(engineResult, validation, retryCount, factResult.facts.length, logsDatSource);
  console.log(debugLog);

  return { greeting, debugLog };
}

// ─── Server Call ────────────────────────────────────────────────────────────

async function callSessionGreetingEndpoint(
  apiBaseUrl: string,
  systemPrompt: string,
  userName: string,
  clinicalModeActive: boolean = false,
  vspInsightContext: string | null = null,
): Promise<string> {
  const url = `${apiBaseUrl}/api/session-greeting`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ systemPrompt, userName, clinicalModeActive, vspInsightContext }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Session greeting endpoint error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { success: boolean; greeting: string };
  if (!data.success || !data.greeting) {
    throw new Error('Invalid response from session greeting endpoint');
  }

  return data.greeting;
}

// ─── Debug Log ──────────────────────────────────────────────────────────────

function buildV3DebugLog(
  result: SessionGreetingV3EngineResult,
  validation: { valid: boolean; reason: string },
  retryCount: number = 0,
  factCount: number = 0,
  logsDatSource: 'rich_summary' | 'previousSessionMessages_fallback' | 'none' = 'none',
): string {
  const sources = result.selectedSources.map(s => s.sourceType).join(', ') || 'none';
  let log = `[SessionGreetingV3] mode=${result.mode} sources=[${sources}] facts=${factCount} logsDatSource=${logsDatSource}`;
  if (retryCount > 0) {
    log += ` retries=${retryCount}`;
  }
  if (result.absence.band !== 'NONE') {
    log += ` absence=${result.absence.band}(${result.absence.absenceDaysExact !== null ? Math.round(result.absence.absenceDaysExact) : '?'}d)`;
  }
  if (result.override) {
    log += ` override_reason="${result.override.reason}"`;
  }
  if (validation.reason === 'deterministic_fallback') {
    log += ` output=DETERMINISTIC_FALLBACK`;
  } else if (!validation.valid) {
    log += ` output_violation="${validation.reason}"`;
  }
  return log;
}

// ─── Adapters ─────────────────────────────────────────────────────────────────

function adaptUserDat(backpack: Backpack, userDat: UserDat): GreetingUserDatSnapshot {
  const userName = backpack.naam || undefined;
  const totalSessionsStarted = userDat.totalSessions ?? 0;
  const lastSessionStartedAt = (userDat as any).lastSessionStartedAt ?? (userDat as any)._lastSessionStartedAt ?? undefined;

  // Adapt schemaTendencies from legacy format
  const schemaTendencies: GreetingSchemaTendency[] = (userDat.schemaTendencies ?? []).map((s) => ({
    name: s.domain || s.schemaId || 'unknown',
    score: s.confidence ?? 0,
    confirmed: (s.confidence ?? 0) > 0.6,
    lastUpdatedAt: s.lastUpdatedAt ?? s.lastSeen ?? new Date().toISOString(),
  }));

  // Derive backpackLastUpdatedAt from backpack sections
  const sectionDates = backpack.sections
    .map((s) => s.lastUpdated)
    .filter(Boolean) as string[];
  const backpackLastUpdatedAt = sectionDates.length > 0
    ? sectionDates.sort().reverse()[0]
    : undefined;

  // Derive schema rotation state from userDat (stored if previously used)
  const schemaRotationState: GreetingSchemaRotationState | undefined = (userDat as any)._schemaRotationState ?? undefined;

  // Backpack analysis "indien gewijzigd": analyzedAt > previousAnalyzedAt
  const ba = userDat.backpackAnalysis;
  const backpackAnalysisChanged = !!(ba && ba.analyzedAt && ba.previousAnalyzedAt && ba.analyzedAt > ba.previousAnalyzedAt);
  const backpackAnalysisContent = backpackAnalysisChanged && ba ? {
    schemas: ba.schemas,
    modi: ba.modi,
    triggers: ba.triggers,
    coreBeliefs: ba.coreBeliefs,
    copingPatterns: ba.copingPatterns,
  } : undefined;

  return {
    userName,
    sessionStats: {
      totalSessionsStarted,
      currentSessionNumber: totalSessionsStarted + 1,
      lastSessionStartedAt,
      schemaRotationState,
    },
    schemaTendencies,
    backpackLastUpdatedAt,
    backpackAnalysisChanged,
    backpackAnalysisContent,
  };
}

function adaptStateDat(userDat: UserDat): GreetingStateDatSnapshot {
  const mood = userDat.currentMood;
  const moodHistory = userDat.moodHistory ?? [];
  const latestMoodSnapshot = moodHistory.length > 0
    ? moodHistory[moodHistory.length - 1]
    : null;

  // Determine VSP zone from the latest mood (set by handleVspSubmit)
  const vspZone = (userDat.currentMood as any)?.vsp ?? 'GROEN';

  return {
    currentMood: mood ? {
      craving: (mood as any).craving ?? 0,
      frustration: (mood as any).frustration ?? 0,
      despondency: (mood as any).despondency ?? 0,
      focus: (mood as any).focus ?? 0,
    } : undefined,
    moodLastUpdatedAt: latestMoodSnapshot?.timestamp ?? (mood as any)?.timestamp ?? undefined,
    vspZone,
  };
}

function adaptProjectionsDat(): GreetingProjectionsDatSnapshot {
  return { fears: [] };
}

function adaptLogsDat(
  _lastSessionSummary?: SessionInitGreetingInput['lastSessionSummary'],
  allSessions?: import('@/lib/types/memory/logsDat.types').SessionLogSummary[],
  previousSessionMessages?: SessionInitGreetingInput['previousSessionMessages'],
): { snapshot: GreetingLogsDatSnapshot; source: 'rich_summary' | 'previousSessionMessages_fallback' | 'none' } {
  const result: GreetingLogsDatSnapshot = { lastSessionOpenLoops: [] };

  // Sort logs.dat sessions by endedAt descending, take the most recent one.
  if (allSessions && allSessions.length > 0) {
    const sorted = [...allSessions].sort((a, b) => {
      const tA = a.endedAt || a.createdAt || '';
      const tB = b.endedAt || b.createdAt || '';
      return tB.localeCompare(tA);
    });

    const mostRecent = sorted[0];
    const narrative = mostRecent.compressedNarrative || '';

    // Detect if this is a rich GPT summary or just a poor live-entry.
    // Live entries start with "Sessie-inhoud (N berichten):" — raw concatenation, not a real summary.
    const isPoorLiveEntry = /^Sessie-inhoud \(\d+ berichten\):/.test(narrative)
      || /^Sessie met \d+ berichten/.test(narrative);

    if (!isPoorLiveEntry && narrative.length > 0) {
      // Good GPT summary available — use it as primary source
      result.latestLogDigest = narrative;
      result.lastSessionOpenLoops = (mostRecent.openEndpoints ?? []).map(ep => ep.label);
      result.lastSessionTopics = mostRecent.discussedTopics?.length ? mostRecent.discussedTopics : undefined;
      result.lastSessionEmotionalArc = (mostRecent.emotionalThemes ?? []).map(t => t.label).join(', ') || undefined;
      result.recentSessionDigests = [{
        narrative,
        topics: mostRecent.discussedTopics || [],
        openEndpoints: (mostRecent.openEndpoints || []).map(ep => ep.label),
        endedAt: mostRecent.endedAt || mostRecent.createdAt || '',
      }];

      // Derive previous session dominant zone from zoneTrace
      if (mostRecent.zoneTrace && mostRecent.zoneTrace.length > 0) {
        const zoneSorted = [...mostRecent.zoneTrace].sort((a, b) => b.count - a.count);
        result.previousSessionZone = zoneSorted[0].zone;
      }

      return { snapshot: result, source: 'rich_summary' };
    }

    // Poor live-entry: still extract zone if available, then fall through to fallback
    if (mostRecent.zoneTrace && mostRecent.zoneTrace.length > 0) {
      const zoneSorted = [...mostRecent.zoneTrace].sort((a, b) => b.count - a.count);
      result.previousSessionZone = zoneSorted[0].zone;
    }
  }

  // ── FALLBACK: Use previousSessionMessages when logs.dat is empty or only has a poor live-entry ──
  if (previousSessionMessages && previousSessionMessages.length > 0) {
    const fallbackNarrative = buildFallbackNarrativeFromMessages(previousSessionMessages);
    const fallbackTopics = extractTopicsFromMessages(previousSessionMessages);
    result.latestLogDigest = fallbackNarrative;
    result.lastSessionTopics = fallbackTopics.length > 0 ? fallbackTopics : undefined;
    result.recentSessionDigests = [{
      narrative: fallbackNarrative,
      topics: fallbackTopics,
      openEndpoints: [],
      endedAt: previousSessionMessages[previousSessionMessages.length - 1]?.timestamp || '',
    }];
    return { snapshot: result, source: 'previousSessionMessages_fallback' };
  }

  return { snapshot: result, source: 'none' };
}

/**
 * Build a usable narrative from raw previous session messages.
 * Strips speaker prefixes, structural markers, and internal error/status strings
 * so the greeting engine can reference the CONTENT without seeing internal labels.
 *
 * IMPORTANT: The output is a thematic summary of what the user discussed,
 * NOT a literal concatenation of their messages.
 */
function buildFallbackNarrativeFromMessages(
  messages: Array<{ role: string; content: string; timestamp?: string }>,
): string {
  // Take user messages only — assistant messages are Elias/Kim's own words
  const userMessages = messages
    .filter(m => m.role === 'user' && m.content && m.content.trim().length > 0)
    .map(m => sanitizeFallbackContent(stripSpeakerPrefixes(m.content.trim())))
    .filter(m => m.length > 0);

  if (userMessages.length === 0) {
    // Fallback: use all messages if no user messages
    const allContent = messages
      .filter(m => m.content && m.content.trim().length > 0)
      .map(m => sanitizeFallbackContent(stripSpeakerPrefixes(m.content.trim())))
      .filter(m => m.length > 0);
    if (allContent.length === 0) return '';
    return `Gebruiker besprak: ${allContent.join('. ')}`.slice(0, 800);
  }

  // Frame as thematic content, not raw quotes
  return `Gebruiker besprak: ${userMessages.join('. ')}`.slice(0, 800);
}

/**
 * Remove internal error strings, status messages, and meta-text from fallback content.
 * These should NEVER reach the greeting prompt.
 */
function sanitizeFallbackContent(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // Remove internal error/status strings that leaked from session-end failures
  const INTERNAL_PATTERNS = [
    /gpt-samenvatting niet beschikbaar[^.]*/gi,
    /network requ?e?s?t?[^.]*/gi,
    /sessie be[eë]indigd \(\d+ berichten\)[^.]*/gi,
    /samenvatting niet beschikbaar[^.]*/gi,
    /error:?\s*[^.]*/gi,
    /timeout[^.]*/gi,
    /failed to fetch[^.]*/gi,
    /connection refused[^.]*/gi,
    /\d+ berichten\)?[.:]/gi,
    /^Sessie-inhoud.*$/gim,
    /^Sessie met \d+.*$/gim,
  ];

  for (const pattern of INTERNAL_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove leftover punctuation artifacts
  cleaned = cleaned.replace(/\.\.+/g, '.').replace(/\s{2,}/g, ' ').trim();
  // Remove leading/trailing dots or commas
  cleaned = cleaned.replace(/^[.,;:\s]+|[.,;:\s]+$/g, '').trim();

  return cleaned;
}

/**
 * Strip speaker prefixes and structural labels from raw message content.
 * Similar to stripRawLabels in buildGreetingSynthesisPrompt.ts.
 */
function stripSpeakerPrefixes(text: string): string {
  let cleaned = text;
  // Strip session labels
  cleaned = cleaned.replace(/^(?:Laatste sessie|Sessie daarvoor|Eerdere sessie|Vorige sessie):\s*/gi, '');
  // Strip speaker prefixes
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:elias|kim|kris|gebruiker|user):\s*/gi, (m) => m.includes('\n') ? '\n' : '');
  // Strip "Sessie-inhoud (N berichten):" prefix
  cleaned = cleaned.replace(/^Sessie-inhoud \(\d+ berichten\):\s*/i, '');
  cleaned = cleaned.replace(/^Sessie met \d+ berichten.*?:\s*/i, '');
  return cleaned.replace(/\n{2,}/g, '\n').trim();
}

/**
 * Extract semantic topics from raw previous session messages using keyword frequency.
 * Returns up to 3 topics derived from the user's messages.
 */
function extractTopicsFromMessages(
  messages: Array<{ role: string; content: string; timestamp?: string }>,
): string[] {
  // Therapeutic/emotional keywords that indicate topics of conversation
  const TOPIC_KEYWORDS: Record<string, string> = {
    // Dutch keywords
    'craving': 'craving', 'trek': 'craving', 'zucht': 'craving', 'verlangen': 'craving',
    'alcohol': 'alcohol', 'drinken': 'alcohol', 'bier': 'alcohol', 'wijn': 'alcohol',
    'drugs': 'middelengebruik', 'gebruiken': 'middelengebruik', 'blowen': 'middelengebruik',
    'stress': 'stress', 'spanning': 'stress', 'druk': 'stress', 'overweldigd': 'stress',
    'angst': 'angst', 'bang': 'angst', 'paniek': 'angst', 'onrustig': 'angst',
    'verdriet': 'verdriet', 'verdrietig': 'verdriet', 'huilen': 'verdriet', 'rouw': 'verdriet',
    'boos': 'boosheid', 'woede': 'boosheid', 'frustratie': 'boosheid', 'geïrriteerd': 'boosheid',
    'slapen': 'slaap', 'slaap': 'slaap', 'insomnia': 'slaap', 'moe': 'slaap',
    'werk': 'werk', 'baan': 'werk', 'collega': 'werk', 'baas': 'werk', 'ontslag': 'werk',
    'relatie': 'relatie', 'partner': 'relatie', 'scheiding': 'relatie', 'ruzie': 'relatie',
    'eenzaam': 'eenzaamheid', 'alleen': 'eenzaamheid', 'isolatie': 'eenzaamheid',
    'gezin': 'gezin', 'kinderen': 'gezin', 'ouders': 'gezin', 'familie': 'gezin',
    'zelfbeeld': 'zelfbeeld', 'schaamte': 'zelfbeeld', 'schuld': 'zelfbeeld', 'waardeloos': 'zelfbeeld',
    'terugval': 'terugval', 'hervallen': 'terugval', 'uitgegleden': 'terugval',
    'motivatie': 'motivatie', 'doelen': 'motivatie', 'vooruitgang': 'motivatie',
    'grens': 'grenzen', 'grenzen': 'grenzen', 'nee zeggen': 'grenzen',
    // English keywords
    'anxiety': 'angst', 'fear': 'angst', 'worried': 'angst',
    'sad': 'verdriet', 'grief': 'verdriet', 'depressed': 'verdriet',
    'angry': 'boosheid', 'frustrated': 'boosheid',
    'sleep': 'slaap', 'tired': 'slaap', 'exhausted': 'slaap',
    'lonely': 'eenzaamheid', 'isolated': 'eenzaamheid',
    'relapse': 'terugval', 'slip': 'terugval',
    'relationship': 'relatie',
    'work': 'werk', 'job': 'werk',
    'family': 'gezin', 'children': 'gezin', 'parents': 'gezin',
  };

  const userText = messages
    .filter(m => m.role === 'user' && m.content)
    .map(m => m.content.toLowerCase())
    .join(' ');

  if (!userText) return [];

  // Count topic occurrences
  const topicCounts: Record<string, number> = {};
  for (const [keyword, topic] of Object.entries(TOPIC_KEYWORDS)) {
    // Word boundary match (simplified for multi-language)
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = userText.match(regex);
    if (matches && matches.length > 0) {
      topicCounts[topic] = (topicCounts[topic] || 0) + matches.length;
    }
  }

  // Return top 3 topics sorted by frequency
  return Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic);
}

function adaptDiaryMetadata(diaryEntries: DiaryEntry[]): GreetingDiaryMetadata | null {
  const journalEntries = diaryEntries.filter((e) => e.content && e.content.trim().length > 0);
  if (journalEntries.length === 0) return null;

  const sorted = [...journalEntries].sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return tB - tA;
  });
  const latest = sorted[0];

  // V3.1: Send FULL diary content — no 80-char truncation.
  // Also include up to 3 recent entries for richer context.
  const recentEntries = sorted.slice(0, 3).map(e => ({
    content: e.content.trim(),
    moodTag: e.moodTag || '',
    timestamp: e.timestamp,
  }));

  return {
    latestEntryCreatedAt: latest.timestamp,
    latestSafeAnchor: latest.content.trim(),
    recentEntries,
  };
}

function adaptGratitudeMetadata(diaryEntries: DiaryEntry[]): GreetingGratitudeMetadata | null {
  const gratitudeEntries = diaryEntries.filter((e) =>
    e.gratitude && (e.gratitude.entry1 || e.gratitude.entry2 || e.gratitude.entry3)
  );
  if (gratitudeEntries.length === 0) return null;

  const sorted = [...gratitudeEntries].sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return tB - tA;
  });
  const latest = sorted[0];

  // V3.1: Send ALL 3 gratitude entries — no truncation.
  const entries: string[] = [
    latest.gratitude!.entry1,
    latest.gratitude!.entry2,
    latest.gratitude!.entry3,
  ].filter(Boolean).map(s => s.trim());

  const combinedAnchor = entries.join(' | ');

  return {
    latestEntryCreatedAt: latest.timestamp,
    latestSafeAnchor: combinedAnchor,
    gratitudeEntries: entries,
  };
}

function adaptVspSection(backpack: Backpack, vspZone?: string): GreetingVspSectionSnapshot | null {
  const vspPlan = (backpack as any).vspSection;
  if (!vspPlan) return null;

  const zone = (vspZone ?? 'GROEN').toUpperCase();
  // Map Dutch/English zone names to English storage keys used in VspStructuredPlan
  const ZONE_KEY_MAP: Record<string, string> = {
    'GROEN': 'green', 'GREEN': 'green',
    'GEEL': 'yellow', 'YELLOW': 'yellow',
    'ORANJE': 'orange', 'ORANGE': 'orange',
    'ROOD': 'red', 'RED': 'red',
    'PAARS': 'purple', 'PURPLE': 'purple',
  };
  const zoneKey = ZONE_KEY_MAP[zone] ?? zone.toLowerCase();
  const zoneEntry = vspPlan.zones?.[zoneKey];

  // Normalize field: can be string OR string[] depending on data version
  const normalizeToArray = (val: unknown): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter((s: string) => typeof s === 'string' && s.trim().length > 0);
    if (typeof val === 'string' && val.trim().length > 0) return [val.trim()];
    return [];
  };

  const currentZoneEntry = zoneEntry ? {
    signals: normalizeToArray(zoneEntry.signals),
    whatHelps: normalizeToArray(zoneEntry.whatHelps),
    anchorSentence: zoneEntry.anchorSentence ?? '',
  } : null;

  // Get triggers with counter-thoughts
  const triggers = (vspPlan.triggers ?? []).filter(
    (t: any) => t.trigger && t.trigger.trim().length > 0
  ).map((t: any) => ({
    trigger: t.trigger,
    counterThought: t.counterThought ?? '',
  }));

  return {
    currentZoneEntry: currentZoneEntry && (currentZoneEntry.signals.length > 0 || currentZoneEntry.whatHelps.length > 0 || currentZoneEntry.anchorSentence) ? currentZoneEntry : null,
    mainAnchorSentence: vspPlan.mainAnchorSentence || undefined,
    recoveryRules: vspPlan.recoveryRules?.filter((r: string) => r.trim().length > 0) ?? [],
    triggers: triggers.length > 0 ? triggers : undefined,
  };
}

function getLocalCalendarDate(nowIso: string, timezone: string): string {
  try {
    const date = new Date(nowIso);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((p) => p.type === 'year')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    return `${year}-${month}-${day}`;
  } catch {
    return nowIso.slice(0, 10);
  }
}
