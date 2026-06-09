/**
 * ZINK01 — Meaning/Purpose Module (Elias only)
 * DETECTOR: Deterministic marker-based activation detection
 */
import type { ZINK01RuntimeInput, ZINK01DetectionResult, ZINK01ResponseMode } from './zink01-types';

const MEANING_MARKERS_NL = [
  'waarvoor doe ik dit eigenlijk', 'wat is het punt van nuchter zijn',
  'ik zie geen reden meer om te leven', 'alles voelt zinloos',
  'waarvoor zou ik stoppen', 'ik heb niets om voor te leven',
  'wat is de zin van herstel', 'ik voel me leeg vanbinnen',
  'er is niets meer dat me boeit', 'ik weet niet waarvoor ik wakker word',
  'als ik niet gebruik weet ik niet wat te doen', 'het leven is zinloos zonder',
];

const MEANING_MARKERS_EN = [
  'what is the point of all this', 'what is the point of being sober',
  'i see no reason to live', 'everything feels meaningless',
  'why would i stop', 'i have nothing to live for',
  'what is the purpose of recovery', 'i feel empty inside',
  'nothing interests me anymore', 'i do not know what i wake up for',
  'if i do not use i do not know what to do', 'life is meaningless without it',
];

export function detectZINK01(input: ZINK01RuntimeInput): ZINK01DetectionResult {
  if (!input.intakeCompleted) {
    return {
      moduleId: 'ZINK01',
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
      moduleId: 'ZINK01',
      activationStatus: 'BLOCKED_BY_CRISIS',
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'SAFETY_EXIT',
      routeNext: 'CRISIS_PROTOCOL',
      reason: 'Crisis protocol overrides ZINK01.',
    };
  }

  if (input.medicalRisk >= 0.7) {
    return {
      moduleId: 'ZINK01',
      activationStatus: 'BLOCKED_BY_MEDICAL',
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'MEDICAL_SAFETY_EXIT',
      routeNext: 'MEDICAL_SAFETY_PROTOCOL',
      reason: 'Medical safety overrides ZINK01.',
    };
  }

  if (input.acuteRelapseContainmentNeeded) {
    return {
      moduleId: 'ZINK01',
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
  if (input.primarySignal === 'MEANING_VACUUM_OR_EXISTENTIAL') score += 0.25;
  if (input.readinessForAction >= 0.65) score += 0.05;

  const confidenceScore = Math.min(score, 0.95);

  if (confidenceScore < 0.5) {
    return {
      moduleId: 'ZINK01',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'MEANING_QUESTION_WITHOUT_ANSWER',
      routeNext: 'NO_MODULE',
      reason: 'ZINK01 signal below activation threshold.',
    };
  }

  let responseMode: ZINK01ResponseMode = 'MEANING_QUESTION_WITHOUT_ANSWER';
  let routeNext: ZINK01DetectionResult['routeNext'] = 'ZINK01';

  if (input.primarySignal === 'MEANING_VACUUM_OR_EXISTENTIAL') {
    responseMode = 'MEANING_QUESTION_WITHOUT_ANSWER';
  } else if (input.regulationLevel < 0.45) {
    responseMode = 'MEANING_CONTAINMENT';
    routeNext = 'EKT01_VERHELDERING';
  } else if (input.readinessForAction >= 0.65) {
    responseMode = 'ONE_MEANING_CARRYING_ACTION';
  }

  return {
    moduleId: 'ZINK01',
    activationStatus: 'ACTIVE',
    confidenceScore,
    matchedMarkers: input.detectedMarkers,
    responseMode,
    routeNext,
    reason: 'Meaning vacuum or existential questioning detected.',
  };
}

export { MEANING_MARKERS_NL, MEANING_MARKERS_EN };
