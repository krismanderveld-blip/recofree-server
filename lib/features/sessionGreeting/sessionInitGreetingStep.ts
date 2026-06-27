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
import { detectRecurringPatterns } from './detectRecurringPatterns';
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

  const nowIso = new Date().toISOString();
  const localCalendarDate = getLocalCalendarDate(nowIso, timezone);

  // Adapt legacy stores to greeting engine snapshots
  const greetingUserDat = adaptUserDat(backpack, userDat);
  const greetingStateDat = adaptStateDat(userDat);
  const greetingProjectionsDat = adaptProjectionsDat();
  const greetingLogsDat = adaptLogsDat(input.lastSessionSummary, input.allSessions, input.previousSessionMessages);
  const diaryMetadata = adaptDiaryMetadata(diaryEntries);
  const gratitudeMetadata = adaptGratitudeMetadata(diaryEntries);

  // Adapt structured VSP section for the greeting engine
  const vspSection = adaptVspSection(backpack, greetingStateDat?.vspZone);

  const engineInput: SessionGreetingInitInput = {
    nowIso,
    localCalendarDate,
    timezone,
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

  // Call GPT via server endpoint
  let rawGreeting: string;
  try {
    rawGreeting = await callSessionGreetingEndpoint(apiBaseUrl, systemPrompt, userName, clinicalModeActive, vspInsightContext);
  } catch (error) {
    console.warn('[SessionGreetingV3] GPT call failed, using fallback:', error);
    // Fallback based on locale or detected language
    const fallbackLang = userLocale ?? 'nl';
    if (fallbackLang === 'fr') {
      rawGreeting = `${userName}, content de te voir. De quoi aimerais-tu parler aujourd'hui?`;
    } else if (fallbackLang === 'en') {
      rawGreeting = `${userName}, good to see you. What would you like to talk about today?`;
    } else {
      rawGreeting = `${userName}, fijn dat je er bent. Waar wil je het vandaag over hebben?`;
    }
  }

  // FIX 2+3: Extract facts and validate greeting against them
  const factResult: GreetingFactExtractionResult = extractGreetingFacts(
    engineResult.selectedSources,
    userName,
    vspSection ?? undefined,
    greetingStateDat?.vspZone,
  );

  // FIX 3: Blocking validation with retry (max 2x) + deterministic fallback
  const MAX_RETRIES = 2;
  let greeting = rawGreeting;
  let validation = validateGreetingAgainstFacts(rawGreeting, factResult.facts);
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
  const debugLog = buildV3DebugLog(engineResult, validation, retryCount, factResult.facts.length);
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
): string {
  const sources = result.selectedSources.map(s => s.sourceType).join(', ') || 'none';
  let log = `[SessionGreetingV3] mode=${result.mode} sources=[${sources}] facts=${factCount}`;
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
  lastSessionSummary?: SessionInitGreetingInput['lastSessionSummary'],
  allSessions?: import('@/lib/types/memory/logsDat.types').SessionLogSummary[],
  previousSessionMessages?: SessionInitGreetingInput['previousSessionMessages'],
): GreetingLogsDatSnapshot {
  const result: GreetingLogsDatSnapshot = { lastSessionOpenLoops: [] };

  // V3.3 FIX: Raw previous session messages are the SINGLE SOURCE OF TRUTH.
  // logs.dat compressedNarrative is a GPT-generated summary that can be stale/wrong
  // (e.g., it may say "uitstellen" when the user actually said "afspraak over 9 dagen").
  // When raw messages are available, they REPLACE all logs.dat narrative content.
  const hasRawMessages = previousSessionMessages && previousSessionMessages.length > 0;

  if (hasRawMessages) {
    // RAW MESSAGES PATH: Use ONLY the actual chat messages as context.
    // Do NOT mix in logs.dat compressedNarrative — it may contradict the raw messages.
    const last5 = previousSessionMessages!.slice(-5);
    const rawTranscript = last5.map(m => `${m.role === 'user' ? 'Gebruiker' : 'Elias'}: ${m.content}`).join('\n');
    result.latestLogDigest = rawTranscript;
    const lastMsgTimestamp = last5[last5.length - 1]?.timestamp || new Date().toISOString();
    result.recentSessionDigests = [{
      narrative: rawTranscript,
      topics: [],
      openEndpoints: lastSessionSummary?.unresolvedTensions ?? [],
      endedAt: lastMsgTimestamp,
    }];
    // Preserve open loops and follow-up from logs.dat (these are structural, not narrative)
    result.lastSessionOpenLoops = lastSessionSummary?.unresolvedTensions ?? [];
    result.lastSessionFollowUp = lastSessionSummary?.suggestedFollowUp?.length
      ? lastSessionSummary.suggestedFollowUp
      : undefined;
    result.lastSessionEmotionalArc = lastSessionSummary?.emotionalArc || undefined;
    // DO NOT include logs.dat session digests — they contain stale GPT summaries
    // that may contradict the actual messages the user sent.
  } else if (lastSessionSummary) {
    // FALLBACK PATH: No raw messages available, use logs.dat summary.
    result.latestLogDigest = lastSessionSummary.compressedNarrative || undefined;
    result.lastSessionOpenLoops = lastSessionSummary.unresolvedTensions ?? [];
    result.lastSessionTopics = lastSessionSummary.discussedTopics?.length > 0
      ? lastSessionSummary.discussedTopics
      : undefined;
    result.lastSessionEmotionalArc = lastSessionSummary.emotionalArc || undefined;
    result.lastSessionFollowUp = lastSessionSummary.suggestedFollowUp?.length > 0
      ? lastSessionSummary.suggestedFollowUp
      : undefined;
    // Include logs.dat digests only when we have no raw messages
    if (allSessions && allSessions.length > 0) {
      const recent = allSessions.slice(-3).reverse();
      result.recentSessionDigests = recent.map(s => ({
        narrative: s.compressedNarrative || '',
        topics: s.discussedTopics || [],
        openEndpoints: (s.openEndpoints || []).map(ep => ep.label),
        endedAt: s.endedAt || s.createdAt || '',
      }));
    }
  }

  // Derive previous session dominant zone from zoneTrace
  if (allSessions && allSessions.length > 0) {
    const lastSession = allSessions[allSessions.length - 1];
    if (lastSession.zoneTrace && lastSession.zoneTrace.length > 0) {
      // Pick the zone with the highest count (dominant zone of that session)
      const sorted = [...lastSession.zoneTrace].sort((a, b) => b.count - a.count);
      result.previousSessionZone = sorted[0].zone;
    }
  }

  // Cross-session pattern detection
  if (allSessions && allSessions.length >= 3) {
    try {
      const patternResult = detectRecurringPatterns(allSessions);
      if (patternResult.bestPattern) {
        result.recurringPatternAnchor = patternResult.bestPattern.safeAnchor;
        result.recurringPatternConfidence = patternResult.bestPattern.confidence;
      }
    } catch (err) {
      // Pattern detection is non-critical — fail silently
      console.warn('[GreetingInit] Pattern detection failed:', err);
    }
  }

  return result;
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
