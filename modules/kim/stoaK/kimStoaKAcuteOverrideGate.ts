/**
 * STOA-K Acute Override Gate
 * Blocks STOA-K when higher-priority modules should handle the situation.
 */

import type {
  KimStoaRuntimeInput,
  KimStoaActivationStatus,
  KimStoaResponseMode,
  FixedBelgianCrisisNumber,
} from './kimStoaK.types';

export interface KimStoaOverrideResult {
  blocked: boolean;
  activationStatus: KimStoaActivationStatus;
  routeNext: string;
  responseMode: KimStoaResponseMode;
  crisisNumbersToShow: FixedBelgianCrisisNumber[];
  reason: string;
}

export function applyKimStoaAcuteOverride(
  input: KimStoaRuntimeInput
): KimStoaOverrideResult {
  // 1. Persona check
  if (input.persona !== 'kim') {
    return {
      blocked: true,
      activationStatus: 'BLOCKED_BY_PERSONA',
      routeNext: 'NO_MODULE',
      responseMode: 'CRISIS_BRIDGE',
      crisisNumbersToShow: [],
      reason: 'STOA-K is Kim only.',
    };
  }

  // 2. Intake check
  if (!input.intakeCompleted) {
    return {
      blocked: true,
      activationStatus: 'BLOCKED_BY_INTAKE',
      routeNext: 'NO_MODULE',
      responseMode: 'CRISIS_BRIDGE',
      crisisNumbersToShow: [],
      reason: 'Intake incomplete.',
    };
  }

  // 3. Immediate danger / medical emergency
  if (input.medicalEmergencyDetected || input.immediateDanger) {
    return {
      blocked: true,
      activationStatus: 'DEFER_TO_GEVAAR_K01',
      routeNext: 'GEVAAR-K01',
      responseMode: 'DANGER_BRIDGE',
      crisisNumbersToShow: ['112'],
      reason: 'Immediate danger overrides STOA-K.',
    };
  }

  // 4. Child safety
  if (input.childPresentOrAffected) {
    return {
      blocked: true,
      activationStatus: 'DEFER_TO_KIND_K01',
      routeNext: 'KIND-K01',
      responseMode: 'CHILD_SAFETY_BRIDGE',
      crisisNumbersToShow: [],
      reason: 'Child safety context overrides STOA-K.',
    };
  }

  // 5. Aggression / domestic violence / disappearance
  if (input.aggressionDetected || input.domesticViolenceOrAbuseDetected || input.disappearanceAcuteDangerDetected) {
    const numbers: FixedBelgianCrisisNumber[] = [];
    if (input.aggressionDetected || input.domesticViolenceOrAbuseDetected) numbers.push('1712');
    if (input.disappearanceAcuteDangerDetected) numbers.push('101');
    return {
      blocked: true,
      activationStatus: 'DEFER_TO_GEVAAR_K01',
      routeNext: 'GEVAAR-K01',
      responseMode: 'DANGER_BRIDGE',
      crisisNumbersToShow: numbers,
      reason: 'Danger/domestic violence/disappearance overrides STOA-K.',
    };
  }

  // 6. Suicide / self-harm
  if (input.selfHarmOrSuicideDetected) {
    return {
      blocked: true,
      activationStatus: 'DEFER_TO_CRISIS_K01',
      routeNext: 'CRISIS-K01',
      responseMode: 'CRISIS_BRIDGE',
      crisisNumbersToShow: ['0800 32 123'],
      reason: 'Suicide/self-harm signal overrides STOA-K.',
    };
  }

  // 7. Active relapse now
  if (input.activeRelapseNow) {
    return {
      blocked: true,
      activationStatus: 'DEFER_TO_HERV_K01',
      routeNext: 'HERV-K01',
      responseMode: 'ACTIVE_RELAPSE_BRIDGE',
      crisisNumbersToShow: [],
      reason: 'Active relapse context overrides STOA-K.',
    };
  }

  // 8. Caregiver overwhelmed → K06 stabilization first
  if (input.caregiverOverwhelmed) {
    return {
      blocked: true,
      activationStatus: 'DEFER_TO_K06',
      routeNext: 'K06',
      responseMode: 'K06_STABILIZATION',
      crisisNumbersToShow: [],
      reason: 'Caregiver is too overwhelmed; K06 stabilization before STOA-K.',
    };
  }

  // 9. More specific reflective module fits better
  if (input.specificReflectiveModuleCandidate) {
    return {
      blocked: true,
      activationStatus: 'DEFER_TO_SPECIFIC_REFLECTIVE_MODULE',
      routeNext: input.specificReflectiveModuleCandidate,
      responseMode: 'SPECIFIC_REFLECTIVE_BRIDGE',
      crisisNumbersToShow: [],
      reason: 'A more specific reflective Kim module fits better than STOA-K.',
    };
  }

  // 10. Fast grounding need without deeper reflection → KST01
  if (input.fastGroundingNeedDetected && !input.deeperStoicReflectionDetected) {
    return {
      blocked: true,
      activationStatus: 'DEFER_TO_KST01',
      routeNext: 'KST01',
      responseMode: 'FAST_GROUNDING_DEFER_TO_KST01',
      crisisNumbersToShow: [],
      reason: 'Fast stoic grounding need belongs to KST01, not STOA-K.',
    };
  }

  // No override — STOA-K may activate
  return {
    blocked: false,
    activationStatus: 'ACTIVE',
    routeNext: 'STOA-K',
    responseMode: 'CONTROL_DISTINCTION_REFLECTION',
    crisisNumbersToShow: [],
    reason: 'No override; STOA-K may activate.',
  };
}
