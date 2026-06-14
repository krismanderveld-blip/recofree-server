/**
 * Memory Patch Builders — Convert pipeline detections into typed MemoryWritePatches.
 */
import type {
  MemoryWritePatch,
  DetectedFear,
  DetectedHope,
  DetectedTrigger,
  DetectedSchemaTendency,
  DetectedModeTendency,
  MoodStateExtraction,
  ZoneDecision,
  ActiveModuleDecision,
  PipelineTurnContext,
  WRITE_THRESHOLDS as ThresholdsType,
} from "@/lib/types/memory/memoryCore.types";
import { WRITE_THRESHOLDS } from "@/lib/types/memory/memoryCore.types";
import { createPatchId } from "@/lib/utils/hash/createPatchId";

export function buildFearProjectionPatch(
  fear: DetectedFear,
  ctx: PipelineTurnContext
): MemoryWritePatch {
  const shouldWrite = fear.confidence >= WRITE_THRESHOLDS.FEAR_PER_TURN;
  return {
    patchId: createPatchId(ctx.turnId, "projections.dat", `fears.${fear.normalizedLabel}`),
    layer: "projections.dat",
    operation: "DECAY_REFRESH_UPSERT",
    path: "fears",
    source: "SignalEngine_6c",
    payload: {
      kind: "fear" as const,
      label: fear.label,
      normalizedLabel: fear.normalizedLabel,
      category: fear.category,
      confidence: fear.confidence,
      sourceKind: fear.sourceKind,
      turnId: ctx.turnId,
      sessionId: ctx.sessionId,
      timestampIso: ctx.timestampIso,
      source: "SignalEngine_6c" as const,
      evidenceHash: fear.evidenceHash,
    },
    shouldWrite,
    reason: shouldWrite
      ? `fear confidence ${fear.confidence} >= threshold ${WRITE_THRESHOLDS.FEAR_PER_TURN}`
      : `fear confidence ${fear.confidence} < threshold ${WRITE_THRESHOLDS.FEAR_PER_TURN}`,
  };
}

export function buildHopeProjectionPatch(
  hope: DetectedHope,
  ctx: PipelineTurnContext
): MemoryWritePatch {
  const shouldWrite = hope.confidence >= WRITE_THRESHOLDS.HOPE_PER_TURN;
  return {
    patchId: createPatchId(ctx.turnId, "projections.dat", `hopes.${hope.normalizedLabel}`),
    layer: "projections.dat",
    operation: "DECAY_REFRESH_UPSERT",
    path: "hopes",
    source: "SignalEngine_6c",
    payload: {
      kind: "hope" as const,
      label: hope.label,
      normalizedLabel: hope.normalizedLabel,
      category: hope.category,
      confidence: hope.confidence,
      sourceKind: hope.sourceKind,
      turnId: ctx.turnId,
      sessionId: ctx.sessionId,
      timestampIso: ctx.timestampIso,
      source: "SignalEngine_6c" as const,
      evidenceHash: hope.evidenceHash,
    },
    shouldWrite,
    reason: shouldWrite
      ? `hope confidence ${hope.confidence} >= threshold ${WRITE_THRESHOLDS.HOPE_PER_TURN}`
      : `hope confidence ${hope.confidence} < threshold ${WRITE_THRESHOLDS.HOPE_PER_TURN}`,
  };
}

export function buildTriggerPatternPatch(
  trigger: DetectedTrigger,
  ctx: PipelineTurnContext
): MemoryWritePatch {
  const shouldWrite = trigger.confidence >= WRITE_THRESHOLDS.TRIGGER_PER_TURN;
  return {
    patchId: createPatchId(ctx.turnId, "user.dat", `triggerPatterns.${trigger.normalizedTrigger}`),
    layer: "user.dat",
    operation: "UPSERT",
    path: "triggerPatterns",
    source: "SignalEngine_6c",
    payload: {
      label: trigger.label,
      normalizedTrigger: trigger.normalizedTrigger,
      triggerType: trigger.triggerType,
      confidence: trigger.confidence,
      sourceKind: trigger.sourceKind,
      turnId: ctx.turnId,
      sessionId: ctx.sessionId,
      timestampIso: ctx.timestampIso,
      source: "SignalEngine_6c" as const,
      evidenceHash: trigger.evidenceHash,
    },
    shouldWrite,
    reason: shouldWrite
      ? `trigger confidence ${trigger.confidence} >= threshold ${WRITE_THRESHOLDS.TRIGGER_PER_TURN}`
      : `trigger confidence ${trigger.confidence} < threshold ${WRITE_THRESHOLDS.TRIGGER_PER_TURN}`,
  };
}

export function buildSchemaTendencyPatch(
  schema: DetectedSchemaTendency,
  ctx: PipelineTurnContext
): MemoryWritePatch {
  const shouldWrite = schema.confidence >= WRITE_THRESHOLDS.SCHEMA_PER_TURN;
  return {
    patchId: createPatchId(ctx.turnId, "user.dat", `schemaTendencies.${schema.schemaId}`),
    layer: "user.dat",
    operation: "MOVING_AVERAGE_UPSERT",
    path: "schemaTendencies",
    source: "SchemaMode_6f",
    payload: {
      schemaId: schema.schemaId,
      schemaName: schema.schemaName,
      confidence: schema.confidence,
      sourceKind: schema.sourceKind,
      turnId: ctx.turnId,
      sessionId: ctx.sessionId,
      timestampIso: ctx.timestampIso,
      source: "SchemaMode_6f" as const,
      evidenceHash: schema.evidenceHash,
    },
    shouldWrite,
    reason: shouldWrite
      ? `schema confidence ${schema.confidence} >= threshold ${WRITE_THRESHOLDS.SCHEMA_PER_TURN}`
      : `schema confidence ${schema.confidence} < threshold ${WRITE_THRESHOLDS.SCHEMA_PER_TURN}`,
  };
}

export function buildModeTendencyPatch(
  mode: DetectedModeTendency,
  ctx: PipelineTurnContext
): MemoryWritePatch {
  const shouldWrite = mode.confidence >= WRITE_THRESHOLDS.MODE_PER_TURN;
  return {
    patchId: createPatchId(ctx.turnId, "user.dat", `modeTendencies.${mode.modeId}`),
    layer: "user.dat",
    operation: "MOVING_AVERAGE_UPSERT",
    path: "modeTendencies",
    source: "SchemaMode_6f",
    payload: {
      modeId: mode.modeId,
      modeName: mode.modeName,
      confidence: mode.confidence,
      sourceKind: mode.sourceKind,
      turnId: ctx.turnId,
      sessionId: ctx.sessionId,
      timestampIso: ctx.timestampIso,
      source: "SchemaMode_6f" as const,
      evidenceHash: mode.evidenceHash,
    },
    shouldWrite,
    reason: shouldWrite
      ? `mode confidence ${mode.confidence} >= threshold ${WRITE_THRESHOLDS.MODE_PER_TURN}`
      : `mode confidence ${mode.confidence} < threshold ${WRITE_THRESHOLDS.MODE_PER_TURN}`,
  };
}

export function buildModuleUsagePatch(
  module: ActiveModuleDecision,
  ctx: PipelineTurnContext
): MemoryWritePatch {
  return {
    patchId: createPatchId(ctx.turnId, "user.dat", `moduleUsage.${module.moduleId}`),
    layer: "user.dat",
    operation: "INCREMENT",
    path: "moduleUsage",
    source: "ActiveModuleSelector_12",
    payload: {
      moduleId: module.moduleId,
      persona: module.persona,
      responseMode: module.responseMode,
      confidence: module.confidence,
      turnId: ctx.turnId,
      sessionId: ctx.sessionId,
      timestampIso: ctx.timestampIso,
    },
    shouldWrite: true,
    reason: "module selected — always write usage",
  };
}

export function buildActiveModuleStatePatch(
  module: ActiveModuleDecision,
  ctx: PipelineTurnContext
): MemoryWritePatch {
  return {
    patchId: createPatchId(ctx.turnId, "state.dat", "current.activeModule"),
    layer: "state.dat",
    operation: "REPLACE_CURRENT",
    path: "current.activeModuleId",
    source: "ActiveModuleSelector_12",
    payload: {
      activeModuleId: module.moduleId,
      activeResponseMode: module.responseMode,
      lastPipelineTurnId: ctx.turnId,
      lastSessionId: ctx.sessionId,
    },
    shouldWrite: true,
    reason: "active module state update",
  };
}

export function buildZoneStatePatch(
  zone: ZoneDecision,
  ctx: PipelineTurnContext
): MemoryWritePatch {
  if (zone.zone === "UNKNOWN") {
    return {
      patchId: createPatchId(ctx.turnId, "state.dat", "current.zone"),
      layer: "state.dat",
      operation: "NOOP",
      path: "current.zone",
      source: zone.sourceKind,
      payload: null,
      shouldWrite: false,
      reason: "zone is UNKNOWN — no write",
    };
  }
  return {
    patchId: createPatchId(ctx.turnId, "state.dat", "current.zone"),
    layer: "state.dat",
    operation: "REPLACE_CURRENT",
    path: "current.zone",
    source: zone.sourceKind,
    payload: {
      zone: zone.zone,
      zoneNumeric: zone.zoneNumeric,
      confidence: zone.confidence,
      turnId: ctx.turnId,
      sessionId: ctx.sessionId,
      timestampIso: ctx.timestampIso,
    },
    shouldWrite: true,
    reason: `zone ${zone.zone} detected with confidence ${zone.confidence}`,
  };
}

export function buildMoodStatePatch(
  mood: MoodStateExtraction,
  ctx: PipelineTurnContext
): MemoryWritePatch {
  const shouldWrite =
    mood.sourceKind !== "not_detected" && mood.confidence >= WRITE_THRESHOLDS.MOOD_CONFIDENCE;
  return {
    patchId: createPatchId(ctx.turnId, "state.dat", "current.mood"),
    layer: "state.dat",
    operation: shouldWrite ? "REPLACE_CURRENT" : "NOOP",
    path: "current.mood",
    source: "MoodExtraction_6d",
    payload: shouldWrite ? { ...mood, turnId: ctx.turnId, sessionId: ctx.sessionId, timestampIso: ctx.timestampIso } : null,
    shouldWrite,
    reason: shouldWrite
      ? `mood sourceKind=${mood.sourceKind} confidence=${mood.confidence} >= ${WRITE_THRESHOLDS.MOOD_CONFIDENCE}`
      : `mood not detected or confidence ${mood.confidence} < ${WRITE_THRESHOLDS.MOOD_CONFIDENCE}`,
  };
}

export function buildBufferTurnSnapshotPatch(
  ctx: PipelineTurnContext,
  detectedCounts: { fears: number; hopes: number; triggers: number; schemaTendencies: number; modeTendencies: number },
  changedFields: string[]
): MemoryWritePatch {
  return {
    patchId: createPatchId(ctx.turnId, "buffer", "turnSnapshot"),
    layer: "buffer",
    operation: "APPEND",
    path: "turnSnapshots",
    source: "ResponseModeRouter_13",
    payload: {
      turnId: ctx.turnId,
      timestampIso: ctx.timestampIso,
      inputHash: ctx.inputHash,
      detectedCounts,
      changedFields,
    },
    shouldWrite: true,
    reason: "buffer turn snapshot — always append",
  };
}
