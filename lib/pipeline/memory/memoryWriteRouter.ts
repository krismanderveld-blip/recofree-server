/**
 * Memory Write Router — Builds a MemoryWritePlan from pipeline detections.
 * Engine beslist, GPT voert uit.
 */
import type {
  PipelineDetectionBundle,
  MemoryWritePlan,
  MemoryWritePatch,
} from "@/lib/types/memory/memoryCore.types";
import { stableHash } from "@/lib/utils/hash/stableHash";
import {
  buildFearProjectionPatch,
  buildHopeProjectionPatch,
  buildTriggerPatternPatch,
  buildSchemaTendencyPatch,
  buildModeTendencyPatch,
  buildModuleUsagePatch,
  buildActiveModuleStatePatch,
  buildZoneStatePatch,
  buildMoodStatePatch,
  buildBufferTurnSnapshotPatch,
} from "./memoryPatchBuilders";

/**
 * Build a complete memory write plan from all structured engine detections.
 * This is the per-turn deterministic write-back step.
 */
export function buildMemoryWritePlan(bundle: PipelineDetectionBundle): MemoryWritePlan {
  const { context: ctx } = bundle;
  const patches: MemoryWritePatch[] = [];

  // Fears → projections.dat
  for (const fear of bundle.fears) {
    patches.push(buildFearProjectionPatch(fear, ctx));
  }

  // Hopes → projections.dat
  for (const hope of bundle.hopes) {
    patches.push(buildHopeProjectionPatch(hope, ctx));
  }

  // Triggers → user.dat
  for (const trigger of bundle.triggers) {
    patches.push(buildTriggerPatternPatch(trigger, ctx));
  }

  // Schema tendencies → user.dat
  for (const schema of bundle.schemaTendencies) {
    patches.push(buildSchemaTendencyPatch(schema, ctx));
  }

  // Mode tendencies → user.dat
  for (const mode of bundle.modeTendencies) {
    patches.push(buildModeTendencyPatch(mode, ctx));
  }

  // Active module → user.dat moduleUsage + state.dat current
  if (bundle.activeModule) {
    patches.push(buildModuleUsagePatch(bundle.activeModule, ctx));
    patches.push(buildActiveModuleStatePatch(bundle.activeModule, ctx));
  }

  // Zone → state.dat
  if (bundle.zoneDecision) {
    patches.push(buildZoneStatePatch(bundle.zoneDecision, ctx));
  }

  // Mood → state.dat
  if (bundle.moodState) {
    patches.push(buildMoodStatePatch(bundle.moodState, ctx));
  }

  // Collect changed fields for buffer snapshot
  const changedFields = patches
    .filter((p) => p.shouldWrite)
    .map((p) => `${p.layer.replace(".dat", "")}.${p.path}`);

  const detectedCounts = {
    fears: bundle.fears.length,
    hopes: bundle.hopes.length,
    triggers: bundle.triggers.length,
    schemaTendencies: bundle.schemaTendencies.length,
    modeTendencies: bundle.modeTendencies.length,
  };

  // Buffer turn snapshot — always append
  patches.push(buildBufferTurnSnapshotPatch(ctx, detectedCounts, changedFields));

  return {
    planId: `plan_${stableHash(`${ctx.turnId}|${ctx.sessionId}`)}`,
    turnId: ctx.turnId,
    sessionId: ctx.sessionId,
    persona: ctx.persona,
    createdAt: ctx.timestampIso,
    patches,
  };
}
