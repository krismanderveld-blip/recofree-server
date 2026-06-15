/**
 * Evaluates freshness of all data sources for greeting anchor selection.
 */

import type {
  GreetingFreshnessResult,
  GreetingStateDatSnapshot,
  GreetingUserDatSnapshot,
  GreetingDiaryMetadata,
  GreetingGratitudeMetadata,
} from './sessionGreeting.types';
import { isSameLocalCalendarDay, getAgeInDays, getAgeInHours, isUnderDays, isUnderHours } from './timeHelpers';

export interface EvaluateGreetingFreshnessInput {
  nowIso: string;
  localCalendarDate: string;
  timezone: string;
  stateDat: GreetingStateDatSnapshot | null;
  userDat: GreetingUserDatSnapshot | null;
  diaryMetadata: GreetingDiaryMetadata | null;
  gratitudeMetadata: GreetingGratitudeMetadata | null;
}

export function evaluateGreetingFreshness(input: EvaluateGreetingFreshnessInput): GreetingFreshnessResult {
  const { nowIso, timezone, stateDat, userDat, diaryMetadata, gratitudeMetadata } = input;

  // Sliders filled today?
  const slidersFilledToday = stateDat?.moodLastUpdatedAt
    ? isSameLocalCalendarDay(stateDat.moodLastUpdatedAt, nowIso, timezone)
    : false;

  // Diary recent (< 3 days)?
  const latestDiaryAgeInDays = diaryMetadata?.latestEntryCreatedAt
    ? getAgeInDays(diaryMetadata.latestEntryCreatedAt, nowIso)
    : null;
  const diaryRecentUnder3Days = diaryMetadata?.latestEntryCreatedAt
    ? isUnderDays(diaryMetadata.latestEntryCreatedAt, nowIso, 3)
    : false;

  // Gratitude recent (< 3 days)?
  const latestGratitudeAgeInDays = gratitudeMetadata?.latestEntryCreatedAt
    ? getAgeInDays(gratitudeMetadata.latestEntryCreatedAt, nowIso)
    : null;
  const gratitudeRecentUnder3Days = gratitudeMetadata?.latestEntryCreatedAt
    ? isUnderDays(gratitudeMetadata.latestEntryCreatedAt, nowIso, 3)
    : false;

  // Backpack recently updated (< 24h)?
  const backpackAgeInHours = userDat?.backpackLastUpdatedAt
    ? getAgeInHours(userDat.backpackLastUpdatedAt, nowIso)
    : null;
  const backpackRecentlyUpdatedUnder24h = userDat?.backpackLastUpdatedAt
    ? isUnderHours(userDat.backpackLastUpdatedAt, nowIso, 24)
    : false;

  return {
    slidersFilledToday,
    moodUsable: slidersFilledToday,
    diaryRecentUnder3Days,
    gratitudeRecentUnder3Days,
    backpackRecentlyUpdatedUnder24h,
    latestDiaryAgeInDays,
    latestGratitudeAgeInDays,
    backpackAgeInHours,
  };
}
