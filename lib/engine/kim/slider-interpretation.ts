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
