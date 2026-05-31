/**
 * Edge case tests for recommendedModel logic in Elias and Kim decision layers.
 *
 * Verifies boundary conditions:
 * - Elias: riskScore=6 → gpt-4o-mini, riskScore=7 → gpt-4o
 * - Elias: vspLevel=GEEL → gpt-4o-mini, vspLevel=ORANJE → gpt-4o
 * - Kim: eigenRegie=31 → gpt-4o-mini, eigenRegie=30 → gpt-4o
 * - Kim: riskScore=6 → gpt-4o-mini, riskScore=7 → gpt-4o
 */
import { describe, it, expect } from 'vitest';
import { createEliasDecision, type EliasDecisionInput } from '../lib/engine/elias/decision-layer';
import { createKimDecision, type KimDecisionInput } from '../lib/engine/kim/decision-layer';
import type { VspLevel } from '../lib/engine/elias/vsp';

// ─── Helpers ───────────────────────────────────────────────────

function makeEliasInput(overrides: {
  riskScore?: number;
  vspInput?: VspLevel | null;
  hasBackpackContent?: boolean;
}): EliasDecisionInput {
  return {
    analysis: {
      riskLevel: 'low' as any,
      emotionalState: 'stable',
      moodTrend: 'stable' as any,
      activeTriggers: [],
      triggerContextActive: false,
      patternAccumulation: 0,
      tone: 'warm' as any,
      pacing: 'normal' as any,
      suggestionIntensity: 5,
      crisisMonitoring: false,
      crisisThresholdLowered: false,
      priorityModules: [],
      stateSummary: 'test',
    },
    dominantState: {
      dominantModule: 'relational',
      dominantTrigger: '',
      dominantDirection: 'stabilize',
      dominantTone: 'warm',
      selectionReason: 'test',
      sourceLayer: 'default',
      riskScore: overrides.riskScore ?? 3,
    },
    crisis: {
      level: 0,
      triggers: [],
      recommendedAction: 'none',
    },
    stageOfChange: 'contemplation' as any,
    moodSliders: { craving: 30, frustration: 30, despondency: 30, focus: 70 } as any,
    currentZoneColor: 'GREEN',
    currentZoneScore: 20,
    vspInput: overrides.vspInput !== undefined ? overrides.vspInput : 'GROEN',
    hasBackpackContent: overrides.hasBackpackContent ?? false,
  };
}

function makeKimInput(overrides: {
  riskScore?: number;
  eigenRegieInput?: number | null;
  hasBackpackContent?: boolean;
}): KimDecisionInput {
  return {
    analysis: {
      riskLevel: 'low' as any,
      emotionalState: 'stable',
      moodTrend: 'stable' as any,
      activeTriggers: [],
      triggerContextActive: false,
      patternAccumulation: 0,
      tone: 'warm' as any,
      pacing: 'normal' as any,
      suggestionIntensity: 5,
      crisisMonitoring: false,
      crisisThresholdLowered: false,
      priorityModules: [],
      stateSummary: 'test',
    },
    dominantState: {
      dominantModule: 'boundary-repair',
      dominantTrigger: '',
      dominantDirection: 'stabilize',
      dominantTone: 'warm',
      selectionReason: 'test',
      sourceLayer: 'default',
      riskScore: overrides.riskScore ?? 3,
    },
    crisis: {
      level: 0,
      triggers: [],
      recommendedAction: 'none',
    },
    moodSliders: { stress: 30, craving: 0, mood: 50, energy: 50, social: 50 } as any,
    currentZoneColor: 'GREEN',
    currentZoneScore: 20,
    eigenRegieInput: overrides.eigenRegieInput !== undefined ? overrides.eigenRegieInput : 50,
    hasBackpackContent: overrides.hasBackpackContent ?? false,
  };
}

// ─── Elias Edge Cases ──────────────────────────────────────────

describe('Elias recommendedModel edge cases', () => {
  it('riskScore=6 → gpt-4o-mini', () => {
    const decision = createEliasDecision(makeEliasInput({ riskScore: 6 }));
    expect(decision.recommendedModel).toBe('gpt-4o-mini');
  });

  it('riskScore=7 → gpt-4o', () => {
    const decision = createEliasDecision(makeEliasInput({ riskScore: 7 }));
    expect(decision.recommendedModel).toBe('gpt-4o');
    expect(decision.recommendedModelReason).toContain('riskScore=7');
  });

  it('vspLevel=GEEL → gpt-4o-mini', () => {
    const decision = createEliasDecision(makeEliasInput({ vspInput: 'GEEL' }));
    expect(decision.recommendedModel).toBe('gpt-4o-mini');
  });

  it('vspLevel=ORANJE → gpt-4o', () => {
    const decision = createEliasDecision(makeEliasInput({ vspInput: 'ORANJE' }));
    expect(decision.recommendedModel).toBe('gpt-4o');
    expect(decision.recommendedModelReason).toContain('vspLevel=ORANJE');
  });
});

// ─── Kim Edge Cases ────────────────────────────────────────────

describe('Elias recommendedModel — hasBackpackContent', () => {
  it('isCrisis=false, riskScore=0, vspLevel=GROEN, hasBackpackContent=true → gpt-4o', () => {
    const decision = createEliasDecision(makeEliasInput({
      riskScore: 0,
      vspInput: 'GROEN',
      hasBackpackContent: true,
    }));
    expect(decision.recommendedModel).toBe('gpt-4o');
    expect(decision.recommendedModelReason).toContain('backpack has content');
  });
});

describe('Kim recommendedModel — hasBackpackContent', () => {
  it('isKimCrisis=false, riskScore=0, eigenRegie=50, hasBackpackContent=true → gpt-4o', () => {
    const decision = createKimDecision(makeKimInput({
      riskScore: 0,
      eigenRegieInput: 50,
      hasBackpackContent: true,
    }));
    expect(decision.recommendedModel).toBe('gpt-4o');
    expect(decision.recommendedModelReason).toContain('backpack has content');
  });
});

describe('Kim recommendedModel edge cases', () => {
  it('eigenRegie=31 → gpt-4o-mini', () => {
    const decision = createKimDecision(makeKimInput({ eigenRegieInput: 31 }));
    expect(decision.recommendedModel).toBe('gpt-4o-mini');
  });

  it('eigenRegie=30 → gpt-4o', () => {
    const decision = createKimDecision(makeKimInput({ eigenRegieInput: 30 }));
    expect(decision.recommendedModel).toBe('gpt-4o');
    expect(decision.recommendedModelReason).toContain('eigenRegie=30');
  });

  it('riskScore=6 → gpt-4o-mini', () => {
    const decision = createKimDecision(makeKimInput({ riskScore: 6 }));
    expect(decision.recommendedModel).toBe('gpt-4o-mini');
  });

  it('riskScore=7 → gpt-4o', () => {
    const decision = createKimDecision(makeKimInput({ riskScore: 7 }));
    expect(decision.recommendedModel).toBe('gpt-4o');
    expect(decision.recommendedModelReason).toContain('riskScore=7');
  });
});
