/**
 * Kim Crisis Trigger
 *
 * Extracted from lib/crisis/detector.ts (line 127-131).
 *
 * Kim-specific crisis trigger: emotionalBurden >= 6.
 * Returns trigger name and whether it fired.
 *
 * No new logic. Direct extraction only.
 */

import type { MoodSliders } from '../../ai/types';

/** Safely read a slider value by key */
function getSlider(mood: MoodSliders, key: string): number {
  return (mood as any)[key] ?? 0;
}

export interface KimCrisisTriggerResult {
  readonly fired: boolean;
  readonly triggerName: string;
  readonly value: number;
  readonly threshold: number;
}

/**
 * Check Kim-specific crisis trigger: emotionalBurden >= 6.
 * Returns whether the trigger fired, the trigger name, current value, and threshold.
 */
export function checkKimCrisisTrigger(mood: MoodSliders): KimCrisisTriggerResult {
  const value = getSlider(mood, 'emotionalBurden');
  const threshold = 6;

  return Object.freeze({
    fired: value >= threshold,
    triggerName: 'extreme_emotional_burden',
    value,
    threshold,
  });
}
