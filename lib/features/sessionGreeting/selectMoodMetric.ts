/**
 * Session Greeting V3 — Mood Metric Selection
 *
 * Selects the single most emotionally relevant mood metric for the greeting.
 * Priority: craving > despondency > frustration > focus
 *
 * Rules:
 * - Only considers metrics from today's sliders
 * - craving/despondency/frustration: high = concerning (alarm/elevated)
 * - focus: high = positive, low = neutral (focus is never alarming)
 * - Returns the highest-priority metric that is above the elevated threshold
 * - If no metric is elevated, returns focus if positive, else null
 */

import type { GreetingStateDatSnapshot } from './sessionGreeting.types';
import type { MoodMetricName, MoodMetricSelection } from './sessionGreetingV3.types';
import {
  MOOD_METRIC_PRIORITY,
  V3_MOOD_HIGH_ALARM_THRESHOLD,
  V3_MOOD_ELEVATED_THRESHOLD,
  V3_FOCUS_POSITIVE_THRESHOLD,
} from './sessionGreetingV3.types';

/**
 * Selects the most emotionally relevant mood metric from today's sliders.
 * Returns null if sliders are not filled today or no metric is notable.
 */
export function selectMostEmotionallyRelevantMoodMetric(
  stateDat: GreetingStateDatSnapshot | null,
  slidersFilledToday: boolean,
): MoodMetricSelection | null {
  if (!slidersFilledToday || !stateDat?.currentMood) {
    return null;
  }

  const mood = stateDat.currentMood;

  // Check negative metrics first (craving > despondency > frustration)
  for (const metricName of MOOD_METRIC_PRIORITY) {
    if (metricName === 'focus') continue; // handle focus separately

    const value = mood[metricName] ?? 0;

    if (value >= V3_MOOD_HIGH_ALARM_THRESHOLD) {
      return {
        metricName: metricName as MoodMetricName,
        value,
        interpretation: 'high_alarm',
      };
    }

    if (value >= V3_MOOD_ELEVATED_THRESHOLD) {
      return {
        metricName: metricName as MoodMetricName,
        value,
        interpretation: 'elevated',
      };
    }
  }

  // Check focus (inverted: high = positive)
  const focusValue = mood.focus ?? 0;
  if (focusValue >= V3_FOCUS_POSITIVE_THRESHOLD) {
    return {
      metricName: 'focus',
      value: focusValue,
      interpretation: 'positive',
    };
  }

  // No notable metric — mood is neutral/unremarkable
  // Still return the dominant negative if any is > 0 for context
  for (const metricName of MOOD_METRIC_PRIORITY) {
    if (metricName === 'focus') continue;
    const value = mood[metricName] ?? 0;
    if (value > 0) {
      return {
        metricName: metricName as MoodMetricName,
        value,
        interpretation: 'neutral',
      };
    }
  }

  return null;
}

/**
 * Generates a safe textual description of the mood state for GPT.
 * Does NOT include raw numbers — only qualitative descriptions.
 */
export function buildMoodSafeAnchor(metric: MoodMetricSelection): string {
  const { metricName, interpretation } = metric;

  switch (interpretation) {
    case 'high_alarm':
      return `check-in staat op alarm (${metricName} hoog)`;
    case 'elevated':
      return `check-in toont verhoogde ${metricName === 'craving' ? 'craving' : metricName === 'despondency' ? 'somberheid' : 'frustratie'}`;
    case 'positive':
      return 'check-in voelt wat helderder vandaag';
    case 'neutral':
      return 'check-in is er al';
    default:
      return 'check-in is ingevuld';
  }
}
