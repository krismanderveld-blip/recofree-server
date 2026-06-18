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
import { createPatchId } from "@/lib/utils/hash/createPatchId";
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

  // PsychoEducation activation → user.dat + projections.dat + logs.dat
  if (bundle.psychoEducationActivation && !bundle.psychoEducationActivation.crisisOverride) {
    const peAct = bundle.psychoEducationActivation;
    // user.dat: module usage increment
    patches.push({
      patchId: createPatchId(ctx.turnId, "user.dat", `psychoEducation.${peAct.moduleId}`),
      layer: "user.dat",
      operation: "INCREMENT",
      path: "moduleUsage",
      source: "PsychoEducation_PE",
      payload: {
        moduleId: peAct.moduleId,
        lastActivatedAt: ctx.timestampIso,
        activationCountIncrement: 1,
        turnId: ctx.turnId,
        sessionId: ctx.sessionId,
        timestampIso: ctx.timestampIso,
        source: "PsychoEducation_PE",
      },
      shouldWrite: true,
      reason: `PsychoEducation ${peAct.moduleId} activated with confidence ${peAct.activationConfidence}`,
    });
    // projections.dat: belief upsert
    patches.push({
      patchId: createPatchId(ctx.turnId, "projections.dat", `psychoEducation.belief.${peAct.moduleId}`),
      layer: "projections.dat",
      operation: "DECAY_REFRESH_UPSERT",
      path: "fears",
      source: "PsychoEducation_PE",
      payload: {
        kind: "fear" as const,
        label: peAct.moduleId === 'WILSKRACHT01' ? 'willpower_failure_belief' : 'autopilot_no_choice_belief',
        normalizedLabel: peAct.moduleId === 'WILSKRACHT01' ? 'willpower_failure_belief' : 'autopilot_no_choice_belief',
        category: peAct.moduleId === 'WILSKRACHT01' ? 'willpower_shame_belief' : 'autopilot_trigger_belief',
        confidence: peAct.activationConfidence,
        sourceKind: "PsychoEducation_PE",
        turnId: ctx.turnId,
        sessionId: ctx.sessionId,
        timestampIso: ctx.timestampIso,
        source: "PsychoEducation_PE",
        evidenceHash: stableHash(`${peAct.moduleId}_${ctx.turnId}`),
      },
      shouldWrite: true,
      reason: `PsychoEducation belief from ${peAct.moduleId}`,
    });
  }

  // PAAL01 Steunpilaren activation → user.dat + logs.dat
  if (bundle.paal01Activation) {
    const paal = bundle.paal01Activation;
    // user.dat: module usage increment
    patches.push({
      patchId: createPatchId(ctx.turnId, "user.dat", `steunpilaren.PAAL01`),
      layer: "user.dat",
      operation: "INCREMENT",
      path: "moduleUsage",
      source: "Steunpilaren_PAAL01",
      payload: {
        moduleId: paal.moduleId,
        lastActivatedAt: ctx.timestampIso,
        activationCountIncrement: 1,
        triggerContext: paal.triggerContext,
        turnId: ctx.turnId,
        sessionId: ctx.sessionId,
        timestampIso: ctx.timestampIso,
        source: "Steunpilaren_PAAL01",
      },
      shouldWrite: true,
      reason: `PAAL01 activated: ${paal.triggerContext} with confidence ${paal.confidence}`,
    });
    // state.dat: active therapeutic frame
    patches.push({
      patchId: createPatchId(ctx.turnId, "state.dat", `steunpilaren.frame`),
      layer: "state.dat",
      operation: "REPLACE_CURRENT",
      path: "activeTherapeuticFrame",
      source: "Steunpilaren_PAAL01",
      payload: {
        activeTherapeuticFrame: "steunpilaren_inventaris",
        activeModuleId: "PAAL01",
        lastActivatedAt: ctx.timestampIso,
        triggerContext: paal.triggerContext,
        turnId: ctx.turnId,
        sessionId: ctx.sessionId,
        timestampIso: ctx.timestampIso,
        source: "Steunpilaren_PAAL01",
      },
      shouldWrite: true,
      reason: `PAAL01 frame: steunpilaren_inventaris`,
    });
    // logs.dat: encrypted event
    patches.push({
      patchId: createPatchId(ctx.turnId, "logs.dat", `steunpilaren.event`),
      layer: "logs.dat",
      operation: "ENCRYPTED_APPEND",
      path: "events",
      source: "Steunpilaren_PAAL01",
      payload: {
        encryptedEventType: "therapeutic_module_activation",
        moduleId: "PAAL01",
        triggerContext: paal.triggerContext,
        matchedMarkers: paal.matchedMarkers,
        confidence: paal.confidence,
        turnId: ctx.turnId,
        sessionId: ctx.sessionId,
        timestampIso: ctx.timestampIso,
        source: "Steunpilaren_PAAL01",
        safeSummary: `PAAL01 activated: ${paal.triggerContext}`,
      },
      shouldWrite: true,
      reason: `PAAL01 event log`,
    });
  }

  // Self-Acceptance Cluster (BLIK01/ONTK01/IKST01/COEX01) → user.dat + state.dat + logs.dat
  if (bundle.selfAcceptanceActivation) {
    const sac = bundle.selfAcceptanceActivation;
    // user.dat: module usage increment
    patches.push({
      patchId: createPatchId(ctx.turnId, "user.dat", `selfAcceptance.${sac.moduleId}`),
      layer: "user.dat",
      operation: "INCREMENT",
      path: "moduleUsage",
      source: `SelfAcceptance_${sac.moduleId}`,
      payload: {
        moduleId: sac.moduleId,
        lastActivatedAt: ctx.timestampIso,
        activationCountIncrement: 1,
        interventionType: sac.interventionType,
        patternType: sac.patternType,
        turnId: ctx.turnId,
        sessionId: ctx.sessionId,
        timestampIso: ctx.timestampIso,
        source: `SelfAcceptance_${sac.moduleId}`,
      },
      shouldWrite: true,
      reason: `${sac.moduleId} activated: ${sac.interventionType} with confidence ${sac.confidence}`,
    });
    // state.dat: active therapeutic frame
    const frameMap: Record<string, string> = {
      BLIK01: 'support_pillar_shock',
      ONTK01: 'denial_pattern_reflection',
      IKST01: 'ego_strength_recovery',
      COEX01: 'existential_acceptance',
    };
    patches.push({
      patchId: createPatchId(ctx.turnId, "state.dat", `selfAcceptance.frame`),
      layer: "state.dat",
      operation: "REPLACE_CURRENT",
      path: "activeTherapeuticFrame",
      source: `SelfAcceptance_${sac.moduleId}`,
      payload: {
        activeTherapeuticFrame: frameMap[sac.moduleId] || 'existential_acceptance',
        activeModuleId: sac.moduleId,
        lastActivatedAt: ctx.timestampIso,
        interventionType: sac.interventionType,
        turnId: ctx.turnId,
        sessionId: ctx.sessionId,
        timestampIso: ctx.timestampIso,
        source: `SelfAcceptance_${sac.moduleId}`,
      },
      shouldWrite: true,
      reason: `${sac.moduleId} frame: ${frameMap[sac.moduleId]}`,
    });
    // logs.dat: encrypted event
    patches.push({
      patchId: createPatchId(ctx.turnId, "logs.dat", `selfAcceptance.event`),
      layer: "logs.dat",
      operation: "ENCRYPTED_APPEND",
      path: "events",
      source: `SelfAcceptance_${sac.moduleId}`,
      payload: {
        encryptedEventType: "therapeutic_module_activation",
        moduleId: sac.moduleId,
        interventionType: sac.interventionType,
        patternType: sac.patternType,
        matchedMarkers: sac.matchedMarkers,
        confidence: sac.confidence,
        turnId: ctx.turnId,
        sessionId: ctx.sessionId,
        timestampIso: ctx.timestampIso,
        source: `SelfAcceptance_${sac.moduleId}`,
        safeSummary: `${sac.moduleId} activated: ${sac.interventionType}`,
      },
      shouldWrite: true,
      reason: `${sac.moduleId} event log`,
    });
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
