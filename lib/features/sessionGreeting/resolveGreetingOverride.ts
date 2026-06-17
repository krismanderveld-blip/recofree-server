/**
 * Session Greeting V3 — Override Resolution (with Absence Awareness)
 *
 * Determines if the greeting should bypass or prefix synthesis.
 *
 * Priority order:
 * 1. CRISIS_OR_HIGH_CRAVING — bypasses everything
 * 2. FIRST_SESSION — no prior session to compare
 * 3. RETURN_AFTER_ABSENCE — acknowledges return, optional synthesis (max 2 sources)
 * 4. MISSING_DATA — no fresh data available
 * 5. NONE — normal synthesis
 */

import type {
  GreetingFreshnessResult,
  GreetingUserDatSnapshot,
  GreetingStateDatSnapshot,
} from './sessionGreeting.types';
import type {
  GreetingOverrideResult,
  GreetingSynthesisCandidate,
} from './sessionGreetingV3.types';
import { V3_CRISIS_CRAVING_THRESHOLD, V3_CRISIS_ZONES } from './sessionGreetingV3.types';
import type { SessionAbsenceResult } from './calculateSessionAbsence';

export interface ResolveGreetingOverrideInput {
  userDat: GreetingUserDatSnapshot | null;
  stateDat: GreetingStateDatSnapshot | null;
  freshness: GreetingFreshnessResult;
  synthesisCandidates: GreetingSynthesisCandidate[];
  absence: SessionAbsenceResult;
}

/**
 * Returns an override result describing the greeting mode.
 * - shouldBypassSynthesis: true means no synthesis sources at all
 * - shouldPrefixSynthesisWithAbsence: true means absence acknowledgement first, then optional sources
 */
export function resolveGreetingOverride(
  input: ResolveGreetingOverrideInput,
): GreetingOverrideResult | null {
  const { userDat, stateDat, freshness, absence } = input;

  // 1. CRISIS_OR_HIGH_CRAVING — craving >= 7 (today) OR vspZone in [ROOD, PAARS, ORANJE]
  const craving = stateDat?.currentMood?.craving ?? 0;
  const vspZone = (stateDat?.vspZone ?? '').toUpperCase();
  const cravingCrisis = craving >= V3_CRISIS_CRAVING_THRESHOLD && freshness.slidersFilledToday;
  const zoneCrisis = V3_CRISIS_ZONES.includes(vspZone);

  if (cravingCrisis || zoneCrisis) {
    return {
      mode: 'CRISIS_OVERRIDE',
      shouldBypassSynthesis: true,
      shouldPrefixSynthesisWithAbsence: false,
      reason: cravingCrisis
        ? `High craving today: craving=${craving}`
        : `Crisis zone active: vspZone=${vspZone}`,
      payload: { craving, vspZone },
    };
  }

  // 2. FIRST_SESSION — totalSessionsStarted === 0
  const totalSessions = userDat?.sessionStats.totalSessionsStarted ?? 0;
  if (totalSessions === 0) {
    return {
      mode: 'FIRST_SESSION',
      shouldBypassSynthesis: true,
      shouldPrefixSynthesisWithAbsence: false,
      reason: 'First session ever (totalSessionsStarted=0)',
      payload: { userName: userDat?.userName ?? null },
    };
  }

  // 3. RETURN_AFTER_ABSENCE — absence >= 3 days
  if (absence.isReturnAfterAbsence) {
    return {
      mode: 'RETURN_AFTER_ABSENCE',
      shouldBypassSynthesis: false, // may include up to 2 sources
      shouldPrefixSynthesisWithAbsence: true,
      reason: `Return after absence: band=${absence.band}, days=${absence.absenceDaysExact?.toFixed(1) ?? 'unknown'}`,
      payload: { band: absence.band, absenceDays: absence.absenceDaysExact },
    };
  }

  // 4. MISSING_DATA — no sliders today AND no recent diary AND no recent gratitude AND no backpack AND no logs.dat
  // logs.dat with open loops or a digest counts as valid context (session continuity)
  const hasLogsDatContext = input.synthesisCandidates.some(
    c => c.sourceType === 'LAST_SESSION_SUMMARY' && c.eligible
  );
  const hasAnyFreshData =
    freshness.slidersFilledToday ||
    freshness.diaryRecentUnder3Days ||
    freshness.gratitudeRecentUnder3Days ||
    freshness.backpackRecentlyUpdatedUnder24h ||
    hasLogsDatContext;

  if (!hasAnyFreshData) {
    return {
      mode: 'MISSING_DATA',
      shouldBypassSynthesis: true,
      shouldPrefixSynthesisWithAbsence: false,
      reason: 'No fresh data available (no sliders, no recent diary/gratitude, no backpack update)',
      payload: {
        missingSlidersToday: !freshness.slidersFilledToday,
        diaryOlderThan3Days: !freshness.diaryRecentUnder3Days,
        gratitudeOlderThan3Days: !freshness.gratitudeRecentUnder3Days,
      },
    };
  }

  // 5. NONE — proceed with normal synthesis
  return null;
}
