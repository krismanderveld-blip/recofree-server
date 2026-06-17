/**
 * Session Greeting V3 — Prompt Building & Output Safety Filter Tests
 * Tests: synthesis prompt structure, override prompts, forbidden patterns
 */
import { describe, it, expect } from 'vitest';
import {
  buildGreetingSynthesisPromptPayload,
  enforceGreetingOutputRulesV3,
  getForbiddenPatterns,
  buildCrisisOverridePrompt,
  buildFirstSessionOverridePrompt,
  buildMissingDataOverridePrompt,
} from '@/lib/features/sessionGreeting/buildGreetingSynthesisPrompt';
import type { SelectedSynthesisSource } from '@/lib/features/sessionGreeting/sessionGreetingV3.types';

describe('Synthesis Prompt Building', () => {
  it('T14: Prompt contains all selected sources', () => {
    const sources: SelectedSynthesisSource[] = [
      { sourceType: 'TODAY_MOOD', safeAnchor: 'frustration=6, focus=3', relevanceScore: 0.8 },
      { sourceType: 'RECENT_DIARY', safeAnchor: 'Vandaag was het moeilijk op werk', relevanceScore: 0.7 },
    ];

    const payload = buildGreetingSynthesisPromptPayload({
      userName: 'Kris',
      selectedSources: sources,
      absence: { band: 'SHORT', isReturnAfterAbsence: false, absenceDaysExact: 1, absenceHoursExact: 24, lastSessionStartedAt: null, thresholdDays: 3, reason: 'short' },
      mode: 'SYNTHESIS',
    });
    expect(payload.synthesisInstruction).toContain('frustration=6');
    expect(payload.synthesisInstruction).toContain('Vandaag was het moeilijk op werk');
    expect(payload.userName).toBe('Kris');
    expect(payload.mode).toBe('SYNTHESIS');
    expect(payload.maxSentences).toBe(4);
  });

  it('T15: Prompt includes language rule for correct Dutch', () => {
    const sources: SelectedSynthesisSource[] = [
      { sourceType: 'RECENT_GRATITUDE', safeAnchor: 'Dankbaar voor rust', relevanceScore: 0.6 },
    ];

    const payload = buildGreetingSynthesisPromptPayload({
      userName: 'Kris',
      selectedSources: sources,
      absence: { band: 'SHORT', isReturnAfterAbsence: false, absenceDaysExact: 1, absenceHoursExact: 24, lastSessionStartedAt: null, thresholdDays: 3, reason: 'short' },
      mode: 'SYNTHESIS',
    });
    expect(payload.languageRule).toContain('grammaticaal correct');
    expect(payload.languageRule).toContain('Nederlands');
    expect(payload.synthesisInstruction).toContain('Grammaticaal correct');
  });

  it('T16: Crisis override prompt mentions craving level', () => {
    const prompt = buildCrisisOverridePrompt('Kris', 8);
    expect(prompt).toContain('8');
    expect(prompt).toContain('Kris');
    expect(prompt).toContain('craving');
  });

  it('T17: First session override prompt is welcoming', () => {
    const prompt = buildFirstSessionOverridePrompt('Kris');
    expect(prompt).toContain('EERSTE sessie');
    expect(prompt).toContain('Kris');
  });

  it('T18: Missing data override prompt invites gently without being mandatory', () => {
    const prompt = buildMissingDataOverridePrompt('Kris');
    expect(prompt).toContain('Kris');
    expect(prompt).toContain('nog niets ingevuld');
    // The prompt says "NIET dwingend, NIET verplichtend" as instruction
    expect(prompt).toContain('NIET dwingend');
  });
});

describe('Output Safety Filter', () => {
  it('T19: Rejects output containing "hoe voel je je"', () => {
    const result = enforceGreetingOutputRulesV3(
      'Kris, hoe voel je je vandaag? Ik ben benieuwd naar je dag.'
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('hoe voel je je');
  });

  it('T20: Rejects output with numbered list', () => {
    const result = enforceGreetingOutputRulesV3(
      'Kris, goed je te zien.\n1. Je dagboek was mooi\n2. Je craving is laag\n3. Waar wil je het over hebben?'
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('list formatting');
  });

  it('T21: Rejects output with emoji', () => {
    const result = enforceGreetingOutputRulesV3(
      'Kris, fijn dat je er bent! 😊 Waar wil je het vandaag over hebben?'
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('emoji');
  });

  it('T22: Rejects inventory-style language', () => {
    const result = enforceGreetingOutputRulesV3(
      'Kris, ik zie dat je gisteren een moeilijke dag had. Laat me even opsommen wat ik weet.'
    );
    expect(result.valid).toBe(false);
    // Either forbidden pattern "ik zie dat je" or inventory regex "laat me even opsommen"
    expect(result.valid).toBe(false);
  });

  it('T23: Accepts valid warm greeting', () => {
    const result = enforceGreetingOutputRulesV3(
      'Kris, fijn dat je er bent. Goed dat je gisteren een fijne dag had — dat straalt door. Waar wil je het vandaag over hebben?'
    );
    expect(result.valid).toBe(true);
  });

  it('T24: Rejects too-short output', () => {
    const result = enforceGreetingOutputRulesV3('Hoi');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('too short');
  });

  it('T25: Forbidden patterns list is non-empty and contains key patterns', () => {
    const patterns = getForbiddenPatterns();
    expect(patterns.length).toBeGreaterThan(5);
    expect(patterns).toContain('hoe voel je je');
    expect(patterns).toContain('hoe gaat het');
  });
});
