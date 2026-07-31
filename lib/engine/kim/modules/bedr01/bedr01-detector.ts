/**
 * BEDR01 Detector — Betrayal Discovery Response
 * Detects acute shock after caregiver discovers betrayal.
 * Kim only. Crisis/safety override. K06 gate.
 */

import type { BEDR01RuntimeInput, BEDR01DetectionResult, BEDR01ResponseMode, BEDR01RouteNext } from "./bedr01-types";

const NL_MARKERS = [
  "ik heb het ontdekt", "ik kwam erachter", "ik vond berichten",
  "hij heeft me bedrogen", "zij heeft me bedrogen", "ik ben in shock",
  "ik kan niet stoppen met trillen", "ik weet niet wat ik moet doen",
  "mijn wereld is ingestort", "alles is een leugen",
  "ik heb zijn telefoon gezien", "ik heb haar telefoon gezien",
  "hij heeft gelogen over alles", "zij heeft gelogen over alles",
  "ik ontdekte dat hij weer gebruikt", "ik ontdekte dat zij weer gebruikt",
  "ik vond bewijs", "net ontdekt", "vandaag ontdekt",
];

const EN_MARKERS = [
  "i just found out", "i discovered", "i found messages",
  "he cheated", "she cheated", "i am in shock",
  "i cannot stop shaking", "i do not know what to do",
  "my world collapsed", "everything was a lie",
  "i saw his phone", "i saw her phone",
  "he lied about everything", "she lied about everything",
  "i found out he is using again", "i found out she is using again",
  "i found proof", "just discovered", "discovered today",
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

export function detectBEDR01(input: BEDR01RuntimeInput): BEDR01DetectionResult {
  // Gate: intake
  if (!input.intakeCompleted) {
    return {
      moduleId: "BEDR01",
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
      moduleId: "BEDR01",
      activationStatus: "BLOCKED_BY_PERSONA",
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_EXIT",
      routeNext: "NO_MODULE",
      reason: "BEDR01 is Kim only.",
    };
  }

  // Gate: crisis
  if (input.crisisProtocolStatus === "ACTIVE") {
    return {
      moduleId: "BEDR01",
      activationStatus: "BLOCKED_BY_CRISIS",
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_EXIT",
      routeNext: "CRISIS_PROTOCOL",
      reason: "Crisis protocol overrides betrayal discovery.",
    };
  }

  // Gate: safety
  if (input.safetyRisk >= 0.65) {
    return {
      moduleId: "BEDR01",
      activationStatus: "DEFERRED_TO_SAFETY",
      confidenceScore: 0.95,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_PLANNING",
      routeNext: "SAFETY_PROTOCOL",
      reason: "Safety risk overrides betrayal discovery response.",
    };
  }

  // Marker matching
  const allText = [input.latestUserMessage, ...input.recentMessages].join(" ");
  const markers = matchMarkers(allText);
  const combinedMarkers = [...new Set([...input.detectedMarkers, ...markers])];

  // Confidence scoring
  let score = 0;
  if (input.acuteShockDominant) score += 0.35;
  if (input.discoveryJustHappened) score += 0.30;
  if (input.bodyDysregulation) score += 0.15;
  if (input.childrenInvolved) score += 0.10;
  if (input.decisionPressure) score += 0.05;
  if (markers.length > 0) score += Math.min(markers.length * 0.05, 0.15);

  const confidenceScore = Math.min(score, 0.98);

  if (confidenceScore < 0.50) {
    return {
      moduleId: "BEDR01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore,
      matchedMarkers: combinedMarkers,
      responseMode: "ACUTE_SHOCK_CONTAINMENT",
      routeNext: "NO_MODULE",
      reason: "Betrayal discovery signal below threshold.",
    };
  }

  // Response mode routing
  let responseMode: BEDR01ResponseMode = "ACUTE_SHOCK_CONTAINMENT";
  let routeNext: BEDR01RouteNext = "BEDR01";

  if (input.legalAdviceRequest) {
    responseMode = "LEGAL_BOUNDARY_RESPONSE";
  } else if (input.guiltInnocenceRequest) {
    responseMode = "NO_GUILT_INNOCENCE_VERDICT";
  } else if (input.childrenInvolved && input.safetyRisk >= 0.40) {
    responseMode = "CHILDREN_SAFETY_CHECK";
  } else if (input.bodyDysregulation) {
    responseMode = "BODY_REGULATION_FIRST";
  } else if (input.decisionPressure) {
    responseMode = "NO_DECISION_PRESSURE";
  } else if (input.discoveryJustHappened) {
    responseMode = "REALITY_ANCHOR";
  }

  return {
    moduleId: "BEDR01",
    activationStatus: "ACTIVE",
    confidenceScore,
    matchedMarkers: combinedMarkers,
    responseMode,
    routeNext,
    reason: "Acute betrayal discovery detected — shock containment active.",
  };
}
