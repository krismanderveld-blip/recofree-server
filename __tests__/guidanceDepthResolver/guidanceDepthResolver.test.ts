import { describe, it, expect } from 'vitest';
import { resolveGuidanceDepth, type GuidanceDepthInput } from '../../lib/engine/shared/guidance-depth-resolver';
import { detectDepthLevel } from '../../lib/engine/kim/depth-and-naming-layer';

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

// ─── Test 1: Kim, relational input, guidanceDepth=light ──────────────────────

describe('GuidanceDepthResolver', () => {
  it('Test 1: Kim guidanceDepth=light → effectiveDepth=low, no HIGH directive', () => {
    const result = resolveGuidanceDepth(makeInput({ userGuidanceDepth: 'light' }));
    expect(result.effectiveDepth).toBe('low');
    expect(result.maxFormulationMode).toBe('low');
    expect(result.wasUserDepthOverridden).toBe(false);

    // Depth layer should cap at LOW
    const depthLevel = detectDepthLevel('hij liegt constant en maakt alles kapot', 'none', false, true, result.effectiveDepth);
    expect(depthLevel).toBe('LOW');
  });

  // ─── Test 2: Kim, guidanceDepth=normal → effectiveDepth=medium ─────────────

  it('Test 2: Kim guidanceDepth=normal → effectiveDepth=medium', () => {
    const result = resolveGuidanceDepth(makeInput({ userGuidanceDepth: 'normal' }));
    expect(result.effectiveDepth).toBe('medium');
    expect(result.maxFormulationMode).toBe('medium');
  });

  // ─── Test 3: Kim, guidanceDepth=deep → effectiveDepth=high (safe zone, sufficient context) ─

  it('Test 3: Kim guidanceDepth=deep → effectiveDepth=high when zone safe and context sufficient', () => {
    const result = resolveGuidanceDepth(makeInput({ userGuidanceDepth: 'deep' }));
    expect(result.effectiveDepth).toBe('high');
    expect(result.maxFormulationMode).toBe('high');
  });

  // ─── Test 4: Kim, safetyFirstActive=true, guidanceDepth=deep → safety ──────

  it('Test 4: Kim safetyFirstActive=true → effectiveDepth=safety, formulation blocked', () => {
    const result = resolveGuidanceDepth(makeInput({ userGuidanceDepth: 'deep', safetyFirstActive: true }));
    expect(result.effectiveDepth).toBe('safety');
    expect(result.maxFormulationMode).toBe('none');
    expect(result.wasUserDepthOverridden).toBe(true);
    expect(result.reason).toBe('safety_first');
  });

  // ─── Test 5: Kim, zone=red, guidanceDepth=deep → low, overridden ───────────

  it('Test 5: Kim zone=red, guidanceDepth=deep → effectiveDepth=low, overridden', () => {
    const result = resolveGuidanceDepth(makeInput({ userGuidanceDepth: 'deep', zone: 'red' }));
    expect(result.effectiveDepth).toBe('low');
    expect(result.wasUserDepthOverridden).toBe(true);
    expect(result.reason).toBe('zone_limits_depth');
  });

  // ─── Test 6: Kim, relationalHarmPatternActive=true, guidanceDepth=light ────

  it('Test 6: Kim relationalHarmPatternActive=true, guidanceDepth=light → minimum medium', () => {
    const result = resolveGuidanceDepth(makeInput({
      userGuidanceDepth: 'light',
      relationalHarmPatternActive: true,
    }));
    expect(result.effectiveDepth).toBe('medium');
    expect(result.maxFormulationMode).toBe('medium');
    expect(result.wasUserDepthOverridden).toBe(true);
    expect(result.reason).toContain('harm_requires_minimum_depth');
  });

  // ─── Test 7: Elias, relapseRiskActive=true, guidanceDepth=light ────────────

  it('Test 7: Elias relapseRiskActive=true, guidanceDepth=light → minimum medium, no Kim logic', () => {
    const result = resolveGuidanceDepth(makeInput({
      persona: 'elias',
      userGuidanceDepth: 'light',
      relapseRiskActive: true,
    }));
    expect(result.effectiveDepth).toBe('medium');
    expect(result.maxFormulationMode).toBe('medium');
    expect(result.wasUserDepthOverridden).toBe(true);
    expect(result.reason).toContain('relapse_requires_minimum_depth');
  });

  // ─── Test 8: Context insufficient + deep → max low ─────────────────────────

  it('Test 8: contextQuality=insufficient, guidanceDepth=deep → max low', () => {
    const result = resolveGuidanceDepth(makeInput({
      userGuidanceDepth: 'deep',
      contextQuality: 'insufficient',
    }));
    expect(result.effectiveDepth).toBe('low');
    expect(result.maxFormulationMode).toBe('low');
    expect(result.reason).toBe('insufficient_context');
    expect(result.wasUserDepthOverridden).toBe(true);
  });

  // ─── Test 9: Existing Kim depth/naming detection still works ───────────────

  it('Test 9: detectDepthLevel still detects HIGH for betrayal keywords (no constraint)', () => {
    const level = detectDepthLevel('hij heeft me bedrogen en gelogen', 'none', false, true);
    expect(level).toBe('HIGH');
  });

  it('Test 9b: detectDepthLevel still detects MEDIUM for conflict keywords (no constraint)', () => {
    const level = detectDepthLevel('we hadden een conflict over grenzen', 'none', false, true);
    expect(level).toBe('MEDIUM');
  });

  it('Test 9c: detectDepthLevel still returns SKIP for non-Kim', () => {
    const level = detectDepthLevel('hij heeft me bedrogen', 'none', false, false);
    expect(level).toBe('SKIP');
  });

  // ─── Test: Orange zone caps at medium ──────────────────────────────────────

  it('Orange zone caps deep at medium', () => {
    const result = resolveGuidanceDepth(makeInput({ userGuidanceDepth: 'deep', zone: 'orange' }));
    expect(result.effectiveDepth).toBe('medium');
    expect(result.wasUserDepthOverridden).toBe(true);
    expect(result.reason).toBe('orange_max_medium');
  });

  // ─── Test: Purple zone forces low ──────────────────────────────────────────

  it('Purple zone forces low regardless of user setting', () => {
    const result = resolveGuidanceDepth(makeInput({ userGuidanceDepth: 'deep', zone: 'purple' }));
    expect(result.effectiveDepth).toBe('low');
    expect(result.wasUserDepthOverridden).toBe(true);
  });

  // ─── Test: Explicit deep request elevates ──────────────────────────────────

  it('Explicit deep request elevates to high when context sufficient', () => {
    const result = resolveGuidanceDepth(makeInput({
      userGuidanceDepth: 'normal',
      explicitDeepRequest: true,
      contextQuality: 'rich',
    }));
    expect(result.effectiveDepth).toBe('high');
    expect(result.reason).toBe('explicit_deep_request');
  });

  // ─── Test: Crisis level 2+ triggers safety ─────────────────────────────────

  it('CrisisLevel >= 2 triggers safety regardless of other settings', () => {
    const result = resolveGuidanceDepth(makeInput({ crisisLevel: 3, userGuidanceDepth: 'deep' }));
    expect(result.effectiveDepth).toBe('safety');
    expect(result.maxFormulationMode).toBe('none');
  });

  // ─── Test: Elias does NOT get Kim relational harm logic ────────────────────

  it('Elias with relationalHarmPatternActive does NOT get minimum medium (Kim-only rule)', () => {
    const result = resolveGuidanceDepth(makeInput({
      persona: 'elias',
      userGuidanceDepth: 'light',
      relationalHarmPatternActive: true,
    }));
    // Elias should use default mapping: light → low
    expect(result.effectiveDepth).toBe('low');
    expect(result.reason).toBe('default_mapping');
  });

  // ─── Test: Kim does NOT get Elias relapse logic ────────────────────────────

  it('Kim with relapseRiskActive does NOT get minimum medium (Elias-only rule)', () => {
    const result = resolveGuidanceDepth(makeInput({
      persona: 'kim',
      userGuidanceDepth: 'light',
      relapseRiskActive: true,
    }));
    // Kim should use default mapping: light → low
    expect(result.effectiveDepth).toBe('low');
    expect(result.reason).toBe('default_mapping');
  });
});
