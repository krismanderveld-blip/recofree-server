/**
 * State Analyzer
 *
 * Rule-based analysis of Rugzak state. This is NOT AI.
 * The system makes all decisions — AI only generates language.
 *
 * Analyzes:
 * - Mood trends (improving, declining, volatile, stable)
 * - Risk level (low, moderate, high, critical)
 * - Emotional state (stable, vulnerable, depleted, crisis)
 * - Trigger context (active triggers, pattern accumulation)
 * - Behavior adjustments (tone, pacing, intensity)
 */

import type { Rugzak, MoodSliders, MoodSnapshot, TriggerPattern } from '../ai/types';

// ─── Output Types ───────────────────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export type EmotionalState = 'stable' | 'vulnerable' | 'depleted' | 'crisis';
export type ToneDirective = 'warm' | 'grounding' | 'assertive' | 'crisis';
export type PacingDirective = 'normal' | 'slower' | 'very_slow';
export type MoodTrend = 'improving' | 'stable' | 'declining' | 'volatile';

export interface StateAnalysis {
  // ── Core Assessment ──
  riskLevel: RiskLevel;
  emotionalState: EmotionalState;
  moodTrend: MoodTrend;

  // ── Trigger Context ──
  activeTriggers: string[];
  triggerContextActive: boolean;
  patternAccumulation: number; // 0-10 scale

  // ── Behavior Directives (for AI prompt construction) ──
  tone: ToneDirective;
  pacing: PacingDirective;
  suggestionIntensity: number; // 1-10
  crisisMonitoring: boolean;
  crisisThresholdLowered: boolean;

  // ── Module Priorities (rule-based, NOT AI) ──
  priorityModules: string[];

  // ── Summary for AI prompt ──
  stateSummary: string;
}

// ─── Input Analysis (detect signals in user message) ────────────

export interface InputSignals {
  passiveSuicidal: boolean;   // "giving up", "no point", "can't go on"
  activeSuicidal: boolean;    // "want to die", "end it"
  selfHarm: boolean;          // "hurt myself", "cutting"
  cravingMention: boolean;    // "want to drink", "craving", "urge"
  isolationSignal: boolean;   // "alone", "nobody", "no one cares"
  hopelessness: boolean;      // "hopeless", "never get better", "giving up"
  dissociation: boolean;      // "numb", "don't feel anything", "empty"
  positiveSignal: boolean;    // "feeling better", "good day", "grateful"
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

function analyzeMoodTrend(moodHistory: MoodSnapshot[]): MoodTrend {
  if (moodHistory.length < 2) return 'stable';

  const recent = moodHistory.slice(-5);
  const values = recent.map((s) => s.sliders.stemming);

  const diffs: number[] = [];
  for (let i = 1; i < values.length; i++) {
    diffs.push(values[i] - values[i - 1]);
  }

  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance = diffs.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / diffs.length;

  if (variance > 4) return 'volatile';
  if (avgDiff > 0.5) return 'improving';
  if (avgDiff < -0.5) return 'declining';
  return 'stable';
}

// ─── Risk Level Assessment ──────────────────────────────────────

function assessRiskLevel(
  mood: MoodSliders,
  moodTrend: MoodTrend,
  signals: InputSignals,
  patternAccumulation: number
): RiskLevel {
  // Critical: active suicidal or self-harm signals
  if (signals.activeSuicidal || signals.selfHarm) return 'critical';

  // High: passive suicidal + declining mood + high craving
  if (signals.passiveSuicidal && (mood.stemming <= 3 || mood.craving >= 7)) return 'high';
  if (mood.stemming <= 2 && mood.craving >= 8) return 'high';
  if (signals.hopelessness && moodTrend === 'declining') return 'high';

  // Moderate: concerning combinations
  if (mood.stemming <= 4 && mood.craving >= 6) return 'moderate';
  if (moodTrend === 'declining' && patternAccumulation >= 3) return 'moderate';
  if (signals.isolationSignal && mood.stemming <= 4) return 'moderate';
  if (signals.dissociation) return 'moderate';
  if (signals.cravingMention && mood.craving >= 5) return 'moderate';

  return 'low';
}

// ─── Emotional State Assessment ─────────────────────────────────

function assessEmotionalState(
  mood: MoodSliders,
  moodTrend: MoodTrend,
  riskLevel: RiskLevel,
  signals: InputSignals
): EmotionalState {
  if (riskLevel === 'critical') return 'crisis';
  if (riskLevel === 'high') return 'depleted';

  if (mood.stemming <= 3 || signals.hopelessness || signals.dissociation) return 'depleted';
  if (moodTrend === 'declining' || mood.craving >= 6 || signals.isolationSignal) return 'vulnerable';

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

  // From accumulated patterns (count >= 2)
  for (const p of triggerPatterns) {
    if (p.count >= 2) active.push(p.trigger);
  }

  // From current input signals
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
  moodTrend: MoodTrend,
  totalSessions: number
): number {
  let intensity = 5;

  if (mood.craving >= 7) intensity += 2;
  if (mood.craving >= 9) intensity += 1;
  if (mood.stemming <= 3) intensity += 1;
  if (moodTrend === 'declining') intensity += 1;
  if (riskLevel === 'high' || riskLevel === 'critical') intensity += 1;

  // Gentler for new users
  if (totalSessions < 3) intensity -= 1;

  // Dial back if overstimulated
  if (mood.overprikkeling >= 7) intensity -= 1;

  return Math.max(1, Math.min(10, intensity));
}

// ─── Module Selection (RULE-BASED, NOT AI) ──────────────────────

function selectPriorityModules(
  userType: 'elias' | 'kim',
  mood: MoodSliders,
  moodTrend: MoodTrend,
  signals: InputSignals,
  activeTriggers: string[]
): string[] {
  const modules: string[] = [];

  if (userType === 'elias') {
    // Craving active → E01
    if (signals.cravingMention || mood.craving >= 6) modules.push('E01');
    // Low mood / hopelessness → E02
    if (mood.stemming <= 4 || signals.hopelessness) modules.push('E02');
    // Declining trend → E03 (Relapse Prevention)
    if (moodTrend === 'declining') modules.push('E03');
    // Overstimulation → E04 (Grounding)
    if (mood.overprikkeling >= 6 || signals.dissociation) modules.push('E04');
    // Isolation → E05 (Social)
    if (signals.isolationSignal || mood.sociaal <= 3) modules.push('E05');
    // Positive signal → E06 (Reinforcement)
    if (signals.positiveSignal) modules.push('E06');

    // Default if nothing triggered
    if (modules.length === 0) modules.push('E02');
  } else {
    // Kim modules
    if (mood.stemming <= 4 || signals.hopelessness) modules.push('K03'); // Self-Care
    if (mood.overprikkeling >= 6) modules.push('K04'); // Stress Management
    if (activeTriggers.includes('enabling')) modules.push('K02'); // Enabling Patterns
    if (signals.isolationSignal) modules.push('K05'); // Support Network
    if (modules.length === 0) modules.push('K01'); // Boundary Setting
  }

  // Deduplicate and limit to 3
  return [...new Set(modules)].slice(0, 3);
}

// ─── Build State Summary (compressed, for AI prompt) ────────────

function buildStateSummary(
  mood: MoodSliders,
  moodTrend: MoodTrend,
  riskLevel: RiskLevel,
  emotionalState: EmotionalState,
  activeTriggers: string[],
  priorityModules: string[]
): string {
  const parts: string[] = [];

  parts.push(`Mood: ${mood.stemming}/10 (trend: ${moodTrend})`);
  parts.push(`Craving: ${mood.craving}/10`);
  parts.push(`Stimuli: ${mood.overprikkeling}/10`);
  parts.push(`Social: ${mood.sociaal}/10`);
  parts.push(`Risk: ${riskLevel}`);
  parts.push(`Emotional state: ${emotionalState}`);

  if (activeTriggers.length > 0) {
    parts.push(`Active triggers: ${activeTriggers.join(', ')}`);
  }

  parts.push(`Active modules: ${priorityModules.join(', ')}`);

  return parts.join(' | ');
}

// ─── Main Analysis Function ────────────────────────────────────

/**
 * Analyze the current Rugzak state + input signals.
 * This is called on EVERY message BEFORE AI generation.
 *
 * The system makes ALL decisions here:
 * - Risk level
 * - Emotional state
 * - Module selection
 * - Tone, pacing, intensity
 * - Crisis monitoring
 *
 * AI receives the output of this analysis and generates language ONLY.
 */
export function analyzeState(
  rugzak: Rugzak | null | undefined,
  inputText: string
): StateAnalysis {
  // Default mood for safety
  const defaultMood: MoodSliders = { stemming: 5, craving: 0, overprikkeling: 0, sociaal: 5 };

  // Safe access to Rugzak properties
  const currentMood = rugzak?.currentMood || defaultMood;
  const moodHistory = rugzak?.moodHistory || [];
  const triggerPatterns = rugzak?.triggerPatterns || [];
  const userType = rugzak?.userType || 'elias';
  const totalSessions = rugzak?.totalSessions || 0;

  // 1. Detect input signals (rule-based pattern matching)
  const signals = detectInputSignals(inputText);

  // 2. Analyze mood trend from history
  const moodTrend = analyzeMoodTrend(moodHistory);

  // 3. Compute pattern accumulation
  const patternAccumulation = computePatternAccumulation(triggerPatterns);

  // 4. Get active triggers (accumulated + current)
  const activeTriggers = getActiveTriggers(triggerPatterns, signals);

  // 5. Assess risk level (rule-based, NOT AI)
  const riskLevel = assessRiskLevel(currentMood, moodTrend, signals, patternAccumulation);

  // 6. Assess emotional state
  const emotionalState = assessEmotionalState(currentMood, moodTrend, riskLevel, signals);

  // 7. Select priority modules (rule-based, NOT AI)
  const priorityModules = selectPriorityModules(
    userType,
    currentMood,
    moodTrend,
    signals,
    activeTriggers
  );

  // 8. Determine behavior directives
  const tone = determineTone(riskLevel, emotionalState, moodTrend);
  const pacing = determinePacing(riskLevel, emotionalState);
  const suggestionIntensity = computeSuggestionIntensity(
    riskLevel,
    currentMood,
    moodTrend,
    totalSessions
  );

  // 9. Crisis monitoring decisions
  const crisisMonitoring = riskLevel === 'high' || riskLevel === 'critical';
  const crisisThresholdLowered = patternAccumulation >= 3 || moodTrend === 'declining';

  // 10. Build compressed state summary for AI prompt
  const stateSummary = buildStateSummary(
    currentMood,
    moodTrend,
    riskLevel,
    emotionalState,
    activeTriggers,
    priorityModules
  );

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

/**
 * Determine which triggers to update after processing a message.
 * Called AFTER AI response is generated.
 */
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
