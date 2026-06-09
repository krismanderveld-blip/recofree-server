/**
 * GASL01 Detector — Gaslighting Recognition & Fact Anchoring
 * Kim only. K06 gate (fact anchoring only if incomplete). BEDR01 priority at acute shock.
 */

import type { GASL01RuntimeInput, GASL01DetectionResult, GASL01ResponseMode, GASL01RouteNext } from "./gasl01-types";

const NL_MARKERS = [
  "misschien heb ik het mis", "misschien overdrijf ik",
  "hij zegt dat het mijn schuld is", "zij zegt dat het mijn schuld is",
  "ik weet niet meer wat waar is", "ben ik gek",
  "hij zegt dat het niet zo is gebeurd", "zij zegt dat het niet zo is gebeurd",
  "ik twijfel aan mezelf", "ik geloof mijn eigen geheugen niet meer",
  "hij draait het om", "zij draait het om",
  "hij zegt dat ik te gevoelig ben", "zij zegt dat ik te gevoelig ben",
  "hij zegt dat ik het heb veroorzaakt", "zij zegt dat ik het heb veroorzaakt",
  "de kinderen zeggen dat ik de schuldige ben",
  "hij gebruikt de kinderen tegen mij", "zij gebruikt de kinderen tegen mij",
  "ik heb geen bewijs maar ik weet het zeker",
  "hij liegt maar iedereen gelooft hem", "zij liegt maar iedereen gelooft haar",
];

const EN_MARKERS = [
  "maybe i am wrong", "maybe i am overreacting",
  "he says it is my fault", "she says it is my fault",
  "i do not know what is true anymore", "am i crazy",
  "he says it did not happen that way", "she says it did not happen that way",
  "i doubt myself", "i do not trust my own memory",
  "he turns it around", "she turns it around",
  "he says i am too sensitive", "she says i am too sensitive",
  "he says i caused it", "she says i caused it",
  "the children say i am the guilty one",
  "he uses the children against me", "she uses the children against me",
  "i have no proof but i know for sure",
  "he lies but everyone believes him", "she lies but everyone believes her",
];

function matchMarkers(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const m of NL_MARKERS) {
    if (lower.includes(m)) matched.push(m);
  }
  for (const m of EN_MARKERS) {
    if (lower.includes(m)) matched.push(m);
  }
  return matched;
}

export function detectGASL01(input: GASL01RuntimeInput): GASL01DetectionResult {
  if (!input.intakeCompleted) {
    return {
      moduleId: "GASL01",
      activationStatus: "BLOCKED_BY_INTAKE",
      confidenceScore: 0,
      matchedMarkers: [],
      responseMode: "SAFETY_EXIT",
      routeNext: "NO_MODULE",
      reason: "Intake incomplete.",
    };
  }

  if (input.persona !== "kim") {
    return {
      moduleId: "GASL01",
      activationStatus: "BLOCKED_BY_PERSONA",
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_EXIT",
      routeNext: "NO_MODULE",
      reason: "GASL01 is Kim only.",
    };
  }

  if (input.crisisProtocolStatus === "ACTIVE") {
    return {
      moduleId: "GASL01",
      activationStatus: "BLOCKED_BY_CRISIS",
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_EXIT",
      routeNext: "CRISIS_PROTOCOL",
      reason: "Crisis protocol overrides gaslighting recognition.",
    };
  }

  if (input.safetyRisk >= 0.65) {
    return {
      moduleId: "GASL01",
      activationStatus: "DEFERRED_TO_SAFETY",
      confidenceScore: 0.95,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_BOUNDARY_FIRST",
      routeNext: "SAFETY_PROTOCOL",
      reason: "Safety risk overrides gaslighting recognition.",
    };
  }

  if (input.acuteShockDominant) {
    return {
      moduleId: "GASL01",
      activationStatus: "DEFERRED_TO_BEDR01",
      confidenceScore: 0.85,
      matchedMarkers: input.detectedMarkers,
      responseMode: "FACT_ANCHORING",
      routeNext: "BEDR01",
      reason: "Acute shock defers to BEDR01.",
    };
  }

  // K06 gate: only fact anchoring if incomplete
  const factAnchoringOnly = input.K06StabilizationStatus !== "STABILIZED";

  // Marker matching
  const allText = [input.latestUserMessage, ...input.recentMessages].join(" ");
  const markers = matchMarkers(allText);
  const combinedMarkers = [...new Set([...input.detectedMarkers, ...markers])];

  // Confidence scoring
  let score = 0;
  if (input.selfDoubtDominant) score += 0.30;
  if (input.realityQuestionDominant) score += 0.25;
  if (input.darvoPatternDetected) score += 0.20;
  if (input.informationAsymmetry) score += 0.10;
  if (input.childrenTriangulation) score += 0.10;
  if (input.partnerBlamesCaregiver) score += 0.10;
  if (markers.length > 0) score += Math.min(markers.length * 0.04, 0.12);

  const confidenceScore = Math.min(score, 0.98);

  if (confidenceScore < 0.45) {
    return {
      moduleId: "GASL01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore,
      matchedMarkers: combinedMarkers,
      responseMode: "FACT_ANCHORING",
      routeNext: "NO_MODULE",
      reason: "Gaslighting signal below threshold.",
    };
  }

  // K06 incomplete — limited mode
  if (factAnchoringOnly) {
    return {
      moduleId: "GASL01",
      activationStatus: "LIMITED_FACT_ANCHORING_ONLY",
      confidenceScore,
      matchedMarkers: combinedMarkers,
      responseMode: "FACT_ANCHORING",
      routeNext: "GASL01",
      reason: "K06 incomplete — only fact anchoring allowed.",
    };
  }

  // Full response mode routing
  let responseMode: GASL01ResponseMode = "PATTERN_RECOGNITION";
  let routeNext: GASL01RouteNext = "GASL01";

  if (input.legalAdviceRequest) {
    responseMode = "LEGAL_BOUNDARY_RESPONSE";
  } else if (input.darvoPatternDetected) {
    responseMode = "DARVO_RECOGNITION";
  } else if (input.childrenTriangulation) {
    responseMode = "CHILDREN_TRIANGULATION";
  } else if (input.informationAsymmetry) {
    responseMode = "INFORMATION_ASYMMETRY";
  } else if (input.selfDoubtDominant) {
    responseMode = "SELF_DOUBT_NORMALIZATION";
  } else if (input.realityQuestionDominant) {
    responseMode = "REALITY_VALIDATION";
  }

  return {
    moduleId: "GASL01",
    activationStatus: "ACTIVE",
    confidenceScore,
    matchedMarkers: combinedMarkers,
    responseMode,
    routeNext,
    reason: "Gaslighting recognition active — pattern anchoring engaged.",
  };
}
