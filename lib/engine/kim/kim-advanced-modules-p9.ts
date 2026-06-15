/**
 * Kim Advanced Modules — P9 (Emotional Loss Cluster)
 * HOOP-K01, SCHAAM-K01, ROUW-K01, ISOL-K01
 *
 * Priority: Below P7 (danger/child) and P6 (relapse), above P8 (relational dynamics).
 * Actually P9 runs AFTER P8 in the pipeline — both are reflective, P8 has priority over P9.
 */

import {
  resolveCluster4Priority,
  buildKimCluster4Payload,
  buildKimCluster4MemoryPatch,
  applyKimCluster4SafetyFilter,
} from '@/modules/kim/emotionalLossCluster';
import type {
  KimCluster4RuntimeInput,
  KimCluster4DetectionResult,
  KimCluster4PromptPayload,
} from '@/modules/kim/emotionalLossCluster';

export interface KimP9Input {
  message: string;
  persona: 'elias' | 'kim';
  // Semantic flags (from signal engine or context)
  selfHarmOrSuicideDetectedInKim?: boolean;
  immediateDanger?: boolean;
  dangerOrViolenceDetected?: boolean;
  domesticViolenceOrAbuseDetected?: boolean;
  aggressionDetected?: boolean;
  childPresentOrAffected?: boolean;
  activeRelapseNow?: boolean;
  immediateAftermathActive?: boolean;
  // Cluster 4 specific flags
  enoughIsEnoughDetected?: boolean;
  hopeExhaustionDetected?: boolean;
  shameSecrecyDetected?: boolean;
  socialWithdrawalDetected?: boolean;
  ambiguousLossDetected?: boolean;
  lostFutureGriefDetected?: boolean;
  socialIsolationDetected?: boolean;
  lossOfOwnContactsDetected?: boolean;
  detectedMarkers?: string[];
}

export interface KimP9Result {
  active: boolean;
  moduleId: string;
  detectionResult: KimCluster4DetectionResult | null;
  payload: KimCluster4PromptPayload | null;
  contextString: string;
}

export function runKimAdvancedP9(input: KimP9Input): KimP9Result {
  const runtimeInput: KimCluster4RuntimeInput = {
    message: input.message,
    persona: input.persona,
    selfHarmOrSuicideDetectedInKim: input.selfHarmOrSuicideDetectedInKim ?? false,
    immediateDanger: input.immediateDanger ?? false,
    dangerOrViolenceDetected: input.dangerOrViolenceDetected ?? false,
    domesticViolenceOrAbuseDetected: input.domesticViolenceOrAbuseDetected ?? false,
    aggressionDetected: input.aggressionDetected ?? false,
    childPresentOrAffected: input.childPresentOrAffected ?? false,
    activeRelapseNow: input.activeRelapseNow ?? false,
    immediateAftermathActive: input.immediateAftermathActive ?? false,
    enoughIsEnoughDetected: input.enoughIsEnoughDetected ?? false,
    hopeExhaustionDetected: input.hopeExhaustionDetected ?? false,
    shameSecrecyDetected: input.shameSecrecyDetected ?? false,
    socialWithdrawalDetected: input.socialWithdrawalDetected ?? false,
    ambiguousLossDetected: input.ambiguousLossDetected ?? false,
    lostFutureGriefDetected: input.lostFutureGriefDetected ?? false,
    socialIsolationDetected: input.socialIsolationDetected ?? false,
    lossOfOwnContactsDetected: input.lossOfOwnContactsDetected ?? false,
    detectedMarkers: input.detectedMarkers ?? [],
  };

  const result = resolveCluster4Priority(runtimeInput);

  // Not active and not deferred to acute
  if (result.activationStatus === 'NOT_ACTIVE') {
    return {
      active: false,
      moduleId: 'NONE',
      detectionResult: null,
      payload: null,
      contextString: '',
    };
  }

  // Deferred to acute cluster — signal but don't provide own payload
  if (result.activationStatus !== 'ACTIVE') {
    return {
      active: false,
      moduleId: result.moduleId,
      detectionResult: result,
      payload: null,
      contextString: `[Kim Cluster 4] ${result.moduleId} deferred: ${result.reason}`,
    };
  }

  // Active — build payload
  const payload = buildKimCluster4Payload(result);
  const contextString = `[Kim Cluster 4 ACTIVE] Module: ${result.moduleId} | Mode: ${result.responseMode} | Confidence: ${result.confidenceScore.toFixed(2)} | Themes: ${result.themes.join(', ')}

${payload.fullPrompt}`;

  return {
    active: true,
    moduleId: result.moduleId,
    detectionResult: result,
    payload,
    contextString,
  };
}
