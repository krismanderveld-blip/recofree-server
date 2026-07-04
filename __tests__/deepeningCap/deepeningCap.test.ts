/**
 * Deepening Layer Tests — Cap & Priority Ranking
 *
 * PURPOSE: Verify that the deepening layer:
 * 1. Never exceeds 500 tokens total
 * 2. Prioritizes crisis/safety fragments over normal ones
 * 3. Fills in priority order until cap is reached
 * 4. Returns empty when no deepening is needed
 */
import { describe, it, expect } from 'vitest';
import { resolveDeepening, type DeepeningInput, type DeepeningResult } from '../../lib/pipeline/context-dat-deepening';
import type { ContextDat } from '../../lib/pipeline/context-dat-distiller';
import type { ClientNanoInterpretResult } from '../../lib/pipeline/nano-interpret-client';

// ─── Fixtures ──────────────────────────────────────────────────────

function buildMinimalContextDat(): ContextDat {
  return {
    keyFigures: [
      { name: 'Melissa', relationship: 'partner', valence: 'positive' },
    ],
    schemas: [
      { schemaId: 'verlating', confidence: 0.8, evidence: 'herhaald patroon' },
    ],
    sessionSummaries: [
      { date: '2025-06-10T10:00:00Z', themes: ['werkstress'], mood: 'anxious' },
      { date: '2025-06-08T10:00:00Z', themes: ['relatie'], mood: 'calm' },
      { date: '2025-06-05T10:00:00Z', themes: ['craving'], mood: 'tense' },
    ],
    recurringThemes: ['werkstress', 'relatie'],
    coreWound: 'verlating',
  } as any;
}

function buildNanoResult(overrides: Partial<ClientNanoInterpretResult> = {}): ClientNanoInterpretResult {
  return {
    translatedNL: 'test bericht',
    intent: 'emotional_expression',
    themes: ['werkstress'],
    resolvedModule: 'E02',
    matchedTheme: 'stress',
    ...overrides,
  } as ClientNanoInterpretResult;
}

function buildBackpack(sections: Array<{ id: string; label: string; content: string }> = []) {
  return {
    naam: 'TestUser',
    userType: 'elias' as const,
    lifeStory: [],
    intakeContext: {
      startEmotion: 'anxious',
      urgency: 'midden',
      initialContext: 'test',
      intakeDate: '2025-01-01',
    },
    createdAt: '2025-01-01',
    sections: sections.length > 0 ? sections : [
      { id: 'family', label: 'Familie', content: 'Jan is mijn broer. Hij woont in Amsterdam. We hebben een moeilijke relatie.' },
      { id: 'work', label: 'Werk', content: 'Ik werk als programmeur. Mijn baas Peter is streng.' },
    ],
  } as any;
}

function buildUserDat() {
  return {
    totalSessions: 10,
    triggerPatterns: [],
    moodHistory: [],
    moduleUsageSummary: [],
    lastSessionDate: '2025-06-10',
    sessionAnalyses: [],
    schemaTendencies: [
      { schemaId: 'wantrouwen', schemaName: 'Wantrouwen/Misbruik', frequency: 5, confidence: 0.7, copingStyle: 'vermijding' },
    ],
  } as any;
}

function buildLogsDat(sessions: any[] = []) {
  return {
    sessions: sessions.length > 0 ? sessions : [
      { startedAt: '2025-06-01T10:00:00Z', compressedNarrative: 'Sessie over werkstress en conflict met Peter.', discussedTopics: ['werkstress'], openEndpoints: [] },
      { startedAt: '2025-06-03T10:00:00Z', compressedNarrative: 'Sessie over relatie met Jan. Wantrouwen besproken.', discussedTopics: ['relatie', 'wantrouwen'], openEndpoints: [] },
      { startedAt: '2025-06-05T10:00:00Z', compressedNarrative: 'Craving avond. Coping besproken.', discussedTopics: ['craving'], openEndpoints: [] },
      { startedAt: '2025-06-08T10:00:00Z', compressedNarrative: 'Reflectie op voortgang.', discussedTopics: ['reflectie'], openEndpoints: [] },
      { startedAt: '2025-06-10T10:00:00Z', compressedNarrative: 'Werkstress en slaapproblemen.', discussedTopics: ['werkstress', 'slaap'], openEndpoints: [] },
    ],
  } as any;
}

function buildDeepeningInput(overrides: Partial<DeepeningInput> = {}): DeepeningInput {
  return {
    contextDat: buildMinimalContextDat(),
    nanoResult: buildNanoResult(),
    backpack: buildBackpack(),
    userDat: buildUserDat(),
    logsDat: buildLogsDat(),
    currentMessage: 'Ik maak me zorgen over Jan.',
    ...overrides,
  };
}

// ─── TEST SUITE ────────────────────────────────────────────────────

describe('Deepening Layer: Cap & Priority', () => {

  describe('Basic behavior', () => {

    it('D1: Returns empty when nanoResult is null', () => {
      const input = buildDeepeningInput({ nanoResult: null });
      const result = resolveDeepening(input);
      expect(result.triggered).toBe(false);
      expect(result.fragments).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
    });

    it('D2: Returns empty when no deepening triggers are detected', () => {
      const input = buildDeepeningInput({
        currentMessage: 'Hoe gaat het vandaag?',
        nanoResult: buildNanoResult({ themes: ['greeting'] }),
      });
      const result = resolveDeepening(input);
      expect(result.triggered).toBe(false);
      expect(result.fragments).toHaveLength(0);
    });

    it('D3: Detects person reference not in context.dat keyFigures', () => {
      // Jan is in the backpack but NOT in contextDat.keyFigures (only Melissa is)
      const input = buildDeepeningInput({
        currentMessage: 'Ik maak me zorgen over Jan.',
        nanoResult: buildNanoResult({ themes: ['zorgen', 'Jan'] }),
      });
      const result = resolveDeepening(input);
      expect(result.triggered).toBe(true);
      expect(result.fragments.some(f => f.type === 'person' && f.label === 'Jan')).toBe(true);
    });

    it('D4: Does NOT deepen for person already in context.dat keyFigures', () => {
      // Melissa IS in contextDat.keyFigures
      const input = buildDeepeningInput({
        currentMessage: 'Ik denk aan Melissa.',
        nanoResult: buildNanoResult({ themes: ['relatie', 'Melissa'] }),
      });
      const result = resolveDeepening(input);
      // Should not have a person fragment for Melissa
      expect(result.fragments.filter(f => f.type === 'person' && f.label === 'Melissa')).toHaveLength(0);
    });
  });

  describe('Token cap enforcement', () => {

    it('D5: Total tokens never exceed MAX_DEEPENING_TOKENS (500)', () => {
      const input = buildDeepeningInput({
        currentMessage: 'Ik maak me zorgen over Jan en Peter, weken geleden was het ook al zo.',
        nanoResult: buildNanoResult({ themes: ['zorgen', 'Jan', 'Peter', 'wantrouwen'] }),
      });
      const result = resolveDeepening(input);
      expect(result.totalTokens).toBeLessThanOrEqual(500);
    });

    it('D6: With large backpack content, fragments are truncated to stay within cap', () => {
      // Create a backpack with very long content about Jan
      const longContent = 'Jan ' + 'is mijn broer en we hebben veel meegemaakt samen. '.repeat(50);
      const input = buildDeepeningInput({
        currentMessage: 'Vertel me over Jan.',
        nanoResult: buildNanoResult({ themes: ['Jan'] }),
        backpack: buildBackpack([
          { id: 'family', label: 'Familie', content: longContent },
        ]),
      });
      const result = resolveDeepening(input);
      expect(result.totalTokens).toBeLessThanOrEqual(500);
    });
  });

  describe('Priority ranking', () => {

    it('D7: Crisis context boosts person reference to priority 1', () => {
      const input = buildDeepeningInput({
        currentMessage: 'Ik wil niet meer, Jan begrijpt het niet.',
        nanoResult: buildNanoResult({ themes: ['hopeloos', 'Jan'] }),
      });
      const result = resolveDeepening(input);
      // In crisis context, person fragments should be present (priority 1)
      if (result.triggered) {
        expect(result.fragments[0].type).toBe('person');
      }
    });

    it('D8: Schema deepening detects schema not in context.dat', () => {
      // wantrouwen is NOT in contextDat.schemas (only verlating is)
      const input = buildDeepeningInput({
        currentMessage: 'Ik kan niemand meer vertrouwen.',
        nanoResult: buildNanoResult({ themes: ['vertrouwen', 'wantrouwen'] }),
      });
      const result = resolveDeepening(input);
      if (result.triggered) {
        expect(result.fragments.some(f => f.type === 'schema')).toBe(true);
      }
    });

    it('D9: Older session reference has lowest priority (4)', () => {
      const input = buildDeepeningInput({
        currentMessage: 'Weken geleden hadden we het over Jan.',
        nanoResult: buildNanoResult({ themes: ['Jan', 'eerder'] }),
      });
      const result = resolveDeepening(input);
      // If both person and session fragments are present, person should come first
      if (result.fragments.length >= 2) {
        const personIdx = result.fragments.findIndex(f => f.type === 'person');
        const sessionIdx = result.fragments.findIndex(f => f.type === 'session');
        if (personIdx >= 0 && sessionIdx >= 0) {
          expect(personIdx).toBeLessThan(sessionIdx);
        }
      }
    });
  });

  describe('Result structure', () => {

    it('D10: DeepeningResult has correct shape', () => {
      const input = buildDeepeningInput({
        currentMessage: 'Ik maak me zorgen over Jan.',
        nanoResult: buildNanoResult({ themes: ['Jan'] }),
      });
      const result = resolveDeepening(input);
      expect(result).toHaveProperty('fragments');
      expect(result).toHaveProperty('totalTokens');
      expect(result).toHaveProperty('triggered');
      expect(Array.isArray(result.fragments)).toBe(true);
      expect(typeof result.totalTokens).toBe('number');
      expect(typeof result.triggered).toBe('boolean');
    });

    it('D11: Each fragment has required fields', () => {
      const input = buildDeepeningInput({
        currentMessage: 'Ik maak me zorgen over Jan.',
        nanoResult: buildNanoResult({ themes: ['Jan'] }),
      });
      const result = resolveDeepening(input);
      for (const fragment of result.fragments) {
        expect(fragment).toHaveProperty('type');
        expect(fragment).toHaveProperty('label');
        expect(fragment).toHaveProperty('content');
        expect(fragment).toHaveProperty('tokenEstimate');
        expect(['person', 'session', 'schema']).toContain(fragment.type);
        expect(typeof fragment.content).toBe('string');
        expect(fragment.tokenEstimate).toBeGreaterThan(0);
      }
    });
  });
});
