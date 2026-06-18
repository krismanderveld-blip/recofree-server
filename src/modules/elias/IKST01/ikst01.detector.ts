/**
 * IKST01 - Ik-sterkte herstel Detector
 * Detects impulsive/emotion-led action patterns.
 */
import type {
  EliasSelfAcceptanceRuntimeInput,
  EliasSelfAcceptanceDetectionResult,
  EliasConfidenceBand,
  EliasSelfAcceptanceActivationStatus,
} from "../../../types/eliasSelfAcceptanceCluster.types";
import { ikst01MarkersNL } from "./ikst01.markerBank.nl";
import { ikst01MarkersEN } from "./ikst01.markerBank.en";

export type Ikst01PatternType =
  | "impulsive_decision"
  | "emotion_led_action"
  | "control_reaction"
  | "message_from_panic"
  | "unknown";

export type Ikst01InterventionType =
  | "NAME_FEELING_NOT_ORDER"
  | "REALITY_TESTING"
  | "BUILDABLE_EGO_STRENGTH"
  | "ONE_DELAYED_DECISION"
  | "BRIDGE_TO_IDEN01"
  | "BRIDGE_TO_STO01";

export interface Ikst01DetectionResult extends EliasSelfAcceptanceDetectionResult {
  moduleId: "IKST01";
  patternType: Ikst01PatternType;
  selectedInterventionType: Ikst01InterventionType;
}

function getConfidenceBand(score: number): EliasConfidenceBand {
  if (score >= 0.85) return "VERY_HIGH";
  if (score >= 0.70) return "HIGH";
  if (score >= 0.50) return "MEDIUM";
  return "LOW";
}

export function detectIkst01(input: EliasSelfAcceptanceRuntimeInput): Ikst01DetectionResult {
  if (input.persona !== "elias") {
    return blocked("BLOCKED_BY_PERSONA", "IKST01 is Elias-only.", "unknown");
  }
  if (!input.intakeCompleted) {
    return blocked("BLOCKED_BY_INTAKE", "Intake not completed.", "unknown");
  }
  if (
    input.crisisDetected ||
    input.suicideSelfHarmDetected ||
    input.acuteDangerDetected ||
    input.relapseIntentDetected ||
    input.severeIntoxicationDetected ||
    input.medicalEmergencyDetected
  ) {
    return blocked("BLOCKED_BY_CRISIS", "Crisis override active.", "unknown");
  }
  if (input.currentZone === "PAARS") {
    return blocked("BLOCKED_BY_CRISIS", "Zone PAARS blocks reflective modules.", "unknown");
  }
  if (input.currentZone === "ROOD" && !input.stabilizedEnoughForReflection) {
    return blocked("DEFER_TO_SAFETY", "Zone ROOD without stabilization.", "unknown");
  }

  const msg = input.latestUserMessage.toLowerCase();
  const allMessages = [msg, ...input.recentMessages.map((m) => m.toLowerCase())].join(" ");
  const matchedMarkers: string[] = [];
  const matchedGroups: string[] = [];
  let score = 0;
  let primaryPattern: Ikst01PatternType = "unknown";

  // Impulsive decision
  const impMarkers = [...ikst01MarkersNL.impulsiveDecision, ...ikst01MarkersEN.impulsiveDecision];
  for (const marker of impMarkers) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("impulsiveDecision")) matchedGroups.push("impulsiveDecision");
    }
  }
  if (matchedGroups.includes("impulsiveDecision")) {
    score += 0.30;
    primaryPattern = "impulsive_decision";
  }

  // Emotion-led action
  const emoMarkers = [...ikst01MarkersNL.emotionLedAction, ...ikst01MarkersEN.emotionLedAction];
  for (const marker of emoMarkers) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("emotionLedAction")) matchedGroups.push("emotionLedAction");
    }
  }
  if (matchedGroups.includes("emotionLedAction")) {
    score += 0.30;
    if (primaryPattern === "unknown") primaryPattern = "emotion_led_action";
  }

  // Control reaction
  const ctrlMarkers = [...ikst01MarkersNL.controlReaction, ...ikst01MarkersEN.controlReaction];
  for (const marker of ctrlMarkers) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("controlReaction")) matchedGroups.push("controlReaction");
    }
  }
  if (matchedGroups.includes("controlReaction")) {
    score += 0.25;
    if (primaryPattern === "unknown") primaryPattern = "control_reaction";
  }

  // Regret bonus
  if (/spijt|berouw|regret|had niet moeten/i.test(allMessages)) {
    score += 0.15;
  }

  // Stable enough for reflection bonus
  if (input.stabilizedEnoughForReflection) {
    score += 0.10;
  }

  // Recent logs show impulsive pattern
  if (input.existingEliasMemoryHints.recentSafeLogSummaries.some((s) => /impuls|IKST01|ego.strength/i.test(s))) {
    score += 0.15;
  }

  score = Math.min(score, 1.0);

  if (score < 0.55) {
    return {
      moduleId: "IKST01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore: score,
      confidenceBand: getConfidenceBand(score),
      matchedMarkers,
      matchedMarkerGroups: matchedGroups,
      selectedInterventionType: "NAME_FEELING_NOT_ORDER",
      patternType: primaryPattern,
      recommendedBridgeModules: [],
      reason: "Below threshold.",
    };
  }

  // Determine bridges
  const bridges: Array<"PAAL01" | "ROUW01" | "IDEN01" | "STO01"> = [];
  if (/wie ben ik|who am i|identiteit|identity/i.test(allMessages)) bridges.push("IDEN01");
  if (/controle|control/i.test(allMessages) && matchedGroups.includes("controlReaction")) bridges.push("STO01");

  // Select intervention
  let intervention: Ikst01InterventionType = "NAME_FEELING_NOT_ORDER";
  if (primaryPattern === "control_reaction") intervention = "ONE_DELAYED_DECISION";
  else if (primaryPattern === "emotion_led_action") intervention = "REALITY_TESTING";
  else if (primaryPattern === "impulsive_decision") intervention = "BUILDABLE_EGO_STRENGTH";
  if (bridges.includes("STO01")) intervention = "BRIDGE_TO_STO01";
  if (bridges.includes("IDEN01")) intervention = "BRIDGE_TO_IDEN01";

  const status: EliasSelfAcceptanceActivationStatus = score >= 0.65 ? "ACTIVE" : "NOT_ACTIVE";

  return {
    moduleId: "IKST01",
    activationStatus: status,
    confidenceScore: score,
    confidenceBand: getConfidenceBand(score),
    matchedMarkers,
    matchedMarkerGroups: matchedGroups,
    selectedInterventionType: intervention,
    patternType: primaryPattern,
    recommendedBridgeModules: bridges,
    reason: status === "ACTIVE" ? "Impulsive/emotion-led action pattern detected." : "Below activation threshold.",
  };
}

function blocked(status: EliasSelfAcceptanceActivationStatus, reason: string, pattern: Ikst01PatternType): Ikst01DetectionResult {
  return {
    moduleId: "IKST01",
    activationStatus: status,
    confidenceScore: 0,
    confidenceBand: "LOW",
    matchedMarkers: [],
    matchedMarkerGroups: [],
    selectedInterventionType: "NAME_FEELING_NOT_ORDER",
    patternType: pattern,
    recommendedBridgeModules: [],
    reason,
  };
}
