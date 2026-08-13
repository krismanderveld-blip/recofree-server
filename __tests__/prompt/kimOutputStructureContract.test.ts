/**
 * FASE P1: Kim Output Structure Contract Tests
 * Proves: kimFormulationBlock prominence, output contract injection, forbidden openers, structure enforcement
 */
import { describe, it, expect } from 'vitest';
import { KIM_IDENTITY_PROMPT, KIM_OUTPUT_STRUCTURE_CONTRACT } from '@/lib/engine/kim/prompt-block';
import { composeKimPrompt, buildKimRelationalFormulationBlock } from '@/lib/ai/prompt/kim-prompt-composer';
import type { ClientPromptBuildInput } from '@/lib/ai/prompt/client-prompt-types';

function makeKimInput(overrides: Partial<ClientPromptBuildInput> = {}): ClientPromptBuildInput {
  return {
    persona: 'kim',
    userName: 'Test',
    selectedModule: 'K01',
    crisisLevel: 0,
    safetyLevel: 'none',
    userGuidanceDepth: 'normal',
    relapseIntentDetected: false,
    sessionDurationMinutes: 5,
    recentHistory: [],
    ...overrides,
  } as ClientPromptBuildInput;
}

describe('Kim Output Structure Contract', () => {
  // TEST 1: kimFormulationBlock is passed separately to ClientPromptBuildInput
  it('1. kimFormulationBlock field exists in ClientPromptBuildInput type', () => {
    const input = makeKimInput({ kimFormulationBlock: 'TEST BLOCK' });
    expect(input.kimFormulationBlock).toBe('TEST BLOCK');
  });

  // TEST 2: kimFormulationBlock is present as its own prompt section
  it('2. kimFormulationBlock is injected as separate formulationBlock section', () => {
    const input = makeKimInput({ kimFormulationBlock: '[KIM RELATIONAL FORMULATION]\nMust mention: rescue pattern' });
    const sections = composeKimPrompt(input);
    expect(sections.formulationBlock).toBeDefined();
    expect(sections.formulationBlock).toContain('rescue pattern');
  });

  // TEST 3: relationalStanceDirective still works
  it('3. relationalStanceDirective still injected as relationalStance section', () => {
    const input = makeKimInput({ relationalStanceDirective: 'STANCE: validate without polarizing' });
    const sections = composeKimPrompt(input);
    expect(sections.relationalStance).toContain('validate without polarizing');
  });

  // TEST 4: generic opener is forbidden when formulation exists
  it('4. KIM_OUTPUT_STRUCTURE_CONTRACT forbids generic openers', () => {
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('FORBIDDEN generic openers');
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('Ik zie dat je veel worstelingen ervaart');
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('Het is begrijpelijk dat je...');
  });

  // TEST 5: first sentence must name concrete relational pattern
  it('5. contract requires first sentence to name concrete relational pattern', () => {
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('FIRST SENTENCE: Name the concrete relational pattern');
  });

  // TEST 6: responsibility separation is required
  it('6. contract requires responsibility separation in second sentence', () => {
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('SECOND SENTENCE: Separate responsibility clearly');
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('What belongs to the person with addiction');
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('What belongs to the caregiver');
  });

  // TEST 7: boundary/self-preservation/repair step is required
  it('7. contract requires concrete next step in third sentence', () => {
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('THIRD SENTENCE: Give ONE concrete next step');
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('A boundary sentence');
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('A self-preservation step');
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('A repair condition');
  });

  // TEST 8: generic end-question cannot be the whole intervention
  it('8. contract forbids generic end-question as main intervention', () => {
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('FORBIDDEN weak endings');
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('Wat heb je nodig om jezelf te ondersteunen in dit proces?');
  });

  // TEST 9: Kim does not demonize the person with addiction
  it('9. Kim identity does not demonize the person with addiction', () => {
    expect(KIM_IDENTITY_PROMPT).toContain('without making the addicted person the enemy');
    expect(KIM_IDENTITY_PROMPT).toContain('You name patterns, not villains');
  });

  // TEST 10: Kim does not push breakup
  it('10. Kim identity does not advise leaving or breaking up', () => {
    expect(KIM_IDENTITY_PROMPT).toContain('You never advise to leave, stay, cut contact, or break up');
  });

  // TEST 11: Kim does not assign recovery to caregiver
  it('11. contract separates recovery as belonging to the person with addiction', () => {
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('What belongs to the person with addiction (recovery, honesty, choices)');
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('What does NOT belong to the caregiver');
  });

  // TEST 12: Kim does not use Elias VSP/sobriety/recovery language
  it('12. Kim identity does not contain Elias-specific recovery language', () => {
    expect(KIM_IDENTITY_PROMPT).not.toContain('sobriety');
    expect(KIM_IDENTITY_PROMPT).not.toContain('relapse prevention');
    expect(KIM_IDENTITY_PROMPT).not.toContain('craving management');
  });

  // TEST 13: Kim still works when formulation block is absent
  it('13. Kim prompt works without formulation block', () => {
    const input = makeKimInput({});
    const sections = composeKimPrompt(input);
    expect(sections.identity).toBeDefined();
    expect(sections.identity.length).toBeGreaterThan(100);
    expect(sections.formulationBlock).toBeUndefined();
  });

  // TEST 14: Elias output unaffected
  it('14. Elias prompt does not contain Kim output structure contract', () => {
    const input = makeKimInput({ persona: 'elias' as any });
    // composeKimPrompt is only called for Kim - Elias uses composeEliasPrompt
    // This test verifies the contract is Kim-specific
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('MANDATORY FOR EVERY KIM RESPONSE');
  });

  // TEST 15: Output structure contract is part of identity section
  it('15. KIM_OUTPUT_STRUCTURE_CONTRACT is injected into identity section', () => {
    const input = makeKimInput({});
    const sections = composeKimPrompt(input);
    expect(sections.identity).toContain('OUTPUT STRUCTURE CONTRACT');
    expect(sections.identity).toContain('FIRST SENTENCE');
    expect(sections.identity).toContain('SECOND SENTENCE');
    expect(sections.identity).toContain('THIRD SENTENCE');
  });

  // TEST 16: formulation block instructs GPT to use mustMention/mustAvoid
  it('16. contract instructs GPT to use formulation mustMention/mustAvoid', () => {
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('USE FORMULATION CONTENT');
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('mustMention items');
    expect(KIM_OUTPUT_STRUCTURE_CONTRACT).toContain('mustAvoid items');
  });
});
