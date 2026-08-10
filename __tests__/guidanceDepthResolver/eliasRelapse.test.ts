import { describe, it, expect } from 'vitest';
import { resolveGuidanceDepth, type GuidanceDepthInput } from '../../lib/engine/shared/guidance-depth-resolver';
import { detectEliasRelapseRisk } from '../../lib/engine/elias/elias-relapse-risk-helper';

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<GuidanceDepthInput> = {}): GuidanceDepthInput {
  return {
    persona: 'elias',
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

describe('FASE 2C: Elias relapseRiskActive dynamic detection', () => {

  // ─── Test 1: Explicit craving + guidanceDepth=light → minimum medium ──
  it('Test 1: "ik heb zware craving en wil drinken" → relapseRisk=true, minimum medium', () => {
    const risk = detectEliasRelapseRisk({
      userMessage: 'ik heb zware craving en wil drinken',
      persona: 'elias',
    });
    expect(risk.relapseRiskActive).toBe(true);

    const result = resolveGuidanceDepth(makeInput({
      userGuidanceDepth: 'light',
      relapseRiskActive: risk.relapseRiskActive,
    }));
    expect(result.effectiveDepth).toBe('medium');
    expect(result.reason).toContain('relapse_requires_minimum_depth');
  });

  // ─── Test 2: Past reflection without current urge → no risk ──
  it('Test 2: past reflection "ik denk terug aan mijn vorige herval" → relapseRisk=false', () => {
    const risk = detectEliasRelapseRisk({
      userMessage: 'ik denk terug aan mijn vorige terugval, waarom gebeurde dat?',
      persona: 'elias',
    });
    expect(risk.relapseRiskActive).toBe(false);
    expect(risk.reason).toBe('past_reflection_no_active_craving');
  });

  // ─── Test 3: "ik ga straks drinken" → relapseRisk=true ──
  it('Test 3: "ik ga straks drinken" → relapseRisk=true, minimum medium', () => {
    const risk = detectEliasRelapseRisk({
      userMessage: 'ik ga straks drinken, ik kan het niet meer laten',
      persona: 'elias',
    });
    expect(risk.relapseRiskActive).toBe(true);

    const result = resolveGuidanceDepth(makeInput({
      userGuidanceDepth: 'light',
      relapseRiskActive: risk.relapseRiskActive,
    }));
    expect(result.effectiveDepth).toBe('medium');
  });

  // ─── Test 4: Crisis + relapse → safety wins ──
  it('Test 4: crisis + relapse → safety wins', () => {
    const risk = detectEliasRelapseRisk({
      userMessage: 'ik wil drinken en ik wil niet meer leven',
      persona: 'elias',
    });
    expect(risk.relapseRiskActive).toBe(true);

    const result = resolveGuidanceDepth(makeInput({
      userGuidanceDepth: 'deep',
      relapseRiskActive: risk.relapseRiskActive,
      safetyFirstActive: true,
    }));
    expect(result.effectiveDepth).toBe('safety');
    expect(result.maxFormulationMode).toBe('none');
  });

  // ─── Test 5: Zone red + relapse → zone limits depth ──
  it('Test 5: zone=red + relapse → zone limits to low', () => {
    const risk = detectEliasRelapseRisk({
      userMessage: 'ik heb zware craving',
      persona: 'elias',
    });
    expect(risk.relapseRiskActive).toBe(true);

    const result = resolveGuidanceDepth(makeInput({
      userGuidanceDepth: 'deep',
      relapseRiskActive: risk.relapseRiskActive,
      zone: 'red',
    }));
    expect(result.effectiveDepth).toBe('low');
    expect(result.reason).toBe('zone_limits_depth');
  });

  // ─── Test 6: Kim with relational damage → Kim harm logic, not Elias relapse ──
  it('Test 6: Kim persona → relapseRisk never active', () => {
    const risk = detectEliasRelapseRisk({
      userMessage: 'ik wil drinken',
      persona: 'kim',
    });
    expect(risk.relapseRiskActive).toBe(false);
    expect(risk.reason).toBe('not_elias');
  });

  // ─── Test 7: High craving slider → relapseRisk=true ──
  it('Test 7: high craving slider (8/10) → relapseRisk=true', () => {
    const risk = detectEliasRelapseRisk({
      userMessage: 'ik voel me niet goed vandaag',
      persona: 'elias',
      cravingSliderValue: 8,
    });
    expect(risk.relapseRiskActive).toBe(true);
    expect(risk.reason).toBe('high_craving_slider');
  });

  // ─── Test 8: relapseActive flag → relapseRisk=true ──
  it('Test 8: relapseActive flag set → relapseRisk=true', () => {
    const risk = detectEliasRelapseRisk({
      userMessage: 'hoe gaat het nu verder',
      persona: 'elias',
      relapseActive: true,
    });
    expect(risk.relapseRiskActive).toBe(true);
    expect(risk.reason).toBe('relapse_active_flag');
  });

  // ─── Test 9: relapseIntentDetected from signal engine → relapseRisk=true ──
  it('Test 9: relapseIntentDetected=true → relapseRisk=true', () => {
    const risk = detectEliasRelapseRisk({
      userMessage: 'iets anders',
      persona: 'elias',
      relapseIntentDetected: true,
    });
    expect(risk.relapseRiskActive).toBe(true);
    expect(risk.reason).toBe('relapse_intent_detected');
  });

  // ─── Test 10: General stress without substance signals → no risk ──
  it('Test 10: general stress without substance signals → no risk', () => {
    const risk = detectEliasRelapseRisk({
      userMessage: 'ik heb veel stress op het werk en slaap slecht',
      persona: 'elias',
    });
    expect(risk.relapseRiskActive).toBe(false);
    expect(risk.reason).toBe('no_relapse_risk_signals');
  });

  // ─── Test 11: English craving → detected ──
  it('Test 11: English "I need a drink" → relapseRisk=true', () => {
    const risk = detectEliasRelapseRisk({
      userMessage: 'I really need a drink right now',
      persona: 'elias',
    });
    expect(risk.relapseRiskActive).toBe(true);
  });
});
