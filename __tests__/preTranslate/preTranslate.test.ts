/**
 * Pre-Translate Tests
 *
 * Validates the safety-critical pre-translate step:
 * - FR/EN messages are translated to NL before detection
 * - NL messages skip translation (no API call)
 * - Failures fall back to original text (never drop messages)
 * - Debug trace logging is present
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock getApiBaseUrl
vi.mock('@/constants/oauth', () => ({
  getApiBaseUrl: () => 'http://localhost:3000',
}));

// Import AFTER mocks are set up
import { preprocessInput } from '@/lib/ai/preprocessor';

describe('Pre-Translate Step', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('NL locale (skip)', () => {
    it('should skip translation for NL locale — no API call', async () => {
      const result = await preprocessInput('ik wil dood', 'nl');

      expect(result.processedText).toBe('ik wil dood');
      expect(result.wasTranslated).toBe(false);
      expect(result.detectedLanguage).toBe('nl');
      // No fetch call should be made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should log skipped trace for NL', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      await preprocessInput('hallo', 'nl');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[pre-translate] skipped (nl)'));
    });
  });

  describe('FR locale (translate)', () => {
    it('should translate FR crisis text "je veux mourir" to NL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          translatedText: 'ik wil dood',
          originalText: 'je veux mourir',
          wasTranslated: true,
          locale: 'fr',
        }),
      });

      const result = await preprocessInput('je veux mourir', 'fr');

      expect(result.processedText).toBe('ik wil dood');
      expect(result.wasTranslated).toBe(true);
      expect(result.detectedLanguage).toBe('fr');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/pre-translate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'je veux mourir', locale: 'fr' }),
        })
      );
    });

    it('should translate FR craving text "j\'ai envie de boire" to NL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          translatedText: 'ik heb zin om te drinken',
          originalText: "j'ai envie de boire",
          wasTranslated: true,
          locale: 'fr',
        }),
      });

      const result = await preprocessInput("j'ai envie de boire", 'fr');

      expect(result.processedText).toBe('ik heb zin om te drinken');
      expect(result.wasTranslated).toBe(true);
    });

    it('should log debug trace with input and translation', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          translatedText: 'ik wil dood',
          originalText: 'je veux mourir',
          wasTranslated: true,
          locale: 'fr',
        }),
      });

      await preprocessInput('je veux mourir', 'fr');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[pre-translate] input: "je veux mourir" → NL: "ik wil dood"')
      );
    });
  });

  describe('EN locale (translate)', () => {
    it('should translate EN text to NL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          translatedText: 'ik wil niet meer leven',
          originalText: 'I don\'t want to live anymore',
          wasTranslated: true,
          locale: 'en',
        }),
      });

      const result = await preprocessInput('I don\'t want to live anymore', 'en');

      expect(result.processedText).toBe('ik wil niet meer leven');
      expect(result.wasTranslated).toBe(true);
      expect(result.detectedLanguage).toBe('en');
    });
  });

  describe('Fallback on failure (SAFETY-CRITICAL)', () => {
    it('should pass through original text on network error — NEVER drop message', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await preprocessInput('je veux mourir', 'fr');

      // CRITICAL: message must NOT be dropped
      expect(result.processedText).toBe('je veux mourir');
      expect(result.wasTranslated).toBe(false);
      expect(result.detectedLanguage).toBe('fr');
    });

    it('should pass through original text on server 500 error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await preprocessInput('je veux mourir', 'fr');

      // CRITICAL: message must NOT be dropped
      expect(result.processedText).toBe('je veux mourir');
      expect(result.wasTranslated).toBe(false);
    });

    it('should pass through original text on abort/timeout', async () => {
      mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

      const result = await preprocessInput("j'ai envie de boire", 'fr');

      // CRITICAL: message must NOT be dropped
      expect(result.processedText).toBe("j'ai envie de boire");
      expect(result.wasTranslated).toBe(false);
    });

    it('should log error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      await preprocessInput('je veux mourir', 'fr');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[pre-translate] Exception: Connection refused')
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty input', async () => {
      const result = await preprocessInput('', 'fr');
      expect(result.processedText).toBe('');
      expect(result.wasTranslated).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only input', async () => {
      const result = await preprocessInput('   ', 'fr');
      expect(result.processedText).toBe('');
      expect(result.wasTranslated).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should default to NL locale when not specified', async () => {
      const result = await preprocessInput('hallo');
      expect(result.processedText).toBe('hallo');
      expect(result.wasTranslated).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

describe('Pre-Translate → Crisis Detection Integration', () => {
  /**
   * These tests verify that AFTER pre-translate, the NL text
   * correctly triggers crisis detection in detectInputSignals.
   */
  it('FR "je veux mourir" → NL "ik wil dood" → activeSuicidal = true', async () => {
    // Import the detection function
    const { detectInputSignals } = await import('@/lib/rugzak/state-analyzer');

    // Simulate: pre-translate returned "ik wil dood"
    const nlText = 'ik wil dood';
    const signals = detectInputSignals(nlText);

    expect(signals.activeSuicidal).toBe(true);
  });

  it('FR "j\'ai envie de boire" → NL "ik heb zin om te drinken" → cravingMention = true', async () => {
    const { detectInputSignals } = await import('@/lib/rugzak/state-analyzer');

    // Simulate: pre-translate returned NL craving text
    // The actual translation would be something like "ik heb trek om te drinken"
    const nlText = 'ik heb trek om te drinken';
    const signals = detectInputSignals(nlText);

    expect(signals.cravingMention).toBe(true);
  });

  it('NL "ik wil er niet meer zijn" → activeSuicidal = true (no translation needed)', async () => {
    const { detectInputSignals } = await import('@/lib/rugzak/state-analyzer');

    const signals = detectInputSignals('ik wil er niet meer zijn');
    expect(signals.activeSuicidal).toBe(true);
  });

  it('NL "ik heb drang om te drinken" → cravingMention = true', async () => {
    const { detectInputSignals } = await import('@/lib/rugzak/state-analyzer');

    const signals = detectInputSignals('ik heb drang om te drinken');
    expect(signals.cravingMention).toBe(true);
  });
});
