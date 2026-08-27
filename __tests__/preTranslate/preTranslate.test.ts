/**
 * Safety-critical client-built pre-translation tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockMinimalProxy = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai/minimal-proxy-client', () => ({ callMinimalProxy: mockMinimalProxy }));

import { preprocessInput } from '@/lib/ai/preprocessor';

describe('Pre-Translate Step', () => {
  beforeEach(() => {
    mockMinimalProxy.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  describe('NL locale (skip)', () => {
    it('skips translation for NL locale', async () => {
      const result = await preprocessInput('ik wil dood', 'nl');
      expect(result).toMatchObject({ processedText: 'ik wil dood', wasTranslated: false, detectedLanguage: 'nl' });
      expect(mockMinimalProxy).not.toHaveBeenCalled();
    });

    it('logs the NL skip trace', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      await preprocessInput('hallo', 'nl');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[pre-translate] skipped (nl)'));
    });
  });

  describe('FR locale', () => {
    it('translates crisis text and uses the versioned minimal-proxy prompt', async () => {
      mockMinimalProxy.mockResolvedValueOnce({ text: 'ik wil dood' });
      const result = await preprocessInput('je veux mourir', 'fr');
      expect(result).toMatchObject({ processedText: 'ik wil dood', wasTranslated: true, detectedLanguage: 'fr' });
      expect(mockMinimalProxy).toHaveBeenCalledWith(expect.objectContaining({
        persona: 'elias',
        promptBuildVersion: 'pre-translate-client-v2',
        messages: [{ role: 'user', content: 'je veux mourir' }],
      }));
    });

    it('translates craving text', async () => {
      mockMinimalProxy.mockResolvedValueOnce({ text: 'ik heb zin om te drinken' });
      await expect(preprocessInput("j'ai envie de boire", 'fr')).resolves.toMatchObject({
        processedText: 'ik heb zin om te drinken', wasTranslated: true,
      });
    });

    it('logs input and translated output', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      mockMinimalProxy.mockResolvedValueOnce({ text: 'ik wil dood' });
      await preprocessInput('je veux mourir', 'fr');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[pre-translate] input: "je veux mourir" → NL: "ik wil dood"'));
    });
  });

  it('translates EN text', async () => {
    mockMinimalProxy.mockResolvedValueOnce({ text: 'ik wil niet meer leven' });
    await expect(preprocessInput("I don't want to live anymore", 'en', 'kim')).resolves.toMatchObject({
      processedText: 'ik wil niet meer leven', wasTranslated: true, detectedLanguage: 'en',
    });
    expect(mockMinimalProxy).toHaveBeenCalledWith(expect.objectContaining({ persona: 'kim' }));
  });

  describe('Fallback on failure', () => {
    it.each([
      new Error('Network timeout'),
      new Error('minimal_proxy_HTTP_500'),
      new DOMException('Aborted', 'AbortError'),
    ])('never drops a message when translation fails: %s', async (error) => {
      mockMinimalProxy.mockRejectedValueOnce(error);
      const result = await preprocessInput('je veux mourir', 'fr');
      expect(result).toMatchObject({ processedText: 'je veux mourir', wasTranslated: false, detectedLanguage: 'fr' });
    });

    it('logs the failure reason', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      mockMinimalProxy.mockRejectedValueOnce(new Error('Connection refused'));
      await preprocessInput('je veux mourir', 'fr');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[pre-translate] Exception: Connection refused'));
    });
  });

  describe('Edge cases', () => {
    it.each([
      ['', ''],
      ['   ', ''],
    ])('handles empty input %j', async (input, expected) => {
      const result = await preprocessInput(input, 'fr');
      expect(result.processedText).toBe(expected);
      expect(result.wasTranslated).toBe(false);
      expect(mockMinimalProxy).not.toHaveBeenCalled();
    });

    it('defaults to NL', async () => {
      await expect(preprocessInput('hallo')).resolves.toMatchObject({ processedText: 'hallo', wasTranslated: false });
      expect(mockMinimalProxy).not.toHaveBeenCalled();
    });
  });
});

describe('Pre-Translate → Crisis Detection Integration', () => {
  it('FR crisis translation triggers activeSuicidal', async () => {
    const { detectInputSignals } = await import('@/lib/rugzak/state-analyzer');
    expect(detectInputSignals('ik wil dood').activeSuicidal).toBe(true);
  });

  it('FR craving translation triggers cravingMention', async () => {
    const { detectInputSignals } = await import('@/lib/rugzak/state-analyzer');
    expect(detectInputSignals('ik heb trek om te drinken').cravingMention).toBe(true);
  });

  it('NL suicidal wording triggers activeSuicidal without translation', async () => {
    const { detectInputSignals } = await import('@/lib/rugzak/state-analyzer');
    expect(detectInputSignals('ik wil er niet meer zijn').activeSuicidal).toBe(true);
  });

  it('NL craving wording triggers cravingMention', async () => {
    const { detectInputSignals } = await import('@/lib/rugzak/state-analyzer');
    expect(detectInputSignals('ik heb drang om te drinken').cravingMention).toBe(true);
  });
});
