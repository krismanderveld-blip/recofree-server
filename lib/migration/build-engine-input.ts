/**
 * ══════════════════════════════════════════════════════════════════════════
 * BUILD CANONICAL ENGINE INPUT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Assembles a CanonicalEngineInput from the data available in chat.tsx
 * at the point where processMessage() is called.
 *
 * This is the client-side "request builder" mentioned in the migration plan.
 * It does NOT modify any data — it only reads and transforms.
 *
 * Data sources:
 *   - backpack (Backpack) — from encrypted storage
 *   - userDat (UserDat) — from encrypted storage
 *   - logsSessions (SessionLogSummary[]) — from logsDatStore
 *   - LocalDeviceTimeService — for deviceTimeContext
 *   - conversationHistory — current session messages
 *   - userMessage — the current user message
 */

import type { Backpack, UserDat, MoodSliders, DiaryEntry } from '@/lib/ai/types';
import type { SessionLogSummary } from '@/lib/types/memory/logsDat.types';
import { LocalDeviceTimeService } from '@/lib/core/time';
import type { CanonicalEngineInput, DeviceTimeContextPayload, VspSectionPayload, LogsSessionPayload, UserDatSummaryPayload, ConversationMessage, MoodSlidersPayload, EngineRequestType } from './engine-input.types';

// ─── Daypart Helper ───────────────────────────────────────────────────

function getDaypart(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

// ─── DeviceTimeContext Builder ────────────────────────────────────────

function buildDeviceTimeContext(sessionStartedAtIso: string): DeviceTimeContextPayload {
  const snapshot = LocalDeviceTimeService.now();
  return {
    deviceNowIso: snapshot.utcIso,
    timeZone: snapshot.timeZone,
    timezoneOffsetMinutes: snapshot.offsetMinutes,
    localDate: snapshot.localDate,
    localTime: snapshot.localTime,
    greetingDaypart: getDaypart(snapshot.localHour),
    cycleTimestamp: snapshot.localDate, // cycle = calendar day
    sessionStartedAtDeviceIso: sessionStartedAtIso,
  };
}

// ─── VSP Section Builder ──────────────────────────────────────────────

function buildVspSection(backpack: Backpack, userDat: UserDat): VspSectionPayload | null {
  if (backpack.userType !== 'elias') return null;
  const mood = userDat.currentMood as any;
  if (!mood?.vsp) return null;

  const vspLevel = mood.vsp as string;
  const vspScore = typeof mood.vspScore === 'number' ? mood.vspScore : 0;

  // Get zone-specific data from backpack.vspSection
  let signals: string | undefined;
  let whatHelps: string | undefined;
  let anchorPhrase: string | undefined;

  if (backpack.vspSection?.zones) {
    const zoneMap: Record<string, string> = {
      'GROEN': 'green', 'GREEN': 'green', 'LICHTGROEN': 'lightGreen',
      'GEEL': 'yellow', 'YELLOW': 'yellow',
      'ORANJE': 'orange', 'ORANGE': 'orange',
      'ROOD': 'red', 'RED': 'red',
      'PAARS': 'purple', 'PURPLE': 'purple',
    };
    const zoneKey = zoneMap[vspLevel.toUpperCase()] as keyof typeof backpack.vspSection.zones;
    const zone = zoneKey ? (backpack.vspSection.zones as any)[zoneKey] : null;
    if (zone) {
      signals = zone.signals || undefined;
      whatHelps = zone.whatHelps || undefined;
      anchorPhrase = zone.anchorSentence || undefined;
    }
  }

  return {
    level: vspLevel as VspSectionPayload['level'],
    score: vspScore,
    signals,
    whatHelps,
    anchorPhrase,
  };
}

// ─── Logs Sessions Builder ────────────────────────────────────────────

function buildLogsSessions(sessions: SessionLogSummary[]): LogsSessionPayload[] {
  if (!sessions || sessions.length === 0) return [];

  // Sort by endedAt desc, take most recent (already done in adaptLogsDat, but be safe)
  const sorted = [...sessions].sort((a, b) =>
    new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()
  );

  // Take up to 3 most recent sessions
  return sorted.slice(0, 3).map(s => ({
    sessionId: s.sessionId || `session_${s.startedAt}`,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    compressedNarrative: s.compressedNarrative || '',
    discussedTopics: s.discussedTopics || [],
    emotionalThemes: (s.emotionalThemes || []).map(e => e.label),
    openEndpoints: (s.openEndpoints || []).map(e => e.label),
    moduleTrace: (s.moduleTrace || []).map(m => ({
      moduleId: m.moduleId,
      count: m.count || 1,
    })),
    zoneTrace: (s.zoneTrace || []).map(z => ({
      zone: typeof z.zone === 'string' ? z.zone : String(z.zone),
      count: z.count || 1,
    })),
  }));
}

// ─── UserDat Summary Builder ──────────────────────────────────────────

function buildUserDatSummary(userDat: UserDat): UserDatSummaryPayload {
  const moodSliders: MoodSlidersPayload = {};
  if (userDat.currentMood) {
    for (const [key, val] of Object.entries(userDat.currentMood)) {
      moodSliders[key] = typeof val === 'number' ? val : null;
    }
  }

  return {
    totalSessions: userDat.totalSessions || 0,
    lastSessionDate: userDat.lastSessionDate || null,
    currentMood: moodSliders,
    moodHistory: (userDat.moodHistory || []).slice(-10).map(m => ({
      date: m.timestamp,
      sliders: Object.fromEntries(
        Object.entries(m.sliders).map(([k, v]) => [k, typeof v === 'number' ? v : null])
      ),
    })),
    triggerPatterns: (userDat.triggerPatterns || []).slice(-10).map(t => ({
      trigger: t.trigger,
      frequency: t.count || 1,
      lastSeen: t.lastSeen || '',
    })),
    moduleUsage: (userDat.moduleUsage || []).slice(-10).map(m => ({
      moduleId: m.moduleId,
      count: m.count || 1,
      lastUsed: m.usedAt || '',
    })),
    stageOfChange: userDat.stageOfChange || 'contemplation',
    clinicalModeActive: userDat.clinicalModeActive || false,
    guidanceDepth: userDat.guidanceDepth || undefined,
    schemaTendencies: userDat.schemaTendencies?.map(s => ({
      domain: s.domain,
      confidence: s.confidence || 0,
    })),
    eigenRegieHistory: userDat.eigenRegieHistory?.slice(-5).map(e => ({
      value: e.userInput,
      timestamp: e.timestamp || '',
    })),
  };
}

// ─── Main Builder ─────────────────────────────────────────────────────

export interface BuildEngineInputParams {
  requestType: EngineRequestType;
  backpack: Backpack;
  userDat: UserDat;
  userMessage: string;
  conversationHistory: ConversationMessage[];
  logsSessions: SessionLogSummary[];
  isSessionStart: boolean;
  usedModules: string[];
  previousZoneScore: number;
  messageCount: number;
  sessionStartedAtIso: string;
  locale: 'nl' | 'en' | 'fr';
  country: 'NL' | 'BE' | 'FR' | 'UK' | 'US';
}

/**
 * Build a CanonicalEngineInput from the data available in chat.tsx.
 *
 * This function is pure (no side effects) and deterministic given the same inputs.
 * It does NOT call any async APIs or read from storage.
 */
export function buildCanonicalEngineInput(params: BuildEngineInputParams): CanonicalEngineInput {
  const {
    requestType,
    backpack,
    userDat,
    userMessage,
    conversationHistory,
    logsSessions,
    isSessionStart,
    usedModules,
    previousZoneScore,
    messageCount,
    sessionStartedAtIso,
    locale,
    country,
  } = params;

  const moodSliders: MoodSlidersPayload = {};
  if (userDat.currentMood) {
    for (const [key, val] of Object.entries(userDat.currentMood)) {
      moodSliders[key] = typeof val === 'number' ? val : null;
    }
  }

  return {
    requestType,
    userType: backpack.userType,
    userName: backpack.naam,
    locale,
    country,
    guidanceDepth: userDat.guidanceDepth || 'normal',
    clinicalModeActive: userDat.clinicalModeActive || false,
    message: userMessage,
    conversationHistory,
    moodSliders,
    isSessionStart,
    vspSection: buildVspSection(backpack, userDat),
    logsSessions: buildLogsSessions(logsSessions),
    userDatSummary: buildUserDatSummary(userDat),
    usedModules,
    previousZoneScore,
    messageCount,
    deviceTimeContext: buildDeviceTimeContext(sessionStartedAtIso),
  };
}
