/**
 * PAAL-K01 Detector — Kim's own support pillars
 *
 * Kim-only. Elias blocked. Crisis defers to acute modules.
 */

import type {
  KimPatternRuntimeInput,
  KimPatternDetectionResult,
  KimConfidenceBand,
  KimPatternActivationStatus,
} from "@/lib/types/kimPatternsSupport.types";
import { paalK01MarkersNl } from "./paalK01.markerBank.nl";
import { paalK01MarkersEn } from "./paalK01.markerBank.en";

export type PaalK01InterventionType =
  | "INTRODUCE_KIM_SUPPORT_PILLARS"
  | "INVENTORY_KIM_PEOPLE_ROUTINES_PLACES_BELIEFS"
  | "REMEMBER_KIM_EXISTING_PILLARS"
  | "POST_DIFFICULT_MOMENT_RECONNECT"
  | "KIM_BALANCE_BAR_INTRODUCTION"
  | "QUALITATIVE_KIM_DRAAGLAST_DRAAGKRACHT_REFLECTION"
  | "ADD_ONE_SMALL_KIM_PILLAR";

export interface PaalK01DetectionResult extends KimPatternDetectionResult {
  moduleId: "PAAL-K01";
  selectedInterventionType: PaalK01InterventionType;
  shouldIntroduceKimBalanceFeature: boolean;
}

function blocked(status: KimPatternActivationStatus, reason: string): PaalK01DetectionResult {
  return {
    moduleId: "PAAL-K01",
    activationStatus: status,
    confidenceScore: 0,
    confidenceBand: "LOW",
    matchedMarkers: [],
    matchedMarkerGroups: [],
    selectedInterventionType: "INTRODUCE_KIM_SUPPORT_PILLARS",
    shouldIntroduceKimBalanceFeature: false,
    reason,
  };
}

function getBand(score: number): KimConfidenceBand {
  if (score >= 0.85) return "VERY_HIGH";
  if (score >= 0.70) return "HIGH";
  if (score >= 0.55) return "MEDIUM";
  return "LOW";
}

export function detectPaalK01(input: KimPatternRuntimeInput): PaalK01DetectionResult {
  // Hard blocks
  if (input.persona !== "kim") return blocked("BLOCKED_BY_PERSONA", "Elias persona blocked");
  if (!input.intakeCompleted) return blocked("BLOCKED_BY_INTAKE", "Intake not completed");

  // Crisis deferrals
  if (input.crisisDetected || input.selfHarmOrSuicideDetected)
    return blocked("DEFER_TO_CRISIS_K01", "Crisis detected");
  if (input.acuteDangerDetected)
    return blocked("DEFER_TO_GEVAAR_K01", "Acute danger detected");
  if (input.childDangerDetected)
    return blocked("DEFER_TO_KIND_K01", "Child danger detected");
  if (input.activeRelapseCrisisDetected)
    return blocked("DEFER_TO_HERV_K01", "Active relapse crisis");
  if (input.caregiverOverwhelmed && !input.stabilizedEnoughForReflection)
    return blocked("DEFER_TO_K06", "Caregiver overwhelmed, not stabilized");

  // Marker matching
  const msg = input.latestUserMessage.toLowerCase();
  const allMessages = [msg, ...input.recentMessages.map(m => m.toLowerCase())].join(" ");
  const matchedMarkers: string[] = [];
  const matchedGroups: string[] = [];

  let score = 0;

  // NL markers
  for (const marker of paalK01MarkersNl.supportPillar) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("supportPillar")) matchedGroups.push("supportPillar");
      score += 0.35;
      break;
    }
  }
  for (const marker of paalK01MarkersNl.balanceBar) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("balanceBar")) matchedGroups.push("balanceBar");
      score += 0.30;
      break;
    }
  }
  for (const marker of paalK01MarkersNl.caregiverSelf) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("caregiverSelf")) matchedGroups.push("caregiverSelf");
      score += 0.25;
      break;
    }
  }

  // EN markers
  for (const marker of paalK01MarkersEn.supportPillar) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("supportPillar")) matchedGroups.push("supportPillar");
      score += 0.35;
      break;
    }
  }
  for (const marker of paalK01MarkersEn.balanceBar) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("balanceBar")) matchedGroups.push("balanceBar");
      score += 0.30;
      break;
    }
  }
  for (const marker of paalK01MarkersEn.caregiverSelf) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("caregiverSelf")) matchedGroups.push("caregiverSelf");
      score += 0.25;
      break;
    }
  }

  // Context bonuses
  if (input.currentKimZone === "GROEN" || input.currentKimZone === "GEEL") score += 0.10;
  if (input.stabilizedEnoughForReflection && input.currentKimZone === "ORANJE") score += 0.20;
  if (input.existingKimMemoryHints.moduleUsageCount["PAAL-K01"] > 0) score += 0.10;
  if (input.existingKimMemoryHints.knownSupportPillars.length === 0 && input.stabilizedEnoughForReflection) score += 0.15;

  score = Math.min(score, 1.0);

  if (score < 0.55) {
    return {
      moduleId: "PAAL-K01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore: score,
      confidenceBand: getBand(score),
      matchedMarkers,
      matchedMarkerGroups: matchedGroups,
      selectedInterventionType: "INTRODUCE_KIM_SUPPORT_PILLARS",
      shouldIntroduceKimBalanceFeature: false,
      reason: "Below activation threshold",
    };
  }

  // Select intervention type
  const shouldIntroduceBalance =
    matchedGroups.includes("balanceBar") &&
    input.existingKimMemoryHints.moduleUsageCount["PAAL-K01"] === 0;

  let interventionType: PaalK01InterventionType;
  if (input.existingKimMemoryHints.moduleUsageCount["PAAL-K01"] === 0) {
    interventionType = shouldIntroduceBalance
      ? "KIM_BALANCE_BAR_INTRODUCTION"
      : "INTRODUCE_KIM_SUPPORT_PILLARS";
  } else if (matchedGroups.includes("balanceBar")) {
    interventionType = "QUALITATIVE_KIM_DRAAGLAST_DRAAGKRACHT_REFLECTION";
  } else if (input.stabilizedEnoughForReflection && input.currentKimZone === "ORANJE") {
    interventionType = "POST_DIFFICULT_MOMENT_RECONNECT";
  } else if (input.existingKimMemoryHints.knownSupportPillars.length > 0) {
    interventionType = "REMEMBER_KIM_EXISTING_PILLARS";
  } else {
    interventionType = "INVENTORY_KIM_PEOPLE_ROUTINES_PLACES_BELIEFS";
  }

  const status: KimPatternActivationStatus = score >= 0.70 ? "ACTIVE" : "OFFER_AS_FOLLOWUP";

  return {
    moduleId: "PAAL-K01",
    activationStatus: status,
    confidenceScore: score,
    confidenceBand: getBand(score),
    matchedMarkers,
    matchedMarkerGroups: matchedGroups,
    selectedInterventionType: interventionType,
    shouldIntroduceKimBalanceFeature: shouldIntroduceBalance,
    reason: `PAAL-K01 ${status}: ${matchedGroups.join(", ")}`,
  };
}
