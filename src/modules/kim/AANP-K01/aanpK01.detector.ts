/**
 * AANP-K01 Detector — Caregiver adaptation/covering-up patterns
 *
 * Kim-only. Elias blocked. Crisis defers to acute modules.
 */

import type {
  KimPatternRuntimeInput,
  KimPatternDetectionResult,
  KimConfidenceBand,
  KimPatternActivationStatus,
} from "@/src/types/kimPatternsSupport.types";
import { aanpK01MarkersNl } from "./aanpK01.markerBank.nl";
import { aanpK01MarkersEn } from "./aanpK01.markerBank.en";

export type AanpK01InterventionType =
  | "NAMING_COVERING_UP_PATTERN"
  | "EXPLORING_SELF_ERASURE_COST"
  | "KEEPING_UP_APPEARANCES_REFLECTION"
  | "WHAT_ADAPTING_COSTS_KIM"
  | "SMALL_STEP_TOWARD_AUTHENTICITY"
  | "PATTERN_AWARENESS_WITHOUT_PUSH";

export interface AanpK01DetectionResult extends KimPatternDetectionResult {
  moduleId: "AANP-K01";
  selectedInterventionType: AanpK01InterventionType;
}

function blocked(status: KimPatternActivationStatus, reason: string): AanpK01DetectionResult {
  return {
    moduleId: "AANP-K01",
    activationStatus: status,
    confidenceScore: 0,
    confidenceBand: "LOW",
    matchedMarkers: [],
    matchedMarkerGroups: [],
    selectedInterventionType: "NAMING_COVERING_UP_PATTERN",
    reason,
  };
}

function getBand(score: number): KimConfidenceBand {
  if (score >= 0.85) return "VERY_HIGH";
  if (score >= 0.70) return "HIGH";
  if (score >= 0.55) return "MEDIUM";
  return "LOW";
}

export function detectAanpK01(input: KimPatternRuntimeInput): AanpK01DetectionResult {
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
  for (const marker of aanpK01MarkersNl.coveringUp) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("coveringUp")) matchedGroups.push("coveringUp");
      score += 0.35;
      break;
    }
  }
  for (const marker of aanpK01MarkersNl.selfErasure) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("selfErasure")) matchedGroups.push("selfErasure");
      score += 0.30;
      break;
    }
  }
  for (const marker of aanpK01MarkersNl.keepingUpAppearances) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("keepingUpAppearances")) matchedGroups.push("keepingUpAppearances");
      score += 0.25;
      break;
    }
  }
  for (const marker of aanpK01MarkersNl.awarenessOfCost) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("awarenessOfCost")) matchedGroups.push("awarenessOfCost");
      score += 0.20;
      break;
    }
  }

  // EN markers
  for (const marker of aanpK01MarkersEn.coveringUp) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("coveringUp")) matchedGroups.push("coveringUp");
      score += 0.35;
      break;
    }
  }
  for (const marker of aanpK01MarkersEn.selfErasure) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("selfErasure")) matchedGroups.push("selfErasure");
      score += 0.30;
      break;
    }
  }
  for (const marker of aanpK01MarkersEn.keepingUpAppearances) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("keepingUpAppearances")) matchedGroups.push("keepingUpAppearances");
      score += 0.25;
      break;
    }
  }
  for (const marker of aanpK01MarkersEn.awarenessOfCost) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("awarenessOfCost")) matchedGroups.push("awarenessOfCost");
      score += 0.20;
      break;
    }
  }

  // Context bonuses
  if (input.currentKimZone === "GROEN" || input.currentKimZone === "GEEL") score += 0.10;
  if (input.stabilizedEnoughForReflection) score += 0.10;
  if (input.existingKimMemoryHints.activeAdaptationPatternIds.length > 0) score += 0.10;

  score = Math.min(score, 1.0);

  if (score < 0.55) {
    return {
      moduleId: "AANP-K01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore: score,
      confidenceBand: getBand(score),
      matchedMarkers,
      matchedMarkerGroups: matchedGroups,
      selectedInterventionType: "NAMING_COVERING_UP_PATTERN",
      reason: "Below activation threshold",
    };
  }

  let interventionType: AanpK01InterventionType;
  if (matchedGroups.includes("coveringUp") && matchedGroups.includes("awarenessOfCost")) {
    interventionType = "WHAT_ADAPTING_COSTS_KIM";
  } else if (matchedGroups.includes("selfErasure")) {
    interventionType = "EXPLORING_SELF_ERASURE_COST";
  } else if (matchedGroups.includes("keepingUpAppearances")) {
    interventionType = "KEEPING_UP_APPEARANCES_REFLECTION";
  } else if (matchedGroups.includes("coveringUp")) {
    interventionType = "NAMING_COVERING_UP_PATTERN";
  } else if (matchedGroups.includes("awarenessOfCost")) {
    interventionType = "PATTERN_AWARENESS_WITHOUT_PUSH";
  } else {
    interventionType = "SMALL_STEP_TOWARD_AUTHENTICITY";
  }

  const status: KimPatternActivationStatus = score >= 0.70 ? "ACTIVE" : "OFFER_AS_FOLLOWUP";

  return {
    moduleId: "AANP-K01",
    activationStatus: status,
    confidenceScore: score,
    confidenceBand: getBand(score),
    matchedMarkers,
    matchedMarkerGroups: matchedGroups,
    selectedInterventionType: interventionType,
    reason: `AANP-K01 ${status}: ${matchedGroups.join(", ")}`,
  };
}
