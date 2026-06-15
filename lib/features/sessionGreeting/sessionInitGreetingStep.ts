/**
 * Session Init Greeting Step — Pipeline Integration
 * 
 * Bridges the legacy stores (Backpack, UserDat, diary) and new memory-layer stores
 * to the Session Greeting Engine. Called at session start in chat.tsx.
 * 
 * Returns a greeting string + debug info to be displayed as the first AI message.
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
import { runSessionGreetingEngine, type SessionGreetingResult } from './sessionGreetingEngine';

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
 * Adapts legacy data shapes into the greeting engine's expected input format.
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

  const result: SessionGreetingResult = await runSessionGreetingEngine(engineInput, { apiBaseUrl });

  console.log(result.debugLog);

  return {
    greeting: result.greeting,
    debugLog: result.debugLog,
  };
}

// ─── Adapters ─────────────────────────────────────────────────────────────────

function adaptUserDat(backpack: Backpack, userDat: UserDat): GreetingUserDatSnapshot {
  const userName = backpack.naam || undefined;
  const totalSessionsStarted = userDat.totalSessions ?? 0;

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
  // Projections are loaded from the memory-layer store via sessionLifecycle
  // For now, we return empty since projections are managed separately
  // and the greeting engine handles null gracefully
  return { fears: [] };
}

function adaptLogsDat(): GreetingLogsDatSnapshot {
  // logs.dat context is behind feature flag (USE_LOGS_DAT_CONTEXT = false)
  return { lastSessionOpenLoops: [] };
}

function adaptDiaryMetadata(diaryEntries: DiaryEntry[]): GreetingDiaryMetadata | null {
  // Filter journal entries (have content, not just gratitude)
  const journalEntries = diaryEntries.filter((e) => e.content && e.content.trim().length > 0);
  if (journalEntries.length === 0) return null;

  // Most recent journal entry
  const sorted = [...journalEntries].sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return tB - tA;
  });
  const latest = sorted[0];

  // Safe anchor: first 80 chars of content, no personal names
  const safeAnchor = latest.content.slice(0, 80).trim();

  return {
    latestEntryCreatedAt: latest.timestamp,
    latestSafeAnchor: safeAnchor,
  };
}

function adaptGratitudeMetadata(diaryEntries: DiaryEntry[]): GreetingGratitudeMetadata | null {
  // Filter gratitude entries (have gratitude object with at least one entry)
  const gratitudeEntries = diaryEntries.filter((e) =>
    e.gratitude && (e.gratitude.entry1 || e.gratitude.entry2 || e.gratitude.entry3)
  );
  if (gratitudeEntries.length === 0) return null;

  // Most recent gratitude entry
  const sorted = [...gratitudeEntries].sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return tB - tA;
  });
  const latest = sorted[0];

  // Safe anchor: first non-empty gratitude line
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
