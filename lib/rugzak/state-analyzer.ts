/**
 * State Analyzer
 *
 * Rule-based analysis of Rugzak state. This is NOT AI.
 * The system makes all decisions — AI only generates language.
 *
 * Supports both Elias (addiction) and Kim (loved one) slider types.
 * Uses generic slider access via helper functions.
 */

import type { Rugzak, MoodSliders, MoodSnapshot, TriggerPattern, UserType } from '../ai/types';
import { createDefaultSliders, getSliderConfig } from '../ai/types';

// ─── Output Types ───────────────────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export type EmotionalState = 'stable' | 'vulnerable' | 'depleted' | 'crisis';
export type ToneDirective = 'warm' | 'grounding' | 'assertive' | 'crisis';
export type PacingDirective = 'normal' | 'slower' | 'very_slow';
export type MoodTrend = 'improving' | 'stable' | 'declining' | 'volatile';

export interface StateAnalysis {
  riskLevel: RiskLevel;
  emotionalState: EmotionalState;
  moodTrend: MoodTrend;
  activeTriggers: string[];
  triggerContextActive: boolean;
  patternAccumulation: number;
  tone: ToneDirective;
  pacing: PacingDirective;
  suggestionIntensity: number;
  crisisMonitoring: boolean;
  crisisThresholdLowered: boolean;
  priorityModules: string[];
  stateSummary: string;
}

// ─── Generic Slider Access ─────────────────────────────────────

/** Safely read a slider value by key from any MoodSliders type */
function getSlider(mood: MoodSliders, key: string): number {
  return (mood as any)[key] ?? 0;
}

/**
 * Get the "distress" score (0-7) — a normalized measure of how bad things are.
 * Elias: average of craving, frustration, despondency (higher = worse)
 * Kim: average of stress, boundaryFatigue, emotionalBurden (higher = worse)
 */
function getDistressScore(mood: MoodSliders, userType: UserType): number {
  if (userType === 'elias') {
    return (getSlider(mood, 'craving') + getSlider(mood, 'frustration') + getSlider(mood, 'despondency')) / 3;
  }
  return (getSlider(mood, 'stress') + getSlider(mood, 'boundaryFatigue') + getSlider(mood, 'emotionalBurden')) / 3;
}

/**
 * Get the "resilience" score (0-7) — a normalized measure of coping capacity.
 * Elias: focus (higher = better)
 * Kim: selfCare (higher = better)
 */
function getResilienceScore(mood: MoodSliders, userType: UserType): number {
  if (userType === 'elias') {
    return getSlider(mood, 'focus');
  }
  return getSlider(mood, 'selfCare');
}

/**
 * Get the primary concern slider value (0-7).
 * Elias: craving
 * Kim: stress
 */
function getPrimaryConcern(mood: MoodSliders, userType: UserType): number {
  if (userType === 'elias') {
    return getSlider(mood, 'craving');
  }
  return getSlider(mood, 'stress');
}

// ─── Input Analysis ────────────────────────────────────────────

export interface InputSignals {
  passiveSuicidal: boolean;
  activeSuicidal: boolean;
  selfHarm: boolean;
  cravingMention: boolean;
  isolationSignal: boolean;
  hopelessness: boolean;
  dissociation: boolean;
  positiveSignal: boolean;
}

export function detectInputSignals(text: string): InputSignals {
  const lower = text.toLowerCase();

  return {
    passiveSuicidal: /\b(giving up|no point|can'?t go on|why bother|done with (everything|life|this))\b/.test(lower),
    activeSuicidal: /\b(want to die|kill myself|end it all|suicide|don'?t want to (live|be here|exist))\b/.test(lower),
    selfHarm: /\b(hurt myself|cutting|self[- ]?harm|burn myself)\b/.test(lower),
    cravingMention: /\b(crav(ing|e)|urge|want to (drink|use|smoke|take)|tempt(ed|ation)|relapse)\b/.test(lower),
    isolationSignal: /\b(alone|lonely|nobody|no one (cares|understands)|isolated|by myself)\b/.test(lower),
    hopelessness: /\b(hopeless|never get better|no hope|pointless|worthless|giving up|can'?t do this)\b/.test(lower),
    dissociation: /\b(numb|don'?t feel anything|empty|disconnected|not real|floating)\b/.test(lower),
    positiveSignal: /\b(feeling better|good day|grateful|proud|happy|hopeful|progress|strong)\b/.test(lower),
  };
}

// ─── Mood Trend Analysis ────────────────────────────────────────

function analyzeMoodTrend(moodHistory: MoodSnapshot[], userType: UserType): MoodTrend {
  if (moodHistory.length < 2) return 'stable';

  const recent = moodHistory.slice(-5);
  // Use distress score for trend (higher = worse)
  const values = recent.map((s) => getDistressScore(s.sliders, userType));

  const diffs: number[] = [];
  for (let i = 1; i < values.length; i++) {
    diffs.push(values[i] - values[i - 1]);
  }

  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance = diffs.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / diffs.length;

  if (variance > 2) return 'volatile';
  // Rising distress = declining
  if (avgDiff > 0.3) return 'declining';
  if (avgDiff < -0.3) return 'improving';
  return 'stable';
}

// ─── Risk Level Assessment ──────────────────────────────────────

function assessRiskLevel(
  mood: MoodSliders,
  userType: UserType,
  moodTrend: MoodTrend,
  signals: InputSignals,
  patternAccumulation: number
): RiskLevel {
  const distress = getDistressScore(mood, userType);
  const primaryConcern = getPrimaryConcern(mood, userType);
  const resilience = getResilienceScore(mood, userType);

  // Critical: active suicidal or self-harm signals
  if (signals.activeSuicidal || signals.selfHarm) return 'critical';

  // High: passive suicidal + high distress
  if (signals.passiveSuicidal && (distress >= 4 || primaryConcern >= 5)) return 'high';
  if (distress >= 5.5 && resilience <= 2) return 'high';
  if (signals.hopelessness && moodTrend === 'declining') return 'high';

  // Moderate: concerning combinations
  if (distress >= 4 && primaryConcern >= 4) return 'moderate';
  if (moodTrend === 'declining' && patternAccumulation >= 3) return 'moderate';
  if (signals.isolationSignal && distress >= 3) return 'moderate';
  if (signals.dissociation) return 'moderate';
  if (signals.cravingMention && primaryConcern >= 4) return 'moderate';

  return 'low';
}

// ─── Emotional State Assessment ─────────────────────────────────

function assessEmotionalState(
  mood: MoodSliders,
  userType: UserType,
  moodTrend: MoodTrend,
  riskLevel: RiskLevel,
  signals: InputSignals
): EmotionalState {
  if (riskLevel === 'critical') return 'crisis';
  if (riskLevel === 'high') return 'depleted';

  const distress = getDistressScore(mood, userType);
  const primaryConcern = getPrimaryConcern(mood, userType);

  if (distress >= 4.5 || signals.hopelessness || signals.dissociation) return 'depleted';
  if (moodTrend === 'declining' || primaryConcern >= 4 || signals.isolationSignal) return 'vulnerable';

  return 'stable';
}

// ─── Pattern Accumulation Score ─────────────────────────────────

function computePatternAccumulation(triggerPatterns: TriggerPattern[]): number {
  let score = 0;
  for (const pattern of triggerPatterns) {
    if (pattern.count >= 5) score += 3;
    else if (pattern.count >= 3) score += 2;
    else if (pattern.count >= 1) score += 1;
  }
  return Math.min(score, 10);
}

// ─── Active Triggers ────────────────────────────────────────────

function getActiveTriggers(
  triggerPatterns: TriggerPattern[],
  signals: InputSignals
): string[] {
  const active: string[] = [];

  for (const p of triggerPatterns) {
    if (p.count >= 2) active.push(p.trigger);
  }

  if (signals.cravingMention) active.push('craving_active');
  if (signals.isolationSignal) active.push('isolation');
  if (signals.hopelessness) active.push('hopelessness');
  if (signals.dissociation) active.push('dissociation');
  if (signals.passiveSuicidal) active.push('suicidal_passive');
  if (signals.activeSuicidal) active.push('suicidal_active');
  if (signals.selfHarm) active.push('self_harm');

  return [...new Set(active)];
}

// ─── Behavior Directives ───────────────────────────────────────

function determineTone(riskLevel: RiskLevel, emotionalState: EmotionalState, moodTrend: MoodTrend): ToneDirective {
  if (riskLevel === 'critical') return 'crisis';
  if (emotionalState === 'depleted') return 'warm';
  if (moodTrend === 'volatile') return 'grounding';
  if (emotionalState === 'vulnerable' && moodTrend === 'declining') return 'warm';
  return 'warm';
}

function determinePacing(riskLevel: RiskLevel, emotionalState: EmotionalState): PacingDirective {
  if (riskLevel === 'critical' || riskLevel === 'high') return 'very_slow';
  if (emotionalState === 'depleted' || emotionalState === 'vulnerable') return 'slower';
  return 'normal';
}

function computeSuggestionIntensity(
  riskLevel: RiskLevel,
  mood: MoodSliders,
  userType: UserType,
  moodTrend: MoodTrend,
  totalSessions: number
): number {
  let intensity = 5;
  const distress = getDistressScore(mood, userType);
  const primaryConcern = getPrimaryConcern(mood, userType);
  const resilience = getResilienceScore(mood, userType);

  if (primaryConcern >= 5) intensity += 2;
  if (primaryConcern >= 6) intensity += 1;
  if (distress >= 4) intensity += 1;
  if (moodTrend === 'declining') intensity += 1;
  if (riskLevel === 'high' || riskLevel === 'critical') intensity += 1;

  // Gentler for new users
  if (totalSessions < 3) intensity -= 1;

  // Dial back if resilience is very low (overwhelmed)
  if (resilience <= 1) intensity -= 1;

  return Math.max(1, Math.min(10, intensity));
}

// ─── Module Selection (RULE-BASED, NOT AI) ──────────────────────

function selectPriorityModules(
  userType: UserType,
  mood: MoodSliders,
  moodTrend: MoodTrend,
  signals: InputSignals,
  activeTriggers: string[]
): string[] {
  const modules: string[] = [];

  if (userType === 'elias') {
    const craving = getSlider(mood, 'craving');
    const frustration = getSlider(mood, 'frustration');
    const despondency = getSlider(mood, 'despondency');
    const focus = getSlider(mood, 'focus');

    // Craving active → E01
    if (signals.cravingMention || craving >= 4) modules.push('E01');
    // Despondency / hopelessness → E02 (Emotional Regulation)
    if (despondency >= 4 || signals.hopelessness) modules.push('E02');
    // Declining trend → E03 (Relapse Prevention)
    if (moodTrend === 'declining') modules.push('E03');
    // Frustration high / dissociation → E04 (Grounding)
    if (frustration >= 5 || signals.dissociation) modules.push('E04');
    // Isolation → E05 (Social)
    if (signals.isolationSignal) modules.push('E05');
    // Low focus → E07 (Focus/Mindfulness)
    if (focus <= 2) modules.push('E07');
    // Positive signal → E06 (Reinforcement)
    if (signals.positiveSignal) modules.push('E06');

    if (modules.length === 0) modules.push('E02');
  } else {
    const stress = getSlider(mood, 'stress');
    const boundaryFatigue = getSlider(mood, 'boundaryFatigue');
    const emotionalBurden = getSlider(mood, 'emotionalBurden');
    const selfCare = getSlider(mood, 'selfCare');

    // High stress → K04 (Stress Management)
    if (stress >= 4) modules.push('K04');
    // Boundary fatigue → K01 (Boundary Setting)
    if (boundaryFatigue >= 4) modules.push('K01');
    // Emotional burden / hopelessness → K03 (Self-Care)
    if (emotionalBurden >= 4 || signals.hopelessness) modules.push('K03');
    // Low self-care → K03
    if (selfCare <= 2) modules.push('K03');
    // Enabling patterns detected → K02
    if (activeTriggers.includes('enabling')) modules.push('K02');
    // Isolation → K05 (Support Network)
    if (signals.isolationSignal) modules.push('K05');

    if (modules.length === 0) modules.push('K01');
  }

  return [...new Set(modules)].slice(0, 3);
}

// ─── Build State Summary ────────────────────────────────────────

function buildStateSummary(
  mood: MoodSliders,
  userType: UserType,
  moodTrend: MoodTrend,
  riskLevel: RiskLevel,
  emotionalState: EmotionalState,
  activeTriggers: string[],
  priorityModules: string[]
): string {
  const parts: string[] = [];
  const config = getSliderConfig(userType);

  for (const sc of config) {
    parts.push(`${sc.label}: ${getSlider(mood, sc.key)}/7`);
  }

  parts.push(`Trend: ${moodTrend}`);
  parts.push(`Risk: ${riskLevel}`);
  parts.push(`State: ${emotionalState}`);

  if (activeTriggers.length > 0) {
    parts.push(`Triggers: ${activeTriggers.join(', ')}`);
  }

  parts.push(`Modules: ${priorityModules.join(', ')}`);

  return parts.join(' | ');
}

// ─── Main Analysis Function ────────────────────────────────────

export function analyzeState(
  rugzak: Rugzak | null | undefined,
  inputText: string
): StateAnalysis {
  const userType: UserType = rugzak?.userType ?? 'elias';
  const defaultMood = createDefaultSliders(userType);

  const currentMood = rugzak?.currentMood ?? defaultMood;
  const moodHistory = rugzak?.moodHistory ?? [];
  const triggerPatterns = rugzak?.triggerPatterns ?? [];
  const totalSessions = rugzak?.totalSessions ?? 0;

  // 1. Detect input signals
  const signals = detectInputSignals(inputText);

  // 2. Analyze mood trend
  const moodTrend = analyzeMoodTrend(moodHistory, userType);

  // 3. Pattern accumulation
  const patternAccumulation = computePatternAccumulation(triggerPatterns);

  // 4. Active triggers
  const activeTriggers = getActiveTriggers(triggerPatterns, signals);

  // 5. Risk level (rule-based)
  const riskLevel = assessRiskLevel(currentMood, userType, moodTrend, signals, patternAccumulation);

  // 6. Emotional state
  const emotionalState = assessEmotionalState(currentMood, userType, moodTrend, riskLevel, signals);

  // 7. Module selection (rule-based)
  const priorityModules = selectPriorityModules(userType, currentMood, moodTrend, signals, activeTriggers);

  // 8. Behavior directives
  const tone = determineTone(riskLevel, emotionalState, moodTrend);
  const pacing = determinePacing(riskLevel, emotionalState);
  const suggestionIntensity = computeSuggestionIntensity(riskLevel, currentMood, userType, moodTrend, totalSessions);

  // 9. Crisis monitoring
  const crisisMonitoring = riskLevel === 'high' || riskLevel === 'critical';
  const crisisThresholdLowered = patternAccumulation >= 3 || moodTrend === 'declining';

  // 10. State summary
  const stateSummary = buildStateSummary(currentMood, userType, moodTrend, riskLevel, emotionalState, activeTriggers, priorityModules);

  return {
    riskLevel,
    emotionalState,
    moodTrend,
    activeTriggers,
    triggerContextActive: activeTriggers.length > 0,
    patternAccumulation,
    tone,
    pacing,
    suggestionIntensity,
    crisisMonitoring,
    crisisThresholdLowered,
    priorityModules,
    stateSummary,
  };
}

// ─── Post-Response State Update ─────────────────────────────────

export function extractTriggersFromSignals(signals: InputSignals): string[] {
  const triggers: string[] = [];

  if (signals.cravingMention) triggers.push('craving');
  if (signals.isolationSignal) triggers.push('isolation');
  if (signals.hopelessness) triggers.push('hopelessness');
  if (signals.dissociation) triggers.push('dissociation');
  if (signals.passiveSuicidal) triggers.push('suicidal_passive');
  if (signals.activeSuicidal) triggers.push('suicidal_active');
  if (signals.selfHarm) triggers.push('self_harm');

  return triggers;
}
