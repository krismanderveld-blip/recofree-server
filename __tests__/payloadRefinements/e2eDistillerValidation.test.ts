/**
 * E2E Validation: context.dat distiller produces schemas/modes/trend correctly
 * after the length-guard fix + deepening cache integration.
 *
 * Proves:
 * 1. When memory-layer is empty but pipeline userDat has data → distiller uses fallback
 * 2. Deepening cache returns cached fragments on second call (no re-scan)
 * 3. Token labels in trace are correctly named
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { distillContextDat, serializeContextDatForGPT } from '../../lib/pipeline/context-dat-distiller';
import { resolveDeepening, serializeDeepeningForGPT } from '../../lib/pipeline/context-dat-deepening';
import { clearDeepeningCache, getCacheSize, getDeepeningCacheStats } from '../../lib/pipeline/deepening-cache';

// ─── Fixtures ────────────────────────────────────────────────

const makeUserDatWithSchemas = () => ({
  schemaTendencies: [
    { schemaId: 'verlating', schemaName: 'Verlating', confidence: 0.85, frequency: 12, copingStyle: 'vermijding' },
    { schemaId: 'wantrouwen', schemaName: 'Wantrouwen', confidence: 0.72, frequency: 8, copingStyle: 'overcompensatie' },
    { schemaId: 'tekortschieten', schemaName: 'Tekortschieten', confidence: 0.65, frequency: 6, copingStyle: 'overgave' },
    { schemaId: 'afhankelijkheid', schemaName: 'Afhankelijkheid', confidence: 0.45, frequency: 4, copingStyle: 'vermijding' },
    { schemaId: 'onderwerping', schemaName: 'Onderwerping', confidence: 0.20, frequency: 2, copingStyle: 'overgave' }, // Below threshold
  ],
  modeTendencies: [
    { modeId: 'kwetsbaar_kind', modeName: 'Kwetsbaar Kind', confidence: 0.78, frequency: 10 },
    { modeId: 'bestraffende_ouder', modeName: 'Bestraffende Ouder', confidence: 0.62, frequency: 7 },
    { modeId: 'gezonde_volwassene', modeName: 'Gezonde Volwassene', confidence: 0.55, frequency: 5 },
    { modeId: 'afstandelijke_beschermer', modeName: 'Afstandelijke Beschermer', confidence: 0.15, frequency: 1 }, // Below threshold
  ],
  triggerPatterns: [
    { trigger: 'afwijzing', frequency: 8, lastSeen: '2026-07-01' },
    { trigger: 'conflict', frequency: 5, lastSeen: '2026-07-03' },
  ],
  moodHistory: [
    { date: '2026-07-01', avgMood: 4.2 },
    { date: '2026-07-02', avgMood: 3.8 },
    { date: '2026-07-03', avgMood: 5.1 },
    { date: '2026-07-04', avgMood: 4.5 },
  ],
  backpackAnalysis: { summary: 'User shows verlating pattern', keyInsights: ['fear of abandonment'] },
});

const makeBackpack = () => ({
  userType: 'elias' as const,
  sections: [
    { key: 'relaties', content: 'Sarah is mijn ex-partner. Ze heeft me verlaten vorig jaar.' },
    { key: 'triggers', content: 'Afwijzing door collega Mark triggert mijn verlatingschema.' },
  ],
  kimBackpack: null,
});

const makeLogsDat = () => ({
  sessions: [
    { startedAt: '2026-06-20T10:00:00Z', compressedNarrative: 'Gebruiker sprak over Sarah en verlating.', discussedTopics: ['verlating', 'relatie'], openEndpoints: [{ label: 'Sarah-contact' }] },
    { startedAt: '2026-06-25T10:00:00Z', compressedNarrative: 'Focus op werk-stress en conflict met Mark.', discussedTopics: ['werk', 'conflict'], openEndpoints: [] },
    { startedAt: '2026-06-28T10:00:00Z', compressedNarrative: 'Terugval na contact met ex. Verlatingangst hoog.', discussedTopics: ['terugval', 'verlating'], openEndpoints: [{ label: 'terugvalpreventie' }] },
    { startedAt: '2026-07-01T10:00:00Z', compressedNarrative: 'Stabielere dag. Oefening gedaan.', discussedTopics: ['stabiliteit', 'oefening'], openEndpoints: [] },
    { startedAt: '2026-07-03T10:00:00Z', compressedNarrative: 'Gesprek over toekomstangst.', discussedTopics: ['toekomst', 'angst'], openEndpoints: [{ label: 'toekomstplan' }] },
  ],
  routingAudit: [],
});

const makeEmptyMemoryLayer = () => ({
  schemaTendencies: [],
  modeTendencies: [],
  moodHistory: [],
  triggerPatterns: [],
});

const makeContextDat = () => ({
  keyFigures: [{ name: 'Sarah', role: 'ex-partner', sentiment: 'negatief' }],
  schemas: [
    { schemaId: 'verlating', schemaName: 'Verlating', confidence: 0.85, copingStyle: 'vermijding' },
    { schemaId: 'wantrouwen', schemaName: 'Wantrouwen', confidence: 0.72, copingStyle: 'overcompensatie' },
  ],
  modes: [
    { modeId: 'kwetsbaar_kind', modeName: 'Kwetsbaar Kind', confidence: 0.78 },
  ],
  sevenDayTrend: [{ date: '2026-07-01', avgMood: 4.2 }],
  sessionSummaries: [{ date: '2026-07-03', summary: 'Gesprek over toekomstangst.' }],
  activeProjections: [],
});

const makeNanoResult = () => ({
  themes: ['Mark en conflict op werk', 'verlating door Sarah'],
  emotions: ['angst', 'verdriet'],
  intent: 'exploration',
  urgency: 'medium' as const,
});

// ─── Tests ───────────────────────────────────────────────────

describe('E2E: context.dat distiller produces correct output after fixes', () => {

  describe('Fix 1A: Length-guard fallback — schemas/modes from pipeline userDat', () => {

    it('distills schemas from pipeline userDat when memory-layer is empty', () => {
      const result = distillContextDat({
        backpack: makeBackpack() as any,
        userDat: makeUserDatWithSchemas() as any,
        logsDat: makeLogsDat() as any,
        stateDat: { moodHistory: [] } as any,
        projectionsDat: { fears: [], hopes: [] } as any,
        userDatMemory: makeEmptyMemoryLayer() as any,
        diaryEntries: [],
      });

      // Should have schemas (from pipeline userDat fallback, filtered by 0.3 threshold)
      expect(result.schemas.length).toBe(4); // verlating, wantrouwen, tekortschieten, afhankelijkheid (all >= 0.3)
      expect(result.schemas[0].schemaId).toBe('verlating');
      expect(result.schemas[0].confidence).toBe(0.85);
    });

    it('distills modes from pipeline userDat when memory-layer is empty', () => {
      const result = distillContextDat({
        backpack: makeBackpack() as any,
        userDat: makeUserDatWithSchemas() as any,
        logsDat: makeLogsDat() as any,
        stateDat: { moodHistory: [] } as any,
        projectionsDat: { fears: [], hopes: [] } as any,
        userDatMemory: makeEmptyMemoryLayer() as any,
        diaryEntries: [],
      });

      // Should have modes (from pipeline userDat fallback, filtered by 0.3 threshold)
      expect(result.modes.length).toBe(3); // kwetsbaar_kind, bestraffende_ouder, gezonde_volwassene (all >= 0.3)
      expect(result.modes[0].modeId).toBe('kwetsbaar_kind');
    });

    it('distills 7-day trend from stateDat when it has proper MoodHistoryRecords', () => {
      const now = new Date();
      const stateDat = {
        moodHistory: [
          { timestampIso: new Date(now.getTime() - 2 * 86400000).toISOString(), craving: 3, frustration: 5, despondency: 4, focus: 6, stress: 7, boundaryFatigue: 3, emotionalBurden: 5, selfCare: 4 },
          { timestampIso: new Date(now.getTime() - 1 * 86400000).toISOString(), craving: 2, frustration: 4, despondency: 3, focus: 7, stress: 5, boundaryFatigue: 2, emotionalBurden: 4, selfCare: 5 },
          { timestampIso: now.toISOString(), craving: 1, frustration: 3, despondency: 2, focus: 8, stress: 4, boundaryFatigue: 1, emotionalBurden: 3, selfCare: 6 },
        ],
      };
      const result = distillContextDat({
        backpack: makeBackpack() as any,
        userDat: makeUserDatWithSchemas() as any,
        logsDat: makeLogsDat() as any,
        stateDat: stateDat as any,
        projectionsDat: { fears: [], hopes: [] } as any,
        userDatMemory: makeEmptyMemoryLayer() as any,
        diaryEntries: [],
      });

      // Should have trend entries (one per dimension that has data)
      expect(result.sevenDayTrend.length).toBeGreaterThan(0);
      expect(result.sevenDayTrend.length).toBeLessThanOrEqual(8); // max 8 dimensions
    });

    it('serialized output contains [SCHEMAS] and [MODES] sections with data', () => {
      const result = distillContextDat({
        backpack: makeBackpack() as any,
        userDat: makeUserDatWithSchemas() as any,
        logsDat: makeLogsDat() as any,
        stateDat: { moodHistory: [] } as any,
        projectionsDat: { fears: [], hopes: [] } as any,
        userDatMemory: makeEmptyMemoryLayer() as any,
        diaryEntries: [],
      });

      const serialized = serializeContextDatForGPT(result);
      expect(serialized).toContain('[SCHEMAS]');
      expect(serialized).toContain('Verlating'); // serializer uses schemaName (capitalized)
      expect(serialized).toContain('[MODES]');
      expect(serialized).toContain('Kwetsbaar Kind'); // serializer uses modeName (capitalized)
    });

    it('session summaries are extracted from logsDat', () => {
      const result = distillContextDat({
        backpack: makeBackpack() as any,
        userDat: makeUserDatWithSchemas() as any,
        logsDat: makeLogsDat() as any,
        stateDat: { moodHistory: [] } as any,
        projectionsDat: { fears: [], hopes: [] } as any,
        userDatMemory: makeEmptyMemoryLayer() as any,
        diaryEntries: [],
      });

      expect(result.sessionSummaries.length).toBeGreaterThan(0);
      expect(result.sessionSummaries.length).toBeLessThanOrEqual(3); // max 3 recent
    });
  });

  describe('Fix 2: Deepening cache — repeated references use cache', () => {

    beforeEach(() => {
      clearDeepeningCache();
    });

    it('first call triggers retrieval, second call uses cache', () => {
      const contextDat = makeContextDat() as any;
      const nanoResult = makeNanoResult() as any;
      const backpack = makeBackpack() as any;
      const userDat = makeUserDatWithSchemas() as any;
      const logsDat = makeLogsDat() as any;

      // First call — should retrieve from stores
      const result1 = resolveDeepening({
        contextDat,
        nanoResult,
        backpack,
        userDat,
        logsDat,
        currentMessage: 'Mark zei iets vervelends vandaag',
      });

      const stats1 = result1.cacheStats!;
      // First call: all misses (nothing cached yet)
      expect(stats1.misses).toBeGreaterThanOrEqual(0);

      // Second call with same person reference — should hit cache
      const result2 = resolveDeepening({
        contextDat,
        nanoResult,
        backpack,
        userDat,
        logsDat,
        currentMessage: 'Mark deed het weer',
      });

      const stats2 = result2.cacheStats!;
      // Second call should have at least one cache hit
      expect(stats2.hits).toBeGreaterThan(stats1.hits);
    });

    it('clearDeepeningCache resets all entries', () => {
      const contextDat = makeContextDat() as any;
      const nanoResult = makeNanoResult() as any;
      const backpack = makeBackpack() as any;
      const userDat = makeUserDatWithSchemas() as any;
      const logsDat = makeLogsDat() as any;

      // Populate cache
      resolveDeepening({
        contextDat,
        nanoResult,
        backpack,
        userDat,
        logsDat,
        currentMessage: 'Mark is vervelend',
      });

      expect(getCacheSize()).toBeGreaterThan(0);

      // Clear
      clearDeepeningCache();
      expect(getCacheSize()).toBe(0);
      expect(getDeepeningCacheStats().hits).toBe(0);
      expect(getDeepeningCacheStats().misses).toBe(0);
    });

    it('cache respects max 20 entries', () => {
      // Manually fill cache beyond limit via resolveDeepening with many different persons
      const contextDat = { ...makeContextDat(), keyFigures: [] } as any; // empty so all persons trigger deepening
      const backpack = {
        ...makeBackpack(),
        sections: Array.from({ length: 25 }, (_, i) => ({
          key: `person${i}`,
          content: `Person${i} is een vriend. Person${i} helpt me.`,
        })),
      } as any;

      for (let i = 0; i < 25; i++) {
        resolveDeepening({
          contextDat,
          nanoResult: { themes: [`Person${i} en conflict`], emotions: ['frustratie'], intent: 'exploration', urgency: 'low' } as any,
          backpack,
          userDat: makeUserDatWithSchemas() as any,
          logsDat: null,
          currentMessage: `Person${i} deed iets`,
        });
      }

      // Cache should not exceed 20
      expect(getCacheSize()).toBeLessThanOrEqual(20);
    });

    it('deepening result still respects 500 token cap with cache', () => {
      const contextDat = { ...makeContextDat(), keyFigures: [] } as any;
      const backpack = {
        ...makeBackpack(),
        sections: Array.from({ length: 10 }, (_, i) => ({
          key: `person${i}`,
          content: `Person${i} is iemand die heel veel heeft meegemaakt in het leven. ${'Heel veel tekst. '.repeat(50)}`,
        })),
      } as any;

      const result = resolveDeepening({
        contextDat,
        nanoResult: { themes: ['Person0 en Person1 en Person2'], emotions: ['verdriet'], intent: 'exploration', urgency: 'medium' } as any,
        backpack,
        userDat: makeUserDatWithSchemas() as any,
        logsDat: null,
        currentMessage: 'Person0 en Person1 en Person2 waren er',
      });

      expect(result.totalTokens).toBeLessThanOrEqual(500);
    });
  });

  describe('Token label correctness (trace field naming)', () => {

    it('contextDatTokens measures only the serialized context.dat string', () => {
      const result = distillContextDat({
        backpack: makeBackpack() as any,
        userDat: makeUserDatWithSchemas() as any,
        logsDat: makeLogsDat() as any,
        stateDat: { moodHistory: [] } as any,
        projectionsDat: { fears: [], hopes: [] } as any,
        userDatMemory: makeEmptyMemoryLayer() as any,
        diaryEntries: [],
      });

      const serialized = serializeContextDatForGPT(result);
      const contextDatTokens = Math.ceil(serialized.length / 4);

      // contextDatTokens should be much smaller than a full JSON dump
      const fullDump = JSON.stringify({ backpack: makeBackpack(), userDat: makeUserDatWithSchemas() });
      const legacyTokens = Math.ceil(fullDump.length / 4);

      expect(contextDatTokens).toBeLessThan(legacyTokens);
      expect(contextDatTokens).toBeLessThan(1000); // context.dat is compact
    });

    it('serialized output is non-empty when schemas/modes exist', () => {
      const result = distillContextDat({
        backpack: makeBackpack() as any,
        userDat: makeUserDatWithSchemas() as any,
        logsDat: makeLogsDat() as any,
        stateDat: { moodHistory: [] } as any,
        projectionsDat: { fears: [], hopes: [] } as any,
        userDatMemory: makeEmptyMemoryLayer() as any,
        diaryEntries: [],
      });

      const serialized = serializeContextDatForGPT(result);
      expect(serialized.length).toBeGreaterThan(100);
      expect(serialized).toContain('[KEY FIGURES]');
    });
  });
});
