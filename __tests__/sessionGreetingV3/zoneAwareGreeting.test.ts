/**
 * Zone-Aware Greeting Engine Tests
 *
 * Tests the redesigned greeting engine behavior:
 * 1. VSP zone modifies source weights (GEEL suppresses positive, boosts negative)
 * 2. Recency-first scoring (most recent source gets highest bonus)
 * 3. Coherent prompt with zone framing (not disconnected snippets)
 * 4. MISSING_DATA override counts logs.dat as valid data
 * 5. Diary valence inference (negative keywords → negative valence)
 */

import { describe, it, expect } from 'vitest';
import { buildGreetingSynthesisCandidates } from '@/lib/features/sessionGreeting/buildGreetingSynthesisCandidates';
import { selectGreetingSynthesisSources } from '@/lib/features/sessionGreeting/selectGreetingSynthesisSources';
import { buildGreetingSynthesisPromptPayload } from '@/lib/features/sessionGreeting/buildGreetingSynthesisPrompt';
import { resolveGreetingOverride } from '@/lib/features/sessionGreeting/resolveGreetingOverride';
import { sessionGreetingEngineV3 } from '@/lib/features/sessionGreeting/sessionGreetingEngineV3';
import type { GreetingFreshnessResult } from '@/lib/features/sessionGreeting/sessionGreeting.types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW = '2026-06-17T07:30:00.000Z';
const TODAY = '2026-06-17';

function makeFreshness(overrides: Partial<GreetingFreshnessResult> = {}): GreetingFreshnessResult {
  return {
    slidersFilledToday: true,
    moodUsable: true,
    diaryRecentUnder3Days: true,
    gratitudeRecentUnder3Days: true,
    backpackRecentlyUpdatedUnder24h: false,
    latestDiaryAgeInDays: 0.1, // 2.4 hours ago
    latestGratitudeAgeInDays: 1.5, // 1.5 days ago
    backpackAgeInHours: null,
    ...overrides,
  };
}

// ─── Test 1: Zone GEEL suppresses positive sources ──────────────────────────

describe('Zone-aware source weighting', () => {
  it('T1: GEEL zone suppresses gratitude (positive) and boosts diary (negative)', () => {
    const result = buildGreetingSynthesisCandidates({
      userDat: null,
      stateDat: {
        currentMood: { craving: 3, frustration: 4, despondency: 5, focus: 5 },
        moodLastUpdatedAt: NOW,
        vspZone: 'GEEL',
      },
      projectionsDat: { fears: [] },
      logsDat: null,
      diaryMetadata: {
        latestEntryCreatedAt: '2026-06-17T07:00:00.000Z', // 30 min ago
        latestSafeAnchor: 'onzeker over mijn uitgang vandaag',
      },
      gratitudeMetadata: {
        latestEntryCreatedAt: '2026-06-15T12:00:00.000Z', // 1.5 days ago
        latestSafeAnchor: 'kalme sfeer in huis',
      },
      freshness: makeFreshness(),
    });

    const diary = result.candidates.find(c => c.sourceType === 'RECENT_DIARY');
    const gratitude = result.candidates.find(c => c.sourceType === 'RECENT_GRATITUDE');

    expect(diary?.eligible).toBe(true);
    expect(gratitude?.eligible).toBe(true);

    // Diary (negative, zone=GEEL) should score HIGHER than gratitude (positive, zone=GEEL)
    expect(diary!.relevanceScore).toBeGreaterThan(gratitude!.relevanceScore);
  });

  it('T2: GROEN zone does NOT suppress gratitude', () => {
    const result = buildGreetingSynthesisCandidates({
      userDat: null,
      stateDat: {
        currentMood: { craving: 2, frustration: 2, despondency: 2, focus: 7 },
        moodLastUpdatedAt: NOW,
        vspZone: 'GROEN',
      },
      projectionsDat: { fears: [] },
      logsDat: null,
      diaryMetadata: {
        latestEntryCreatedAt: '2026-06-16T12:00:00.000Z', // 19.5 hours ago
        latestSafeAnchor: 'rustige dag gehad',
      },
      gratitudeMetadata: {
        latestEntryCreatedAt: '2026-06-17T06:00:00.000Z', // 1.5 hours ago (more recent)
        latestSafeAnchor: 'dankbaar voor steun van vriend',
      },
      freshness: makeFreshness({ latestDiaryAgeInDays: 0.8, latestGratitudeAgeInDays: 0.06 }),
    });

    const diary = result.candidates.find(c => c.sourceType === 'RECENT_DIARY');
    const gratitude = result.candidates.find(c => c.sourceType === 'RECENT_GRATITUDE');

    // In GROEN, gratitude is not suppressed — and it's more recent, so it should score well
    expect(gratitude!.relevanceScore).toBeGreaterThan(0.3);
  });

  it('T3: ORANJE zone strongly suppresses positive sources', () => {
    const result = buildGreetingSynthesisCandidates({
      userDat: null,
      stateDat: {
        currentMood: { craving: 6, frustration: 6, despondency: 4, focus: 3 },
        moodLastUpdatedAt: NOW,
        vspZone: 'ORANJE',
      },
      projectionsDat: { fears: [] },
      logsDat: null,
      diaryMetadata: {
        latestEntryCreatedAt: '2026-06-17T06:00:00.000Z',
        latestSafeAnchor: 'spanning over afspraak morgen',
      },
      gratitudeMetadata: {
        latestEntryCreatedAt: '2026-06-16T20:00:00.000Z',
        latestSafeAnchor: 'mooie wandeling gemaakt',
      },
      freshness: makeFreshness({ latestDiaryAgeInDays: 0.06, latestGratitudeAgeInDays: 0.5 }),
    });

    const diary = result.candidates.find(c => c.sourceType === 'RECENT_DIARY');
    const gratitude = result.candidates.find(c => c.sourceType === 'RECENT_GRATITUDE');

    // ORANJE: gratitude multiplier is 0.35, diary (negative) multiplier is 1.40
    expect(diary!.relevanceScore).toBeGreaterThan(gratitude!.relevanceScore * 2);
  });
});

// ─── Test 2: Recency-first scoring ──────────────────────────────────────────

describe('Recency-first scoring', () => {
  it('T4: Most recent source gets recency bonus', () => {
    const result = buildGreetingSynthesisCandidates({
      userDat: null,
      stateDat: {
        currentMood: { craving: 4, frustration: 3, despondency: 5, focus: 5 },
        moodLastUpdatedAt: '2026-06-17T07:25:00.000Z', // 5 min ago
        vspZone: 'GEEL',
      },
      projectionsDat: { fears: [] },
      logsDat: null,
      diaryMetadata: {
        latestEntryCreatedAt: '2026-06-17T07:20:00.000Z', // 10 min ago
        latestSafeAnchor: 'onzeker over uitgang',
      },
      gratitudeMetadata: {
        latestEntryCreatedAt: '2026-06-15T10:00:00.000Z', // 2 days ago
        latestSafeAnchor: 'dankbaar voor rust',
      },
      freshness: makeFreshness({ latestDiaryAgeInDays: 0.007, latestGratitudeAgeInDays: 1.9 }),
    });

    const diary = result.candidates.find(c => c.sourceType === 'RECENT_DIARY');
    // Diary should have recency bonus in its reason
    expect(diary!.reason).toContain('+recency_rank_');
  });
});

// ─── Test 3: Diary valence inference ────────────────────────────────────────

describe('Diary valence inference', () => {
  it('T5: Diary with negative keywords gets negative valence', () => {
    const result = buildGreetingSynthesisCandidates({
      userDat: null,
      stateDat: { currentMood: { craving: 3 }, moodLastUpdatedAt: NOW, vspZone: 'GEEL' },
      projectionsDat: { fears: [] },
      logsDat: null,
      diaryMetadata: {
        latestEntryCreatedAt: NOW,
        latestSafeAnchor: 'onzeker en bang over morgen',
      },
      gratitudeMetadata: null,
      freshness: makeFreshness({ gratitudeRecentUnder3Days: false }),
    });

    const diary = result.candidates.find(c => c.sourceType === 'RECENT_DIARY');
    expect(diary!.reason).toContain('valence=negative');
  });

  it('T6: Diary with positive keywords gets positive valence', () => {
    const result = buildGreetingSynthesisCandidates({
      userDat: null,
      stateDat: { currentMood: { craving: 2 }, moodLastUpdatedAt: NOW, vspZone: 'GROEN' },
      projectionsDat: { fears: [] },
      logsDat: null,
      diaryMetadata: {
        latestEntryCreatedAt: NOW,
        latestSafeAnchor: 'trots op mijn vooruitgang vandaag',
      },
      gratitudeMetadata: null,
      freshness: makeFreshness({ gratitudeRecentUnder3Days: false }),
    });

    const diary = result.candidates.find(c => c.sourceType === 'RECENT_DIARY');
    expect(diary!.reason).toContain('valence=positive');
  });
});

// ─── Test 4: MISSING_DATA override counts logs.dat ──────────────────────────

describe('MISSING_DATA override with logs.dat', () => {
  it('T7: logs.dat with open loops prevents MISSING_DATA override', () => {
    const candidates = [
      { sourceType: 'TODAY_MOOD' as const, eligible: false, relevanceScore: 0, reason: '', safeAnchor: '' },
      { sourceType: 'RECENT_DIARY' as const, eligible: false, relevanceScore: 0, reason: '', safeAnchor: '' },
      { sourceType: 'RECENT_GRATITUDE' as const, eligible: false, relevanceScore: 0, reason: '', safeAnchor: '' },
      { sourceType: 'BACKPACK_RECENT_UPDATE' as const, eligible: false, relevanceScore: 0, reason: '', safeAnchor: '' },
      { sourceType: 'ACTIVE_HOPE_OR_FEAR' as const, eligible: false, relevanceScore: 0, reason: '', safeAnchor: '' },
      { sourceType: 'SCHEMA_ROTATION' as const, eligible: false, relevanceScore: 0, reason: '', safeAnchor: '' },
      { sourceType: 'LAST_SESSION_SUMMARY' as const, eligible: true, relevanceScore: 0.88, reason: 'open loops', safeAnchor: 'Vorige sessie: onzekerheid over werk' },
    ];

    const override = resolveGreetingOverride({
      userDat: { userName: 'Kris', sessionStats: { totalSessionsStarted: 5, currentSessionNumber: 6 }, schemaTendencies: [] },
      stateDat: { currentMood: { craving: 2 }, vspZone: 'GROEN' },
      freshness: makeFreshness({
        slidersFilledToday: false,
        diaryRecentUnder3Days: false,
        gratitudeRecentUnder3Days: false,
        backpackRecentlyUpdatedUnder24h: false,
      }),
      synthesisCandidates: candidates,
      absence: { isReturnAfterAbsence: false, band: 'NONE' as any, absenceDaysExact: 0.5 },
    });

    // Should NOT trigger MISSING_DATA because logs.dat is available
    expect(override).toBeNull();
  });

  it('T8: Without logs.dat and no fresh data, MISSING_DATA triggers', () => {
    const candidates = [
      { sourceType: 'TODAY_MOOD' as const, eligible: false, relevanceScore: 0, reason: '', safeAnchor: '' },
      { sourceType: 'RECENT_DIARY' as const, eligible: false, relevanceScore: 0, reason: '', safeAnchor: '' },
      { sourceType: 'RECENT_GRATITUDE' as const, eligible: false, relevanceScore: 0, reason: '', safeAnchor: '' },
      { sourceType: 'BACKPACK_RECENT_UPDATE' as const, eligible: false, relevanceScore: 0, reason: '', safeAnchor: '' },
      { sourceType: 'ACTIVE_HOPE_OR_FEAR' as const, eligible: false, relevanceScore: 0, reason: '', safeAnchor: '' },
      { sourceType: 'SCHEMA_ROTATION' as const, eligible: false, relevanceScore: 0, reason: '', safeAnchor: '' },
      { sourceType: 'LAST_SESSION_SUMMARY' as const, eligible: false, relevanceScore: 0, reason: '', safeAnchor: '' },
    ];

    const override = resolveGreetingOverride({
      userDat: { userName: 'Kris', sessionStats: { totalSessionsStarted: 5, currentSessionNumber: 6 }, schemaTendencies: [] },
      stateDat: { currentMood: { craving: 2 }, vspZone: 'GROEN' },
      freshness: makeFreshness({
        slidersFilledToday: false,
        diaryRecentUnder3Days: false,
        gratitudeRecentUnder3Days: false,
        backpackRecentlyUpdatedUnder24h: false,
      }),
      synthesisCandidates: candidates,
      absence: { isReturnAfterAbsence: false, band: 'NONE' as any, absenceDaysExact: 0.5 },
    });

    expect(override).not.toBeNull();
    expect(override!.mode).toBe('MISSING_DATA');
  });
});

// ─── Test 5: Prompt contains zone framing ───────────────────────────────────

describe('Zone-framed prompt construction', () => {
  it('T9: GEEL zone prompt contains zone tone instruction', () => {
    const sources = [
      { sourceType: 'RECENT_DIARY' as const, safeAnchor: 'onzeker over uitgang', relevanceScore: 0.9 },
      { sourceType: 'TODAY_MOOD' as const, safeAnchor: 'check-in toont lichte spanning', relevanceScore: 0.7 },
    ];

    const payload = buildGreetingSynthesisPromptPayload({
      userName: 'Kris',
      selectedSources: sources,
      absence: { isReturnAfterAbsence: false, band: 'NONE' as any, absenceDaysExact: 0.5 },
      mode: 'SYNTHESIS',
      vspZone: 'GEEL',
    });

    // Prompt should contain zone framing
    expect(payload.synthesisInstruction).toContain('ZONE: GEEL');
    expect(payload.synthesisInstruction).toContain('erkennend');
    expect(payload.synthesisInstruction).toContain('onzeker over uitgang');
  });

  it('T10: GROEN zone prompt has open/warm tone', () => {
    const sources = [
      { sourceType: 'RECENT_GRATITUDE' as const, safeAnchor: 'dankbaar voor steun', relevanceScore: 0.8 },
    ];

    const payload = buildGreetingSynthesisPromptPayload({
      userName: 'Kris',
      selectedSources: sources,
      absence: { isReturnAfterAbsence: false, band: 'NONE' as any, absenceDaysExact: 0.5 },
      mode: 'SYNTHESIS',
      vspZone: 'GROEN',
    });

    expect(payload.synthesisInstruction).toContain('ZONE: GROEN');
    expect(payload.synthesisInstruction).toContain('Warm, open');
  });
});

// ─── Test 6: User's exact scenario (GEEL + diary "onzeker") ─────────────────

describe('User scenario: GEEL + diary "onzeker over uitgang"', () => {
  it('T11: Diary "onzeker" outranks gratitude "kalme sfeer" in GEEL zone', () => {
    const { candidates } = buildGreetingSynthesisCandidates({
      userDat: {
        userName: 'Kris',
        sessionStats: { totalSessionsStarted: 10, currentSessionNumber: 11 },
        schemaTendencies: [],
        backpackLastUpdatedAt: '2026-06-16T20:00:00.000Z',
      },
      stateDat: {
        currentMood: { craving: 3, frustration: 4, despondency: 5, focus: 5 },
        moodLastUpdatedAt: '2026-06-17T07:28:00.000Z',
        vspZone: 'GEEL',
      },
      projectionsDat: { fears: [] },
      logsDat: null,
      diaryMetadata: {
        latestEntryCreatedAt: '2026-06-17T07:25:00.000Z',
        latestSafeAnchor: 'onzeker over mijn uitgang vandaag',
      },
      gratitudeMetadata: {
        latestEntryCreatedAt: '2026-06-16T08:00:00.000Z',
        latestSafeAnchor: 'kalme sfeer in huis',
      },
      freshness: makeFreshness({
        latestDiaryAgeInDays: 0.003, // just now
        latestGratitudeAgeInDays: 0.98, // yesterday
        backpackRecentlyUpdatedUnder24h: true,
        backpackAgeInHours: 11.5,
      }),
    });

    const diary = candidates.find(c => c.sourceType === 'RECENT_DIARY');
    const gratitude = candidates.find(c => c.sourceType === 'RECENT_GRATITUDE');

    // Core assertion: diary (negative, recent) MUST outrank gratitude (positive, older) in GEEL
    expect(diary!.relevanceScore).toBeGreaterThan(gratitude!.relevanceScore * 1.5);
    // Diary should be in top 2 (TODAY_MOOD with elevated despondency may also score high)
    const eligible = candidates.filter(c => c.eligible);
    const sorted = [...eligible].sort((a, b) => b.relevanceScore - a.relevanceScore);
    const diaryRank = sorted.findIndex(c => c.sourceType === 'RECENT_DIARY');
    const gratitudeRank = sorted.findIndex(c => c.sourceType === 'RECENT_GRATITUDE');
    expect(diaryRank).toBeLessThan(gratitudeRank);
    expect(diaryRank).toBeLessThanOrEqual(1); // diary in top 2
  });

  it('T12: Selection picks diary before gratitude in GEEL zone', () => {
    const { candidates, moodMetric } = buildGreetingSynthesisCandidates({
      userDat: null,
      stateDat: {
        currentMood: { craving: 3, frustration: 4, despondency: 5, focus: 5 },
        moodLastUpdatedAt: '2026-06-17T07:28:00.000Z',
        vspZone: 'GEEL',
      },
      projectionsDat: { fears: [] },
      logsDat: null,
      diaryMetadata: {
        latestEntryCreatedAt: '2026-06-17T07:25:00.000Z',
        latestSafeAnchor: 'onzeker over mijn uitgang vandaag',
      },
      gratitudeMetadata: {
        latestEntryCreatedAt: '2026-06-16T08:00:00.000Z',
        latestSafeAnchor: 'kalme sfeer in huis',
      },
      freshness: makeFreshness({
        latestDiaryAgeInDays: 0.003,
        latestGratitudeAgeInDays: 0.98,
      }),
    });

    const selected = selectGreetingSynthesisSources({ candidates, moodMetric });

    // Diary must appear before gratitude in selection
    const diaryIdx = selected.findIndex(s => s.sourceType === 'RECENT_DIARY');
    const gratitudeIdx = selected.findIndex(s => s.sourceType === 'RECENT_GRATITUDE');
    // Diary must be selected
    expect(diaryIdx).toBeGreaterThanOrEqual(0);
    // If gratitude is selected at all, it must be after diary
    if (gratitudeIdx >= 0) {
      expect(diaryIdx).toBeLessThan(gratitudeIdx);
    }
    // First source should NOT be gratitude
    expect(selected[0].sourceType).not.toBe('RECENT_GRATITUDE');
  });
});
