/**
 * Absence Awareness — Override Integration Tests
 * Tests: RETURN_AFTER_ABSENCE in override priority, crisis overrides absence
 */
import { describe, it, expect } from 'vitest';
import { resolveGreetingOverride, type ResolveGreetingOverrideInput } from '@/lib/features/sessionGreeting/resolveGreetingOverride';
import type { GreetingFreshnessResult, GreetingStateDatSnapshot, GreetingUserDatSnapshot } from '@/lib/features/sessionGreeting/sessionGreeting.types';
import type { SessionAbsenceResult } from '@/lib/features/sessionGreeting/calculateSessionAbsence';

function makeFreshness(overrides: Partial<GreetingFreshnessResult> = {}): GreetingFreshnessResult {
  return {
    slidersFilledToday: true,
    moodUsable: true,
    diaryRecentUnder3Days: false,
    gratitudeRecentUnder3Days: false,
    backpackRecentlyUpdatedUnder24h: false,
    latestDiaryAgeInDays: null,
    latestGratitudeAgeInDays: null,
    backpackAgeInHours: null,
    ...overrides,
  };
}

function makeInput(overrides: Partial<ResolveGreetingOverrideInput> = {}): ResolveGreetingOverrideInput {
  return {
    userDat: {
      userName: 'Kris',
      sessionStats: { totalSessionsStarted: 10, currentSessionNumber: 11 },
      schemaTendencies: [],
      backpackLastUpdatedAt: undefined,
    },
    stateDat: {
      currentMood: { craving: 3, frustration: 2, despondency: 2, focus: 5 },
      moodLastUpdatedAt: new Date().toISOString(),
      vspZone: 'GROEN',
    },
    freshness: makeFreshness(),
    synthesisCandidates: [],
    absence: {
      band: 'SHORT',
      isReturnAfterAbsence: false,
      absenceDaysExact: 1,
      absenceHoursExact: 24,
      lastSessionStartedAt: null,
      thresholdDays: 3,
      reason: 'short',
    },
    ...overrides,
  };
}

describe('Absence Override Integration', () => {
  it('B1: RETURN_AFTER_ABSENCE override when absence band is RETURN_AFTER_ABSENCE', () => {
    const result = resolveGreetingOverride(makeInput({
      absence: {
        band: 'RETURN_AFTER_ABSENCE',
        isReturnAfterAbsence: true,
        absenceDaysExact: 5,
        absenceHoursExact: 120,
        lastSessionStartedAt: '2026-06-10T09:00:00.000Z',
        thresholdDays: 3,
        reason: 'User returns after absence threshold.',
      },
    }));
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('RETURN_AFTER_ABSENCE');
    expect(result!.shouldBypassSynthesis).toBe(false);
    expect(result!.shouldPrefixSynthesisWithAbsence).toBe(true);
  });

  it('B2: LONG_RETURN also triggers RETURN_AFTER_ABSENCE override mode', () => {
    const result = resolveGreetingOverride(makeInput({
      absence: {
        band: 'LONG_RETURN',
        isReturnAfterAbsence: true,
        absenceDaysExact: 20,
        absenceHoursExact: 480,
        lastSessionStartedAt: '2026-05-26T09:00:00.000Z',
        thresholdDays: 3,
        reason: 'User returns after long absence.',
      },
    }));
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('RETURN_AFTER_ABSENCE');
    expect(result!.shouldPrefixSynthesisWithAbsence).toBe(true);
  });

  it('B3: CRISIS overrides RETURN_AFTER_ABSENCE (crisis has higher priority)', () => {
    const result = resolveGreetingOverride(makeInput({
      stateDat: {
        currentMood: { craving: 9, frustration: 5, despondency: 5, focus: 1 },
        moodLastUpdatedAt: new Date().toISOString(),
        vspZone: 'GROEN',
      },
      freshness: makeFreshness({ slidersFilledToday: true }),
      absence: {
        band: 'LONG_RETURN',
        isReturnAfterAbsence: true,
        absenceDaysExact: 20,
        absenceHoursExact: 480,
        lastSessionStartedAt: '2026-05-26T09:00:00.000Z',
        thresholdDays: 3,
        reason: 'User returns after long absence.',
      },
    }));
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('CRISIS_OVERRIDE');
  });

  it('B4: SHORT absence does NOT trigger RETURN_AFTER_ABSENCE', () => {
    const result = resolveGreetingOverride(makeInput({
      absence: {
        band: 'SHORT',
        isReturnAfterAbsence: false,
        absenceDaysExact: 2,
        absenceHoursExact: 48,
        lastSessionStartedAt: '2026-06-13T09:00:00.000Z',
        thresholdDays: 3,
        reason: 'Absence below return threshold.',
      },
    }));
    // Should be null (normal synthesis) since sliders are filled
    expect(result).toBeNull();
  });

  it('B5: RETURN_AFTER_ABSENCE has higher priority than MISSING_DATA', () => {
    const result = resolveGreetingOverride(makeInput({
      freshness: makeFreshness({
        slidersFilledToday: false,
        moodUsable: false,
        diaryRecentUnder3Days: false,
        gratitudeRecentUnder3Days: false,
        backpackRecentlyUpdatedUnder24h: false,
      }),
      absence: {
        band: 'RETURN_AFTER_ABSENCE',
        isReturnAfterAbsence: true,
        absenceDaysExact: 5,
        absenceHoursExact: 120,
        lastSessionStartedAt: '2026-06-10T09:00:00.000Z',
        thresholdDays: 3,
        reason: 'User returns after absence threshold.',
      },
    }));
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('RETURN_AFTER_ABSENCE');
  });

  it('B6: FIRST_SESSION has higher priority than RETURN_AFTER_ABSENCE', () => {
    const result = resolveGreetingOverride(makeInput({
      userDat: {
        userName: 'Kris',
        sessionStats: { totalSessionsStarted: 0, currentSessionNumber: 1 },
        schemaTendencies: [],
        backpackLastUpdatedAt: undefined,
      },
      absence: {
        band: 'RETURN_AFTER_ABSENCE',
        isReturnAfterAbsence: true,
        absenceDaysExact: 5,
        absenceHoursExact: 120,
        lastSessionStartedAt: '2026-06-10T09:00:00.000Z',
        thresholdDays: 3,
        reason: 'User returns after absence threshold.',
      },
    }));
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('FIRST_SESSION');
  });
});
