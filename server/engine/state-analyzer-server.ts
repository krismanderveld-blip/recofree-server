/**
 * ══════════════════════════════════════════════════════════════════════════
 * SERVER-SAFE STATE ANALYZER
 * ══════════════════════════════════════════════════════════════════════════
 *
 * This is a server-safe re-export of the state-analyzer logic.
 *
 * Problem: lib/rugzak/state-analyzer.ts imports { createDefaultSliders, getSliderConfig }
 * from lib/ai/types.ts, which has a runtime import of LocalDeviceTimeService from
 * @/lib/core/time, which barrel-exports react-native modules.
 *
 * Solution: We duplicate the two small functions here (they are pure data, no logic)
 * and re-implement analyzeState with the same logic but server-safe imports.
 *
 * The actual analysis logic is identical to the client — this file just breaks
 * the react-native import chain.
 */

import type { MoodSliders, UserType, MoodSnapshot, TriggerPattern } from '../../lib/ai/types';

// ─── Inlined from lib/ai/types.ts (to avoid react-native import chain) ──

interface SliderConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  thresholds: { level: 'mild' | 'moderate' | 'severe'; value: number }[];
  inverted?: boolean;
}

const ELIAS_SLIDER_CONFIG: SliderConfig[] = [
  { key: 'craving', label: 'Craving', min: 0, max: 10, thresholds: [{ level: 'mild', value: 4 }, { level: 'moderate', value: 7 }, { level: 'severe', value: 9 }] },
  { key: 'frustration', label: 'Frustration', min: 0, max: 10, thresholds: [{ level: 'mild', value: 3 }, { level: 'moderate', value: 6 }, { level: 'severe', value: 8 }] },
  { key: 'despondency', label: 'Despondency', min: 0, max: 10, thresholds: [{ level: 'mild', value: 4 }, { level: 'moderate', value: 7 }, { level: 'severe', value: 9 }] },
  { key: 'focus', label: 'Mental Focus', min: 0, max: 10, inverted: true, thresholds: [{ level: 'mild', value: 5 }, { level: 'moderate', value: 3 }, { level: 'severe', value: 1 }] },
];

const KIM_SLIDER_CONFIG: SliderConfig[] = [
  { key: 'stress', label: 'Stress', min: 0, max: 10, thresholds: [{ level: 'mild', value: 3 }, { level: 'moderate', value: 6 }, { level: 'severe', value: 8 }] },
  { key: 'boundaryFatigue', label: 'Boundary Fatigue', min: 0, max: 10, thresholds: [{ level: 'mild', value: 3 }, { level: 'moderate', value: 6 }, { level: 'severe', value: 8 }] },
  { key: 'emotionalBurden', label: 'Emotional Burden', min: 0, max: 10, thresholds: [{ level: 'mild', value: 4 }, { level: 'moderate', value: 7 }, { level: 'severe', value: 9 }] },
  { key: 'selfCare', label: 'Self-care', min: 0, max: 10, inverted: true, thresholds: [{ level: 'mild', value: 5 }, { level: 'moderate', value: 3 }, { level: 'severe', value: 1 }] },
];

function getSliderConfig(userType: UserType): SliderConfig[] {
  return userType === 'elias' ? ELIAS_SLIDER_CONFIG : KIM_SLIDER_CONFIG;
}

function createDefaultSliders(userType: UserType): MoodSliders {
  if (userType === 'elias') {
    return { craving: 0, frustration: 0, despondency: 0, focus: 5, vsp: null, vspScore: null } as any;
  }
  return { stress: 0, boundaryFatigue: 0, emotionalBurden: 0, selfCare: 5, eigenRegie: null } as any;
}

// ─── Import server-safe engine helpers ────────────────────────────────
// These files only import types from lib/ai/types.ts (import type), so they're safe.
import { kimDistressScore, kimResilienceScore, kimPrimaryConcern } from '../../lib/engine/kim/slider-interpretation';
import { selectKimPriorityModules } from '../../lib/engine/kim/module-catalog';
import { eliasDistressScore, eliasResilienceScore, eliasPrimaryConcern } from '../../lib/engine/elias/slider-interpretation';
import { computeEliasPriorityModules, ELIAS_DEFAULT_MODULE, eliasSignalToModules } from '../../lib/engine/elias/module-catalog';

// ─── Output Types (identical to client) ──────────────────────────────

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

// ─── Input Signals ────────────────────────────────────────────────────

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
    passiveSuicidal: /\b(giving up|no point|can'?t go on|why bother|done with (everything|life|this)|ik geef het op|geen zin meer|kan niet meer|waarom nog|klaar met alles)\b/.test(lower),
    activeSuicidal: /\b(want to die|kill myself|end it all|suicide|don'?t want to (live|be here|exist)|wil (er niet meer zijn|dood|niet meer leven)|zelfmoord|maak er een einde aan|ik wil er niet meer zijn|wil niet meer verder|wil niet meer bestaan)\b/.test(lower),
    selfHarm: /\b(hurt myself|cutting|self[- ]?harm|burn myself|mezelf (pijn doen|snijden|verwonden)|automutilatie|snijden)\b/.test(lower),
    cravingMention: /\b(crav(ing|e)|urge|want to (drink|use|smoke|take)|tempt(ed|ation)|relapse|trek|drang|zucht|wil (drinken|gebruiken|roken)|terugval)\b/.test(lower),
    isolationSignal: /\b(alone|lonely|nobody|no one (cares|understands)|isolated|by myself|alleen|eenzaam|niemand|ge[ïi]soleerd|op mezelf)\b/.test(lower),
    hopelessness: /\b(hopeless|never get better|no hope|pointless|worthless|giving up|can'?t do this|hopeloos|wordt nooit beter|geen hoop|zinloos|waardeloos|ik kan dit niet)\b/.test(lower),
    dissociation: /\b(numb|don'?t feel anything|empty|disconnected|not real|floating|verdoofd|voel niets|leeg|losgekoppeld|niet echt)\b/.test(lower),
    positiveSignal: /\b(feeling better|good day|grateful|proud|happy|hopeful|progress|strong|beter|goede dag|dankbaar|trots|blij|hoopvol|vooruitgang|sterk)\b/.test(lower),
  };
}

// ─── Internal Helpers (identical logic to client) ─────────────────────

function getSlider(mood: MoodSliders, key: string): number {
  return (mood as any)[key] ?? 0;
}

function getDistressScore(mood: MoodSliders, userType: UserType): number {
  if (userType === 'elias') return eliasDistressScore(mood);
  return kimDistressScore(mood);
}

function getResilienceScore(mood: MoodSliders, userType: UserType): number {
  if (userType === 'elias') return eliasResilienceScore(mood);
  return kimResilienceScore(mood);
}

function getPrimaryConcern(mood: MoodSliders, userType: UserType): number {
  if (userType === 'elias') return eliasPrimaryConcern(mood);
  return kimPrimaryConcern(mood);
}

function analyzeMoodTrend(moodHistory: MoodSnapshot[], userType: UserType): MoodTrend {
  if (moodHistory.length < 2) return 'stable';
  const recent = moodHistory.slice(-5);
  const values = recent.map((s) => getDistressScore(s.sliders, userType));
  const diffs: number[] = [];
  for (let i = 1; i < values.length; i++) diffs.push(values[i] - values[i - 1]);
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance = diffs.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / diffs.length;
  if (variance > 2) return 'volatile';
  if (avgDiff > 0.3) return 'declining';
  if (avgDiff < -0.3) return 'improving';
  return 'stable';
}

function assessRiskLevel(mood: MoodSliders, userType: UserType, moodTrend: MoodTrend, signals: InputSignals, patternAccumulation: number): RiskLevel {
  const distress = getDistressScore(mood, userType);
  const primaryConcern = getPrimaryConcern(mood, userType);
  const resilience = getResilienceScore(mood, userType);
  if (signals.activeSuicidal || signals.selfHarm) return 'critical';
  if (signals.passiveSuicidal && (distress >= 5.5 || primaryConcern >= 7)) return 'high';
  if (distress >= 7.5 && resilience <= 3) return 'high';
  if (signals.hopelessness && moodTrend === 'declining') return 'high';
  if (distress >= 5.5 && primaryConcern >= 5.5) return 'moderate';
  if (moodTrend === 'declining' && patternAccumulation >= 3) return 'moderate';
  if (signals.isolationSignal && distress >= 4) return 'moderate';
  if (signals.dissociation) return 'moderate';
  if (signals.cravingMention && primaryConcern >= 5.5) return 'moderate';
  return 'low';
}

function assessEmotionalState(mood: MoodSliders, userType: UserType, moodTrend: MoodTrend, riskLevel: RiskLevel, signals: InputSignals): EmotionalState {
  if (riskLevel === 'critical') return 'crisis';
  if (riskLevel === 'high') return 'depleted';
  const distress = getDistressScore(mood, userType);
  const primaryConcern = getPrimaryConcern(mood, userType);
  if (distress >= 6.5 || signals.hopelessness || signals.dissociation) return 'depleted';
  if (moodTrend === 'declining' || primaryConcern >= 5.5 || signals.isolationSignal) return 'vulnerable';
  return 'stable';
}

function computePatternAccumulation(triggerPatterns: TriggerPattern[]): number {
  let score = 0;
  for (const pattern of triggerPatterns) {
    if (pattern.count >= 5) score += 3;
    else if (pattern.count >= 3) score += 2;
    else if (pattern.count >= 1) score += 1;
  }
  return Math.min(score, 10);
}

function getActiveTriggers(triggerPatterns: TriggerPattern[], signals: InputSignals): string[] {
  const active: string[] = [];
  for (const p of triggerPatterns) { if (p.count >= 2) active.push(p.trigger); }
  if (signals.cravingMention) active.push('craving_active');
  if (signals.isolationSignal) active.push('isolation');
  if (signals.hopelessness) active.push('hopelessness');
  if (signals.dissociation) active.push('dissociation');
  if (signals.passiveSuicidal) active.push('suicidal_passive');
  if (signals.activeSuicidal) active.push('suicidal_active');
  if (signals.selfHarm) active.push('self_harm');
  return [...new Set(active)];
}

function determineTone(riskLevel: RiskLevel, emotionalState: EmotionalState, moodTrend: MoodTrend, mood: MoodSliders, userType: UserType): ToneDirective {
  if (riskLevel === 'critical') return 'crisis';
  const distress = getDistressScore(mood, userType);
  const primaryConcern = getPrimaryConcern(mood, userType);
  const resilience = getResilienceScore(mood, userType);
  if (primaryConcern > 6 && distress >= 6) return 'grounding';
  if (distress >= 6 && resilience <= 3) return 'grounding';
  if (emotionalState === 'depleted') return 'warm';
  if (moodTrend === 'volatile') return 'grounding';
  if (emotionalState === 'vulnerable' && moodTrend === 'declining') return 'assertive';
  if (emotionalState === 'vulnerable') return 'warm';
  return 'warm';
}

function determinePacing(riskLevel: RiskLevel, emotionalState: EmotionalState): PacingDirective {
  if (riskLevel === 'critical' || riskLevel === 'high') return 'very_slow';
  if (emotionalState === 'depleted' || emotionalState === 'vulnerable') return 'slower';
  return 'normal';
}

function computeSuggestionIntensity(riskLevel: RiskLevel, mood: MoodSliders, userType: UserType, moodTrend: MoodTrend, totalSessions: number): number {
  let intensity = 5;
  const distress = getDistressScore(mood, userType);
  const primaryConcern = getPrimaryConcern(mood, userType);
  const resilience = getResilienceScore(mood, userType);
  if (primaryConcern >= 7) intensity += 2;
  if (primaryConcern >= 8) intensity += 1;
  if (distress >= 5.5) intensity += 1;
  if (moodTrend === 'declining') intensity += 1;
  if (riskLevel === 'high' || riskLevel === 'critical') intensity += 1;
  if (totalSessions < 3) intensity -= 1;
  if (resilience <= 2) intensity -= 1;
  return Math.max(1, Math.min(10, intensity));
}

function selectPriorityModules(userType: UserType, mood: MoodSliders, moodTrend: MoodTrend, signals: InputSignals, activeTriggers: string[]): string[] {
  const modules: string[] = [];
  if (userType === 'elias') {
    const eliasModules = computeEliasPriorityModules(mood, [], moodTrend);
    const signalModules = eliasSignalToModules(signals);
    for (const m of signalModules) { if (!eliasModules.includes(m)) modules.push(m); }
    modules.push(...eliasModules);
    if (modules.length === 0) modules.push(ELIAS_DEFAULT_MODULE);
  } else {
    return selectKimPriorityModules(mood, signals, activeTriggers);
  }
  return [...new Set(modules)].slice(0, 3);
}

function buildStateSummary(mood: MoodSliders, userType: UserType, moodTrend: MoodTrend, riskLevel: RiskLevel, emotionalState: EmotionalState, activeTriggers: string[], priorityModules: string[]): string {
  const parts: string[] = [];
  const config = getSliderConfig(userType);
  for (const sc of config) parts.push(`${sc.label}: ${getSlider(mood, sc.key)}/${sc.max}`);
  parts.push(`Trend: ${moodTrend}`);
  parts.push(`Risk: ${riskLevel}`);
  parts.push(`State: ${emotionalState}`);
  if (activeTriggers.length > 0) parts.push(`Triggers: ${activeTriggers.join(', ')}`);
  parts.push(`Modules: ${priorityModules.join(', ')}`);
  return parts.join(' | ');
}

// ─── Main Analysis Function (identical logic to client) ───────────────

interface RugzakLike {
  userType: UserType;
  currentMood: MoodSliders;
  moodHistory: MoodSnapshot[];
  triggerPatterns: TriggerPattern[];
  totalSessions: number;
}

export function analyzeStateServer(rugzak: RugzakLike | null | undefined, inputText: string): StateAnalysis {
  const userType: UserType = rugzak?.userType ?? 'elias';
  const defaultMood = createDefaultSliders(userType);
  const currentMood = rugzak?.currentMood ?? defaultMood;
  const moodHistory = rugzak?.moodHistory ?? [];
  const triggerPatterns = rugzak?.triggerPatterns ?? [];
  const totalSessions = rugzak?.totalSessions ?? 0;

  const signals = detectInputSignals(inputText);
  const moodTrend = analyzeMoodTrend(moodHistory, userType);
  const patternAccumulation = computePatternAccumulation(triggerPatterns);
  const activeTriggers = getActiveTriggers(triggerPatterns, signals);
  const riskLevel = assessRiskLevel(currentMood, userType, moodTrend, signals, patternAccumulation);
  const emotionalState = assessEmotionalState(currentMood, userType, moodTrend, riskLevel, signals);
  const priorityModules = selectPriorityModules(userType, currentMood, moodTrend, signals, activeTriggers);
  const tone = determineTone(riskLevel, emotionalState, moodTrend, currentMood, userType);
  const pacing = determinePacing(riskLevel, emotionalState);
  const suggestionIntensity = computeSuggestionIntensity(riskLevel, currentMood, userType, moodTrend, totalSessions);
  const crisisMonitoring = riskLevel === 'high' || riskLevel === 'critical';
  const crisisThresholdLowered = patternAccumulation >= 3 || moodTrend === 'declining';
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
