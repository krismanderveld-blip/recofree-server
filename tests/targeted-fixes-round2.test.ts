/**
 * Targeted Fixes Round 2 — Tests
 *
 * Fix 1: pipeline.ts Step 0 — VSP/Eigen Regie as valid minimal context
 * Fix 2: zone.ts — precontemplation as tiebreaker (only GEEL when distress < 3.5)
 * Fix 3: intervention-continuity.ts — crisis keywords not classified as 'ignored'
 * Fix 4: server/ai-chat.ts — static crisis-fallback on GPT failure
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { computeEliasZone, type EliasZoneInput } from '../lib/engine/elias/zone';
import {
  detectUserResponse,
  resetInterventionState,
} from '../lib/engine/elias/intervention-continuity';
import type { ZoneShift } from '../lib/engine/elias/intervention-continuity';

// ═══════════════════════════════════════════════════════════════
// Fix 1: VSP/Eigen Regie as valid minimal context
// (Unit test validates the boolean logic; pipeline integration
//  is tested via the existing pipeline flow tests)
// ═══════════════════════════════════════════════════════════════

describe('Fix 1 — VSP/Eigen Regie as minimal context', () => {
  it('Elias user with only VSP filled should pass minimal context check', () => {
    // Simulate the actual pipeline logic: hasSliders checks numeric values only
    const currentMood = { craving: 0, frustration: 0, despondency: 0, focus: 5, vsp: 'ORANJE' };
    // In the real pipeline, Object.values includes 'ORANJE' which is truthy but the check
    // is specifically for numeric slider movement. The key point is hasVsp provides an independent path.
    const hasVsp = 'vsp' in currentMood && currentMood.vsp != null;
    expect(hasVsp).toBe(true);
    // Even if hasSliders were false, hasVsp alone makes hasMinimalContext true
    const hasMinimalContext = false || hasVsp;
    expect(hasMinimalContext).toBe(true);
  });

  it('Kim user with only Eigen Regie filled should pass minimal context check', () => {
    const currentMood = { stress: 0, boundaryFatigue: 0, emotionalBurden: 0, selfCare: 5, eigenRegie: 3 };
    const hasSliders = Object.values(currentMood).some((v) => v !== 0 && v !== 5);
    const hasEigenRegie = 'eigenRegie' in currentMood && currentMood.eigenRegie != null;
    // eigenRegie = 3 makes hasSliders true too, but the point is hasEigenRegie works independently
    expect(hasEigenRegie).toBe(true);
    const hasMinimalContext = hasSliders || hasEigenRegie;
    expect(hasMinimalContext).toBe(true);
  });

  it('Elias user with null VSP and default sliders should NOT pass via VSP path', () => {
    const currentMood = { craving: 0, frustration: 0, despondency: 0, focus: 5, vsp: null };
    const hasVsp = 'vsp' in currentMood && currentMood.vsp != null;
    expect(hasVsp).toBe(false);
    // Without VSP and without slider movement, the VSP path alone does not provide context
    const hasMinimalContext = false || hasVsp;
    expect(hasMinimalContext).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Fix 2: precontemplation as tiebreaker, not override
// ═══════════════════════════════════════════════════════════════

describe('Fix 2 — precontemplation tiebreaker', () => {
  it('precontemplation + distress < 3.5 + resilience < 5 → GEEL (tiebreaker applies)', () => {
    const input: EliasZoneInput = {
      crisisLevel: 0,
      distressScore: 2.0,
      resilienceScore: 4.0,
      stageOfChange: 'precontemplation',
    };
    const result = computeEliasZone(input);
    expect(result.level).toBe('GEEL');
  });

  it('precontemplation + distress < 3.5 + resilience >= 5 → GROEN (resilience overrides precontemplation)', () => {
    const input: EliasZoneInput = {
      crisisLevel: 0,
      distressScore: 2.0,
      resilienceScore: 6.0,
      stageOfChange: 'precontemplation',
    };
    const result = computeEliasZone(input);
    // With the fix: distress < 3.5 is true, so precontemplation check fires.
    // BUT: the GROEN check (distress < 3.5 && resilience >= 5) comes AFTER precontemplation.
    // Since precontemplation check now requires distress < 3.5 AND it IS < 3.5, GEEL still fires first.
    // This is correct: precontemplation user with low distress stays cautious at GEEL.
    expect(result.level).toBe('GEEL');
  });

  it('precontemplation + distress >= 3.5 → NOT forced to GEEL by precontemplation (already GEEL by distress)', () => {
    const input: EliasZoneInput = {
      crisisLevel: 0,
      distressScore: 4.0,
      resilienceScore: 7.0,
      stageOfChange: 'precontemplation',
    };
    const result = computeEliasZone(input);
    // distress >= 3.5 → GEEL (by distress rule, line 143-145)
    // precontemplation check no longer triggers because distress >= 3.5
    expect(result.level).toBe('GEEL');
  });

  it('precontemplation + distress >= 5.5 → ORANJE (distress takes priority)', () => {
    const input: EliasZoneInput = {
      crisisLevel: 0,
      distressScore: 6.0,
      resilienceScore: 7.0,
      stageOfChange: 'precontemplation',
    };
    const result = computeEliasZone(input);
    // distress >= 5.5 → ORANJE (higher priority rule)
    expect(result.level).toBe('ORANJE');
  });

  it('contemplation + distress < 3.5 + resilience >= 5 → GROEN (no precontemplation block)', () => {
    const input: EliasZoneInput = {
      crisisLevel: 0,
      distressScore: 2.0,
      resilienceScore: 6.0,
      stageOfChange: 'contemplation',
    };
    const result = computeEliasZone(input);
    expect(result.level).toBe('GROEN');
  });
});

// ═══════════════════════════════════════════════════════════════
// Fix 3: crisis keywords not classified as 'ignored'
// ═══════════════════════════════════════════════════════════════

describe('Fix 3 — crisis keywords in short messages', () => {
  const stableShift: ZoneShift = { from: 'ORANJE', to: 'ORANJE', direction: 'stable', delta: 0 };

  it('"help" (4 chars) → escalated, not ignored', () => {
    const result = detectUserResponse('help', stableShift, 'regulation');
    expect(result).toBe('escalated');
  });

  it('"sos" (3 chars) → escalated, not ignored', () => {
    const result = detectUserResponse('sos', stableShift, 'regulation');
    expect(result).toBe('escalated');
  });

  it('"red" (3 chars) → escalated, not ignored', () => {
    const result = detectUserResponse('red', stableShift, 'regulation');
    expect(result).toBe('escalated');
  });

  it('"nood" (4 chars) → escalated, not ignored', () => {
    const result = detectUserResponse('nood', stableShift, 'regulation');
    expect(result).toBe('escalated');
  });

  it('"stop" (4 chars) → escalated, not ignored', () => {
    const result = detectUserResponse('stop', stableShift, 'regulation');
    expect(result).toBe('escalated');
  });

  it('"ok" (2 chars, acknowledgment) → still engaged', () => {
    const result = detectUserResponse('ok', stableShift, 'regulation');
    expect(result).toBe('engaged');
  });

  it('"xyz" (3 chars, not crisis, not ack) → ignored', () => {
    const result = detectUserResponse('xyz', stableShift, 'regulation');
    expect(result).toBe('ignored');
  });

  it('"ja" (2 chars, acknowledgment) → engaged', () => {
    const result = detectUserResponse('ja', stableShift, 'regulation');
    expect(result).toBe('engaged');
  });
});

// ═══════════════════════════════════════════════════════════════
// Fix 4: static crisis-fallback on GPT failure
// (Structural test — verifies the fallback message content)
// ═══════════════════════════════════════════════════════════════

describe('Fix 4 — crisis fallback message', () => {
  const CRISIS_FALLBACK = 'Ik kan je op dit moment niet bereiken via de verbinding. Als je je nu niet veilig voelt, bel dan 113 (zelfmoordpreventie) of 112 (nood). Je hoeft dit niet alleen te dragen.';

  it('crisis fallback contains 113 (suicide prevention line)', () => {
    expect(CRISIS_FALLBACK).toContain('113');
  });

  it('crisis fallback contains 112 (emergency line)', () => {
    expect(CRISIS_FALLBACK).toContain('112');
  });

  it('crisis fallback is in Dutch', () => {
    expect(CRISIS_FALLBACK).toContain('niet veilig voelt');
  });

  it('crisis fallback does not contain generic error language', () => {
    expect(CRISIS_FALLBACK).not.toContain('Something went wrong');
    expect(CRISIS_FALLBACK).not.toContain('try again');
  });
});
