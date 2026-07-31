/**
 * Absence Awareness — Prompt Building & Safety Filter Tests
 * Tests: absence mode prompt, LONG_RETURN soft tone, blame/relapse rejection
 */
import { describe, it, expect } from 'vitest';
import {
  buildGreetingSynthesisPromptPayload,
  enforceGreetingOutputRulesV3,
  getForbiddenPatterns,
} from '@/lib/features/sessionGreeting/buildGreetingSynthesisPrompt';
import type { SelectedSynthesisSource } from '@/lib/features/sessionGreeting/sessionGreetingV3.types';
import type { SessionAbsenceResult } from '@/lib/features/sessionGreeting/calculateSessionAbsence';

function makeAbsence(overrides: Partial<SessionAbsenceResult> = {}): SessionAbsenceResult {
  return {
    band: 'RETURN_AFTER_ABSENCE',
    isReturnAfterAbsence: true,
    absenceDaysExact: 5,
    absenceHoursExact: 120,
    lastSessionStartedAt: '2026-06-10T09:00:00.000Z',
    thresholdDays: 3,
    reason: 'User returns after absence threshold.',
    ...overrides,
  };
}

describe('Absence Prompt Building', () => {
  it('D1: RETURN_AFTER_ABSENCE prompt acknowledges absence warmly', () => {
    const sources: SelectedSynthesisSource[] = [
      { sourceType: 'RECENT_GRATITUDE', safeAnchor: 'Dankbaar voor rust', relevanceScore: 0.7 , eligible: true, reason: 'test' },
    ];
    const payload = buildGreetingSynthesisPromptPayload({
      userName: 'Kris',
      selectedSources: sources,
      absence: makeAbsence({ band: 'RETURN_AFTER_ABSENCE', absenceDaysExact: 5 }),
      mode: 'RETURN_AFTER_ABSENCE',
    });
    expect(payload.mode).toBe('RETURN_AFTER_ABSENCE');
    expect(payload.synthesisInstruction).toContain('Kris');
    // Should mention the absence in some form
    expect(payload.synthesisInstruction.toLowerCase()).toMatch(/afwezig|terug|weer hier|gemist/);
  });

  it('D2: LONG_RETURN prompt uses extra soft tone', () => {
    const sources: SelectedSynthesisSource[] = [];
    const payload = buildGreetingSynthesisPromptPayload({
      userName: 'Kris',
      selectedSources: sources,
      absence: makeAbsence({ band: 'LONG_RETURN', absenceDaysExact: 20 }),
      mode: 'RETURN_AFTER_ABSENCE',
    });
    expect(payload.synthesisInstruction).toContain('Kris');
    // LONG_RETURN should have softer, more gentle language
    expect(payload.synthesisInstruction.toLowerCase()).toMatch(/zacht|warm|voorzichtig|geen druk|rustig/);
  });

  it('D3: Absence prompt ends with open question (not data request)', () => {
    const sources: SelectedSynthesisSource[] = [
      { sourceType: 'TODAY_MOOD', safeAnchor: 'frustration=5', relevanceScore: 0.6 , eligible: true, reason: 'test' },
    ];
    const payload = buildGreetingSynthesisPromptPayload({
      userName: 'Kris',
      selectedSources: sources,
      absence: makeAbsence(),
      mode: 'RETURN_AFTER_ABSENCE',
    });
    // Should instruct to end with open question
    expect(payload.synthesisInstruction.toLowerCase()).toMatch(/open vraag|vraag/);
  });

  it('D4: Normal SYNTHESIS mode does NOT include absence context', () => {
    const sources: SelectedSynthesisSource[] = [
      { sourceType: 'TODAY_MOOD', safeAnchor: 'craving=3', relevanceScore: 0.8 , eligible: true, reason: 'test' },
    ];
    const payload = buildGreetingSynthesisPromptPayload({
      userName: 'Kris',
      selectedSources: sources,
      absence: { band: 'SHORT', isReturnAfterAbsence: false, absenceDaysExact: 1, absenceHoursExact: 24, lastSessionStartedAt: null, thresholdDays: 3, reason: 'short' },
      mode: 'SYNTHESIS',
    });
    expect(payload.mode).toBe('SYNTHESIS');
    // Should NOT mention absence
    expect(payload.synthesisInstruction.toLowerCase()).not.toMatch(/afwezig|terug.*bent|gemist/);
  });
});

describe('Absence Safety Filter', () => {
  it('D5: Forbidden patterns include blame/relapse terms', () => {
    const patterns = getForbiddenPatterns();
    const lowerPatterns = patterns.map(p => p.toLowerCase());
    expect(lowerPatterns).toContain('terugval');
    expect(lowerPatterns).toContain('hervallen');
    expect(lowerPatterns).toContain('waar was je');
    expect(lowerPatterns).toContain('je hebt gefaald');
  });

  it('D6: Safety filter rejects blame language', () => {
    const result = enforceGreetingOutputRulesV3('Kris, je hebt het opgegeven maar je bent er weer.');
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('D7: Safety filter rejects relapse assumption', () => {
    const result = enforceGreetingOutputRulesV3('Kris, na je terugval is het goed dat je terug bent.');
    expect(result.valid).toBe(false);
  });

  it('D8: Safety filter rejects "waar was je"', () => {
    const result = enforceGreetingOutputRulesV3('Kris, waar was je de afgelopen weken?');
    expect(result.valid).toBe(false);
  });

  it('D9: Safety filter accepts warm absence acknowledgment', () => {
    const result = enforceGreetingOutputRulesV3('Kris, fijn dat je er weer bent. Wat heb je nodig vandaag?');
    expect(result.valid).toBe(true);
  });

  it('D10: Safety filter still rejects "hoe voel je je"', () => {
    const result = enforceGreetingOutputRulesV3('Kris, welkom terug. Hoe voel je je vandaag?');
    expect(result.valid).toBe(false);
  });
});
