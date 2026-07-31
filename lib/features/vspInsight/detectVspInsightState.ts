/**
 * VSP Insight State Detector
 *
 * Determines one of three insight states:
 * - REAL_GREEN: embodied, connected, concrete feelings present
 * - RATIONAL_GREEN: explanatory, distant, analytical, "in the head"
 * - OVERWHELMED_ORANGE_RED: too high, craving, panic, shutdown
 *
 * This detector READS safety core output but NEVER MUTATES it.
 * Silent discrepancy is stored locally only — never communicated.
 */

import type {
  VspInsightState,
  VspMoodSlidersSnapshot,
  VspChatSignalSnapshot,
  ImmutableSafetyCoreSnapshot,
} from "./vspInsightTypes";
import { detectRationalGreenSignals } from "./detectRationalGreenSignals";
import { detectOverwhelmSignals } from "./detectOverwhelmSignals";

export interface DetectVspInsightStateInput {
  mood: VspMoodSlidersSnapshot;
  chatSignals: VspChatSignalSnapshot;
  immutableCore: ImmutableSafetyCoreSnapshot;
}

export interface DetectVspInsightStateResult {
  insightState: VspInsightState;
  reasons: string[];
  rationalGreenScore: number;
  overwhelmScore: number;
  realGreenScore: number;
}

/**
 * Main state detection function.
 * Priority: safety override > overwhelm > rational green > real green
 */
export function detectVspInsightState(
  input: DetectVspInsightStateInput
): DetectVspInsightStateResult {
  const { mood, chatSignals, immutableCore } = input;
  const reasons: string[] = [];

  // ─── Safety core override: always wins ────────────────────────────────────
  if (immutableCore.safetyOverrideActive) {
    reasons.push("Safety core override active — VSP defers to SAFETY_CORE_ONLY");
    return {
      insightState: "OVERWHELMED_ORANGE_RED",
      reasons,
      rationalGreenScore: 0,
      overwhelmScore: 10,
      realGreenScore: 0,
    };
  }

  // ─── Detect overwhelm signals ─────────────────────────────────────────────
  const overwhelmResult = detectOverwhelmSignals({ mood, chatSignals, immutableCore });
  const overwhelmScore = overwhelmResult.score;

  // ─── Detect rational green signals ────────────────────────────────────────
  const rationalResult = detectRationalGreenSignals({ mood, chatSignals });
  const rationalGreenScore = rationalResult.score;

  // ─── Detect real green signals ────────────────────────────────────────────
  const realGreenScore = computeRealGreenScore(mood, chatSignals);

  // ─── Decision logic ───────────────────────────────────────────────────────
  // Overwhelm threshold: score >= 5 OR craving >= 7 OR safety flags
  if (overwhelmScore >= 5) {
    reasons.push(...overwhelmResult.reasons);
    reasons.push(`Overwhelm score ${overwhelmScore} >= 5`);
    return {
      insightState: "OVERWHELMED_ORANGE_RED",
      reasons,
      rationalGreenScore,
      overwhelmScore,
      realGreenScore,
    };
  }

  // Rational green threshold: score >= 4 AND user reports green AND low emotional connection
  if (
    rationalGreenScore >= 4 &&
    mood.selfReportedZone === "GROEN" &&
    realGreenScore < 4
  ) {
    reasons.push(...rationalResult.reasons);
    reasons.push(`Rational green score ${rationalGreenScore} >= 4, real green ${realGreenScore} < 4`);
    return {
      insightState: "RATIONAL_GREEN",
      reasons,
      rationalGreenScore,
      overwhelmScore,
      realGreenScore,
    };
  }

  // Default: real green (embodied, connected)
  reasons.push(`Real green score ${realGreenScore}, no overwhelm or rational signals dominant`);
  return {
    insightState: "REAL_GREEN",
    reasons,
    rationalGreenScore,
    overwhelmScore,
    realGreenScore,
  };
}

/**
 * Compute real green score: presence of embodied emotion, warmth, self-compassion
 */
function computeRealGreenScore(
  mood: VspMoodSlidersSnapshot,
  chatSignals: VspChatSignalSnapshot
): number {
  let score = 0;

  // Embodied emotion markers present
  if (chatSignals.embodiedEmotionMarkers.length > 0) {
    score += Math.min(chatSignals.embodiedEmotionMarkers.length, 3);
  }

  // Warmth markers present
  if (chatSignals.warmthMarkers.length > 0) {
    score += Math.min(chatSignals.warmthMarkers.length, 2);
  }

  // Self-compassion markers
  if (chatSignals.selfCompassionMarkers.length > 0) {
    score += Math.min(chatSignals.selfCompassionMarkers.length, 2);
  }

  // Emotional connection markers
  if (chatSignals.emotionalConnectionMarkers.length > 0) {
    score += Math.min(chatSignals.emotionalConnectionMarkers.length, 2);
  }

  // Low craving and low frustration boost real green
  if (mood.craving <= 3 && mood.frustration <= 3) {
    score += 1;
  }

  return score;
}
