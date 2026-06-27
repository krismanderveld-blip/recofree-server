/**
 * ELIAS PROGRESS TRACKER — Local pattern visibility engine.
 *
 * Reads ONLY Elias data (moodHistory, moduleUsage, repeatingPatterns, sobrietyDate, projections).
 * Never reads Kim data.
 * Engine computes all trends — GPT only formulates human-readable output.
 * No gamification. No scores. No diagnosis. No cloud sync.
 * Streaks never create shame or pressure.
 * Negative signals are never "failure".
 */

import type { MoodSnapshot, ModuleUsageRecord, RepeatingPattern } from '@/lib/ai/types';
import type { EliasProjection, ProjectionEntry } from './projection';
import { tStatic } from '@/lib/i18n';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProgressWindow = 'DAYS_7' | 'DAYS_30';

export type TrendDirection = 'DOWN' | 'UP' | 'STABLE' | 'MIXED' | 'INSUFFICIENT_DATA';

export type TrendInterpretation = 'softened' | 'increased' | 'stable' | 'mixed' | 'not_enough_data';

export type ProgressActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'BLOCKED_BY_INTAKE'
  | 'BLOCKED_BY_CRISIS'
  | 'BLOCKED_BY_PERSONA_UNKNOWN';

export interface ComputedTrend {
  key: string;
  label: string;
  window: ProgressWindow;
  direction: TrendDirection;
  averageCurrent: number | null;
  averagePrevious: number | null;
  delta: number | null;
  validPointCount: number;
  interpretation: TrendInterpretation;
}

export interface EliasProgressSummary {
  persona: 'elias';
  windows: { days7: ComputedTrend[]; days30: ComputedTrend[] };
  activeModules: { moduleId: string; count: number; lastUsed: string }[];
  negativeSignals: {
    softened: string[];
    increased: string[];
    stable: string[];
    insufficientData: string[];
  };
  sobriety: {
    sobrietyDate: string | null;
    soberDays: number | null;
    relapseEventsInWindow7: number;
    relapseEventsInWindow30: number;
    displayCopy: string;
  };
  repeatingPatterns: { theme: string; sessionCount: number; progressionDetected: boolean }[];
  projectionMovement: {
    fearCount: number;
    hopeCount: number;
    dominantCategory: 'fear' | 'hope' | 'goal' | null;
    strongestFear: string | null;
    strongestHope: string | null;
  };
  generatedAt: string;
}

export interface EliasProgressDetectionResult {
  moduleId: 'PROGRESS_TRACKER';
  persona: 'elias';
  activationStatus: ProgressActivationStatus;
  confidenceScore: number;
  reason: string;
}

export interface EliasProgressInput {
  intakeCompleted: boolean;
  crisisProtocolStatus: 'CLEAR' | 'MONITOR' | 'ACTIVE';
  requestContext: 'home' | 'profile' | 'progress_screen' | 'post_session' | 'chat_request';
  latestUserMessage?: string;
  moodHistory: MoodSnapshot[];
  sobrietyDate: string | null;
  moduleUsage: ModuleUsageRecord[];
  repeatingPatterns: RepeatingPattern[];
  projection: EliasProjection | null;
  timestampIso: string;
}

// ─── Detector ────────────────────────────────────────────────────────────────

export function detectEliasProgress(input: EliasProgressInput): EliasProgressDetectionResult {
  if (!input.intakeCompleted) {
    return {
      moduleId: 'PROGRESS_TRACKER',
      persona: 'elias',
      activationStatus: 'BLOCKED_BY_INTAKE',
      confidenceScore: 0,
      reason: 'Intake incomplete.',
    };
  }

  if (input.crisisProtocolStatus === 'ACTIVE' && input.requestContext !== 'post_session') {
    return {
      moduleId: 'PROGRESS_TRACKER',
      persona: 'elias',
      activationStatus: 'BLOCKED_BY_CRISIS',
      confidenceScore: 1,
      reason: 'Crisis protocol overrides progress display.',
    };
  }

  let score = 0;
  if (input.requestContext === 'progress_screen') score = 0.90;
  else if (input.requestContext === 'profile') score = 0.75;
  else if (input.requestContext === 'home') score = 0.70;
  else if (input.requestContext === 'post_session') score = 0.65;
  else if (input.requestContext === 'chat_request') score = 0.60;

  const msg = (input.latestUserMessage || '').toLowerCase();
  const markers = [
    'toon mijn progressie', 'hoe gaat het', 'ben ik vooruit', 'gaat het beter',
    'show my progress', 'am i improving', 'how have i been', 'how was my week',
    'laatste 30 dagen', 'last 30 days', 'hoeveel dagen nuchter', 'how many sober days',
  ];
  if (markers.some((m) => msg.includes(m))) score = Math.max(score, 0.95);

  if (score < 0.60) {
    return {
      moduleId: 'PROGRESS_TRACKER',
      persona: 'elias',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore: score,
      reason: 'No progress request detected.',
    };
  }

  return {
    moduleId: 'PROGRESS_TRACKER',
    persona: 'elias',
    activationStatus: 'ACTIVE',
    confidenceScore: Math.min(score, 0.95),
    reason: 'Progress tracking activated.',
  };
}

// ─── Trend Computation ───────────────────────────────────────────────────────

interface TrendPoint {
  timestamp: number;
  value: number;
}

function computeTrendFromPoints(
  points: TrendPoint[],
  window: ProgressWindow,
  nowMs: number,
  key: string,
  label: string,
  isPositive: boolean
): ComputedTrend {
  const windowDays = window === 'DAYS_7' ? 7 : 30;
  const dayMs = 24 * 60 * 60 * 1000;
  const currentStart = nowMs - windowDays * dayMs;
  const previousStart = nowMs - windowDays * 2 * dayMs;

  const current = points.filter((p) => p.timestamp >= currentStart && p.timestamp <= nowMs);
  const previous = points.filter((p) => p.timestamp >= previousStart && p.timestamp < currentStart);

  if (current.length < 2) {
    return {
      key,
      label,
      window,
      direction: 'INSUFFICIENT_DATA',
      averageCurrent: null,
      averagePrevious: null,
      delta: null,
      validPointCount: current.length,
      interpretation: 'not_enough_data',
    };
  }

  const avg = (arr: TrendPoint[]) => arr.reduce((sum, p) => sum + p.value, 0) / arr.length;
  const averageCurrent = avg(current);
  const averagePrevious = previous.length >= 2 ? avg(previous) : averageCurrent;
  const delta = averageCurrent - averagePrevious;

  let direction: TrendDirection = 'STABLE';
  if (Math.abs(delta) < 0.25) direction = 'STABLE';
  else if (delta > 0) direction = 'UP';
  else direction = 'DOWN';

  // Interpretation depends on signal polarity
  let interpretation: TrendInterpretation;
  if (isPositive) {
    interpretation = direction === 'UP' ? 'softened' : direction === 'DOWN' ? 'increased' : 'stable';
  } else {
    interpretation = direction === 'DOWN' ? 'softened' : direction === 'UP' ? 'increased' : 'stable';
  }

  return {
    key,
    label,
    window,
    direction,
    averageCurrent,
    averagePrevious,
    delta,
    validPointCount: current.length,
    interpretation,
  };
}

// ─── Sobriety Computation ────────────────────────────────────────────────────

function computeSobriety(
  sobrietyDate: string | null,
  moodHistory: MoodSnapshot[],
  nowMs: number
): EliasProgressSummary['sobriety'] {
  const dayMs = 24 * 60 * 60 * 1000;
  let soberDays: number | null = null;

  if (sobrietyDate) {
    const startMs = new Date(sobrietyDate).getTime();
    soberDays = Math.max(0, Math.floor((nowMs - startMs) / dayMs));
  }

  // Count relapse events from mood history (VSP = ROOD or PAARS indicates relapse context)
  const window7Start = nowMs - 7 * dayMs;
  const window30Start = nowMs - 30 * dayMs;
  const relapseSnapshots = moodHistory.filter((s) => {
    const sliders = s.sliders as any;
    return sliders.vsp === 'ROOD' || sliders.vsp === 'PAARS';
  });

  const relapseEventsInWindow7 = relapseSnapshots.filter(
    (s) => new Date(s.timestamp).getTime() >= window7Start
  ).length;
  const relapseEventsInWindow30 = relapseSnapshots.filter(
    (s) => new Date(s.timestamp).getTime() >= window30Start
  ).length;

  let displayCopy: string;
  if (soberDays === null) {
    displayCopy = tStatic('progress_card.elias.sobriety.no_date');
  } else if (soberDays === 0) {
    displayCopy = tStatic('progress_card.elias.sobriety.day_zero');
  } else if (soberDays === 1) {
    displayCopy = tStatic('progress_card.elias.sobriety.day_one');
  } else {
    displayCopy = tStatic('progress_card.elias.sobriety.days', { days: soberDays });
  }

  return { sobrietyDate, soberDays, relapseEventsInWindow7, relapseEventsInWindow30, displayCopy };
}

// ─── Main Computation ────────────────────────────────────────────────────────

export function computeEliasProgress(input: EliasProgressInput): EliasProgressSummary {
  const nowMs = new Date(input.timestampIso).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  // Extract per-slider trend points from moodHistory
  const sliderKeys = ['craving', 'frustration', 'despondency', 'focus'] as const;
  const sliderLabels: Record<string, string> = {
    craving: tStatic('mood.slider.craving.label'),
    frustration: tStatic('mood.slider.frustration.label'),
    despondency: tStatic('mood.slider.despondency.label'),
    focus: tStatic('mood.slider.focus.label'),
  };
  const positiveKeys = new Set(['focus']);

  const sliderPoints: Record<string, TrendPoint[]> = {};
  for (const key of sliderKeys) {
    sliderPoints[key] = input.moodHistory.map((s) => ({
      timestamp: new Date(s.timestamp).getTime(),
      value: (s.sliders as any)[key] ?? 0,
    }));
  }

  // Compute trends for both windows
  const days7: ComputedTrend[] = [];
  const days30: ComputedTrend[] = [];

  for (const key of sliderKeys) {
    days7.push(computeTrendFromPoints(sliderPoints[key], 'DAYS_7', nowMs, key, sliderLabels[key], positiveKeys.has(key)));
    days30.push(computeTrendFromPoints(sliderPoints[key], 'DAYS_30', nowMs, key, sliderLabels[key], positiveKeys.has(key)));
  }

  // Classify negative signals
  const negativeSignals: EliasProgressSummary['negativeSignals'] = {
    softened: [],
    increased: [],
    stable: [],
    insufficientData: [],
  };

  for (const trend of days7) {
    if (trend.interpretation === 'softened') negativeSignals.softened.push(trend.label);
    else if (trend.interpretation === 'increased') negativeSignals.increased.push(trend.label);
    else if (trend.interpretation === 'stable') negativeSignals.stable.push(trend.label);
    else negativeSignals.insufficientData.push(trend.label);
  }

  // Active modules (last 30 days)
  const window30Start = nowMs - 30 * dayMs;
  const recentModules = input.moduleUsage.filter(
    (m) => new Date(m.usedAt).getTime() >= window30Start
  );
  const moduleMap: Record<string, { count: number; lastUsed: string }> = {};
  for (const m of recentModules) {
    if (!moduleMap[m.moduleId]) moduleMap[m.moduleId] = { count: 0, lastUsed: m.usedAt };
    moduleMap[m.moduleId].count += m.count;
    if (m.usedAt > moduleMap[m.moduleId].lastUsed) moduleMap[m.moduleId].lastUsed = m.usedAt;
  }
  const activeModules = Object.entries(moduleMap)
    .map(([moduleId, data]) => ({ moduleId, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Sobriety
  const sobriety = computeSobriety(input.sobrietyDate, input.moodHistory, nowMs);

  // Repeating patterns
  const repeatingPatterns = (input.repeatingPatterns || []).map((p) => ({
    theme: p.theme,
    sessionCount: p.sessionCount,
    progressionDetected: p.progressionDetected,
  }));

  // Projection movement
  let projectionMovement: EliasProgressSummary['projectionMovement'] = {
    fearCount: 0,
    hopeCount: 0,
    dominantCategory: null,
    strongestFear: null,
    strongestHope: null,
  };

  if (input.projection && input.projection.entries.length > 0) {
    const activeEntries = input.projection.entries.filter((e) => e.isActive);
    const fears = activeEntries.filter((e) => e.category === 'fear');
    const hopes = activeEntries.filter((e) => e.category === 'hope');
    const strongest = (arr: ProjectionEntry[]) =>
      arr.length > 0 ? arr.reduce((a, b) => (a.decayScore > b.decayScore ? a : b)) : null;

    projectionMovement = {
      fearCount: fears.length,
      hopeCount: hopes.length,
      dominantCategory:
        fears.length > hopes.length ? 'fear' : hopes.length > fears.length ? 'hope' : null,
      strongestFear: strongest(fears)?.content ?? null,
      strongestHope: strongest(hopes)?.content ?? null,
    };
  }

  return {
    persona: 'elias',
    windows: { days7, days30 },
    activeModules,
    negativeSignals,
    sobriety,
    repeatingPatterns,
    projectionMovement,
    generatedAt: input.timestampIso,
  };
}

// ─── Prompt Payload Builder ──────────────────────────────────────────────────

export interface EliasProgressPromptPayload {
  moduleId: 'PROGRESS_TRACKER';
  persona: 'elias';
  summary: EliasProgressSummary;
  compactInstruction: string;
  forbiddenOutput: string[];
  gptMayCalculate: false;
  gptMayAccessRawDat: false;
}

export function buildEliasProgressPromptPayload(
  summary: EliasProgressSummary
): EliasProgressPromptPayload {
  return {
    moduleId: 'PROGRESS_TRACKER',
    persona: 'elias',
    summary,
    compactInstruction:
      'Explain the progress summary gently. Do not calculate. Do not diagnose. Do not shame. Streaks are factual, not moral. Negative signals are context for support, not failure. Crisis overrides.',
    forbiddenOutput: [
      'You are failing',
      'You are back at zero',
      'Your score is bad',
      'You will relapse',
      'You are safe now',
      'This proves diagnosis',
      'You improved because of the app',
    ],
    gptMayCalculate: false,
    gptMayAccessRawDat: false,
  };
}
