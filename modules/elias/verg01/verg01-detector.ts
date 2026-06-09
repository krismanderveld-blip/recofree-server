/**
 * VERG01 — Self-Forgiveness After Relapse (Elias only)
 * DETECTOR: Deterministic marker-based activation detection
 */
import type { VERG01RuntimeInput, VERG01DetectionResult, VERG01ResponseMode } from './verg01-types';

const FORGIVENESS_MARKERS_NL = [
  'ik kan mezelf niet vergeven', 'ik vergeef mezelf dit nooit',
  'ik heb alles opnieuw verprutst', 'ik heb het weer kapotgemaakt',
  'ik moet blijven boeten', 'ik verdien geen rust', 'ik verdien geen herstel',
  'als ik mezelf vergeef praat ik het goed', 'ik heb hen pijn gedaan',
  'ik heb vertrouwen kapotgemaakt', 'ik schaam me kapot', 'ik walg van mezelf',
];

const FORGIVENESS_MARKERS_EN = [
  'i cannot forgive myself', 'i will never forgive myself',
  'i ruined everything again', 'i destroyed it again',
  'i should keep paying for it', 'i do not deserve peace', 'i do not deserve recovery',
  'if i forgive myself i am excusing it', 'i hurt them',
  'i destroyed trust', 'i am so ashamed', 'i disgust myself',
];

export function detectVERG01(input: VERG01RuntimeInput): VERG01DetectionResult {
  if (!input.intakeCompleted) {
    return {
      moduleId: 'VERG01',
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
      moduleId: 'VERG01',
      activationStatus: 'BLOCKED_BY_CRISIS',
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'SAFETY_EXIT',
      routeNext: 'CRISIS_PROTOCOL',
      reason: 'Crisis protocol overrides VERG01.',
    };
  }

  if (input.medicalRisk >= 0.7) {
    return {
      moduleId: 'VERG01',
      activationStatus: 'BLOCKED_BY_MEDICAL',
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'MEDICAL_SAFETY_EXIT',
      routeNext: 'MEDICAL_SAFETY_PROTOCOL',
      reason: 'Medical safety overrides VERG01.',
    };
  }

  if (input.acuteRelapseContainmentNeeded) {
    return {
      moduleId: 'VERG01',
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
  if (input.primarySignal === 'SELF_FORGIVENESS_AFTER_RELAPSE') score += 0.25;
  if (input.readinessForAction >= 0.65) score += 0.05;

  const confidenceScore = Math.min(score, 0.95);

  if (confidenceScore < 0.5) {
    return {
      moduleId: 'VERG01',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'SELF_FORGIVENESS_OPTION_NOT_REQUIREMENT',
      routeNext: 'NO_MODULE',
      reason: 'VERG01 signal below activation threshold.',
    };
  }

  let responseMode: VERG01ResponseMode = 'SELF_FORGIVENESS_OPTION_NOT_REQUIREMENT';
  let routeNext: VERG01DetectionResult['routeNext'] = 'VERG01';

  if (input.primarySignal === 'SELF_FORGIVENESS_AFTER_RELAPSE') {
    responseMode = 'RESPONSIBILITY_WITHOUT_IDENTITY_COLLAPSE';
  } else if (input.regulationLevel < 0.45) {
    responseMode = 'SHAME_CONTAINMENT_AFTER_RELAPSE';
    routeNext = 'EKT01_VERHELDERING';
  } else if (input.readinessForAction >= 0.65) {
    responseMode = 'REPAIR_READINESS_CHECK';
  }

  return {
    moduleId: 'VERG01',
    activationStatus: 'ACTIVE',
    confidenceScore,
    matchedMarkers: input.detectedMarkers,
    responseMode,
    routeNext,
    reason: 'Self-forgiveness after relapse and responsibility-versus-shame signal detected.',
  };
}

export { FORGIVENESS_MARKERS_NL, FORGIVENESS_MARKERS_EN };
