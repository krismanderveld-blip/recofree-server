/**
 * Elias State Logic — Single Source of Truth for Thresholds
 *
 * All Elias-specific threshold values and decision functions.
 * No file outside lib/engine/elias/ should contain these thresholds.
 *
 * Covers:
 * - Crisis trigger thresholds (slider-based)
 * - Guidance depth thresholds
 * - Model routing thresholds
 */

import type { MoodSliders } from '../../ai/types';

// ─── Slider Key Access ──────────────────────────────────────────

function get(mood: MoodSliders, key: string): number {
  return (mood as any)[key] ?? 0;
}

// ─── Elias Crisis Triggers (slider-based) ───────────────────────

export interface EliasCrisisTriggerResult {
  triggers: string[];
  maxLevel: number;
}

/**
 * Check Elias-specific slider crisis triggers.
 * Returns trigger names and max crisis level from slider analysis.
 *
 * Thresholds:
 * - craving >= 6 → extreme_craving (level 1)
 * - despondency >= 6 → extreme_despondency (level 1)
 */
export function checkEliasCrisisTriggers(mood: MoodSliders): EliasCrisisTriggerResult {
  const triggers: string[] = [];
  let maxLevel = 0;

  if (get(mood, 'craving') >= 6) {
    triggers.push('extreme_craving');
    maxLevel = Math.max(maxLevel, 1);
  }
  if (get(mood, 'despondency') >= 6) {
    triggers.push('extreme_despondency');
    maxLevel = Math.max(maxLevel, 1);
  }

  return { triggers, maxLevel };
}

// ─── Guidance Depth Thresholds ──────────────────────────────────

export type GuidanceDepth = 'light' | 'normal' | 'deep';

/**
 * Determine the state-allowed guidance depth based on crisis/risk/distress.
 *
 * Thresholds:
 * - crisisLevel >= 2 OR riskScore >= 8 OR maxDistress >= 9 → 'light' (RED/PURPLE)
 * - crisisLevel === 1 OR riskScore >= 5 OR maxDistress >= 7 → 'normal' (ORANGE)
 * - otherwise → 'deep' (YELLOW/GREEN, user setting applies)
 */
export function eliasStateAllowedDepth(
  crisisLevel: number,
  riskScore: number,
  maxDistress: number
): GuidanceDepth {
  if (crisisLevel >= 2 || riskScore >= 8 || maxDistress >= 9) {
    return 'light';
  }
  if (crisisLevel === 1 || riskScore >= 5 || maxDistress >= 7) {
    return 'normal';
  }
  return 'deep';
}

// ─── Model Routing Threshold ────────────────────────────────────

/**
 * Risk score threshold for upgrading to gpt-4o.
 * crisisLevel > 0 OR riskScore >= this value → gpt-4o
 */
export const ELIAS_MODEL_ROUTING_RISK_THRESHOLD = 7;

// ─── Elias Reflection Trigger Detection (from mock-provider.ts) ───

/**
 * Detect if a message contains Elias-specific reflection triggers.
 * Extracted from mock-provider.ts detectReflectionTrigger.
 * Exact same keywords, exact same logic.
 */
export function detectEliasReflectionTrigger(message: string): boolean {
  const keywords = ['why', 'pattern', 'always', 'keep doing', 'same thing', "don't understand", "don't get"];
  return keywords.some((kw) => message.toLowerCase().includes(kw));
}
