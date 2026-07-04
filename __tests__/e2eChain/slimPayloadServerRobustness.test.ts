/**
 * Server-side robustness test for slim LIVE_MESSAGE payloads.
 *
 * PURPOSE: Prove that the server (Zod schema + buildSystemPrompt) correctly
 * handles payloads where ALL optional context fields are omitted — as now
 * sent by buildSlimLivePayload() on the client. No crash, no silent fallback
 * to client-mode, and the prompt still contains required structural blocks.
 *
 * WHAT CHANGED: The client now omits null/undefined optional fields entirely
 * (context.dat + buildSlimLivePayload). This test ensures the server doesn't
 * crash or produce broken prompts when those fields are missing.
 */
import { describe, it, expect } from 'vitest';
import { chatInputSchema, buildSystemPrompt } from '../../server/ai-chat';

// ─── Fixtures ──────────────────────────────────────────────────────

/** Absolute minimum LIVE_MESSAGE payload — only required fields, no optional context */
function buildMinimalLivePayload() {
  return {
    userType: 'elias' as const,
    userName: 'TestUser',
    message: 'Hoe gaat het vandaag?',
    conversationHistory: [
      { role: 'assistant' as const, content: 'Hoi TestUser, welkom terug.' },
      { role: 'user' as const, content: 'Hoe gaat het vandaag?' },
    ],
    moodSliders: { craving: 3, frustration: 2, despondency: 1, focus: 8 },
    isSessionStart: false,
    activeModules: ['E02'],
    crisisLevel: 0,
    detectedEmotion: 'neutral',
    therapeuticStance: 'tone:warm | Reflective listening.',
    sessionDurationMinutes: 5,
    urgency: 'laag',
    startEmotion: 'calm',
    // ALL optional context fields OMITTED — this is the slim payload
  };
}

/** LIVE_MESSAGE payload with only knownUserPatterns (common case: most fields omitted) */
function buildSlimLiveWithPatterns() {
  return {
    ...buildMinimalLivePayload(),
    knownUserPatterns: {
      schemas: [{ name: 'verlating', confidence: 0.8 }],
      modes: [{ name: 'kwetsbaar_kind', confidence: 0.7 }],
      triggers: ['werkstress', 'eenzaamheid'],
    },
  };
}

/** LIVE_MESSAGE payload with a single active module context (e.g. stoaContext) */
function buildSlimLiveWithSingleModule() {
  return {
    ...buildMinimalLivePayload(),
    stoaContext: '=== STOA SESSION ACTIVE ===\nStep 1: Identify what is within your control.\n=== END STOA ===',
  };
}

/** LIVE_MESSAGE payload with multiple module contexts active simultaneously */
function buildSlimLiveWithMultipleModules() {
  return {
    ...buildMinimalLivePayload(),
    projectionContext: 'Projection: user fears job loss next month.',
    schemaModeContext: 'Active mode: kwetsbaar_kind (confidence 0.85)',
    actContext: 'ACT: Values clarification — user values family connection.',
    knownUserPatterns: {
      schemas: [{ name: 'verlating', confidence: 0.8 }],
      modes: [{ name: 'kwetsbaar_kind', confidence: 0.7 }],
      triggers: ['werkstress'],
    },
  };
}

// ─── TEST SUITE ────────────────────────────────────────────────────

describe('Server Robustness: Slim LIVE_MESSAGE Payloads', () => {

  // ═══ ZOD VALIDATION ═══

  describe('Zod validation accepts slim payloads', () => {

    it('R1: Minimal payload (no optional fields) passes Zod validation', () => {
      const input = buildMinimalLivePayload();
      const result = chatInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('R2: Slim payload with only knownUserPatterns passes Zod', () => {
      const input = buildSlimLiveWithPatterns();
      const result = chatInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.knownUserPatterns).toBeDefined();
        expect(result.data.knownUserPatterns!.schemas[0].name).toBe('verlating');
      }
    });

    it('R3: Slim payload with single module context passes Zod', () => {
      const input = buildSlimLiveWithSingleModule();
      const result = chatInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stoaContext).toContain('STOA SESSION ACTIVE');
      }
    });

    it('R4: Slim payload with multiple module contexts passes Zod', () => {
      const input = buildSlimLiveWithMultipleModules();
      const result = chatInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.projectionContext).toBeDefined();
        expect(result.data.schemaModeContext).toBeDefined();
        expect(result.data.actContext).toBeDefined();
      }
    });

    it('R5: Zod does NOT inject defaults for omitted optional fields', () => {
      const input = buildMinimalLivePayload();
      const result = chatInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        // These should be undefined (not null, not empty string)
        expect(result.data.stoaContext).toBeUndefined();
        expect(result.data.projectionContext).toBeUndefined();
        expect(result.data.schemaModeContext).toBeUndefined();
        expect(result.data.actContext).toBeUndefined();
        expect(result.data.cgtContext).toBeUndefined();
        expect(result.data.dgtContext).toBeUndefined();
        expect(result.data.mbtContext).toBeUndefined();
        expect(result.data.interventionContinuity).toBeUndefined();
        expect(result.data.vspInsightContext).toBeUndefined();
        expect(result.data.pastReferenceContext).toBeUndefined();
        expect(result.data.relapseClusterContext).toBeUndefined();
        expect(result.data.dangerChildContext).toBeUndefined();
        expect(result.data.loopDetected).toBeUndefined();
        expect(result.data.languageRecovery).toBeUndefined();
      }
    });
  });

  // ═══ PROMPT BUILDING ═══

  describe('buildSystemPrompt handles slim payloads without crash', () => {

    it('R6: Minimal payload produces a valid prompt (no crash)', () => {
      const input = buildMinimalLivePayload();
      const prompt = buildSystemPrompt(input as any);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(500);
    });

    it('R7: Minimal payload prompt contains required structural blocks', () => {
      const input = buildMinimalLivePayload();
      const prompt = buildSystemPrompt(input as any);
      // Must always contain these regardless of optional fields
      expect(prompt).toContain('MANDATORY BEHAVIORAL INSTRUCTIONS');
      expect(prompt).toContain('CURRENT STATE');
      expect(prompt).toContain('TestUser');
    });

    it('R8: Minimal payload prompt does NOT contain module blocks (all omitted)', () => {
      const input = buildMinimalLivePayload();
      const prompt = buildSystemPrompt(input as any);
      // None of these should appear when their context fields are omitted
      expect(prompt).not.toContain('STOA SESSION ACTIVE');
      expect(prompt).not.toContain('KIM RELAPSE CLUSTER MODULE ACTIVE');
      expect(prompt).not.toContain('KIM DANGER/CHILD CLUSTER MODULE ACTIVE');
      expect(prompt).not.toContain('VSP INSIGHT SYSTEM ACTIVE');
      // Note: "PAST SESSION CONTEXT" appears in anti-fabrication rules text, so we check for the active block marker
      expect(prompt).not.toContain('=== PAST SESSION CONTEXT (retrieved from memory) ===');
    });

    it('R9: Slim payload with stoaContext injects ONLY stoa block', () => {
      const input = buildSlimLiveWithSingleModule();
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toContain('STOA SESSION ACTIVE');
      // Other module blocks should NOT appear
      expect(prompt).not.toContain('KIM RELAPSE CLUSTER MODULE ACTIVE');
      expect(prompt).not.toContain('=== PAST SESSION CONTEXT (retrieved from memory) ===');
    });

    it('R10: Slim payload with multiple modules injects all active blocks', () => {
      const input = buildSlimLiveWithMultipleModules();
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toContain('Projection');
      expect(prompt).toContain('KNOWN USER PATTERNS');
    });

    it('R11: Slim payload with knownUserPatterns injects KNOWN USER PATTERNS block', () => {
      const input = buildSlimLiveWithPatterns();
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toContain('KNOWN USER PATTERNS');
      expect(prompt).toContain('verlating');
      expect(prompt).toContain('werkstress');
    });

    it('R12: Minimal payload does NOT contain KNOWN USER PATTERNS (field omitted)', () => {
      const input = buildMinimalLivePayload();
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).not.toContain('KNOWN USER PATTERNS');
    });
  });

  // ═══ FULL CHAIN: Zod → buildSystemPrompt (server receive simulation) ═══

  describe('Full chain: slim payload → Zod → buildSystemPrompt', () => {

    it('R13: Minimal slim payload survives full chain without crash', () => {
      const raw = buildMinimalLivePayload();
      const parseResult = chatInputSchema.safeParse(raw);
      expect(parseResult.success).toBe(true);
      if (!parseResult.success) return;
      const prompt = buildSystemPrompt(parseResult.data as any);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(500);
      expect(prompt).toContain('TestUser');
    });

    it('R14: Slim payload with patterns survives full chain', () => {
      const raw = buildSlimLiveWithPatterns();
      const parseResult = chatInputSchema.safeParse(raw);
      expect(parseResult.success).toBe(true);
      if (!parseResult.success) return;
      const prompt = buildSystemPrompt(parseResult.data as any);
      expect(prompt).toContain('KNOWN USER PATTERNS');
      expect(prompt).toContain('verlating');
    });

    it('R15: Slim payload with multiple modules survives full chain', () => {
      const raw = buildSlimLiveWithMultipleModules();
      const parseResult = chatInputSchema.safeParse(raw);
      expect(parseResult.success).toBe(true);
      if (!parseResult.success) return;
      const prompt = buildSystemPrompt(parseResult.data as any);
      expect(prompt).toContain('Projection');
      expect(prompt).toContain('KNOWN USER PATTERNS');
      expect(prompt).toContain('MANDATORY BEHAVIORAL INSTRUCTIONS');
    });
  });

  // ═══ EDGE CASES ═══

  describe('Edge cases: null vs undefined vs missing', () => {

    it('R16: Explicit null for optional fields passes Zod and produces valid prompt', () => {
      const input = {
        ...buildMinimalLivePayload(),
        stoaContext: null,
        projectionContext: null,
        schemaModeContext: null,
        actContext: null,
        knownUserPatterns: null,
        backpackAnalysis: null,
        loopDetected: null,
        languageRecovery: null,
      };
      const parseResult = chatInputSchema.safeParse(input);
      expect(parseResult.success).toBe(true);
      if (!parseResult.success) return;
      const prompt = buildSystemPrompt(parseResult.data as any);
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(500);
    });

    it('R17: Mix of null and undefined optional fields works correctly', () => {
      const input = {
        ...buildMinimalLivePayload(),
        stoaContext: null,          // explicit null
        // projectionContext omitted (undefined)
        actContext: 'ACT: values',  // present
        knownUserPatterns: null,    // explicit null
      };
      const parseResult = chatInputSchema.safeParse(input);
      expect(parseResult.success).toBe(true);
      if (!parseResult.success) return;
      const prompt = buildSystemPrompt(parseResult.data as any);
      expect(prompt).toContain('ACT: values');
      expect(prompt).not.toContain('KNOWN USER PATTERNS');
    });
  });
});
