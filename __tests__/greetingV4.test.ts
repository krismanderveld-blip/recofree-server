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
