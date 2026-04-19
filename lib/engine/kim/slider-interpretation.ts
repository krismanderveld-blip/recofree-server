/**
 * Kim Slider Interpretation
 *
 * Extracted from shared files:
 * - lib/rugzak/state-analyzer.ts (getDistressScore, getResilienceScore, getPrimaryConcern)
 * - lib/rugzak/engine.ts (same functions, duplicated)
 * - lib/crisis/detector.ts (getDistress, getResilience)
 *
 * Kim sliders: stress, boundaryFatigue, emotionalBurden, selfCare
 *
 * No new logic. Direct extraction only.
 */

import type { MoodSliders } from '../../ai/types';

/** Safely read a slider value by key */
function getSlider(mood: MoodSliders, key: string): number {
  return (mood as any)[key] ?? 0;
}

/**
 * Kim distress score (0-10): average of stress, boundaryFatigue, emotionalBurden.
 * Higher = worse.
 */
export function kimDistressScore(mood: MoodSliders): number {
  return (getSlider(mood, 'stress') + getSlider(mood, 'boundaryFatigue') + getSlider(mood, 'emotionalBurden')) / 3;
}

/**
 * Kim resilience score (0-10): selfCare value directly.
 * Higher = better.
 */
export function kimResilienceScore(mood: MoodSliders): number {
  return getSlider(mood, 'selfCare');
}

/**
 * Kim primary concern (0-10): stress value directly.
 */
export function kimPrimaryConcern(mood: MoodSliders): number {
  return getSlider(mood, 'stress');
}

// ─── Kim Backpack Trigger Scoring (from backpack-relevance-analyzer.ts) ───

/**
 * Score a Kim trigger against slider values for backpack relevance.
 * Extracted from backpack-relevance-analyzer.ts scoreTrigger (else branch, lines 193-198).
 * Exact same trigger IDs, exact same thresholds, exact same +2 scoring.
 *
 * Returns the slider-based score contribution (0 or 2).
 */
/**
 * Kim positive slider keys — sliders that represent resilience/positive state.
 * Extracted from server/ai-chat.ts line 812: !['focus', 'selfCare'].includes(keys[i])
 * 'focus' is Elias-specific, 'selfCare' is Kim-specific.
 *
 * Used to filter out positive sliders when computing max distress.
 */
export const KIM_POSITIVE_SLIDERS: readonly string[] = Object.freeze(['selfCare']);

/**
 * Check if Kim user is in a low mood state based on slider values.
 * Extracted from mock-provider.ts line 100: emotionalBurden >= 4
 *
 * This is DECISION LOGIC, not mock data.
 * Returns true if emotionalBurden >= 4 (Kim-specific lowMood threshold).
 */
export function isKimLowMood(mood: MoodSliders): boolean {
  return (getSlider(mood, 'emotionalBurden')) >= 4;
}

export function kimBackpackSliderScore(triggerId: string, mood: MoodSliders): number {
  const s = mood as any;
  if ((triggerId === 'boundary_violation' || triggerId === 'control') && s.boundaryFatigue >= 6) return 2;
  if ((triggerId === 'overgiving' || triggerId === 'depletion') && s.emotionalBurden >= 6) return 2;
  if (triggerId === 'isolation' && s.selfCare <= 3) return 2;
  return 0;
}
