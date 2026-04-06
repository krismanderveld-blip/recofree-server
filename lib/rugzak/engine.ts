/**
 * Rugzak Influence Engine
 *
 * The Rugzak is NOT passive storage. It ACTIVELY influences:
 * - Module selection (trigger patterns + mood trajectory)
 * - Tone (mood trajectory + history depth adjusts warmth/directness)
 * - Crisis detection (pattern accumulation raises baseline sensitivity)
 * - Suggestion intensity (low engagement + high concern = more assertive)
 *
 * Supports both Elias (addiction) and Kim (loved one) slider types.
 * Uses generic slider access — never references old stemming/overprikkeling/sociaal keys.
 */

import type {
  Rugzak,
  MoodSliders,
  MoodSnapshot,
  RugzakInfluence,
  TriggerPattern,
  ChatMessage,
  UserType,
} from '../ai/types';
import { createDefaultSliders } from '../ai/types';

// ─── Generic Slider Access ─────────────────────────────────────

function getSlider(mood: MoodSliders, key: string): number {
  return (mood as any)[key] ?? 0;
}

/** Distress score: average of negative sliders (higher = worse) */
function getDistressScore(mood: MoodSliders, userType: UserType): number {
  if (userType === 'elias') {
    return (getSlider(mood, 'craving') + getSlider(mood, 'frustration') + getSlider(mood, 'despondency')) / 3;
  }
  return (getSlider(mood, 'stress') + getSlider(mood, 'boundaryFatigue') + getSlider(mood, 'emotionalBurden')) / 3;
}

/** Resilience score: positive slider (higher = better) */
function getResilienceScore(mood: MoodSliders, userType: UserType): number {
  return userType === 'elias' ? getSlider(mood, 'focus') : getSlider(mood, 'selfCare');
}

/** Primary concern: the most critical slider */
function getPrimaryConcern(mood: MoodSliders, userType: UserType): number {
  return userType === 'elias' ? getSlider(mood, 'craving') : getSlider(mood, 'stress');
}

// ─── Mood Trajectory Analysis ───────────────────────────────────

function computeMoodTrajectory(
  moodHistory?: MoodSnapshot[] | null,
  userType: UserType = 'elias'
): 'improving' | 'stable' | 'declining' | 'volatile' {
  if (!moodHistory || moodHistory.length < 2) return 'stable';

  const recent = moodHistory.slice(-5);
  // Use distress score for trajectory (rising distress = declining)
  const values = recent.map((s) => getDistressScore(s.sliders, userType));

  const diffs: number[] = [];
  for (let i = 1; i < values.length; i++) {
    diffs.push(values[i] - values[i - 1]);
  }

  if (diffs.length === 0) return 'stable';

  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance =
    diffs.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / diffs.length;

  if (variance > 2) return 'volatile';
  // Rising distress = declining
  if (avgDiff > 0.3) return 'declining';
  if (avgDiff < -0.3) return 'improving';
  return 'stable';
}

// ─── Tone Determination ─────────────────────────────────────────

function determineTone(
  trajectory: 'improving' | 'stable' | 'declining' | 'volatile',
  currentMood: MoodSliders | null | undefined,
  userType: UserType,
  crisisLevel: number
): 'warm' | 'grounding' | 'assertive' | 'crisis' {
  if (crisisLevel >= 2) return 'crisis';

  const mood = currentMood || createDefaultSliders(userType);
  const distress = getDistressScore(mood, userType);

  if (trajectory === 'declining' || distress >= 5.5) return 'warm';
  if (trajectory === 'volatile') return 'grounding';
  if (getPrimaryConcern(mood, userType) >= 7) return 'assertive';

  return 'warm';
}

// ─── Suggestion Intensity ───────────────────────────────────────

function computeSuggestionIntensity(
  currentMood: MoodSliders | null | undefined,
  userType: UserType,
  trajectory: 'improving' | 'stable' | 'declining' | 'volatile',
  totalSessions: number
): number {
  const mood = currentMood || createDefaultSliders(userType);
  let intensity = 5;

  const primaryConcern = getPrimaryConcern(mood, userType);
  const distress = getDistressScore(mood, userType);
  const resilience = getResilienceScore(mood, userType);

  if (primaryConcern >= 7) intensity += 2;
  if (primaryConcern >= 8) intensity += 1;
  if (distress >= 5.5) intensity += 1;
  if (trajectory === 'declining') intensity += 1;
  if (trajectory === 'volatile') intensity += 1;

  // Gentler for new users
  if (totalSessions < 3) intensity -= 1;

  // Dial back if resilience very low (overwhelmed)
  if (resilience <= 2) intensity -= 1;

  return Math.max(1, Math.min(10, intensity));
}

// ─── Crisis Sensitivity Boost ───────────────────────────────────

function computeCrisisSensitivityBoost(
  triggerPatterns: TriggerPattern[] | null | undefined,
  trajectory: 'improving' | 'stable' | 'declining' | 'volatile',
  currentMood: MoodSliders | null | undefined,
  userType: UserType
): number {
  const mood = currentMood || createDefaultSliders(userType);
  const patterns = triggerPatterns || [];
  let boost = 0;

  const crisisTriggers = patterns.filter(
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

  if (trajectory === 'declining') boost += 1;

  const distress = getDistressScore(mood, userType);
  if (distress >= 6.5 && getResilienceScore(mood, userType) <= 3) boost += 1;

  return Math.min(boost, 5);
}

// ─── Priority Modules ──────────────────────────────────────────

function computePriorityModules(
  userType: UserType,
  currentMood: MoodSliders | null | undefined,
  triggerPatterns: TriggerPattern[] | null | undefined,
  trajectory: 'improving' | 'stable' | 'declining' | 'volatile'
): string[] {
  const mood = currentMood || createDefaultSliders(userType);
  const patterns = triggerPatterns || [];
  const priorities: string[] = [];

  if (userType === 'elias') {
    if (getSlider(mood, 'craving') >= 6) priorities.push('E01');
    if (getSlider(mood, 'despondency') >= 6) priorities.push('E02');
    if (getSlider(mood, 'frustration') >= 7) priorities.push('E04');
    if (getSlider(mood, 'focus') <= 3) priorities.push('E07');
    if (trajectory === 'declining') priorities.push('E03');
    if (patterns.some((t) => t.trigger === 'isolation' && t.count >= 2)) {
      priorities.push('E05');
    }
  } else {
    if (getSlider(mood, 'stress') >= 6) priorities.push('K04');
    if (getSlider(mood, 'boundaryFatigue') >= 6) priorities.push('K01');
    if (getSlider(mood, 'emotionalBurden') >= 6) priorities.push('K03');
    if (getSlider(mood, 'selfCare') <= 3) priorities.push('K03');
    if (patterns.some((t) => t.trigger === 'enabling' && t.count >= 2)) {
      priorities.push('K02');
    }
    if (priorities.length === 0) priorities.push('K01');
  }

  return [...new Set(priorities)];
}

// ─── Active Patterns ────────────────────────────────────────────

function getActivePatterns(triggerPatterns?: TriggerPattern[] | null): string[] {
  if (!triggerPatterns || triggerPatterns.length === 0) return [];
  return triggerPatterns
    .filter((t) => t.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map((t) => t.trigger);
}

// ─── Update Trigger Patterns ────────────────────────────────────

export function updateTriggerPatterns(
  existing: TriggerPattern[] | null | undefined,
  newTriggers: string[]
): TriggerPattern[] {
  const updated = [...(existing || [])];
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
    chatHistory: [...(rugzak.chatHistory || []), message],
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
    moodHistory: [...(rugzak.moodHistory || []), snapshot],
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
      ...(rugzak.moduleUsage || []),
      { moduleId, usedAt: new Date().toISOString(), context },
    ],
  };
}

// ─── Start Session ──────────────────────────────────────────────

export function startNewSession(rugzak: Rugzak): Rugzak {
  return {
    ...rugzak,
    lastSessionDate: new Date().toISOString(),
    totalSessions: (rugzak.totalSessions || 0) + 1,
  };
}

// ─── Main Engine: Compute Influence ─────────────────────────────

export function computeRugzakInfluence(
  rugzak: Rugzak | null | undefined,
  crisisLevel: number = 0
): RugzakInfluence {
  if (!rugzak) {
    return {
      tone: crisisLevel >= 2 ? 'crisis' : 'warm',
      moodTrajectory: 'stable',
      suggestionIntensity: 4,
      crisisSensitivityBoost: 0,
      priorityModules: [],
      activePatterns: [],
    };
  }

  const userType: UserType = rugzak.userType || 'elias';
  const trajectory = computeMoodTrajectory(rugzak.moodHistory, userType);
  const tone = determineTone(trajectory, rugzak.currentMood, userType, crisisLevel);
  const suggestionIntensity = computeSuggestionIntensity(
    rugzak.currentMood,
    userType,
    trajectory,
    rugzak.totalSessions || 0
  );
  const crisisSensitivityBoost = computeCrisisSensitivityBoost(
    rugzak.triggerPatterns,
    trajectory,
    rugzak.currentMood,
    userType
  );
  const priorityModules = computePriorityModules(
    userType,
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
