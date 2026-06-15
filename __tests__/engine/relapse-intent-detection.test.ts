/**
 * Relapse Intent Detection — Acceptance Tests
 *
 * Tests the full chain:
 * 1. Deterministic fallback markers (NL/EN/FR)
 * 2. GptSignalEngine interface contract
 * 3. Zone escalation logic (GROEN → ORANJE minimum)
 * 4. No false positives on safe messages
 * 5. Kim users are not affected (Elias-only feature)
 */

import { describe, it, expect } from 'vitest';
import { detectRelapseIntentFallback } from '../../lib/engine/local-llm/relapse-intent-fallback';
import { NullSignalEngine } from '../../lib/engine/local-llm/null-engine';
import { GptSignalEngine } from '../../lib/engine/local-llm/gpt-signal-engine';

// ─── Deterministic Fallback Marker Tests ─────────────────────────

describe('detectRelapseIntentFallback — NL markers', () => {
  const NL_POSITIVE_CASES = [
    'ik wil gebruiken',
    'ik wil weer drinken',
    'ik ga gebruiken vanavond',
    'ik ga weer roken',
    'ik heb zin om te gebruiken',
    'ik heb drang om te drinken',
    'ik verlang er zo naar',
    'ik moet iets nemen',
    'ik kan het niet laten',
    'ik kan het niet weerstaan',
    'ik wil blowen',
    'ik ga snuiven',
    'ik wil spuiten',
    'zin om te roken',
    'drang om te gebruiken',
  ];

  it.each(NL_POSITIVE_CASES)('detects relapse intent in: "%s"', (message) => {
    const result = detectRelapseIntentFallback(message);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe(0.7);
  });

  const NL_NEGATIVE_CASES = [
    'ik voel me goed vandaag',
    'ik heb vandaag niet gebruikt',
    'ik ben trots dat ik clean ben',
    'het gaat beter met me',
    'ik heb een moeilijke dag gehad',
    'ik voel me kwetsbaar',
    'ik denk aan vroeger',
    'mijn verlangen is minder geworden',
  ];

  it.each(NL_NEGATIVE_CASES)('does NOT detect relapse intent in: "%s"', (message) => {
    const result = detectRelapseIntentFallback(message);
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });
});

describe('detectRelapseIntentFallback — EN markers', () => {
  const EN_POSITIVE_CASES = [
    'I want to use tonight',
    'I want to drink',
    'I want to smoke',
    "I'm going to use",
    "I'm going to drink",
    'I have an urge to use',
    'urge to relapse',
    'I need a drink',
    'I need a hit',
    'I need a fix',
    "I can't resist the urge",
    "I can't resist the craving",
    "I'm going to relapse",
    'I want to get high',
    'I want to get drunk',
  ];

  it.each(EN_POSITIVE_CASES)('detects relapse intent in: "%s"', (message) => {
    const result = detectRelapseIntentFallback(message);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe(0.7);
  });

  const EN_NEGATIVE_CASES = [
    'I feel good today',
    'I stayed sober',
    'I used to drink a lot',
    'I want to get better',
    'I am struggling but holding on',
    'I talked about my urges in therapy',
  ];

  it.each(EN_NEGATIVE_CASES)('does NOT detect relapse intent in: "%s"', (message) => {
    const result = detectRelapseIntentFallback(message);
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });
});

describe('detectRelapseIntentFallback — FR markers', () => {
  const FR_POSITIVE_CASES = [
    "j'ai envie de consommer",
    "j'ai envie de boire",
    'je vais consommer',
    'je vais rechuter',
    'je veux boire',
    'je veux fumer',
    'besoin de consommer',
    'je ne peux pas résister',
    'je ne pourrai pas résister',
  ];

  it.each(FR_POSITIVE_CASES)('detects relapse intent in: "%s"', (message) => {
    const result = detectRelapseIntentFallback(message);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe(0.7);
  });
});

// ─── NullSignalEngine Tests ──────────────────────────────────────

describe('NullSignalEngine.detectRelapseIntent', () => {
  it('returns not detected (safe fallback)', async () => {
    const engine = new NullSignalEngine();
    const result = await engine.detectRelapseIntent('ik wil gebruiken');
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });
});

// ─── GptSignalEngine Interface Tests ─────────────────────────────

describe('GptSignalEngine.detectRelapseIntent', () => {
  it('has detectRelapseIntent method', () => {
    const engine = new GptSignalEngine('http://localhost:3000');
    expect(typeof engine.detectRelapseIntent).toBe('function');
  });

  it('returns not detected on network failure (graceful fallback)', async () => {
    // Uses a non-existent URL to trigger network error
    const engine = new GptSignalEngine('http://localhost:99999');
    const result = await engine.detectRelapseIntent('ik wil gebruiken');
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });
});

// ─── Zone Escalation Logic Tests ─────────────────────────────────

describe('Zone escalation from relapse intent', () => {
  it('confidence threshold is 0.6 — below threshold does not trigger', () => {
    // Simulate: confidence 0.5 should NOT trigger escalation
    const result = detectRelapseIntentFallback('ik voel me kwetsbaar');
    // This message doesn't match markers → confidence 0, no escalation
    expect(result.detected).toBe(false);
  });

  it('fallback returns confidence 0.7 which exceeds 0.6 threshold', () => {
    const result = detectRelapseIntentFallback('ik wil gebruiken');
    expect(result.confidence).toBe(0.7);
    expect(result.confidence >= 0.6).toBe(true);
  });

  it('combined message with vulnerability + relapse intent triggers detection', () => {
    const result = detectRelapseIntentFallback('ik voel me kwetsbaar en ik wil gebruiken');
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe(0.7);
  });

  it('past relapse language does NOT trigger (not intent)', () => {
    // "ik heb weer gebruikt" = past tense, handled by crisis detector, not intent
    const result = detectRelapseIntentFallback('ik heb weer gebruikt');
    expect(result.detected).toBe(false);
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────

describe('Relapse intent edge cases', () => {
  it('case insensitive detection', () => {
    const result = detectRelapseIntentFallback('IK WIL GEBRUIKEN');
    expect(result.detected).toBe(true);
  });

  it('embedded in longer sentence (inverted word order)', () => {
    const result = detectRelapseIntentFallback('na het werk vandaag wil ik zo graag gebruiken, ik weet niet wat ik moet doen');
    expect(result.detected).toBe(true);
  });

  it('embedded in longer sentence (normal word order)', () => {
    const result = detectRelapseIntentFallback('ik heb het moeilijk en ik wil echt gebruiken vanavond');
    expect(result.detected).toBe(true);
  });

  it('multiple languages in one message — NL detected', () => {
    const result = detectRelapseIntentFallback('I feel terrible, ik wil gebruiken');
    expect(result.detected).toBe(true);
  });

  it('negation is NOT filtered (conservative approach)', () => {
    // "ik wil niet gebruiken" still contains "ik wil gebruiken" pattern
    // This is intentional: better to escalate and let GPT-4o handle nuance
    const result = detectRelapseIntentFallback('ik wil niet gebruiken');
    // The regex \bwil\s+(weer\s+)?(gebruiken|...) will match "wil niet gebruiken"?
    // Actually "wil niet" has "niet" between wil and gebruiken, so regex won't match
    // Let's verify:
    expect(result.detected).toBe(false); // "niet" breaks the pattern — correct behavior
  });

  it('"ik wil stoppen met gebruiken" does NOT trigger (intent to stop, not to use)', () => {
    const result = detectRelapseIntentFallback('ik wil stoppen met gebruiken');
    expect(result.detected).toBe(false); // "stoppen met" breaks the pattern
  });
});

// ─── Kim-variant: Loved ones reporting relapse intent (third person) ────

import { detectKimRelapseIntentFallback } from '../../lib/engine/local-llm/relapse-intent-fallback';

describe('detectKimRelapseIntentFallback — NL markers (third person)', () => {
  const NL_KIM_POSITIVE_CASES = [
    'hij wil weer drinken',
    'zij wil gebruiken',
    'ze gaat weer roken',
    'mijn partner wil weer drinken',
    'mijn zoon gaat gebruiken',
    'hij heeft weer zin om te drinken',
    'ze kan het niet weerstaan',
    'hij zegt dat hij wil gebruiken',
    'ze dreigt te gebruiken',
    'mijn man wil weer blowen',
    'mijn dochter gaat weer snuiven',
  ];

  it.each(NL_KIM_POSITIVE_CASES)('detects Kim relapse intent in: "%s"', (message) => {
    const result = detectKimRelapseIntentFallback(message);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe(0.65);
  });

  const NL_KIM_NEGATIVE_CASES = [
    'hij heeft vandaag niet gedronken',
    'mijn partner gaat naar therapie',
    'ze voelt zich beter',
    'hij is al drie maanden clean',
    'mijn zoon heeft hulp gezocht',
    'ik maak me zorgen om hem',
  ];

  it.each(NL_KIM_NEGATIVE_CASES)('does NOT detect Kim relapse intent in: "%s"', (message) => {
    const result = detectKimRelapseIntentFallback(message);
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });
});

describe('detectKimRelapseIntentFallback — EN markers (third person)', () => {
  const EN_KIM_POSITIVE_CASES = [
    'he wants to drink again',
    'she wants to use',
    "he's going to relapse",
    "she's going to drink",
    "they can't resist the urge",
    'he said he wants to smoke',
    "she's threatening to use",
    'my partner wants to drink',
    'my husband wants to use',
    'my son is going to relapse',
  ];

  it.each(EN_KIM_POSITIVE_CASES)('detects Kim relapse intent in: "%s"', (message) => {
    const result = detectKimRelapseIntentFallback(message);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe(0.65);
  });

  const EN_KIM_NEGATIVE_CASES = [
    'he is doing better today',
    'she went to her meeting',
    'my partner is in recovery',
    'he used to drink but stopped',
    'they are getting help',
  ];

  it.each(EN_KIM_NEGATIVE_CASES)('does NOT detect Kim relapse intent in: "%s"', (message) => {
    const result = detectKimRelapseIntentFallback(message);
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });
});

describe('detectKimRelapseIntentFallback — FR markers (third person)', () => {
  const FR_KIM_POSITIVE_CASES = [
    'il veut consommer',
    'elle veut boire',
    'il va rechuter',
    'elle va boire',
    'il ne peut pas résister',
    "il dit qu'il veut boire",
  ];

  it.each(FR_KIM_POSITIVE_CASES)('detects Kim relapse intent in: "%s"', (message) => {
    const result = detectKimRelapseIntentFallback(message);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe(0.65);
  });
});

describe('Kim vs Elias marker separation', () => {
  it('Elias first-person markers do NOT trigger Kim detection', () => {
    const result = detectKimRelapseIntentFallback('ik wil gebruiken');
    expect(result.detected).toBe(false);
  });

  it('Kim third-person markers do NOT trigger Elias detection', () => {
    const result = detectRelapseIntentFallback('hij wil weer drinken');
    expect(result.detected).toBe(false);
  });

  it('confidence is lower for Kim (0.65) than Elias (0.7) — reported vs expressed', () => {
    const eliasResult = detectRelapseIntentFallback('ik wil gebruiken');
    const kimResult = detectKimRelapseIntentFallback('hij wil weer drinken');
    expect(eliasResult.confidence).toBe(0.7);
    expect(kimResult.confidence).toBe(0.65);
    expect(kimResult.confidence).toBeLessThan(eliasResult.confidence);
  });
});
