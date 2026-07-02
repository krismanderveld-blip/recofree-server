/**
 * Tests for greeting error narrative filtering, topic extraction, and
 * second-person fallback conversion.
 */
import { describe, it, expect } from 'vitest';

// ─── Replicate isErrorNarrative logic for testing ────────────────────────────

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

// ─── Replicate truncateAtBoundary ────────────────────────────────────────────

function truncateAtBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text.replace(/[.!?,;:]+$/, '').trim();
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  const result = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;
  return result.replace(/[.!?,;:\s]+$/, '').trim();
}

// ─── Replicate thirdToSecondPerson ───────────────────────────────────────────

function thirdToSecondPerson(text: string): string {
  let result = text;
  result = result.replace(/^voelt zich\s+(.+)$/i, 'hoe je je $1 voelt');
  result = result.replace(/^voelde zich\s+(.+)$/i, 'hoe je je $1 voelde');
  result = result.replace(/^heeft\s+(.+)$/i, 'je $1 hebt');
  result = result.replace(/^had\s+(.+)$/i, 'je $1 had');
  result = result.replace(/^is\s+(.+)$/i, 'je $1 bent');
  result = result.replace(/^was\s+(.+)$/i, 'je $1 was');
  result = result.replace(/^ervaart\s+(.+)$/i, 'wat je ervaart met $1');
  result = result.replace(/^ervoer\s+(.+)$/i, 'wat je ervoer met $1');
  result = result.replace(/^maakt zich zorgen over\s+(.+)$/i, 'je zorgen over $1');
  result = result.replace(/^maakte zich zorgen over\s+(.+)$/i, 'je zorgen over $1');
  result = result.replace(/^denkt na over\s+(.+)$/i, 'waar je over nadenkt: $1');
  result = result.replace(/^wil\s+(.+)$/i, 'wat je wilt: $1');
  result = result.replace(/^wilde\s+(.+)$/i, 'wat je wilde: $1');
  result = result.replace(/\bzijn\s+(begeleider|partner|moeder|vader|broer|zus|vriend|vriendin|baas|collega|kind|kinderen|gezin|familie|werk|baan|relatie|situatie|gevoel|gevoelens|gedachten|angst|stress|craving)\b/gi, 'je $1');
  result = result.replace(/\bhaar\s+(begeleider|partner|moeder|vader|broer|zus|vriend|vriendin|baas|collega|kind|kinderen|gezin|familie|werk|baan|relatie|situatie|gevoel|gevoelens|gedachten|angst|stress|craving)\b/gi, 'je $1');
  return result;
}

// ─── Replicate extractTopicCore ──────────────────────────────────────────────

function extractTopicCore(narrative: string): string | null {
  let clean = narrative.trim().toLowerCase();
  clean = clean
    .replace(/^sessie-inhoud \(\d+ berichten\):\s*/i, '')
    .replace(/^sessie met \d+ berichten.*?:\s*/i, '')
    .replace(/^gebruiker besprak:?\s*/i, '')
    .replace(/^de gebruiker besprak:?\s*/i, '')
    .replace(/^gebruiker vertelde:?\s*/i, '')
    .replace(/^de gebruiker vertelde:?\s*/i, '')
    .replace(/^samenvatting:?\s*/i, '');
  clean = clean.replace(/^[a-z]{2,15}\s+(?=voelt|voelde|besprak|vertelde|heeft|had|is|was|ervaart|ervoer|maakt|maakte|denkt|dacht|wil|wilde|zoekt|zocht|merkt|merkte|praat|praatte|sprak|spreekt)/i, '');
  if (clean.includes(' | ')) {
    const parts = clean.split(' | ');
    const substantive = parts.filter(p => p.length > 15).sort((a, b) => b.length - a.length)[0];
    if (substantive) clean = substantive.trim();
  }
  const firstSentence = clean.match(/^[^.!?]+[.!?]/)?.[0];
  if (firstSentence && firstSentence.length >= 10 && firstSentence.length <= 100) {
    clean = firstSentence.replace(/[.!?]+$/, '').trim();
  }
  if (clean.length < 5) return null;
  return clean;
}

// ─── Replicate narrativeToSecondPersonTopic ──────────────────────────────────

function narrativeToSecondPersonTopic(narrative: string): string | null {
  if (!narrative || narrative.length < 10) return null;
  let topic = extractTopicCore(narrative);
  if (!topic || topic.length < 5) return 'We pakken de draad op van vorige keer.';
  topic = thirdToSecondPerson(topic);
  topic = truncateAtBoundary(topic, 70);
  if (!topic || topic.length < 5) return 'We pakken de draad op van vorige keer.';
  return `Vorige keer hadden we het over ${topic}.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

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

describe('thirdToSecondPerson', () => {
  it('converts "voelt zich overweldigd" to second person', () => {
    expect(thirdToSecondPerson('voelt zich overweldigd door de situatie')).toBe('hoe je je overweldigd door de situatie voelt');
  });

  it('converts "heeft moeite met" to second person', () => {
    expect(thirdToSecondPerson('heeft moeite met slapen')).toBe('je moeite met slapen hebt');
  });

  it('converts "is bang voor" to second person', () => {
    expect(thirdToSecondPerson('is bang voor terugval')).toBe('je bang voor terugval bent');
  });

  it('converts "maakt zich zorgen over" to second person', () => {
    expect(thirdToSecondPerson('maakt zich zorgen over zijn kinderen')).toBe('je zorgen over je kinderen');
  });

  it('replaces possessive "zijn" with "je" for known nouns', () => {
    expect(thirdToSecondPerson('problemen met zijn begeleider')).toBe('problemen met je begeleider');
    expect(thirdToSecondPerson('conflict met zijn partner')).toBe('conflict met je partner');
  });

  it('leaves text unchanged when no third-person pattern matches', () => {
    expect(thirdToSecondPerson('stress op werk')).toBe('stress op werk');
    expect(thirdToSecondPerson('craving bij sociale druk')).toBe('craving bij sociale druk');
  });
});

describe('narrativeToSecondPersonTopic', () => {
  it('converts "kris voelt zich overweldigd door situatie met zijn begeleider"', () => {
    const result = narrativeToSecondPersonTopic('kris voelt zich overweldigd door de situatie met zijn begeleider');
    expect(result).toBe('Vorige keer hadden we het over hoe je je overweldigd door de situatie met je begeleider voelt.');
    // Must NOT contain the raw name "kris"
    expect(result).not.toContain('kris');
  });

  it('converts "gebruiker besprak stress op werk en relatieproblemen"', () => {
    const result = narrativeToSecondPersonTopic('Gebruiker besprak stress op werk en relatieproblemen');
    expect(result).toBe('Vorige keer hadden we het over stress op werk en relatieproblemen.');
    expect(result).not.toContain('gebruiker');
  });

  it('handles clean topic without third-person form', () => {
    const result = narrativeToSecondPersonTopic('craving en copingstrategieën bij sociale druk');
    expect(result).toBe('Vorige keer hadden we het over craving en copingstrategieën bij sociale druk.');
  });

  it('returns generic continuity for very short/empty input', () => {
    // < 10 chars returns null (input too short to be a real narrative)
    expect(narrativeToSecondPersonTopic('kort')).toBeNull();
    expect(narrativeToSecondPersonTopic('')).toBeNull();
    // 10+ chars with extractable content → produces a topic line
    expect(narrativeToSecondPersonTopic('ab cd ef g')).toBe('Vorige keer hadden we het over ab cd ef g.');
  });

  it('never produces a sentence longer than ~120 chars', () => {
    const longNarrative = 'De gebruiker besprak uitgebreid zijn zorgen over sociale isolatie en het gebrek aan een steunnetwerk in zijn directe omgeving en de impact daarvan op zijn dagelijks functioneren';
    const result = narrativeToSecondPersonTopic(longNarrative);
    expect(result).toBeTruthy();
    expect(result!.length).toBeLessThan(120);
  });

  it('never ends mid-word', () => {
    const result = narrativeToSecondPersonTopic('kris heeft moeite met het accepteren van hulp van buitenaf en wil alles zelf oplossen');
    expect(result).toBeTruthy();
    // Should not end with a partial word
    expect(result!).not.toMatch(/\s\w$/);
    // Should end with a period
    expect(result!.endsWith('.')).toBe(true);
  });

  it('handles "zijn begeleider" → "je begeleider" conversion', () => {
    const result = narrativeToSecondPersonTopic('kris maakt zich zorgen over zijn relatie met zijn begeleider');
    expect(result).toContain('je begeleider');
    expect(result).not.toContain('zijn begeleider');
    expect(result).not.toContain('kris');
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
    expect(long.includes(result)).toBe(true);
  });

  it('removes trailing punctuation', () => {
    expect(truncateAtBoundary('test zin,', 80)).toBe('test zin');
    expect(truncateAtBoundary('test zin;', 80)).toBe('test zin');
  });
});
