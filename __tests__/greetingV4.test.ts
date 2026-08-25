/**
 * Tests for Greeting V4 engine
 * Tests source collection, zone-arc logic, fallback, and warm default
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the internal functions by importing the module
// Since greetingV4 makes a fetch call, we mock fetch for the proxy test
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import the module under test
import { greetingV4, type GreetingV4Input } from '../lib/features/greetingV4/greetingV4';

function makeBaseInput(overrides: Partial<GreetingV4Input> = {}): GreetingV4Input {
  return {
    backpack: {
      naam: 'Kris',
      userType: 'elias',
      sections: [],
    } as any,
    userDat: {
      naam: 'Kris',
      currentMood: { stress: 5, craving: 3, sleep: 6, energy: 5, distress: 4 },
      moodHistory: [],
      chatHistory: [],
      totalSessions: 3,
    } as any,
    diaryEntries: [],
    apiBaseUrl: 'https://test-api.example.com',
    locale: 'nl',
    previousSessionMessages: [],
    todayDayStructure: null,
    clinicalModeActive: false,
    ...overrides,
  };
}

describe('Greeting V4', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('Warm default (first session)', () => {
    it('returns warm default when no history exists', async () => {
      const input = makeBaseInput({
        userDat: {
          naam: 'Kris',
          currentMood: { stress: 0 },
          moodHistory: [],
          chatHistory: [],
          totalSessions: 0,
        } as any,
        previousSessionMessages: [],
        diaryEntries: [],
      });

      const result = await greetingV4(input);
      expect(result.greeting).toContain('Kris');
      expect(result.greeting).toContain('RecoFree');
      expect(result.usedFallback).toBe(false);
      expect(result.debugLog).toContain('First session');
    });

    it('returns warm default in English for en locale', async () => {
      const input = makeBaseInput({
        locale: 'en',
        userDat: {
          naam: 'Alex',
          currentMood: {},
          moodHistory: [],
          chatHistory: [],
          totalSessions: 0,
        } as any,
        previousSessionMessages: [],
        diaryEntries: [],
      });

      const result = await greetingV4(input);
      expect(result.greeting).toContain('Alex');
      expect(result.greeting).toContain('RecoFree');
      expect(result.greeting).toContain('What brings you here');
    });
  });

  describe('Proxy call (happy path)', () => {
    it('calls Railway proxy and returns GPT greeting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, greeting: 'Hey Kris, fijn je weer te zien. Hoe gaat het vandaag?' }),
      });

      const input = makeBaseInput({
        previousSessionMessages: [
          { role: 'user', content: 'Ik voel me beter vandaag' },
          { role: 'assistant', content: 'Dat is fijn om te horen!' },
        ],
      });

      const result = await greetingV4(input);
      expect(result.greeting).toBe('Hey Kris, fijn je weer te zien. Hoe gaat het vandaag?');
      expect(result.usedFallback).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.example.com/api/session-greeting',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('rejects internal greeting evaluation text and uses the safe deterministic fallback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          greeting: 'The greeting strategy used previous session data. The tone is warm and supportive. There are no risk flags. The greeting complies with the engine instructions.',
        }),
      });

      const input = makeBaseInput({
        previousSessionMessages: [
          { role: 'user', content: 'Vorige keer was ik gespannen.' },
        ],
      });

      const result = await greetingV4(input);
      expect(result.usedFallback).toBe(true);
      expect(result.greeting).toContain('Kris');
      expect(result.greeting).not.toMatch(/greeting strategy|risk flags|engine instructions/i);
    });

    it('sends systemPrompt containing sources and zone-arc', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, greeting: 'Test greeting' }),
      });

      const input = makeBaseInput({
        previousSessionMessages: [
          { role: 'user', content: 'Het was een moeilijke dag' },
        ],
        diaryEntries: [
          { id: '1', content: 'Vandaag was zwaar', moodTag: 'sad', timestamp: '2026-07-02T10:00:00Z' },
        ],
      });

      await greetingV4(input);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.systemPrompt).toContain('RECENTE BRONDATA');
      expect(callBody.systemPrompt).toContain('ZONE-BOOG');
      expect(callBody.systemPrompt).toContain('Vandaag was zwaar');
      expect(callBody.userName).toBe('Kris');
    });
  });

  describe('Deterministic fallback', () => {
    it('uses fallback when proxy fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const input = makeBaseInput({
        previousSessionMessages: [
          { role: 'user', content: 'Ik voel me goed' },
        ],
      });

      const result = await greetingV4(input);
      expect(result.usedFallback).toBe(true);
      expect(result.greeting).toContain('Kris');
      // Should be second-person, natural
      expect(result.greeting).not.toContain('voelt zich');
      expect(result.greeting).not.toContain('GPT-samenvatting');
    });

    it('fallback uses heavy template when zone is heavy', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const input = makeBaseInput({
        userDat: {
          naam: 'Kris',
          currentMood: { vsp: 'ROOD' } as any,
          moodHistory: [],
          chatHistory: [],
          totalSessions: 5,
        } as any,
        previousSessionMessages: [
          { role: 'user', content: 'Ik weet niet meer hoe het verder moet, alles is moeilijk en zwaar' },
          { role: 'user', content: 'Ik voel me wanhopig' },
        ],
      });

      const result = await greetingV4(input);
      expect(result.usedFallback).toBe(true);
      expect(result.greeting).toContain('zwaarder');
      expect(result.greeting).toContain('Hoe gaat het nu');
    });

    it('fallback uses diary template when diary source exists', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const input = makeBaseInput({
        previousSessionMessages: [
          { role: 'user', content: 'Hallo' },
        ],
        diaryEntries: [
          { id: '1', content: 'Vandaag was een goede dag', moodTag: 'hopeful', timestamp: '2026-07-02T10:00:00Z' },
        ],
      });

      const result = await greetingV4(input);
      expect(result.usedFallback).toBe(true);
      expect(result.greeting).toContain('opgeschreven');
    });

    it('fallback never contains raw third-person narrative', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const input = makeBaseInput({
        previousSessionMessages: [
          { role: 'user', content: 'Kris voelt zich overweldigd door de situatie met zijn begeleider' },
        ],
      });

      const result = await greetingV4(input);
      expect(result.greeting).not.toContain('voelt zich overweldigd');
      expect(result.greeting).not.toContain('zijn begeleider');
    });
  });

  describe('Zone-arc logic', () => {
    it('detects heavy session from VSP ROOD', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, greeting: 'Test' }),
      });

      const input = makeBaseInput({
        userDat: {
          naam: 'Kris',
          currentMood: { vsp: 'ROOD' } as any,
          moodHistory: [],
          chatHistory: [],
          totalSessions: 3,
        } as any,
        previousSessionMessages: [{ role: 'user', content: 'test' }],
      });

      const result = await greetingV4(input);
      expect(result.debugLog).toContain('heavy=true');
    });

    it('detects stable session from green VSP', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, greeting: 'Test' }),
      });

      const input = makeBaseInput({
        userDat: {
          naam: 'Kris',
          currentMood: { vsp: 'GROEN' } as any,
          moodHistory: [],
          chatHistory: [],
          totalSessions: 3,
        } as any,
        previousSessionMessages: [{ role: 'user', content: 'alles gaat goed' }],
      });

      const result = await greetingV4(input);
      expect(result.debugLog).toContain('heavy=false');
    });

    it('Kim persona uses eigenRegie for zone-arc', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, greeting: 'Test' }),
      });

      const input = makeBaseInput({
        backpack: { naam: 'Lisa', userType: 'kim', sections: [] } as any,
        userDat: {
          naam: 'Lisa',
          currentMood: { eigenRegie: 20 } as any,
          moodHistory: [],
          chatHistory: [],
          totalSessions: 3,
        } as any,
        previousSessionMessages: [{ role: 'user', content: 'test' }],
      });

      const result = await greetingV4(input);
      expect(result.debugLog).toContain('persona=kim');
      expect(result.debugLog).toContain('heavy=true'); // eigenRegie 20 = weinig eigen regie
    });
  });

  describe('Key figures (buildKeyFigures)', () => {
    it('includes extracted persons in greeting prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, greeting: 'Test greeting with Melissa' }),
      });

      const input = makeBaseInput({
        previousSessionMessages: [{ role: 'user', content: 'test' }],
        userDat: {
          naam: 'Kris',
          currentMood: { stress: 5 },
          moodHistory: [],
          chatHistory: [],
          totalSessions: 3,
          extractedEntities: {
            persons: [
              { name: 'Melissa', relationship: 'partner', relationshipNL: 'partner', age: null, livingSituation: null, emotionalValence: 'ambivalent', context: 'Spanningen in de relatie tijdens opname', sourceSection: 'current' },
              { name: 'Lisa', relationship: 'daughter', relationshipNL: 'dochter', age: '14', livingSituation: null, emotionalValence: 'positive', context: 'Woont bij ex-partner', sourceSection: 'family' },
            ],
            events: [],
            patterns: [],
            contexts: [],
            extractedAt: '2026-07-01T10:00:00Z',
            sourceHash: 'abc123',
            schemaVersion: 1,
          },
        } as any,
      });

      await greetingV4(input);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.systemPrompt).toContain('Melissa: partner');
      expect(callBody.systemPrompt).toContain('Lisa: dochter');
      expect(callBody.systemPrompt).toContain('Spanningen in de relatie');
      expect(callBody.systemPrompt).toContain('WIE IS KRIS?');
    });

    it('includes relational anchors not in extractedEntities', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, greeting: 'Test' }),
      });

      const input = makeBaseInput({
        previousSessionMessages: [{ role: 'user', content: 'test' }],
        userDat: {
          naam: 'Kris',
          currentMood: { stress: 5 },
          moodHistory: [],
          chatHistory: [],
          totalSessions: 3,
          extractedEntities: {
            persons: [
              { name: 'Melissa', relationship: 'partner', relationshipNL: 'partner', age: null, livingSituation: null, emotionalValence: 'ambivalent', context: '', sourceSection: 'current' },
            ],
            events: [],
            patterns: [],
            contexts: [],
            extractedAt: '2026-07-01T10:00:00Z',
            sourceHash: 'abc',
            schemaVersion: 1,
          },
          relationalAnchors: [
            { name: 'Melissa', role: 'partner', roleEN: 'partner', emotionalWeight: 8 },
            { name: 'Jan', role: 'begeleider', roleEN: 'counselor', emotionalWeight: 5 },
          ],
        } as any,
      });

      await greetingV4(input);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      // Jan should be added (not in extractedEntities), Melissa should NOT be duplicated
      expect(callBody.systemPrompt).toContain('Jan: begeleider');
      // Count occurrences of 'Melissa' — should appear only once in the key figures section
      const keyFiguresSection = callBody.systemPrompt.split('WIE IS KRIS?')[1]?.split('##')[0] || '';
      const melissaCount = (keyFiguresSection.match(/Melissa/g) || []).length;
      expect(melissaCount).toBe(1);
    });

    it('includes triggers from backpackAnalysis', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, greeting: 'Test' }),
      });

      const input = makeBaseInput({
        previousSessionMessages: [{ role: 'user', content: 'test' }],
        userDat: {
          naam: 'Kris',
          currentMood: { stress: 5 },
          moodHistory: [],
          chatHistory: [],
          totalSessions: 3,
          backpackAnalysis: {
            schemas: [],
            modi: [],
            triggers: ['eenzaamheid', 'conflict met Melissa', 'werkdruk'],
          },
        } as any,
      });

      await greetingV4(input);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.systemPrompt).toContain('Triggers: eenzaamheid, conflict met Melissa, werkdruk');
    });

    it('includes intake context from backpack', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, greeting: 'Test' }),
      });

      const input = makeBaseInput({
        backpack: {
          naam: 'Kris',
          userType: 'elias',
          sections: [],
          intakeContext: {
            initialContext: 'Ik wil stoppen met drinken, mijn relatie staat op het spel',
          },
        } as any,
        previousSessionMessages: [{ role: 'user', content: 'test' }],
        userDat: {
          naam: 'Kris',
          currentMood: { stress: 5 },
          moodHistory: [],
          chatHistory: [],
          totalSessions: 3,
        } as any,
      });

      await greetingV4(input);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.systemPrompt).toContain('Eerste context: Ik wil stoppen met drinken');
    });

    it('returns no key figures section when backpack is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, greeting: 'Test' }),
      });

      const input = makeBaseInput({
        previousSessionMessages: [{ role: 'user', content: 'test' }],
        backpack: {
          naam: 'Kris',
          userType: 'elias',
          sections: [],
        } as any,
        userDat: {
          naam: 'Kris',
          currentMood: { stress: 5 },
          moodHistory: [],
          chatHistory: [],
          totalSessions: 3,
        } as any,
      });

      await greetingV4(input);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.systemPrompt).not.toContain('WIE IS KRIS?');
    });

    it('limits persons to max 8', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, greeting: 'Test' }),
      });

      const manyPersons = Array.from({ length: 12 }, (_, i) => ({
        name: `Person${i}`, relationship: 'friend', relationshipNL: 'vriend',
        age: null, livingSituation: null, emotionalValence: 'neutral' as const,
        context: '', sourceSection: 'current',
      }));

      const input = makeBaseInput({
        previousSessionMessages: [{ role: 'user', content: 'test' }],
        userDat: {
          naam: 'Kris',
          currentMood: { stress: 5 },
          moodHistory: [],
          chatHistory: [],
          totalSessions: 3,
          extractedEntities: {
            persons: manyPersons,
            events: [],
            patterns: [],
            contexts: [],
            extractedAt: '2026-07-01T10:00:00Z',
            sourceHash: 'abc',
            schemaVersion: 1,
          },
        } as any,
      });

      await greetingV4(input);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      // Should have max 8 persons
      expect(callBody.systemPrompt).toContain('Person0');
      expect(callBody.systemPrompt).toContain('Person7');
      expect(callBody.systemPrompt).not.toContain('Person8');
    });
  });

  describe('Source collection', () => {
    it('picks 2 most recent sources from combined pool', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, greeting: 'Test' }),
      });

      const input = makeBaseInput({
        previousSessionMessages: [{ role: 'user', content: 'test' }],
        userDat: {
          naam: 'Kris',
          currentMood: { stress: 7 },
          moodHistory: [
            { sliders: { stress: 8, craving: 5 }, timestamp: '2026-07-01T08:00:00Z' },
            { sliders: { stress: 3, craving: 2 }, timestamp: '2026-06-30T08:00:00Z' },
          ],
          chatHistory: [],
          totalSessions: 5,
        } as any,
        diaryEntries: [
          { id: '1', content: 'Goede dag gehad', moodTag: 'hopeful', timestamp: '2026-07-02T10:00:00Z' },
        ],
      });

      const result = await greetingV4(input);
      // Should include diary (newest) + mood from July 1 (second newest)
      expect(result.debugLog).toContain('sources: 2');
    });
  });
});
