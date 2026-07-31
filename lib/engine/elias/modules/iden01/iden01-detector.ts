/**
 * IDEN01 — Identity Rebuilding Outside Addiction (Elias only)
 * DETECTOR: Deterministic marker-based activation detection
 */
import type { IDEN01RuntimeInput, IDEN01DetectionResult, IDEN01ResponseMode } from './iden01-types';

const IDENTITY_MARKERS_NL = [
  'wie ben ik zonder mijn verslaving', 'ik ben alleen nog een verslaafde',
  'ik weet niet meer wie ik ben', 'na die terugval ben ik weer niets',
  'ik ben alleen nog patient', 'ik heb geen identiteit meer',
  'ik ben mijn verslaving', 'zonder alcohol weet ik niet wie ik ben',
  'ik ben niets zonder dat', 'mijn hele leven draaide om gebruiken',
  'ik weet niet wat ik leuk vind', 'ik ken mezelf niet meer',
];

const IDENTITY_MARKERS_EN = [
  'who am i without my addiction', 'i am just an addict',
  'i do not know who i am anymore', 'after that relapse i am nothing again',
  'i am just a patient', 'i have no identity anymore',
  'i am my addiction', 'without alcohol i do not know who i am',
  'i am nothing without it', 'my whole life revolved around using',
  'i do not know what i like', 'i do not know myself anymore',
];

export function detectIDEN01(input: IDEN01RuntimeInput): IDEN01DetectionResult {
  if (!input.intakeCompleted) {
    return {
      moduleId: 'IDEN01',
      activationStatus: 'BLOCKED_BY_INTAKE',
      confidenceScore: 0,
      matchedMarkers: [],
      responseMode: 'SAFETY_EXIT',
      routeNext: 'NO_MODULE',
      reason: 'Intake is required before module activation.',
    };
  }

  if (input.crisisProtocolStatus === 'ACTIVE' || input.safetyRisk >= 0.7) {
    return {
      moduleId: 'IDEN01',
      activationStatus: 'BLOCKED_BY_CRISIS',
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'SAFETY_EXIT',
      routeNext: 'CRISIS_PROTOCOL',
      reason: 'Crisis protocol overrides IDEN01.',
    };
  }

  if (input.medicalRisk >= 0.7) {
    return {
      moduleId: 'IDEN01',
      activationStatus: 'BLOCKED_BY_MEDICAL',
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'MEDICAL_SAFETY_EXIT',
      routeNext: 'MEDICAL_SAFETY_PROTOCOL',
      reason: 'Medical safety overrides IDEN01.',
    };
  }

  if (input.acuteRelapseContainmentNeeded) {
    return {
      moduleId: 'IDEN01',
      activationStatus: 'DEFERRED_TO_FALE01_OR_E01',
      confidenceScore: 0.75,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'DEFER_TO_FALE01_OR_E01',
      routeNext: 'FALE01',
      reason: 'Immediate relapse/craving containment has higher priority.',
    };
  }

  let score = 0;
  score += Math.min(input.detectedMarkers.length * 0.12, 0.36);
  score += Math.min(input.confidenceSeeds.length * 0.10, 0.30);
  if (input.primarySignal === 'IDENTITY_OUTSIDE_ADDICTION') score += 0.25;
  if (input.readinessForAction >= 0.65) score += 0.05;

  const confidenceScore = Math.min(score, 0.95);

  if (confidenceScore < 0.5) {
    return {
      moduleId: 'IDEN01',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'IDENTITY_SEPARATION_FROM_ADDICTION',
      routeNext: 'NO_MODULE',
      reason: 'IDEN01 signal below activation threshold.',
    };
  }

  let responseMode: IDEN01ResponseMode = 'IDENTITY_SEPARATION_FROM_ADDICTION';
  let routeNext: IDEN01DetectionResult['routeNext'] = 'IDEN01';

  if (input.primarySignal === 'IDENTITY_OUTSIDE_ADDICTION') {
    responseMode = 'IDENTITY_SEPARATION_FROM_ADDICTION';
  } else if (input.regulationLevel < 0.45) {
    responseMode = 'IDENTITY_STABILIZATION';
    routeNext = 'EKT01_VERHELDERING';
  } else if (input.readinessForAction >= 0.65) {
    responseMode = 'VALUES_FRAGMENT_RECONSTRUCTION';
  }

  return {
    moduleId: 'IDEN01',
    activationStatus: 'ACTIVE',
    confidenceScore,
    matchedMarkers: input.detectedMarkers,
    responseMode,
    routeNext,
    reason: 'Identity rebuilding outside addiction detected.',
  };
}

export { IDENTITY_MARKERS_NL, IDENTITY_MARKERS_EN };
