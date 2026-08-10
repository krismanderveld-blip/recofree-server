import { describe, it, expect } from 'vitest';
import { resolveGuidanceDepth, type GuidanceDepthInput } from '../../lib/engine/shared/guidance-depth-resolver';
import { detectRelationalSignals } from '../../lib/engine/kim/relational-stance-filter';

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<GuidanceDepthInput> = {}): GuidanceDepthInput {
  return {
    persona: 'kim',
    userGuidanceDepth: 'normal',
    zone: 'green',
    crisisLevel: 0,
    safetyFirstActive: false,
    relationalHarmPatternActive: false,
    relapseRiskActive: false,
    explicitDeepRequest: false,
    contextQuality: 'sufficient',
    ...overrides,
  };
}

describe('FASE 2B: Dynamic relationalHarmPatternActive', () => {

  // ─── Test 1: Kim input with repeated betrayal/lying/damage, guidanceDepth=light, no safety ──
  it('Test 1: repeated betrayal + guidanceDepth=light → harm active, effectiveDepth minimum medium', () => {
    const message = 'hij heeft me opnieuw bedrogen, dit is niet de eerste keer, telkens opnieuw hetzelfde';
    const signals = detectRelationalSignals(message);
    expect(signals.relationalHarmPatternSignal).toBe(true);

    const result = resolveGuidanceDepth(makeInput({
      userGuidanceDepth: 'light',
      relationalHarmPatternActive: signals.relationalHarmPatternSignal,
    }));
    expect(result.effectiveDepth).toBe('medium');
    expect(result.reason).toContain('harm_requires_minimum_depth');
    expect(result.wasUserDepthOverridden).toBe(true);
  });

  it('Test 1b: chronic trust damage + guidanceDepth=light → harm active, minimum medium', () => {
    const message = 'ik vertrouw niets meer, het vertrouwen is kapot na al die leugens';
    const signals = detectRelationalSignals(message);
    expect(signals.relationalHarmPatternSignal).toBe(true);

    const result = resolveGuidanceDepth(makeInput({
      userGuidanceDepth: 'light',
      relationalHarmPatternActive: signals.relationalHarmPatternSignal,
    }));
    expect(result.effectiveDepth).toBe('medium');
    expect(result.reason).toContain('harm_requires_minimum_depth');
  });

  it('Test 1c: repeated boundary violation → harm active', () => {
    const message = 'hij gaat telkens over mijn grens, respecteert mijn grens niet';
    const signals = detectRelationalSignals(message);
    expect(signals.relationalHarmPatternSignal).toBe(true);
    expect(signals.repeatedBoundaryViolationSignal).toBe(true);
  });

  // ─── Test 2: Normal relational tension without harm, guidanceDepth=light ──
  it('Test 2: normal tension without harm → harm NOT active, effectiveDepth=low', () => {
    const message = 'we hadden een conflict gisteren over het huishouden';
    const signals = detectRelationalSignals(message);
    expect(signals.relationalHarmPatternSignal).toBe(false);

    const result = resolveGuidanceDepth(makeInput({
      userGuidanceDepth: 'light',
      relationalHarmPatternActive: signals.relationalHarmPatternSignal,
    }));
    expect(result.effectiveDepth).toBe('low');
    expect(result.reason).toBe('default_mapping');
  });

  // ─── Test 3: Harm + safetyFirstActive=true → safety wins ──
  it('Test 3: harm + safety → safety wins, effectiveDepth=safety', () => {
    const message = 'hij heeft me opnieuw bedrogen en ik wil niet meer leven';
    const signals = detectRelationalSignals(message);
    expect(signals.relationalHarmPatternSignal).toBe(true);

    const result = resolveGuidanceDepth(makeInput({
      userGuidanceDepth: 'deep',
      relationalHarmPatternActive: signals.relationalHarmPatternSignal,
      safetyFirstActive: true,
    }));
    expect(result.effectiveDepth).toBe('safety');
    expect(result.maxFormulationMode).toBe('none');
    expect(result.reason).toBe('safety_first');
  });

  // ─── Test 4: Harm + zone=red → zone limits dominate ──
  it('Test 4: harm + zone=red → zone limits depth to low', () => {
    const message = 'telkens opnieuw leugens, het vertrouwen is kapot';
    const signals = detectRelationalSignals(message);
    expect(signals.relationalHarmPatternSignal).toBe(true);

    const result = resolveGuidanceDepth(makeInput({
      userGuidanceDepth: 'deep',
      relationalHarmPatternActive: signals.relationalHarmPatternSignal,
      zone: 'red',
    }));
    // Zone red forces low — zone limits are checked BEFORE harm rule
    expect(result.effectiveDepth).toBe('low');
    expect(result.reason).toBe('zone_limits_depth');
  });

  // ─── Test 5: Verify detectRelationalSignals correctly identifies patterns ──
  it('Test 5a: single conflict without repetition → no harm pattern', () => {
    const signals = detectRelationalSignals('hij was boos op mij gisteren');
    expect(signals.relationalHarmPatternSignal).toBe(false);
    expect(signals.relationshipConflictSignal).toBe(true);
  });

  it('Test 5b: conflict with repetition marker → harm pattern active', () => {
    const signals = detectRelationalSignals('hij is boos op mij, telkens opnieuw hetzelfde conflict');
    expect(signals.relationalHarmPatternSignal).toBe(true);
  });

  it('Test 5c: keeps lying → harm pattern active', () => {
    const signals = detectRelationalSignals('hij blijft liegen, steeds opnieuw leugens');
    expect(signals.relationalHarmPatternSignal).toBe(true);
    expect(signals.repeatedBetrayalSignal).toBe(true);
  });

  // ─── Test 6: Elias does NOT get Kim harm logic ──
  it('Test 6: Elias with relationalHarmPatternActive=true → default mapping (no Kim rule)', () => {
    const result = resolveGuidanceDepth(makeInput({
      persona: 'elias',
      userGuidanceDepth: 'light',
      relationalHarmPatternActive: true,
    }));
    expect(result.effectiveDepth).toBe('low');
    expect(result.reason).toBe('default_mapping');
  });
});
