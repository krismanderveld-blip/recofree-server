/**
 * Tests for the LIVE_MESSAGE slim payload filter.
 *
 * Verifies that:
 * 1. Core fields are always present
 * 2. Null/undefined optional context fields are omitted
 * 3. Active context fields ARE included
 * 4. knownUserPatterns and backpackAnalysis are always included when available
 * 5. Stats accurately report what was dropped
 */
import { describe, it, expect } from 'vitest';
import { buildSlimLivePayload } from '../../lib/ai/live-message-filter';
import type { GPTPayload } from '../../lib/rugzak/gpt-payload-builder';
import type { ChatContext } from '../../lib/ai/types';

// ─── Helpers ──────────────────────────────────────────────────

function buildMockGPTPayload(overrides: Partial<GPTPayload> = {}): GPTPayload {
  return {
    route: 'elias',
    userName: 'TestUser',
    message: 'Ik voel me vandaag beter',
    conversationWindow: [{ role: 'user', content: 'Hallo' }, { role: 'assistant', content: 'Hoi' }],
    sliders: { craving: 2, frustration: 3, despondency: 1, focus: 7 },
    dominantModule: 'ELIAS_CORE',
    crisisLevel: 0,
    detectedEmotion: 'hoopvol',
    therapeuticStance: 'warm-validating',
    sessionDurationMinutes: 5,
    urgency: 'laag',
    startEmotion: 'neutraal',
    riskScore: 1,
    stageOfChange: 'contemplation',
    selectedTriggers: [{ trigger: 'werkstress', score: 0.7 }],
    guidanceDepth: 'normal',
    bufferSnapshot: null,
    regulationResult: null,
    engineDirective: null,
    // All optional context fields default to undefined (not on GPTPayload type)
    interventionContinuity: undefined,
    projectionContext: undefined,
    projectionDeepening: undefined,
    stoaContext: undefined,
    schemaModeContext: undefined,
    actContext: undefined,
    cgtContext: undefined,
    dgtContext: undefined,
    mbtContext: undefined,
    ko1Context: undefined,
    k05Context: undefined,
    k02Context: undefined,
    k04Context: undefined,
    k04s4Context: undefined,
    k06Context: undefined,
    k01Context: undefined,
    k03Context: undefined,
    sw01Context: undefined,
    sto01Context: undefined,
    kst01Context: undefined,
    kdl01Context: undefined,
    kbr01Context: undefined,
    ksc01Context: undefined,
    vergv01Context: undefined,
    igh01Context: undefined,
    agc01Context: undefined,
    hwk01Context: undefined,
    fale01Context: undefined,
    verg01Context: undefined,
    rouw01Context: undefined,
    iden01Context: undefined,
    zink01Context: undefined,
    terv01Context: undefined,
    mi02Context: undefined,
    slaap01EliasContext: undefined,
    slaap01KimContext: undefined,
    bedr01Context: undefined,
    vetr01Context: undefined,
    gasl01Context: undefined,
    cdp01Context: undefined,
    rnw01Context: undefined,
    par01Context: undefined,
    fin01Context: undefined,
    iso01Context: undefined,
    psychoEducationContext: undefined,
    steunpilarenContext: undefined,
    selfAcceptanceContext: undefined,
    kimPatternSupportContext: undefined,
    loopDetected: undefined,
    languageRecovery: undefined,
    ...overrides,
  } as unknown as GPTPayload;
}

function buildMockContext(overrides: Partial<ChatContext> = {}): ChatContext {
  return {
    userType: 'elias',
    userName: 'TestUser',
    currentMessage: 'Ik voel me vandaag beter',
    conversationHistory: [],
    moodSliders: { craving: 2, frustration: 3, despondency: 1, focus: 7 },
    rugzak: {} as any,
    backpack: {} as any,
    userDat: {
      clinicalModeActive: false,
      schemaTendencies: [{ schemaId: 'verlating_instabiliteit', confidence: 0.9, confirmed: true }],
      modeTendencies: [{ modeId: 'kwetsbaar_kind', confidence: 0.85, confirmed: true }],
      triggerPatterns: [{ trigger: 'eenzaamheid', weight: 5 }],
      backpackAnalysis: {
        schemas: [{ name: 'verlating_instabiliteit', confidence: 0.9 }],
        modi: [{ name: 'kwetsbaar_kind', confidence: 0.85 }],
        triggers: ['werkstress', 'eenzaamheid'],
      },
    } as any,
    isSessionStart: false,
    diaryEntries: [],
    activeModules: ['ELIAS_CORE'],
    crisisLevel: 0,
    isCrisis: false,
    vspLevel: 'groen',
    detectedEmotion: 'hoopvol',
    therapeuticStance: 'warm-validating',
    sessionDurationMinutes: 5,
    urgency: 'laag',
    startEmotion: 'neutraal',
    backpackEmpty: false,
    // Optional context fields — all undefined by default
    relevanceScores: undefined,
    contextSummary: undefined,
    ...overrides,
  } as unknown as ChatContext;
}

const mockHelpers = {
  buildActiveSignals: (_ctx: ChatContext) => [
    { label: 'craving', score: 1, memory: 'state.dat' },
  ],
  buildKnownUserPatterns: (userDat: any, _clinicalMode: boolean) => {
    if (!userDat) return null;
    return {
      schemas: [{ name: 'verlating_instabiliteit', confidence: 0.9 }],
      modes: [{ name: 'kwetsbaar_kind', confidence: 0.85 }],
      triggers: ['eenzaamheid'],
    };
  },
};

// ─── Tests ────────────────────────────────────────────────────

describe('LIVE_MESSAGE Slim Payload Filter', () => {

  describe('Core fields', () => {
    it('C1: Always includes identity and live dynamic fields', () => {
      const payload = buildMockGPTPayload();
      const context = buildMockContext();
      const { payload: result } = buildSlimLivePayload(payload, context, mockHelpers);

      expect(result.userType).toBe('elias');
      expect(result.userName).toBe('TestUser');
      expect(result.isSessionStart).toBe(false);
      expect(result.message).toBe('Ik voel me vandaag beter');
      expect(result.conversationHistory).toBeDefined();
      expect(result.moodSliders).toBeDefined();
      expect(result.activeModules).toEqual(['ELIAS_CORE']);
      expect(result.crisisLevel).toBe(0);
      expect(result.detectedEmotion).toBe('hoopvol');
      expect(result.dominantModule).toBe('ELIAS_CORE');
      expect(result.riskScore).toBe(1);
      expect(result.selectedTriggers).toHaveLength(1);
    });

    it('C2: Always includes knownUserPatterns when userDat has data', () => {
      const payload = buildMockGPTPayload();
      const context = buildMockContext();
      const { payload: result } = buildSlimLivePayload(payload, context, mockHelpers);

      expect(result.knownUserPatterns).toBeDefined();
      const kup = result.knownUserPatterns as any;
      expect(kup.schemas[0].name).toBe('verlating_instabiliteit');
      expect(kup.triggers).toContain('eenzaamheid');
    });

    it('C3: Always includes backpackAnalysis when available', () => {
      const payload = buildMockGPTPayload();
      const context = buildMockContext();
      const { payload: result } = buildSlimLivePayload(payload, context, mockHelpers);

      expect(result.backpackAnalysis).toBeDefined();
      const ba = result.backpackAnalysis as any;
      expect(ba.schemas[0].name).toBe('verlating_instabiliteit');
    });

    it('C4: Always includes activeSignals', () => {
      const payload = buildMockGPTPayload();
      const context = buildMockContext();
      const { payload: result } = buildSlimLivePayload(payload, context, mockHelpers);

      expect(result.activeSignals).toBeDefined();
      expect((result.activeSignals as any[]).length).toBeGreaterThan(0);
    });
  });

  describe('Optional context field filtering', () => {
    it('C5: Omits all null/undefined context fields (no null values in payload)', () => {
      const payload = buildMockGPTPayload(); // all optional contexts undefined
      const context = buildMockContext();
      const { payload: result } = buildSlimLivePayload(payload, context, mockHelpers);

      // None of the module context fields should be present
      expect(result.interventionContinuity).toBeUndefined();
      expect(result.projectionContext).toBeUndefined();
      expect(result.stoaContext).toBeUndefined();
      expect(result.schemaModeContext).toBeUndefined();
      expect(result.actContext).toBeUndefined();
      expect(result.ko1Context).toBeUndefined();
      expect(result.k05Context).toBeUndefined();
      expect(result.relapseClusterContext).toBeUndefined();
      expect(result.vspInsightContext).toBeUndefined();
    });

    it('C6: Includes active context fields when they have a truthy value', () => {
      const payload = buildMockGPTPayload({
        stoaContext: '[STOA] Memento mori — reflect on impermanence.',
        actContext: '[ACT] Values clarification: what matters most?',
      } as any);
      const context = buildMockContext();
      const { payload: result, stats } = buildSlimLivePayload(payload, context, mockHelpers);

      expect(result.stoaContext).toBe('[STOA] Memento mori — reflect on impermanence.');
      expect(result.actContext).toBe('[ACT] Values clarification: what matters most?');
      expect(stats.activeContextFields).toContain('stoaContext');
      expect(stats.activeContextFields).toContain('actContext');
    });

    it('C7: Includes loopDetected when active', () => {
      const payload = buildMockGPTPayload({
        loopDetected: {
          active: true,
          theme: 'werkstress',
          sessionCount: 4,
          instruction: 'LOOP_DETECTED: true',
        },
      } as any);
      const context = buildMockContext();
      const { payload: result, stats } = buildSlimLivePayload(payload, context, mockHelpers);

      expect(result.loopDetected).toBeDefined();
      expect((result.loopDetected as any).theme).toBe('werkstress');
      expect(stats.activeContextFields).toContain('loopDetected');
    });

    it('C8: Includes contextSummary from context when present', () => {
      const payload = buildMockGPTPayload();
      const context = buildMockContext({
        contextSummary: 'User struggles with loneliness after breakup. Key figure: ex-partner.',
      } as any);
      const { payload: result, stats } = buildSlimLivePayload(payload, context, mockHelpers);

      expect(result.contextSummary).toBe('User struggles with loneliness after breakup. Key figure: ex-partner.');
      expect(stats.activeContextFields).toContain('contextSummary');
    });

    it('C9: Includes pastReferenceContext from context when present', () => {
      const payload = buildMockGPTPayload();
      const context = buildMockContext({
        pastReferenceContext: 'In session 3 the user mentioned their father leaving at age 7.',
      } as any);
      const { payload: result, stats } = buildSlimLivePayload(payload, context, mockHelpers);

      expect(result.pastReferenceContext).toBe('In session 3 the user mentioned their father leaving at age 7.');
      expect(stats.activeContextFields).toContain('pastReferenceContext');
    });
  });

  describe('Stats accuracy', () => {
    it('C10: Stats report correct number of dropped null fields', () => {
      const payload = buildMockGPTPayload(); // all optional contexts undefined
      const context = buildMockContext();
      const { stats } = buildSlimLivePayload(payload, context, mockHelpers);

      // All optional context keys should be dropped (none are active)
      expect(stats.droppedNullFields).toBeGreaterThan(40);
      expect(stats.activeContextFields).toHaveLength(0);
    });

    it('C11: Stats report active context fields correctly', () => {
      const payload = buildMockGPTPayload({
        stoaContext: 'active',
        mbtContext: 'active',
        projectionContext: 'active',
      } as any);
      const context = buildMockContext();
      const { stats } = buildSlimLivePayload(payload, context, mockHelpers);

      expect(stats.activeContextFields).toHaveLength(3);
      expect(stats.activeContextFields).toContain('stoaContext');
      expect(stats.activeContextFields).toContain('mbtContext');
      expect(stats.activeContextFields).toContain('projectionContext');
    });

    it('C12: Payload size is significantly smaller than old approach', () => {
      const payload = buildMockGPTPayload(); // all optional contexts undefined
      const context = buildMockContext();
      const { payload: result, stats } = buildSlimLivePayload(payload, context, mockHelpers);

      // The slim payload should have far fewer fields than the old 50+ approach
      const fieldCount = Object.keys(result).length;
      expect(fieldCount).toBeLessThan(30); // Core + meta, no null contexts
      expect(stats.totalFieldsAfter).toBeLessThan(stats.totalFieldsBefore);
    });
  });

  describe('Edge cases', () => {
    it('C13: Handles missing userDat gracefully', () => {
      const payload = buildMockGPTPayload();
      const context = buildMockContext({ userDat: undefined } as any);
      const helpersNoPatterns = {
        ...mockHelpers,
        buildKnownUserPatterns: () => null,
      };
      const { payload: result } = buildSlimLivePayload(payload, context, helpersNoPatterns);

      expect(result.knownUserPatterns).toBeNull();
      expect(result.backpackAnalysis).toBeUndefined();
    });

    it('C14: Includes bufferSnapshot when present', () => {
      const payload = buildMockGPTPayload({
        bufferSnapshot: {
          zone: 'ORANGE',
          emotionalDirection: 'declining',
          liveIntent: 'seeking-validation',
          dominantState: 'anxious',
        },
      } as any);
      const context = buildMockContext();
      const { payload: result } = buildSlimLivePayload(payload, context, mockHelpers);

      expect(result.bufferSnapshot).toBeDefined();
      expect((result.bufferSnapshot as any).zone).toBe('ORANGE');
    });

    it('C15: Does NOT include bufferSnapshot when null', () => {
      const payload = buildMockGPTPayload({ bufferSnapshot: null } as any);
      const context = buildMockContext();
      const { payload: result } = buildSlimLivePayload(payload, context, mockHelpers);

      expect(result.bufferSnapshot).toBeUndefined();
    });
  });
});
