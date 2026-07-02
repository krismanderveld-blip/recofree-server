/**
 * logs.dat Retention Policy — Runs at session start to manage storage growth.
 *
 * Policy:
 * - 0-3 months: Full entries (no changes)
 * - 3-6 months: Compressed (only compressedNarrative + discussedTopics + openEndpoints kept)
 * - >6 months: Pruned (removed entirely)
 *
 * This ensures logs.dat stays manageable on-device while preserving
 * recent therapeutic context for the greeting engine and per-message pipeline.
 */
import type { SessionLogSummary, LogsDatPlaintext } from "@/lib/types/memory/logsDat.types";
import { LocalDeviceTimeService } from "@/lib/core/time";

const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

export interface RetentionResult {
  originalCount: number;
  keptFull: number;
  compressed: number;
  pruned: number;
  errorNarrativesCleaned: number;
}

/**
 * Apply retention policy to logs.dat sessions array.
 * Returns a new sessions array with the policy applied.
 */
export function applyLogsDatRetention(sessions: SessionLogSummary[]): {
  sessions: SessionLogSummary[];
  result: RetentionResult;
} {
  const now = LocalDeviceTimeService.now().epochMs;
  const result: RetentionResult = {
    originalCount: sessions.length,
    keptFull: 0,
    compressed: 0,
    pruned: 0,
    errorNarrativesCleaned: 0,
  };

  const retained: SessionLogSummary[] = [];

  for (const session of sessions) {
    const sessionAge = now - new Date(session.endedAt).getTime();

    if (sessionAge > SIX_MONTHS_MS) {
      // >6 months: prune entirely
      result.pruned++;
    } else if (sessionAge > THREE_MONTHS_MS) {
      // 3-6 months: compress (keep only essential fields)
      result.compressed++;
      retained.push(compressSession(session));
    } else {
      // 0-3 months: keep full
      result.keptFull++;
      retained.push(session);
    }
  }

  // ── Error narrative cleanup: sanitize corrupted entries ──
  for (const session of retained) {
    if (isErrorNarrativeInLogs(session.compressedNarrative)) {
      session.compressedNarrative = '';
      session.discussedTopics = [];
      result.errorNarrativesCleaned++;
    }
  }

  return { sessions: retained, result };
}

/**
 * Detect error narratives stored in logs.dat due to failed GPT summarization.
 * These contain raw error messages instead of real session content.
 */
function isErrorNarrativeInLogs(text: string): boolean {
  if (!text || text.length > 200) return false;
  const lower = text.toLowerCase();
  const ERROR_INDICATORS = [
    'niet beschikbaar',
    'network requ',
    'network error',
    'failed to fetch',
    'connection refused',
    'timeout',
    'http 5',
    'http 4',
    'internal server error',
    'openai error',
    'gpt-samenvatting niet',
    'samenvatting niet beschikbaar',
    'error:',
  ];
  return ERROR_INDICATORS.some(indicator => lower.includes(indicator));
}

/**
 * Compress a session entry — keep only fields needed for long-term context.
 */
function compressSession(session: SessionLogSummary): SessionLogSummary {
  return {
    ...session,
    // Keep: narrative, topics, open endpoints, zone/module trace, timestamps
    // Clear: detailed extraction candidates, emotional themes details, breakthrough details
    emotionalThemes: session.emotionalThemes.length > 0
      ? [{ label: session.emotionalThemes[0].label, intensity: session.emotionalThemes[0].intensity }]
      : [],
    breakthroughs: session.breakthroughs.length > 0
      ? [{ label: session.breakthroughs[0].label, description: "", confidence: session.breakthroughs[0].confidence }]
      : [],
    relapseOrRiskEvents: session.relapseOrRiskEvents.filter(e => e.eventType !== "none"),
    extractedCandidates: {
      fears: [],
      hopes: [],
      triggers: [],
      schemaTendencies: [],
      modeTendencies: [],
    },
    // Keep module/zone trace but limit to top 3
    moduleTrace: session.moduleTrace.slice(0, 3),
    zoneTrace: session.zoneTrace.slice(0, 3),
    // Zero out token estimates (no longer relevant)
    inputTokenEstimate: 0,
    outputTokenEstimate: 0,
  };
}

/**
 * Run retention policy on a full LogsDatPlaintext object.
 * Mutates and returns the same object for convenience.
 */
export function applyRetentionToLogsDat(logsDat: LogsDatPlaintext): RetentionResult {
  const { sessions, result } = applyLogsDatRetention(logsDat.sessions);
  logsDat.sessions = sessions;
  logsDat.updatedAt = LocalDeviceTimeService.now().utcIso;
  return result;
}
