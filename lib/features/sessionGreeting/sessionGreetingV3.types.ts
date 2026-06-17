/**
 * Session Greeting Engine V3 — Synthesis Types
 *
 * V3 replaces single-anchor selection with multi-source synthesis:
 * - Engine selects up to 3 sources deterministically
 * - GPT weaves selected sources into one natural greeting
 * - Crisis/First/Missing override modes bypass synthesis entirely
 */

import type {
  GreetingFreshnessResult,
  GreetingUserDatSnapshot,
  GreetingStateDatSnapshot,
  GreetingProjectionsDatSnapshot,
  GreetingLogsDatSnapshot,
  GreetingDiaryMetadata,
  GreetingGratitudeMetadata,
  GreetingSchemaRotationState,
  SessionGreetingInitInput,
} from './sessionGreeting.types';

// ─── Override Modes ─────────────────────────────────────────────────────────

export type GreetingOverrideMode =
  | 'CRISIS_OVERRIDE'
  | 'FIRST_SESSION'
  | 'RETURN_AFTER_ABSENCE'
  | 'MISSING_DATA';

export interface GreetingOverrideResult {
  mode: GreetingOverrideMode;
  shouldBypassSynthesis: boolean;
  shouldPrefixSynthesisWithAbsence: boolean;
  reason: string;
  payload: Record<string, unknown>;
}

// ─── Synthesis Source Types ─────────────────────────────────────────────────

export type GreetingSynthesisSourceType =
  | 'TODAY_MOOD'
  | 'RECENT_DIARY'
  | 'RECENT_GRATITUDE'
  | 'BACKPACK_RECENT_UPDATE'
  | 'ACTIVE_HOPE_OR_FEAR'
  | 'SCHEMA_ROTATION'
  | 'LAST_SESSION_SUMMARY'
  | 'RECURRING_PATTERN';

/**
 * A candidate synthesis source with relevance score.
 * The engine scores and selects up to 3 sources.
 */
export interface GreetingSynthesisCandidate {
  sourceType: GreetingSynthesisSourceType;
  eligible: boolean;
  relevanceScore: number; // 0.0 - 1.0
  reason: string;
  safeAnchor: string; // The safe text snippet to pass to GPT
}

/**
 * A selected synthesis source (after selection from candidates).
 */
export interface SelectedSynthesisSource {
  sourceType: GreetingSynthesisSourceType;
  safeAnchor: string;
  relevanceScore: number;
}

// ─── Mood Metric Types ──────────────────────────────────────────────────────

export type MoodMetricName = 'craving' | 'despondency' | 'frustration' | 'focus';

/**
 * Priority order for mood metrics (most emotionally relevant first):
 * craving > despondency > frustration > focus
 */
export const MOOD_METRIC_PRIORITY: MoodMetricName[] = [
  'craving',
  'despondency',
  'frustration',
  'focus',
];

export interface MoodMetricSelection {
  metricName: MoodMetricName;
  value: number;
  interpretation: 'high_alarm' | 'elevated' | 'neutral' | 'positive';
}

// ─── V3 Prompt Payload ──────────────────────────────────────────────────────

export interface GreetingSynthesisPromptPayload {
  persona: 'elias';
  userName: string;
  mode: GreetingSynthesisMode;
  maxSentences: 4;
  selectedSources: SelectedSynthesisSource[];
  absence?: SessionAbsenceResultForPrompt;
  synthesisInstruction: string;
  openQuestionInstruction: string;
  forbiddenPatterns: string[];
  languageRule: string;
}

// ─── V3 Engine Result ───────────────────────────────────────────────────────

export interface SessionGreetingV3Result {
  greeting: string;
  mode: GreetingSynthesisMode;
  selectedSources: SelectedSynthesisSource[];
  override: GreetingOverrideResult | null;
  absence: import('./calculateSessionAbsence').SessionAbsenceResult;
  debugLog: string;
  estimatedTokens: number;
}

// ─── V3 Debug ───────────────────────────────────────────────────────────────

export interface SessionGreetingV3Debug {
  nowIso: string;
  sessionNumber: number;
  freshness: GreetingFreshnessResult;
  absence: import('./calculateSessionAbsence').SessionAbsenceResult;
  override: GreetingOverrideResult | null;
  synthesisCandidates: GreetingSynthesisCandidate[];
  selectedSources: SelectedSynthesisSource[];
  moodMetric: MoodMetricSelection | null;
  mode: GreetingSynthesisMode;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Crisis thresholds */
export const V3_CRISIS_CRAVING_THRESHOLD = 7;
export const V3_CRISIS_ZONES = ['ROOD', 'PAARS'];

/** Freshness thresholds */
export const V3_DIARY_MAX_AGE_DAYS = 3;
export const V3_GRATITUDE_MAX_AGE_DAYS = 3;
export const V3_BACKPACK_MAX_AGE_HOURS = 24;

/** Selection limits — V3.1: raised to 8 so ALL eligible sources reach GPT */
export const V3_MAX_SYNTHESIS_SOURCES = 8;

/** Mood thresholds */
export const V3_MOOD_HIGH_ALARM_THRESHOLD = 7; // craving/despondency/frustration
export const V3_MOOD_ELEVATED_THRESHOLD = 5;
export const V3_FOCUS_POSITIVE_THRESHOLD = 7; // focus is inverted: high = good

/** Schema rotation interval */
export const V3_SCHEMA_ROTATION_INTERVAL = 4;

/** Active fear/hope decay threshold */
export const V3_ACTIVE_PROJECTION_DECAY_THRESHOLD = 0.60;

// ─── Synthesis Mode (V3 + Absence) ────────────────────────────────────────────

export type GreetingSynthesisMode =
  | 'SYNTHESIS'
  | 'CRISIS_OVERRIDE'
  | 'FIRST_SESSION'
  | 'RETURN_AFTER_ABSENCE'
  | 'MISSING_DATA';

/**
 * Absence result subset safe for GPT prompt (no raw timestamps).
 */
export interface SessionAbsenceResultForPrompt {
  band: import('./calculateSessionAbsence').SessionAbsenceBand;
  absenceDaysRounded: number | null; // rounded to 1 decimal
  wordingHint: 'short_return' | 'return_after_absence' | 'long_return_soft';
}
