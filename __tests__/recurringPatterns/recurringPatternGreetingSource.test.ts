/**
 * Tests for RECURRING_PATTERN integration with the greeting engine.
 * Only tests what's directly affected by the new source type.
 */
import { describe, it, expect } from 'vitest';
import { buildGreetingSynthesisCandidates } from '@/lib/features/sessionGreeting/buildGreetingSynthesisCandidates';
import type { GreetingLogsDatSnapshot, GreetingFreshnessResult } from '@/lib/features/sessionGreeting/sessionGreeting.types';

function makeFreshness(overrides: Partial<GreetingFreshnessResult> = {}): GreetingFreshnessResult {
  return {
    slidersFilledToday: false,
    diaryRecentUnder3Days: false,
    gratitudeRecentUnder3Days: false,
    backpackRecentlyUpdatedUnder24h: false,
    latestDiaryAgeInDays: 10,
    latestGratitudeAgeInDays: 10,
    backpackAgeInHours: 100,
    sessionNumber: 5,
    ...overrides,
  };
}

describe('RECURRING_PATTERN greeting source', () => {
  it('is eligible when logsDat has a recurring pattern with sufficient confidence', () => {
    const logsDat: GreetingLogsDatSnapshot = {
      lastSessionOpenLoops: [],
      recurringPatternAnchor: "'eenzaamheid' komt terug in 4 van je 6 sessies",
      recurringPatternConfidence: 0.72,
    };

    const result = buildGreetingSynthesisCandidates({
      userDat: null,
      stateDat: null,
      projectionsDat: null,
      logsDat,
      diaryMetadata: null,
      gratitudeMetadata: null,
      freshness: makeFreshness(),
    });

    const recurringCandidate = result.candidates.find(c => c.sourceType === 'RECURRING_PATTERN');
    expect(recurringCandidate).toBeDefined();
    expect(recurringCandidate!.eligible).toBe(true);
    expect(recurringCandidate!.relevanceScore).toBeGreaterThan(0);
    expect(recurringCandidate!.safeAnchor).toContain('eenzaamheid');
  });

  it('is not eligible when no recurring pattern is present', () => {
    const logsDat: GreetingLogsDatSnapshot = {
      lastSessionOpenLoops: ['some open loop'],
    };

    const result = buildGreetingSynthesisCandidates({
      userDat: null,
      stateDat: null,
      projectionsDat: null,
      logsDat,
      diaryMetadata: null,
      gratitudeMetadata: null,
      freshness: makeFreshness(),
    });

    const recurringCandidate = result.candidates.find(c => c.sourceType === 'RECURRING_PATTERN');
    expect(recurringCandidate).toBeDefined();
    expect(recurringCandidate!.eligible).toBe(false);
  });

  it('is not eligible when confidence is below 0.4', () => {
    const logsDat: GreetingLogsDatSnapshot = {
      lastSessionOpenLoops: [],
      recurringPatternAnchor: 'some pattern',
      recurringPatternConfidence: 0.3,
    };

    const result = buildGreetingSynthesisCandidates({
      userDat: null,
      stateDat: null,
      projectionsDat: null,
      logsDat,
      diaryMetadata: null,
      gratitudeMetadata: null,
      freshness: makeFreshness(),
    });

    const recurringCandidate = result.candidates.find(c => c.sourceType === 'RECURRING_PATTERN');
    expect(recurringCandidate).toBeDefined();
    expect(recurringCandidate!.eligible).toBe(false);
  });

  it('relevance score is capped at 0.85 base (before zone modifier)', () => {
    const logsDat: GreetingLogsDatSnapshot = {
      lastSessionOpenLoops: [],
      recurringPatternAnchor: 'high confidence pattern',
      recurringPatternConfidence: 0.99,
    };

    const result = buildGreetingSynthesisCandidates({
      userDat: null,
      stateDat: null,
      projectionsDat: null,
      logsDat,
      diaryMetadata: null,
      gratitudeMetadata: null,
      freshness: makeFreshness(),
    });

    const recurringCandidate = result.candidates.find(c => c.sourceType === 'RECURRING_PATTERN');
    expect(recurringCandidate!.eligible).toBe(true);
    // With neutral zone modifier (1.0), max is 0.85
    expect(recurringCandidate!.relevanceScore).toBeLessThanOrEqual(0.85);
  });
});
