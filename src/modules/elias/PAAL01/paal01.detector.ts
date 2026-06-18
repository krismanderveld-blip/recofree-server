/**
 * PAAL01 — Steunpilaren inventaris detector
 * Determines when to offer steunpilaren reflection to the user.
 * Aligned with PAAL01 spec V1.
 */

import type {
  SteunpilarenRuntimeInput,
  SteunpilarenDetectionResult,
  SteunpilarenActivationStatus,
  SteunpilarenConfidenceBand,
  SteunpilarenTriggerContext,
  Paal01InterventionType,
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

function blocked(
  status: SteunpilarenActivationStatus,
  reason: string
): SteunpilarenDetectionResult {
  return {
    moduleId: "PAAL01",
    activationStatus: status,
    confidenceScore: 0,
    confidenceBand: "LOW",
    triggerContext: "STABLE_REFLECTION",
    selectedInterventionType: "INTRODUCE_SUPPORT_PILLARS",
    shouldIntroduceBalanceFeature: false,
    shouldWriteBalanceItemSuggestion: false,
    matchedMarkers: [],
    reason,
  };
}

export function detectPaal01(
  input: SteunpilarenRuntimeInput
): SteunpilarenDetectionResult {
  // ─── HARD BLOCKS ───────────────────────────────────────────
  if (input.persona !== "elias") {
    return blocked("BLOCKED_BY_PERSONA", "PAAL01 is Elias-only. Kim persona blocked.");
  }

  if (!input.intakeCompleted) {
    return blocked("BLOCKED_BY_INTAKE", "Intake not completed.");
  }

  if (
    input.crisisDetected ||
    input.suicideSelfHarmDetected ||
    input.acuteDangerDetected ||
    input.medicalEmergencyDetected
  ) {
    return blocked("BLOCKED_BY_CRISIS", "Crisis detected. PAAL01 defers to crisis protocol.");
  }

  // ─── DEFER_TO_SAFETY: relapse intent, severe intoxication, PAARS/ROOD without stabilization ─
  if (
    input.relapseIntentDetected ||
    input.severeIntoxicationDetected ||
    (input.currentZone === "PAARS" && !input.stabilizedEnoughForReflection) ||
    (input.currentZone === "ROOD" && !input.stabilizedEnoughForReflection)
  ) {
    return blocked("DEFER_TO_SAFETY", "Safety-relevant state detected. PAAL01 defers to safety protocol.");
  }

  // ─── DEFER_TO_GROUNDING: active grounding needed, ORANJE without stabilization ─
  if (
    input.activeGroundingNeeded ||
    (input.currentZone === "ORANJE" && !input.stabilizedEnoughForReflection)
  ) {
    return blocked("DEFER_TO_GROUNDING", "Grounding needed. PAAL01 defers to grounding protocol.");
  }

  // ─── ZONE CHECK — PAAL01 only activates in GROEN/GEEL (or stabilized ORANJE) ─────
  const stableZone =
    input.currentZone === "GROEN" ||
    input.currentZone === "GEEL" ||
    (input.currentZone === "ORANJE" && input.stabilizedEnoughForReflection);

  if (!stableZone) {
    return blocked("NOT_ACTIVE", `Zone ${input.currentZone} is not stable enough for PAAL01.`);
  }

  // ─── TRIGGER CONTEXT & INTERVENTION TYPE DETERMINATION ─────

  // Priority 1: First use introduction (introduce concept + balkmetafoor)
  if (
    input.profileFeatureFirstUse ||
    (input.existingEliasSteunpilarenHints.moduleUsageCount === 0 && !input.balkmetafoorInitialized)
  ) {
    return {
      moduleId: "PAAL01",
      activationStatus: "ACTIVE",
      confidenceScore: 0.85,
      confidenceBand: "VERY_HIGH",
      triggerContext: "FIRST_USE_INTRODUCTION",
      selectedInterventionType: "BALANCE_BAR_INTRODUCTION",
      shouldIntroduceBalanceFeature: true,
      shouldWriteBalanceItemSuggestion: false,
      matchedMarkers: [],
      reason: "First PAAL01 activation. Introducing steunpilaren concept and balkmetafoor.",
    };
  }

  // Priority 2: Post-difficulty reconnect
  if (input.hasRecentDifficultMomentResolved) {
    return {
      moduleId: "PAAL01",
      activationStatus: "ACTIVE",
      confidenceScore: 0.72,
      confidenceBand: "HIGH",
      triggerContext: "POST_DIFFICULTY_REMINDER",
      selectedInterventionType: "POST_DIFFICULT_MOMENT_RECONNECT",
      shouldIntroduceBalanceFeature: false,
      shouldWriteBalanceItemSuggestion: false,
      matchedMarkers: [],
      reason: "User stabilized from difficult period. Reconnecting with existing steunpilaren.",
    };
  }

  // Priority 2b: Post-difficulty from log summaries
  const recentSummaries = input.existingEliasSteunpilarenHints.recentLogSafeSummaries;
  const hadRecentDifficulty = recentSummaries.some(
    (s) => s.includes("ORANJE") || s.includes("ROOD") || s.includes("crisis") || s.includes("craving")
  );
  if (
    hadRecentDifficulty &&
    input.existingEliasSteunpilarenHints.storedSteunpilaren.length >= 1
  ) {
    return {
      moduleId: "PAAL01",
      activationStatus: "ACTIVE",
      confidenceScore: 0.70,
      confidenceBand: "HIGH",
      triggerContext: "POST_DIFFICULTY_REMINDER",
      selectedInterventionType: "REMEMBER_EXISTING_PILLARS",
      shouldIntroduceBalanceFeature: false,
      shouldWriteBalanceItemSuggestion: false,
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
      moduleId: "PAAL01",
      activationStatus: "ACTIVE",
      confidenceScore: 0.60,
      confidenceBand: "MEDIUM",
      triggerContext: "PERIODIC_UPDATE_INVITATION",
      selectedInterventionType: "QUALITATIVE_DRAAGLAST_DRAAGKRACHT_REFLECTION",
      shouldIntroduceBalanceFeature: false,
      shouldWriteBalanceItemSuggestion: true,
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
    return blocked("NOT_ACTIVE", "No steunpilaren-relevant markers detected.");
  }

  // Confidence scoring for STABLE_REFLECTION
  let confidence = 0;

  // Direct marker match
  if (allMatched.length >= 1) confidence += 0.35;
  // 2+ markers
  if (allMatched.length >= 2) confidence += 0.20;
  // Zone bonus
  if (input.currentZone === "GROEN") confidence += 0.10;
  else if (input.currentZone === "GEEL") confidence += 0.05;
  // Existing steunpilaren in memory
  if (input.existingPillarsCount > 0) confidence += 0.10;
  // First use bonus
  if (input.existingEliasSteunpilarenHints.moduleUsageCount === 0) confidence += 0.25;

  // Cap at 1.0
  confidence = Math.min(confidence, 1.0);

  // Determine intervention type based on context
  let interventionType: Paal01InterventionType = "INVENTORY_PEOPLE_ROUTINES_PLACES_BELIEFS";
  let shouldWriteBalance = false;

  if (allGroups.has("balkmetafoorExplicit")) {
    interventionType = "QUALITATIVE_DRAAGLAST_DRAAGKRACHT_REFLECTION";
    shouldWriteBalance = true;
  } else if (allGroups.has("isolationBelief")) {
    interventionType = "ADD_ONE_SMALL_PILLAR";
  } else if (allGroups.has("postDifficultyStabilization")) {
    interventionType = "POST_DIFFICULT_MOMENT_RECONNECT";
  } else if (allGroups.has("supportSeeking") && input.existingPillarsCount > 0) {
    interventionType = "REMEMBER_EXISTING_PILLARS";
  } else if (allGroups.has("profileFeatureRequest")) {
    interventionType = "BRIDGE_TO_PROFILE_FEATURE";
    shouldWriteBalance = true;
  }

  // Threshold: 0.55 for OFFER_AS_FOLLOWUP, 0.65 for ACTIVE
  let activationStatus: SteunpilarenActivationStatus;
  if (confidence >= 0.65) {
    activationStatus = "ACTIVE";
  } else if (confidence >= 0.55) {
    activationStatus = "OFFER_AS_FOLLOWUP";
  } else {
    activationStatus = "NOT_ACTIVE";
  }

  return {
    moduleId: "PAAL01",
    activationStatus,
    confidenceScore: confidence,
    confidenceBand: getConfidenceBand(confidence),
    triggerContext: "STABLE_REFLECTION",
    selectedInterventionType: interventionType,
    shouldIntroduceBalanceFeature: false,
    shouldWriteBalanceItemSuggestion: shouldWriteBalance,
    matchedMarkers: allMatched,
    reason: activationStatus === "ACTIVE"
      ? `Steunpilaren markers detected with confidence ${confidence.toFixed(2)}.`
      : activationStatus === "OFFER_AS_FOLLOWUP"
      ? `Markers detected with confidence ${confidence.toFixed(2)}. Offering as follow-up.`
      : `Markers detected but confidence ${confidence.toFixed(2)} below threshold 0.55.`,
  };
}
