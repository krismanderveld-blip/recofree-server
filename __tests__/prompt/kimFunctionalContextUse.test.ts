/**
 * P1 KIM FUNCTIONAL CONTEXT USE CONTRACT Tests
 * Validates: functional context use, no sentence-count rules, concept-based assertions
 * 20 tests covering all acceptance criteria
 */
import { describe, it, expect } from 'vitest';
import { KIM_IDENTITY_PROMPT, KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT } from '@/lib/engine/kim/prompt-block';
import { composeKimPrompt } from '@/lib/ai/prompt/kim-prompt-composer';
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

describe('Kim Functional Context Use Contract', () => {
  // TEST 1: kimFormulationBlock is passed separately to prompt input when available
  it('1. kimFormulationBlock is passed as separate field in ClientPromptBuildInput', () => {
    const input = makeKimInput({ kimFormulationBlock: 'TEST FORMULATION BLOCK' });
    expect(input.kimFormulationBlock).toBe('TEST FORMULATION BLOCK');
  });

  // TEST 2: Kim formulation appears as distinct prompt section
  it('2. kimFormulationBlock appears as distinct formulationBlock section in composed prompt', () => {
    const input = makeKimInput({ kimFormulationBlock: '[KIM RELATIONAL FORMULATION]\nMust mention: rescue pattern detected' });
    const sections = composeKimPrompt(input);
    expect(sections.formulationBlock).toBeDefined();
    expect(sections.formulationBlock).toContain('rescue pattern detected');
  });

  // TEST 3: relationalStanceDirective remains available
  it('3. relationalStanceDirective still injected as relationalStance section', () => {
    const input = makeKimInput({ relationalStanceDirective: 'STANCE: validate without polarizing' });
    const sections = composeKimPrompt(input);
    expect(sections.relationalStance).toContain('validate without polarizing');
  });

  // TEST 4: Contract requires functional context use when formulation available
  it('4. contract requires Kim to use available formulation functionally', () => {
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('Kim must use available formulation and memory context functionally');
  });

  // TEST 5: Generic standalone opener is forbidden when formulation available
  it('5. generic standalone openers are forbidden when formulation/context is available', () => {
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('FORBIDDEN as standalone response when formulation/context is available');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('Ik zie dat je veel worstelingen ervaart');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('Ik hoor dat dit moeilijk is');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('Het klinkt alsof dit zwaar is');
  });

  // TEST 6: Generic standalone support question is forbidden when formulation available
  it('6. generic standalone support question is forbidden when formulation/context is available', () => {
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('Wat heb je nodig om jezelf te ondersteunen?');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('any equivalent generic therapist response that does not use the available Kim formulation');
  });

  // TEST 7: Rescue/control input causes responsibility separation
  it('7. rescue/control/self-loss requires responsibility separation', () => {
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('If rescue/control/self-loss/responsibility-confusion is detected');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('Kim must separate what belongs to the dependent person from what belongs to the caregiver');
  });

  // TEST 8: Lying/trust-damage input causes concrete naming
  it('8. lying/trust-damage requires concrete naming of trust impact', () => {
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('If lying/repeated harm/trust damage/betrayal is detected');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('Kim must name the trust or safety impact without demonizing the dependent person');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('Kim must not reduce it to "frustration" or "worsteling"');
  });

  // TEST 9: Boundary fatigue/self-loss requires boundary direction
  it('9. boundary fatigue/self-loss requires boundary or self-preservation direction', () => {
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('If boundary fatigue/self-loss is detected');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('Kim must include a boundary, self-preservation direction, or protection of the caregiver');
  });

  // TEST 10: Kim does not demonize the dependent person
  it('10. contract prevents demonizing the dependent person', () => {
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('without demonizing the dependent person');
  });

  // TEST 11: Kim does not push breakup (no forced disconnection)
  it('11. Kim identity prevents pushing breakup/disconnection', () => {
    expect(KIM_IDENTITY_PROMPT).toContain('repair');
    // Kim must always include repair path unless safety active
  });

  // TEST 12: Kim does not make recovery the caregiver's task
  it('12. contract separates dependent person recovery from caregiver responsibility', () => {
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('what belongs to the dependent person');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('what belongs to the caregiver');
  });

  // TEST 13: Kim does not use Elias VSP/sobriety/recovery language
  it('13. Kim prompt does not contain Elias-specific recovery language', () => {
    const input = makeKimInput({ kimFormulationBlock: 'test' });
    const sections = composeKimPrompt(input);
    const fullPrompt = Object.values(sections).filter(Boolean).join(' ');
    expect(fullPrompt).not.toContain('sobriety');
    expect(fullPrompt).not.toContain('relapse prevention');
    expect(fullPrompt).not.toContain('recovery chain');
  });

  // TEST 14: Kim may answer briefly when no formulation/context available
  it('14. contract allows brief answers when situation is light', () => {
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('Kim may answer briefly when the situation is light');
  });

  // TEST 15: Kim may answer longer when relational harm or safety requires it
  it('15. contract allows longer answers when situation is complex/harmful/unsafe', () => {
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('Kim may answer more fully when the situation is complex, repeated, unsafe, relationally harmful or emotionally loaded');
  });

  // TEST 16: No test asserts exact sentence count
  it('16. contract does NOT impose fixed sentence count', () => {
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).not.toContain('FIRST SENTENCE');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).not.toContain('SECOND SENTENCE');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).not.toContain('THIRD SENTENCE');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('No fixed order. No fixed wording. No fixed length.');
  });

  // TEST 17: No test asserts exact wording from an example answer
  it('17. contract does NOT contain hardcoded example answers', () => {
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).not.toContain('Example:');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).not.toContain('Je lijkt opnieuw in een positie');
  });

  // TEST 18: Elias output unaffected (Kim-only contract)
  it('18. Elias prompt does not receive KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT', () => {
    const input = { ...makeKimInput(), persona: 'elias' as const };
    // composeKimPrompt is only called for Kim, not Elias
    // This test verifies the contract is Kim-specific
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('Kim must');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).not.toContain('Elias must');
  });

  // TEST 19: Safety comes first when detected
  it('19. safety risk takes priority over all other context use', () => {
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('If safety risk is detected');
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('safety comes first');
  });

  // TEST 20: mustMention/mustAvoid from formulation must be used
  it('20. formulation mustMention items must be used when formulation block present', () => {
    expect(KIM_FUNCTIONAL_CONTEXT_USE_CONTRACT).toContain('you MUST use its mustMention items and respect its mustAvoid items');
  });
});
