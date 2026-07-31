/**
 * COEX01 - Co-existentie verantwoordelijkheid Detector
 * Detects blame/responsibility confusion patterns.
 */
import type {
  EliasSelfAcceptanceRuntimeInput,
  EliasSelfAcceptanceDetectionResult,
  EliasConfidenceBand,
  EliasSelfAcceptanceActivationStatus,
} from "../../../../types/eliasSelfAcceptanceCluster.types";
import { coex01MarkersNL } from "./coex01.markerBank.nl";
import { coex01MarkersEN } from "./coex01.markerBank.en";

export type Coex01PatternType =
  | "external_blame"
  | "total_self_blame"
  | "responsibility_confusion"
  | "cynicism"
  | "unknown";

export type Coex01InterventionType =
  | "SEPARATE_FAULT_FROM_RESPONSIBILITY"
  | "VALIDATE_INJUSTICE_WITHOUT_REMOVING_AGENCY"
  | "ONE_NEXT_STEP_NOT_ALL_STEPS"
  | "BOTH_TRUE_BRIDGE"
  | "BRIDGE_TO_ROL01"
  | "BRIDGE_TO_GEZIN01";

export interface Coex01DetectionResult extends EliasSelfAcceptanceDetectionResult {
  moduleId: "COEX01";
  patternType: Coex01PatternType;
  selectedInterventionType: Coex01InterventionType;
}

function getConfidenceBand(score: number): EliasConfidenceBand {
  if (score >= 0.85) return "VERY_HIGH";
  if (score >= 0.70) return "HIGH";
  if (score >= 0.50) return "MEDIUM";
  return "LOW";
}

export function detectCoex01(input: EliasSelfAcceptanceRuntimeInput): Coex01DetectionResult {
  if (input.persona !== "elias") {
    return blocked("BLOCKED_BY_PERSONA", "COEX01 is Elias-only.", "unknown");
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
  let primaryPattern: Coex01PatternType = "unknown";

  // External blame
  const extMarkers = [...coex01MarkersNL.externalBlame, ...coex01MarkersEN.externalBlame];
  for (const marker of extMarkers) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("externalBlame")) matchedGroups.push("externalBlame");
    }
  }
  if (matchedGroups.includes("externalBlame")) {
    score += 0.30;
    primaryPattern = "external_blame";
  }

  // Total self-blame
  const selfMarkers = [...coex01MarkersNL.totalSelfBlame, ...coex01MarkersEN.totalSelfBlame];
  for (const marker of selfMarkers) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("totalSelfBlame")) matchedGroups.push("totalSelfBlame");
    }
  }
  if (matchedGroups.includes("totalSelfBlame")) {
    score += 0.30;
    if (primaryPattern === "unknown") primaryPattern = "total_self_blame";
  }

  // Responsibility confusion
  const confMarkers = [...coex01MarkersNL.responsibilityConfusion, ...coex01MarkersEN.responsibilityConfusion];
  for (const marker of confMarkers) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("responsibilityConfusion")) matchedGroups.push("responsibilityConfusion");
    }
  }
  if (matchedGroups.includes("responsibilityConfusion")) {
    score += 0.35;
    if (primaryPattern === "unknown") primaryPattern = "responsibility_confusion";
  }

  // Cynicism
  const cynMarkers = [...coex01MarkersNL.cynicism, ...coex01MarkersEN.cynicism];
  for (const marker of cynMarkers) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("cynicism")) matchedGroups.push("cynicism");
    }
  }
  if (matchedGroups.includes("cynicism")) {
    score += 0.20;
    if (primaryPattern === "unknown") primaryPattern = "cynicism";
  }

  // Both blame patterns present = responsibility confusion
  if (matchedGroups.includes("externalBlame") && matchedGroups.includes("totalSelfBlame")) {
    primaryPattern = "responsibility_confusion";
    score += 0.15;
  }

  // Recent logs show blame/responsibility pattern
  if (input.existingEliasMemoryHints.recentSafeLogSummaries.some((s) => /blame|schuld|COEX01|verantwoord/i.test(s))) {
    score += 0.10;
  }

  score = Math.min(score, 1.0);

  if (score < 0.55) {
    return {
      moduleId: "COEX01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore: score,
      confidenceBand: getConfidenceBand(score),
      matchedMarkers,
      matchedMarkerGroups: matchedGroups,
      selectedInterventionType: "SEPARATE_FAULT_FROM_RESPONSIBILITY",
      patternType: primaryPattern,
      recommendedBridgeModules: [],
      reason: "Below threshold.",
    };
  }

  // Determine bridges
  const bridges: Array<"PAAL01" | "ROUW01" | "IDEN01" | "STO01"> = [];
  if (/gezin|familie|family|ouders|parents/i.test(allMessages)) bridges.push("ROUW01"); // GEZIN01 not in bridge type
  if (/rol|role|functie|position/i.test(allMessages)) bridges.push("IDEN01"); // ROL01 not in bridge type

  // Select intervention
  let intervention: Coex01InterventionType = "SEPARATE_FAULT_FROM_RESPONSIBILITY";
  if (primaryPattern === "external_blame") intervention = "VALIDATE_INJUSTICE_WITHOUT_REMOVING_AGENCY";
  else if (primaryPattern === "total_self_blame") intervention = "SEPARATE_FAULT_FROM_RESPONSIBILITY";
  else if (primaryPattern === "responsibility_confusion") intervention = "BOTH_TRUE_BRIDGE";
  else if (primaryPattern === "cynicism") intervention = "ONE_NEXT_STEP_NOT_ALL_STEPS";

  const status: EliasSelfAcceptanceActivationStatus = score >= 0.65 ? "ACTIVE" : "NOT_ACTIVE";

  return {
    moduleId: "COEX01",
    activationStatus: status,
    confidenceScore: score,
    confidenceBand: getConfidenceBand(score),
    matchedMarkers,
    matchedMarkerGroups: matchedGroups,
    selectedInterventionType: intervention,
    patternType: primaryPattern,
    recommendedBridgeModules: bridges,
    reason: status === "ACTIVE" ? "Blame/responsibility confusion pattern detected." : "Below activation threshold.",
  };
}

function blocked(status: EliasSelfAcceptanceActivationStatus, reason: string, pattern: Coex01PatternType): Coex01DetectionResult {
  return {
    moduleId: "COEX01",
    activationStatus: status,
    confidenceScore: 0,
    confidenceBand: "LOW",
    matchedMarkers: [],
    matchedMarkerGroups: [],
    selectedInterventionType: "SEPARATE_FAULT_FROM_RESPONSIBILITY",
    patternType: pattern,
    recommendedBridgeModules: [],
    reason,
  };
}
