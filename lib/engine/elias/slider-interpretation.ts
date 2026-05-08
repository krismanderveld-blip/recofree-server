/**
 * Elias Slider Interpretation — Single Source of Truth
 *
 * All Elias-specific slider formulas, defaults, and positive slider definitions.
 * No file outside lib/engine/elias/ should contain these formulas.
 *
 * Scale: raw sliders are 0-10.
 * Functions ending in "100" return 0-100 (internal zone scale).
 */

import type { MoodSliders } from '../../ai/types';

// ─── Slider Key Access ──────────────────────────────────────────

function get(mood: MoodSliders, key: string): number {
  return (mood as any)[key] ?? 0;
}

// ─── Core Formulas (0-10 scale) ─────────────────────────────────

/**
 * Elias distress score: average of craving, frustration, despondency.
 * Higher = worse. Range: 0-10.
 */
export function eliasDistressScore(mood: MoodSliders): number {
  return (get(mood, 'craving') + get(mood, 'frustration') + get(mood, 'despondency')) / 3;
}

/**
 * Elias resilience score: focus slider.
 * Higher = better. Range: 0-10.
 */
export function eliasResilienceScore(mood: MoodSliders): number {
  return get(mood, 'focus');
}

/**
 * Elias primary concern: craving slider.
 * Higher = worse. Range: 0-10.
 */
export function eliasPrimaryConcern(mood: MoodSliders): number {
  return get(mood, 'craving');
}

// ─── 0-100 Internal Scale (Patch D) ────────────────────────────

/** Elias distress on 0-100 scale */
export function eliasDistress100(mood: MoodSliders): number {
  return eliasDistressScore(mood) * 10;
}

/** Elias resilience on 0-100 scale */
export function eliasResilience100(mood: MoodSliders): number {
  return eliasResilienceScore(mood) * 10;
}

/** Elias primary concern on 0-100 scale */
export function eliasPrimaryConcern100(mood: MoodSliders): number {
  return eliasPrimaryConcern(mood) * 10;
}

// ─── Default Mood ───────────────────────────────────────────────

/**
 * Default Elias mood sliders (neutral state).
 * craving=0, frustration=0, despondency=0, focus=5
 */
export const ELIAS_DEFAULT_MOOD = {
  craving: 0,
  frustration: 0,
  despondency: 0,
  focus: 5,
  vsp: null,
  vspScore: null,
} as const;

// ─── Positive Sliders ───────────────────────────────────────────

/**
 * Elias positive sliders (higher = better, excluded from distress calculations).
 */
export const ELIAS_POSITIVE_SLIDERS: readonly string[] = ['focus'];

// ─── Mock Detection Thresholds ──────────────────────────────────

/**
 * Check if Elias user has low mood (for mock provider).
 * despondency >= 4 → low mood.
 */
export function isEliasLowMood(mood: MoodSliders): boolean {
  return get(mood, 'despondency') >= 4;
}

/**
 * Check if Elias user has high craving (for mock provider).
 * craving >= 5 → high craving.
 */
export function isEliasHighCraving(mood: MoodSliders): boolean {
  return get(mood, 'craving') >= 5;
}
