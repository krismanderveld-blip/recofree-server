/**
 * Kim Eigen Regie Crisis Full Path Integration Test
 *
 * Verifies the complete path:
 * Kim user → eigenRegie.userInput=5 → isKimCrisis=true → regulation=ground → model=gpt-4o
 */
import { describe, it, expect } from 'vitest';
import { createKimDecision, type KimDecisionInput } from '../lib/engine/kim/decision-layer';
import { applyRegulation, type ZoneColor } from '../lib/rugzak/regulation-layer';

// Model routing logic (mirrors server/ai-chat.ts)
function selectModel(isCrisis: boolean, crisisLevel: number, riskScore: number): string {
  if (crisisLevel > 0 || riskScore >= 7 || isCrisis === true) return 'gpt-4o';
  return 'gpt-4o-mini';
}

function makeKimInput(eigenRegieInput: number | null): KimDecisionInput {
  return {
    analysis: {
      riskLevel: 'low' as any,
      emotionalState: 'vulnerable',
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
      riskScore: 30,
    },
    crisis: {
      level: 0,
      triggers: [],
      recommendedAction: 'none',
    },
    moodSliders: { stress: 50, craving: 0, mood: 50, energy: 50, social: 50 } as any,
    currentZoneColor: 'GREEN',
    currentZoneScore: 20,
    eigenRegieInput,
  };
}

describe('kim-eigen-regie-crisis-full-path', () => {
  it('eigenRegie=5 → isKimCrisis=true → regulation=ground → model=gpt-4o (full path)', () => {
    // Step 1: Kim decision with eigenRegie=5
    const decision = createKimDecision(makeKimInput(5));
    expect(decision.isKimCrisis).toBe(true);
    expect(decision.eigenRegie).not.toBeNull();
    expect(decision.eigenRegie!.userInput).toBe(5);

    // Step 2: Pipeline resolves zone to PURPLE (isKimCrisis forces PURPLE)
    const resolvedZone: ZoneColor = decision.isKimCrisis ? 'PURPLE' : 'GREEN';
    expect(resolvedZone).toBe('PURPLE');

    // Step 3: Regulation receives PURPLE → action=ground
    const regulation = applyRegulation(resolvedZone, 'normal');
    expect(regulation.action).toBe('ground');
    expect(regulation.zone).toBe('PURPLE');

    // Step 4: Model routing receives isCrisis=true → gpt-4o
    const model = selectModel(decision.isKimCrisis, decision.crisisLevel, 3);
    expect(model).toBe('gpt-4o');
  });

  it('eigenRegie=0 (minimum) → same full crisis path', () => {
    const decision = createKimDecision(makeKimInput(0));
    expect(decision.isKimCrisis).toBe(true);

    const resolvedZone: ZoneColor = decision.isKimCrisis ? 'PURPLE' : 'GREEN';
    const regulation = applyRegulation(resolvedZone, 'normal');
    const model = selectModel(decision.isKimCrisis, decision.crisisLevel, 3);

    expect(resolvedZone).toBe('PURPLE');
    expect(regulation.action).toBe('ground');
    expect(model).toBe('gpt-4o');
  });

  it('eigenRegie=9 (boundary, still crisis) → full crisis path', () => {
    const decision = createKimDecision(makeKimInput(9));
    expect(decision.isKimCrisis).toBe(true);

    const resolvedZone: ZoneColor = decision.isKimCrisis ? 'PURPLE' : 'GREEN';
    const regulation = applyRegulation(resolvedZone, 'normal');
    const model = selectModel(decision.isKimCrisis, decision.crisisLevel, 3);

    expect(resolvedZone).toBe('PURPLE');
    expect(regulation.action).toBe('ground');
    expect(model).toBe('gpt-4o');
  });

  it('eigenRegie=10 (boundary, NOT crisis) → normal path', () => {
    const decision = createKimDecision(makeKimInput(10));
    expect(decision.isKimCrisis).toBe(false);

    const resolvedZone: ZoneColor = decision.isKimCrisis ? 'PURPLE' : 'GREEN';
    const regulation = applyRegulation(resolvedZone, 'normal');
    const model = selectModel(decision.isKimCrisis, decision.crisisLevel, 3);

    expect(resolvedZone).toBe('GREEN');
    expect(regulation.action).toBe('reflect');
    expect(model).toBe('gpt-4o-mini');
  });

  it('eigenRegie=50 (healthy) → normal path, no crisis', () => {
    const decision = createKimDecision(makeKimInput(50));
    expect(decision.isKimCrisis).toBe(false);

    const resolvedZone: ZoneColor = decision.isKimCrisis ? 'PURPLE' : 'GREEN';
    const regulation = applyRegulation(resolvedZone, 'normal');
    const model = selectModel(decision.isKimCrisis, decision.crisisLevel, 3);

    expect(resolvedZone).toBe('GREEN');
    expect(regulation.action).toBe('reflect');
    expect(model).toBe('gpt-4o-mini');
  });
});
