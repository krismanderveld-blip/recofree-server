/**
 * Kim Cluster 3 — Acute Override Gate
 * Ensures reflective modules (ROL-K01, VETR02-K, LEUGEN-K01) never interrupt acute safety routing.
 */

import type {
  KimCluster3ModuleId,
  KimCluster3ActivationStatus,
  KimCluster3ResponseMode,
  KimCluster3DetectionResult,
  KimCluster3RuntimeInput,
  FixedBelgianCrisisNumber,
} from './kimCluster3.types';

export interface AcuteOverrideResult {
  blocked: boolean;
  activationStatus: KimCluster3ActivationStatus;
  routeNext: KimCluster3DetectionResult['routeNext'];
  responseMode: KimCluster3ResponseMode;
  crisisNumbersToShow: FixedBelgianCrisisNumber[];
  reason: string;
}

export function applyKimCluster3AcuteOverride(
  input: KimCluster3RuntimeInput,
  proposedModuleId: KimCluster3ModuleId
): AcuteOverrideResult {
  if (input.persona !== 'kim') {
    return {
      blocked: true,
      activationStatus: 'BLOCKED_BY_PERSONA',
      routeNext: 'NO_MODULE',
      responseMode: 'CRISIS_BRIDGE',
      crisisNumbersToShow: [],
      reason: 'Kim cluster 3 modules are Kim only.',
    };
  }

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

  if (input.medicalEmergencyDetected || input.immediateDanger) {
    return {
      blocked: true,
      activationStatus: 'DEFER_TO_GEVAAR_K01',
      routeNext: 'GEVAAR-K01',
      responseMode: 'DANGER_BRIDGE',
      crisisNumbersToShow: ['112'],
      reason: 'Immediate danger overrides reflective relationship module.',
    };
  }

  if (input.childPresentOrAffected) {
    return {
      blocked: true,
      activationStatus: 'DEFER_TO_KIND_K01',
      routeNext: 'KIND-K01',
      responseMode: 'CHILD_SAFETY_BRIDGE',
      crisisNumbersToShow: [],
      reason: 'Child-safety context overrides reflective relationship module.',
    };
  }

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
      reason: 'Danger/domestic violence/disappearance context overrides reflective relationship module.',
    };
  }

  if (input.selfHarmOrSuicideDetected) {
    return {
      blocked: true,
      activationStatus: 'DEFER_TO_CRISIS_K01',
      routeNext: 'CRISIS-K01',
      responseMode: 'CRISIS_BRIDGE',
      crisisNumbersToShow: ['1813'],
      reason: 'Suicide/self-harm signal overrides reflective relationship module.',
    };
  }

  if (input.activeRelapseNow) {
    return {
      blocked: true,
      activationStatus: 'DEFER_TO_HERV_K01',
      routeNext: 'HERV-K01',
      responseMode: 'ACTIVE_RELAPSE_BRIDGE',
      crisisNumbersToShow: [],
      reason: 'Active relapse context overrides reflective relationship module.',
    };
  }

  if (input.caregiverOverwhelmed) {
    return {
      blocked: true,
      activationStatus: 'DEFER_TO_K06',
      routeNext: 'K06',
      responseMode: 'K06_STABILIZATION',
      crisisNumbersToShow: [],
      reason: 'Caregiver is too overwhelmed; K06 stabilization before reflective work.',
    };
  }

  return {
    blocked: false,
    activationStatus: 'ACTIVE',
    routeNext: proposedModuleId,
    responseMode: 'PERMISSION_TO_FEEL_WITHOUT_GUILT',
    crisisNumbersToShow: [],
    reason: 'No acute override.',
  };
}
