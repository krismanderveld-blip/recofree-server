/**
 * Tests for Intervention Continuity Layer — Zone-Linked Therapeutic Memory
 *
 * Test categories:
 * 1. regulationToInterventionType mapping
 * 2. detectZoneShift logic
 * 3. detectUserResponse heuristics
 * 4. computeEffectiveness scoring
 * 5. evaluateInterventionContinuity PRE-GPT flow
 * 6. updateInterventionAfterResponse POST-GPT flow
 * 7. Zone shift → re-evaluation
 * 8. Zone stable → continuation
 * 9. getSessionSummary
 * 10. buildInterventionContext GPT string
 * 11. resetInterventionState
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  regulationToInterventionType,
  detectZoneShift,
  detectUserResponse,
  computeEffectiveness,
  evaluateInterventionContinuity,
  updateInterventionAfterResponse,
  getInterventionState,
  resetInterventionState,
  getSessionSummary,
  buildInterventionContext,
  MAX_TRAIL_LENGTH,
  type InterventionState,
  type ZoneEvolutionEntry,
} from '../lib/engine/elias/intervention-continuity';
import type { ResolvedEliasZone } from '../lib/engine/elias/vsp-resolution';

// ─── Helpers ────────────────────────────────────────────────────

function makeResolvedZone(
  finalZoneLabel: 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS',
  finalSeverity: number,
): ResolvedEliasZone {
  return {
    finalZoneLabel,
    finalSeverity,
    source: 'VSP' as const,
    reason: 'USER_REPORTED_RISK_HIGHER_THAN_COMPUTED' as const,
    vspLevel: finalZoneLabel as any,
    computedZone: 'GROEN' as const,
    isBlocked: false,
    isCrisis: finalZoneLabel === 'PAARS',
  };
}

function makeBlockedZone(): ResolvedEliasZone {
  return {
    finalZoneLabel: null,
    finalSeverity: null,
    source: 'NONE' as const,
    reason: 'BLOCKED_PRECHAT_REQUIRED' as const,
    vspLevel: null,
    computedZone: 'GROEN' as const,
    isBlocked: true,
    isCrisis: false,
  };
}

// ─── 1. regulationToInterventionType ────────────────────────────

describe('regulationToInterventionType', () => {
  it('maps ground → grounding', () => {
    expect(regulationToInterventionType('ground')).toBe('grounding');
  });

  it('maps stabilize → stabilization', () => {
    expect(regulationToInterventionType('stabilize')).toBe('stabilization');
  });

  it('maps regulate → regulation', () => {
    expect(regulationToInterventionType('regulate')).toBe('regulation');
  });

  it('maps slow_down → deceleration', () => {
    expect(regulationToInterventionType('slow_down')).toBe('deceleration');
  });

  it('maps reflect → reflection', () => {
    expect(regulationToInterventionType('reflect')).toBe('reflection');
  });
});

// ─── 2. detectZoneShift ─────────────────────────────────────────

describe('detectZoneShift', () => {
  it('detects improvement (lower severity)', () => {
    const shift = detectZoneShift('GEEL', 'ORANJE');
    expect(shift.direction).toBe('improved');
    expect(shift.delta).toBe(-1);
    expect(shift.from).toBe('ORANJE');
    expect(shift.to).toBe('GEEL');
  });

  it('detects worsening (higher severity)', () => {
    const shift = detectZoneShift('ROOD', 'GEEL');
    expect(shift.direction).toBe('worsened');
    expect(shift.delta).toBe(2);
    expect(shift.from).toBe('GEEL');
    expect(shift.to).toBe('ROOD');
  });

  it('detects stable (same zone)', () => {
    const shift = detectZoneShift('ORANJE', 'ORANJE');
    expect(shift.direction).toBe('stable');
    expect(shift.delta).toBe(0);
  });

  it('detects large improvement (PAARS → GROEN)', () => {
    const shift = detectZoneShift('GROEN', 'PAARS');
    expect(shift.direction).toBe('improved');
    expect(shift.delta).toBe(-4);
  });

  it('detects large worsening (GROEN → PAARS)', () => {
    const shift = detectZoneShift('PAARS', 'GROEN');
    expect(shift.direction).toBe('worsened');
    expect(shift.delta).toBe(4);
  });
});

// ─── 3. detectUserResponse ──────────────────────────────────────

describe('detectUserResponse', () => {
  const stable = { from: 'ORANJE' as const, to: 'ORANJE' as const, direction: 'stable' as const, delta: 0 };

  it('Rule 0: returns unknown when no active intervention', () => {
    expect(detectUserResponse('hello world this is a test', null, 'none')).toBe('unknown');
  });

  it('Rule 1: returns escalated when zone worsened (objective measurement)', () => {
    const worsened = { from: 'GEEL' as const, to: 'ROOD' as const, direction: 'worsened' as const, delta: 2 };
    expect(detectUserResponse('ik voel me slecht en wil stoppen', worsened, 'regulation')).toBe('escalated');
  });

  it('Rule 2: returns engaged for acknowledgment tokens (<= 5 chars)', () => {
    expect(detectUserResponse('ok', stable, 'regulation')).toBe('engaged');
    expect(detectUserResponse('ja', stable, 'regulation')).toBe('engaged');
    expect(detectUserResponse('nee', stable, 'regulation')).toBe('engaged');
    expect(detectUserResponse('hmm.', stable, 'regulation')).toBe('engaged');
  });

  it('Rule 2: returns ignored for non-ack message <= 5 chars', () => {
    expect(detectUserResponse('xyz', stable, 'regulation')).toBe('ignored');
    expect(detectUserResponse('...', stable, 'regulation')).toBe('ignored');
    expect(detectUserResponse('huh', stable, 'regulation')).toBe('ignored');
  });

  it('Rule 3: returns deflected for explicit deflection markers', () => {
    expect(detectUserResponse('maar eigenlijk wil ik het over iets anders hebben', stable, 'regulation')).toBe('deflected');
    expect(detectUserResponse('laat maar, maakt niet uit voor mij', stable, 'regulation')).toBe('deflected');
    expect(detectUserResponse('can we change the subject please', stable, 'regulation')).toBe('deflected');
  });

  it('Rule 4: returns engaged for substantive response (>= 20 chars, no deflection)', () => {
    expect(detectUserResponse('ik heb geprobeerd om rustig te ademen zoals je zei', stable, 'regulation')).toBe('engaged');
    expect(detectUserResponse('dat helpt wel een beetje denk ik', stable, 'regulation')).toBe('engaged');
  });

  it('Rule 5: returns unknown for ambiguous messages (6-19 chars, no other signal)', () => {
    expect(detectUserResponse('weet niet', stable, 'regulation')).toBe('unknown');
    expect(detectUserResponse('misschien', stable, 'regulation')).toBe('unknown');
    expect(detectUserResponse('ik denk het', stable, 'regulation')).toBe('unknown');
  });
});

// ─── 4. computeEffectiveness ────────────────────────────────────

describe('computeEffectiveness', () => {
  it('returns 50 for empty evolution', () => {
    expect(computeEffectiveness([])).toBe(50);
  });

  it('increases score for improvements', () => {
    const evolution: ZoneEvolutionEntry[] = [
      { turnIndex: 0, zoneLabel: 'ORANJE', severity: 3, interventionType: 'regulation', userResponse: 'unknown', timestamp: '' },
      { turnIndex: 1, zoneLabel: 'GEEL', severity: 2, interventionType: 'regulation', userResponse: 'engaged', timestamp: '' },
    ];
    // Start 50, improved +20, engaged +5 = 75
    expect(computeEffectiveness(evolution)).toBe(75);
  });

  it('decreases score for worsening', () => {
    const evolution: ZoneEvolutionEntry[] = [
      { turnIndex: 0, zoneLabel: 'GEEL', severity: 2, interventionType: 'deceleration', userResponse: 'unknown', timestamp: '' },
      { turnIndex: 1, zoneLabel: 'ROOD', severity: 4, interventionType: 'deceleration', userResponse: 'escalated', timestamp: '' },
    ];
    // Start 50, worsened -15, escalated -10 = 25
    expect(computeEffectiveness(evolution)).toBe(25);
  });

  it('clamps to 0 minimum', () => {
    const evolution: ZoneEvolutionEntry[] = [
      { turnIndex: 0, zoneLabel: 'GROEN', severity: 1, interventionType: 'reflection', userResponse: 'unknown', timestamp: '' },
      { turnIndex: 1, zoneLabel: 'PAARS', severity: 5, interventionType: 'reflection', userResponse: 'escalated', timestamp: '' },
      { turnIndex: 2, zoneLabel: 'PAARS', severity: 5, interventionType: 'grounding', userResponse: 'escalated', timestamp: '' },
      { turnIndex: 3, zoneLabel: 'PAARS', severity: 5, interventionType: 'grounding', userResponse: 'escalated', timestamp: '' },
      { turnIndex: 4, zoneLabel: 'PAARS', severity: 5, interventionType: 'grounding', userResponse: 'escalated', timestamp: '' },
      { turnIndex: 5, zoneLabel: 'PAARS', severity: 5, interventionType: 'grounding', userResponse: 'escalated', timestamp: '' },
      { turnIndex: 6, zoneLabel: 'PAARS', severity: 5, interventionType: 'grounding', userResponse: 'escalated', timestamp: '' },
    ];
    // Heavy worsening + sustained escalation → should clamp at 0
    // 50 -15-10 +5-10 +5-10 +5-10 +5-10 +5-10 = 0
    expect(computeEffectiveness(evolution)).toBe(0);
  });

  it('clamps to 100 maximum', () => {
    const evolution: ZoneEvolutionEntry[] = [
      { turnIndex: 0, zoneLabel: 'PAARS', severity: 5, interventionType: 'grounding', userResponse: 'unknown', timestamp: '' },
      { turnIndex: 1, zoneLabel: 'ROOD', severity: 4, interventionType: 'grounding', userResponse: 'engaged', timestamp: '' },
      { turnIndex: 2, zoneLabel: 'ORANJE', severity: 3, interventionType: 'regulation', userResponse: 'engaged', timestamp: '' },
      { turnIndex: 3, zoneLabel: 'GEEL', severity: 2, interventionType: 'deceleration', userResponse: 'engaged', timestamp: '' },
    ];
    // 50 + (20+5) + (20+5) + (20+5) = 125 → clamped to 100
    expect(computeEffectiveness(evolution)).toBe(100);
  });
});

// ─── 5. evaluateInterventionContinuity PRE-GPT ──────────────────

describe('evaluateInterventionContinuity (PRE-GPT)', () => {
  beforeEach(() => {
    resetInterventionState();
  });

  it('returns null on first turn (no previous state)', () => {
    const zone = makeResolvedZone('ORANJE', 3);
    const result = evaluateInterventionContinuity(zone, 'hallo');
    expect(result).toBeNull();
  });

  it('returns null when zone is blocked', () => {
    const blocked = makeBlockedZone();
    const result = evaluateInterventionContinuity(blocked, 'hallo');
    expect(result).toBeNull();
  });

  it('returns state on second turn after POST-GPT update', () => {
    const zone = makeResolvedZone('ORANJE', 3);
    // Simulate first turn POST-GPT
    updateInterventionAfterResponse(zone, 'regulate');
    // Second turn PRE-GPT
    const result = evaluateInterventionContinuity(zone, 'ik voel me nog steeds gespannen');
    expect(result).not.toBeNull();
    expect(result!.lastInterventionType).toBe('regulation');
    expect(result!.linkedZone).toBe('ORANJE');
  });
});

// ─── 6. updateInterventionAfterResponse POST-GPT ────────────────

describe('updateInterventionAfterResponse (POST-GPT)', () => {
  beforeEach(() => {
    resetInterventionState();
  });

  it('initializes state on first call', () => {
    const zone = makeResolvedZone('ROOD', 4);
    updateInterventionAfterResponse(zone, 'stabilize');
    const state = getInterventionState();
    expect(state).not.toBeNull();
    expect(state!.lastInterventionType).toBe('stabilization');
    expect(state!.linkedZone).toBe('ROOD');
    expect(state!.linkedSeverity).toBe(4);
    expect(state!.turnsActive).toBe(1);
    expect(state!.effectivenessScore).toBe(50);
    expect(state!.zoneEvolution).toHaveLength(1);
  });

  it('does nothing when zone is blocked', () => {
    const blocked = makeBlockedZone();
    updateInterventionAfterResponse(blocked, 'ground');
    expect(getInterventionState()).toBeNull();
  });

  it('updates intervention type on subsequent calls', () => {
    const zone = makeResolvedZone('ORANJE', 3);
    updateInterventionAfterResponse(zone, 'regulate');
    expect(getInterventionState()!.lastInterventionType).toBe('regulation');

    // Simulate PRE-GPT evaluation (zone stable)
    evaluateInterventionContinuity(zone, 'ok ik probeer het');

    // POST-GPT: Elias switched to deceleration
    updateInterventionAfterResponse(zone, 'slow_down');
    expect(getInterventionState()!.lastInterventionType).toBe('deceleration');
  });
});

// ─── 7. Zone shift → re-evaluation ─────────────────────────────

describe('Zone shift → re-evaluation', () => {
  beforeEach(() => {
    resetInterventionState();
  });

  it('re-evaluates when zone improves', () => {
    // First turn: ROOD
    const roodZone = makeResolvedZone('ROOD', 4);
    updateInterventionAfterResponse(roodZone, 'stabilize');

    // Second turn: zone improved to ORANJE
    const oranjeZone = makeResolvedZone('ORANJE', 3);
    const state = evaluateInterventionContinuity(oranjeZone, 'het gaat iets beter');

    expect(state).not.toBeNull();
    expect(state!.wasReEvaluated).toBe(true);
    expect(state!.linkedZone).toBe('ORANJE'); // updated to current
  });

  it('re-evaluates when zone worsens', () => {
    // First turn: GEEL
    const geelZone = makeResolvedZone('GEEL', 2);
    updateInterventionAfterResponse(geelZone, 'slow_down');

    // Second turn: zone worsened to ROOD
    const roodZone = makeResolvedZone('ROOD', 4);
    const state = evaluateInterventionContinuity(roodZone, 'ik kan niet meer');

    expect(state).not.toBeNull();
    expect(state!.wasReEvaluated).toBe(true);
    expect(state!.linkedZone).toBe('ROOD'); // updated to current
    expect(state!.lastUserResponse).toBe('escalated'); // zone worsened
  });
});

// ─── 8. Zone stable → continuation ─────────────────────────────

describe('Zone stable → continuation', () => {
  beforeEach(() => {
    resetInterventionState();
  });

  it('continues same line when zone is stable', () => {
    const oranjeZone = makeResolvedZone('ORANJE', 3);
    updateInterventionAfterResponse(oranjeZone, 'regulate');

    // Same zone next turn
    const state = evaluateInterventionContinuity(oranjeZone, 'ik probeer rustig te ademen');

    expect(state).not.toBeNull();
    expect(state!.wasReEvaluated).toBe(false);
    expect(state!.linkedZone).toBe('ORANJE'); // unchanged
    expect(state!.turnsActive).toBe(2);
  });

  it('increments turnsActive on each stable turn', () => {
    const geelZone = makeResolvedZone('GEEL', 2);
    updateInterventionAfterResponse(geelZone, 'slow_down');

    evaluateInterventionContinuity(geelZone, 'ok');
    updateInterventionAfterResponse(geelZone, 'slow_down');

    evaluateInterventionContinuity(geelZone, 'ik luister');
    const state = getInterventionState();
    expect(state!.turnsActive).toBe(3);
  });
});

// ─── 9. getSessionSummary ───────────────────────────────────────

describe('getSessionSummary', () => {
  beforeEach(() => {
    resetInterventionState();
  });

  it('returns null when no interventions tracked', () => {
    expect(getSessionSummary()).toBeNull();
  });

  it('returns summary after multiple turns', () => {
    // Turn 1: ROOD
    const roodZone = makeResolvedZone('ROOD', 4);
    updateInterventionAfterResponse(roodZone, 'stabilize');

    // Turn 2: improved to ORANJE
    const oranjeZone = makeResolvedZone('ORANJE', 3);
    evaluateInterventionContinuity(oranjeZone, 'het gaat beter');
    updateInterventionAfterResponse(oranjeZone, 'regulate');

    // Turn 3: improved to GEEL
    const geelZone = makeResolvedZone('GEEL', 2);
    evaluateInterventionContinuity(geelZone, 'ik voel me rustiger');
    updateInterventionAfterResponse(geelZone, 'slow_down');

    const summary = getSessionSummary();
    expect(summary).not.toBeNull();
    expect(summary!.startZone).toBe('ROOD');
    expect(summary!.endZone).toBe('GEEL');
    expect(summary!.zoneImproved).toBe(true);
    expect(summary!.totalTurns).toBeGreaterThanOrEqual(1);
    expect(summary!.interventionTypes).toContain('stabilization');
  });
});

// ─── 10. buildInterventionContext ───────────────────────────────

describe('buildInterventionContext', () => {
  it('builds structured context string', () => {
    const state: InterventionState = {
      lastInterventionType: 'regulation',
      interventionGoal: 'Reduce physiological arousal through breathing/body awareness',
      linkedZone: 'ORANJE',
      linkedSeverity: 3,
      expectedShift: { from: 'ORANJE', to: 'GEEL' },
      effectivenessScore: 75,
      turnsActive: 3,
      lastUserResponse: 'engaged',
      zoneEvolution: [],
      wasReEvaluated: false,
    };

    const context = buildInterventionContext(state);
    expect(context).toContain('INTERVENTIE-CONTINUÏTEIT:');
    expect(context).toContain('regulation');
    expect(context).toContain('ORANJE');
    expect(context).toContain('GEEL');
    expect(context).toContain('75/100');
    expect(context).toContain('Zone stabiel — bouw verder op dezelfde lijn');
    expect(context).toContain('Huidige aanpak werkt');
  });

  it('includes re-evaluation warning when zone shifted', () => {
    const state: InterventionState = {
      lastInterventionType: 'stabilization',
      interventionGoal: 'Establish safety and presence before any processing',
      linkedZone: 'ROOD',
      linkedSeverity: 4,
      expectedShift: { from: 'ROOD', to: 'ORANJE' },
      effectivenessScore: 30,
      turnsActive: 2,
      lastUserResponse: 'escalated',
      zoneEvolution: [],
      wasReEvaluated: true,
    };

    const context = buildInterventionContext(state);
    expect(context).toContain('Zone is verschoven — her-evalueer je aanpak');
    expect(context).toContain('Lage effectiviteit');
    expect(context).toContain('Escalatie ondanks interventie');
  });

  it('includes deflection warning', () => {
    const state: InterventionState = {
      lastInterventionType: 'reflection',
      interventionGoal: 'Facilitate open exploration of thoughts and feelings',
      linkedZone: 'GROEN',
      linkedSeverity: 1,
      expectedShift: { from: 'GROEN', to: 'GROEN' },
      effectivenessScore: 55,
      turnsActive: 4,
      lastUserResponse: 'deflected',
      zoneEvolution: [],
      wasReEvaluated: false,
    };

    const context = buildInterventionContext(state);
    expect(context).toContain('Gebruiker ontwijkt');
  });
});

// ─── 11. resetInterventionState ─────────────────────────────────

describe('resetInterventionState', () => {
  it('clears all state', () => {
    const zone = makeResolvedZone('ORANJE', 3);
    updateInterventionAfterResponse(zone, 'regulate');
    expect(getInterventionState()).not.toBeNull();

    resetInterventionState();
    expect(getInterventionState()).toBeNull();
  });

  it('allows fresh start after reset', () => {
    const zone = makeResolvedZone('ROOD', 4);
    updateInterventionAfterResponse(zone, 'stabilize');
    resetInterventionState();

    // Should behave as first turn again
    const result = evaluateInterventionContinuity(zone, 'hallo');
    expect(result).toBeNull();
  });
});

// ─── 12. buildInterventionContext trail limit ──────────────────

describe('buildInterventionContext trail limit (MAX_TRAIL_LENGTH = 5)', () => {
  it('includes at most 5 zone evolution entries in GPT context', () => {

    // Create state with 8 entries — only last 5 should appear in output
    const state: InterventionState = {
      lastInterventionType: 'regulation',
      interventionGoal: 'Reduce arousal',
      linkedZone: 'ORANJE',
      linkedSeverity: 3,
      expectedShift: { from: 'ORANJE', to: 'GEEL' },
      effectivenessScore: 60,
      turnsActive: 8,
      lastUserResponse: 'engaged',
      zoneEvolution: Array.from({ length: 8 }, (_, i) => ({
        turnIndex: i,
        zoneLabel: 'ORANJE' as const,
        severity: 3,
        interventionType: 'regulation' as const,
        userResponse: 'engaged' as const,
        timestamp: '',
      })),
      wasReEvaluated: false,
    };

    expect(MAX_TRAIL_LENGTH).toBe(5);
    const context = buildInterventionContext(state);

    // Should contain entries 3-7 (last 5), NOT entries 0-2
    expect(context).toContain('[3]');
    expect(context).toContain('[4]');
    expect(context).toContain('[5]');
    expect(context).toContain('[6]');
    expect(context).toContain('[7]');
    expect(context).not.toContain('[0]');
    expect(context).not.toContain('[1]');
    expect(context).not.toContain('[2]');
  });

  it('includes all entries when trail is shorter than MAX_TRAIL_LENGTH', () => {

    const state: InterventionState = {
      lastInterventionType: 'deceleration',
      interventionGoal: 'Slow down',
      linkedZone: 'GEEL',
      linkedSeverity: 2,
      expectedShift: { from: 'GEEL', to: 'GROEN' },
      effectivenessScore: 80,
      turnsActive: 3,
      lastUserResponse: 'engaged',
      zoneEvolution: [
        { turnIndex: 0, zoneLabel: 'GEEL' as const, severity: 2, interventionType: 'deceleration' as const, userResponse: 'engaged' as const, timestamp: '' },
        { turnIndex: 1, zoneLabel: 'GEEL' as const, severity: 2, interventionType: 'deceleration' as const, userResponse: 'engaged' as const, timestamp: '' },
      ],
      wasReEvaluated: false,
    };

    const context = buildInterventionContext(state);
    expect(context).toContain('[0]');
    expect(context).toContain('[1]');
    expect(context).toContain('laatste 2');
  });

  it('does not include trail section when evolution is empty', () => {

    const state: InterventionState = {
      lastInterventionType: 'regulation',
      interventionGoal: 'Reduce arousal',
      linkedZone: 'ORANJE',
      linkedSeverity: 3,
      expectedShift: { from: 'ORANJE', to: 'GEEL' },
      effectivenessScore: 50,
      turnsActive: 1,
      lastUserResponse: 'unknown',
      zoneEvolution: [],
      wasReEvaluated: false,
    };

    const context = buildInterventionContext(state);
    expect(context).not.toContain('Zone-evolutie');
  });
});
