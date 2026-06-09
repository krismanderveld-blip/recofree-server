/**
 * KIM PROGRESS TRACKER — Local caregiver load visibility engine.
 *
 * Reads ONLY Kim data (moodHistory, moduleUsage, repeatingPatterns).
 * Never reads Elias data.
 * Engine computes all trends — GPT only formulates human-readable output.
 * No gamification. No scores. No diagnosis. No cloud sync.
 * Streaks never create shame or pressure.
 * Negative signals are never "failure" or "bad caregiving".
 */

import type { MoodSnapshot, ModuleUsageRecord, RepeatingPattern } from '@/lib/ai/types';

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

export interface KimProgressSummary {
  persona: 'kim';
  windows: { days7: ComputedTrend[]; days30: ComputedTrend[] };
  activeModules: { moduleId: string; count: number; lastUsed: string }[];
  negativeSignals: {
    softened: string[];
    increased: string[];
    stable: string[];
    insufficientData: string[];
  };
  selfCare: {
    trend7: TrendDirection;
    trend30: TrendDirection;
    displayCopy: string;
  };
  repeatingPatterns: { theme: string; sessionCount: number; progressionDetected: boolean }[];
  generatedAt: string;
}

export interface KimProgressDetectionResult {
  moduleId: 'PROGRESS_TRACKER';
  persona: 'kim';
  activationStatus: ProgressActivationStatus;
  confidenceScore: number;
  reason: string;
}

export interface KimProgressInput {
  intakeCompleted: boolean;
  crisisProtocolStatus: 'CLEAR' | 'MONITOR' | 'ACTIVE';
  requestContext: 'home' | 'profile' | 'progress_screen' | 'post_session' | 'chat_request';
  latestUserMessage?: string;
  moodHistory: MoodSnapshot[];
  moduleUsage: ModuleUsageRecord[];
  repeatingPatterns: RepeatingPattern[];
  timestampIso: string;
}

// ─── Detector ────────────────────────────────────────────────────────────────

export function detectKimProgress(input: KimProgressInput): KimProgressDetectionResult {
  if (!input.intakeCompleted) {
    return {
      moduleId: 'PROGRESS_TRACKER',
      persona: 'kim',
      activationStatus: 'BLOCKED_BY_INTAKE',
      confidenceScore: 0,
      reason: 'Intake incomplete.',
    };
  }

  if (input.crisisProtocolStatus === 'ACTIVE' && input.requestContext !== 'post_session') {
    return {
      moduleId: 'PROGRESS_TRACKER',
      persona: 'kim',
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
    'hoe is mijn stress', 'hoe gaat mijn zelfzorg', 'how is my self-care',
    'laatste 30 dagen', 'last 30 days',
  ];
  if (markers.some((m) => msg.includes(m))) score = Math.max(score, 0.95);

  if (score < 0.60) {
    return {
      moduleId: 'PROGRESS_TRACKER',
      persona: 'kim',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore: score,
      reason: 'No progress request detected.',
    };
  }

  return {
    moduleId: 'PROGRESS_TRACKER',
    persona: 'kim',
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
    // For positive signals (selfCare): UP = softened (improving), DOWN = increased (worsening)
    interpretation = direction === 'UP' ? 'softened' : direction === 'DOWN' ? 'increased' : 'stable';
  } else {
    // For negative signals (stress, burden): DOWN = softened, UP = increased
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

// ─── Main Computation ────────────────────────────────────────────────────────

export function computeKimProgress(input: KimProgressInput): KimProgressSummary {
  const nowMs = new Date(input.timestampIso).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  // Extract per-slider trend points from moodHistory
  const sliderKeys = ['stress', 'boundaryFatigue', 'emotionalBurden', 'selfCare'] as const;
  const sliderLabels: Record<string, string> = {
    stress: 'Stress',
    boundaryFatigue: 'Boundary fatigue',
    emotionalBurden: 'Emotional burden',
    selfCare: 'Self-care',
  };
  const positiveKeys = new Set(['selfCare']);

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
  const negativeSignals: KimProgressSummary['negativeSignals'] = {
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

  // Self-care specific trends
  const selfCareTrend7 = days7.find((t) => t.key === 'selfCare');
  const selfCareTrend30 = days30.find((t) => t.key === 'selfCare');

  let selfCareDisplayCopy: string;
  if (!selfCareTrend7 || selfCareTrend7.direction === 'INSUFFICIENT_DATA') {
    selfCareDisplayCopy = 'Not enough self-care data yet.';
  } else if (selfCareTrend7.direction === 'UP') {
    selfCareDisplayCopy = 'Self-care check-ins increased this week. This is not a score of goodness.';
  } else if (selfCareTrend7.direction === 'DOWN') {
    selfCareDisplayCopy = 'Self-care was lower this week. This is a signal, not a judgment.';
  } else {
    selfCareDisplayCopy = 'Self-care has been stable. This is a view of your load, not your worth.';
  }

  const selfCare: KimProgressSummary['selfCare'] = {
    trend7: selfCareTrend7?.direction ?? 'INSUFFICIENT_DATA',
    trend30: selfCareTrend30?.direction ?? 'INSUFFICIENT_DATA',
    displayCopy: selfCareDisplayCopy,
  };

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

  // Repeating patterns
  const repeatingPatterns = (input.repeatingPatterns || []).map((p) => ({
    theme: p.theme,
    sessionCount: p.sessionCount,
    progressionDetected: p.progressionDetected,
  }));

  return {
    persona: 'kim',
    windows: { days7, days30 },
    activeModules,
    negativeSignals,
    selfCare,
    repeatingPatterns,
    generatedAt: input.timestampIso,
  };
}

// ─── Prompt Payload Builder ──────────────────────────────────────────────────

export interface KimProgressPromptPayload {
  moduleId: 'PROGRESS_TRACKER';
  persona: 'kim';
  summary: KimProgressSummary;
  compactInstruction: string;
  forbiddenOutput: string[];
  gptMayCalculate: false;
  gptMayAccessRawDat: false;
}

export function buildKimProgressPromptPayload(
  summary: KimProgressSummary
): KimProgressPromptPayload {
  return {
    moduleId: 'PROGRESS_TRACKER',
    persona: 'kim',
    summary,
    compactInstruction:
      'Explain the caregiver progress summary gently. Do not calculate. Do not diagnose. Do not shame. Self-care trend is factual, not a score of goodness. Boundary fatigue increase is a signal, not weakness. Stress reduction does not imply the addiction is resolved. Crisis overrides.',
    forbiddenOutput: [
      'You are failing as a caregiver',
      'Your score is bad',
      'You are not doing enough',
      'The addiction is getting better because of you',
      'Kim and Elias combined progress shows',
      'This proves diagnosis',
      'You improved because of the app',
    ],
    gptMayCalculate: false,
    gptMayAccessRawDat: false,
  };
}
