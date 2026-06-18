/**
 * PAAL01 — Steunpilaren inventaris detector
 * Determines when to offer steunpilaren reflection to the user.
 */

import type {
  SteunpilarenRuntimeInput,
  SteunpilarenDetectionResult,
  SteunpilarenActivationStatus,
  SteunpilarenConfidenceBand,
  SteunpilarenTriggerContext,
} from "@/src/types/eliasSteunpilaren.types";
import { PAAL01_NL_MARKERS } from "./paal01.markerBank.nl";
import { PAAL01_EN_MARKERS } from "./paal01.markerBank.en";

function getConfidenceBand(score: number): SteunpilarenConfidenceBand {
  if (score >= 0.80) return "VERY_HIGH";
  if (score >= 0.65) return "HIGH";
  if (score >= 0.40) return "MEDIUM";
  return "LOW";
}

function matchMarkers(
  message: string,
  markerGroups: Record<string, readonly string[]>
): { matched: string[]; groupsHit: Set<string> } {
  const lower = message.toLowerCase();
  const matched: string[] = [];
  const groupsHit = new Set<string>();

  for (const [group, markers] of Object.entries(markerGroups)) {
    for (const marker of markers) {
      // Support simple .* regex patterns
      if (marker.includes(".*")) {
        const regex = new RegExp(marker.replace(/\.\*/g, ".*"), "i");
        if (regex.test(lower)) {
          matched.push(marker);
          groupsHit.add(group);
        }
      } else if (lower.includes(marker)) {
        matched.push(marker);
        groupsHit.add(group);
      }
    }
  }

  return { matched, groupsHit };
}

export function detectPaal01(
  input: SteunpilarenRuntimeInput
): SteunpilarenDetectionResult {
  const baseResult: Omit<SteunpilarenDetectionResult, "activationStatus" | "confidenceScore" | "confidenceBand" | "triggerContext" | "matchedMarkers" | "reason"> = {
    moduleId: "PAAL01",
  };

  // ─── HARD BLOCKS ───────────────────────────────────────────
  if (input.persona !== "elias") {
    return {
      ...baseResult,
      activationStatus: "BLOCKED_BY_PERSONA",
      confidenceScore: 0,
      confidenceBand: "LOW",
      triggerContext: "STABLE_REFLECTION",
      matchedMarkers: [],
      reason: "PAAL01 is Elias-only. Kim persona blocked.",
    };
  }

  if (!input.intakeCompleted) {
    return {
      ...baseResult,
      activationStatus: "BLOCKED_BY_INTAKE",
      confidenceScore: 0,
      confidenceBand: "LOW",
      triggerContext: "STABLE_REFLECTION",
      matchedMarkers: [],
      reason: "Intake not completed.",
    };
  }

  if (
    input.crisisDetected ||
    input.suicideSelfHarmDetected ||
    input.acuteDangerDetected ||
    input.relapseIntentDetected ||
    input.severeIntoxicationDetected ||
    input.medicalEmergencyDetected
  ) {
    return {
      ...baseResult,
      activationStatus: "BLOCKED_BY_CRISIS",
      confidenceScore: 0,
      confidenceBand: "LOW",
      triggerContext: "STABLE_REFLECTION",
      matchedMarkers: [],
      reason: "Crisis detected. PAAL01 defers to crisis protocol.",
    };
  }

  // ─── ZONE CHECK — PAAL01 only activates in GROEN/GEEL ─────
  const stableZone = input.currentZone === "GROEN" || input.currentZone === "GEEL";

  if (!stableZone) {
    return {
      ...baseResult,
      activationStatus: "NOT_ACTIVE",
      confidenceScore: 0,
      confidenceBand: "LOW",
      triggerContext: "STABLE_REFLECTION",
      matchedMarkers: [],
      reason: `Zone ${input.currentZone} is not stable. PAAL01 requires GROEN or GEEL.`,
    };
  }

  // ─── TRIGGER CONTEXT DETERMINATION ─────────────────────────

  // Priority 1: First use introduction
  if (
    input.existingEliasSteunpilarenHints.moduleUsageCount === 0 &&
    !input.balkmetafoorInitialized
  ) {
    return {
      ...baseResult,
      activationStatus: "ACTIVE",
      confidenceScore: 0.80,
      confidenceBand: "VERY_HIGH",
      triggerContext: "FIRST_USE_INTRODUCTION",
      matchedMarkers: [],
      reason: "First PAAL01 activation. Introducing steunpilaren concept and balkmetafoor.",
    };
  }

  // Priority 2: Post-difficulty reminder
  const recentSummaries = input.existingEliasSteunpilarenHints.recentLogSafeSummaries;
  const hadRecentDifficulty = recentSummaries.some(
    (s) => s.includes("ORANJE") || s.includes("ROOD") || s.includes("crisis") || s.includes("craving")
  );
  if (
    hadRecentDifficulty &&
    input.existingEliasSteunpilarenHints.storedSteunpilaren.length >= 1
  ) {
    return {
      ...baseResult,
      activationStatus: "ACTIVE",
      confidenceScore: 0.70,
      confidenceBand: "HIGH",
      triggerContext: "POST_DIFFICULTY_REMINDER",
      matchedMarkers: [],
      reason: "User stabilized from difficult period. Reminding of existing steunpilaren.",
    };
  }

  // Priority 3: Periodic update invitation
  if (
    input.sessionsSinceLastPaal01 >= 14 &&
    input.existingEliasSteunpilarenHints.moduleUsageCount >= 1
  ) {
    return {
      ...baseResult,
      activationStatus: "ACTIVE",
      confidenceScore: 0.60,
      confidenceBand: "MEDIUM",
      triggerContext: "PERIODIC_UPDATE_INVITATION",
      matchedMarkers: [],
      reason: "14+ sessions since last PAAL01. Inviting periodic review.",
    };
  }

  // Priority 4: Stable reflection based on markers
  const nlResult = matchMarkers(input.latestUserMessage, PAAL01_NL_MARKERS);
  const enResult = matchMarkers(input.latestUserMessage, PAAL01_EN_MARKERS);

  const allMatched = [...nlResult.matched, ...enResult.matched];
  const allGroups = new Set([...nlResult.groupsHit, ...enResult.groupsHit]);

  if (allMatched.length === 0) {
    return {
      ...baseResult,
      activationStatus: "NOT_ACTIVE",
      confidenceScore: 0,
      confidenceBand: "LOW",
      triggerContext: "STABLE_REFLECTION",
      matchedMarkers: [],
      reason: "No steunpilaren-relevant markers detected.",
    };
  }

  // Confidence scoring for STABLE_REFLECTION
  let confidence = 0;

  // Direct marker match
  if (allMatched.length >= 1) confidence += 0.30;
  // 2+ markers
  if (allMatched.length >= 2) confidence += 0.20;
  // Zone bonus
  if (input.currentZone === "GROEN") confidence += 0.10;
  else if (input.currentZone === "GEEL") confidence += 0.05;
  // Existing steunpilaren in memory
  if (input.existingEliasSteunpilarenHints.storedSteunpilaren.length > 0) confidence += 0.10;

  // Cap at 1.0
  confidence = Math.min(confidence, 1.0);

  const activationStatus: SteunpilarenActivationStatus =
    confidence >= 0.60 ? "ACTIVE" : "NOT_ACTIVE";

  return {
    ...baseResult,
    activationStatus,
    confidenceScore: confidence,
    confidenceBand: getConfidenceBand(confidence),
    triggerContext: "STABLE_REFLECTION",
    matchedMarkers: allMatched,
    reason: activationStatus === "ACTIVE"
      ? `Steunpilaren markers detected with confidence ${confidence.toFixed(2)}.`
      : `Markers detected but confidence ${confidence.toFixed(2)} below threshold 0.60.`,
  };
}
