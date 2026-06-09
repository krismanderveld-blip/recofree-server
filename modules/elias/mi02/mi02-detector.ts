/**
 * MI02 — Motivational Interviewing Verdieping (Elias only)
 * DETECTOR: Deep ambivalence detection using OARS framework
 * Builds on MI01 but does not replace it.
 */
import type { MI02RuntimeInput, MI02DetectionResult, MI02ResponseMode, MI02OarsTechnique, MI02RouteNext } from './mi02-types';

// ── Marker banks ──
const AMBIVALENCE_MARKERS_NL = [
  'ik wil herstellen maar ook niet', 'een deel van mij wil stoppen een deel niet',
  'ik wil nuchter zijn maar ik wil ook drinken', 'ik wil niet meer gebruiken maar ik mis het',
  'ik weet dat ik moet stoppen maar ik wil niet', 'ik wil veranderen maar ik ben er niet klaar voor',
  'ik wil hulp maar ook met rust gelaten worden', 'ik wil herstel maar niet alles opgeven',
  'ik wil leven zonder gebruik maar ik ben bang voor wat overblijft',
  'ik haat alcohol maar ik wil het ook', 'ik wil stoppen maar het helpt me ook',
  'ik wil beter worden maar ik wil de roes niet kwijt',
  'ik weet het niet', 'ik twijfel', 'misschien wil ik het gewoon niet genoeg',
  'ik ben dubbel', 'ik blijf teruggaan', 'ik wil geen advies',
  'ik weet wat juist is maar ik doe het niet', 'ik wil wel maar niet nu',
];

const AMBIVALENCE_MARKERS_EN = [
  'i want recovery but i also do not', 'part of me wants to stop part of me does not',
  'i want to be sober but i also want to drink', 'i do not want to use anymore but i miss it',
  'i know i should stop but i do not want to', 'i want to change but i am not ready',
  'i want help but i also want to be left alone', 'i want recovery but i do not want to give everything up',
  'i want life without using but i am afraid of what remains',
  'i hate alcohol but i also want it', 'i want to stop but it also helps me',
  'i want to get better but i do not want to lose the high',
  'i do not know', 'i am unsure', 'maybe i do not want it enough',
  'i am split', 'i keep going back', 'i do not want advice',
  'i know what is right but i do not do it', 'i want to but not now',
];

function matchMarkers(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const m of AMBIVALENCE_MARKERS_NL) {
    if (lower.includes(m)) matched.push(m);
  }
  for (const m of AMBIVALENCE_MARKERS_EN) {
    if (lower.includes(m)) matched.push(m);
  }
  return matched;
}

export function detectMI02(input: MI02RuntimeInput): MI02DetectionResult {
  // Gate: intake
  if (!input.intakeCompleted) {
    return {
      moduleId: 'MI02', activationStatus: 'BLOCKED_BY_INTAKE', confidenceScore: 0,
      matchedMarkers: [], responseMode: 'OPEN_AMBIVALENCE_EXPLORATION',
      oarsTechnique: 'OPEN_QUESTION', routeNext: 'NO_MODULE', reason: 'Intake incomplete.',
    };
  }

  // Gate: crisis
  if (input.crisisProtocolStatus === 'ACTIVE' || input.safetyRisk >= 0.7) {
    return {
      moduleId: 'MI02', activationStatus: 'BLOCKED_BY_CRISIS', confidenceScore: 1,
      matchedMarkers: input.detectedMarkers, responseMode: 'SAFETY_EXIT',
      oarsTechnique: 'SUMMARY', routeNext: 'CRISIS_PROTOCOL',
      reason: 'Crisis protocol overrides MI02.',
    };
  }

  // Gate: medical
  if (input.medicalRisk >= 0.7) {
    return {
      moduleId: 'MI02', activationStatus: 'BLOCKED_BY_MEDICAL', confidenceScore: 1,
      matchedMarkers: input.detectedMarkers, responseMode: 'MEDICAL_SAFETY_EXIT',
      oarsTechnique: 'SUMMARY', routeNext: 'MEDICAL_SAFETY_PROTOCOL',
      reason: 'Medical safety overrides MI02.',
    };
  }

  // Gate: PAARS zone active — defer to relapse containment
  if (input.paarsZoneActive) {
    return {
      moduleId: 'MI02', activationStatus: 'DEFERRED_TO_RELAPSE_CONTAINMENT', confidenceScore: 0.90,
      matchedMarkers: input.detectedMarkers, responseMode: 'DEFER_TO_FALE01_OR_E01',
      oarsTechnique: 'REFLECTION', routeNext: 'FALE01',
      reason: 'PAARS zone requires relapse containment before MI02.',
    };
  }

  // Confidence scoring
  let score = 0;
  if (input.directAmbivalenceMarker) score += 0.40;
  if (input.changeTalkPresent && input.sustainTalkPresent) score += 0.25;
  if (input.adviceResistance) score += 0.10;
  if (input.externalMotivationDominant) score += 0.10;
  if (input.sessionMixedSignalsCount >= 3) score += 0.10;

  const markers = matchMarkers(input.latestUserMessage);
  if (markers.length > 0) score += 0.10;
  if (input.mi01PreviouslyActive) score += 0.05;

  const allMarkers = [...input.detectedMarkers, ...markers];
  const confidenceScore = Math.min(score, 0.98);

  // Below threshold
  if (confidenceScore < 0.50) {
    return {
      moduleId: 'MI02', activationStatus: 'NOT_ACTIVE', confidenceScore,
      matchedMarkers: allMarkers, responseMode: 'OPEN_AMBIVALENCE_EXPLORATION',
      oarsTechnique: 'OPEN_QUESTION', routeNext: 'NO_MODULE',
      reason: 'Ambivalence signal below MI02 threshold.',
    };
  }

  // Response mode routing
  let responseMode: MI02ResponseMode = 'OPEN_AMBIVALENCE_EXPLORATION';
  let oarsTechnique: MI02OarsTechnique = 'OPEN_QUESTION';
  let routeNext: MI02RouteNext = 'MI02';

  if (input.directAmbivalenceMarker && input.changeTalkPresent && input.sustainTalkPresent) {
    responseMode = 'DOUBLE_SIDED_REFLECTION';
    oarsTechnique = 'REFLECTION';
  } else if (input.adviceResistance) {
    responseMode = 'AFFIRM_AUTONOMY';
    oarsTechnique = 'AFFIRMATION';
  } else if (input.sustainTalkPresent && !input.changeTalkPresent) {
    responseMode = 'SUSTAIN_TALK_REFLECTION';
    oarsTechnique = 'REFLECTION';
  } else if (input.changeTalkPresent) {
    responseMode = 'CHANGE_TALK_EVOCATION';
    oarsTechnique = 'OPEN_QUESTION';
    routeNext = 'ACT';
  } else if (input.sessionMixedSignalsCount >= 3) {
    responseMode = 'AMBIVALENCE_SUMMARY';
    oarsTechnique = 'SUMMARY';
  } else if (!input.readinessScoreAvailable && input.userRegulationLevel >= 0.60) {
    responseMode = 'READINESS_RULER';
    oarsTechnique = 'COMBINED';
  }

  // External motivation override
  if (input.externalMotivationDominant && responseMode !== 'DOUBLE_SIDED_REFLECTION') {
    routeNext = 'AGC01';
  }

  return {
    moduleId: 'MI02', activationStatus: 'ACTIVE', confidenceScore,
    matchedMarkers: allMarkers, responseMode, oarsTechnique, routeNext,
    reason: 'Deep recovery ambivalence detected.',
  };
}
