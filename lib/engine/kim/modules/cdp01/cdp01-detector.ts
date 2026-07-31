/**
 * CDP01 Detector — Codependentie Patroon Detectie
 * Detects self-loss, relational fusion, rescue compulsion in caregiver.
 * Kim only. Crisis/safety override. K06 gate.
 */

import type { CDP01RuntimeInput, CDP01DetectionResult, CDP01ResponseMode, CDP01RouteNext } from "./cdp01-types";

const NL_MARKERS = [
  "ik leef voor hem", "ik leef voor haar", "ik leef alleen nog voor hem",
  "ik leef alleen nog voor haar", "zonder hem weet ik niet wie ik ben",
  "zonder haar weet ik niet wie ik ben", "als het goed gaat met hem gaat het goed met mij",
  "als het goed gaat met haar gaat het goed met mij", "als hij slecht gaat, ga ik mee onder",
  "als zij slecht gaat, ga ik mee onder", "mijn leven draait rond zijn gebruik",
  "mijn leven draait rond haar gebruik", "ik ben mezelf kwijt door hem",
  "ik ben mezelf kwijt door haar", "ik weet niet meer wat ik zelf wil",
  "ik voel alleen nog wat hij voelt", "ik voel alleen nog wat zij voelt",
  "ik kan pas ademen als hij oke is", "ik kan pas ademen als zij oke is",
  "ik moet hem redden", "ik moet haar redden", "als ik loslaat, gaat hij kapot",
  "als ik loslaat, gaat zij kapot", "ik mag niet aan mezelf denken",
  "ik voel me egoistisch als ik iets voor mezelf doe",
  "ik kan niet genieten zolang hij lijdt", "ik kan niet genieten zolang zij lijdt",
  "ik check constant", "ik controleer alles",
  "ik ben altijd bezig met zijn stemming", "ik ben altijd bezig met haar stemming",
  "ik vergeet mezelf", "ik besta precies niet meer", "mijn grenzen verdwijnen",
  "ik neem alles over", "ik draag alles",
  "ik ben verantwoordelijk voor zijn herstel", "ik ben verantwoordelijk voor haar herstel",
  "ik weet dat het mij kapotmaakt maar ik kan niet stoppen",
  "ik kies altijd hem boven mezelf", "ik kies altijd haar boven mezelf",
];

const EN_MARKERS = [
  "i live for him", "i live for her", "i only live for him now",
  "i only live for her now", "without him i do not know who i am",
  "without her i do not know who i am", "if he is okay, i am okay",
  "if she is okay, i am okay", "if he goes down, i go down with him",
  "if she goes down, i go down with her", "my life revolves around his use",
  "my life revolves around her use", "i lost myself because of him",
  "i lost myself because of her", "i do not know what i want anymore",
  "i only feel what he feels", "i only feel what she feels",
  "i can only breathe when he is okay", "i can only breathe when she is okay",
  "i have to save him", "i have to save her",
  "if i let go, he will fall apart", "if i let go, she will fall apart",
  "i am not allowed to think about myself",
  "i feel selfish when i do something for myself",
  "i cannot enjoy anything while he suffers", "i cannot enjoy anything while she suffers",
  "i check constantly", "i control everything",
  "i am always focused on his mood", "i am always focused on her mood",
  "i forget myself", "it feels like i do not exist anymore",
  "my boundaries disappear", "i take everything over", "i carry everything",
  "i am responsible for his recovery", "i am responsible for her recovery",
  "i know it destroys me but i cannot stop",
  "i always choose him over myself", "i always choose her over myself",
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

export function detectCDP01(input: CDP01RuntimeInput): CDP01DetectionResult {
  // Gate: intake
  if (!input.intakeCompleted) {
    return {
      moduleId: "CDP01",
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
      moduleId: "CDP01",
      activationStatus: "BLOCKED_BY_PERSONA",
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_EXIT",
      routeNext: "NO_MODULE",
      reason: "CDP01 is Kim only.",
    };
  }

  // Gate: crisis
  if (input.crisisProtocolStatus === "ACTIVE" || input.safetyRisk >= 0.70) {
    return {
      moduleId: "CDP01",
      activationStatus: "BLOCKED_BY_CRISIS",
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_EXIT",
      routeNext: "CRISIS_PROTOCOL",
      reason: "Crisis protocol overrides codependency pattern reflection.",
    };
  }

  // Gate: K06 stabilization
  if (input.acuteOverload || input.K06StabilizationStatus !== "STABILIZED") {
    return {
      moduleId: "CDP01",
      activationStatus: "DEFERRED_TO_K06",
      confidenceScore: 0.80,
      matchedMarkers: input.detectedMarkers,
      responseMode: "K06_STABILIZATION_BRIDGE",
      routeNext: "K06",
      reason: "K06 stabilization required before self-loss reflection.",
    };
  }

  // Marker matching
  const allText = [input.latestUserMessage, ...input.recentMessages].join(" ");
  const markers = matchMarkers(allText);
  const combinedMarkers = [...new Set([...input.detectedMarkers, ...markers])];

  // Confidence scoring (per spec)
  let score = 0;
  if (input.identityCollapseWithoutPartner) score += 0.30;
  if (input.selfLossPattern) score += 0.25;
  if (input.relationalFusion) score += 0.15;
  if (input.emotionalDependencyOnPartnerState) score += 0.15;
  if (input.rescueCompulsion || input.overResponsibility) score += 0.10;
  if (input.controlFromFear) score += 0.05;
  if (input.selfCareGuilt) score += 0.05;
  if (combinedMarkers.length > 0) score += 0.05;

  const confidenceScore = Math.min(score, 0.98);

  if (confidenceScore < 0.50) {
    return {
      moduleId: "CDP01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore,
      matchedMarkers: combinedMarkers,
      responseMode: "SELF_LOSS_PATTERN_MIRROR",
      routeNext: "NO_MODULE",
      reason: "Self-loss/codependency-like signal below threshold.",
    };
  }

  // Response mode routing (per spec)
  let responseMode: CDP01ResponseMode = "SELF_LOSS_PATTERN_MIRROR";
  let routeNext: CDP01RouteNext = "CDP01";

  if (input.identityCollapseWithoutPartner) {
    responseMode = "IDENTITY_SEPARATION_GENTLE";
  } else if (input.emotionalDependencyOnPartnerState) {
    responseMode = "EMOTIONAL_LINK_REFLECTION";
  } else if (input.rescueCompulsion || input.overResponsibility) {
    responseMode = "LOVE_VS_OVERRESPONSIBILITY";
    routeNext = "KDL01";
  } else if (input.selfCareGuilt) {
    responseMode = "SELF_CARE_GUILT_SOFTENING";
    routeNext = "KSC01";
  } else if (input.controlFromFear) {
    responseMode = "CONTROL_AS_FEAR_RESPONSE";
    routeNext = "KBR01";
  }

  return {
    moduleId: "CDP01",
    activationStatus: "ACTIVE",
    confidenceScore,
    matchedMarkers: combinedMarkers,
    responseMode,
    routeNext,
    reason: "Kim self-loss / codependency-like caregiver pattern detected.",
  };
}
