/**
 * Nested Passthrough Integration Test
 *
 * PURPOSE: Verify that .passthrough() on nested objects in chatInputSchema
 * preserves ALL client-sent fields — including unknown/future fields that
 * are not explicitly defined in the Zod schema.
 *
 * BACKGROUND: Zod v4 strips unknown keys from nested objects by default.
 * Only objects with explicit .passthrough() preserve extra fields.
 * This test ensures that the critical nested objects (backpack, userDat,
 * diaryEntries, extractedEntities, backpackAnalysis, knownUserPatterns)
 * all preserve unknown fields after parsing.
 */
import { describe, it, expect } from 'vitest';
import { chatInputSchema } from '../../server/ai-chat';

// ─── Fixtures ──────────────────────────────────────────────────────

function basePayload() {
  return {
    userType: 'elias' as const,
    userName: 'TestUser',
    message: 'Test bericht.',
    conversationHistory: [
      { role: 'user' as const, content: 'Test bericht.' },
    ],
    moodSliders: { craving: 3 },
    isSessionStart: true,
    activeModules: ['E02'],
    crisisLevel: 0,
    detectedEmotion: 'neutral',
    therapeuticStance: 'tone:warm',
    sessionDurationMinutes: 5,
    urgency: 'laag',
    startEmotion: 'neutral',
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('Nested .passthrough() — unknown fields preserved in nested objects', () => {

  it('TOP-LEVEL: unknown fields are preserved via .passthrough()', () => {
    const payload = {
      ...basePayload(),
      futureTopLevelField: 'should survive',
      anotherFutureField: { nested: true },
    };
    const result = chatInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.data as any).futureTopLevelField).toBe('should survive');
    expect((result.data as any).anotherFutureField).toEqual({ nested: true });
  });

  it('BACKPACK: unknown fields inside backpack are preserved', () => {
    const payload = {
      ...basePayload(),
      backpack: {
        naam: 'Test',
        userType: 'elias' as const,
        lifeStory: [{ id: '1', label: 'Kindertijd', ageRange: '0-12', content: 'Test' }],
        intakeContext: {
          startEmotion: 'anxious',
          urgency: 'hoog',
          initialContext: 'Test context',
          intakeDate: '2025-01-01',
        },
        createdAt: '2025-01-01T00:00:00Z',
        // Unknown fields that should be preserved:
        vspSection: { zone: 'GROEN', whatHelps: ['wandelen'] },
        selfImage: 'Ik ben sterk',
        wheelOfChange: { stage: 'action', confidence: 0.8 },
        futureBackpackField: 'preserved',
      },
    };
    const result = chatInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const backpack = (result.data as any).backpack;
    expect(backpack.vspSection).toEqual({ zone: 'GROEN', whatHelps: ['wandelen'] });
    expect(backpack.selfImage).toBe('Ik ben sterk');
    expect(backpack.wheelOfChange).toEqual({ stage: 'action', confidence: 0.8 });
    expect(backpack.futureBackpackField).toBe('preserved');
  });

  it('USERDAT: unknown fields inside userDat are preserved', () => {
    const payload = {
      ...basePayload(),
      userDat: {
        totalSessions: 10,
        triggerPatterns: [{ trigger: 'stress', count: 3, firstSeen: '2025-01-01', lastSeen: '2025-06-01' }],
        moodHistory: [{ sliders: { craving: 4 }, timestamp: '2025-06-01T10:00:00Z' }],
        moduleUsageSummary: ['E02'],
        lastSessionDate: '2025-06-01',
        sessionAnalyses: [],
        // Unknown fields that should be preserved:
        schemaTendencies: [{ schemaId: 'ABANDONMENT', confidence: 0.7 }],
        modeTendencies: [{ modeId: 'VULNERABLE_CHILD', confidence: 0.6 }],
        clinicalModeActive: true,
        futureUserDatField: 42,
      },
    };
    const result = chatInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const userDat = (result.data as any).userDat;
    expect(userDat.schemaTendencies).toEqual([{ schemaId: 'ABANDONMENT', confidence: 0.7 }]);
    expect(userDat.modeTendencies).toEqual([{ modeId: 'VULNERABLE_CHILD', confidence: 0.6 }]);
    expect(userDat.clinicalModeActive).toBe(true);
    expect(userDat.futureUserDatField).toBe(42);
  });

  it('DIARY ENTRIES: unknown fields inside diary entry items are preserved', () => {
    const payload = {
      ...basePayload(),
      diaryEntries: [
        {
          content: 'Vandaag was een goede dag.',
          moodTag: 'positief',
          timestamp: '2025-06-01T20:00:00Z',
          gratitude: { entry1: 'Zon', entry2: 'Familie', entry3: null },
          // Unknown fields that should be preserved:
          id: 'diary-001',
          category: 'reflectie',
          linkedTrigger: 'werkstress',
          futureEntryField: true,
        },
      ],
    };
    const result = chatInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const entry = (result.data as any).diaryEntries[0];
    expect(entry.id).toBe('diary-001');
    expect(entry.category).toBe('reflectie');
    expect(entry.linkedTrigger).toBe('werkstress');
    expect(entry.futureEntryField).toBe(true);
    // Also verify gratitude is preserved
    expect(entry.gratitude.entry1).toBe('Zon');
  });

  it('EXTRACTED ENTITIES: unknown fields inside extractedEntities are preserved', () => {
    const payload = {
      ...basePayload(),
      extractedEntities: {
        persons: [{ name: 'Melissa', relationship: 'partner', relationshipNL: 'partner', age: '35', livingSituation: 'samenwonend', emotionalValence: 'positief', context: 'steun', sourceSection: 'levensverhaal' }],
        events: [],
        patterns: [],
        contexts: [],
        extractedAt: '2025-06-01T10:00:00Z',
        sourceHash: 'abc123',
        schemaVersion: 2,
        // Unknown fields that should be preserved:
        futureEntityField: 'preserved',
        enrichmentVersion: 3,
      },
    };
    const result = chatInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const entities = (result.data as any).extractedEntities;
    expect(entities.futureEntityField).toBe('preserved');
    expect(entities.enrichmentVersion).toBe(3);
  });

  it('BACKPACK ANALYSIS: unknown fields inside backpackAnalysis are preserved', () => {
    const payload = {
      ...basePayload(),
      backpackAnalysis: {
        schemas: [{ name: 'verlating', confidence: 0.8, evidence: 'Vader vertrok op 6-jarige leeftijd' }],
        modi: [{ name: 'kwetsbaar_kind', confidence: 0.7, evidence: 'Terugkerende angst' }],
        triggers: ['conflict', 'afwijzing'],
        coreBeliefs: ['Ik ben niet goed genoeg'],
        copingPatterns: ['vermijding'],
        analysisVersion: 2,
        analyzedAt: '2025-06-01T10:00:00Z',
        previousAnalyzedAt: '2025-05-01T10:00:00Z',
        // Unknown fields that should be preserved:
        futureAnalysisField: 'preserved',
        modelUsed: 'gpt-4o-2025-06',
      },
    };
    const result = chatInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const analysis = (result.data as any).backpackAnalysis;
    expect(analysis.futureAnalysisField).toBe('preserved');
    expect(analysis.modelUsed).toBe('gpt-4o-2025-06');
  });

  it('KNOWN USER PATTERNS: unknown fields inside knownUserPatterns are preserved', () => {
    const payload = {
      ...basePayload(),
      knownUserPatterns: {
        schemas: [{ name: 'verlating', confidence: 0.8 }],
        modes: [{ name: 'kwetsbaar_kind', confidence: 0.7 }],
        triggers: ['conflict'],
        // Unknown fields that should be preserved:
        futurePatternField: 'preserved',
        lastUpdated: '2025-06-01',
      },
    };
    const result = chatInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const patterns = (result.data as any).knownUserPatterns;
    expect(patterns.futurePatternField).toBe('preserved');
    expect(patterns.lastUpdated).toBe('2025-06-01');
  });

  it('RECENTLY ADDED FIELDS: recentRelapseEvent, preventionPlan, acknowledgedCandidates are typed and preserved', () => {
    const payload = {
      ...basePayload(),
      recentRelapseEvent: {
        type: 'slip',
        daysAgo: 2,
        context: 'Na een feestje',
      },
      preventionPlan: {
        zone: 'ORANJE',
        warningSigns: 'Slaapproblemen, prikkelbaarheid',
        copingStrategies: 'Wandelen, bellen met vriend',
        supportContacts: 'Jan (sponsor)',
        safeActivities: 'Lezen, tuinieren',
        motivation: 'Voor mijn kinderen',
      },
      preventionPlanMissing: false,
      acknowledgedCandidates: {
        schemas: [{ name: 'verlating', confidence: 0.75 }],
        modes: [{ name: 'kwetsbaar_kind', confidence: 0.65 }],
      },
    };
    const result = chatInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.recentRelapseEvent).toEqual(payload.recentRelapseEvent);
    expect(result.data.preventionPlan).toEqual(payload.preventionPlan);
    expect(result.data.preventionPlanMissing).toBe(false);
    expect(result.data.acknowledgedCandidates).toEqual(payload.acknowledgedCandidates);
  });

  it('DIARY GRATITUDE: gratitude field inside diaryEntries is NOT stripped', () => {
    const payload = {
      ...basePayload(),
      diaryEntries: [
        {
          content: 'Moeilijke dag.',
          moodTag: 'negatief',
          timestamp: '2025-06-01T22:00:00Z',
          gratitude: {
            entry1: 'Mijn hond',
            entry2: 'Goede koffie',
            entry3: 'Rust in de avond',
          },
        },
      ],
    };
    const result = chatInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const entry = result.data.diaryEntries![0];
    expect(entry.gratitude).toEqual({
      entry1: 'Mijn hond',
      entry2: 'Goede koffie',
      entry3: 'Rust in de avond',
    });
  });

  it('FULL CLIENT PAYLOAD: all fields from openai-provider SESSION_INIT survive parsing', () => {
    // This simulates the full payload as sent by the client
    const payload = {
      ...basePayload(),
      isSessionStart: true,
      selectedTriggers: [{ trigger: 'werkstress', score: 0.8 }],
      riskScore: 3,
      dominantModule: 'E02',
      vspLevel: '4',
      coreWound: 'verlating',
      contextLine: 'Gebruiker worstelt met werkstress',
      relationshipAnchor: { name: 'Melissa', role: 'partner', roleEN: 'partner' },
      recentDiary: [{ content: 'Goede dag', moodTag: 'positief', date: '2025-06-01' }],
      stageOfChange: 'action',
      backpack: {
        naam: 'TestUser',
        userType: 'elias' as const,
        lifeStory: [{ id: '1', label: 'Kindertijd', ageRange: '0-12', content: 'Moeilijke jeugd' }],
        intakeContext: { startEmotion: 'anxious', urgency: 'hoog', initialContext: 'Werkstress', intakeDate: '2025-01-01' },
        createdAt: '2025-01-01T00:00:00Z',
        // Extra fields the client sends:
        vspSection: { zone: 'GROEN' },
      },
      userDat: {
        totalSessions: 15,
        triggerPatterns: [{ trigger: 'werkstress', count: 5, firstSeen: '2025-01-01', lastSeen: '2025-06-01' }],
        moodHistory: [{ sliders: { craving: 3 }, timestamp: '2025-06-01T10:00:00Z' }],
        moduleUsageSummary: ['E02', 'E05'],
        lastSessionDate: '2025-06-01',
        sessionAnalyses: [],
        // Extra fields the client sends:
        schemaTendencies: [{ schemaId: 'ABANDONMENT', confidence: 0.7 }],
      },
      diaryEntries: [{
        content: 'Vandaag goed geslapen.',
        moodTag: 'positief',
        timestamp: '2025-06-01T08:00:00Z',
        gratitude: { entry1: 'Zon', entry2: null, entry3: null },
        // Extra field:
        id: 'diary-001',
      }],
      contextDat: 'serialized context.dat content',
      deepeningBlock: 'targeted fragment content',
      recentRelapseEvent: { type: 'slip', daysAgo: 5, context: null },
      preventionPlan: { zone: 'GEEL', warningSigns: 'Slaapproblemen' },
      preventionPlanMissing: false,
      acknowledgedCandidates: { schemas: [], modes: [] },
    };

    const result = chatInputSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Validation errors:', result.error.format());
      return;
    }

    // Verify nested passthrough fields survived
    expect((result.data as any).backpack.vspSection).toEqual({ zone: 'GROEN' });
    expect((result.data as any).userDat.schemaTendencies).toEqual([{ schemaId: 'ABANDONMENT', confidence: 0.7 }]);
    expect((result.data as any).diaryEntries[0].id).toBe('diary-001');
    expect(result.data.diaryEntries![0].gratitude!.entry1).toBe('Zon');
    expect(result.data.contextDat).toBe('serialized context.dat content');
    expect(result.data.deepeningBlock).toBe('targeted fragment content');
    expect(result.data.recentRelapseEvent).toEqual({ type: 'slip', daysAgo: 5, context: null });
  });
});
