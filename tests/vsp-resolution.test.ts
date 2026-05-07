/**
 * VSP Resolution Layer Tests
 *
 * Tests per specification (section 8):
 * 1. Elias chat blocked when vsp is null
 * 2. No GPT call when vsp is null (isBlocked = true, impact = null)
 * 3. PAARS overrides computed GROEN
 * 4. Computed ROOD overrides VSP GROEN
 * 5. VSP ROOD overrides computed GEEL
 * 6. Tie uses VSP as source
 * 7. computeEliasZone remains callable without vsp
 * 8. Kim Eigen Regie unaffected
 * 9. No default GROEN inserted for missing vsp
 */

import { describe, it, expect } from 'vitest';
import {
  resolveEliasZone,
  mapVspToSeverity,
  mapComputedEliasZoneToSeverity,
  type ResolvedEliasZone,
} from '../lib/engine/elias/vsp-resolution';
import { computeEliasImpact, finalZoneImpactMap } from '../lib/engine/elias/vsp-impact';
import { computeEliasZone } from '../lib/engine/elias/zone';
import { processEigenRegie } from '../lib/engine/kim/eigen-regie';
import { createDefaultSliders } from '../lib/ai/types';

// ─── 1. Elias chat blocked when vsp is null ─────────────────

describe('VSP Resolution — Blocked when vsp is null', () => {
  it('resolveEliasZone returns isBlocked=true when vsp is null', () => {
    const result = resolveEliasZone({ vsp: null, computedZone: 'GROEN' });
    expect(result.isBlocked).toBe(true);
    expect(result.finalSeverity).toBeNull();
    expect(result.finalZoneLabel).toBeNull();
    expect(result.source).toBe('NONE');
    expect(result.reason).toBe('BLOCKED_PRECHAT_REQUIRED');
    expect(result.isCrisis).toBe(false);
  });

  it('blocked state with computed ROOD still blocks (vsp missing overrides everything)', () => {
    const result = resolveEliasZone({ vsp: null, computedZone: 'ROOD' });
    expect(result.isBlocked).toBe(true);
    expect(result.finalSeverity).toBeNull();
  });

  it('blocked state with computed ORANJE still blocks', () => {
    const result = resolveEliasZone({ vsp: null, computedZone: 'ORANJE' });
    expect(result.isBlocked).toBe(true);
  });
});

// ─── 2. No GPT call when vsp is null (impact = null, throws if called) ──

describe('VSP Resolution — No impact when blocked', () => {
  it('computeEliasImpact throws when called with blocked zone', () => {
    const blocked = resolveEliasZone({ vsp: null, computedZone: 'GROEN' });
    expect(blocked.isBlocked).toBe(true);
    expect(() => computeEliasImpact(blocked)).toThrow(
      'computeEliasImpact() MUST NOT be called when resolvedZone.isBlocked == true'
    );
  });

  it('pipeline pattern: impact is null when isBlocked', () => {
    const resolved = resolveEliasZone({ vsp: null, computedZone: 'ROOD' });
    // Simulate pipeline pattern: no impact computation when blocked
    const impact = resolved.isBlocked ? null : computeEliasImpact(resolved);
    expect(impact).toBeNull();
  });
});

// ─── 3. PAARS overrides computed GROEN ──────────────────────

describe('VSP Resolution — PAARS override', () => {
  it('PAARS + computed GROEN → CRISIS (severity 5, PAARS label)', () => {
    const result = resolveEliasZone({ vsp: 'PAARS', computedZone: 'GROEN' });
    expect(result.isBlocked).toBe(false);
    expect(result.isCrisis).toBe(true);
    expect(result.finalSeverity).toBe(5);
    expect(result.finalZoneLabel).toBe('PAARS');
    expect(result.source).toBe('VSP');
    expect(result.reason).toBe('VSP_PAARS_OVERRIDE');
  });

  it('PAARS + computed ROOD → still CRISIS (PAARS always wins)', () => {
    const result = resolveEliasZone({ vsp: 'PAARS', computedZone: 'ROOD' });
    expect(result.isCrisis).toBe(true);
    expect(result.finalSeverity).toBe(5);
    expect(result.finalZoneLabel).toBe('PAARS');
    expect(result.reason).toBe('VSP_PAARS_OVERRIDE');
  });

  it('PAARS impact is CRISIS/NONE/DIRECT', () => {
    const resolved = resolveEliasZone({ vsp: 'PAARS', computedZone: 'GROEN' });
    const impact = computeEliasImpact(resolved);
    expect(impact.interventionLevel).toBe('CRISIS');
    expect(impact.reflectionDepth).toBe('NONE');
    expect(impact.directiveStyle).toBe('DIRECT');
  });
});

// ─── 4. Computed ROOD overrides VSP GROEN ───────────────────

describe('VSP Resolution — Computed higher severity wins', () => {
  it('VSP GROEN (sev 1) + computed ROOD (sev 4) → computed wins', () => {
    const result = resolveEliasZone({ vsp: 'GROEN', computedZone: 'ROOD' });
    expect(result.finalSeverity).toBe(4);
    expect(result.finalZoneLabel).toBe('ROOD');
    expect(result.source).toBe('COMPUTED');
    expect(result.reason).toBe('COMPUTED_RISK_HIGHER_THAN_USER_REPORTED');
    expect(result.isBlocked).toBe(false);
    expect(result.isCrisis).toBe(false);
  });

  it('VSP GROEN (sev 1) + computed ORANJE (sev 3) → computed wins', () => {
    const result = resolveEliasZone({ vsp: 'GROEN', computedZone: 'ORANJE' });
    expect(result.finalSeverity).toBe(3);
    expect(result.finalZoneLabel).toBe('ORANJE');
    expect(result.source).toBe('COMPUTED');
  });

  it('VSP GEEL (sev 2) + computed ROOD (sev 4) → computed wins', () => {
    const result = resolveEliasZone({ vsp: 'GEEL', computedZone: 'ROOD' });
    expect(result.finalSeverity).toBe(4);
    expect(result.finalZoneLabel).toBe('ROOD');
    expect(result.source).toBe('COMPUTED');
  });

  it('computed ROOD impact is CRISIS/NONE/DIRECT', () => {
    const resolved = resolveEliasZone({ vsp: 'GROEN', computedZone: 'ROOD' });
    const impact = computeEliasImpact(resolved);
    expect(impact.interventionLevel).toBe('CRISIS');
    expect(impact.reflectionDepth).toBe('NONE');
    expect(impact.directiveStyle).toBe('DIRECT');
  });
});

// ─── 5. VSP ROOD overrides computed GEEL ────────────────────

describe('VSP Resolution — VSP higher severity wins', () => {
  it('VSP ROOD (sev 4) + computed GEEL (sev 2) → VSP wins', () => {
    const result = resolveEliasZone({ vsp: 'ROOD', computedZone: 'GEEL' });
    expect(result.finalSeverity).toBe(4);
    expect(result.finalZoneLabel).toBe('ROOD');
    expect(result.source).toBe('VSP');
    expect(result.reason).toBe('USER_REPORTED_RISK_HIGHER_THAN_COMPUTED');
  });

  it('VSP ORANJE (sev 3) + computed GROEN (sev 1) → VSP wins', () => {
    const result = resolveEliasZone({ vsp: 'ORANJE', computedZone: 'GROEN' });
    expect(result.finalSeverity).toBe(3);
    expect(result.finalZoneLabel).toBe('ORANJE');
    expect(result.source).toBe('VSP');
  });

  it('VSP ROOD (sev 4) + computed GROEN (sev 1) → VSP wins', () => {
    const result = resolveEliasZone({ vsp: 'ROOD', computedZone: 'GROEN' });
    expect(result.finalSeverity).toBe(4);
    expect(result.finalZoneLabel).toBe('ROOD');
    expect(result.source).toBe('VSP');
  });

  it('VSP GEEL (sev 2) + computed GROEN (sev 1) → VSP wins', () => {
    const result = resolveEliasZone({ vsp: 'GEEL', computedZone: 'GROEN' });
    expect(result.finalSeverity).toBe(2);
    expect(result.finalZoneLabel).toBe('GEEL');
    expect(result.source).toBe('VSP');
  });
});

// ─── 6. Tie uses VSP as source ──────────────────────────────

describe('VSP Resolution — Equal severity → VSP wins (tie-break)', () => {
  it('VSP GROEN (sev 1) + computed GROEN (sev 1) → VSP wins', () => {
    const result = resolveEliasZone({ vsp: 'GROEN', computedZone: 'GROEN' });
    expect(result.finalSeverity).toBe(1);
    expect(result.finalZoneLabel).toBe('GROEN');
    expect(result.source).toBe('VSP');
    expect(result.reason).toBe('VSP_USER_REPORTED_TIE_BREAK');
  });

  it('VSP GROEN (sev 1) + computed LICHTGROEN (sev 1) → VSP wins', () => {
    const result = resolveEliasZone({ vsp: 'GROEN', computedZone: 'LICHTGROEN' });
    expect(result.finalSeverity).toBe(1);
    expect(result.finalZoneLabel).toBe('GROEN');
    expect(result.source).toBe('VSP');
    expect(result.reason).toBe('VSP_USER_REPORTED_TIE_BREAK');
  });

  it('VSP GEEL (sev 2) + computed GEEL (sev 2) → VSP wins', () => {
    const result = resolveEliasZone({ vsp: 'GEEL', computedZone: 'GEEL' });
    expect(result.finalSeverity).toBe(2);
    expect(result.finalZoneLabel).toBe('GEEL');
    expect(result.source).toBe('VSP');
    expect(result.reason).toBe('VSP_USER_REPORTED_TIE_BREAK');
  });

  it('VSP ORANJE (sev 3) + computed ORANJE (sev 3) → VSP wins', () => {
    const result = resolveEliasZone({ vsp: 'ORANJE', computedZone: 'ORANJE' });
    expect(result.finalSeverity).toBe(3);
    expect(result.finalZoneLabel).toBe('ORANJE');
    expect(result.source).toBe('VSP');
    expect(result.reason).toBe('VSP_USER_REPORTED_TIE_BREAK');
  });

  it('VSP ROOD (sev 4) + computed ROOD (sev 4) → VSP wins', () => {
    const result = resolveEliasZone({ vsp: 'ROOD', computedZone: 'ROOD' });
    expect(result.finalSeverity).toBe(4);
    expect(result.finalZoneLabel).toBe('ROOD');
    expect(result.source).toBe('VSP');
    expect(result.reason).toBe('VSP_USER_REPORTED_TIE_BREAK');
  });
});

// ─── 7. computeEliasZone remains callable without vsp ───────

describe('VSP Resolution — computeEliasZone is pure (no VSP)', () => {
  it('computeEliasZone works without any VSP argument', () => {
    const result = computeEliasZone({
      crisisLevel: 0,
      distressScore: 1,
      resilienceScore: 7,
      stageOfChange: 'action',
    });
    expect(result.level).toBeDefined();
    expect(result.impact).toBeDefined();
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('computeEliasZone produces ROOD for crisis input', () => {
    const result = computeEliasZone({
      crisisLevel: 2,
      distressScore: 0,
      resilienceScore: 5,
      stageOfChange: 'action',
    });
    expect(result.level).toBe('ROOD');
  });

  it('computeEliasZone produces GROEN for stable input', () => {
    const result = computeEliasZone({
      crisisLevel: 0,
      distressScore: 1,
      resilienceScore: 7,
      stageOfChange: 'action',
    });
    expect(result.level).toBe('GROEN');
  });

  it('computeEliasZone function signature has no vsp parameter', () => {
    // Verify the function accepts exactly one object argument
    expect(computeEliasZone.length).toBe(1);
  });
});

// ─── 8. Kim Eigen Regie unaffected ──────────────────────────

describe('VSP Resolution — Kim Eigen Regie unaffected', () => {
  it('processEigenRegie still works independently', () => {
    const result = processEigenRegie(80);
    expect(result.zone).toBe('ROOD');
    expect(result.engineScore).toBe(20);
    expect(result.impact.primaryDirective).toBe('stabilize');
  });

  it('processEigenRegie at 0 (full eigen regie) → GROEN', () => {
    const result = processEigenRegie(0);
    expect(result.zone).toBe('GROEN');
    expect(result.engineScore).toBe(100);
  });

  it('processEigenRegie at 50 → GEEL', () => {
    const result = processEigenRegie(50);
    expect(result.zone).toBe('GEEL');
    expect(result.engineScore).toBe(50);
  });

  it('Kim default sliders have eigenRegie: null, no vsp field', () => {
    const sliders = createDefaultSliders('kim');
    expect('eigenRegie' in sliders).toBe(true);
    expect((sliders as any).eigenRegie).toBeNull();
    expect('vsp' in sliders).toBe(false);
  });

  it('resolveEliasZone does not affect Kim types', () => {
    // resolveEliasZone only accepts VspLevel | null + ZoneLevel
    // Kim Eigen Regie uses a completely separate type system
    const kimResult = processEigenRegie(30);
    expect(kimResult.zone).toBe('LICHTGROEN');
    // Verify Kim zone labels are different from VSP labels
    expect(['ROOD', 'ORANJE', 'GEEL', 'LICHTGROEN', 'GROEN']).toContain(kimResult.zone);
  });
});

// ─── 9. No default GROEN inserted for missing vsp ───────────

describe('VSP Resolution — No default GROEN for missing vsp', () => {
  it('createDefaultSliders(elias) has vsp: null, NOT GROEN', () => {
    const sliders = createDefaultSliders('elias');
    expect('vsp' in sliders).toBe(true);
    expect((sliders as any).vsp).toBeNull();
    expect((sliders as any).vsp).not.toBe('GROEN');
  });

  it('resolveEliasZone with null vsp does NOT default to GROEN', () => {
    const result = resolveEliasZone({ vsp: null, computedZone: 'GROEN' });
    // Must be blocked, not silently resolved as GROEN
    expect(result.isBlocked).toBe(true);
    expect(result.finalZoneLabel).toBeNull();
    expect(result.vspLevel).toBeNull();
  });

  it('resolveEliasZone with null vsp + computed ROOD does NOT default to GROEN', () => {
    const result = resolveEliasZone({ vsp: null, computedZone: 'ROOD' });
    // Must be blocked even with high computed severity
    expect(result.isBlocked).toBe(true);
    expect(result.finalZoneLabel).toBeNull();
  });
});

// ─── Severity mapping correctness ───────────────────────────

describe('VSP Resolution — Severity mappings', () => {
  it('VSP severity: GROEN=1, GEEL=2, ORANJE=3, ROOD=4, PAARS=5', () => {
    expect(mapVspToSeverity('GROEN')).toBe(1);
    expect(mapVspToSeverity('GEEL')).toBe(2);
    expect(mapVspToSeverity('ORANJE')).toBe(3);
    expect(mapVspToSeverity('ROOD')).toBe(4);
    expect(mapVspToSeverity('PAARS')).toBe(5);
  });

  it('Computed severity: GROEN=1, LICHTGROEN=1, GEEL=2, ORANJE=3, ROOD=4', () => {
    expect(mapComputedEliasZoneToSeverity('GROEN')).toBe(1);
    expect(mapComputedEliasZoneToSeverity('LICHTGROEN')).toBe(1);
    expect(mapComputedEliasZoneToSeverity('GEEL')).toBe(2);
    expect(mapComputedEliasZoneToSeverity('ORANJE')).toBe(3);
    expect(mapComputedEliasZoneToSeverity('ROOD')).toBe(4);
  });

  it('LICHTGROEN and GROEN have same severity (both = 1)', () => {
    expect(mapComputedEliasZoneToSeverity('LICHTGROEN')).toBe(
      mapComputedEliasZoneToSeverity('GROEN')
    );
  });
});

// ─── Immutability ───────────────────────────────────────────

describe('VSP Resolution — Immutability', () => {
  it('resolveEliasZone result is frozen', () => {
    const result = resolveEliasZone({ vsp: 'ROOD', computedZone: 'GROEN' });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('blocked result is frozen', () => {
    const result = resolveEliasZone({ vsp: null, computedZone: 'GROEN' });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('PAARS result is frozen', () => {
    const result = resolveEliasZone({ vsp: 'PAARS', computedZone: 'GROEN' });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('finalZoneImpactMap entries are frozen', () => {
    expect(Object.isFrozen(finalZoneImpactMap)).toBe(true);
    expect(Object.isFrozen(finalZoneImpactMap.GROEN)).toBe(true);
    expect(Object.isFrozen(finalZoneImpactMap.PAARS)).toBe(true);
  });
});

// ─── Impact correctness per final zone ──────────────────────

describe('VSP Resolution — Impact per final zone label', () => {
  it('GROEN impact: NONE/DEEP/NONE', () => {
    const resolved = resolveEliasZone({ vsp: 'GROEN', computedZone: 'GROEN' });
    const impact = computeEliasImpact(resolved);
    expect(impact.interventionLevel).toBe('NONE');
    expect(impact.reflectionDepth).toBe('DEEP');
    expect(impact.directiveStyle).toBe('NONE');
  });

  it('GEEL impact: MEDIUM/MODERATE/GUIDE', () => {
    const resolved = resolveEliasZone({ vsp: 'GEEL', computedZone: 'GROEN' });
    const impact = computeEliasImpact(resolved);
    expect(impact.interventionLevel).toBe('MEDIUM');
    expect(impact.reflectionDepth).toBe('MODERATE');
    expect(impact.directiveStyle).toBe('GUIDE');
  });

  it('ORANJE impact: HIGH/SURFACE/DIRECT', () => {
    const resolved = resolveEliasZone({ vsp: 'ORANJE', computedZone: 'GROEN' });
    const impact = computeEliasImpact(resolved);
    expect(impact.interventionLevel).toBe('HIGH');
    expect(impact.reflectionDepth).toBe('SURFACE');
    expect(impact.directiveStyle).toBe('DIRECT');
  });

  it('ROOD impact: CRISIS/NONE/DIRECT', () => {
    const resolved = resolveEliasZone({ vsp: 'ROOD', computedZone: 'GROEN' });
    const impact = computeEliasImpact(resolved);
    expect(impact.interventionLevel).toBe('CRISIS');
    expect(impact.reflectionDepth).toBe('NONE');
    expect(impact.directiveStyle).toBe('DIRECT');
  });

  it('PAARS impact: CRISIS/NONE/DIRECT (same as ROOD)', () => {
    const resolved = resolveEliasZone({ vsp: 'PAARS', computedZone: 'GROEN' });
    const impact = computeEliasImpact(resolved);
    expect(impact.interventionLevel).toBe('CRISIS');
    expect(impact.reflectionDepth).toBe('NONE');
    expect(impact.directiveStyle).toBe('DIRECT');
  });
});
