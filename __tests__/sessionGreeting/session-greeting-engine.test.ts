/**
 * Session Greeting Engine — 20 Acceptance Tests
 * Tests the deterministic anchor selection logic (engine decides, GPT executes).
 * Priority order (corrected): FIRST_SESSION > CRISIS > FEAR > MOOD > DIARY > GRATITUDE > BACKPACK > SCHEMA_ROTATION > MISSING_DATA
 */

import { describe, it, expect } from 'vitest';
import { evaluateGreetingFreshness } from '@/lib/features/sessionGreeting/evaluateGreetingFreshness';
import { buildGreetingAnchorCandidates } from '@/lib/features/sessionGreeting/buildGreetingAnchorCandidates';
import { resolveGreetingAnchorPriority } from '@/lib/features/sessionGreeting/resolveGreetingAnchorPriority';
import { resolveSchemaRotationAnchor } from '@/lib/features/sessionGreeting/resolveSchemaRotationAnchor';
import { buildGreetingPromptPayload, enforceGreetingOutputRules } from '@/lib/features/sessionGreeting/buildGreetingPromptPayload';
import type {
  GreetingUserDatSnapshot,
  GreetingStateDatSnapshot,
  GreetingProjectionsDatSnapshot,
  GreetingLogsDatSnapshot,
  GreetingDiaryMetadata,
  GreetingGratitudeMetadata,
  GreetingFreshnessResult,
  GreetingSchemaTendency,
} from '@/lib/features/sessionGreeting/sessionGreeting.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = '2026-06-15T10:00:00.000Z';
const TODAY = '2026-06-15';
const TIMEZONE = 'Europe/Amsterdam';

function makeUserDat(overrides: Partial<GreetingUserDatSnapshot> = {}): GreetingUserDatSnapshot {
  return {
    userName: 'Kris',
    sessionStats: {
      totalSessionsStarted: 5,
      currentSessionNumber: 6,
    },
    schemaTendencies: [],
    ...overrides,
  };
}

function makeStateDat(overrides: Partial<GreetingStateDatSnapshot> = {}): GreetingStateDatSnapshot {
  return {
    currentMood: { craving: 3, frustration: 2, despondency: 2, focus: 5 },
    moodLastUpdatedAt: NOW,
    vspZone: 'GROEN',
    ...overrides,
  };
}

function makeProjectionsDat(overrides: Partial<GreetingProjectionsDatSnapshot> = {}): GreetingProjectionsDatSnapshot {
  return {
    fears: [],
    ...overrides,
  };
}

function buildCandidatesFromInputs(opts: {
  userDat?: GreetingUserDatSnapshot;
  stateDat?: GreetingStateDatSnapshot;
  projectionsDat?: GreetingProjectionsDatSnapshot;
  diaryMetadata?: GreetingDiaryMetadata | null;
  gratitudeMetadata?: GreetingGratitudeMetadata | null;
  freshness?: Partial<GreetingFreshnessResult>;
}) {
  const userDat = opts.userDat ?? makeUserDat();
  const stateDat = opts.stateDat ?? makeStateDat();
  const projectionsDat = opts.projectionsDat ?? makeProjectionsDat();
  const diaryMetadata = opts.diaryMetadata ?? null;
  const gratitudeMetadata = opts.gratitudeMetadata ?? null;

  const freshness: GreetingFreshnessResult = {
    slidersFilledToday: false,
    moodUsable: false,
    diaryRecentUnder3Days: false,
    gratitudeRecentUnder3Days: false,
    backpackRecentlyUpdatedUnder24h: false,
    latestDiaryAgeInDays: null,
    latestGratitudeAgeInDays: null,
    backpackAgeInHours: null,
    ...opts.freshness,
  };

  return buildGreetingAnchorCandidates({
    nowIso: NOW,
    userDat,
    stateDat,
    projectionsDat,
    logsDat: null,
    diaryMetadata,
    gratitudeMetadata,
    freshness,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Session Greeting Engine — Anchor Selection', () => {
  // Test 1: FIRST_SESSION selected when totalSessionsStarted=0
  it('Test 1: FIRST_SESSION selected when totalSessionsStarted=0', () => {
    const userDat = makeUserDat({ sessionStats: { totalSessionsStarted: 0, currentSessionNumber: 1 } });
    const candidates = buildCandidatesFromInputs({ userDat });
    const selected = resolveGreetingAnchorPriority(candidates);
    expect(selected.anchorType).toBe('FIRST_SESSION');
  });

  // Test 2: CRISIS_OR_HIGH_CRAVING selected when craving≥7
  it('Test 2: CRISIS_OR_HIGH_CRAVING selected when craving>=7', () => {
    const stateDat = makeStateDat({ currentMood: { craving: 8, frustration: 2, despondency: 2, focus: 5 } });
    const candidates = buildCandidatesFromInputs({
      stateDat,
      freshness: { slidersFilledToday: true, moodUsable: true },
    });
    const selected = resolveGreetingAnchorPriority(candidates);
    expect(selected.anchorType).toBe('CRISIS_OR_HIGH_CRAVING');
  });

  // Test 3: ACTIVE_PROJECTION_FEAR selected when decayScore>=0.60
  it('Test 3: ACTIVE_PROJECTION_FEAR selected when decayScore>=0.60', () => {
    const projectionsDat = makeProjectionsDat({
      fears: [{ label: 'Verlating', decayScore: 0.75, lastReinforcedAt: NOW }],
    });
    const candidates = buildCandidatesFromInputs({ projectionsDat });
    const selected = resolveGreetingAnchorPriority(candidates);
    expect(selected.anchorType).toBe('ACTIVE_PROJECTION_FEAR');
  });

  // Test 4: TODAY_MOOD_SLIDERS selected when sliders filled today with notable value
  it('Test 4: TODAY_MOOD_SLIDERS selected when sliders filled today with notable value', () => {
    const stateDat = makeStateDat({ currentMood: { craving: 2, frustration: 7, despondency: 3, focus: 5 } });
    const candidates = buildCandidatesFromInputs({
      stateDat,
      freshness: { slidersFilledToday: true, moodUsable: true },
    });
    const selected = resolveGreetingAnchorPriority(candidates);
    expect(selected.anchorType).toBe('TODAY_MOOD_SLIDERS');
  });

  // Test 5: RECENT_DIARY selected when diary < 3 days old
  it('Test 5: RECENT_DIARY selected when diary < 3 days old', () => {
    const diaryMetadata: GreetingDiaryMetadata = {
      latestEntryCreatedAt: '2026-06-14T08:00:00.000Z',
      latestSafeAnchor: 'Vandaag voelde ik me rustiger dan gisteren',
    };
    const candidates = buildCandidatesFromInputs({
      diaryMetadata,
      freshness: { diaryRecentUnder3Days: true, latestDiaryAgeInDays: 1.1 },
    });
    const selected = resolveGreetingAnchorPriority(candidates);
    expect(selected.anchorType).toBe('RECENT_DIARY');
  });

  // Test 6: RECENT_GRATITUDE selected when gratitude < 3 days old
  it('Test 6: RECENT_GRATITUDE selected when gratitude < 3 days old', () => {
    const gratitudeMetadata: GreetingGratitudeMetadata = {
      latestEntryCreatedAt: '2026-06-14T20:00:00.000Z',
      latestSafeAnchor: 'Dankbaar voor mijn zus die belde',
    };
    const candidates = buildCandidatesFromInputs({
      gratitudeMetadata,
      freshness: { gratitudeRecentUnder3Days: true, latestGratitudeAgeInDays: 0.6 },
    });
    const selected = resolveGreetingAnchorPriority(candidates);
    expect(selected.anchorType).toBe('RECENT_GRATITUDE');
  });

  // Test 7: BACKPACK_RECENT_UPDATE selected when backpack updated < 24h ago
  it('Test 7: BACKPACK_RECENT_UPDATE selected when backpack updated < 24h ago', () => {
    const userDat = makeUserDat({ backpackLastUpdatedAt: '2026-06-15T02:00:00.000Z' });
    const candidates = buildCandidatesFromInputs({
      userDat,
      freshness: { backpackRecentlyUpdatedUnder24h: true, backpackAgeInHours: 8 },
    });
    const selected = resolveGreetingAnchorPriority(candidates);
    expect(selected.anchorType).toBe('BACKPACK_RECENT_UPDATE');
  });

  // Test 8: SCHEMA_ROTATION selected on session 4 with eligible schemas
  it('Test 8: SCHEMA_ROTATION selected on session 4 with eligible schemas', () => {
    const schemas: GreetingSchemaTendency[] = [
      { schemaId: 'verlating', schemaName: 'Verlating/Instabiliteit', confidence: 0.80, lastUpdatedAt: NOW },
    ];
    const userDat = makeUserDat({
      sessionStats: { totalSessionsStarted: 3, currentSessionNumber: 4 },
      schemaTendencies: schemas,
    });
    const candidates = buildCandidatesFromInputs({ userDat });
    const selected = resolveGreetingAnchorPriority(candidates);
    expect(selected.anchorType).toBe('SCHEMA_ROTATION');
  });

  // Test 9: MISSING_DATA_INVITATION as fallback when nothing else eligible
  it('Test 9: MISSING_DATA_INVITATION as fallback when nothing else eligible', () => {
    const candidates = buildCandidatesFromInputs({});
    const selected = resolveGreetingAnchorPriority(candidates);
    expect(selected.anchorType).toBe('MISSING_DATA_INVITATION');
  });

  // Test 10: CRISIS overrides ACTIVE_PROJECTION_FEAR
  it('Test 10: CRISIS overrides ACTIVE_PROJECTION_FEAR', () => {
    const stateDat = makeStateDat({ currentMood: { craving: 9, frustration: 2, despondency: 2, focus: 5 } });
    const projectionsDat = makeProjectionsDat({
      fears: [{ label: 'Verlating', decayScore: 0.90, lastReinforcedAt: NOW }],
    });
    const candidates = buildCandidatesFromInputs({
      stateDat,
      projectionsDat,
      freshness: { slidersFilledToday: true, moodUsable: true },
    });
    const selected = resolveGreetingAnchorPriority(candidates);
    expect(selected.anchorType).toBe('CRISIS_OR_HIGH_CRAVING');
  });

  // Test 11: ACTIVE_PROJECTION_FEAR overrides TODAY_MOOD_SLIDERS
  it('Test 11: ACTIVE_PROJECTION_FEAR overrides TODAY_MOOD_SLIDERS', () => {
    const stateDat = makeStateDat({ currentMood: { craving: 2, frustration: 8, despondency: 3, focus: 5 } });
    const projectionsDat = makeProjectionsDat({
      fears: [{ label: 'Mislukking', decayScore: 0.65, lastReinforcedAt: NOW }],
    });
    const candidates = buildCandidatesFromInputs({
      stateDat,
      projectionsDat,
      freshness: { slidersFilledToday: true, moodUsable: true },
    });
    const selected = resolveGreetingAnchorPriority(candidates);
    expect(selected.anchorType).toBe('ACTIVE_PROJECTION_FEAR');
  });

  // Test 12 (CORRECTED): RECENT_DIARY overrides BACKPACK_RECENT_UPDATE
  it('Test 12: RECENT_DIARY overrides BACKPACK_RECENT_UPDATE (corrected priority)', () => {
    const userDat = makeUserDat({ backpackLastUpdatedAt: '2026-06-15T02:00:00.000Z' });
    const diaryMetadata: GreetingDiaryMetadata = {
      latestEntryCreatedAt: '2026-06-14T08:00:00.000Z',
      latestSafeAnchor: 'Ik schreef over mijn angst',
    };
    const candidates = buildCandidatesFromInputs({
      userDat,
      diaryMetadata,
      freshness: {
        diaryRecentUnder3Days: true,
        latestDiaryAgeInDays: 1.1,
        backpackRecentlyUpdatedUnder24h: true,
        backpackAgeInHours: 8,
      },
    });
    const selected = resolveGreetingAnchorPriority(candidates);
    expect(selected.anchorType).toBe('RECENT_DIARY');
  });

  // Test 13: SCHEMA_ROTATION only on 4th session (not 3rd, not 5th)
  it('Test 13: SCHEMA_ROTATION only on 4th session (not 3rd, not 5th)', () => {
    const schemas: GreetingSchemaTendency[] = [
      { schemaId: 'verlating', schemaName: 'Verlating', confidence: 0.80, lastUpdatedAt: NOW },
    ];

    // Session 3: no rotation
    const result3 = resolveSchemaRotationAnchor({
      currentSessionNumber: 3,
      schemaTendencies: schemas,
    });
    expect(result3.selectedSchema).toBeNull();

    // Session 4: rotation
    const result4 = resolveSchemaRotationAnchor({
      currentSessionNumber: 4,
      schemaTendencies: schemas,
    });
    expect(result4.selectedSchema).not.toBeNull();

    // Session 5: no rotation
    const result5 = resolveSchemaRotationAnchor({
      currentSessionNumber: 5,
      schemaTendencies: schemas,
    });
    expect(result5.selectedSchema).toBeNull();
  });

  // Test 14: Schema rotation cycles through schemas without repetition
  it('Test 14: Schema rotation cycles through schemas without repetition', () => {
    const schemas: GreetingSchemaTendency[] = [
      { schemaId: 'verlating', schemaName: 'Verlating', confidence: 0.85, lastUpdatedAt: NOW },
      { schemaId: 'wantrouwen', schemaName: 'Wantrouwen', confidence: 0.70, lastUpdatedAt: NOW },
      { schemaId: 'mislukking', schemaName: 'Mislukking', confidence: 0.65, lastUpdatedAt: NOW },
    ];

    // Session 4: first schema
    const r1 = resolveSchemaRotationAnchor({
      currentSessionNumber: 4,
      schemaTendencies: schemas,
    });
    expect(r1.selectedSchema!.schemaId).toBe('verlating');

    // Session 8: second schema (first already used)
    const r2 = resolveSchemaRotationAnchor({
      currentSessionNumber: 8,
      schemaTendencies: schemas,
      rotationState: r1.nextRotationState,
    });
    expect(r2.selectedSchema!.schemaId).toBe('wantrouwen');

    // Session 12: third schema
    const r3 = resolveSchemaRotationAnchor({
      currentSessionNumber: 12,
      schemaTendencies: schemas,
      rotationState: r2.nextRotationState,
    });
    expect(r3.selectedSchema!.schemaId).toBe('mislukking');
  });

  // Test 15: Schema rotation resets cycle when all schemas used
  it('Test 15: Schema rotation resets cycle when all schemas used', () => {
    const schemas: GreetingSchemaTendency[] = [
      { schemaId: 'verlating', schemaName: 'Verlating', confidence: 0.85, lastUpdatedAt: NOW },
      { schemaId: 'wantrouwen', schemaName: 'Wantrouwen', confidence: 0.70, lastUpdatedAt: NOW },
    ];

    // Use both schemas
    const r1 = resolveSchemaRotationAnchor({ currentSessionNumber: 4, schemaTendencies: schemas });
    const r2 = resolveSchemaRotationAnchor({ currentSessionNumber: 8, schemaTendencies: schemas, rotationState: r1.nextRotationState });

    // All used — next session should reset and start from top
    const r3 = resolveSchemaRotationAnchor({ currentSessionNumber: 12, schemaTendencies: schemas, rotationState: r2.nextRotationState });
    expect(r3.selectedSchema).not.toBeNull();
    expect(r3.selectedSchema!.schemaId).toBe('verlating'); // Resets to highest confidence
  });
});

describe('Session Greeting Engine — Freshness Evaluation', () => {
  // Test 16: evaluateGreetingFreshness — slidersFilledToday correct
  it('Test 16: evaluateGreetingFreshness — slidersFilledToday correct', () => {
    const result = evaluateGreetingFreshness({
      nowIso: NOW,
      localCalendarDate: TODAY,
      timezone: TIMEZONE,
      stateDat: { moodLastUpdatedAt: '2026-06-15T08:00:00.000Z' },
      userDat: null,
      diaryMetadata: null,
      gratitudeMetadata: null,
    });
    expect(result.slidersFilledToday).toBe(true);

    // Yesterday (21:00 UTC = 23:00 Amsterdam = still June 14 local? No, 21:00 UTC = 23:00 CEST = June 14)
    // Actually in CEST (UTC+2), 2026-06-14T21:00:00Z = 2026-06-14T23:00 local (still June 14)
    // Use 2026-06-14T20:00:00Z which is 22:00 local on June 14
    const result2 = evaluateGreetingFreshness({
      nowIso: NOW,
      localCalendarDate: TODAY,
      timezone: TIMEZONE,
      stateDat: { moodLastUpdatedAt: '2026-06-14T20:00:00.000Z' },
      userDat: null,
      diaryMetadata: null,
      gratitudeMetadata: null,
    });
    expect(result2.slidersFilledToday).toBe(false);
  });

  // Test 17: evaluateGreetingFreshness — diaryRecentUnder3Days boundary (exactly 3 days = false)
  it('Test 17: evaluateGreetingFreshness — diaryRecentUnder3Days boundary (exactly 3 days = false)', () => {
    // Exactly 3 days ago
    const exactly3DaysAgo = '2026-06-12T10:00:00.000Z';
    const result = evaluateGreetingFreshness({
      nowIso: NOW,
      localCalendarDate: TODAY,
      timezone: TIMEZONE,
      stateDat: null,
      userDat: null,
      diaryMetadata: { latestEntryCreatedAt: exactly3DaysAgo },
      gratitudeMetadata: null,
    });
    expect(result.diaryRecentUnder3Days).toBe(false);

    // Just under 3 days
    const justUnder3Days = '2026-06-12T10:00:01.000Z';
    const result2 = evaluateGreetingFreshness({
      nowIso: NOW,
      localCalendarDate: TODAY,
      timezone: TIMEZONE,
      stateDat: null,
      userDat: null,
      diaryMetadata: { latestEntryCreatedAt: justUnder3Days },
      gratitudeMetadata: null,
    });
    expect(result2.diaryRecentUnder3Days).toBe(true);
  });
});

describe('Session Greeting Engine — Prompt Payload', () => {
  // Test 18: buildGreetingPromptPayload — estimatedTokens < 800
  it('Test 18: buildGreetingPromptPayload — estimatedTokens < 800', () => {
    const anchor = {
      anchorType: 'RECENT_DIARY' as const,
      reason: 'Recent diary (1.2 days)',
      payload: { latestSafeAnchor: 'Ik voelde me vandaag rustiger' },
    };
    const userDat = makeUserDat();
    const { estimatedTokens } = buildGreetingPromptPayload(anchor, userDat);
    expect(estimatedTokens).toBeLessThan(800);
  });

  // Test 19: enforceGreetingOutputRules — removes emoji, truncates long output
  it('Test 19: enforceGreetingOutputRules — removes emoji, truncates long output', () => {
    const rawWithEmoji = 'Kris, fijn dat je er bent! 😊 Hoe gaat het vandaag met je?';
    const { greeting, violations } = enforceGreetingOutputRules(rawWithEmoji, 'Kris');
    expect(greeting).not.toMatch(/😊/);
    expect(violations).toContain('Contains emoji');

    // Test truncation: 5+ sentences
    const longGreeting = 'Kris, welkom. Hoe gaat het? Ik ben hier voor je. Laten we praten. Wat houdt je bezig? Er is ruimte voor alles.';
    const { greeting: truncated, violations: v2 } = enforceGreetingOutputRules(longGreeting, 'Kris');
    expect(v2.some(v => v.includes('Too many sentences'))).toBe(true);
  });
});

describe('Session Greeting Engine — Schema Rotation Edge Cases', () => {
  // Test 20: resolveSchemaRotationAnchor — no rotation when session % 4 ≠ 0
  it('Test 20: resolveSchemaRotationAnchor — no rotation when session % 4 != 0', () => {
    const schemas: GreetingSchemaTendency[] = [
      { schemaId: 'verlating', schemaName: 'Verlating', confidence: 0.90, lastUpdatedAt: NOW },
    ];

    for (const session of [1, 2, 3, 5, 6, 7, 9, 10, 11]) {
      const result = resolveSchemaRotationAnchor({
        currentSessionNumber: session,
        schemaTendencies: schemas,
      });
      expect(result.selectedSchema).toBeNull();
    }

    // But session 8 DOES rotate
    const result8 = resolveSchemaRotationAnchor({
      currentSessionNumber: 8,
      schemaTendencies: schemas,
    });
    expect(result8.selectedSchema).not.toBeNull();
  });
});
