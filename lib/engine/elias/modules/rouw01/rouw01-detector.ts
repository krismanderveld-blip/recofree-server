/**
 * ROUW01 — Grief/Loss Through Addiction (Elias only)
 * DETECTOR: Deterministic marker-based activation detection
 */
import type { ROUW01RuntimeInput, ROUW01DetectionResult, ROUW01ResponseMode } from './rouw01-types';

const GRIEF_MARKERS_NL = [
  'ik rouw om wat ik kwijt ben', 'ik heb zoveel jaren verloren',
  'ik heb mijn relatie verloren door mijn verslaving', 'ik ben mezelf kwijtgeraakt',
  'ik heb momenten met mijn kind gemist', 'alcohol heeft zoveel afgepakt',
  'ik mis wie ik had kunnen zijn', 'nu ik nuchter ben komt alles binnen',
  'ik ben te laat', 'mijn oude leven is weg',
  'ik heb mijn waardigheid verloren', 'ik weet niet hoe ik met dit verlies moet leven',
];

const GRIEF_MARKERS_EN = [
  'i grieve what i lost', 'i lost so many years',
  'i lost my relationship because of addiction', 'i lost myself',
  'i missed moments with my child', 'alcohol took so much from me',
  'i miss who i could have been', 'now that i am sober everything hits me',
  'it is too late', 'my old life is gone',
  'i lost my dignity', 'i do not know how to live with this loss',
];

export function detectROUW01(input: ROUW01RuntimeInput): ROUW01DetectionResult {
  if (!input.intakeCompleted) {
    return {
      moduleId: 'ROUW01',
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
      moduleId: 'ROUW01',
      activationStatus: 'BLOCKED_BY_CRISIS',
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'SAFETY_EXIT',
      routeNext: 'CRISIS_PROTOCOL',
      reason: 'Crisis protocol overrides ROUW01.',
    };
  }

  if (input.medicalRisk >= 0.7) {
    return {
      moduleId: 'ROUW01',
      activationStatus: 'BLOCKED_BY_MEDICAL',
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'MEDICAL_SAFETY_EXIT',
      routeNext: 'MEDICAL_SAFETY_PROTOCOL',
      reason: 'Medical safety overrides ROUW01.',
    };
  }

  if (input.acuteRelapseContainmentNeeded) {
    return {
      moduleId: 'ROUW01',
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
  if (input.primarySignal === 'ADDICTION_RELATED_GRIEF') score += 0.25;
  if (input.readinessForAction >= 0.65) score += 0.05;

  const confidenceScore = Math.min(score, 0.95);

  if (confidenceScore < 0.5) {
    return {
      moduleId: 'ROUW01',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'NAME_LOSS_WITHOUT_FIXING',
      routeNext: 'NO_MODULE',
      reason: 'ROUW01 signal below activation threshold.',
    };
  }

  let responseMode: ROUW01ResponseMode = 'NAME_LOSS_WITHOUT_FIXING';
  let routeNext: ROUW01DetectionResult['routeNext'] = 'ROUW01';

  if (input.primarySignal === 'ADDICTION_RELATED_GRIEF') {
    responseMode = 'NAME_LOSS_WITHOUT_FIXING';
  } else if (input.regulationLevel < 0.45) {
    responseMode = 'GRIEF_CONTAINMENT';
    routeNext = 'EKT01_VERHELDERING';
  } else if (input.readinessForAction >= 0.65) {
    responseMode = 'ONE_GRIEF_CARRYING_ACTION';
  }

  return {
    moduleId: 'ROUW01',
    activationStatus: 'ACTIVE',
    confidenceScore,
    matchedMarkers: input.detectedMarkers,
    responseMode,
    routeNext,
    reason: 'Addiction-related grief and loss signal detected.',
  };
}

export { GRIEF_MARKERS_NL, GRIEF_MARKERS_EN };
