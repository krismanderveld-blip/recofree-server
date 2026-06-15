/**
 * Session Greeting V3 — Override Resolution Tests
 * Tests: CRISIS, FIRST_SESSION, RETURN_AFTER_ABSENCE, MISSING_DATA overrides
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

function makeUserDat(overrides: Partial<GreetingUserDatSnapshot> = {}): GreetingUserDatSnapshot {
  return {
    userName: 'Kris',
    sessionStats: { totalSessionsStarted: 10, currentSessionNumber: 11 },
    schemaTendencies: [],
    backpackLastUpdatedAt: undefined,
    ...overrides,
  };
}

function makeStateDat(overrides: Partial<GreetingStateDatSnapshot> = {}): GreetingStateDatSnapshot {
  return {
    currentMood: { craving: 3, frustration: 2, despondency: 2, focus: 5 },
    moodLastUpdatedAt: new Date().toISOString(),
    vspZone: 'GROEN',
    ...overrides,
  };
}

function makeAbsence(overrides: Partial<SessionAbsenceResult> = {}): SessionAbsenceResult {
  return {
    band: 'SHORT',
    isReturnAfterAbsence: false,
    absenceDaysExact: 1,
    absenceHoursExact: 24,
    lastSessionStartedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    thresholdDays: 3,
    reason: 'Absence below return threshold.',
    ...overrides,
  };
}

function makeInput(overrides: Partial<ResolveGreetingOverrideInput> = {}): ResolveGreetingOverrideInput {
  return {
    userDat: makeUserDat(),
    stateDat: makeStateDat(),
    freshness: makeFreshness(),
    synthesisCandidates: [],
    absence: makeAbsence(),
    ...overrides,
  };
}

describe('Override Resolution', () => {
  it('T1: CRISIS override when craving >= 7 and sliders filled today', () => {
    const result = resolveGreetingOverride(makeInput({
      stateDat: makeStateDat({ currentMood: { craving: 8, frustration: 3, despondency: 2, focus: 4 } }),
      freshness: makeFreshness({ slidersFilledToday: true }),
    }));
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('CRISIS_OVERRIDE');
    expect(result!.payload.craving).toBe(8);
  });

  it('T2: CRISIS override when vspZone is ROOD', () => {
    const result = resolveGreetingOverride(makeInput({
      stateDat: makeStateDat({ vspZone: 'ROOD', currentMood: { craving: 2, frustration: 3, despondency: 3, focus: 5 } }),
    }));
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('CRISIS_OVERRIDE');
  });

  it('T3: FIRST_SESSION override when totalSessionsStarted === 0', () => {
    const result = resolveGreetingOverride(makeInput({
      userDat: makeUserDat({ sessionStats: { totalSessionsStarted: 0, currentSessionNumber: 1 } }),
    }));
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('FIRST_SESSION');
  });

  it('T4: MISSING_DATA override when no fresh data at all', () => {
    const result = resolveGreetingOverride(makeInput({
      stateDat: makeStateDat({ currentMood: undefined, moodLastUpdatedAt: undefined }),
      freshness: makeFreshness({
        slidersFilledToday: false,
        moodUsable: false,
        diaryRecentUnder3Days: false,
        gratitudeRecentUnder3Days: false,
        backpackRecentlyUpdatedUnder24h: false,
      }),
    }));
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('MISSING_DATA');
  });

  it('T5: No override when normal session with sliders filled', () => {
    const result = resolveGreetingOverride(makeInput({
      freshness: makeFreshness({ slidersFilledToday: true }),
    }));
    expect(result).toBeNull();
  });

  it('T6: CRISIS takes priority over FIRST_SESSION (crisis checked first)', () => {
    const result = resolveGreetingOverride(makeInput({
      userDat: makeUserDat({ sessionStats: { totalSessionsStarted: 0, currentSessionNumber: 1 } }),
      stateDat: makeStateDat({ currentMood: { craving: 9, frustration: 5, despondency: 5, focus: 1 } }),
      freshness: makeFreshness({ slidersFilledToday: true }),
    }));
    expect(result).not.toBeNull();
    // Per the implementation, CRISIS is checked before FIRST_SESSION
    expect(result!.mode).toBe('CRISIS_OVERRIDE');
  });

  it('T7: RETURN_AFTER_ABSENCE when absence >= 3 days', () => {
    const result = resolveGreetingOverride(makeInput({
      absence: makeAbsence({
        band: 'RETURN_AFTER_ABSENCE',
        isReturnAfterAbsence: true,
        absenceDaysExact: 5,
        absenceHoursExact: 120,
      }),
    }));
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('RETURN_AFTER_ABSENCE');
    expect(result!.shouldBypassSynthesis).toBe(false);
    expect(result!.shouldPrefixSynthesisWithAbsence).toBe(true);
  });

  it('T8: CRISIS overrides RETURN_AFTER_ABSENCE', () => {
    const result = resolveGreetingOverride(makeInput({
      stateDat: makeStateDat({ currentMood: { craving: 8, frustration: 5, despondency: 5, focus: 1 } }),
      freshness: makeFreshness({ slidersFilledToday: true }),
      absence: makeAbsence({
        band: 'LONG_RETURN',
        isReturnAfterAbsence: true,
        absenceDaysExact: 20,
        absenceHoursExact: 480,
      }),
    }));
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('CRISIS_OVERRIDE');
  });
});
