/**
 * BEHE-K01 Detector — Caregiver control patterns
 *
 * Kim-only. Elias blocked. Crisis defers to acute modules.
 * "Confronteren zonder te beschuldigen" — naming pattern without blaming.
 */

import type {
  KimPatternRuntimeInput,
  KimPatternDetectionResult,
  KimConfidenceBand,
  KimPatternActivationStatus,
} from "@/src/types/kimPatternsSupport.types";
import { beheK01MarkersNl } from "./beheK01.markerBank.nl";
import { beheK01MarkersEn } from "./beheK01.markerBank.en";

export type BeheK01InterventionType =
  | "NAMING_CONTROL_PATTERN_WITHOUT_BLAME"
  | "EXPLORING_WHAT_CONTROL_COSTS_KIM"
  | "RECOGNIZING_ULTIMATUM_LOOP"
  | "EXHAUSTION_ACKNOWLEDGMENT"
  | "SMALL_ALTERNATIVE_TO_CONTROL"
  | "PATTERN_AWARENESS_DEEPENING";

export interface BeheK01DetectionResult extends KimPatternDetectionResult {
  moduleId: "BEHE-K01";
  selectedInterventionType: BeheK01InterventionType;
}

function blocked(status: KimPatternActivationStatus, reason: string): BeheK01DetectionResult {
  return {
    moduleId: "BEHE-K01",
    activationStatus: status,
    confidenceScore: 0,
    confidenceBand: "LOW",
    matchedMarkers: [],
    matchedMarkerGroups: [],
    selectedInterventionType: "NAMING_CONTROL_PATTERN_WITHOUT_BLAME",
    reason,
  };
}

function getBand(score: number): KimConfidenceBand {
  if (score >= 0.85) return "VERY_HIGH";
  if (score >= 0.70) return "HIGH";
  if (score >= 0.55) return "MEDIUM";
  return "LOW";
}

export function detectBeheK01(input: KimPatternRuntimeInput): BeheK01DetectionResult {
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
  if (input.domesticViolenceOrAbuseDetected)
    return blocked("DEFER_TO_GEVAAR_K01", "Domestic violence detected");

  // Marker matching
  const msg = input.latestUserMessage.toLowerCase();
  const allMessages = [msg, ...input.recentMessages.map(m => m.toLowerCase())].join(" ");
  const matchedMarkers: string[] = [];
  const matchedGroups: string[] = [];

  let score = 0;

  // NL markers
  for (const marker of beheK01MarkersNl.controlBehavior) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("controlBehavior")) matchedGroups.push("controlBehavior");
      score += 0.35;
      break;
    }
  }
  for (const marker of beheK01MarkersNl.threateningUltimatum) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("threateningUltimatum")) matchedGroups.push("threateningUltimatum");
      score += 0.30;
      break;
    }
  }
  for (const marker of beheK01MarkersNl.exhaustionFromControl) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("exhaustionFromControl")) matchedGroups.push("exhaustionFromControl");
      score += 0.25;
      break;
    }
  }
  for (const marker of beheK01MarkersNl.awarenessOfPattern) {
    if (allMessages.includes(marker)) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("awarenessOfPattern")) matchedGroups.push("awarenessOfPattern");
      score += 0.20;
      break;
    }
  }

  // EN markers
  for (const marker of beheK01MarkersEn.controlBehavior) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("controlBehavior")) matchedGroups.push("controlBehavior");
      score += 0.35;
      break;
    }
  }
  for (const marker of beheK01MarkersEn.threateningUltimatum) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("threateningUltimatum")) matchedGroups.push("threateningUltimatum");
      score += 0.30;
      break;
    }
  }
  for (const marker of beheK01MarkersEn.exhaustionFromControl) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("exhaustionFromControl")) matchedGroups.push("exhaustionFromControl");
      score += 0.25;
      break;
    }
  }
  for (const marker of beheK01MarkersEn.awarenessOfPattern) {
    if (allMessages.includes(marker.toLowerCase())) {
      matchedMarkers.push(marker);
      if (!matchedGroups.includes("awarenessOfPattern")) matchedGroups.push("awarenessOfPattern");
      score += 0.20;
      break;
    }
  }

  // Context bonuses
  if (input.currentKimZone === "GROEN" || input.currentKimZone === "GEEL") score += 0.10;
  if (input.stabilizedEnoughForReflection) score += 0.10;
  if (input.existingKimMemoryHints.activeControlPatternIds.length > 0) score += 0.10;

  score = Math.min(score, 1.0);

  if (score < 0.55) {
    return {
      moduleId: "BEHE-K01",
      activationStatus: "NOT_ACTIVE",
      confidenceScore: score,
      confidenceBand: getBand(score),
      matchedMarkers,
      matchedMarkerGroups: matchedGroups,
      selectedInterventionType: "NAMING_CONTROL_PATTERN_WITHOUT_BLAME",
      reason: "Below activation threshold",
    };
  }

  // Select intervention type
  let interventionType: BeheK01InterventionType;
  if (matchedGroups.includes("threateningUltimatum")) {
    interventionType = "RECOGNIZING_ULTIMATUM_LOOP";
  } else if (matchedGroups.includes("exhaustionFromControl")) {
    interventionType = "EXHAUSTION_ACKNOWLEDGMENT";
  } else if (matchedGroups.includes("awarenessOfPattern") && matchedGroups.includes("controlBehavior")) {
    interventionType = "PATTERN_AWARENESS_DEEPENING";
  } else if (matchedGroups.includes("controlBehavior")) {
    interventionType = "NAMING_CONTROL_PATTERN_WITHOUT_BLAME";
  } else {
    interventionType = "EXPLORING_WHAT_CONTROL_COSTS_KIM";
  }

  const status: KimPatternActivationStatus = score >= 0.70 ? "ACTIVE" : "OFFER_AS_FOLLOWUP";

  return {
    moduleId: "BEHE-K01",
    activationStatus: status,
    confidenceScore: score,
    confidenceBand: getBand(score),
    matchedMarkers,
    matchedMarkerGroups: matchedGroups,
    selectedInterventionType: interventionType,
    reason: `BEHE-K01 ${status}: ${matchedGroups.join(", ")}`,
  };
}
