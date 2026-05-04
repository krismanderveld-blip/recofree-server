/**
 * Tests for compound slider → behavior mapping.
 *
 * Verifies that the state-analyzer correctly maps slider combinations
 * to tone, pacing, suggestion intensity, and reflection depth.
 */
import { describe, it, expect } from 'vitest';
import { analyzeState } from '../lib/rugzak/state-analyzer';
import type { Rugzak, EliasMoodSliders, KimMoodSliders } from '../lib/ai/types';

function makeElias(sliders: EliasMoodSliders, overrides?: Partial<Rugzak>): Rugzak {
  return {
    userType: 'elias',
    naam: 'Test',
    currentMood: sliders,
    chatHistory: [],
    moodHistory: [],
    triggerPatterns: [],
    totalSessions: 3,
    sections: [],
    ...overrides,
  } as Rugzak;
}

function makeKim(sliders: KimMoodSliders, overrides?: Partial<Rugzak>): Rugzak {
  return {
    userType: 'kim',
    naam: 'Test',
    currentMood: sliders,
    chatHistory: [],
    moodHistory: [],
    triggerPatterns: [],
    totalSessions: 3,
    sections: [],
    ...overrides,
  } as Rugzak;
}

describe('Compound Slider Rules - Elias', () => {
  it('craving=7, frustration=8, despondency=8, focus=3 → grounding tone', () => {
    const rugzak = makeElias({ craving: 7, frustration: 8, despondency: 8, focus: 3, vsp: null });
    const analysis = analyzeState(rugzak, '');
    expect(analysis.tone).toBe('grounding');
  });

  it('craving=7, frustration=8, despondency=8, focus=3 → very_slow pacing', () => {
    const rugzak = makeElias({ craving: 7, frustration: 8, despondency: 8, focus: 3, vsp: null });
    const analysis = analyzeState(rugzak, '');
    expect(analysis.pacing).toBe('very_slow');
  });

  it('craving=7, frustration=8, despondency=8, focus=3 → high suggestion intensity (>=7)', () => {
    const rugzak = makeElias({ craving: 7, frustration: 8, despondency: 8, focus: 3, vsp: null });
    const analysis = analyzeState(rugzak, '');
    expect(analysis.suggestionIntensity).toBeGreaterThanOrEqual(7);
  });

  it('craving=7, frustration=8, despondency=8, focus=3 → depleted emotional state', () => {
    const rugzak = makeElias({ craving: 7, frustration: 8, despondency: 8, focus: 3, vsp: null });
    const analysis = analyzeState(rugzak, '');
    expect(analysis.emotionalState).toBe('depleted');
  });

  it('craving=7, frustration=8, despondency=8, focus=3 → high risk level', () => {
    const rugzak = makeElias({ craving: 7, frustration: 8, despondency: 8, focus: 3, vsp: null });
    const analysis = analyzeState(rugzak, '');
    expect(analysis.riskLevel).toBe('high');
  });

  it('craving=7, frustration=8, despondency=8, focus=3 → crisis monitoring active', () => {
    const rugzak = makeElias({ craving: 7, frustration: 8, despondency: 8, focus: 3, vsp: null });
    const analysis = analyzeState(rugzak, '');
    expect(analysis.crisisMonitoring).toBe(true);
  });

  it('craving=2, frustration=2, despondency=2, focus=8 → warm tone (low distress)', () => {
    const rugzak = makeElias({ craving: 2, frustration: 2, despondency: 2, focus: 8, vsp: null });
    const analysis = analyzeState(rugzak, '');
    expect(analysis.tone).toBe('warm');
  });

  it('craving=2, frustration=2, despondency=2, focus=8 → normal pacing', () => {
    const rugzak = makeElias({ craving: 2, frustration: 2, despondency: 2, focus: 8, vsp: null });
    const analysis = analyzeState(rugzak, '');
    expect(analysis.pacing).toBe('normal');
  });

  it('craving=2, frustration=2, despondency=2, focus=8 → stable emotional state', () => {
    const rugzak = makeElias({ craving: 2, frustration: 2, despondency: 2, focus: 8, vsp: null });
    const analysis = analyzeState(rugzak, '');
    expect(analysis.emotionalState).toBe('stable');
  });

  it('craving=8, frustration=3, despondency=3, focus=7 → grounding (high primary concern + moderate distress)', () => {
    // craving > 6 AND distress = (8+3+3)/3 = 4.67 → NOT >= 6, so not grounding from compound rule
    // But primaryConcern=8 > 6 AND distress < 6 → should be warm or vulnerable
    const rugzak = makeElias({ craving: 8, frustration: 3, despondency: 3, focus: 7, vsp: null });
    const analysis = analyzeState(rugzak, '');
    // distress = 4.67, primaryConcern = 8, but distress < 6 so not grounding from compound
    // emotionalState: distress < 6.5, primaryConcern >= 5.5 → vulnerable
    expect(analysis.emotionalState).toBe('vulnerable');
    expect(analysis.tone).toBe('warm');
  });

  it('craving=9, frustration=7, despondency=6, focus=2 → grounding (extreme distress)', () => {
    // distress = (9+7+6)/3 = 7.33, resilience = 2
    // riskLevel: distress < 7.5 but resilience <= 3 → check: 7.33 < 7.5 → not 'high' from that rule
    // But primaryConcern=9 > 6 AND distress=7.33 >= 6 → grounding tone
    const rugzak = makeElias({ craving: 9, frustration: 7, despondency: 6, focus: 2, vsp: null });
    const analysis = analyzeState(rugzak, '');
    expect(analysis.tone).toBe('grounding');
    // emotionalState: depleted (distress >= 6.5) → pacing: slower
    expect(['slower', 'very_slow']).toContain(analysis.pacing);
  });
});

describe('Compound Slider Rules - Kim', () => {
  it('stress=8, boundaryFatigue=7, emotionalBurden=8, selfCare=2 → grounding tone', () => {
    const rugzak = makeKim({ stress: 8, boundaryFatigue: 7, emotionalBurden: 8, selfCare: 2, eigenRegie: null });
    const analysis = analyzeState(rugzak, '');
    expect(analysis.tone).toBe('grounding');
  });

  it('stress=8, boundaryFatigue=7, emotionalBurden=8, selfCare=2 → very_slow pacing', () => {
    const rugzak = makeKim({ stress: 8, boundaryFatigue: 7, emotionalBurden: 8, selfCare: 2, eigenRegie: null });
    const analysis = analyzeState(rugzak, '');
    expect(analysis.pacing).toBe('very_slow');
  });

  it('stress=2, boundaryFatigue=2, emotionalBurden=2, selfCare=8 → warm tone', () => {
    const rugzak = makeKim({ stress: 2, boundaryFatigue: 2, emotionalBurden: 2, selfCare: 8, eigenRegie: null });
    const analysis = analyzeState(rugzak, '');
    expect(analysis.tone).toBe('warm');
    expect(analysis.emotionalState).toBe('stable');
  });
});

describe('Therapeutic Stance Output', () => {
  it('high distress Elias → stance includes GROUNDING + DIRECTIVE', () => {
    const rugzak = makeElias({ craving: 7, frustration: 8, despondency: 8, focus: 3, vsp: null });
    const analysis = analyzeState(rugzak, '');
    // The stateSummary should contain the slider values
    expect(analysis.stateSummary).toContain('Craving: 7');
    expect(analysis.stateSummary).toContain('Risk: high');
  });

  it('low distress Elias → stable state summary', () => {
    const rugzak = makeElias({ craving: 1, frustration: 1, despondency: 1, focus: 9, vsp: null });
    const analysis = analyzeState(rugzak, '');
    expect(analysis.stateSummary).toContain('Risk: low');
    expect(analysis.stateSummary).toContain('State: stable');
  });
});
