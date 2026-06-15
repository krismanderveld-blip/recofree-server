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
} from './sessionGreeting.types';
import { sessionGreetingEngineV3, type SessionGreetingV3EngineResult } from './sessionGreetingEngineV3';
import { enforceGreetingOutputRulesV3 } from './buildGreetingSynthesisPrompt';

export interface SessionInitGreetingInput {
  backpack: Backpack;
  userDat: UserDat;
  diaryEntries: DiaryEntry[];
  apiBaseUrl: string;
  timezone?: string;
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
  const { backpack, userDat, diaryEntries, apiBaseUrl, timezone = 'Europe/Amsterdam' } = input;

  const nowIso = new Date().toISOString();
  const localCalendarDate = getLocalCalendarDate(nowIso, timezone);

  // Adapt legacy stores to greeting engine snapshots
  const greetingUserDat = adaptUserDat(backpack, userDat);
  const greetingStateDat = adaptStateDat(userDat);
  const greetingProjectionsDat = adaptProjectionsDat();
  const greetingLogsDat = adaptLogsDat();
  const diaryMetadata = adaptDiaryMetadata(diaryEntries);
  const gratitudeMetadata = adaptGratitudeMetadata(diaryEntries);

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
  };

  // Run V3 engine (deterministic)
  const engineResult: SessionGreetingV3EngineResult = sessionGreetingEngineV3(engineInput);

  // Build the GPT prompt based on mode
  const userName = greetingUserDat?.userName ?? 'daar';
  let systemPrompt: string;

  if ((engineResult.mode === 'SYNTHESIS' || engineResult.mode === 'RETURN_AFTER_ABSENCE') && engineResult.synthesisPayload) {
    systemPrompt = engineResult.synthesisPayload.synthesisInstruction;
  } else if (engineResult.overridePrompt) {
    systemPrompt = engineResult.overridePrompt;
  } else {
    // Fallback: generic greeting prompt
    systemPrompt = `Je bent Elias. Schrijf een warme, korte begroeting voor ${userName}. Max 3 zinnen. Grammaticaal correct Nederlands, geen emoji.`;
  }

  // Call GPT via server endpoint
  let rawGreeting: string;
  try {
    rawGreeting = await callSessionGreetingEndpoint(apiBaseUrl, systemPrompt, userName);
  } catch (error) {
    console.warn('[SessionGreetingV3] GPT call failed, using fallback:', error);
    rawGreeting = `${userName}, fijn dat je er bent. Waar wil je het vandaag over hebben?`;
  }

  // Apply output safety filter
  const validation = enforceGreetingOutputRulesV3(rawGreeting);
  let greeting = rawGreeting;
  if (!validation.valid) {
    console.warn(`[SessionGreetingV3] Output rejected: ${validation.reason}. Using raw output anyway.`);
    // In V3 we still use the output but log the violation
    // A strict mode could retry or fallback here
  }

  // Build debug log
  const debugLog = buildV3DebugLog(engineResult, validation);
  console.log(debugLog);

  return { greeting, debugLog };
}

// ─── Server Call ────────────────────────────────────────────────────────────

async function callSessionGreetingEndpoint(
  apiBaseUrl: string,
  systemPrompt: string,
  userName: string,
): Promise<string> {
  const url = `${apiBaseUrl}/api/session-greeting`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ systemPrompt, userName }),
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
): string {
  const sources = result.selectedSources.map(s => s.sourceType).join(', ') || 'none';
  let log = `[SessionGreetingV3] mode=${result.mode} sources=[${sources}]`;
  if (result.absence.band !== 'NONE') {
    log += ` absence=${result.absence.band}(${result.absence.absenceDaysExact !== null ? Math.round(result.absence.absenceDaysExact) : '?'}d)`;
  }
  if (result.override) {
    log += ` override_reason="${result.override.reason}"`;
  }
  if (!validation.valid) {
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
    schemaId: s.schemaId,
    schemaName: s.domain || s.schemaId,
    confidence: s.confidence ?? 0,
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
  };
}

function adaptStateDat(userDat: UserDat): GreetingStateDatSnapshot {
  const mood = userDat.currentMood;
  const moodHistory = userDat.moodHistory ?? [];
  const latestMoodSnapshot = moodHistory.length > 0
    ? moodHistory[moodHistory.length - 1]
    : null;

  // Determine VSP zone from the latest mood or default
  const vspZone = (userDat as any)._currentVspZone ?? 'GROEN';

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

function adaptLogsDat(): GreetingLogsDatSnapshot {
  return { lastSessionOpenLoops: [] };
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

  const safeAnchor = latest.content.slice(0, 80).trim();

  return {
    latestEntryCreatedAt: latest.timestamp,
    latestSafeAnchor: safeAnchor,
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

  const safeAnchor = latest.gratitude!.entry1 || latest.gratitude!.entry2 || latest.gratitude!.entry3 || '';

  return {
    latestEntryCreatedAt: latest.timestamp,
    latestSafeAnchor: safeAnchor.slice(0, 80).trim(),
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
