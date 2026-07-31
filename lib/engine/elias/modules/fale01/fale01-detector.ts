/**
 * FALE01 — Two-Stage Failure Response After Relapse (Elias only)
 * DETECTOR: Deterministic marker-based activation detection
 */
import type { FALE01RuntimeInput, FALE01DetectionResult, FALE01ResponseMode } from './fale01-types';

// ── Marker banks ──
const RELAPSE_MARKERS_NL = [
  'ik ben hervallen', 'ik heb gefaald', 'ik heb het weer gedaan',
  'ik heb opnieuw gebruikt', 'ik heb opnieuw gedronken', 'alles is verpest',
  'ik begin weer van nul', 'ik kan het niet volhouden', 'ik deed het zonder na te denken',
  'ik ben terug bij af', 'ik heb mijn herstel kapotgemaakt', 'nu maakt het toch niet meer uit',
];

const RELAPSE_MARKERS_EN = [
  'i relapsed', 'i failed', 'i did it again', 'i used again', 'i drank again',
  'everything is ruined', 'i am starting from zero again', 'i cannot keep this up',
  'i did it without thinking', 'i am back to square one', 'i destroyed my recovery',
  'now it does not matter anymore',
];

export function detectFALE01(input: FALE01RuntimeInput): FALE01DetectionResult {
  if (!input.intakeCompleted) {
    return {
      moduleId: 'FALE01',
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
      moduleId: 'FALE01',
      activationStatus: 'BLOCKED_BY_CRISIS',
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'SAFETY_EXIT',
      routeNext: 'CRISIS_PROTOCOL',
      reason: 'Crisis protocol overrides FALE01.',
    };
  }

  if (input.medicalRisk >= 0.7) {
    return {
      moduleId: 'FALE01',
      activationStatus: 'BLOCKED_BY_MEDICAL',
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'MEDICAL_SAFETY_EXIT',
      routeNext: 'MEDICAL_SAFETY_PROTOCOL',
      reason: 'Medical safety overrides FALE01.',
    };
  }

  if (input.acuteRelapseContainmentNeeded) {
    return {
      moduleId: 'FALE01',
      activationStatus: 'DEFERRED_TO_FALE01_OR_E01',
      confidenceScore: 0.75,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'DEFER_TO_FALE01_OR_E01',
      routeNext: 'FALE01',
      reason: 'Immediate relapse/craving containment has higher priority.',
    };
  }

  // Score calculation
  let score = 0;
  score += Math.min(input.detectedMarkers.length * 0.12, 0.36);
  score += Math.min(input.confidenceSeeds.length * 0.10, 0.30);
  if (input.primarySignal === 'RELAPSE_OR_FAILURE_EVENT') score += 0.25;
  if (input.readinessForAction >= 0.65) score += 0.05;

  const confidenceScore = Math.min(score, 0.95);

  if (confidenceScore < 0.5) {
    return {
      moduleId: 'FALE01',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'STAGE_1_IMMEDIATE_CONTAINMENT',
      routeNext: 'NO_MODULE',
      reason: 'FALE01 signal below activation threshold.',
    };
  }

  let responseMode: FALE01ResponseMode = 'STAGE_1_IMMEDIATE_CONTAINMENT';
  let routeNext: FALE01DetectionResult['routeNext'] = 'FALE01';

  if (input.primarySignal === 'RELAPSE_OR_FAILURE_EVENT') {
    responseMode = 'STAGE_1_IMMEDIATE_CONTAINMENT';
  } else if (input.regulationLevel < 0.45) {
    responseMode = 'STAGE_1_SHAME_INTERRUPTION';
    routeNext = 'EKT01_VERHELDERING';
  } else if (input.readinessForAction >= 0.65) {
    responseMode = 'STAGE_2_PREVENTION_CONTRACT';
  }

  return {
    moduleId: 'FALE01',
    activationStatus: 'ACTIVE',
    confidenceScore,
    matchedMarkers: input.detectedMarkers,
    responseMode,
    routeNext,
    reason: 'Two-stage relapse/failure response selected.',
  };
}

export { RELAPSE_MARKERS_NL, RELAPSE_MARKERS_EN };
