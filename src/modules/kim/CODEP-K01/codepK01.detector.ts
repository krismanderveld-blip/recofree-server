/**
 * CODEP-K01 Detector — Codependency pattern recognition
 *
 * Kim-only. Elias blocked. Crisis defers to acute modules.
 * NEVER use the word "codependent" in output. Name patterns without labeling.
 */

import type {
  KimPatternRuntimeInput,
  KimPatternDetectionResult,
  KimConfidenceBand,
  KimPatternActivationStatus,
} from "@/src/types/kimPatternsSupport.types";
import { codepK01MarkersNl } from "./codepK01.markerBank.nl";
import { codepK01MarkersEn } from "./codepK01.markerBank.en";

export type CodepK01InterventionType =
  | "NAMING_IDENTITY_FUSION_WITHOUT_LABEL"
  | "EXPLORING_RESCUE_PATTERN_COST"
  | "BOUNDARY_ABSENCE_GENTLE_NAMING"
  | "SELF_NEGLECT_ACKNOWLEDGMENT"
  | "SMALL_STEP_TOWARD_OWN_NEEDS"
  | "PATTERN_AWARENESS_DEEPENING";

export interface CodepK01DetectionResult extends KimPatternDetectionResult {
  moduleId: "CODEP-K01";
  selectedInterventionType: CodepK01InterventionType;
}

function blocked(status: KimPatternActivationStatus, reason: string): CodepK01DetectionResult {
  return {
    moduleId: "CODEP-K01",
    activationStatus: status,
    confidenceScore: 0,
    confidenceBand: "LOW",
    matchedMarkers: [],
    matchedMarkerGroups: [],
    selectedInterventionType: "NAMING_IDENTITY_FUSION_WITHOUT_LABEL",
    reason,
  };
}

function getBand(score: number): KimConfidenceBand {
  if (score >= 0.85) return "VERY_HIGH";
  if (score >= 0.70) return "HIGH";
  if (score >= 0.55) return "MEDIUM";
  return "LOW";
}

export function detectCodepK01(input: KimPatternRuntimeInput): CodepK01DetectionResult {
  if (input.persona !== "kim") return blocked("BLOCKED_BY_PERSONA", "Elias persona blocked");
  if (!input.intakeCompleted) return blocked("BLOCKED_BY_INTAKE", "Intake not completed");

  if (input.crisisDetected || input.selfHarmOrSuicideDetected)
    return blocked("DEFER_TO_CRISIS_K01", "Crisis detected");
  if (input.acuteDangerDetected)
    return blocked("DEFER_TO_GEVAAR_K01", "Acute danger detected");
  if (input.childDangerDetected)
    return blocked("DEFER_TO_KIND_K01", "Child danger detected");
  if (input.activeRelapseCrisisDetected)
    return blocked("DEFER_TO_HERV_K01", "Active relapse crisis");
  if (input.domesticViolenceOrAbuseDetected)
    return blocked("DEFER_TO_GEVAAR_K01", "Domestic violence detected");

  const msg = input.latestUserMessage.toLowerCase();
  const allMessages = [msg, ...input.recentMessages.map(m => m.toLowerCase())].join(" ");
  const matchedMarkers: string[] = [];
  const matchedGroups: string[] = [];
  let score = 0;

  // NL markers
  for (const marker of codepK01MarkersNl.identityFusion) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("identityFusion")) matchedGroups.push("identityFusion");
      score += 0.35;
      break;
    }
  }
  for (const marker of codepK01MarkersNl.rescueBehavior) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("rescueBehavior")) matchedGroups.push("rescueBehavior");
      score += 0.30;
      break;
    }
  }
  for (const marker of codepK01MarkersNl.boundaryAbsence) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("boundaryAbsence")) matchedGroups.push("boundaryAbsence");
      score += 0.25;
      break;
    }
  }
  for (const marker of codepK01MarkersNl.selfNeglect) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("selfNeglect")) matchedGroups.push("selfNeglect");
      score += 0.20;
      break;
    }
  }

  // EN markers
  for (const marker of codepK01MarkersEn.identityFusion) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("identityFusion")) matchedGroups.push("identityFusion");
      score += 0.35;
      break;
    }
  }
  for (const marker of codepK01MarkersEn.rescueBehavior) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("rescueBehavior")) matchedGroups.push("rescueBehavior");
      score += 0.30;
      break;
    }
  }
  for (const marker of codepK01MarkersEn.boundaryAbsence) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("boundaryAbsence")) matchedGroups.push("boundaryAbsence");
      score += 0.25;
      break;
    }
  }
  for (const marker of codepK01MarkersEn.selfNeglect) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("selfNeglect")) matchedGroups.push("selfNeglect");
      score += 0.20;
      break;
    }
  }

  // Context bonuses
  if (input.currentKimZone === "GROEN" || input.currentKimZone === "GEEL") score += 0.10;
  if (input.stabilizedEnoughForReflection) score += 0.10;
  if (input.existingKimMemoryHints.activeCodepPatternIds.length > 0) score += 0.10;

  score = Math.min(score, 1.0);

  if (score < 0.55) {
    return {
      moduleId: "CODEP-K01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore: score,
      confidenceBand: getBand(score),
      matchedMarkers,
      matchedMarkerGroups: matchedGroups,
      selectedInterventionType: "NAMING_IDENTITY_FUSION_WITHOUT_LABEL",
      reason: "Below activation threshold",
    };
  }

  let interventionType: CodepK01InterventionType;
  if (matchedGroups.includes("identityFusion")) {
    interventionType = "NAMING_IDENTITY_FUSION_WITHOUT_LABEL";
  } else if (matchedGroups.includes("rescueBehavior")) {
    interventionType = "EXPLORING_RESCUE_PATTERN_COST";
  } else if (matchedGroups.includes("boundaryAbsence")) {
    interventionType = "BOUNDARY_ABSENCE_GENTLE_NAMING";
  } else if (matchedGroups.includes("selfNeglect")) {
    interventionType = "SELF_NEGLECT_ACKNOWLEDGMENT";
  } else {
    interventionType = "SMALL_STEP_TOWARD_OWN_NEEDS";
  }

  const status: KimPatternActivationStatus = score >= 0.70 ? "ACTIVE" : "OFFER_AS_FOLLOWUP";

  return {
    moduleId: "CODEP-K01",
    activationStatus: status,
    confidenceScore: score,
    confidenceBand: getBand(score),
    matchedMarkers,
    matchedMarkerGroups: matchedGroups,
    selectedInterventionType: interventionType,
    reason: `CODEP-K01 ${status}: ${matchedGroups.join(", ")}`,
  };
}
