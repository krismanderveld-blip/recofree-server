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
import { kimDistressScore, kimResilienceScore, kimPrimaryConcern } from '../engine/kim/slider-interpretation';
import { selectKimPriorityModules } from '../engine/kim/module-catalog';
import { eliasDistressScore, eliasResilienceScore, eliasPrimaryConcern } from '../engine/elias/slider-interpretation';
import { computeEliasPriorityModules, ELIAS_DEFAULT_MODULE, eliasSignalToModules, eliasTriggerToModule } from '../engine/elias/module-catalog';
import { kimTriggerToModule } from '../engine/kim/module-catalog';
import type { SignalDetectionResult } from '../engine/local-llm/signal-engine';

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
 * Get the "distress" score (0-10) — a normalized measure of how bad things are.
 * Elias: average of craving, frustration, despondency (higher = worse)
 * Kim: average of stress, boundaryFatigue, emotionalBurden (higher = worse)
 */
function getDistressScore(mood: MoodSliders, userType: UserType): number {
  if (userType === 'elias') return eliasDistressScore(mood);
  return kimDistressScore(mood);
}

/**
 * Get the "resilience" score (0-10) — a normalized measure of coping capacity.
 * Elias: focus (higher = better)
 * Kim: selfCare (higher = better)
 */
function getResilienceScore(mood: MoodSliders, userType: UserType): number {
  if (userType === 'elias') return eliasResilienceScore(mood);
  return kimResilienceScore(mood);
}

/**
 * Get the primary concern slider value (0-10).
 * Elias: craving
 * Kim: stress
 */
function getPrimaryConcern(mood: MoodSliders, userType: UserType): number {
  if (userType === 'elias') return eliasPrimaryConcern(mood);
  return kimPrimaryConcern(mood);
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
  if (signals.passiveSuicidal && (distress >= 5.5 || primaryConcern >= 7)) return 'high';
  if (distress >= 7.5 && resilience <= 3) return 'high';
  if (signals.hopelessness && moodTrend === 'declining') return 'high';

  // Moderate: concerning combinations
  if (distress >= 5.5 && primaryConcern >= 5.5) return 'moderate';
  if (moodTrend === 'declining' && patternAccumulation >= 3) return 'moderate';
  if (signals.isolationSignal && distress >= 4) return 'moderate';
  if (signals.dissociation) return 'moderate';
  if (signals.cravingMention && primaryConcern >= 5.5) return 'moderate';

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

  if (distress >= 6.5 || signals.hopelessness || signals.dissociation) return 'depleted';
  if (moodTrend === 'declining' || primaryConcern >= 5.5 || signals.isolationSignal) return 'vulnerable';

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

function determineTone(
  riskLevel: RiskLevel,
  emotionalState: EmotionalState,
  moodTrend: MoodTrend,
  mood: MoodSliders,
  userType: UserType
): ToneDirective {
  if (riskLevel === 'critical') return 'crisis';

  const distress = getDistressScore(mood, userType);
  const primaryConcern = getPrimaryConcern(mood, userType);
  const resilience = getResilienceScore(mood, userType);

  // HIGH DISTRESS COMPOUND RULES:
  // craving > 6 AND (frustration > 6 OR despondency > 6) → grounding + directive
  // stress > 6 AND emotionalBurden > 6 → grounding + directive (Kim)
  if (primaryConcern > 6 && distress >= 6) return 'grounding';

  // High distress + low resilience → grounding (user is overwhelmed, needs structure)
  if (distress >= 6 && resilience <= 3) return 'grounding';

  // Depleted but not in acute distress → warm
  if (emotionalState === 'depleted') return 'warm';

  // Volatile mood → grounding (needs stability)
  if (moodTrend === 'volatile') return 'grounding';

  // Declining + vulnerable → assertive (gently push toward action)
  if (emotionalState === 'vulnerable' && moodTrend === 'declining') return 'assertive';

  // Moderate distress → warm
  if (emotionalState === 'vulnerable') return 'warm';

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

  if (primaryConcern >= 7) intensity += 2;
  if (primaryConcern >= 8) intensity += 1;
  if (distress >= 5.5) intensity += 1;
  if (moodTrend === 'declining') intensity += 1;
  if (riskLevel === 'high' || riskLevel === 'critical') intensity += 1;

  // Gentler for new users
  if (totalSessions < 3) intensity -= 1;

  // Dial back if resilience is very low (overwhelmed)
  if (resilience <= 2) intensity -= 1;

  return Math.max(1, Math.min(10, intensity));
}

// ─── Module Selection (RULE-BASED, NOT AI) ──────────────────────

function selectPriorityModules(
  userType: UserType,
  mood: MoodSliders,
  moodTrend: MoodTrend,
  signals: InputSignals,
  activeTriggers: string[],
  candidateSignals?: SignalDetectionResult
): string[] {
  const modules: string[] = [];

  if (userType === 'elias') {
    // Delegate to Elias engine for slider-based priority modules
    const eliasModules = computeEliasPriorityModules(mood, [], moodTrend);
    // Add signal-based modules (delegated to Elias engine)
    const signalModules = eliasSignalToModules(signals);
    for (const m of signalModules) {
      if (!eliasModules.includes(m)) modules.push(m);
    }
    modules.push(...eliasModules);

    // Additive: semantic signals from GptSignalEngine (confidence > 0.5)
    if (candidateSignals) {
      if (candidateSignals.fears.some(s => s.confidence > 0.5)) {
        modules.push('E02', 'E03', 'E05');
      }
      if (candidateSignals.hopes.some(s => s.confidence > 0.5)) {
        modules.push('E06');
      }
      if (candidateSignals.goals.some(s => s.confidence > 0.5)) {
        modules.push('E06', 'E08');
      }
      for (const t of candidateSignals.triggers) {
        if (t.confidence > 0.5) {
          modules.push(eliasTriggerToModule(t.keyword));
        }
      }
    }

    if (modules.length === 0) modules.push(ELIAS_DEFAULT_MODULE);
  } else {
    // Kim: existing rule-based selection
    const kimModules = selectKimPriorityModules(mood, signals, activeTriggers);

    // Additive: semantic signals from GptSignalEngine (confidence > 0.5)
    if (candidateSignals) {
      const extra: string[] = [];
      if (candidateSignals.fears.some(s => s.confidence > 0.5)) {
        extra.push('K03');
      }
      if (candidateSignals.hopes.some(s => s.confidence > 0.5)) {
        extra.push('K06');
      }
      if (candidateSignals.goals.some(s => s.confidence > 0.5)) {
        extra.push('K06');
      }
      for (const t of candidateSignals.triggers) {
        if (t.confidence > 0.5) {
          extra.push(kimTriggerToModule(t.keyword));
        }
      }
      return [...new Set([...kimModules, ...extra])].slice(0, 3);
    }

    return kimModules;
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
    parts.push(`${sc.label}: ${getSlider(mood, sc.key)}/${sc.max}`);
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
  inputText: string,
  candidateSignals?: SignalDetectionResult
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

  // 7. Module selection (rule-based + semantic signals)
  const priorityModules = selectPriorityModules(userType, currentMood, moodTrend, signals, activeTriggers, candidateSignals);

  // 8. Behavior directives
  const tone = determineTone(riskLevel, emotionalState, moodTrend, currentMood, userType);
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
