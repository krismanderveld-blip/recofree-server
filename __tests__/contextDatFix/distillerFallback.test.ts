/**
 * Tests for context.dat distiller fixes:
 * 1. Length-guard fallback: empty memory-layer [] should NOT block pipeline userDat fallback
 * 2. Both personas (elias + kim) work correctly
 */
import { describe, it, expect } from 'vitest';
import { distillContextDat, serializeContextDatForGPT } from '../../lib/pipeline/context-dat-distiller';
import type { Backpack, UserDat } from '../../lib/ai/types';

// Minimal backpack fixture
const makeBackpack = (persona: 'elias' | 'kim'): Backpack => ({
  naam: 'TestUser',
  userType: persona === 'elias' ? 'afhankelijkheid' : 'naaste',
  sections: [{ id: 'childhood', title: 'Childhood', content: 'Grew up with Melissa and John in Antwerp.' }],
  createdAt: '2026-01-01T00:00:00Z',
  intakeContext: { stageOfChange: 'contemplation', startEmotion: 'frustrated', urgency: 'medium', initialContext: 'test' },
} as any);

// UserDat with populated schemaTendencies and modeTendencies (pipeline source)
const makeUserDat = (): UserDat => ({
  naam: 'TestUser',
  currentMood: { craving: 3, frustration: 5, despondency: 2, focus: 7 },
  moodHistory: [],
  chatHistory: [],
  moduleUsage: [],
  triggerPatterns: [{ trigger: 'conflict', count: 5, weight: 8 }],
  totalSessions: 10,
  lastSessionDate: '2026-07-04',
  sessionAnalyses: [],
  relationalAnchors: [{ name: 'Melissa', role: 'partner', roleEN: 'partner', emotionalWeight: 0.9 }],
  schemaTendencies: [
    { schemaId: 'abandonment', schemaName: 'Abandonment', confidence: 0.85, lastUpdatedAt: '2026-07-04' },
    { schemaId: 'defectiveness', schemaName: 'Defectiveness', confidence: 0.72, lastUpdatedAt: '2026-07-04' },
    { schemaId: 'emotional_deprivation', schemaName: 'Emotional Deprivation', confidence: 0.65, lastUpdatedAt: '2026-07-04' },
  ],
  modeTendencies: [
    { modeId: 'vulnerable_child', modeName: 'Vulnerable Child', confidence: 0.78, lastUpdatedAt: '2026-07-04' },
    { modeId: 'detached_protector', modeName: 'Detached Protector', confidence: 0.80, lastUpdatedAt: '2026-07-04' },
  ],
} as any);

// Empty memory-layer UserDat (simulates what happens when SessionMemoryCache returns null → store creates empty)
const makeEmptyMemoryLayerUserDat = () => ({
  schemaVersion: 'user.dat.v2',
  persona: 'elias' as const,
  localUserId: 'local_user',
  schemaTendencies: [],  // EMPTY — this is the bug trigger
  modeTendencies: [],     // EMPTY — this is the bug trigger
  triggerPatterns: [],
  moduleUsage: [],
  moodHistory: [],
  totalSessions: 0,
  createdAt: '2026-07-04T00:00:00Z',
  updatedAt: '2026-07-04T00:00:00Z',
});

// Populated memory-layer UserDat (simulates correct state after keys are registered)
const makePopulatedMemoryLayerUserDat = () => ({
  schemaVersion: 'user.dat.v2',
  persona: 'elias' as const,
  localUserId: 'local_user',
  schemaTendencies: [
    { schemaId: 'mistrust_abuse', schemaName: 'Mistrust/Abuse', confidence: 0.9, lastUpdatedAt: '2026-07-04' },
    { schemaId: 'social_isolation', schemaName: 'Social Isolation', confidence: 0.75, lastUpdatedAt: '2026-07-04' },
  ],
  modeTendencies: [
    { modeId: 'angry_child', modeName: 'Angry Child', confidence: 0.6, lastUpdatedAt: '2026-07-04' },
  ],
  triggerPatterns: [],
  moduleUsage: [],
  moodHistory: [],
  totalSessions: 10,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-07-04T00:00:00Z',
});

describe('context.dat distiller — length-guard fallback fix', () => {
  it('falls through to pipeline userDat when memory-layer has empty arrays', () => {
    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat: makeUserDat(),
      logsDat: null,
      stateDat: null,
      projectionsDat: null,
      userDatMemory: makeEmptyMemoryLayerUserDat() as any,
      diaryEntries: [],
    });

    // Should get schemas from pipeline userDat (3 schemas with conf >= 0.3)
    expect(result.schemas.length).toBe(3);
    expect(result.schemas[0].schemaId).toBe('abandonment');
    expect(result.schemas[0].confidence).toBe(0.85);

    // Should get modes from pipeline userDat (2 modes with conf >= 0.3)
    expect(result.modes.length).toBe(2);
    expect(result.modes[0].modeId).toBe('detached_protector');
  });

  it('prefers memory-layer when it has populated data', () => {
    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat: makeUserDat(),
      logsDat: null,
      stateDat: null,
      projectionsDat: null,
      userDatMemory: makePopulatedMemoryLayerUserDat() as any,
      diaryEntries: [],
    });

    // Should get schemas from memory-layer (2 schemas)
    expect(result.schemas.length).toBe(2);
    expect(result.schemas[0].schemaId).toBe('mistrust_abuse');

    // Should get modes from memory-layer (1 mode)
    expect(result.modes.length).toBe(1);
    expect(result.modes[0].modeId).toBe('angry_child');
  });

  it('returns empty when BOTH sources have empty arrays', () => {
    const emptyUserDat = makeUserDat();
    emptyUserDat.schemaTendencies = [];
    emptyUserDat.modeTendencies = [];

    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat: emptyUserDat,
      logsDat: null,
      stateDat: null,
      projectionsDat: null,
      userDatMemory: makeEmptyMemoryLayerUserDat() as any,
      diaryEntries: [],
    });

    expect(result.schemas.length).toBe(0);
    expect(result.modes.length).toBe(0);
  });

  it('returns empty when memory-layer is null and pipeline has no data', () => {
    const emptyUserDat = makeUserDat();
    emptyUserDat.schemaTendencies = [];
    emptyUserDat.modeTendencies = [];

    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat: emptyUserDat,
      logsDat: null,
      stateDat: null,
      projectionsDat: null,
      userDatMemory: null,
      diaryEntries: [],
    });

    expect(result.schemas.length).toBe(0);
    expect(result.modes.length).toBe(0);
  });

  it('works for Kim persona identically', () => {
    const result = distillContextDat({
      backpack: makeBackpack('kim'),
      userDat: makeUserDat(),
      logsDat: null,
      stateDat: null,
      projectionsDat: null,
      userDatMemory: makeEmptyMemoryLayerUserDat() as any,
      diaryEntries: [],
    });

    // The distiller maps userType 'naaste' to persona via backpack.userType
    // In the actual app, 'naaste' maps to 'kim' persona in the pipeline,
    // but the distiller uses the raw value. The key test is schemas/modes fallback.
    expect(result.schemas.length).toBe(3); // falls through to pipeline userDat
    expect(result.modes.length).toBe(2);
  });

  it('filters schemas below 0.3 confidence threshold', () => {
    const userDat = makeUserDat();
    userDat.schemaTendencies = [
      { schemaId: 'low_conf', schemaName: 'Low', confidence: 0.2, lastUpdatedAt: '2026-07-04' },
      { schemaId: 'high_conf', schemaName: 'High', confidence: 0.8, lastUpdatedAt: '2026-07-04' },
    ] as any;

    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat,
      logsDat: null,
      stateDat: null,
      projectionsDat: null,
      userDatMemory: makeEmptyMemoryLayerUserDat() as any,
      diaryEntries: [],
    });

    expect(result.schemas.length).toBe(1);
    expect(result.schemas[0].schemaId).toBe('high_conf');
  });

  it('caps schemas at max 5', () => {
    const userDat = makeUserDat();
    userDat.schemaTendencies = Array.from({ length: 10 }, (_, i) => ({
      schemaId: `schema_${i}`, schemaName: `Schema ${i}`, confidence: 0.9 - i * 0.05, lastUpdatedAt: '2026-07-04',
    })) as any;

    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat,
      logsDat: null,
      stateDat: null,
      projectionsDat: null,
      userDatMemory: makeEmptyMemoryLayerUserDat() as any,
      diaryEntries: [],
    });

    expect(result.schemas.length).toBe(5);
    // Should be top 5 by confidence
    expect(result.schemas[0].confidence).toBe(0.9);
    expect(result.schemas[4].confidence).toBe(0.7);
  });
});

describe('context.dat serializer — section headers match trace expectations', () => {
  it('serializes schemas under [SCHEMAS] header', () => {
    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat: makeUserDat(),
      logsDat: null,
      stateDat: null,
      projectionsDat: null,
      userDatMemory: null,
      diaryEntries: [],
    });

    const serialized = serializeContextDatForGPT(result);
    expect(serialized).toContain('[SCHEMAS]');
    expect(serialized).toContain('Abandonment');
  });

  it('serializes modes under [MODES] header', () => {
    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat: makeUserDat(),
      logsDat: null,
      stateDat: null,
      projectionsDat: null,
      userDatMemory: null,
      diaryEntries: [],
    });

    const serialized = serializeContextDatForGPT(result);
    expect(serialized).toContain('[MODES]');
    expect(serialized).toContain('Detached Protector');
  });

  it('serializes key figures under [KEY FIGURES] header', () => {
    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat: makeUserDat(),
      logsDat: null,
      stateDat: null,
      projectionsDat: null,
      userDatMemory: null,
      diaryEntries: [],
    });

    const serialized = serializeContextDatForGPT(result);
    expect(serialized).toContain('[KEY FIGURES]');
    expect(serialized).toContain('Melissa');
  });

  it('does NOT contain Dutch section headers (modus, dag, sessie, projectie)', () => {
    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat: makeUserDat(),
      logsDat: { sessions: [{ endedAt: '2026-07-03', startedAt: '2026-07-03', discussedTopics: ['conflict'], emotionalThemes: [{ label: 'anger' }], openEndpoints: [{ label: 'boundary' }], compressedNarrative: 'Had a fight with partner' }], routingAudit: [] } as any,
      stateDat: { moodHistory: [{ timestampIso: '2026-07-04T10:00:00Z', craving: 3, frustration: 5, despondency: 2, focus: 7 }, { timestampIso: '2026-07-03T10:00:00Z', craving: 4, frustration: 6, despondency: 3, focus: 6 }] } as any,
      projectionsDat: { fears: [{ label: 'relapse', currentScore: 0.8, category: 'addiction' }], hopes: [] } as any,
      userDatMemory: null,
      diaryEntries: [],
    });

    const serialized = serializeContextDatForGPT(result);
    // The old regexes searched for these Dutch words — they should NOT appear as section headers
    expect(serialized).not.toMatch(/^\[.*modus.*\]/gmi);
    expect(serialized).not.toMatch(/^\[.*sessie.*\]/gmi);
    expect(serialized).not.toMatch(/^\[.*projectie.*\]/gmi);
  });
});

describe('context.dat distiller — 7-day trend extraction', () => {
  it('returns empty when stateDat is null', () => {
    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat: makeUserDat(),
      logsDat: null,
      stateDat: null,
      projectionsDat: null,
      userDatMemory: null,
      diaryEntries: [],
    });

    expect(result.sevenDayTrend.length).toBe(0);
  });

  it('returns empty when stateDat has empty moodHistory', () => {
    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat: makeUserDat(),
      logsDat: null,
      stateDat: { moodHistory: [] } as any,
      projectionsDat: null,
      userDatMemory: null,
      diaryEntries: [],
    });

    expect(result.sevenDayTrend.length).toBe(0);
  });

  it('computes trend from populated moodHistory', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat: makeUserDat(),
      logsDat: null,
      stateDat: {
        moodHistory: [
          { timestampIso: yesterday.toISOString(), craving: 2, frustration: 3, despondency: 1, focus: 8 },
          { timestampIso: now.toISOString(), craving: 5, frustration: 6, despondency: 4, focus: 5 },
        ],
      } as any,
      projectionsDat: null,
      userDatMemory: null,
      diaryEntries: [],
    });

    expect(result.sevenDayTrend.length).toBeGreaterThan(0);
    const cravingTrend = result.sevenDayTrend.find(t => t.dimension === 'craving');
    expect(cravingTrend).toBeDefined();
    expect(cravingTrend!.direction).toBe('rising');
  });
});

describe('context.dat distiller — session summaries extraction', () => {
  it('returns empty when logsDat is null', () => {
    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat: makeUserDat(),
      logsDat: null,
      stateDat: null,
      projectionsDat: null,
      userDatMemory: null,
      diaryEntries: [],
    });

    expect(result.sessionSummaries.length).toBe(0);
  });

  it('extracts last 3 sessions from logsDat', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      endedAt: `2026-07-0${i + 1}T12:00:00Z`,
      startedAt: `2026-07-0${i + 1}T10:00:00Z`,
      discussedTopics: [`topic_${i}`],
      emotionalThemes: [{ label: `theme_${i}` }],
      openEndpoints: [{ label: `endpoint_${i}` }],
      compressedNarrative: `Session ${i} narrative`,
    }));

    const result = distillContextDat({
      backpack: makeBackpack('elias'),
      userDat: makeUserDat(),
      logsDat: { sessions, routingAudit: [] } as any,
      stateDat: null,
      projectionsDat: null,
      userDatMemory: null,
      diaryEntries: [],
    });

    expect(result.sessionSummaries.length).toBe(3);
    // Newest first
    expect(result.sessionSummaries[0].narrative).toContain('Session 4');
  });
});
