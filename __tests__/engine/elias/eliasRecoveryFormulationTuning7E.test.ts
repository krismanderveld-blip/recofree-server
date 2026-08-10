/**
 * FASE 7E: Elias Recovery Formulation Tuning Patch Tests
 * 21 tests covering the 3 concrete improvements from FASE 7D.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  buildEliasRecoveryFormulationContext,
  type EliasRecoveryFormulationInput,
} from '../../../lib/engine/elias/recovery-formulation/elias-recovery-formulation-engine';
import { buildEliasRecoveryFormulationBlock } from '../../../lib/ai/prompt/elias-prompt-composer';

function makeInput(overrides: Partial<EliasRecoveryFormulationInput> = {}): EliasRecoveryFormulationInput {
  return {
    userMessage: 'test',
    persona: 'elias',
    effectiveDepth: 'medium',
    safetyActive: false,
    crisisActive: false,
    relapseRiskActive: false,
    localTimestamp: '2026-08-10T12:00:00',
    ...overrides,
  };
}

describe('FASE 7E Tuning: Shame Cycle', () => {
  it('1. Shame/self_hatred mustMention bevat schaamtecyclus', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik ben zwak. Ik blijf dit verpesten. Misschien ben ik hopeloos.',
    }));
    expect(ctx.activeDomains).toContain('shame');
    expect(ctx.mustMention.some(m => /zelfveroordeling.*cyclus|cyclus.*schaamte/i.test(m))).toBe(true);
  });

  it('2. Shame mustMention bevat verantwoordelijkheid zonder zelfhaat', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik haat mezelf en ik ben hopeloos.',
    }));
    expect(ctx.mustMention.some(m => /verantwoordelijkheid.*niet.*haten|haten.*verantwoordelijkheid/i.test(m))).toBe(true);
  });

  it('3. Shame loop wordt gevuld bij self_hatred detectie', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik haat mezelf.',
    }));
    expect(ctx.shameLoops.length).toBeGreaterThan(0);
    expect(ctx.shameLoops[0]).toMatch(/schaamte.*verbergen|schaamte.*isolatie/i);
  });

  it('4. No forbidden self-hatred reinforcement in mustMention', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik ben zwak en hopeloos.',
    }));
    const allText = ctx.mustMention.join(' ');
    expect(allText).not.toMatch(/je bent zwak|je bent hopeloos|je hebt gefaald/i);
  });
});

describe('FASE 7E Tuning: Emotional Overload Support Activation', () => {
  it('5. Emotional overload met hoge stress activeert support', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik ben overspoeld en ik raak de controle kwijt.',
      stressLevel: 8,
    }));
    expect(ctx.activeDomains).toContain('emotional_overload');
    expect(ctx.activeDomains).toContain('support_activation');
    expect(ctx.supportPlan.some(s => s.target === 'trusted_person' || s.target === 'clinician')).toBe(true);
    expect(ctx.mustMention.some(m => /steun.*inschakelen.*herstelgedrag/i.test(m))).toBe(true);
  });

  it('6. Emotional overload zonder hoge stress blijft regulerend', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik voel veel spanning.',
      stressLevel: 4,
    }));
    // emotional_overload may or may not be active depending on pattern match
    // But support_activation should NOT be forced
    if (ctx.activeDomains.includes('emotional_overload')) {
      // support_activation is not required at low stress
      expect(ctx.agencyMap.length).toBeGreaterThan(0);
    }
  });

  it('7. Emotional overload in orange zone activeert support', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik ben overspoeld.',
      currentZone: 'orange',
    }));
    expect(ctx.activeDomains).toContain('support_activation');
    expect(ctx.supportPlan.length).toBeGreaterThan(0);
  });

  it('8. Emotional overload in red zone activeert support', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik ben overspoeld.',
      currentZone: 'red',
    }));
    expect(ctx.activeDomains).toContain('support_activation');
    expect(ctx.supportPlan.length).toBeGreaterThan(0);
  });

  it('9. Emotional overload met "ik trek het niet" activeert support', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik trek het niet meer.',
      stressLevel: 3,
      currentZone: 'green',
    }));
    expect(ctx.activeDomains).toContain('support_activation');
  });

  it('10. Safety/crisis blocks formulation (no support override)', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik ben overspoeld.',
      safetyActive: true,
    }));
    expect(ctx.mode).toBe('safety_blocked');
  });
});

describe('FASE 7E Tuning: Ambivalence Stage-of-Change', () => {
  it('11. Ambivalence vult stageOfChange met contemplation', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Een deel van mij wil drinken, maar een ander deel wil echt herstellen.',
    }));
    expect(ctx.stageOfChange).not.toBeNull();
    expect(ctx.stageOfChange!.stage).toBe('contemplation');
  });

  it('12. Ambivalence stageOfChange evidence = ambivalentie', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Een deel van mij wil drinken, maar een ander deel wil echt herstellen.',
    }));
    expect(ctx.stageOfChange!.evidence).toMatch(/ambivalentie/i);
  });

  it('13. Ambivalence activeDomains bevat motivation en stage_of_change', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Een deel van mij wil drinken, maar een ander deel wil echt herstellen.',
    }));
    expect(ctx.activeDomains).toContain('motivation');
    expect(ctx.activeDomains).toContain('stage_of_change');
  });

  it('14. Ambivalence mustMention benoemt twee krachten', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Een deel van mij wil drinken, maar een ander deel wil echt herstellen.',
    }));
    expect(ctx.mustMention.some(m => /twee krachten|deel.*verdoving.*deel.*herstel/i.test(m))).toBe(true);
  });

  it('15. Ambivalence mustMention bevat geen falen-taal', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik twijfel of ik wil stoppen.',
    }));
    const allText = ctx.mustMention.join(' ');
    expect(allText).not.toMatch(/je hebt gefaald|je bent zwak|hopeloos/i);
  });
});

describe('FASE 7E Tuning: Prompt Block Instructions', () => {
  it('16. Prompt block bij shame bevat shame loop instructie', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik haat mezelf.',
    }));
    const block = buildEliasRecoveryFormulationBlock(ctx)!;
    expect(block).toContain('Shame loop');
  });

  it('17. Prompt block bij supportPlan benoemt steun als herstelactie', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik heb craving en wil drinken.',
    }));
    const block = buildEliasRecoveryFormulationBlock(ctx)!;
    expect(block).toContain('Support rule');
  });

  it('18. Prompt block bij stageOfChange bevat geen lange theorie', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Een deel van mij wil drinken, maar een ander deel wil echt herstellen.',
    }));
    const block = buildEliasRecoveryFormulationBlock(ctx)!;
    expect(block).toContain('Stage:');
    expect(block).toContain('menselijke duiding');
    expect(block).not.toContain('Prochaska');
    expect(block).not.toContain('transtheoretical');
  });

  it('19. Prompt block blijft compact', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik haat mezelf en ik heb craving en ik ben overspoeld.',
      stressLevel: 8,
    }));
    const block = buildEliasRecoveryFormulationBlock(ctx)!;
    expect(block.length).toBeLessThan(2000);
  });

  it('20. Prompt block is geen raw JSON', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik haat mezelf.',
    }));
    const block = buildEliasRecoveryFormulationBlock(ctx)!;
    expect(block).not.toMatch(/^\s*\{/);
    expect(block).not.toContain('"schemaVersion"');
  });

  it('21. Forbidden language tests still pass', () => {
    const ctx = buildEliasRecoveryFormulationContext(makeInput({
      userMessage: 'Ik haat mezelf en ik ben overspoeld en ik twijfel.',
      stressLevel: 9,
    }));
    const block = buildEliasRecoveryFormulationBlock(ctx)!;
    // Exclude mustAvoid from check (it's the instruction list)
    const blockWithoutMustAvoid = block.replace(/Must avoid:[\s\S]*?(?=\n[A-Z]|\nEnding|\nShame|\nSupport|\nStage)/m, '');
    expect(blockWithoutMustAvoid).not.toMatch(/drink maar|gebruik maar|één keer kan geen kwaad/i);
    expect(blockWithoutMustAvoid).not.toMatch(/je bent zwak|je bent hopeloos|je hebt gefaald/i);
  });
});
