/**
 * ONTK01 - Ontkenningspatroon Detector
 * Detects minimization, normalization, control claims, and bargaining around own use.
 */
import type {
  EliasSelfAcceptanceRuntimeInput,
  EliasSelfAcceptanceDetectionResult,
  EliasConfidenceBand,
  EliasSelfAcceptanceActivationStatus,
} from "../../../types/eliasSelfAcceptanceCluster.types";
import { ontk01MarkersNL } from "./ontk01.markerBank.nl";
import { ontk01MarkersEN } from "./ontk01.markerBank.en";

export type Ontk01PatternType =
  | "minimization"
  | "normalization"
  | "control_claim"
  | "comparison_down"
  | "one_time_exception"
  | "bargaining"
  | "consequence_dismissal"
  | "unknown";

export type Ontk01InterventionType =
  | "GENTLE_MIRROR"
  | "PERMISSION_SENTENCE_CHECK"
  | "FACT_WITHOUT_SHAME"
  | "CONTROL_CLAIM_EXPLORE"
  | "CONSEQUENCE_RECONNECT"
  | "BRIDGE_TO_MI";

export interface Ontk01DetectionResult extends EliasSelfAcceptanceDetectionResult {
  moduleId: "ONTK01";
  patternType: Ontk01PatternType;
  selectedInterventionType: Ontk01InterventionType;
}

function getConfidenceBand(score: number): EliasConfidenceBand {
  if (score >= 0.85) return "VERY_HIGH";
  if (score >= 0.70) return "HIGH";
  if (score >= 0.50) return "MEDIUM";
  return "LOW";
}

export function detectOntk01(input: EliasSelfAcceptanceRuntimeInput): Ontk01DetectionResult {
  if (input.persona !== "elias") {
    return blocked("BLOCKED_BY_PERSONA", "ONTK01 is Elias-only.", "unknown");
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
  let primaryPattern: Ontk01PatternType = "unknown";

  // Minimization
  const minMarkers = [...ontk01MarkersNL.minimization, ...ontk01MarkersEN.minimization];
  for (const marker of minMarkers) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("minimization")) matchedGroups.push("minimization");
    }
  }
  if (matchedGroups.includes("minimization")) {
    score += 0.35;
    primaryPattern = "minimization";
  }

  // Normalization
  const normMarkers = [...ontk01MarkersNL.normalization, ...ontk01MarkersEN.normalization];
  for (const marker of normMarkers) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("normalization")) matchedGroups.push("normalization");
    }
  }
  if (matchedGroups.includes("normalization")) {
    score += 0.25;
    if (primaryPattern === "unknown") primaryPattern = "normalization";
  }

  // Control claim
  const ctrlMarkers = [...ontk01MarkersNL.controlClaim, ...ontk01MarkersEN.controlClaim];
  for (const marker of ctrlMarkers) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("controlClaim")) matchedGroups.push("controlClaim");
    }
  }
  if (matchedGroups.includes("controlClaim")) {
    score += 0.30;
    if (primaryPattern === "unknown") primaryPattern = "control_claim";
  }

  // Bargaining
  const bargMarkers = [...ontk01MarkersNL.bargaining, ...ontk01MarkersEN.bargaining];
  for (const marker of bargMarkers) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("bargaining")) matchedGroups.push("bargaining");
    }
  }
  if (matchedGroups.includes("bargaining")) {
    score += 0.35;
    if (primaryPattern === "unknown") primaryPattern = "bargaining";
  }

  // Recent relapse/use log bonus
  if (input.existingEliasMemoryHints.recentSafeLogSummaries.some((s) => /relapse|herval|gebruik/i.test(s))) {
    score += 0.15;
  }

  score = Math.min(score, 1.0);

  if (score < 0.50) {
    return {
      moduleId: "ONTK01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore: score,
      confidenceBand: getConfidenceBand(score),
      matchedMarkers,
      matchedMarkerGroups: matchedGroups,
      selectedInterventionType: "GENTLE_MIRROR",
      patternType: primaryPattern,
      recommendedBridgeModules: [],
      reason: "Below threshold.",
    };
  }

  // Select intervention
  let intervention: Ontk01InterventionType = "GENTLE_MIRROR";
  if (primaryPattern === "control_claim") intervention = "CONTROL_CLAIM_EXPLORE";
  else if (primaryPattern === "bargaining") intervention = "PERMISSION_SENTENCE_CHECK";
  else if (primaryPattern === "minimization") intervention = "FACT_WITHOUT_SHAME";

  const status: EliasSelfAcceptanceActivationStatus = score >= 0.65 ? "ACTIVE" : "NOT_ACTIVE";

  return {
    moduleId: "ONTK01",
    activationStatus: status,
    confidenceScore: score,
    confidenceBand: getConfidenceBand(score),
    matchedMarkers,
    matchedMarkerGroups: matchedGroups,
    selectedInterventionType: intervention,
    patternType: primaryPattern,
    recommendedBridgeModules: [],
    reason: status === "ACTIVE" ? "Minimization/rationalization pattern detected." : "Below activation threshold.",
  };
}

function blocked(status: EliasSelfAcceptanceActivationStatus, reason: string, pattern: Ontk01PatternType): Ontk01DetectionResult {
  return {
    moduleId: "ONTK01",
    activationStatus: status,
    confidenceScore: 0,
    confidenceBand: "LOW",
    matchedMarkers: [],
    matchedMarkerGroups: [],
    selectedInterventionType: "GENTLE_MIRROR",
    patternType: pattern,
    recommendedBridgeModules: [],
    reason,
  };
}
