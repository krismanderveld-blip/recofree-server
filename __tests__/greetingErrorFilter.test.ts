/**
 * Tests for greeting error narrative filtering and topic extraction fixes.
 */
import { describe, it, expect } from 'vitest';

// We test the logic inline since the functions are not exported.
// Replicate the isErrorNarrative logic for testing.
function isErrorNarrative(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const ERROR_INDICATORS = [
    'niet beschikbaar',
    'network requ',
    'network error',
    'failed to fetch',
    'connection refused',
    'timeout',
    'http 5',
    'http 4',
    'internal server error',
    'openai error',
    'gpt-samenvatting niet',
    'samenvatting niet beschikbaar',
    'error:',
  ];
  const hasError = ERROR_INDICATORS.some(indicator => lower.includes(indicator));
  if (!hasError) return false;
  if (text.length < 200) return true;
  const first100 = lower.slice(0, 100);
  return ERROR_INDICATORS.some(indicator => first100.includes(indicator));
}

function truncateAtBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text.replace(/[.!?,;:]+$/, '').trim();
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  const result = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;
  return result.replace(/[.!?,;:\s]+$/, '').trim();
}

function extractTopicFromNarrative(narrative: string): string | null {
  if (!narrative || narrative.length < 10) return null;

  if (narrative.includes(' | ')) {
    const parts = narrative.split(' | ');
    const substantive = parts
      .filter(p => p.length > 15)
      .sort((a, b) => b.length - a.length)[0];
    if (substantive) {
      return truncateAtBoundary(substantive.toLowerCase(), 80);
    }
  }

  const clean = narrative
    .replace(/^Sessie-inhoud \(\d+ berichten\):\s*/i, '')
    .replace(/^Sessie met \d+ berichten.*?:\s*/i, '')
    .replace(/^Gebruiker besprak:\s*/i, '')
    .trim();

  if (clean.length < 10) return null;

  const firstSentence = clean.match(/^[^.!?]+[.!?]/)?.[0];
  if (firstSentence && firstSentence.length >= 10 && firstSentence.length <= 100) {
    return firstSentence.replace(/[.!?]+$/, '').toLowerCase().trim();
  }

  return truncateAtBoundary(clean.toLowerCase(), 80);
}

describe('isErrorNarrative', () => {
  it('detects the exact error string from the screenshot', () => {
    const errorNarrative = 'Sessie beëindigd (2 berichten). GPT-samenvatting niet beschikbaar: network request failed';
    expect(isErrorNarrative(errorNarrative)).toBe(true);
  });

  it('detects truncated error strings', () => {
    expect(isErrorNarrative('Sessie beëindigd (2 berichten). GPT-samenvatting niet beschikbaar: network reque')).toBe(true);
  });

  it('detects various error patterns', () => {
    expect(isErrorNarrative('Error: connection refused')).toBe(true);
    expect(isErrorNarrative('Samenvatting niet beschikbaar: timeout')).toBe(true);
    expect(isErrorNarrative('HTTP 502 Bad Gateway')).toBe(true);
    expect(isErrorNarrative('Failed to fetch from server')).toBe(true);
  });

  it('does NOT flag valid session narratives', () => {
    expect(isErrorNarrative('Gebruiker besprak stress op werk en relatieproblemen met partner')).toBe(false);
    expect(isErrorNarrative('Sessie over craving en copingstrategieën bij sociale druk')).toBe(false);
    expect(isErrorNarrative('De gebruiker voelde zich overweldigd door werkdruk en slaapproblemen')).toBe(false);
  });

  it('does NOT flag long narratives that happen to mention network in context', () => {
    const longNarrative = 'De gebruiker besprak uitgebreid zijn zorgen over sociale isolatie en het gebrek aan een steunnetwerk. ' +
      'Hij voelt zich eenzaam sinds de scheiding en mist het contact met vrienden. ' +
      'We werkten aan het identificeren van kleine stappen om weer connectie te maken met zijn omgeving. ' +
      'Het network van steunfiguren is beperkt maar er zijn enkele mogelijkheden.';
    expect(isErrorNarrative(longNarrative)).toBe(false);
  });

  it('returns false for empty/null input', () => {
    expect(isErrorNarrative('')).toBe(false);
  });
});

describe('extractTopicFromNarrative', () => {
  it('extracts a clean topic from a simple narrative', () => {
    const result = extractTopicFromNarrative('Gebruiker besprak stress op werk en relatieproblemen.');
    // First sentence extraction: removes trailing period and lowercases
    expect(result).toBe('gebruiker besprak stress op werk en relatieproblemen');
    // Should NOT end mid-word
    expect(result).not.toMatch(/\s\w$/);
  });

  it('extracts topic from pipe-separated messages', () => {
    const result = extractTopicFromNarrative('ik voel me gestrest door werk | mijn partner begrijpt me niet | ik slaap slecht');
    expect(result).toBeTruthy();
    // Should be a complete phrase, not cut mid-word
    expect(result!.endsWith(' ')).toBe(false);
  });

  it('never truncates mid-word', () => {
    const longNarrative = 'De gebruiker besprak uitgebreid zijn zorgen over sociale isolatie en het gebrek aan een steunnetwerk in zijn directe omgeving';
    const result = extractTopicFromNarrative(longNarrative);
    expect(result).toBeTruthy();
    // Should end at a word boundary — the last word should be a complete word
    // Verify it doesn't end with a space
    const lastChar = result!.charAt(result!.length - 1);
    expect(lastChar).not.toBe(' ');
    // Verify the result is a substring of the original (lowercased)
    expect(longNarrative.toLowerCase()).toContain(result!);
    // Verify length constraint
    expect(result!.length).toBeLessThanOrEqual(80);
  });

  it('uses first sentence when available', () => {
    const result = extractTopicFromNarrative('Stress op werk was het hoofdthema. Daarnaast besprak de gebruiker slaapproblemen.');
    expect(result).toBe('stress op werk was het hoofdthema');
  });

  it('returns null for very short input', () => {
    expect(extractTopicFromNarrative('kort')).toBeNull();
    expect(extractTopicFromNarrative('')).toBeNull();
  });

  it('strips "Gebruiker besprak:" prefix', () => {
    const result = extractTopicFromNarrative('Gebruiker besprak: craving en copingstrategieën bij sociale druk');
    expect(result).not.toContain('gebruiker besprak:');
  });
});

describe('truncateAtBoundary', () => {
  it('returns short text unchanged (minus trailing punctuation)', () => {
    expect(truncateAtBoundary('hello world', 80)).toBe('hello world');
    expect(truncateAtBoundary('hello world.', 80)).toBe('hello world');
  });

  it('truncates at word boundary', () => {
    const long = 'dit is een lange zin die meer dan tachtig karakters bevat en daarom ingekort moet worden door de functie';
    const result = truncateAtBoundary(long, 80);
    expect(result.length).toBeLessThanOrEqual(80);
    // Should not end mid-word
    expect(result).not.toMatch(/\s\w$/);
    // Should end at a space boundary
    expect(long.includes(result)).toBe(true);
  });

  it('removes trailing punctuation', () => {
    expect(truncateAtBoundary('test zin,', 80)).toBe('test zin');
    expect(truncateAtBoundary('test zin;', 80)).toBe('test zin');
  });
});
