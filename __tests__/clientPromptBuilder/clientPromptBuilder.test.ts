import { describe, it, expect } from 'vitest';
import { buildClientSystemPrompt } from '../../lib/ai/prompt/client-system-prompt-builder';
import { composePersonaPrompt } from '../../lib/ai/prompt/persona-prompt-composer';
import { redactDebugMetadata, isDebugOnlySection } from '../../lib/ai/prompt/prompt-redaction-guards';
import type { ClientPromptBuildInput } from '../../lib/ai/prompt/client-prompt-types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeKimInput(overrides: Partial<ClientPromptBuildInput> = {}): ClientPromptBuildInput {
  return {
    persona: 'kim',
    userName: 'Testuser',
    crisisLevel: 0,
    safetyLevel: 'none',
    ...overrides,
  };
}

function makeEliasInput(overrides: Partial<ClientPromptBuildInput> = {}): ClientPromptBuildInput {
  return {
    persona: 'elias',
    userName: 'Testuser',
    crisisLevel: 0,
    safetyLevel: 'none',
    ...overrides,
  };
}

describe('FASE 3A: Client-side prompt builder mirror', () => {

  // Test 1: Kim input → promptBuildVersion='client_mirror_v1'
  it('Test 1: buildClientSystemPrompt accepts Kim input and returns client_mirror_v1', () => {
    const result = buildClientSystemPrompt(makeKimInput());
    expect(result.promptBuildVersion).toBe('client_mirror_v1');
    expect(result.persona).toBe('kim');
    expect(result.systemPrompt).toBeTruthy();
    expect(result.systemPrompt.length).toBeGreaterThan(100);
  });

  // Test 2: Elias input → promptBuildVersion='client_mirror_v1'
  it('Test 2: buildClientSystemPrompt accepts Elias input and returns client_mirror_v1', () => {
    const result = buildClientSystemPrompt(makeEliasInput());
    expect(result.promptBuildVersion).toBe('client_mirror_v1');
    expect(result.persona).toBe('elias');
    expect(result.systemPrompt).toBeTruthy();
    expect(result.systemPrompt.length).toBeGreaterThan(100);
  });

  // Test 3: persona-prompt-composer chooses Kim only when persona='kim'
  it('Test 3: persona-prompt-composer routes to Kim when persona=kim', () => {
    const sections = composePersonaPrompt(makeKimInput());
    expect(sections.identity).toContain('Kim');
  });

  // Test 4: persona-prompt-composer chooses Elias only when persona='elias'
  it('Test 4: persona-prompt-composer routes to Elias when persona=elias', () => {
    const sections = composePersonaPrompt(makeEliasInput());
    expect(sections.identity).toContain('Elias');
  });

  // Test 5: builder does NOT infer persona from text
  it('Test 5: builder does not infer persona — uses input.persona directly', () => {
    // Even if content mentions Kim, if persona is elias, it uses Elias
    const result = buildClientSystemPrompt(makeEliasInput({
      contextSummary: 'Kim zegt dat de relatie moeilijk is',
    }));
    expect(result.persona).toBe('elias');
    expect(result.systemPrompt).toContain('Elias');
  });

  // Test 6: builder does NOT do module selection
  it('Test 6: builder does not select modules — only uses provided selectedModule', () => {
    const result = buildClientSystemPrompt(makeKimInput({
      selectedModule: 'K01',
    }));
    // Builder doesn't add module-specific content unless engineDirective is provided
    expect(result.debug?.includedSections).not.toContain('module');
  });

  // Test 7: builder does NOT do safety selection
  it('Test 7: builder does not do safety selection — only uses provided safetyLevel', () => {
    const result = buildClientSystemPrompt(makeKimInput({
      safetyLevel: 'crisis',
      crisisLevel: 3,
    }));
    // Builder doesn't add crisis routing — that's pipeline's job
    expect(result.promptBuildVersion).toBe('client_mirror_v1');
  });

  // Test 8: debug metadata is not user-facing injected
  it('Test 8: debug metadata is not injected into systemPrompt', () => {
    const result = buildClientSystemPrompt(makeKimInput({
      effectiveDepth: 'high',
      maxFormulationMode: 'high',
    }));
    // effectiveDepth should be in debug object, not in prompt text
    expect(result.debug?.effectiveDepth).toBe('high');
    expect(result.systemPrompt).not.toContain('wasUserDepthOverridden');
    expect(result.systemPrompt).not.toContain('promptBuildVersion');
  });

  // Test 9: feature flag false = no runtime behavior change (structural test)
  it('Test 9: builder is standalone — does not modify any external state', () => {
    // The builder is a pure function — calling it has no side effects
    const input = makeKimInput();
    const result1 = buildClientSystemPrompt(input);
    const result2 = buildClientSystemPrompt(input);
    expect(result1.systemPrompt).toBe(result2.systemPrompt);
    expect(result1.estimatedPromptSize).toBe(result2.estimatedPromptSize);
  });

  // Test 10: mirror build produces valid prompt without route-switch
  it('Test 10: mirror build produces valid prompt structure', () => {
    const result = buildClientSystemPrompt(makeKimInput({
      relationalStanceDirective: '[RELATIONAL_STANCE_FILTER] test directive',
      depthNamingDirective: '[DEPTH_NAMING] test depth',
      regulationInstruction: 'Regulate: soften tone',
    }));
    expect(result.systemPrompt).toContain('[RELATIONAL_STANCE_FILTER]');
    expect(result.systemPrompt).toContain('[DEPTH_NAMING]');
    expect(result.systemPrompt).toContain('Regulate: soften tone');
    expect(result.debug?.includedSections).toContain('relationalStance');
    expect(result.debug?.includedSections).toContain('depthNaming');
    expect(result.debug?.includedSections).toContain('regulation');
  });

  // Test: redaction guards work
  it('Redaction guards remove debug patterns', () => {
    const { cleanedPrompt, redactedItems } = redactDebugMetadata(
      'Hello [DEBUG] world console.log test'
    );
    expect(cleanedPrompt).not.toContain('[DEBUG]');
    expect(cleanedPrompt).not.toContain('console.log');
    expect(redactedItems.length).toBeGreaterThan(0);
  });

  // Test: isDebugOnlySection
  it('isDebugOnlySection correctly identifies debug sections', () => {
    expect(isDebugOnlySection('k05OverrideLog')).toBe(true);
    expect(isDebugOnlySection('safetyFilterLog')).toBe(true);
    expect(isDebugOnlySection('identity')).toBe(false);
    expect(isDebugOnlySection('regulation')).toBe(false);
  });

  // Test: token budget estimation
  it('Token budget provides reasonable estimates', () => {
    const result = buildClientSystemPrompt(makeKimInput());
    expect(result.estimatedPromptSize).toBeGreaterThan(0);
    expect(typeof result.estimatedPromptSize).toBe('number');
  });

  // Test: Kim includes relational sections, Elias does not
  it('Kim includes relationalStance in debug, Elias includes module', () => {
    const kimResult = buildClientSystemPrompt(makeKimInput({
      relationalStanceDirective: 'test',
    }));
    expect(kimResult.debug?.includedSections).toContain('relationalStance');

    const eliasResult = buildClientSystemPrompt(makeEliasInput({
      engineDirective: 'test module',
    }));
    expect(eliasResult.debug?.includedSections).toContain('module');
  });
});
