/**
 * Kim Cluster 5 — STOA-K (Stoic Reflective Framework for Kim)
 * Deeper reflective stoic framework for caregivers.
 * Differentiates from KST01 (fast grounding) by providing structured
 * exploration of control, values, boundaries, responsibility, acceptance.
 */

export type KimStoaModuleId = 'STOA-K';

export type KimStoaActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'BLOCKED_BY_PERSONA'
  | 'BLOCKED_BY_INTAKE'
  | 'DEFER_TO_CRISIS_K01'
  | 'DEFER_TO_GEVAAR_K01'
  | 'DEFER_TO_KIND_K01'
  | 'DEFER_TO_HERV_K01'
  | 'DEFER_TO_SPECIFIC_REFLECTIVE_MODULE'
  | 'DEFER_TO_K06'
  | 'DEFER_TO_KST01'
  | 'ESCALATE_TO_CRISIS_NUMBERS';

export type KimStoaResponseMode =
  | 'CONTROL_DISTINCTION_REFLECTION'
  | 'VALUES_BASED_ACTION'
  | 'BOUNDARY_WITH_ACCEPTANCE'
  | 'NON_CONTROL_WITH_CARE'
  | 'CONTROL_LOOP_DEFUSION'
  | 'ACCEPTANCE_NOT_APPROVAL'
  | 'FAST_GROUNDING_DEFER_TO_KST01'
  | 'K06_STABILIZATION'
  | 'CRISIS_BRIDGE'
  | 'DANGER_BRIDGE'
  | 'CHILD_SAFETY_BRIDGE'
  | 'ACTIVE_RELAPSE_BRIDGE'
  | 'SPECIFIC_REFLECTIVE_BRIDGE';

export type KimStoaTheme =
  | 'cannot_control_loved_one'
  | 'control_loop'
  | 'letting_go_without_abandoning'
  | 'values_as_compass'
  | 'boundaries_as_controllable_action'
  | 'acceptance_without_approval'
  | 'responsibility_separation'
  | 'care_without_rescue';

export type FixedBelgianCrisisNumber =
  | '0800 32 123'
  | '1712'
  | '112'
  | '101';

export const ALLOWED_CRISIS_NUMBERS: FixedBelgianCrisisNumber[] = [
  '0800 32 123',
  '1712',
  '112',
  '101',
];

export interface KimStoaRuntimeInput {
  persona: 'kim' | 'elias' | 'unknown';
  intakeCompleted: boolean;
  latestUserMessage: string;
  recentMessages: string[];
  language: 'nl' | 'en' | 'fr' | 'mixed' | 'unknown';
  detectedMarkers: string[];
  // Context flags
  lovedOneUseContext: boolean;
  firstPersonUseContext: boolean;
  caregiverOverwhelmed: boolean;
  immediateDanger: boolean;
  childPresentOrAffected: boolean;
  aggressionDetected: boolean;
  domesticViolenceOrAbuseDetected: boolean;
  disappearanceAcuteDangerDetected: boolean;
  selfHarmOrSuicideDetected: boolean;
  medicalEmergencyDetected: boolean;
  activeRelapseNow: boolean;
  // STOA-K specific detection flags
  controlDistinctionDetected: boolean;
  controlLoopDetected: boolean;
  lettingGoQuestionDetected: boolean;
  valuesQuestionDetected: boolean;
  boundaryControlQuestionDetected: boolean;
  responsibilitySeparationDetected: boolean;
  acceptanceNotApprovalDetected: boolean;
  deeperStoicReflectionDetected: boolean;
  fastGroundingNeedDetected: boolean;
  // Specific reflective module candidate (if a more specific module fits)
  specificReflectiveModuleCandidate: string | null;
}

export interface KimStoaDetectionResult {
  moduleId: KimStoaModuleId;
  activationStatus: KimStoaActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  themes: KimStoaTheme[];
  responseMode: KimStoaResponseMode;
  crisisNumbersToShow: FixedBelgianCrisisNumber[];
  routeNext: string;
  reason: string;
}

export interface KimStoaMemoryPatch {
  kimUserDat: {
    triggerPatterns: {
      pattern: string;
      firstDetectedAt?: string;
      lastUpdatedAt: string;
      frequency: number;
      sourceModuleId: KimStoaModuleId;
    }[];
  };
  kimProjectionsDat: {
    fears?: string[];
    concerns?: string[];
    valueNeed?: string[];
    boundaryNeed?: string[];
    decayScores?: Record<string, number>;
  };
  kimLogsDat: {
    event: {
      moduleId: KimStoaModuleId;
      themes: KimStoaTheme[];
      responseMode: KimStoaResponseMode;
      crisisNumbersShown: FixedBelgianCrisisNumber[];
      timestamp: string;
    };
  };
}

export interface KimStoaPromptPayload {
  moduleId: KimStoaModuleId;
  systemPromptBlock: string;
  compactPrompt: string;
  responseMode: KimStoaResponseMode;
  themes: KimStoaTheme[];
  crisisNumbersToShow: FixedBelgianCrisisNumber[];
  storePolicy: false;
}
