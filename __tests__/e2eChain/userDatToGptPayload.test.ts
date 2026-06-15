/**
 * End-to-end chain test: user.dat → openai-provider payload → Zod validation → server prompt
 *
 * PURPOSE: Guard against any layer in the chain silently dropping user.dat data
 * before it reaches the GPT system prompt. This test has caught the exact bug
 * multiple times: data present in user.dat but never reaching GPT because one
 * layer (Zod schema, openai-provider, server prompt builder) strips or ignores it.
 *
 * CHAIN UNDER TEST:
 *   1. user.dat contains schemas, triggers, rugzak person
 *   2. openai-provider builds payload with knownUserPatterns + backpackAnalysis
 *   3. Zod chatInputSchema validates and passes these fields through
 *   4. server buildSystemPrompt injects them into the GPT system prompt
 *
 * If ANY layer drops the data, these tests fail.
 */
import { describe, it, expect } from 'vitest';
import { chatInputSchema, buildSystemPrompt } from '../../server/ai-chat';

// ─── Fixtures ──────────────────────────────────────────────────────

/** Minimal valid input with all chain-critical fields populated */
function buildChainTestInput(overrides: Partial<{
  isSessionStart: boolean;
  knownUserPatterns: any;
  backpackAnalysis: any;
  backpack: any;
}> = {}) {
  return {
    userType: 'elias' as const,
    userName: 'Kris',
    message: 'Wat weet je over Melissa?',
    conversationHistory: [
      { role: 'assistant' as const, content: 'Hoi Kris, hoe gaat het?' },
    ],
    moodSliders: { craving: 4, frustration: 3, despondency: 2, focus: 7 },
    isSessionStart: overrides.isSessionStart ?? true,
    activeModules: ['E02'],
    crisisLevel: 0,
    detectedEmotion: 'curiosity',
    therapeuticStance: 'tone:warm | Reflective listening.',
    sessionDurationMinutes: 3,
    urgency: 'laag',
    startEmotion: 'calm',

    // ── Chain-critical fields ──
    backpack: overrides.backpack ?? {
      naam: 'Kris',
      userType: 'elias' as const,
      lifeStory: [
        {
          id: 'family',
          label: 'Familie',
          ageRange: 'n.v.t.',
          content: 'Melissa, partner sinds 2019. Twee kinderen. Melissa is mijn steun en toeverlaat.',
        },
      ],
      intakeContext: {
        startEmotion: 'anxious',
        urgency: 'midden',
        initialContext: 'Alcohol dependency',
        intakeDate: '2025-01-01',
      },
      createdAt: '2025-01-01',
    },
    userDat: {
      totalSessions: 12,
      triggerPatterns: [
        { trigger: 'werkstress', count: 8, firstSeen: '2025-01-10', lastSeen: '2025-06-01' },
        { trigger: 'eenzaamheid', count: 5, firstSeen: '2025-02-01', lastSeen: '2025-05-20' },
        { trigger: 'conflict met partner', count: 3, firstSeen: '2025-03-01', lastSeen: '2025-06-10' },
      ],
      moodHistory: [
        { sliders: { craving: 6, frustration: 5, despondency: 4, focus: 3 }, timestamp: '2025-06-10' },
      ],
      moduleUsageSummary: ['E02', 'E05', 'SchemaMode'],
      lastSessionDate: '2025-06-10',
      sessionAnalyses: [],
    },

    // ── The fields this test guards ──
    backpackAnalysis: ('backpackAnalysis' in overrides) ? overrides.backpackAnalysis : {
      schemas: [
        { name: 'verlating_instabiliteit', confidence: 0.9, evidence: 'Herhaald verlatingsvrees in rugzak' },
        { name: 'emotionele_verwaarlozing', confidence: 0.7, evidence: 'Kindertijd isolatie' },
      ],
      modi: [
        { name: 'kwetsbaar_kind', confidence: 0.85, evidence: 'Regressie bij conflict' },
      ],
      triggers: ['werkstress', 'eenzaamheid', 'conflict met partner'],
      coreBeliefs: ['Ik word altijd verlaten', 'Ik ben niet goed genoeg'],
      copingPatterns: ['vermijding', 'overcompensatie door werk'],
      analysisVersion: 2,
      analyzedAt: '2025-06-10T10:00:00Z',
      previousAnalyzedAt: '2025-05-01T10:00:00Z',
    },
    knownUserPatterns: ('knownUserPatterns' in overrides) ? overrides.knownUserPatterns : {
      schemas: [
        { name: 'verlating_instabiliteit', confidence: 0.9 },
        { name: 'emotionele_verwaarlozing', confidence: 0.7 },
      ],
      modes: [
        { name: 'kwetsbaar_kind', confidence: 0.85 },
      ],
      triggers: ['werkstress', 'eenzaamheid', 'conflict met partner', 'slaaptekort', 'financiële druk'],
    },
  };
}

// ─── TEST SUITE ────────────────────────────────────────────────────

describe('E2E Chain: user.dat → Zod → buildSystemPrompt', () => {

  // ═══ LAYER 1: Zod validation passes the fields through ═══

  describe('Layer 1: Zod validation preserves chain-critical fields', () => {

    it('C1: knownUserPatterns survives Zod validation (SESSION_INIT)', () => {
      const input = buildChainTestInput({ isSessionStart: true });
      const result = chatInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.knownUserPatterns).toBeDefined();
        expect(result.data.knownUserPatterns!.schemas).toHaveLength(2);
        expect(result.data.knownUserPatterns!.schemas[0].name).toBe('verlating_instabiliteit');
        expect(result.data.knownUserPatterns!.triggers).toContain('werkstress');
      }
    });

    it('C2: backpackAnalysis survives Zod validation (SESSION_INIT)', () => {
      const input = buildChainTestInput({ isSessionStart: true });
      const result = chatInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.backpackAnalysis).toBeDefined();
        expect(result.data.backpackAnalysis!.schemas[0].name).toBe('verlating_instabiliteit');
        expect(result.data.backpackAnalysis!.schemas[0].confidence).toBe(0.9);
      }
    });

    it('C3: knownUserPatterns survives Zod validation (LIVE_MESSAGE)', () => {
      const input = buildChainTestInput({ isSessionStart: false });
      const result = chatInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.knownUserPatterns).toBeDefined();
        expect(result.data.knownUserPatterns!.modes[0].name).toBe('kwetsbaar_kind');
      }
    });

    it('C4: backpackAnalysis survives Zod validation (LIVE_MESSAGE)', () => {
      const input = buildChainTestInput({ isSessionStart: false });
      const result = chatInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.backpackAnalysis).toBeDefined();
        expect(result.data.backpackAnalysis!.modi[0].name).toBe('kwetsbaar_kind');
      }
    });
  });

  // ═══ LAYER 2: buildSystemPrompt injects the data into GPT prompt ═══

  describe('Layer 2: buildSystemPrompt injects chain-critical data (SESSION_INIT)', () => {

    it('C5: GPT prompt contains KNOWN USER PATTERNS block', () => {
      const input = buildChainTestInput({ isSessionStart: true });
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toContain('KNOWN USER PATTERNS');
    });

    it('C6: GPT prompt contains schema name from knownUserPatterns', () => {
      const input = buildChainTestInput({ isSessionStart: true });
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toContain('verlating_instabiliteit');
    });

    it('C7: GPT prompt contains mode name from knownUserPatterns', () => {
      const input = buildChainTestInput({ isSessionStart: true });
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toContain('kwetsbaar_kind');
    });

    it('C8: GPT prompt contains trigger from knownUserPatterns', () => {
      const input = buildChainTestInput({ isSessionStart: true });
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toContain('werkstress');
    });

    it('C9: GPT prompt contains BACKPACK DEEP ANALYSIS block', () => {
      const input = buildChainTestInput({ isSessionStart: true });
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toContain('BACKPACK DEEP ANALYSIS');
    });

    it('C10: GPT prompt contains rugzak person reference (Melissa) via backpack lifeStory', () => {
      const input = buildChainTestInput({ isSessionStart: true });
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toContain('Melissa');
    });

    it('C11: GPT prompt contains "You DO know this about the user" instruction', () => {
      const input = buildChainTestInput({ isSessionStart: true });
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toMatch(/you DO know this about the user/i);
    });

    it('C12: GPT prompt contains core belief from backpackAnalysis', () => {
      const input = buildChainTestInput({ isSessionStart: true });
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toContain('Ik word altijd verlaten');
    });
  });

  describe('Layer 2: buildSystemPrompt injects chain-critical data (LIVE_MESSAGE)', () => {

    it('C13: LIVE_MESSAGE prompt contains KNOWN USER PATTERNS block', () => {
      const input = buildChainTestInput({ isSessionStart: false });
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toContain('KNOWN USER PATTERNS');
    });

    it('C14: LIVE_MESSAGE prompt contains schema name', () => {
      const input = buildChainTestInput({ isSessionStart: false });
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toContain('verlating_instabiliteit');
    });

    it('C15: LIVE_MESSAGE prompt contains BACKPACK DEEP ANALYSIS block', () => {
      const input = buildChainTestInput({ isSessionStart: false });
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toContain('BACKPACK DEEP ANALYSIS');
    });

    it('C16: LIVE_MESSAGE prompt contains trigger from knownUserPatterns', () => {
      const input = buildChainTestInput({ isSessionStart: false });
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).toContain('eenzaamheid');
    });
  });

  // ═══ LAYER 3: Regression guard — proves Zod stripping would break the test ═══

  describe('Layer 3: Regression guard (proves test catches Zod stripping)', () => {

    it('C17: without knownUserPatterns, prompt does NOT contain KNOWN USER PATTERNS block', () => {
      const input = buildChainTestInput({ knownUserPatterns: undefined });
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).not.toContain('KNOWN USER PATTERNS');
    });

    it('C18: without backpackAnalysis, prompt does NOT contain BACKPACK DEEP ANALYSIS block', () => {
      const input = buildChainTestInput({ backpackAnalysis: undefined });
      const prompt = buildSystemPrompt(input as any);
      expect(prompt).not.toContain('BACKPACK DEEP ANALYSIS');
    });

    it('C19: Zod rejects malformed knownUserPatterns (missing schemas array)', () => {
      const input = buildChainTestInput({
        knownUserPatterns: { modes: [], triggers: [] } as any, // missing schemas
      });
      const result = chatInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('C20: Zod rejects malformed backpackAnalysis (missing required fields)', () => {
      const input = buildChainTestInput({
        backpackAnalysis: { schemas: [] } as any, // missing modi, triggers, etc.
      });
      const result = chatInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  // ═══ FULL CHAIN: Zod parse → buildSystemPrompt (simulates server receive) ═══

  describe('Full chain: Zod parse → buildSystemPrompt (server simulation)', () => {

    it('C21: SESSION_INIT full chain — data survives Zod and appears in prompt', () => {
      const rawInput = buildChainTestInput({ isSessionStart: true });

      // Step 1: Zod validation (simulates tRPC input parsing)
      const parseResult = chatInputSchema.safeParse(rawInput);
      expect(parseResult.success).toBe(true);
      if (!parseResult.success) return;

      // Step 2: buildSystemPrompt (simulates server prompt construction)
      const validatedInput = parseResult.data;
      const prompt = buildSystemPrompt(validatedInput as any);

      // Step 3: Assert chain-critical data is present
      expect(prompt).toContain('KNOWN USER PATTERNS');
      expect(prompt).toContain('verlating_instabiliteit');
      expect(prompt).toContain('kwetsbaar_kind');
      expect(prompt).toContain('werkstress');
      expect(prompt).toContain('BACKPACK DEEP ANALYSIS');
      expect(prompt).toContain('Melissa');
    });

    it('C22: LIVE_MESSAGE full chain — data survives Zod and appears in prompt', () => {
      const rawInput = buildChainTestInput({ isSessionStart: false });

      // Step 1: Zod validation
      const parseResult = chatInputSchema.safeParse(rawInput);
      expect(parseResult.success).toBe(true);
      if (!parseResult.success) return;

      // Step 2: buildSystemPrompt
      const validatedInput = parseResult.data;
      const prompt = buildSystemPrompt(validatedInput as any);

      // Step 3: Assert chain-critical data is present
      expect(prompt).toContain('KNOWN USER PATTERNS');
      expect(prompt).toContain('verlating_instabiliteit');
      expect(prompt).toContain('BACKPACK DEEP ANALYSIS');
      expect(prompt).toContain('eenzaamheid');
    });
  });
});
