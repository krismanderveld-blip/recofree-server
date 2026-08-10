import { describe, it, expect } from 'vitest';
import {
  createEmptyKimRelationalFormulationContext,
  validateKimRelationalFormulationContext,
  isKimFormulationSafetyBlocked,
  getKimFormulationDepthLevel,
  getAllowedKimFormulationLayers,
} from '@/lib/engine/kim/relational-formulation';
import type { KimRelationalFormulationContext } from '@/lib/engine/kim/relational-formulation';

describe('FASE 6A: Kim Relational Formulation Contract', () => {
  // 1. empty context is geldig
  it('1. empty context is valid', () => {
    const ctx = createEmptyKimRelationalFormulationContext();
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // 2. schemaVersion moet exact zijn
  it('2. schemaVersion must be exact', () => {
    const ctx = { ...createEmptyKimRelationalFormulationContext(), schemaVersion: 'wrong' };
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('schemaVersion'))).toBe(true);
  });

  // 3. persona moet kim zijn
  it('3. persona must be kim', () => {
    const ctx = { ...createEmptyKimRelationalFormulationContext(), persona: 'wrong' };
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('persona'))).toBe(true);
  });

  // 4. Elias contamination faalt
  it('4. Elias contamination fails', () => {
    const ctx = { ...createEmptyKimRelationalFormulationContext(), persona: 'elias' };
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('Elias contamination'))).toBe(true);
  });

  // 5. invalid mode faalt
  it('5. invalid mode fails', () => {
    const ctx = { ...createEmptyKimRelationalFormulationContext(), mode: 'extreme' };
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('mode'))).toBe(true);
  });

  // 6. invalid severity faalt
  it('6. invalid severity fails', () => {
    const ctx = { ...createEmptyKimRelationalFormulationContext(), severity: 'mega_bad' };
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('severity'))).toBe(true);
  });

  // 7. invalid domain faalt
  it('7. invalid domain fails', () => {
    const ctx = { ...createEmptyKimRelationalFormulationContext(), activeDomains: ['money'] };
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('invalid domain'))).toBe(true);
  });

  // 8. invalid layer faalt
  it('8. invalid layer fails', () => {
    const ctx = { ...createEmptyKimRelationalFormulationContext(), activeLayers: ['magic'] };
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('invalid layer'))).toBe(true);
  });

  // 9. maxQuestions groter dan 1 faalt
  it('9. maxQuestions > 1 fails', () => {
    const ctx = { ...createEmptyKimRelationalFormulationContext(), maxQuestions: 3 };
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('maxQuestions'))).toBe(true);
  });

  // 10. safety blocked detectie werkt
  it('10. safety blocked detection works', () => {
    const ctx = createEmptyKimRelationalFormulationContext();
    ctx.mode = 'safety_blocked';
    expect(isKimFormulationSafetyBlocked(ctx)).toBe(true);

    const ctx2 = createEmptyKimRelationalFormulationContext();
    ctx2.severity = 'acute_safety';
    expect(isKimFormulationSafetyBlocked(ctx2)).toBe(true);

    const ctx3 = createEmptyKimRelationalFormulationContext();
    ctx3.activeDomains = ['safety'];
    expect(isKimFormulationSafetyBlocked(ctx3)).toBe(true);

    const ctx4 = createEmptyKimRelationalFormulationContext();
    expect(isKimFormulationSafetyBlocked(ctx4)).toBe(false);
  });

  // 11. depth level mapping werkt
  it('11. depth level mapping works', () => {
    const ctx = createEmptyKimRelationalFormulationContext();
    ctx.mode = 'off';
    expect(getKimFormulationDepthLevel(ctx)).toBe('none');
    ctx.mode = 'safety_blocked';
    expect(getKimFormulationDepthLevel(ctx)).toBe('none');
    ctx.mode = 'insufficient_context';
    expect(getKimFormulationDepthLevel(ctx)).toBe('none');
    ctx.mode = 'low';
    expect(getKimFormulationDepthLevel(ctx)).toBe('low');
    ctx.mode = 'medium';
    expect(getKimFormulationDepthLevel(ctx)).toBe('medium');
    ctx.mode = 'high';
    expect(getKimFormulationDepthLevel(ctx)).toBe('high');
  });

  // 12. allowed layers low werkt
  it('12. allowed layers low works', () => {
    const layers = getAllowedKimFormulationLayers('low');
    expect(layers).toContain('facts');
    expect(layers).toContain('pattern_severity');
    expect(layers).toContain('caregiver_impact');
    expect(layers).toContain('responsibility_map');
    expect(layers).toHaveLength(4);
  });

  // 13. allowed layers medium werkt
  it('13. allowed layers medium works', () => {
    const layers = getAllowedKimFormulationLayers('medium');
    expect(layers).toContain('facts');
    expect(layers).toContain('dependent_hypotheses');
    expect(layers).toContain('causal_chain');
    expect(layers).toContain('feedback_loop');
    expect(layers).toContain('domain_separation');
    expect(layers).toContain('repair_conditions');
    expect(layers).toHaveLength(10);
  });

  // 14. allowed layers high werkt
  it('14. allowed layers high works', () => {
    const layers = getAllowedKimFormulationLayers('high');
    expect(layers).toContain('facts');
    expect(layers).toContain('behavior_functions');
    expect(layers).toContain('role_shift');
    expect(layers).toContain('counter_hypotheses');
    expect(layers).toContain('core_hypothesis');
    expect(layers).not.toContain('safety_limits');
    // With safety active
    const layersSafety = getAllowedKimFormulationLayers('high', true);
    expect(layersSafety).toContain('safety_limits');
  });

  // 15. forbidden decision language in mustMention faalt
  it('15. forbidden decision language in mustMention fails', () => {
    const ctx = { ...createEmptyKimRelationalFormulationContext(), mustMention: ['je moet weggaan'] };
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('forbidden language'))).toBe(true);
  });

  // 16. forbidden diagnostic language faalt
  it('16. forbidden diagnostic language fails', () => {
    const ctx = { ...createEmptyKimRelationalFormulationContext(), mustMention: ['hij is narcistisch'] };
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(false);
  });

  // 17. forced forgiveness faalt
  it('17. forced forgiveness fails', () => {
    const ctx = { ...createEmptyKimRelationalFormulationContext(), coreHypothesis: 'vergeef hem' };
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('coreHypothesis'))).toBe(true);
  });

  // 18. sexual pressure language faalt
  it('18. sexual pressure language fails', () => {
    const ctx = { ...createEmptyKimRelationalFormulationContext(), mustMention: ['seks hoort erbij'] };
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(false);
  });

  // 19. child trust overreach faalt
  it('19. child trust overreach fails', () => {
    const ctx = { ...createEmptyKimRelationalFormulationContext(), mustMention: ['kinderen moeten hem opnieuw vertrouwen'] };
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(false);
  });

  // 20. responsibility overreach faalt
  it('20. responsibility overreach fails', () => {
    const ctx = { ...createEmptyKimRelationalFormulationContext(), mustMention: ['jij bent verantwoordelijk voor zijn herstel'] };
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(false);
  });

  // 21. repair condition object vereist owner
  it('21. repair condition requires owner field', () => {
    const ctx = createEmptyKimRelationalFormulationContext();
    ctx.repairConditions = [{
      id: 'rc1',
      condition: 'eerlijkheid over gebruik',
      owner: 'dependent_person',
      nonNegotiable: true,
      confidence: 'high',
    }];
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(true);
  });

  // 22. domain separation object vereist mustMention boolean
  it('22. domain separation requires mustMention boolean', () => {
    const ctx = createEmptyKimRelationalFormulationContext();
    ctx.domainSeparations = [{
      id: 'ds1',
      domainA: 'trust',
      domainB: 'affection',
      distinction: 'Vertrouwen is niet hetzelfde als affectie.',
      mustMention: true,
    }];
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(true);
  });

  // 23. explanationNotExcuse moet boolean zijn
  it('23. explanationNotExcuse must be boolean', () => {
    const ctx = createEmptyKimRelationalFormulationContext();
    ctx.behaviorFunctions = [{
      id: 'bf1',
      behavior: 'liegen over gebruik',
      possibleFunction: 'schaamte vermijden',
      explanationNotExcuse: true,
      owner: 'dependent_person',
      confidence: 'medium',
    }];
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(true);
    expect(ctx.behaviorFunctions[0].explanationNotExcuse).toBe(true);
  });

  // 24. context accepteert repeated_pattern trust damage
  it('24. accepts repeated_pattern trust damage', () => {
    const ctx = createEmptyKimRelationalFormulationContext();
    ctx.mode = 'medium';
    ctx.severity = 'repeated_pattern';
    ctx.activeDomains = ['trust', 'honesty'];
    ctx.activeLayers = ['facts', 'pattern_severity', 'caregiver_impact'];
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(true);
  });

  // 25. context accepteert affection/intimacy separation
  it('25. accepts affection/intimacy domain separation', () => {
    const ctx = createEmptyKimRelationalFormulationContext();
    ctx.mode = 'high';
    ctx.activeDomains = ['affection', 'intimacy'];
    ctx.domainSeparations = [{
      id: 'ds-ai',
      domainA: 'affection',
      domainB: 'intimacy',
      distinction: 'Affectie is niet hetzelfde als seksuele intimiteit.',
      mustMention: true,
    }];
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(true);
  });

  // 26. context accepteert child_trust als apart domein
  it('26. accepts child_trust as separate domain', () => {
    const ctx = createEmptyKimRelationalFormulationContext();
    ctx.activeDomains = ['child_trust'];
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(true);
  });

  // 27. context accepteert self_loss zonder contactbreuk te forceren
  it('27. accepts self_loss without forcing contact break', () => {
    const ctx = createEmptyKimRelationalFormulationContext();
    ctx.mode = 'medium';
    ctx.activeDomains = ['self_loss'];
    ctx.mustMention = ['eigen regie terugnemen kan de verbinding juist gezonder maken'];
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(true);
  });

  // 28. context accepteert repair_conditions zonder vergeving te forceren
  it('28. accepts repair_conditions without forcing forgiveness', () => {
    const ctx = createEmptyKimRelationalFormulationContext();
    ctx.repairConditions = [{
      id: 'rc-trust',
      condition: 'consistente eerlijkheid over langere periode',
      owner: 'dependent_person',
      nonNegotiable: true,
      confidence: 'high',
    }];
    const result = validateKimRelationalFormulationContext(ctx);
    expect(result.ok).toBe(true);
  });

  // 29. no server imports
  it('29. no server imports in contract file', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      '/home/ubuntu/recofree-app/lib/engine/kim/relational-formulation/kim-relational-formulation-contract.ts',
      'utf-8'
    );
    expect(source).not.toMatch(/from ['"]@\/server/);
    expect(source).not.toMatch(/from ['"]\.\.\/\.\.\/\.\.\/server/);
    expect(source).not.toMatch(/invokeLLM/);
    expect(source).not.toMatch(/fetch\(/);
  });

  // 30. no runtime side effects
  it('30. no runtime side effects in contract file', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      '/home/ubuntu/recofree-app/lib/engine/kim/relational-formulation/kim-relational-formulation-contract.ts',
      'utf-8'
    );
    expect(source).not.toMatch(/AsyncStorage/);
    expect(source).not.toMatch(/SecureStore/);
    expect(source).not.toMatch(/console\.(log|warn|error)/);
    expect(source).not.toMatch(/addEventListener/);
    expect(source).not.toMatch(/setTimeout|setInterval/);
  });
});

