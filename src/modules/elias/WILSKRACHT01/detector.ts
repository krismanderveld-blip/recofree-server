import type {
  EliasPsychoEducationRuntimeInput,
  EliasPsychoEducationDetectionResult,
} from "@/src/types/eliasPsychoEducation.types";
import { WILSKRACHT01_MARKERS_NL, WILSKRACHT01_MARKER_IDS_NL } from "./markerBank.nl";
import { WILSKRACHT01_MARKERS_EN, WILSKRACHT01_MARKER_IDS_EN } from "./markerBank.en";

/**
 * Detects WILSKRACHT01 activation based on self-blame, willpower language,
 * and shame after relapse/craving.
 *
 * Follows spec exactly:
 * - Persona must be elias
 * - Intake must be completed
 * - Crisis overrides
 * - High craving (>=7) defers to DGT
 * - VSP PAARS defers to safety
 */
export function detectWilskracht01(
  input: EliasPsychoEducationRuntimeInput
): EliasPsychoEducationDetectionResult {
  // Guard: persona
  if (input.persona !== "elias") {
    return {
      moduleId: "WILSKRACHT01",
      activationStatus: "BLOCKED_BY_PERSONA",
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SELF_BLAME_AFTER_RELAPSE",
      routeNext: "NO_MODULE",
      memoryReadRequired: false,
      memoryWriteRequired: false,
      reason: "Kim cannot activate WILSKRACHT01.",
    };
  }

  // Guard: intake
  if (!input.intakeCompleted) {
    return {
      moduleId: "WILSKRACHT01",
      activationStatus: "BLOCKED_BY_INTAKE",
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SELF_BLAME_AFTER_RELAPSE",
      routeNext: "NO_MODULE",
      memoryReadRequired: false,
      memoryWriteRequired: false,
      reason: "Intake incomplete.",
    };
  }

  // Guard: crisis
  if (input.crisisProtocolActive || input.suicideSelfHarmDetected || input.acuteDangerDetected) {
    return {
      moduleId: "WILSKRACHT01",
      activationStatus: "BLOCKED_BY_CRISIS",
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_DEFERRED",
      routeNext: "CRISIS_PROTOCOL",
      memoryReadRequired: true,
      memoryWriteRequired: false,
      reason: "Crisis protocol overrides psycho-education.",
    };
  }

  // Guard: high craving → DGT
  if (input.cravingSliderValue !== null && input.cravingSliderValue >= 7) {
    return {
      moduleId: "WILSKRACHT01",
      activationStatus: "DEFER_TO_CRAVING_REGULATION",
      confidenceScore: 0.90,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_DEFERRED",
      routeNext: "DGT_CRAVING_REGULATION",
      memoryReadRequired: true,
      memoryWriteRequired: false,
      reason: "High craving requires regulation before psycho-education.",
    };
  }

  // Guard: VSP PAARS → safety
  if (input.vspZone === "PAARS") {
    return {
      moduleId: "WILSKRACHT01",
      activationStatus: "DEFER_TO_VSP_SAFETY",
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_DEFERRED",
      routeNext: "VSP_SAFETY",
      memoryReadRequired: true,
      memoryWriteRequired: false,
      reason: "VSP PAARS requires safety protocol.",
    };
  }

  // Detect markers
  const lower = input.latestUserMessage.toLowerCase();
  const allMessages = [lower, ...input.recentMessages.map((m) => m.toLowerCase())];
  const combined = allMessages.join(" ");

  const matchedMarkers: string[] = [...input.detectedMarkers];

  const hasSelfBlame = matchesAny(combined, WILSKRACHT01_MARKERS_NL.selfBlame) ||
    matchesAny(combined, WILSKRACHT01_MARKERS_EN.selfBlame);
  const hasWillpower = matchesAny(combined, WILSKRACHT01_MARKERS_NL.willpowerLanguage) ||
    matchesAny(combined, WILSKRACHT01_MARKERS_EN.willpowerLanguage);
  const hasShame = matchesAny(combined, WILSKRACHT01_MARKERS_NL.shameAfterRelapse) ||
    matchesAny(combined, WILSKRACHT01_MARKERS_EN.shameAfterRelapse);

  if (hasSelfBlame) matchedMarkers.push(WILSKRACHT01_MARKER_IDS_NL.selfBlame);
  if (hasWillpower) matchedMarkers.push(WILSKRACHT01_MARKER_IDS_NL.willpowerLanguage);
  if (hasShame) matchedMarkers.push(WILSKRACHT01_MARKER_IDS_NL.shameAfterRelapse);

  // Also check runtime flags
  const hasSelfBlameFlag = input.selfBlameDetected || hasSelfBlame;
  const hasWillpowerFlag = input.willpowerLanguageDetected || hasWillpower;
  const hasRelapseContext = input.relapseRecentlyOccurred || input.cravingDetected || hasShame;

  // Activation logic
  if (!hasSelfBlameFlag && !hasWillpowerFlag && !hasShame) {
    return {
      moduleId: "WILSKRACHT01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore: 0,
      matchedMarkers,
      responseMode: "SELF_BLAME_AFTER_RELAPSE",
      routeNext: "NO_MODULE",
      memoryReadRequired: true,
      memoryWriteRequired: false,
      reason: "No self-blame/willpower pattern detected.",
    };
  }

  // Confidence scoring
  const confidenceScore =
    hasSelfBlameFlag && hasRelapseContext && hasWillpowerFlag ? 0.95 :
    hasSelfBlameFlag && hasRelapseContext ? 0.92 :
    hasWillpowerFlag && hasRelapseContext ? 0.88 :
    hasSelfBlameFlag ? 0.84 :
    hasWillpowerFlag ? 0.80 :
    0.65;

  // Response mode selection
  const responseMode =
    hasSelfBlameFlag && hasRelapseContext ? "SELF_BLAME_AFTER_RELAPSE" :
    hasWillpowerFlag ? "WILLPOWER_REFRAME" :
    hasSelfBlameFlag ? "RIDER_HORSE_MODEL" :
    "LIBET_PAUSE_WINDOW";

  return {
    moduleId: "WILSKRACHT01",
    activationStatus: "ACTIVE",
    confidenceScore,
    matchedMarkers,
    responseMode,
    routeNext: "WILSKRACHT01",
    memoryReadRequired: true,
    memoryWriteRequired: true,
    reason: "Self-blame/willpower language detected in relapse/craving context.",
  };
}

function matchesAny(text: string, patterns: string[]): boolean {
  return patterns.some((p) => text.includes(p.toLowerCase()));
}
