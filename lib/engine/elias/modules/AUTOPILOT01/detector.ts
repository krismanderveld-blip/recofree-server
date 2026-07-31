import type {
  EliasPsychoEducationRuntimeInput,
  EliasPsychoEducationDetectionResult,
} from "@/lib/types/eliasPsychoEducation.types";
import { AUTOPILOT01_MARKERS_NL, AUTOPILOT01_MARKER_IDS_NL } from "./markerBank.nl";
import { AUTOPILOT01_MARKERS_EN, AUTOPILOT01_MARKER_IDS_EN } from "./markerBank.en";

/**
 * Detects AUTOPILOT01 activation based on craving, trigger exposure,
 * automatic movement toward use, approach bias, attentional bias,
 * and conditioned trigger responses.
 *
 * Follows spec exactly:
 * - Persona must be elias
 * - Intake must be completed
 * - Crisis overrides
 * - High craving (>=7) defers to DGT
 * - VSP PAARS defers to safety
 */
export function detectAutopilot01(
  input: EliasPsychoEducationRuntimeInput
): EliasPsychoEducationDetectionResult {
  // Guard: persona
  if (input.persona !== "elias") {
    return {
      moduleId: "AUTOPILOT01",
      activationStatus: "BLOCKED_BY_PERSONA",
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      responseMode: "APPROACH_BIAS_EXPLANATION",
      routeNext: "NO_MODULE",
      memoryReadRequired: false,
      memoryWriteRequired: false,
      reason: "Kim cannot activate AUTOPILOT01.",
    };
  }

  // Guard: intake
  if (!input.intakeCompleted) {
    return {
      moduleId: "AUTOPILOT01",
      activationStatus: "BLOCKED_BY_INTAKE",
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      responseMode: "APPROACH_BIAS_EXPLANATION",
      routeNext: "NO_MODULE",
      memoryReadRequired: false,
      memoryWriteRequired: false,
      reason: "Intake incomplete.",
    };
  }

  // Guard: crisis
  if (input.crisisProtocolActive || input.suicideSelfHarmDetected || input.acuteDangerDetected) {
    return {
      moduleId: "AUTOPILOT01",
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
      moduleId: "AUTOPILOT01",
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
      moduleId: "AUTOPILOT01",
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

  const hasAutopilot = matchesAny(combined, AUTOPILOT01_MARKERS_NL.autopilotLanguage) ||
    matchesAny(combined, AUTOPILOT01_MARKERS_EN.autopilotLanguage);
  const hasTrigger = matchesAny(combined, AUTOPILOT01_MARKERS_NL.triggerExposure) ||
    matchesAny(combined, AUTOPILOT01_MARKERS_EN.triggerExposure);
  const hasApproachBias = matchesAny(combined, AUTOPILOT01_MARKERS_NL.approachBias) ||
    matchesAny(combined, AUTOPILOT01_MARKERS_EN.approachBias);
  const hasAttentionalBias = matchesAny(combined, AUTOPILOT01_MARKERS_NL.attentionalBias) ||
    matchesAny(combined, AUTOPILOT01_MARKERS_EN.attentionalBias);
  const hasConditionedTrigger = matchesAny(combined, AUTOPILOT01_MARKERS_NL.conditionedTrigger) ||
    matchesAny(combined, AUTOPILOT01_MARKERS_EN.conditionedTrigger);

  if (hasAutopilot) matchedMarkers.push(AUTOPILOT01_MARKER_IDS_NL.autopilotLanguage);
  if (hasTrigger) matchedMarkers.push(AUTOPILOT01_MARKER_IDS_NL.triggerExposure);
  if (hasApproachBias) matchedMarkers.push(AUTOPILOT01_MARKER_IDS_NL.approachBias);
  if (hasAttentionalBias) matchedMarkers.push(AUTOPILOT01_MARKER_IDS_NL.attentionalBias);
  if (hasConditionedTrigger) matchedMarkers.push(AUTOPILOT01_MARKER_IDS_NL.conditionedTrigger);

  // Also check runtime flags
  const hasAutopilotFlag = input.autopilotLanguageDetected || hasAutopilot;
  const hasTriggerFlag = input.triggerExposureDetected || hasTrigger;
  const hasBias = input.approachBiasLanguageDetected || input.attentionalBiasLanguageDetected ||
    input.conditionedTriggerLanguageDetected || hasApproachBias || hasAttentionalBias || hasConditionedTrigger;
  const cravingContext = input.cravingDetected || input.relapseIntentDetected || input.cravingSliderValue !== null;

  // Activation logic
  if (!cravingContext && !hasAutopilotFlag && !hasTriggerFlag && !hasBias) {
    return {
      moduleId: "AUTOPILOT01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore: 0,
      matchedMarkers,
      responseMode: "APPROACH_BIAS_EXPLANATION",
      routeNext: "NO_MODULE",
      memoryReadRequired: true,
      memoryWriteRequired: false,
      reason: "No craving/trigger/autopilot pattern detected.",
    };
  }

  // Confidence scoring (per spec)
  const confidenceScore =
    hasAutopilotFlag && cravingContext ? 0.95 :
    hasTriggerFlag && input.cravingDetected ? 0.92 :
    hasBias ? 0.88 :
    hasAutopilotFlag ? 0.84 :
    hasTriggerFlag ? 0.80 :
    0.65;

  // Response mode selection (per spec)
  const responseMode =
    hasAutopilotFlag ? "CRAVING_AUTOPILOT_INTERRUPT" as const :
    hasAttentionalBias || input.attentionalBiasLanguageDetected ? "ATTENTIONAL_BIAS_EXPLANATION" as const :
    hasConditionedTrigger || input.conditionedTriggerLanguageDetected ? "CONDITIONED_TRIGGER_EXPLANATION" as const :
    "APPROACH_BIAS_EXPLANATION" as const;

  return {
    moduleId: "AUTOPILOT01",
    activationStatus: "ACTIVE",
    confidenceScore,
    matchedMarkers,
    responseMode,
    routeNext: "AUTOPILOT01",
    memoryReadRequired: true,
    memoryWriteRequired: true,
    reason: "Craving/trigger/autopilot language detected.",
  };
}

function matchesAny(text: string, patterns: string[]): boolean {
  return patterns.some((p) => text.includes(p.toLowerCase()));
}
