/**
 * P4: Contract Test — Server/Client Engine Drift Detection
 *
 * PURPOSE: Verify that the server's chatInputSchema (Zod) accepts ALL fields
 * that the client pipeline (openai-provider.ts) actually sends. If the client
 * adds a new field but the server schema doesn't know about it, the schema
 * uses .passthrough() so it won't reject — but this test documents the
 * contract and catches structural mismatches (wrong types, missing required fields).
 *
 * WHAT THIS TESTS:
 * 1. SESSION_INIT payload (full context) passes Zod validation
 * 2. LIVE_MESSAGE payload (slim) passes Zod validation
 * 3. Kim-specific payload (eigenRegieContext, Kim cluster contexts) passes
 * 4. Elias-specific payload (stageOfChange, STOA, projections) passes
 * 5. All optional module contexts pass when present
 * 6. acknowledgedCandidates (passthrough field) is preserved
 * 7. contextDat/deepeningBlock (passthrough fields) are preserved
 */
import { describe, it, expect } from 'vitest';
import { chatInputSchema } from '../../server/ai-chat';

// ─── Fixtures ──────────────────────────────────────────────────────

/** Minimal required fields that EVERY payload must have */
function basePayload() {
  return {
    userType: 'elias' as const,
    userName: 'TestUser',
    message: 'Ik voel me onrustig vandaag.',
    conversationHistory: [
      { role: 'assistant' as const, content: 'Welkom terug, TestUser.' },
      { role: 'user' as const, content: 'Ik voel me onrustig vandaag.' },
    ],
    moodSliders: { craving: 4, frustration: 5, despondency: 3, focus: 6 },
    isSessionStart: false,
    activeModules: ['E02'],
    crisisLevel: 0,
    detectedEmotion: 'anxiety',
    therapeuticStance: 'tone:warm | Reflective listening.',
    sessionDurationMinutes: 8,
    urgency: 'midden',
    startEmotion: 'anxious',
  };
}

/** Full SESSION_INIT payload as sent by openai-provider.ts */
function buildSessionInitPayload() {
  return {
    ...basePayload(),
    isSessionStart: true,
    dominantModule: 'E02',
    riskScore: 3,
    vspLevel: 'GEEL',
    isCrisis: false,
    stageOfChange: 'contemplation',
    eigenRegieContext: null, // Elias user — null for eigen regie

    // Static context
    selectedTriggers: [{ trigger: 'werkstress', score: 0.8 }],
    coreWound: 'Ik ben niet goed genoeg.',
    contextLine: 'Verlating door vader op 8-jarige leeftijd.',
    relationshipAnchor: { name: 'Moeder', role: 'primaire hechtingsfiguur', roleEN: 'primary attachment figure' },
    relationalPattern: { pattern: 'vermijding', schema: 'verlating', confidence: 0.75 },
    recentDiary: [{ content: 'Vandaag was zwaar.', moodTag: 'Sad', date: '2026-07-30' }],

    // Buffer snapshot
    bufferSnapshot: {
      zoneScore: 55,
      zoneColor: 'GEEL',
      liveIntent: 'exploratie',
      intensityTrajectory: 'stijgend',
      currentEmotion: 'anxiety',
      responseDirection: 'containment',
      currentRelationshipAnchor: 'Moeder',
      messageCount: 3,
      dominantState: {
        dominantModule: 'E02',
        dominantTrigger: 'werkstress',
        dominantDirection: 'exploratie',
        dominantTone: 'warm',
        riskScore: 3,
        selectionReason: 'nano_interpret',
        sourceLayer: 'NANO',
      },
    },

    // Regulation
    regulationResult: {
      action: 'reflect' as const,
      intervention: null,
      gptInstruction: null,
      zone: 'YELLOW' as const,
      effectiveDepth: 'normal' as const,
      wasSoftened: false,
      wasSkipped: false,
    },

    // Engine directive
    engineDirective: {
      engine: 'elias' as const,
      zoneLevel: 'GEEL',
      zoneLabel: 'Verhoogde spanning',
      impact: { primaryDirective: 'Exploreer onderliggende emotie.' },
    },

    // Module contexts
    interventionContinuity: 'Vorige sessie: schema verlating geëxploreerd.',
    projectionContext: 'Angst: ontslag volgende maand.',
    projectionDeepening: null,
    stoaContext: '=== STOA ===\nWat is binnen je controle?\n=== END STOA ===',
    schemaModeContext: 'Active: kwetsbaar_kind (0.85)',
    actContext: null,
    cgtContext: null,
    dgtContext: null,
    mbtContext: null,
    ko1Context: null,
    k05Context: null,
    k02Context: null,
    k04Context: null,
    k04s4Context: null,
    k06Context: null,
    k01Context: null,
    k03Context: null,
    sw01Context: null,
    sto01Context: null,
    vergv01Context: null,
    igh01Context: null,
    agc01Context: null,
    hwk01Context: null,
    fale01Context: null,
    verg01Context: null,
    rouw01Context: null,
    iden01Context: null,
    zink01Context: null,
    terv01Context: null,
    mi02Context: null,
    slaap01EliasContext: null,
    slaap01KimContext: null,
    bedr01Context: null,
    vetr01Context: null,
    gasl01Context: null,
    cdp01Context: null,
    rnw01Context: null,
    par01Context: null,
    fin01Context: null,
    iso01Context: null,
    psychoEducationContext: null,
    steunpilarenContext: null,
    selfAcceptanceContext: null,
    kimPatternSupportContext: null,

    // Kim cluster contexts (null for Elias)
    relapseClusterContext: null,
    dangerChildContext: null,
    relationalDynamicsContext: null,
    emotionalLossContext: null,
    stoaKContext: null,

    // VSP Insight
    vspInsightContext: null,
    vspBackpackProfile: null,
    vspStructuredSection: null,

    // Loop/Language
    loopDetected: null,
    languageRecovery: null,

    // Clinical mode
    clinicalModeActive: false,
    backpackEmpty: false,
    activeSignals: null,

    // Structured entities
    extractedEntities: null,
    backpackChanged: false,
    backpackAnalysis: null,
    knownUserPatterns: {
      schemas: [{ name: 'verlating', confidence: 0.8 }],
      modes: [{ name: 'kwetsbaar_kind', confidence: 0.7 }],
      triggers: ['werkstress'],
    },

    // Full data (SESSION_INIT)
    backpack: {
      naam: 'TestUser',
      userType: 'elias' as const,
      lifeStory: [{ id: '1', label: 'Kindertijd', ageRange: '0-12', content: 'Vader vertrok toen ik 8 was.' }],
      intakeContext: { startEmotion: 'anxious', urgency: 'midden', initialContext: 'Werkstress en relatieproblemen.', intakeDate: '2026-06-01' },
      createdAt: '2026-06-01T10:00:00Z',
    },
    userDat: {
      totalSessions: 12,
      triggerPatterns: [{ trigger: 'werkstress', count: 5, firstSeen: '2026-06-05', lastSeen: '2026-07-30' }],
      moodHistory: [{ sliders: { craving: 4, frustration: 5, despondency: 3, focus: 6 }, timestamp: '2026-07-30T14:00:00Z' }],
      moduleUsageSummary: ['E02:8', 'E03:4'],
      lastSessionDate: '2026-07-28T18:00:00Z',
      sessionAnalyses: [{
        sessionNumber: 12,
        date: '2026-07-28',
        messageCount: 14,
        durationMinutes: 22,
        dominantEmotion: 'anxiety',
        themes: ['werkstress', 'verlating'],
        newTriggers: [],
        modulesUsed: ['E02'],
        moodDelta: { distressChange: -1, resilienceChange: 1 },
        endRiskLevel: 'laag',
      }],
    },
    diaryEntries: [{ content: 'Vandaag was zwaar.', moodTag: 'Sad', timestamp: '2026-07-30T20:00:00Z' }],

    // Language
    locale: 'nl' as const,
    country: 'BE' as const,
  };
}

/** Kim SESSION_INIT payload with eigenRegieContext */
function buildKimSessionInitPayload() {
  return {
    ...buildSessionInitPayload(),
    userType: 'kim' as const,
    stageOfChange: null, // Kim doesn't use stageOfChange
    eigenRegieContext: {
      userInput: 6,
      engineScore: 5.5,
      zone: 'GEEL' as const,
      meaning: 'Matige eigen regie — ondersteuning gewenst.',
      impact: {
        primaryDirective: 'Bevestig autonomie, bied structuur.',
        secondaryDirective: 'Exploreer wat de gebruiker zelf al doet.',
      },
    },
    backpack: {
      naam: 'KimUser',
      userType: 'kim' as const,
      lifeStory: [],
      kimBackpack: {
        my_story: 'Ik ben mantelzorger voor mijn moeder.',
        the_relationship: 'Moeilijke relatie met partner.',
        the_impact: 'Uitputting en schuldgevoel.',
        my_boundaries: 'Ik zeg nooit nee.',
        my_strength: 'Ik ben loyaal en zorgzaam.',
      },
      intakeContext: { startEmotion: 'exhausted', urgency: 'midden', initialContext: 'Mantelzorg overbelasting.', intakeDate: '2026-06-15' },
      createdAt: '2026-06-15T10:00:00Z',
    },
    moodSliders: { stress: 7, boundaryFatigue: 6, emotionalBurden: 5 },
    activeModules: ['KO1'],
    // Kim cluster contexts active
    relapseClusterContext: 'Terugval signalen: isolatie, slaapproblemen.',
    dangerChildContext: null,
    relationalDynamicsContext: 'Codependentie patroon met partner.',
    emotionalLossContext: null,
    stoaKContext: null,
  };
}

/** LIVE_MESSAGE slim payload (most optional fields omitted) */
function buildSlimLivePayload() {
  return {
    ...basePayload(),
    dominantModule: 'E02',
    riskScore: 2,
    stageOfChange: 'action',
    selectedTriggers: [{ trigger: 'werkstress', score: 0.6 }],
    knownUserPatterns: {
      schemas: [{ name: 'verlating', confidence: 0.8 }],
      modes: [{ name: 'kwetsbaar_kind', confidence: 0.7 }],
      triggers: ['werkstress'],
    },
    locale: 'nl' as const,
    clinicalModeActive: false,
    backpackEmpty: false,
  };
}

/** Payload with passthrough fields (contextDat, deepeningBlock, acknowledgedCandidates) */
function buildPayloadWithPassthroughFields() {
  return {
    ...buildSlimLivePayload(),
    contextDat: 'DISTILLED: keyFigures=[Moeder(steunend)], schemas=[verlating(0.8)], trend=[↑stress]',
    deepeningBlock: 'DEEPENING: Vader vertrok op 8-jarige leeftijd. Kernwond: verlating.',
    acknowledgedCandidates: {
      schemas: [{ name: 'verlating', confidence: 0.75 }],
      modes: [{ name: 'kwetsbaar_kind', confidence: 0.65 }],
    },
  };
}

// ─── TEST SUITE ────────────────────────────────────────────────────

describe('P4: Server/Client Contract — Drift Detection', () => {

  describe('SESSION_INIT payloads', () => {
    it('Elias full SESSION_INIT passes Zod validation', () => {
      const payload = buildSessionInitPayload();
      const result = chatInputSchema.safeParse(payload);
      if (!result.success) {
        console.error('Zod errors:', JSON.stringify(result.error.issues, null, 2));
      }
      expect(result.success).toBe(true);
    });

    it('Kim full SESSION_INIT passes Zod validation', () => {
      const payload = buildKimSessionInitPayload();
      const result = chatInputSchema.safeParse(payload);
      if (!result.success) {
        console.error('Zod errors:', JSON.stringify(result.error.issues, null, 2));
      }
      expect(result.success).toBe(true);
    });

    it('SESSION_INIT preserves all fields after parse (no silent drops)', () => {
      const payload = buildSessionInitPayload();
      const result = chatInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (!result.success) return;

      const parsed = result.data;
      // Core required fields
      expect(parsed.userType).toBe('elias');
      expect(parsed.userName).toBe('TestUser');
      expect(parsed.isSessionStart).toBe(true);
      // Optional fields preserved
      expect(parsed.stageOfChange).toBe('contemplation');
      expect(parsed.eigenRegieContext).toBeNull();
      expect(parsed.regulationResult).toBeDefined();
      expect(parsed.engineDirective).toBeDefined();
      expect(parsed.knownUserPatterns).toBeDefined();
      expect(parsed.backpack).toBeDefined();
      expect(parsed.userDat).toBeDefined();
    });

    it('Kim eigenRegieContext is correctly validated', () => {
      const payload = buildKimSessionInitPayload();
      const result = chatInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.eigenRegieContext).toEqual({
        userInput: 6,
        engineScore: 5.5,
        zone: 'GEEL',
        meaning: expect.any(String),
        impact: {
          primaryDirective: expect.any(String),
          secondaryDirective: expect.any(String),
        },
      });
    });
  });

  describe('LIVE_MESSAGE payloads', () => {
    it('Slim LIVE_MESSAGE passes Zod validation', () => {
      const payload = buildSlimLivePayload();
      const result = chatInputSchema.safeParse(payload);
      if (!result.success) {
        console.error('Zod errors:', JSON.stringify(result.error.issues, null, 2));
      }
      expect(result.success).toBe(true);
    });

    it('LIVE_MESSAGE with single module context passes', () => {
      const payload = {
        ...buildSlimLivePayload(),
        stoaContext: '=== STOA SESSION ===\nFocus on control.\n=== END ===',
      };
      const result = chatInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('LIVE_MESSAGE with multiple module contexts passes', () => {
      const payload = {
        ...buildSlimLivePayload(),
        schemaModeContext: 'Active: kwetsbaar_kind',
        actContext: 'Values: family connection',
        projectionContext: 'Fear: job loss',
        regulationResult: {
          action: 'regulate' as const,
          intervention: 'Adem even rustig in en uit.',
          gptInstruction: 'Acknowledge regulation before continuing.',
          zone: 'ORANGE' as const,
          effectiveDepth: 'deep' as const,
          wasSoftened: false,
          wasSkipped: false,
        },
      };
      const result = chatInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('Passthrough fields (not in Zod schema but used server-side)', () => {
    it('contextDat and deepeningBlock pass through without rejection', () => {
      const payload = buildPayloadWithPassthroughFields();
      const result = chatInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (!result.success) return;

      // .passthrough() preserves unknown fields
      expect((result.data as any).contextDat).toBe(payload.contextDat);
      expect((result.data as any).deepeningBlock).toBe(payload.deepeningBlock);
    });

    it('acknowledgedCandidates passes through without rejection', () => {
      const payload = buildPayloadWithPassthroughFields();
      const result = chatInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect((result.data as any).acknowledgedCandidates).toEqual({
        schemas: [{ name: 'verlating', confidence: 0.75 }],
        modes: [{ name: 'kwetsbaar_kind', confidence: 0.65 }],
      });
    });
  });

  describe('Persona-specific gating', () => {
    it('Elias payload with stageOfChange and null eigenRegieContext passes', () => {
      const payload = {
        ...buildSlimLivePayload(),
        stageOfChange: 'maintenance',
        eigenRegieContext: null,
      };
      const result = chatInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('Kim payload with eigenRegieContext and null stageOfChange passes', () => {
      const payload = {
        ...buildSlimLivePayload(),
        userType: 'kim' as const,
        stageOfChange: null,
        eigenRegieContext: {
          userInput: 7,
          engineScore: 6.5,
          zone: 'LICHTGROEN' as const,
          meaning: 'Goede eigen regie.',
          impact: {
            primaryDirective: 'Bevestig kracht.',
            secondaryDirective: 'Exploreer volgende stap.',
          },
        },
        moodSliders: { stress: 3, boundaryFatigue: 2, emotionalBurden: 2 },
      };
      const result = chatInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('Edge cases — type safety', () => {
    it('loopDetected as string passes (server expects string)', () => {
      // Client sends serialized string, not object
      const payload = {
        ...buildSlimLivePayload(),
        loopDetected: 'LOOP DETECTED: theme=werkstress, sessions=3. Instruction: Vary approach.',
      };
      const result = chatInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('languageRecovery as string passes (server expects string)', () => {
      const payload = {
        ...buildSlimLivePayload(),
        languageRecovery: 'RECOVERY: theme=negativiteit, delta=-0.3. Instruction: Mirror positive shift.',
      };
      const result = chatInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('Missing required field (message) fails validation', () => {
      const payload = { ...buildSlimLivePayload() };
      delete (payload as any).message;
      const result = chatInputSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('Invalid userType fails validation', () => {
      const payload = { ...buildSlimLivePayload(), userType: 'invalid' };
      const result = chatInputSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('Invalid eigenRegieContext zone fails validation', () => {
      const payload = {
        ...buildSlimLivePayload(),
        eigenRegieContext: {
          userInput: 5,
          engineScore: 4,
          zone: 'BLAUW', // Invalid zone
          meaning: 'test',
          impact: { primaryDirective: 'test', secondaryDirective: 'test' },
        },
      };
      const result = chatInputSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
