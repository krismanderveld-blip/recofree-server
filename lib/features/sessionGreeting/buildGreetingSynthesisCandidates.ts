/**
 * Session Greeting V3 — Synthesis Candidate Builder
 *
 * Builds a list of eligible synthesis sources with relevance scores.
 * Each source is scored 0.0 - 1.0 based on freshness, emotional weight, and recency.
 *
 * Source types:
 * - TODAY_MOOD: sliders filled today → mood metric interpretation
 * - RECENT_DIARY: diary < 3 days → safe anchor text
 * - RECENT_GRATITUDE: gratitude < 3 days → safe anchor text
 * - BACKPACK_RECENT_UPDATE: backpack < 24h → generic acknowledgment
 * - ACTIVE_HOPE_OR_FEAR: active projection with decay >= 0.60
 * - SCHEMA_ROTATION: every 4th session, cycle through schemas
 */

import type {
  GreetingFreshnessResult,
  GreetingUserDatSnapshot,
  GreetingStateDatSnapshot,
  GreetingProjectionsDatSnapshot,
  GreetingDiaryMetadata,
  GreetingGratitudeMetadata,
} from './sessionGreeting.types';
import type {
  GreetingSynthesisCandidate,
  MoodMetricSelection,
} from './sessionGreetingV3.types';
import {
  V3_ACTIVE_PROJECTION_DECAY_THRESHOLD,
  V3_SCHEMA_ROTATION_INTERVAL,
} from './sessionGreetingV3.types';
import { selectMostEmotionallyRelevantMoodMetric, buildMoodSafeAnchor } from './selectMoodMetric';
import { resolveSchemaRotationAnchor } from './resolveSchemaRotationAnchor';

export interface BuildSynthesisCandidatesInput {
  userDat: GreetingUserDatSnapshot | null;
  stateDat: GreetingStateDatSnapshot | null;
  projectionsDat: GreetingProjectionsDatSnapshot | null;
  diaryMetadata: GreetingDiaryMetadata | null;
  gratitudeMetadata: GreetingGratitudeMetadata | null;
  freshness: GreetingFreshnessResult;
}

export interface BuildSynthesisCandidatesResult {
  candidates: GreetingSynthesisCandidate[];
  moodMetric: MoodMetricSelection | null;
}

export function buildGreetingSynthesisCandidates(
  input: BuildSynthesisCandidatesInput,
): BuildSynthesisCandidatesResult {
  const { userDat, stateDat, projectionsDat, diaryMetadata, gratitudeMetadata, freshness } = input;
  const candidates: GreetingSynthesisCandidate[] = [];

  // ─── 1. TODAY_MOOD ──────────────────────────────────────────────────────────
  const moodMetric = selectMostEmotionallyRelevantMoodMetric(stateDat, freshness.slidersFilledToday);

  if (moodMetric) {
    const moodRelevance = computeMoodRelevance(moodMetric);
    candidates.push({
      sourceType: 'TODAY_MOOD',
      eligible: true,
      relevanceScore: moodRelevance,
      reason: `Mood metric: ${moodMetric.metricName}=${moodMetric.value} (${moodMetric.interpretation})`,
      safeAnchor: buildMoodSafeAnchor(moodMetric),
    });
  } else {
    candidates.push({
      sourceType: 'TODAY_MOOD',
      eligible: false,
      relevanceScore: 0,
      reason: freshness.slidersFilledToday ? 'Sliders filled but no notable metric' : 'Sliders not filled today',
      safeAnchor: '',
    });
  }

  // ─── 2. RECENT_DIARY ────────────────────────────────────────────────────────
  if (freshness.diaryRecentUnder3Days && diaryMetadata?.latestSafeAnchor) {
    const diaryAge = freshness.latestDiaryAgeInDays ?? 3;
    const diaryRelevance = computeRecencyRelevance(diaryAge, 3);
    candidates.push({
      sourceType: 'RECENT_DIARY',
      eligible: true,
      relevanceScore: diaryRelevance,
      reason: `Diary ${diaryAge.toFixed(1)} days old`,
      safeAnchor: diaryMetadata.latestSafeAnchor,
    });
  } else {
    candidates.push({
      sourceType: 'RECENT_DIARY',
      eligible: false,
      relevanceScore: 0,
      reason: 'No recent diary under 3 days',
      safeAnchor: '',
    });
  }

  // ─── 3. RECENT_GRATITUDE ────────────────────────────────────────────────────
  if (freshness.gratitudeRecentUnder3Days && gratitudeMetadata?.latestSafeAnchor) {
    const gratAge = freshness.latestGratitudeAgeInDays ?? 3;
    const gratRelevance = computeRecencyRelevance(gratAge, 3) * 0.85; // slightly lower weight than diary
    candidates.push({
      sourceType: 'RECENT_GRATITUDE',
      eligible: true,
      relevanceScore: gratRelevance,
      reason: `Gratitude ${gratAge.toFixed(1)} days old`,
      safeAnchor: gratitudeMetadata.latestSafeAnchor,
    });
  } else {
    candidates.push({
      sourceType: 'RECENT_GRATITUDE',
      eligible: false,
      relevanceScore: 0,
      reason: 'No recent gratitude under 3 days',
      safeAnchor: '',
    });
  }

  // ─── 4. BACKPACK_RECENT_UPDATE ──────────────────────────────────────────────
  if (freshness.backpackRecentlyUpdatedUnder24h) {
    const bpAge = freshness.backpackAgeInHours ?? 24;
    const bpRelevance = computeRecencyRelevance(bpAge / 24, 1) * 0.70; // lower base weight
    candidates.push({
      sourceType: 'BACKPACK_RECENT_UPDATE',
      eligible: true,
      relevanceScore: bpRelevance,
      reason: `Backpack updated ${bpAge.toFixed(1)}h ago`,
      safeAnchor: 'je rugzak is recent bijgewerkt',
    });
  } else {
    candidates.push({
      sourceType: 'BACKPACK_RECENT_UPDATE',
      eligible: false,
      relevanceScore: 0,
      reason: 'Backpack not updated in last 24h',
      safeAnchor: '',
    });
  }

  // ─── 5. ACTIVE_HOPE_OR_FEAR ─────────────────────────────────────────────────
  const fears = projectionsDat?.fears ?? [];
  const activeFear = fears
    .filter(f => f.decayScore >= V3_ACTIVE_PROJECTION_DECAY_THRESHOLD)
    .sort((a, b) => b.decayScore - a.decayScore)[0] ?? null;

  if (activeFear) {
    candidates.push({
      sourceType: 'ACTIVE_HOPE_OR_FEAR',
      eligible: true,
      relevanceScore: Math.min(activeFear.decayScore, 0.90), // cap at 0.90
      reason: `Active fear: "${activeFear.label}" (decay=${activeFear.decayScore})`,
      safeAnchor: activeFear.label,
    });
  } else {
    candidates.push({
      sourceType: 'ACTIVE_HOPE_OR_FEAR',
      eligible: false,
      relevanceScore: 0,
      reason: 'No active fear/hope above threshold',
      safeAnchor: '',
    });
  }

  // ─── 6. SCHEMA_ROTATION ─────────────────────────────────────────────────────
  const sessionNumber = userDat?.sessionStats.currentSessionNumber ?? 0;
  const schemaResult = resolveSchemaRotationAnchor({
    currentSessionNumber: sessionNumber,
    schemaTendencies: userDat?.schemaTendencies ?? [],
    rotationState: userDat?.sessionStats.schemaRotationState,
  });

  if (schemaResult.selectedSchema) {
    candidates.push({
      sourceType: 'SCHEMA_ROTATION',
      eligible: true,
      relevanceScore: 0.65, // fixed moderate relevance — it's a rotation, not urgency
      reason: schemaResult.reason,
      safeAnchor: `thema rond ${schemaResult.selectedSchema.schemaName}`,
    });
  } else {
    candidates.push({
      sourceType: 'SCHEMA_ROTATION',
      eligible: false,
      relevanceScore: 0,
      reason: schemaResult.reason,
      safeAnchor: '',
    });
  }

  return { candidates, moodMetric };
}

// ─── Scoring Helpers ──────────────────────────────────────────────────────────

/**
 * Computes relevance based on recency (0 = max age, 1 = just now).
 * Linear decay from 1.0 to 0.3 over the maxAge window.
 */
function computeRecencyRelevance(ageInUnits: number, maxAgeInUnits: number): number {
  if (ageInUnits <= 0) return 1.0;
  if (ageInUnits >= maxAgeInUnits) return 0.3;
  return 1.0 - (ageInUnits / maxAgeInUnits) * 0.7;
}

/**
 * Computes mood relevance based on interpretation.
 */
function computeMoodRelevance(metric: MoodMetricSelection): number {
  switch (metric.interpretation) {
    case 'high_alarm': return 0.95;
    case 'elevated': return 0.80;
    case 'positive': return 0.70;
    case 'neutral': return 0.50;
    default: return 0.40;
  }
}
