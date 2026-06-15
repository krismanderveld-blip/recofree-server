/**
 * Kim Advanced Modules P8 — Relational Dynamics Cluster (ROL-K01, VETR02-K, LEUGEN-K01)
 * Reflective modules. Lower priority than acute clusters (P6 relapse, P7 danger/child).
 * Runs only when no acute module is active.
 */

import type { KimCluster3RuntimeInput, KimCluster3DetectionResult, KimCluster3PromptPayload, KimCluster3MemoryPatch } from '@/modules/kim/relationalDynamicsCluster';
import { resolveCluster3Priority, buildKimCluster3Payload, buildKimCluster3MemoryPatch, enforceKimCluster3OutputSafety } from '@/modules/kim/relationalDynamicsCluster';

export interface KimP8Input {
  persona: 'kim' | 'elias' | 'unknown';
  intakeCompleted: boolean;
  latestUserMessage: string;
  recentMessages: string[];
  language: 'nl' | 'en' | 'fr' | 'mixed' | 'unknown';
  // Acute context flags (from P6/P7)
  activeRelapseNow: boolean;
  postRelapseAftermath: boolean;
  caregiverOverwhelmed: boolean;
  immediateDanger: boolean;
  childPresentOrAffected: boolean;
  aggressionDetected: boolean;
  domesticViolenceOrAbuseDetected: boolean;
  selfHarmOrSuicideDetected: boolean;
  medicalEmergencyDetected: boolean;
  disappearanceAcuteDangerDetected: boolean;
  // Cluster 3 specific flags
  careRoleDroppedOrPaused: boolean;
  lovedOneStableOrAdmitted: boolean;
  suppressedEmotionWaveDetected: boolean;
  partnerAbsentOrInAdmission: boolean;
  hypervigilanceDetected: boolean;
  reexperienceDetected: boolean;
  chronicLyingDetected: boolean;
  detectiveRoleDetected: boolean;
  betrayalPainDetected: boolean;
  // Context
  lovedOneUseContext: boolean;
  firstPersonUseContext: boolean;
  sessionId: string;
  turnId: string;
  timestampIso: string;
}

export interface KimP8Result {
  active: boolean;
  moduleId: string | null;
  detectionResult: KimCluster3DetectionResult | null;
  payload: KimCluster3PromptPayload | null;
  memoryPatch: KimCluster3MemoryPatch | null;
  promptContext: string | null;
}

export function runKimAdvancedModulesP8(input: KimP8Input): KimP8Result {
  const inactive: KimP8Result = {
    active: false,
    moduleId: null,
    detectionResult: null,
    payload: null,
    memoryPatch: null,
    promptContext: null,
  };

  if (input.persona !== 'kim') return inactive;
  if (!input.intakeCompleted) return inactive;

  const runtimeInput: KimCluster3RuntimeInput = {
    persona: input.persona,
    intakeCompleted: input.intakeCompleted,
    latestUserMessage: input.latestUserMessage,
    recentMessages: input.recentMessages,
    language: input.language,
    detectedMarkers: [],
    lovedOneUseContext: input.lovedOneUseContext,
    firstPersonUseContext: input.firstPersonUseContext,
    caregiverOverwhelmed: input.caregiverOverwhelmed,
    immediateDanger: input.immediateDanger,
    childPresentOrAffected: input.childPresentOrAffected,
    activeRelapseNow: input.activeRelapseNow,
    postRelapseAftermath: input.postRelapseAftermath,
    aggressionDetected: input.aggressionDetected,
    domesticViolenceOrAbuseDetected: input.domesticViolenceOrAbuseDetected,
    selfHarmOrSuicideDetected: input.selfHarmOrSuicideDetected,
    medicalEmergencyDetected: input.medicalEmergencyDetected,
    disappearanceAcuteDangerDetected: input.disappearanceAcuteDangerDetected,
    careRoleDroppedOrPaused: input.careRoleDroppedOrPaused,
    lovedOneStableOrAdmitted: input.lovedOneStableOrAdmitted,
    suppressedEmotionWaveDetected: input.suppressedEmotionWaveDetected,
    partnerAbsentOrInAdmission: input.partnerAbsentOrInAdmission,
    hypervigilanceDetected: input.hypervigilanceDetected,
    reexperienceDetected: input.reexperienceDetected,
    chronicLyingDetected: input.chronicLyingDetected,
    detectiveRoleDetected: input.detectiveRoleDetected,
    betrayalPainDetected: input.betrayalPainDetected,
    timestampIso: input.timestampIso,
    sessionId: input.sessionId,
    turnId: input.turnId,
  };

  const detectionResult = resolveCluster3Priority(runtimeInput);

  if (!detectionResult) return inactive;
  if (detectionResult.activationStatus !== 'ACTIVE') {
    // Deferred to acute module — return result but not active for P8
    return {
      active: false,
      moduleId: detectionResult.moduleId,
      detectionResult,
      payload: null,
      memoryPatch: null,
      promptContext: null,
    };
  }

  const payload = buildKimCluster3Payload(detectionResult);
  const memoryPatch = buildKimCluster3MemoryPatch(detectionResult, runtimeInput);

  return {
    active: true,
    moduleId: detectionResult.moduleId,
    detectionResult,
    payload,
    memoryPatch,
    promptContext: payload.fullPrompt,
  };
}
