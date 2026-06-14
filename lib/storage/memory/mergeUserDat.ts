/**
 * Deterministic merge functions for user.dat layer.
 */
import type {
  UserDat,
  TriggerPatternRecord,
  SchemaTendencyRecord,
  ModeTendencyRecord,
  ModuleUsageRecord,
  TriggerPatternPatchPayload,
  SchemaTendencyPatchPayload,
  ModeTendencyPatchPayload,
  ModuleUsagePatchPayload,
} from "@/lib/types/memory/userDat.types";
import { stableHash } from "@/lib/utils/hash/stableHash";
import { roundTo3 } from "@/lib/utils/math/roundTo3";

const MAX_SOURCES = 20;
const MAX_RECENT_USES = 10;

/**
 * Merge a trigger detection into user.dat triggerPatterns.
 * Key: normalizedTrigger + triggerType
 */
export function mergeTriggerPattern(
  userDat: UserDat,
  payload: TriggerPatternPatchPayload
): UserDat {
  const key = `${payload.normalizedTrigger}|${payload.triggerType}`;
  const existing = userDat.triggerPatterns.find(
    (t) => `${t.normalizedTrigger}|${t.triggerType}` === key
  );

  const sourceEntry = {
    turnId: payload.turnId,
    sessionId: payload.sessionId,
    timestampIso: payload.timestampIso,
    source: payload.source,
    confidence: payload.confidence,
    evidenceHash: payload.evidenceHash,
  };

  if (existing) {
    const updated: TriggerPatternRecord = {
      ...existing,
      frequency: existing.frequency + 1,
      lastSeenAt: payload.timestampIso,
      lastConfidence: payload.confidence,
      highestConfidence: Math.max(existing.highestConfidence, payload.confidence),
      sourceCounts: {
        ...existing.sourceCounts,
        [payload.sourceKind]: (existing.sourceCounts[payload.sourceKind] || 0) + 1,
      },
      sources: [...existing.sources, sourceEntry].slice(-MAX_SOURCES),
    };
    return {
      ...userDat,
      triggerPatterns: userDat.triggerPatterns.map((t) =>
        `${t.normalizedTrigger}|${t.triggerType}` === key ? updated : t
      ),
      updatedAt: payload.timestampIso,
    };
  }

  // New trigger
  const newRecord: TriggerPatternRecord = {
    triggerId: `trigger_${stableHash(`${payload.normalizedTrigger}|${payload.triggerType}`).slice(0, 16)}`,
    label: payload.label,
    normalizedTrigger: payload.normalizedTrigger,
    triggerType: payload.triggerType,
    frequency: 1,
    firstSeenAt: payload.timestampIso,
    lastSeenAt: payload.timestampIso,
    lastConfidence: payload.confidence,
    highestConfidence: payload.confidence,
    sourceCounts: {
      explicit_user_text: payload.sourceKind === "explicit_user_text" ? 1 : 0,
      pattern_inference: payload.sourceKind === "pattern_inference" ? 1 : 0,
      session_summary: payload.sourceKind === "session_summary" ? 1 : 0,
    },
    sources: [sourceEntry],
  };

  return {
    ...userDat,
    triggerPatterns: [...userDat.triggerPatterns, newRecord],
    updatedAt: payload.timestampIso,
  };
}

/**
 * Merge a schema tendency detection into user.dat schemaTendencies.
 * Key: schemaId
 * Uses confidence moving average.
 */
export function mergeSchemaTendency(
  userDat: UserDat,
  payload: SchemaTendencyPatchPayload
): UserDat {
  const existing = userDat.schemaTendencies.find((s) => s.schemaId === payload.schemaId);

  const sourceEntry = {
    turnId: payload.turnId,
    sessionId: payload.sessionId,
    timestampIso: payload.timestampIso,
    source: payload.source,
    confidence: payload.confidence,
    evidenceHash: payload.evidenceHash,
  };

  if (existing) {
    const oldCount = existing.observationCount;
    const newCount = oldCount + 1;
    const newAvg = roundTo3(((existing.confidenceAverage * oldCount) + payload.confidence) / newCount);
    const updated: SchemaTendencyRecord = {
      ...existing,
      observationCount: newCount,
      confidenceAverage: newAvg,
      confidencePeak: Math.max(existing.confidencePeak, payload.confidence),
      lastSeenAt: payload.timestampIso,
      sources: [...existing.sources, sourceEntry].slice(-MAX_SOURCES),
    };
    return {
      ...userDat,
      schemaTendencies: userDat.schemaTendencies.map((s) =>
        s.schemaId === payload.schemaId ? updated : s
      ),
      updatedAt: payload.timestampIso,
    };
  }

  // New schema tendency
  const newRecord: SchemaTendencyRecord = {
    schemaId: payload.schemaId,
    schemaName: payload.schemaName,
    observationCount: 1,
    confidenceAverage: payload.confidence,
    confidencePeak: payload.confidence,
    firstSeenAt: payload.timestampIso,
    lastSeenAt: payload.timestampIso,
    sources: [sourceEntry],
  };

  return {
    ...userDat,
    schemaTendencies: [...userDat.schemaTendencies, newRecord],
    updatedAt: payload.timestampIso,
  };
}

/**
 * Merge a mode tendency detection into user.dat modeTendencies.
 * Key: modeId. Same logic as schema merge.
 */
export function mergeModeTendency(
  userDat: UserDat,
  payload: ModeTendencyPatchPayload
): UserDat {
  const existing = userDat.modeTendencies.find((m) => m.modeId === payload.modeId);

  const sourceEntry = {
    turnId: payload.turnId,
    sessionId: payload.sessionId,
    timestampIso: payload.timestampIso,
    source: payload.source,
    confidence: payload.confidence,
    evidenceHash: payload.evidenceHash,
  };

  if (existing) {
    const oldCount = existing.observationCount;
    const newCount = oldCount + 1;
    const newAvg = roundTo3(((existing.confidenceAverage * oldCount) + payload.confidence) / newCount);
    const updated: ModeTendencyRecord = {
      ...existing,
      observationCount: newCount,
      confidenceAverage: newAvg,
      confidencePeak: Math.max(existing.confidencePeak, payload.confidence),
      lastSeenAt: payload.timestampIso,
      sources: [...existing.sources, sourceEntry].slice(-MAX_SOURCES),
    };
    return {
      ...userDat,
      modeTendencies: userDat.modeTendencies.map((m) =>
        m.modeId === payload.modeId ? updated : m
      ),
      updatedAt: payload.timestampIso,
    };
  }

  // New mode tendency
  const newRecord: ModeTendencyRecord = {
    modeId: payload.modeId,
    modeName: payload.modeName,
    observationCount: 1,
    confidenceAverage: payload.confidence,
    confidencePeak: payload.confidence,
    firstSeenAt: payload.timestampIso,
    lastSeenAt: payload.timestampIso,
    sources: [sourceEntry],
  };

  return {
    ...userDat,
    modeTendencies: [...userDat.modeTendencies, newRecord],
    updatedAt: payload.timestampIso,
  };
}

/**
 * Merge module usage into user.dat moduleUsage.
 * Key: moduleId + persona
 */
export function mergeModuleUsage(
  userDat: UserDat,
  payload: ModuleUsagePatchPayload
): UserDat {
  const key = `${payload.moduleId}|${payload.persona}`;
  const existing = userDat.moduleUsage.find(
    (m) => `${m.moduleId}|${m.persona}` === key
  );

  const recentEntry = {
    turnId: payload.turnId,
    sessionId: payload.sessionId,
    timestampIso: payload.timestampIso,
    responseMode: payload.responseMode,
    confidence: payload.confidence,
  };

  if (existing) {
    const updated: ModuleUsageRecord = {
      ...existing,
      usageCount: existing.usageCount + 1,
      lastUsedAt: payload.timestampIso,
      lastResponseMode: payload.responseMode,
      recentUses: [...existing.recentUses, recentEntry].slice(-MAX_RECENT_USES),
    };
    return {
      ...userDat,
      moduleUsage: userDat.moduleUsage.map((m) =>
        `${m.moduleId}|${m.persona}` === key ? updated : m
      ),
      updatedAt: payload.timestampIso,
    };
  }

  // New module usage
  const newRecord: ModuleUsageRecord = {
    moduleId: payload.moduleId,
    persona: payload.persona,
    usageCount: 1,
    firstUsedAt: payload.timestampIso,
    lastUsedAt: payload.timestampIso,
    lastResponseMode: payload.responseMode,
    recentUses: [recentEntry],
  };

  return {
    ...userDat,
    moduleUsage: [...userDat.moduleUsage, newRecord],
    updatedAt: payload.timestampIso,
  };
}
