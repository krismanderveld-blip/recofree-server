/**
 * Session Greeting V3 — Synthesis Source Selection Tests
 * Tests: candidate scoring, max 3 selection, balance rules
 */
import { describe, it, expect } from 'vitest';
import { buildGreetingSynthesisCandidates } from '@/lib/features/sessionGreeting/buildGreetingSynthesisCandidates';
import { selectGreetingSynthesisSources } from '@/lib/features/sessionGreeting/selectGreetingSynthesisSources';
import type { GreetingFreshnessResult, GreetingStateDatSnapshot, GreetingUserDatSnapshot, GreetingProjectionsDatSnapshot, GreetingDiaryMetadata, GreetingGratitudeMetadata } from '@/lib/features/sessionGreeting/sessionGreeting.types';

const NOW = '2026-06-15T10:00:00.000Z';
const YESTERDAY = '2026-06-14T18:00:00.000Z';

function makeFreshness(overrides: Partial<GreetingFreshnessResult> = {}): GreetingFreshnessResult {
  return {
    slidersFilledToday: true,
    moodUsable: true,
    diaryRecentUnder3Days: true,
    gratitudeRecentUnder3Days: true,
    backpackRecentlyUpdatedUnder24h: false,
    latestDiaryAgeInDays: 0.5,
    latestGratitudeAgeInDays: 0.5,
    backpackAgeInHours: null,
    ...overrides,
  };
}

function makeUserDat(overrides: Partial<GreetingUserDatSnapshot> = {}): GreetingUserDatSnapshot {
  return {
    userName: 'Kris',
    sessionStats: { totalSessionsStarted: 10, currentSessionNumber: 11 },
    schemaTendencies: [
      { schemaId: 'verlating', schemaName: 'verlating/instabiliteit', confidence: 0.85, lastUpdatedAt: YESTERDAY },
    ],
    backpackLastUpdatedAt: YESTERDAY,
    ...overrides,
  };
}

function makeStateDat(overrides: Partial<GreetingStateDatSnapshot> = {}): GreetingStateDatSnapshot {
  return {
    currentMood: { craving: 3, frustration: 5, despondency: 2, focus: 6 },
    moodLastUpdatedAt: NOW,
    vspZone: 'GROEN',
    ...overrides,
  };
}

function makeProjections(overrides: Partial<GreetingProjectionsDatSnapshot> = {}): GreetingProjectionsDatSnapshot {
  return {
    fears: [],
    ...overrides,
  };
}

describe('Synthesis Candidate Building', () => {
  it('T7: All sources eligible when data is fresh', () => {
    const { candidates } = buildGreetingSynthesisCandidates({ logsDat: null,
      userDat: makeUserDat(),
      stateDat: makeStateDat({ currentMood: { craving: 3, frustration: 6, despondency: 2, focus: 6 } }),
      projectionsDat: makeProjections(),
      diaryMetadata: { latestEntryCreatedAt: YESTERDAY, latestSafeAnchor: 'Vandaag was een rustige dag' },
      gratitudeMetadata: { latestEntryCreatedAt: YESTERDAY, latestSafeAnchor: 'Dankbaar voor mijn gezondheid' },
      freshness: makeFreshness({
        slidersFilledToday: true,
        moodUsable: true,
        diaryRecentUnder3Days: true,
        gratitudeRecentUnder3Days: true,
        latestDiaryAgeInDays: 0.5,
        latestGratitudeAgeInDays: 0.5,
      }),
    });

    const eligibleTypes = candidates.filter(c => c.eligible).map(c => c.sourceType);
    // Mood should be eligible because frustration >= 5 (elevated)
    expect(eligibleTypes).toContain('TODAY_MOOD');
    expect(eligibleTypes).toContain('RECENT_DIARY');
    expect(eligibleTypes).toContain('RECENT_GRATITUDE');
  });

  it('T8: Mood not eligible when sliders not filled today', () => {
    const { candidates } = buildGreetingSynthesisCandidates({ logsDat: null,
      userDat: makeUserDat(),
      stateDat: makeStateDat({ moodLastUpdatedAt: undefined, currentMood: undefined }),
      projectionsDat: makeProjections(),
      diaryMetadata: { latestEntryCreatedAt: YESTERDAY, latestSafeAnchor: 'Test' },
      gratitudeMetadata: null,
      freshness: makeFreshness({ slidersFilledToday: false, moodUsable: false, gratitudeRecentUnder3Days: false }),
    });

    const moodCandidate = candidates.find(c => c.sourceType === 'TODAY_MOOD');
    expect(moodCandidate?.eligible).toBe(false);
  });

  it('T9: Schema rotation eligible every 4th session', () => {
    const { candidates } = buildGreetingSynthesisCandidates({ logsDat: null,
      userDat: makeUserDat({ sessionStats: { totalSessionsStarted: 11, currentSessionNumber: 12 } }),
      stateDat: makeStateDat(),
      projectionsDat: makeProjections(),
      diaryMetadata: null,
      gratitudeMetadata: null,
      freshness: makeFreshness({ slidersFilledToday: true, diaryRecentUnder3Days: false, gratitudeRecentUnder3Days: false }),
    });

    const schemaCandidate = candidates.find(c => c.sourceType === 'SCHEMA_ROTATION');
    // Session 12 % 4 === 0, and there's a schema with confidence 0.85 >= 0.60
    expect(schemaCandidate?.eligible).toBe(true);
  });
});

describe('Synthesis Source Selection', () => {
  it('T10: Selects max 3 sources from eligible candidates', () => {
    const { candidates, moodMetric } = buildGreetingSynthesisCandidates({ logsDat: null,
      userDat: makeUserDat(),
      stateDat: makeStateDat({ currentMood: { craving: 3, frustration: 6, despondency: 2, focus: 6 } }),
      projectionsDat: makeProjections({ fears: [{ label: 'Terugval', decayScore: 0.75, lastReinforcedAt: YESTERDAY }] }),
      diaryMetadata: { latestEntryCreatedAt: YESTERDAY, latestSafeAnchor: 'Dag was goed' },
      gratitudeMetadata: { latestEntryCreatedAt: YESTERDAY, latestSafeAnchor: 'Dankbaar' },
      freshness: makeFreshness(),
    });

    const selected = selectGreetingSynthesisSources({ candidates, moodMetric });
    expect(selected.length).toBeLessThanOrEqual(3);
    expect(selected.length).toBeGreaterThan(0);
  });

  it('T11: Sources sorted by relevance score (highest first)', () => {
    const { candidates, moodMetric } = buildGreetingSynthesisCandidates({ logsDat: null,
      userDat: makeUserDat(),
      stateDat: makeStateDat({ currentMood: { craving: 5, frustration: 6, despondency: 3, focus: 4 } }),
      projectionsDat: makeProjections(),
      diaryMetadata: { latestEntryCreatedAt: YESTERDAY, latestSafeAnchor: 'Moeilijke dag' },
      gratitudeMetadata: { latestEntryCreatedAt: YESTERDAY, latestSafeAnchor: 'Dankbaar voor rust' },
      freshness: makeFreshness(),
    });

    const selected = selectGreetingSynthesisSources({ candidates, moodMetric });
    for (let i = 1; i < selected.length; i++) {
      expect(selected[i - 1].relevanceScore).toBeGreaterThanOrEqual(selected[i].relevanceScore);
    }
  });

  it('T12: No more than 1 positive source when negative source present', () => {
    const { candidates, moodMetric } = buildGreetingSynthesisCandidates({ logsDat: null,
      userDat: makeUserDat(),
      stateDat: makeStateDat({ currentMood: { craving: 6, frustration: 7, despondency: 6, focus: 2 } }),
      projectionsDat: makeProjections({ fears: [{ label: 'Terugval angst', decayScore: 0.80, lastReinforcedAt: YESTERDAY }] }),
      diaryMetadata: { latestEntryCreatedAt: YESTERDAY, latestSafeAnchor: 'Moeilijk' },
      gratitudeMetadata: { latestEntryCreatedAt: YESTERDAY, latestSafeAnchor: 'Dankbaar voor alles' },
      freshness: makeFreshness(),
    });

    const selected = selectGreetingSynthesisSources({ candidates, moodMetric });
    // Gratitude is the only always-positive source type
    const positiveCount = selected.filter(s => s.sourceType === 'RECENT_GRATITUDE').length;
    expect(positiveCount).toBeLessThanOrEqual(1);
  });

  it('T13: Returns empty array when no candidates are eligible', () => {
    const selected = selectGreetingSynthesisSources({
      candidates: [
        { sourceType: 'TODAY_MOOD', eligible: false, relevanceScore: 0, safeAnchor: '', reason: 'no data' },
        { sourceType: 'RECENT_DIARY', eligible: false, relevanceScore: 0, safeAnchor: '', reason: 'no data' },
      ],
      moodMetric: null,
    });
    expect(selected).toHaveLength(0);
  });
});
