/**
 * RNW01 Detector — Rouw Naaste: Wie Ze Was
 * Detects ambiguous grief for who the loved one was before addiction.
 * Kim only. Crisis/safety override. K06 gate.
 */

import type { RNW01RuntimeInput, RNW01DetectionResult, RNW01ResponseMode, RNW01RouteNext } from "./rnw01-types";

const NL_MARKERS = [
  "ik mis wie hij was", "ik mis wie zij was", "ik mis de oude hem",
  "ik mis de oude haar", "hij is er nog maar toch weg",
  "zij is er nog maar toch weg", "ik rouw om iemand die nog leeft",
  "ik mis ons van vroeger", "de relatie zoals ze was is weg",
  "komt de oude hem ooit terug", "komt de oude haar ooit terug",
  "ik mis wie we samen waren", "hij is niet meer dezelfde",
  "zij is niet meer dezelfde", "ik herken hem niet meer",
  "ik herken haar niet meer", "ik verlies hem terwijl hij er nog is",
  "ik verlies haar terwijl zij er nog is",
  "ik voel me schuldig dat ik rouw terwijl hij nog leeft",
  "ik voel me schuldig dat ik rouw terwijl zij nog leeft",
  "ik moet dit gewoon accepteren", "iedereen zegt dat ik moet loslaten",
  "zij leeft nog maar voelt weg", "hij leeft nog maar voelt weg",
  "ik rouw om onze toekomst", "de toekomst die we hadden is weg",
  "ik weet niet of ik nog hoop mag hebben",
];

const EN_MARKERS = [
  "i miss who he was", "i miss who she was", "i miss the old him",
  "i miss the old her", "he is still here but gone",
  "she is still here but gone", "i grieve someone who is still alive",
  "i miss what we had", "the relationship as it was is gone",
  "will the old him ever come back", "will the old her ever come back",
  "i miss who we were together", "he is not the same anymore",
  "she is not the same anymore", "i do not recognize him anymore",
  "i do not recognize her anymore", "i am losing him while he is still here",
  "i am losing her while she is still here",
  "i feel guilty for grieving while he is still alive",
  "i feel guilty for grieving while she is still alive",
  "i just have to accept this", "everyone says i should let go",
  "she is still alive but feels gone", "he is still alive but feels gone",
  "i grieve our future", "the future we had is gone",
  "i do not know if i am allowed to hope",
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

export function detectRNW01(input: RNW01RuntimeInput): RNW01DetectionResult {
  // Gate: intake
  if (!input.intakeCompleted) {
    return {
      moduleId: "RNW01",
      activationStatus: "BLOCKED_BY_INTAKE",
      confidenceScore: 0,
      matchedMarkers: [],
      responseMode: "SAFETY_EXIT",
      routeNext: "NO_MODULE",
      reason: "Intake incomplete.",
    };
  }

  // Gate: persona
  if (input.persona !== "kim") {
    return {
      moduleId: "RNW01",
      activationStatus: "BLOCKED_BY_PERSONA",
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_EXIT",
      routeNext: "NO_MODULE",
      reason: "RNW01 is Kim only.",
    };
  }

  // Gate: crisis
  if (input.crisisProtocolStatus === "ACTIVE") {
    return {
      moduleId: "RNW01",
      activationStatus: "BLOCKED_BY_CRISIS",
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_EXIT",
      routeNext: "CRISIS_PROTOCOL",
      reason: "Crisis protocol overrides ambiguous grief reflection.",
    };
  }

  // Gate: safety
  if (input.safetyRisk >= 0.65) {
    return {
      moduleId: "RNW01",
      activationStatus: "DEFERRED_TO_SAFETY",
      confidenceScore: 0.95,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_EXIT",
      routeNext: "SAFETY_PROTOCOL",
      reason: "Safety risk overrides ambiguous grief reflection.",
    };
  }

  // Gate: K06 stabilization
  if (input.acuteFlooding || input.K06StabilizationStatus === "STABILIZING") {
    return {
      moduleId: "RNW01",
      activationStatus: "DEFERRED_TO_K06",
      confidenceScore: 0.80,
      matchedMarkers: input.detectedMarkers,
      responseMode: "K06_STABILIZATION_BRIDGE",
      routeNext: "K06",
      reason: "K06 stabilization required before grief reflection.",
    };
  }

  // Marker matching
  const allText = [input.latestUserMessage, ...input.recentMessages].join(" ");
  const markers = matchMarkers(allText);
  const combinedMarkers = [...new Set([...input.detectedMarkers, ...markers])];

  // Confidence scoring (per spec)
  let score = 0;
  if (input.missesOldPerson) score += 0.35;
  if (input.griefForLivingPerson) score += 0.20;
  if (input.ambiguousGriefMarker) score += 0.15;
  if (input.relationshipAsItWasLost) score += 0.10;
  if (input.guiltAboutGrieving) score += 0.10;
  if (input.falseHopeSeeking) score += 0.05;
  if (input.acceptancePressure) score += 0.05;
  if (input.futureLoss) score += 0.05;
  if (combinedMarkers.length > 0) score += 0.05;

  const confidenceScore = Math.min(score, 0.98);

  if (confidenceScore < 0.50) {
    return {
      moduleId: "RNW01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore,
      matchedMarkers: combinedMarkers,
      responseMode: "MISSING_WHO_THEY_WERE_VALIDATION",
      routeNext: "NO_MODULE",
      reason: "Ambiguous grief signal below threshold.",
    };
  }

  // Response mode routing (per spec)
  let responseMode: RNW01ResponseMode = "MISSING_WHO_THEY_WERE_VALIDATION";
  let routeNext: RNW01RouteNext = "RNW01";

  if (input.guiltAboutGrieving) {
    responseMode = "GRIEF_PERMISSION_WITHOUT_GUILT";
    routeNext = "KSC01";
  } else if (input.falseHopeSeeking) {
    responseMode = "NO_FALSE_HOPE_STILL_TENDER";
  } else if (input.acceptancePressure) {
    responseMode = "NO_FORCED_ACCEPTANCE";
  } else if (input.griefForLivingPerson && input.ambiguousGriefMarker) {
    responseMode = "AMBIGUOUS_GRIEF_NAMING";
  } else if (input.relationshipAsItWasLost) {
    responseMode = "RELATIONSHIP_LOSS_VALIDATION";
  } else if (input.futureLoss) {
    responseMode = "FUTURE_LOSS_ACKNOWLEDGEMENT";
  }

  return {
    moduleId: "RNW01",
    activationStatus: "ACTIVE",
    confidenceScore,
    matchedMarkers: combinedMarkers,
    responseMode,
    routeNext,
    reason: "Kim ambiguous grief for person-before-addiction detected.",
  };
}
