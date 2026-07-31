/**
 * TERV01 — Post-Purple Zone Relapse Chain Analysis (Elias only)
 * DETECTOR: Activates only after PAARS session ended + stabilization confirmed
 */
import type { TERV01RuntimeInput, TERV01DetectionResult, TERV01ResponseMode, TERV01RouteNext } from './terv01-types';

// ── Marker banks ──
const ANALYSIS_MARKERS_NL = [
  'ik wil begrijpen hoe het fout liep', 'wat was de trigger',
  'hoe is die terugval begonnen', 'ik wil analyseren wat er gebeurde',
  'ik weet niet waarom ik gebruikte', 'het ging ineens fout',
  'ik wil de keten zien', 'wat gebeurde er voor ik gebruikte',
  'ik wil dit kunnen uitleggen aan mijn dokter', 'ik wil dit met peuskens kunnen bespreken',
  'ik wil weten waar ik had kunnen ingrijpen', 'ik wil snappen wat het patroon was',
  'waarom ben ik van trigger naar gebruik gegaan', 'welke gedachte zat ertussen',
  'wat voelde ik eigenlijk', 'wanneer verloor ik controle',
  'ik voelde iets en toen ging ik', 'ik dacht het maakt toch niet uit',
  'ik had al beslist voor ik het doorhad', 'ik wil geen schaamte ik wil begrijpen',
  'ik wil het klinisch kunnen zien', 'ik wil voorkomen dat dit opnieuw gebeurt',
];

const ANALYSIS_MARKERS_EN = [
  'i want to understand how it went wrong', 'what was the trigger',
  'how did this relapse start', 'i want to analyze what happened',
  'i do not know why i used', 'it suddenly went wrong',
  'i want to see the chain', 'what happened before i used',
  'i want to explain this to my doctor', 'i want to discuss this with my psychiatrist',
  'i want to know where i could have intervened', 'i want to understand the pattern',
  'how did i go from trigger to use', 'what thought was in between',
  'what did i actually feel', 'when did i lose control',
  'i felt something and then i went', 'i thought it does not matter anymore',
  'i had already decided before i noticed', 'i do not want shame i want to understand',
  'i want to see it clinically', 'i want to prevent this from happening again',
];

function matchMarkers(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const m of ANALYSIS_MARKERS_NL) {
    if (lower.includes(m)) matched.push(m);
  }
  for (const m of ANALYSIS_MARKERS_EN) {
    if (lower.includes(m)) matched.push(m);
  }
  return matched;
}

export function detectTERV01(input: TERV01RuntimeInput): TERV01DetectionResult {
  // Gate: intake
  if (!input.intakeCompleted) {
    return {
      moduleId: 'TERV01', activationStatus: 'BLOCKED_BY_INTAKE', confidenceScore: 0,
      matchedMarkers: [], responseMode: 'NOT_ELIGIBLE_NO_POST_PAARS_CONTEXT',
      routeNext: 'NO_MODULE', reason: 'Intake incomplete. Engine blocks all therapeutic modules.',
    };
  }

  // Gate: crisis
  if (input.crisisProtocolStatus === 'ACTIVE' || input.safetyRisk >= 0.7) {
    return {
      moduleId: 'TERV01', activationStatus: 'BLOCKED_BY_CRISIS', confidenceScore: 1,
      matchedMarkers: input.detectedMarkers, responseMode: 'SAFETY_EXIT',
      routeNext: 'CRISIS_PROTOCOL', reason: 'Crisis protocol overrides relapse analysis.',
    };
  }

  // Gate: medical
  if (input.medicalRisk >= 0.7) {
    return {
      moduleId: 'TERV01', activationStatus: 'BLOCKED_BY_MEDICAL', confidenceScore: 1,
      matchedMarkers: input.detectedMarkers, responseMode: 'MEDICAL_SAFETY_EXIT',
      routeNext: 'MEDICAL_SAFETY_PROTOCOL', reason: 'Medical safety overrides relapse analysis.',
    };
  }

  // Gate: currently in PAARS — never analyze during active relapse
  if (input.currentZone === 'PAARS') {
    return {
      moduleId: 'TERV01', activationStatus: 'BLOCKED_DURING_PAARS', confidenceScore: 1,
      matchedMarkers: input.detectedMarkers, responseMode: 'BLOCK_ANALYSIS_DURING_PAARS',
      routeNext: 'FALE01_STAGE_1', reason: 'TERV01 activates after PAARS sessions only, never during.',
    };
  }

  // Gate: no completed PAARS session
  if (input.previousZone !== 'PAARS' || input.previousSessionEnded !== true) {
    return {
      moduleId: 'TERV01', activationStatus: 'NOT_ACTIVE', confidenceScore: 0,
      matchedMarkers: input.detectedMarkers, responseMode: 'NOT_ELIGIBLE_NO_POST_PAARS_CONTEXT',
      routeNext: 'NO_MODULE', reason: 'No completed PAARS session available.',
    };
  }

  // Gate: stabilization not yet sufficient
  if (!input.stabilizationCompleted || input.userRegulationLevel < 0.55) {
    return {
      moduleId: 'TERV01', activationStatus: 'DEFERRED_STABILIZATION_REQUIRED', confidenceScore: 0.80,
      matchedMarkers: input.detectedMarkers, responseMode: 'POST_PAARS_STABILIZATION_CHECK',
      routeNext: 'EKT01_VERHELDERING', reason: 'Post-PAARS analysis deferred until stabilization is sufficient.',
    };
  }

  // Confidence scoring
  let score = 0.60;
  if (input.relapseConfirmed) score += 0.20;
  if (input.relapseLikely) score += 0.10;
  if (input.userRequestsAnalysis) score += 0.10;
  if (input.chainDataCompleteness >= 0.70) score += 0.08;

  const markers = matchMarkers(input.latestUserMessage);
  if (markers.length > 0) score += 0.05;
  const allMarkers = [...input.detectedMarkers, ...markers];

  const confidenceScore = Math.min(score, 0.98);

  // Response mode routing
  let responseMode: TERV01ResponseMode = 'CLINICAL_CHAIN_MAPPING';
  let routeNext: TERV01RouteNext = 'TERV01';

  if (input.chainDataCompleteness >= 0.70) {
    responseMode = 'CLINICAL_CHAIN_MAPPING';
  } else if (!input.triggerKnown) {
    responseMode = 'TRIGGER_CLARIFICATION';
  } else if (!input.thoughtKnown) {
    responseMode = 'THOUGHT_BRIDGE_IDENTIFICATION';
  } else if (!input.feelingKnown) {
    responseMode = 'EMOTION_BODY_MAPPING';
  } else if (!input.behaviorKnown || !input.usePointKnown) {
    responseMode = 'BEHAVIORAL_ACCESS_POINT';
  } else {
    responseMode = 'PREVENTION_POINT_CONTRACT';
  }

  // After prevention point, route to MI02 for ambivalence work
  if (responseMode === 'PREVENTION_POINT_CONTRACT') {
    routeNext = 'MI02';
  }

  return {
    moduleId: 'TERV01', activationStatus: 'ACTIVE', confidenceScore,
    matchedMarkers: allMarkers, responseMode, routeNext,
    reason: 'Completed PAARS session with sufficient stabilization. Post-relapse chain analysis allowed.',
  };
}
