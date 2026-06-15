/**
 * Builds the list of greeting anchor candidates with eligibility flags.
 */

import type {
  GreetingAnchorCandidate,
  GreetingFreshnessResult,
  GreetingUserDatSnapshot,
  GreetingStateDatSnapshot,
  GreetingProjectionsDatSnapshot,
  GreetingLogsDatSnapshot,
  GreetingDiaryMetadata,
  GreetingGratitudeMetadata,
} from './sessionGreeting.types';
import { resolveSchemaRotationAnchor } from './resolveSchemaRotationAnchor';

export interface BuildGreetingAnchorCandidatesInput {
  nowIso: string;
  userDat: GreetingUserDatSnapshot | null;
  stateDat: GreetingStateDatSnapshot | null;
  projectionsDat: GreetingProjectionsDatSnapshot | null;
  logsDat: GreetingLogsDatSnapshot | null;
  diaryMetadata: GreetingDiaryMetadata | null;
  gratitudeMetadata: GreetingGratitudeMetadata | null;
  freshness: GreetingFreshnessResult;
}

const CRISIS_CRAVING_THRESHOLD = 7;
const CRISIS_ZONES = ['ROOD', 'PAARS'];
const ACTIVE_FEAR_DECAY_THRESHOLD = 0.60;
const NOTABLE_MOOD_THRESHOLD = 6;

export function buildGreetingAnchorCandidates(input: BuildGreetingAnchorCandidatesInput): GreetingAnchorCandidate[] {
  const { userDat, stateDat, projectionsDat, diaryMetadata, gratitudeMetadata, freshness } = input;
  const candidates: GreetingAnchorCandidate[] = [];

  const sessionNumber = userDat?.sessionStats.currentSessionNumber
    ?? userDat?.sessionStats.totalSessionsStarted
    ?? 0;

  // 1. FIRST_SESSION
  const isFirstSession = (userDat?.sessionStats.totalSessionsStarted ?? 0) === 0;
  candidates.push({
    anchorType: 'FIRST_SESSION',
    eligible: isFirstSession,
    reason: isFirstSession ? 'First session ever (totalSessionsStarted=0)' : 'Not first session',
  });

  // 2. CRISIS_OR_HIGH_CRAVING
  const craving = stateDat?.currentMood?.craving ?? 0;
  const vspZone = stateDat?.vspZone ?? '';
  const isCrisis = (craving >= CRISIS_CRAVING_THRESHOLD && freshness.slidersFilledToday)
    || CRISIS_ZONES.includes(vspZone.toUpperCase());
  candidates.push({
    anchorType: 'CRISIS_OR_HIGH_CRAVING',
    eligible: isCrisis,
    reason: isCrisis
      ? `Crisis detected: craving=${craving}, zone=${vspZone}`
      : `No crisis: craving=${craving}, zone=${vspZone}`,
    payload: isCrisis ? { craving, vspZone } : undefined,
  });

  // 3. ACTIVE_PROJECTION_FEAR
  const fears = projectionsDat?.fears ?? [];
  const activeFear = fears
    .filter(f => f.decayScore >= ACTIVE_FEAR_DECAY_THRESHOLD)
    .sort((a, b) => b.decayScore - a.decayScore)[0] ?? null;
  const hasActiveFear = activeFear !== null;
  candidates.push({
    anchorType: 'ACTIVE_PROJECTION_FEAR',
    eligible: hasActiveFear,
    reason: hasActiveFear
      ? `Active fear: "${activeFear.label}" (decayScore=${activeFear.decayScore})`
      : 'No active fear above threshold',
    payload: hasActiveFear ? { fearLabel: activeFear.label, decayScore: activeFear.decayScore } : undefined,
  });

  // 4. TODAY_MOOD_SLIDERS
  let notableMoodMetric: { name: string; value: number } | null = null;
  if (freshness.slidersFilledToday && stateDat?.currentMood) {
    const mood = stateDat.currentMood;
    const metrics = Object.entries(mood)
      .filter(([_, v]) => typeof v === 'number')
      .sort(([, a], [, b]) => (b as number) - (a as number));
    const highest = metrics[0];
    if (highest && (highest[1] as number) >= NOTABLE_MOOD_THRESHOLD) {
      notableMoodMetric = { name: highest[0], value: highest[1] as number };
    }
  }
  const hasTodayMood = notableMoodMetric !== null;
  candidates.push({
    anchorType: 'TODAY_MOOD_SLIDERS',
    eligible: hasTodayMood,
    reason: hasTodayMood
      ? `Notable mood: ${notableMoodMetric!.name}=${notableMoodMetric!.value}`
      : freshness.slidersFilledToday ? 'Sliders filled but no notable value' : 'Sliders not filled today',
    payload: hasTodayMood ? { notableMetric: notableMoodMetric!.name, notableValue: notableMoodMetric!.value } : undefined,
  });

  // 5. RECENT_DIARY
  const hasDiary = freshness.diaryRecentUnder3Days && !!diaryMetadata?.latestSafeAnchor;
  candidates.push({
    anchorType: 'RECENT_DIARY',
    eligible: hasDiary,
    reason: hasDiary
      ? `Recent diary (${freshness.latestDiaryAgeInDays?.toFixed(1)} days)`
      : 'No recent diary under 3 days',
    payload: hasDiary ? { latestSafeAnchor: diaryMetadata!.latestSafeAnchor } : undefined,
  });

  // 6. RECENT_GRATITUDE
  const hasGratitude = freshness.gratitudeRecentUnder3Days && !!gratitudeMetadata?.latestSafeAnchor;
  candidates.push({
    anchorType: 'RECENT_GRATITUDE',
    eligible: hasGratitude,
    reason: hasGratitude
      ? `Recent gratitude (${freshness.latestGratitudeAgeInDays?.toFixed(1)} days)`
      : 'No recent gratitude under 3 days',
    payload: hasGratitude ? { latestSafeAnchor: gratitudeMetadata!.latestSafeAnchor } : undefined,
  });

  // 7. BACKPACK_RECENT_UPDATE
  const hasBackpackUpdate = freshness.backpackRecentlyUpdatedUnder24h;
  candidates.push({
    anchorType: 'BACKPACK_RECENT_UPDATE',
    eligible: hasBackpackUpdate,
    reason: hasBackpackUpdate
      ? `Backpack updated ${freshness.backpackAgeInHours?.toFixed(1)}h ago`
      : 'Backpack not updated in last 24h',
  });

  // 8. SCHEMA_ROTATION
  const schemaRotation = resolveSchemaRotationAnchor({
    currentSessionNumber: sessionNumber,
    schemaTendencies: userDat?.schemaTendencies ?? [],
    rotationState: userDat?.sessionStats.schemaRotationState,
  });
  const hasSchemaRotation = schemaRotation.selectedSchema !== null;
  candidates.push({
    anchorType: 'SCHEMA_ROTATION',
    eligible: hasSchemaRotation,
    reason: schemaRotation.reason,
    payload: hasSchemaRotation
      ? { schemaName: schemaRotation.selectedSchema!.schemaName, schemaId: schemaRotation.selectedSchema!.schemaId, nextRotationState: schemaRotation.nextRotationState }
      : undefined,
  });

  // 9. MISSING_DATA_INVITATION (always eligible as fallback, but only selected if nothing else)
  candidates.push({
    anchorType: 'MISSING_DATA_INVITATION',
    eligible: true,
    reason: 'Fallback: no higher anchor eligible',
    payload: {
      missingSlidersToday: !freshness.slidersFilledToday,
      diaryOlderThan3Days: !freshness.diaryRecentUnder3Days,
      gratitudeOlderThan3Days: !freshness.gratitudeRecentUnder3Days,
    },
  });

  return candidates;
}
