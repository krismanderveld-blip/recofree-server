/**
 * VETR01 Detector — Trust Repair After Betrayal
 * Kim only. K06 stabilization required. BEDR01 priority at acute shock.
 */

import type { VETR01RuntimeInput, VETR01DetectionResult, VETR01ResponseMode, VETR01RouteNext } from "./vetr01-types";

const NL_MARKERS = [
  "kan ik hem ooit nog vertrouwen", "kan ik haar ooit nog vertrouwen",
  "hoe herstel je vertrouwen", "moet ik vergeven",
  "ik wil vergeven maar ik kan het niet", "vertrouwen is weg",
  "hoe lang duurt het voor vertrouwen terugkomt",
  "iedereen zegt dat ik moet vergeven", "moet ik blijven",
  "moet ik weggaan", "heeft de relatie nog zin",
  "hij zegt dat ik moet vertrouwen", "zij zegt dat ik moet vertrouwen",
  "ik wil een grens maar ik voel me schuldig",
  "wanneer weet ik of ik kan vertrouwen",
];

const EN_MARKERS = [
  "can i ever trust him again", "can i ever trust her again",
  "how do you rebuild trust", "should i forgive",
  "i want to forgive but i cannot", "trust is gone",
  "how long does trust take to come back",
  "everyone says i should forgive", "should i stay",
  "should i leave", "does the relationship still have meaning",
  "he says i should trust him", "she says i should trust her",
  "i want a boundary but i feel guilty",
  "when will i know if i can trust",
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

export function detectVETR01(input: VETR01RuntimeInput): VETR01DetectionResult {
  if (!input.intakeCompleted) {
    return {
      moduleId: "VETR01",
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
      moduleId: "VETR01",
      activationStatus: "BLOCKED_BY_PERSONA",
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_EXIT",
      routeNext: "NO_MODULE",
      reason: "VETR01 is Kim only.",
    };
  }

  if (input.crisisProtocolStatus === "ACTIVE") {
    return {
      moduleId: "VETR01",
      activationStatus: "BLOCKED_BY_CRISIS",
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_EXIT",
      routeNext: "CRISIS_PROTOCOL",
      reason: "Crisis protocol overrides trust repair.",
    };
  }

  if (input.safetyRisk >= 0.65) {
    return {
      moduleId: "VETR01",
      activationStatus: "DEFERRED_TO_SAFETY",
      confidenceScore: 0.95,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_BOUNDARY_FIRST",
      routeNext: "SAFETY_PROTOCOL",
      reason: "Safety risk overrides trust repair.",
    };
  }

  if (input.acuteShockDominant || input.K06StabilizationStatus !== "STABILIZED") {
    return {
      moduleId: "VETR01",
      activationStatus: input.acuteShockDominant ? "DEFERRED_TO_BEDR01" : "DEFERRED_TO_K06",
      confidenceScore: 0.85,
      matchedMarkers: input.detectedMarkers,
      responseMode: "DEFER_TO_BEDR01_OR_K06",
      routeNext: input.acuteShockDominant ? "BEDR01" : "K06",
      reason: "Acute shock or incomplete stabilization blocks trust repair.",
    };
  }

  // Marker matching
  const allText = [input.latestUserMessage, ...input.recentMessages].join(" ");
  const markers = matchMarkers(allText);
  const combinedMarkers = [...new Set([...input.detectedMarkers, ...markers])];

  // Confidence scoring
  let score = 0;
  if (input.trustRepairQuestion) score += 0.35;
  if (input.forgivenessPressure) score += 0.20;
  if (input.relationshipMeaningQuestion) score += 0.15;
  if (input.boundaryNeedAfterBetrayal) score += 0.15;
  if (input.timelinePressure) score += 0.10;
  if (input.partnerMindReading) score += 0.05;
  if (markers.length > 0) score += Math.min(markers.length * 0.03, 0.10);

  const confidenceScore = Math.min(score, 0.98);

  if (confidenceScore < 0.50) {
    return {
      moduleId: "VETR01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore,
      matchedMarkers: combinedMarkers,
      responseMode: "TRUST_REPAIR_WITHOUT_PRESSURE",
      routeNext: "NO_MODULE",
      reason: "Trust repair signal below threshold.",
    };
  }

  // Response mode routing
  let responseMode: VETR01ResponseMode = "TRUST_REPAIR_WITHOUT_PRESSURE";
  let routeNext: VETR01RouteNext = "VETR01";

  if (input.legalAdviceRequest) {
    responseMode = "LEGAL_BOUNDARY_RESPONSE";
  } else if (input.guiltInnocenceRequest) {
    responseMode = "NO_GUILT_INNOCENCE_VERDICT";
  } else if (input.forgivenessPressure) {
    responseMode = "FORGIVENESS_NOT_REQUIRED";
  } else if (input.partnerMindReading) {
    responseMode = "MBT_REALITY_SEPARATION";
  } else if (input.boundaryNeedAfterBetrayal) {
    responseMode = "BOUNDARY_BRIDGE_AFTER_BETRAYAL";
    routeNext = "KBR01";
  } else if (input.timelinePressure) {
    responseMode = "NO_TIMELINE_PRESSURE";
  }

  return {
    moduleId: "VETR01",
    activationStatus: "ACTIVE",
    confidenceScore,
    matchedMarkers: combinedMarkers,
    responseMode,
    routeNext,
    reason: "Trust repair after betrayal selected after K06 stabilization.",
  };
}
