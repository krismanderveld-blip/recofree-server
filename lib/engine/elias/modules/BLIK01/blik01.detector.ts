/**
 * BLIK01 - Blikseminslag Detector
 * Detects sudden shock/loss to a concrete support pillar.
 */
import type {
  EliasSelfAcceptanceRuntimeInput,
  EliasSelfAcceptanceDetectionResult,
  EliasConfidenceBand,
  EliasSelfAcceptanceActivationStatus,
} from "../../../../types/eliasSelfAcceptanceCluster.types";
import { blik01MarkersNL } from "./blik01.markerBank.nl";
import { blik01MarkersEN } from "./blik01.markerBank.en";

export type Blik01InterventionType =
  | "NAME_PILLAR_SHOCK"
  | "SEPARATE_PILLAR_FROM_SELF"
  | "ONE_STABILIZING_ACTION"
  | "BRIDGE_TO_PAAL01"
  | "BRIDGE_TO_ROUW01";

export interface Blik01DetectionResult extends EliasSelfAcceptanceDetectionResult {
  moduleId: "BLIK01";
  selectedInterventionType: Blik01InterventionType;
  affectedPillarLabel: string | null;
  affectedKnownPillarId: string | null;
}

function getConfidenceBand(score: number): EliasConfidenceBand {
  if (score >= 0.85) return "VERY_HIGH";
  if (score >= 0.70) return "HIGH";
  if (score >= 0.50) return "MEDIUM";
  return "LOW";
}

export function detectBlik01(input: EliasSelfAcceptanceRuntimeInput): Blik01DetectionResult {
  // Persona guard
  if (input.persona !== "elias") {
    return blocked("BLOCKED_BY_PERSONA", "BLIK01 is Elias-only.");
  }

  // Intake guard
  if (!input.intakeCompleted) {
    return blocked("BLOCKED_BY_INTAKE", "Intake not completed.");
  }

  // Crisis override
  if (
    input.crisisDetected ||
    input.suicideSelfHarmDetected ||
    input.acuteDangerDetected ||
    input.relapseIntentDetected ||
    input.severeIntoxicationDetected ||
    input.medicalEmergencyDetected
  ) {
    return blocked("BLOCKED_BY_CRISIS", "Crisis override active.");
  }

  // Zone check
  if (input.currentZone === "PAARS") {
    return blocked("BLOCKED_BY_CRISIS", "Zone PAARS blocks reflective modules.");
  }
  if (input.currentZone === "ROOD" && !input.stabilizedEnoughForReflection) {
    return blocked("DEFER_TO_SAFETY", "Zone ROOD without stabilization.");
  }

  // Marker matching
  const msg = input.latestUserMessage.toLowerCase();
  const allMessages = [msg, ...input.recentMessages.map((m) => m.toLowerCase())].join(" ");
  const matchedMarkers: string[] = [];
  const matchedGroups: string[] = [];
  let score = 0;

  // NL sudden shock
  for (const marker of blik01MarkersNL.suddenShock) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("suddenShock_nl")) matchedGroups.push("suddenShock_nl");
    }
  }
  // EN sudden shock
  for (const marker of blik01MarkersEN.suddenShock) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("suddenShock_en")) matchedGroups.push("suddenShock_en");
    }
  }
  if (matchedGroups.some((g) => g.startsWith("suddenShock"))) score += 0.25;

  // NL specific pillar loss
  for (const marker of blik01MarkersNL.specificPillarLoss) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("specificPillarLoss_nl")) matchedGroups.push("specificPillarLoss_nl");
    }
  }
  // EN specific pillar loss
  for (const marker of blik01MarkersEN.specificPillarLoss) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("specificPillarLoss_en")) matchedGroups.push("specificPillarLoss_en");
    }
  }
  if (matchedGroups.some((g) => g.startsWith("specificPillarLoss"))) score += 0.35;

  // Support/anchor language
  const anchorMarkers = [...blik01MarkersNL.supportAnchorLanguage, ...blik01MarkersEN.supportAnchorLanguage];
  for (const marker of anchorMarkers) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("supportAnchor")) matchedGroups.push("supportAnchor");
    }
  }
  if (matchedGroups.includes("supportAnchor")) score += 0.15;

  // PAAL01 known pillar match
  let affectedKnownPillarId: string | null = null;
  let affectedPillarLabel: string | null = null;
  if (input.paal01Available && input.paal01KnownSupportPillars.length > 0) {
    for (const pillar of input.paal01KnownSupportPillars) {
      if (allMessages.includes(pillar.label.toLowerCase())) {
        affectedKnownPillarId = pillar.pillarId;
        affectedPillarLabel = pillar.label;
        score += 0.20;
        matchedGroups.push("paal01KnownPillar");
        break;
      }
    }
  }

  // Recent logs show pillar importance
  if (input.existingEliasMemoryHints.recentSafeLogSummaries.some((s) => /pillar|steunpilaar|PAAL01|BLIK01/i.test(s))) {
    score += 0.10;
  }

  // Extract pillar label from text if not from PAAL01
  if (!affectedPillarLabel && matchedGroups.some((g) => g.startsWith("specificPillarLoss"))) {
    // Use first matched specific pillar marker as label
    const pillarMarkers = [...blik01MarkersNL.specificPillarLoss, ...blik01MarkersEN.specificPillarLoss];
    for (const m of pillarMarkers) {
      if (allMessages.includes(m.toLowerCase())) {
        affectedPillarLabel = m;
        break;
      }
    }
  }

  // Cap score at 1.0
  score = Math.min(score, 1.0);

  // Determine activation
  if (score < 0.55) {
    return {
      moduleId: "BLIK01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore: score,
      confidenceBand: getConfidenceBand(score),
      matchedMarkers,
      matchedMarkerGroups: matchedGroups,
      selectedInterventionType: "NAME_PILLAR_SHOCK",
      recommendedBridgeModules: [],
      reason: "Confidence below threshold.",
      affectedPillarLabel,
      affectedKnownPillarId,
    };
  }

  // Determine bridges
  const bridges: Array<"PAAL01" | "ROUW01" | "IDEN01" | "STO01"> = [];
  const griefMarkers = ["overleden", "verloren", "died", "lost someone", "dood", "death"];
  const hasGrief = griefMarkers.some((g) => allMessages.includes(g));
  if (hasGrief) bridges.push("ROUW01");
  if (input.paal01Available) bridges.push("PAAL01");

  // Select intervention type
  let interventionType: Blik01InterventionType = "NAME_PILLAR_SHOCK";
  if (hasGrief && score >= 0.65) {
    interventionType = "BRIDGE_TO_ROUW01";
  } else if (score >= 0.65 && matchedGroups.some((g) => g.startsWith("specificPillarLoss"))) {
    interventionType = "SEPARATE_PILLAR_FROM_SELF";
  }

  const status: EliasSelfAcceptanceActivationStatus = score >= 0.65 ? "ACTIVE" : "NOT_ACTIVE";

  return {
    moduleId: "BLIK01",
    activationStatus: status,
    confidenceScore: score,
    confidenceBand: getConfidenceBand(score),
    matchedMarkers,
    matchedMarkerGroups: matchedGroups,
    selectedInterventionType: interventionType,
    recommendedBridgeModules: bridges,
    reason: status === "ACTIVE" ? "Sudden support pillar shock detected." : "Below activation threshold.",
    affectedPillarLabel,
    affectedKnownPillarId,
  };
}

function blocked(status: EliasSelfAcceptanceActivationStatus, reason: string): Blik01DetectionResult {
  return {
    moduleId: "BLIK01",
    activationStatus: status,
    confidenceScore: 0,
    confidenceBand: "LOW",
    matchedMarkers: [],
    matchedMarkerGroups: [],
    selectedInterventionType: "NAME_PILLAR_SHOCK",
    recommendedBridgeModules: [],
    reason,
    affectedPillarLabel: null,
    affectedKnownPillarId: null,
  };
}
