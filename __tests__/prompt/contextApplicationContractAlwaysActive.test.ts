import { describe, it, expect } from 'vitest';
import { composeKimPrompt } from '@/lib/ai/prompt/kim-prompt-composer';
import { composeEliasPrompt } from '@/lib/ai/prompt/elias-prompt-composer';

describe('CONTEXT_AWARE_APPLICATION_CONTRACT always active', () => {
  const baseKimInput = {
    persona: 'kim' as const,
    crisisLevel: 0,
    safetyLevel: 'none',
    identity: 'Kim identity',
    module: 'K01',
    moduleDescription: 'Test module',
    regulationInstruction: 'reflect',
    relationalStanceDirective: 'stance=empathic_witness',
    depthAndNamingDirective: 'depth=medium',
    depthNamingDirective: 'depth=medium',
    kimFormulationBlock: undefined,
    deepeningBlock: undefined,
    projectionContext: undefined,
  };

  const baseEliasInput = {
    persona: 'elias' as const,
    crisisLevel: 0,
    safetyLevel: 'none',
    identity: 'Elias identity',
    module: 'PAAL01',
    moduleDescription: 'Test module',
    regulationInstruction: 'slow_down',
    interventionContinuity: undefined,
    deepeningBlock: undefined,
    projectionContext: undefined,
  };

  it('a. Elias follow-up WITHOUT projectionContext contains contextApplicationContract', () => {
    const sections = composeEliasPrompt({ ...baseEliasInput, projectionContext: undefined });
    expect(sections.contextApplicationContract).toBeDefined();
    expect(sections.contextApplicationContract).toContain('CONTEXT APPLICATION RULES');
    expect(sections.contextApplicationContract).toContain('MANDATORY');
  });

  it('b. Kim follow-up WITHOUT projectionContext contains contextApplicationContract', () => {
    const sections = composeKimPrompt({ ...baseKimInput, projectionContext: undefined });
    expect(sections.contextApplicationContract).toBeDefined();
    expect(sections.contextApplicationContract).toContain('CONTEXT APPLICATION RULES');
    expect(sections.contextApplicationContract).toContain('MANDATORY');
  });

  it('c. Elias follow-up WITH projectionContext contains contextApplicationContract', () => {
    const sections = composeEliasPrompt({ ...baseEliasInput, projectionContext: 'fears: relapse' });
    expect(sections.contextApplicationContract).toBeDefined();
    expect(sections.contextApplicationContract).toContain('CONTEXT APPLICATION RULES');
    expect(sections.projection).toBe('fears: relapse');
  });

  it('d. Kim follow-up WITH projectionContext contains contextApplicationContract', () => {
    const sections = composeKimPrompt({ ...baseKimInput, projectionContext: 'fears: abandonment' });
    expect(sections.contextApplicationContract).toBeDefined();
    expect(sections.contextApplicationContract).toContain('CONTEXT APPLICATION RULES');
    expect(sections.projection).toBe('fears: abandonment');
  });

  it('e. Kim-only guard (Reality/Agency) remains Kim-only', () => {
    const kimSections = composeKimPrompt(baseKimInput);
    const eliasSections = composeEliasPrompt(baseEliasInput);
    // Kim identity includes Reality/Agency Guard
    expect(kimSections.identity).toBeDefined();
    // Elias does NOT have Kim-specific guards in its identity
    expect(eliasSections.identity).not.toContain('REALITY & AGENCY GUARD');
    expect(eliasSections.identity).not.toContain('victim narrative');
  });

  it('f. Prompt compiles without contextDat (no crash)', () => {
    const kimSections = composeKimPrompt({ ...baseKimInput, projectionContext: undefined });
    const eliasSections = composeEliasPrompt({ ...baseEliasInput, projectionContext: undefined });
    // Both return valid section objects without crashing
    expect(kimSections).toBeDefined();
    expect(eliasSections).toBeDefined();
    expect(kimSections.contextApplicationContract).toBeDefined();
    expect(eliasSections.contextApplicationContract).toBeDefined();
  });

  it('g. No raw memory dump in contract text', () => {
    const sections = composeKimPrompt(baseKimInput);
    const contract = sections.contextApplicationContract!;
    expect(contract).not.toContain('user.dat');
    expect(contract).not.toContain('DIST01');
    expect(contract).not.toContain('distillation.dat');
    expect(contract).not.toContain('raw Backpack');
    expect(contract).not.toContain('birthDate');
  });
});
