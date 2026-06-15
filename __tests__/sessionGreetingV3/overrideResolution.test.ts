/**
 * Session Greeting V3 — Override Resolution Tests
 * Tests: CRISIS, FIRST_SESSION, MISSING_DATA overrides bypass synthesis
 */
import { describe, it, expect } from 'vitest';
import { resolveGreetingOverride } from '@/lib/features/sessionGreeting/resolveGreetingOverride';
import type { GreetingFreshnessResult, GreetingStateDatSnapshot, GreetingUserDatSnapshot } from '@/lib/features/sessionGreeting/sessionGreeting.types';

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

describe('Override Resolution', () => {
  it('T1: CRISIS override when craving >= 7 and sliders filled today', () => {
    const result = resolveGreetingOverride({
      userDat: makeUserDat(),
      stateDat: makeStateDat({ currentMood: { craving: 8, frustration: 3, despondency: 2, focus: 4 } }),
      freshness: makeFreshness({ slidersFilledToday: true }),
    });
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('CRISIS_OVERRIDE');
    expect(result!.payload.craving).toBe(8);
  });

  it('T2: CRISIS override when vspZone is ROOD', () => {
    const result = resolveGreetingOverride({
      userDat: makeUserDat(),
      stateDat: makeStateDat({ vspZone: 'ROOD', currentMood: { craving: 2, frustration: 3, despondency: 3, focus: 5 } }),
      freshness: makeFreshness(),
    });
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('CRISIS_OVERRIDE');
  });

  it('T3: FIRST_SESSION override when totalSessionsStarted === 0', () => {
    const result = resolveGreetingOverride({
      userDat: makeUserDat({ sessionStats: { totalSessionsStarted: 0, currentSessionNumber: 1 } }),
      stateDat: makeStateDat(),
      freshness: makeFreshness(),
    });
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('FIRST_SESSION');
  });

  it('T4: MISSING_DATA override when no fresh data at all', () => {
    const result = resolveGreetingOverride({
      userDat: makeUserDat(),
      stateDat: makeStateDat({ currentMood: undefined, moodLastUpdatedAt: undefined }),
      freshness: makeFreshness({
        slidersFilledToday: false,
        moodUsable: false,
        diaryRecentUnder3Days: false,
        gratitudeRecentUnder3Days: false,
        backpackRecentlyUpdatedUnder24h: false,
      }),
    });
    expect(result).not.toBeNull();
    expect(result!.mode).toBe('MISSING_DATA');
  });

  it('T5: No override when normal session with sliders filled', () => {
    const result = resolveGreetingOverride({
      userDat: makeUserDat(),
      stateDat: makeStateDat(),
      freshness: makeFreshness({ slidersFilledToday: true }),
    });
    expect(result).toBeNull();
  });

  it('T6: FIRST_SESSION takes priority over CRISIS (totalSessionsStarted=0 checked first)', () => {
    const result = resolveGreetingOverride({
      userDat: makeUserDat({ sessionStats: { totalSessionsStarted: 0, currentSessionNumber: 1 } }),
      stateDat: makeStateDat({ currentMood: { craving: 9, frustration: 5, despondency: 5, focus: 1 } }),
      freshness: makeFreshness({ slidersFilledToday: true }),
    });
    expect(result).not.toBeNull();
    // Per the implementation, FIRST_SESSION is checked before CRISIS
    expect(result!.mode).toBe('FIRST_SESSION');
  });
});
