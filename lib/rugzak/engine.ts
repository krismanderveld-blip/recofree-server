/**
 * Rugzak Influence Engine
 *
 * The Rugzak is NOT passive storage. It ACTIVELY influences:
 * - Module selection (trigger patterns + mood trajectory)
 * - Tone (mood trajectory + history depth adjusts warmth/directness)
 * - Crisis detection (pattern accumulation raises baseline sensitivity)
 * - Suggestion intensity (low engagement + high craving = more assertive)
 *
 * This engine computes a RugzakInfluence object on every message,
 * which is passed into module selection and response generation.
 */

import type {
  Rugzak,
  MoodSliders,
  MoodSnapshot,
  RugzakInfluence,
  TriggerPattern,
  ChatMessage,
} from '../ai/types';

// ─── Mood Trajectory Analysis ───────────────────────────────────

function computeMoodTrajectory(
  moodHistory: MoodSnapshot[]
): 'improving' | 'stable' | 'declining' | 'volatile' {
  if (moodHistory.length < 2) return 'stable';

  // Take last 5 snapshots for trajectory
  const recent = moodHistory.slice(-5);
  const stemmingValues = recent.map((s) => s.sliders.stemming);

  // Calculate trend
  const diffs: number[] = [];
  for (let i = 1; i < stemmingValues.length; i++) {
    diffs.push(stemmingValues[i] - stemmingValues[i - 1]);
  }

  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance =
    diffs.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / diffs.length;

  // High variance = volatile
  if (variance > 4) return 'volatile';
  // Consistent positive trend
  if (avgDiff > 0.5) return 'improving';
  // Consistent negative trend
  if (avgDiff < -0.5) return 'declining';
  return 'stable';
}

// ─── Tone Determination ─────────────────────────────────────────

function determineTone(
  trajectory: 'improving' | 'stable' | 'declining' | 'volatile',
  currentMood: MoodSliders,
  crisisLevel: number
): 'warm' | 'grounding' | 'assertive' | 'crisis' {
  if (crisisLevel >= 2) return 'crisis';

  // Declining mood → warmer, more supportive
  if (trajectory === 'declining' || currentMood.stemming <= 3) return 'warm';

  // Volatile → grounding, stabilizing
  if (trajectory === 'volatile') return 'grounding';

  // High craving with stable/improving mood → assertive guidance
  if (currentMood.craving >= 7) return 'assertive';

  // Default
  return 'warm';
}

// ─── Suggestion Intensity ───────────────────────────────────────

function computeSuggestionIntensity(
  currentMood: MoodSliders,
  trajectory: 'improving' | 'stable' | 'declining' | 'volatile',
  totalSessions: number
): number {
  let intensity = 5; // baseline

  // High craving → more assertive
  if (currentMood.craving >= 7) intensity += 2;
  if (currentMood.craving >= 9) intensity += 1;

  // Low mood → slightly more assertive
  if (currentMood.stemming <= 3) intensity += 1;

  // Declining trajectory → more assertive
  if (trajectory === 'declining') intensity += 1;

  // Volatile → more assertive
  if (trajectory === 'volatile') intensity += 1;

  // New users (< 3 sessions) → gentler
  if (totalSessions < 3) intensity -= 1;

  // High overstimulation → dial back intensity
  if (currentMood.overprikkeling >= 7) intensity -= 1;

  return Math.max(1, Math.min(10, intensity));
}

// ─── Crisis Sensitivity Boost ───────────────────────────────────

function computeCrisisSensitivityBoost(
  triggerPatterns: TriggerPattern[],
  trajectory: 'improving' | 'stable' | 'declining' | 'volatile',
  currentMood: MoodSliders
): number {
  let boost = 0;

  // Recurring crisis-related triggers raise sensitivity
  const crisisTriggers = triggerPatterns.filter(
    (t) =>
      t.trigger === 'suicidal_active' ||
      t.trigger === 'suicidal_passive' ||
      t.trigger === 'self_harm' ||
      t.trigger === 'dissociation'
  );

  for (const t of crisisTriggers) {
    if (t.count >= 3) boost += 2;
    else if (t.count >= 1) boost += 1;
  }

  // Declining trajectory raises sensitivity
  if (trajectory === 'declining') boost += 1;

  // Combined low mood + high craving
  if (currentMood.stemming <= 3 && currentMood.craving >= 7) boost += 1;

  return Math.min(boost, 5); // Cap at 5
}

// ─── Priority Modules ──────────────────────────────────────────

function computePriorityModules(
  userType: 'elias' | 'kim',
  currentMood: MoodSliders,
  triggerPatterns: TriggerPattern[],
  trajectory: 'improving' | 'stable' | 'declining' | 'volatile'
): string[] {
  const priorities: string[] = [];

  if (userType === 'elias') {
    // High craving → Craving Management
    if (currentMood.craving >= 6) priorities.push('E01');
    // Low mood → Emotional Regulation
    if (currentMood.stemming <= 4) priorities.push('E02');
    // High overstimulation → Grounding
    if (currentMood.overprikkeling >= 6) priorities.push('E04');
    // Low social → Social Skills
    if (currentMood.sociaal <= 3) priorities.push('E05');
    // Declining trajectory → Relapse Prevention
    if (trajectory === 'declining') priorities.push('E03');
    // Recurring isolation pattern
    if (triggerPatterns.some((t) => t.trigger === 'isolation' && t.count >= 2)) {
      priorities.push('E05');
    }
  } else {
    // Kim modules
    // Low mood → Self-Care
    if (currentMood.stemming <= 4) priorities.push('K03');
    // High overstimulation → Stress Management
    if (currentMood.overprikkeling >= 6) priorities.push('K04');
    // Recurring enabling pattern
    if (triggerPatterns.some((t) => t.trigger === 'enabling' && t.count >= 2)) {
      priorities.push('K02');
    }
    // Default → Boundary Setting
    if (priorities.length === 0) priorities.push('K01');
  }

  // Deduplicate
  return [...new Set(priorities)];
}

// ─── Active Patterns ────────────────────────────────────────────

function getActivePatterns(triggerPatterns: TriggerPattern[]): string[] {
  // Return triggers that have occurred 2+ times in recent history
  return triggerPatterns
    .filter((t) => t.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map((t) => t.trigger);
}

// ─── Update Trigger Patterns ────────────────────────────────────

export function updateTriggerPatterns(
  existing: TriggerPattern[],
  newTriggers: string[]
): TriggerPattern[] {
  const updated = [...existing];
  const now = new Date().toISOString();

  for (const trigger of newTriggers) {
    const idx = updated.findIndex((t) => t.trigger === trigger);
    if (idx >= 0) {
      updated[idx] = {
        ...updated[idx],
        count: updated[idx].count + 1,
        lastSeen: now,
      };
    } else {
      updated.push({
        trigger,
        count: 1,
        firstSeen: now,
        lastSeen: now,
      });
    }
  }

  return updated;
}

// ─── Add Chat Message to Rugzak ─────────────────────────────────

export function addMessageToRugzak(
  rugzak: Rugzak,
  message: ChatMessage
): Rugzak {
  return {
    ...rugzak,
    chatHistory: [...rugzak.chatHistory, message],
  };
}

// ─── Record Mood Snapshot ───────────────────────────────────────

export function recordMoodSnapshot(
  rugzak: Rugzak,
  mood: MoodSliders
): Rugzak {
  const snapshot: MoodSnapshot = {
    sliders: { ...mood },
    timestamp: new Date().toISOString(),
  };

  return {
    ...rugzak,
    currentMood: { ...mood },
    moodHistory: [...rugzak.moodHistory, snapshot],
  };
}

// ─── Record Module Usage ────────────────────────────────────────

export function recordModuleUsage(
  rugzak: Rugzak,
  moduleId: string,
  context: string
): Rugzak {
  return {
    ...rugzak,
    moduleUsage: [
      ...rugzak.moduleUsage,
      { moduleId, usedAt: new Date().toISOString(), context },
    ],
  };
}

// ─── Start Session ──────────────────────────────────────────────

export function startNewSession(rugzak: Rugzak): Rugzak {
  return {
    ...rugzak,
    lastSessionDate: new Date().toISOString(),
    totalSessions: rugzak.totalSessions + 1,
  };
}

// ─── Main Engine: Compute Influence ─────────────────────────────

/**
 * Compute the Rugzak's active influence on the current interaction.
 * This is called on EVERY message before module selection and response generation.
 */
export function computeRugzakInfluence(
  rugzak: Rugzak,
  crisisLevel: number = 0
): RugzakInfluence {
  const trajectory = computeMoodTrajectory(rugzak.moodHistory);
  const tone = determineTone(trajectory, rugzak.currentMood, crisisLevel);
  const suggestionIntensity = computeSuggestionIntensity(
    rugzak.currentMood,
    trajectory,
    rugzak.totalSessions
  );
  const crisisSensitivityBoost = computeCrisisSensitivityBoost(
    rugzak.triggerPatterns,
    trajectory,
    rugzak.currentMood
  );
  const priorityModules = computePriorityModules(
    rugzak.userType,
    rugzak.currentMood,
    rugzak.triggerPatterns,
    trajectory
  );
  const activePatterns = getActivePatterns(rugzak.triggerPatterns);

  return {
    tone,
    moodTrajectory: trajectory,
    suggestionIntensity,
    crisisSensitivityBoost,
    priorityModules,
    activePatterns,
  };
}
