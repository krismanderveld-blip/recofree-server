/**
 * Deterministic merge functions for state.dat layer.
 */
import type {
  StateDat,
  MoodStateSnapshot,
  MoodHistoryRecord,
  ZoneSnapshot,
  ZoneHistoryBufferRecord,
  CurrentStateBlock,
} from "@/lib/types/memory/stateDat.types";
import type { ZoneDecision, MoodStateExtraction } from "@/lib/types/memory/memoryCore.types";

const MAX_MOOD_HISTORY = 100;
const MAX_ZONE_HISTORY = 50;

/**
 * Update current state zone.
 */
export function mergeCurrentState(
  stateDat: StateDat,
  updates: Partial<CurrentStateBlock>,
  timestampIso: string
): StateDat {
  return {
    ...stateDat,
    current: {
      ...stateDat.current,
      ...updates,
      lastUpdatedAt: timestampIso,
    },
    updatedAt: timestampIso,
  };
}

/**
 * Append mood to history if high confidence.
 * Does NOT overwrite slider UI values with low-confidence inferred values.
 */
export function mergeMoodHistory(
  stateDat: StateDat,
  mood: MoodStateExtraction,
  turnId: string | undefined,
  sessionId: string,
  timestampIso: string
): StateDat {
  const snapshot: MoodStateSnapshot = {
    craving: mood.craving,
    frustration: mood.frustration,
    despondency: mood.despondency,
    focus: mood.focus,
    stress: mood.stress,
    boundaryFatigue: mood.boundaryFatigue,
    emotionalBurden: mood.emotionalBurden,
    selfCare: mood.selfCare,
    sourceKind: mood.sourceKind === "slider_ui" ? "slider_ui" : "pipeline_explicit_text",
    confidence: mood.confidence,
    timestampIso,
  };

  const record: MoodHistoryRecord = {
    ...snapshot,
    turnId,
    sessionId,
  };

  // Don't overwrite explicit slider values with inferred values
  const currentMood = stateDat.current.mood;
  const shouldUpdateCurrent =
    !currentMood ||
    mood.sourceKind === "slider_ui" ||
    (currentMood.sourceKind !== "slider_ui");

  return {
    ...stateDat,
    current: {
      ...stateDat.current,
      ...(shouldUpdateCurrent ? { mood: snapshot } : {}),
      lastUpdatedAt: timestampIso,
    },
    moodHistory: [...stateDat.moodHistory, record].slice(-MAX_MOOD_HISTORY),
    updatedAt: timestampIso,
  };
}

/**
 * Append zone to history buffer and update current zone.
 */
export function mergeZoneHistoryBuffer(
  stateDat: StateDat,
  zoneDecision: ZoneDecision,
  turnId: string,
  sessionId: string,
  timestampIso: string
): StateDat {
  if (zoneDecision.zone === "UNKNOWN") return stateDat;

  const zoneSnapshot: ZoneSnapshot = {
    zone: zoneDecision.zone,
    zoneNumeric: zoneDecision.zoneNumeric,
    confidence: zoneDecision.confidence,
    timestampIso,
  };

  const historyRecord: ZoneHistoryBufferRecord = {
    ...zoneSnapshot,
    turnId,
    sessionId,
  };

  return {
    ...stateDat,
    current: {
      ...stateDat.current,
      zone: zoneSnapshot,
      lastUpdatedAt: timestampIso,
    },
    zoneHistoryBuffer: [...stateDat.zoneHistoryBuffer, historyRecord].slice(-MAX_ZONE_HISTORY),
    updatedAt: timestampIso,
  };
}
