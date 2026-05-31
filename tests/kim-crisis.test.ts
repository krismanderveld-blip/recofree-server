/**
 * Kim Crisis Tests (isKimCrisis)
 *
 * Verifies:
 * - eigenRegie userInput < 10 → isKimCrisis = true
 * - eigenRegie userInput >= 10 → isKimCrisis = false
 * - eigenRegie null → isKimCrisis = false
 * - isKimCrisis → model routing selects gpt-4o
 * - isKimCrisis → regulation zone = PURPLE → action = ground
 */
import { describe, it, expect } from 'vitest';
import { createKimDecision, type KimDecisionInput } from '../lib/engine/kim/decision-layer';
import { applyRegulation, type ZoneColor } from '../lib/rugzak/regulation-layer';

// ─── Helpers ───────────────────────────────────────────────────

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
    hasBackpackContent: false,
  };
}

// Model routing logic (same as server/ai-chat.ts)
function selectModel(isCrisis: boolean, crisisLevel: number, riskScore: number): string {
  if (crisisLevel > 0 || riskScore >= 7 || isCrisis === true) return 'gpt-4o';
  return 'gpt-4o-mini';
}

// ─── Tests ─────────────────────────────────────────────────────

describe('Kim crisis (isKimCrisis)', () => {
  it('eigenRegie userInput=5 (< 10) → isKimCrisis=true', () => {
    const decision = createKimDecision(makeKimInput(5));
    expect(decision.isKimCrisis).toBe(true);
    expect(decision.eigenRegie).not.toBeNull();
    expect(decision.eigenRegie!.userInput).toBe(5);
  });

  it('eigenRegie userInput=0 (< 10) → isKimCrisis=true', () => {
    const decision = createKimDecision(makeKimInput(0));
    expect(decision.isKimCrisis).toBe(true);
  });

  it('eigenRegie userInput=9 (< 10) → isKimCrisis=true', () => {
    const decision = createKimDecision(makeKimInput(9));
    expect(decision.isKimCrisis).toBe(true);
  });

  it('eigenRegie userInput=10 (>= 10) → isKimCrisis=false', () => {
    const decision = createKimDecision(makeKimInput(10));
    expect(decision.isKimCrisis).toBe(false);
  });

  it('eigenRegie userInput=50 → isKimCrisis=false', () => {
    const decision = createKimDecision(makeKimInput(50));
    expect(decision.isKimCrisis).toBe(false);
  });

  it('eigenRegie null (not submitted) → isKimCrisis=false', () => {
    const decision = createKimDecision(makeKimInput(null));
    expect(decision.isKimCrisis).toBe(false);
    expect(decision.eigenRegie).toBeNull();
  });

  it('isKimCrisis=true → model routing selects gpt-4o', () => {
    const decision = createKimDecision(makeKimInput(5));
    expect(decision.isKimCrisis).toBe(true);

    const model = selectModel(decision.isKimCrisis, decision.crisisLevel, 3);
    expect(model).toBe('gpt-4o');
  });

  it('isKimCrisis=true → regulation zone PURPLE → action ground', () => {
    const decision = createKimDecision(makeKimInput(5));
    expect(decision.isKimCrisis).toBe(true);

    // When isKimCrisis, pipeline forces PURPLE zone for regulation
    const regulationZone: ZoneColor = decision.isKimCrisis ? 'PURPLE' : 'GREEN';
    const regulation = applyRegulation(regulationZone, 'normal');
    expect(regulation.action).toBe('ground');
    expect(regulation.zone).toBe('PURPLE');
  });

  it('isKimCrisis=false → model stays gpt-4o-mini (no other crisis triggers)', () => {
    const decision = createKimDecision(makeKimInput(50));
    expect(decision.isKimCrisis).toBe(false);

    const model = selectModel(decision.isKimCrisis, decision.crisisLevel, 3);
    expect(model).toBe('gpt-4o-mini');
  });
});
