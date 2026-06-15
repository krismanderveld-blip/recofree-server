/**
 * Session Greeting V3 — Override Resolution
 *
 * Determines if the greeting should bypass synthesis entirely.
 * Override modes: CRISIS_OVERRIDE, FIRST_SESSION, MISSING_DATA
 *
 * Priority: FIRST_SESSION > CRISIS_OVERRIDE > MISSING_DATA
 * If an override is returned, synthesis is skipped.
 */

import type {
  GreetingFreshnessResult,
  GreetingUserDatSnapshot,
  GreetingStateDatSnapshot,
} from './sessionGreeting.types';
import type { GreetingOverrideResult } from './sessionGreetingV3.types';
import { V3_CRISIS_CRAVING_THRESHOLD, V3_CRISIS_ZONES } from './sessionGreetingV3.types';

export interface ResolveGreetingOverrideInput {
  userDat: GreetingUserDatSnapshot | null;
  stateDat: GreetingStateDatSnapshot | null;
  freshness: GreetingFreshnessResult;
}

/**
 * Returns an override result if the greeting should bypass synthesis,
 * or null if synthesis should proceed.
 */
export function resolveGreetingOverride(
  input: ResolveGreetingOverrideInput,
): GreetingOverrideResult | null {
  const { userDat, stateDat, freshness } = input;

  // 1. FIRST_SESSION — totalSessionsStarted === 0
  const totalSessions = userDat?.sessionStats.totalSessionsStarted ?? 0;
  if (totalSessions === 0) {
    return {
      mode: 'FIRST_SESSION',
      reason: 'First session ever (totalSessionsStarted=0)',
      payload: { userName: userDat?.userName ?? null },
    };
  }

  // 2. CRISIS_OVERRIDE — craving >= 7 (today) OR vspZone in [ROOD, PAARS, ORANJE]
  const craving = stateDat?.currentMood?.craving ?? 0;
  const vspZone = (stateDat?.vspZone ?? '').toUpperCase();
  const cravingCrisis = craving >= V3_CRISIS_CRAVING_THRESHOLD && freshness.slidersFilledToday;
  const zoneCrisis = V3_CRISIS_ZONES.includes(vspZone);

  if (cravingCrisis || zoneCrisis) {
    return {
      mode: 'CRISIS_OVERRIDE',
      reason: cravingCrisis
        ? `High craving today: craving=${craving}`
        : `Crisis zone active: vspZone=${vspZone}`,
      payload: { craving, vspZone },
    };
  }

  // 3. MISSING_DATA — no sliders today AND no recent diary AND no recent gratitude
  const hasAnyFreshData =
    freshness.slidersFilledToday ||
    freshness.diaryRecentUnder3Days ||
    freshness.gratitudeRecentUnder3Days ||
    freshness.backpackRecentlyUpdatedUnder24h;

  if (!hasAnyFreshData) {
    return {
      mode: 'MISSING_DATA',
      reason: 'No fresh data available (no sliders, no recent diary/gratitude, no backpack update)',
      payload: {
        missingSlidersToday: !freshness.slidersFilledToday,
        diaryOlderThan3Days: !freshness.diaryRecentUnder3Days,
        gratitudeOlderThan3Days: !freshness.gratitudeRecentUnder3Days,
      },
    };
  }

  // No override — proceed with synthesis
  return null;
}
