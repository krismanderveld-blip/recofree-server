import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  createEmptyEliasRecoveryFormulationContext,
  validateEliasRecoveryFormulationContext,
  isEliasFormulationSafetyBlocked,
  isEliasFormulationAcuteRecoveryRisk,
  getEliasFormulationDepthLevel,
  getAllowedEliasFormulationLayers,
} from '@/lib/engine/elias/recovery-formulation';
import type { EliasRecoveryFormulationContext } from '@/lib/engine/elias/recovery-formulation';

function makeCtx(overrides: Partial<EliasRecoveryFormulationContext> = {}): EliasRecoveryFormulationContext {
  return { ...createEmptyEliasRecoveryFormulationContext(), createdAtLocal: new Date().toISOString(), ...overrides };
}

describe('Elias Recovery Formulation Contract — FASE 7A', () => {
  // 1
  it('empty context is valid', () => {
    const ctx = makeCtx();
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // 2
  it('schemaVersion must be exact', () => {
    const ctx = makeCtx();
    (ctx as any).schemaVersion = 'wrong_version';
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('schemaVersion'))).toBe(true);
  });

  // 3
  it('persona must be elias', () => {
    const ctx = makeCtx();
    (ctx as any).persona = 'kim';
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('persona'))).toBe(true);
  });

  // 4
  it('Kim contamination fails', () => {
    const ctx = makeCtx({ mustMention: ['caregiver grenzen respecteren'] });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('Kim contamination'))).toBe(true);
  });

  // 5
  it('invalid mode fails', () => {
    const ctx = makeCtx();
    (ctx as any).mode = 'turbo';
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('mode'))).toBe(true);
  });

  // 6
  it('invalid severity fails', () => {
    const ctx = makeCtx();
    (ctx as any).severity = 'mega_crisis';
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('severity'))).toBe(true);
  });

  // 7
  it('invalid domain fails', () => {
    const ctx = makeCtx({ activeDomains: ['fake_domain' as any] });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('domain'))).toBe(true);
  });

  // 8
  it('invalid layer fails', () => {
    const ctx = makeCtx({ activeLayers: ['fake_layer' as any] });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('layer'))).toBe(true);
  });

  // 9
  it('maxQuestions greater than 1 fails', () => {
    const ctx = makeCtx();
    (ctx as any).maxQuestions = 3;
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('maxQuestions'))).toBe(true);
  });

  // 10
  it('safety blocked detection works', () => {
    const ctx = makeCtx({ mode: 'safety_blocked', severity: 'acute_safety', activeDomains: ['safety'] });
    expect(isEliasFormulationSafetyBlocked(ctx)).toBe(true);
  });

  // 11
  it('acute recovery risk detection works', () => {
    const ctx = makeCtx({ mode: 'acute_recovery_risk', severity: 'active_craving', activeDomains: ['craving'] });
    expect(isEliasFormulationAcuteRecoveryRisk(ctx)).toBe(true);
  });

  // 12
  it('depth level mapping works', () => {
    expect(getEliasFormulationDepthLevel(makeCtx({ mode: 'off' }))).toBe('none');
    expect(getEliasFormulationDepthLevel(makeCtx({ mode: 'low' }))).toBe('low');
    expect(getEliasFormulationDepthLevel(makeCtx({ mode: 'medium' }))).toBe('medium');
    expect(getEliasFormulationDepthLevel(makeCtx({ mode: 'high' }))).toBe('high');
    expect(getEliasFormulationDepthLevel(makeCtx({ mode: 'acute_recovery_risk' }))).toBe('safety');
    expect(getEliasFormulationDepthLevel(makeCtx({ mode: 'safety_blocked' }))).toBe('none');
    expect(getEliasFormulationDepthLevel(makeCtx({ mode: 'insufficient_context' }))).toBe('none');
  });

  // 13
  it('allowed layers low works', () => {
    const layers = getAllowedEliasFormulationLayers('low');
    expect(layers).toContain('facts');
    expect(layers).toContain('recovery_severity');
    expect(layers).toContain('emotional_state');
    expect(layers).toContain('responsibility_map');
    expect(layers).toContain('agency_map');
    expect(layers).not.toContain('trigger_chain');
    expect(layers).not.toContain('safety_limits');
  });

  // 14
  it('allowed layers medium works', () => {
    const layers = getAllowedEliasFormulationLayers('medium');
    expect(layers).toContain('facts');
    expect(layers).toContain('trigger_chain');
    expect(layers).toContain('craving_function');
    expect(layers).toContain('avoidance_loop');
    expect(layers).toContain('shame_loop');
    expect(layers).toContain('stage_of_change');
    expect(layers).toContain('time_dynamics');
    expect(layers).not.toContain('safety_limits');
  });

  // 15
  it('allowed layers high works', () => {
    const layers = getAllowedEliasFormulationLayers('high');
    expect(layers).toContain('facts');
    expect(layers).toContain('core_hypothesis');
    expect(layers).toContain('post_relapse_repair');
    expect(layers).toContain('body_state');
    expect(layers).not.toContain('safety_limits');
  });

  // 16
  it('allowed layers acute_recovery_risk works', () => {
    const layers = getAllowedEliasFormulationLayers('acute_recovery_risk');
    expect(layers).toContain('facts');
    expect(layers).toContain('trigger_chain');
    expect(layers).toContain('craving_function');
    expect(layers).toContain('safety_limits');
    expect(layers).toContain('relapse_prevention_step');
    expect(layers).not.toContain('core_hypothesis');
  });

  // 17
  it('forbidden cold turkey approval fails', () => {
    const ctx = makeCtx({ mustMention: ['je kan gewoon stoppen met drinken'] });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('forbidden'))).toBe(true);
  });

  // 18
  it('permission to drink/use fails', () => {
    const ctx = makeCtx({ mustMention: ['drink maar een glas'] });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('forbidden'))).toBe(true);
  });

  // 19
  it('relapse minimization fails', () => {
    const ctx = makeCtx({ mustMention: ['terugval betekent dat herstel mislukt is'] });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('forbidden'))).toBe(true);
  });

  // 20
  it('self-hatred reinforcement fails', () => {
    const ctx = makeCtx({ mustMention: ['je bent zwak en hopeloos'] });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('forbidden'))).toBe(true);
  });

  // 21
  it('isolation advice fails', () => {
    const ctx = makeCtx({ mustMention: ['je moet dit alleen kunnen doen'] });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('forbidden'))).toBe(true);
  });

  // 22
  it('lying/secrecy advice fails', () => {
    const ctx = makeCtx({ mustMention: ['lieg erover tegen je partner'] });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('forbidden'))).toBe(true);
  });

  // 23
  it('recovery identity collapse fails', () => {
    const ctx = makeCtx({ mustMention: ['je bent je verslaving'] });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('forbidden'))).toBe(true);
  });

  // 24
  it('context accepts craving as signal not command', () => {
    const ctx = makeCtx({ mustMention: ['craving is een signaal, geen bevel'] });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(true);
  });

  // 25
  it('context accepts responsibility without self-hatred', () => {
    const ctx = makeCtx({ mustMention: ['verantwoordelijkheid zonder zelfhaat'] });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(true);
  });

  // 26
  it('context accepts relapse risk needs support', () => {
    const ctx = makeCtx({ mustMention: ['terugvalrisico vraagt vertraging en steun'] });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(true);
  });

  // 27
  it('context accepts medical guidance for heavy alcohol dependence', () => {
    const ctx = makeCtx({ mustMention: ['bij zware alcoholafhankelijkheid geen plots stoppen zonder medische begeleiding'] });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(true);
  });

  // 28
  it('cravingFunction explanationNotExcuse must be boolean', () => {
    const ctx = makeCtx({
      cravingFunctions: [{ id: 'cf1', cravingOrUse: 'alcohol', possibleFunction: 'stress dempen', explanationNotExcuse: 'yes' as any, confidence: 'medium' }],
    });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('explanationNotExcuse'))).toBe(true);
  });

  // 29
  it('responsibilityMap item requires owner', () => {
    const ctx = makeCtx({
      responsibilityMap: [{ id: 'rm1', owner: '' as any, responsibility: 'test', notResponsibleFor: [], confidence: 'medium' }],
    });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('owner'))).toBe(true);
  });

  // 30
  it('agencyMap item requires timeWindow', () => {
    const ctx = makeCtx({
      agencyMap: [{ id: 'am1', possibleAction: 'walk', timeWindow: '' as any, effortLevel: 'low', confidence: 'medium' }],
    });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('timeWindow'))).toBe(true);
  });

  // 31
  it('stageOfChange requires stage/evidence/confidence', () => {
    const ctx = makeCtx({
      stageOfChange: { stage: 'action', evidence: '', confidence: 'medium' },
    });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('stageOfChange'))).toBe(true);
  });

  // 32
  it('supportPlan item requires target/urgency', () => {
    const ctx = makeCtx({
      supportPlan: [{ id: 'sp1', action: 'call sponsor', target: '' as any, urgency: 'high', confidence: 'medium' }],
    });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('target'))).toBe(true);
  });

  // 33
  it('relapsePreventionStep requires purpose/urgency', () => {
    const ctx = makeCtx({
      relapsePreventionSteps: [{ id: 'rp1', step: 'call', purpose: '', urgency: 'high', confidence: 'medium' }],
    });
    const result = validateEliasRecoveryFormulationContext(ctx);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('purpose'))).toBe(true);
  });

  // 34
  it('no server imports', () => {
    const typesFile = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/elias/recovery-formulation/elias-recovery-formulation-types.ts'), 'utf-8');
    const contractFile = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/elias/recovery-formulation/elias-recovery-formulation-contract.ts'), 'utf-8');
    const importLines = [...typesFile.split('\n'), ...contractFile.split('\n')].filter(l => /^import/.test(l.trim()));
    const serverImports = importLines.filter(l => /server|@\/server/i.test(l));
    expect(serverImports).toHaveLength(0);
  });

  // 35
  it('no runtime side effects', () => {
    const contractFile = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/elias/recovery-formulation/elias-recovery-formulation-contract.ts'), 'utf-8');
    expect(contractFile).not.toMatch(/AsyncStorage/);
    expect(contractFile).not.toMatch(/fetch\(/);
    expect(contractFile).not.toMatch(/console\.(log|warn|error)/);
  });

  // 36
  it('no pipeline imports', () => {
    const contractFile = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/elias/recovery-formulation/elias-recovery-formulation-contract.ts'), 'utf-8');
    const typesFile = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/elias/recovery-formulation/elias-recovery-formulation-types.ts'), 'utf-8');
    const contractImportsP = contractFile.split('\n').filter(l => l.trim().startsWith('import')); expect(contractImportsP.filter(l => /pipeline/i.test(l))).toHaveLength(0);
    const typesImportsP = typesFile.split('\n').filter(l => l.trim().startsWith('import')); expect(typesImportsP.filter(l => /pipeline/i.test(l))).toHaveLength(0);
  });

  // 37
  it('no Kim imports', () => {
    const contractFile = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/elias/recovery-formulation/elias-recovery-formulation-contract.ts'), 'utf-8');
    const typesFile = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/elias/recovery-formulation/elias-recovery-formulation-types.ts'), 'utf-8');
    const contractImportsK = contractFile.split('\n').filter(l => l.trim().startsWith('import')); expect(contractImportsK.filter(l => /kim/i.test(l))).toHaveLength(0);
    const typesImportsK = typesFile.split('\n').filter(l => l.trim().startsWith('import')); expect(typesImportsK.filter(l => /kim/i.test(l))).toHaveLength(0);
  });
});
