/**
 * Kim Advanced Modules — P10 (STOA-K: Stoic Reflective Framework)
 *
 * Priority: Below all acute clusters (P6/P7) and all specific reflective modules (P8/P9),
 * above KST01. Never both STOA-K and KST01 as primary in one turn.
 */

import {
  detectStoaK,
  buildKimStoaKPayload,
  buildKimStoaKMemoryPatch,
  enforceKimStoaKOutputSafety,
} from '@/modules/kim/stoaK';
import type {
  KimStoaRuntimeInput,
  KimStoaDetectionResult,
  KimStoaPromptPayload,
  KimStoaMemoryPatch,
} from '@/modules/kim/stoaK';

export interface KimP10Input {
  message: string;
  persona: 'elias' | 'kim';
  recentMessages?: string[];
  language?: 'nl' | 'en' | 'fr' | 'mixed' | 'unknown';
  intakeCompleted?: boolean;
  // Context flags
  lovedOneUseContext?: boolean;
  firstPersonUseContext?: boolean;
  caregiverOverwhelmed?: boolean;
  immediateDanger?: boolean;
  childPresentOrAffected?: boolean;
  aggressionDetected?: boolean;
  domesticViolenceOrAbuseDetected?: boolean;
  disappearanceAcuteDangerDetected?: boolean;
  selfHarmOrSuicideDetected?: boolean;
  medicalEmergencyDetected?: boolean;
  activeRelapseNow?: boolean;
  // STOA-K specific flags
  controlDistinctionDetected?: boolean;
  controlLoopDetected?: boolean;
  lettingGoQuestionDetected?: boolean;
  valuesQuestionDetected?: boolean;
  boundaryControlQuestionDetected?: boolean;
  responsibilitySeparationDetected?: boolean;
  acceptanceNotApprovalDetected?: boolean;
  deeperStoicReflectionDetected?: boolean;
  fastGroundingNeedDetected?: boolean;
  // Specific reflective module candidate
  specificReflectiveModuleCandidate?: string | null;
}

export interface KimP10Result {
  active: boolean;
  moduleId: string;
  detectionResult: KimStoaDetectionResult | null;
  payload: KimStoaPromptPayload | null;
  memoryPatch: KimStoaMemoryPatch | null;
  contextString: string;
}

export function runKimAdvancedP10(input: KimP10Input): KimP10Result {
  const runtimeInput: KimStoaRuntimeInput = {
    persona: input.persona,
    intakeCompleted: input.intakeCompleted ?? true,
    latestUserMessage: input.message,
    recentMessages: input.recentMessages ?? [],
    language: input.language ?? 'nl',
    detectedMarkers: [],
    lovedOneUseContext: input.lovedOneUseContext ?? false,
    firstPersonUseContext: input.firstPersonUseContext ?? false,
    caregiverOverwhelmed: input.caregiverOverwhelmed ?? false,
    immediateDanger: input.immediateDanger ?? false,
    childPresentOrAffected: input.childPresentOrAffected ?? false,
    aggressionDetected: input.aggressionDetected ?? false,
    domesticViolenceOrAbuseDetected: input.domesticViolenceOrAbuseDetected ?? false,
    disappearanceAcuteDangerDetected: input.disappearanceAcuteDangerDetected ?? false,
    selfHarmOrSuicideDetected: input.selfHarmOrSuicideDetected ?? false,
    medicalEmergencyDetected: input.medicalEmergencyDetected ?? false,
    activeRelapseNow: input.activeRelapseNow ?? false,
    controlDistinctionDetected: input.controlDistinctionDetected ?? false,
    controlLoopDetected: input.controlLoopDetected ?? false,
    lettingGoQuestionDetected: input.lettingGoQuestionDetected ?? false,
    valuesQuestionDetected: input.valuesQuestionDetected ?? false,
    boundaryControlQuestionDetected: input.boundaryControlQuestionDetected ?? false,
    responsibilitySeparationDetected: input.responsibilitySeparationDetected ?? false,
    acceptanceNotApprovalDetected: input.acceptanceNotApprovalDetected ?? false,
    deeperStoicReflectionDetected: input.deeperStoicReflectionDetected ?? false,
    fastGroundingNeedDetected: input.fastGroundingNeedDetected ?? false,
    specificReflectiveModuleCandidate: input.specificReflectiveModuleCandidate ?? null,
  };

  const result = detectStoaK(runtimeInput);

  // Not active and not deferred to acute
  if (result.activationStatus === 'NOT_ACTIVE') {
    return {
      active: false,
      moduleId: 'NONE',
      detectionResult: null,
      payload: null,
      memoryPatch: null,
      contextString: '',
    };
  }

  // Deferred to another module — signal but don't provide own payload
  if (result.activationStatus !== 'ACTIVE') {
    return {
      active: false,
      moduleId: result.moduleId,
      detectionResult: result,
      payload: null,
      memoryPatch: null,
      contextString: `[STOA-K] deferred: ${result.activationStatus} → ${result.routeNext} (${result.reason})`,
    };
  }

  // Active — build payload and memory patch
  const payload = buildKimStoaKPayload(result);
  const memoryPatch = buildKimStoaKMemoryPatch(result);
  const contextString = `[STOA-K ACTIVE] Mode: ${result.responseMode} | Confidence: ${result.confidenceScore.toFixed(2)} | Themes: ${result.themes.join(', ')}

${payload.systemPromptBlock}`;

  return {
    active: true,
    moduleId: 'STOA-K',
    detectionResult: result,
    payload,
    memoryPatch,
    contextString,
  };
}
