/**
 * Zone Routing Tests
 *
 * Verifies:
 * - Elias user gets EliasDirective only
 * - Kim user gets KimDirective only
 * - No cross-routing
 * - No merge behavior
 * - routeEngineDirective returns correct discriminated union
 */

import { describe, it, expect } from 'vitest';
import {
  routeEngineDirective,
  type RoutingInput,
  type EliasDirective,
  type KimDirective,
} from '../lib/engine/orchestration';
import type { EliasImpact } from '../lib/engine/elias/zone';
import type { KimImpact } from '../lib/engine/kim/zone';
import type { ZoneLevel } from '../lib/engine/zone-types';

// ─── Fixtures ────────────────────────────────────────────────

const ELIAS_IMPACT: EliasImpact = {
  interventionLevel: 'MEDIUM',
  reflectionDepth: 'MODERATE',
  directiveStyle: 'GUIDE',
};

const KIM_IMPACT: KimImpact = {
  stabilizationLevel: 'MEDIUM',
  challengeLevel: 'MEDIUM',
  autonomyLevel: 'MEDIUM',
};

const ELIAS_ZONE = {
  level: 'GEEL' as ZoneLevel,
  label: 'Geel — Neutraal / Licht Gespannen',
  impact: ELIAS_IMPACT,
  recommendedModel: 'gpt-4o-mini' as const,
  recommendedModelReason: 'default (low complexity)',
};

const KIM_ZONE = {
  level: 'GEEL' as ZoneLevel,
  label: 'Geel — Neutraal / Licht Gespannen',
  impact: KIM_IMPACT,
  recommendedModel: 'gpt-4o-mini' as const,
  recommendedModelReason: 'default (low complexity)',
};

// ─── routeEngineDirective ────────────────────────────────────

describe('routeEngineDirective', () => {
  it('returns EliasDirective for elias user', () => {
    const input: RoutingInput = {
      userType: 'elias',
      eliasZone: ELIAS_ZONE,
      kimZone: null,
    };
    const result = routeEngineDirective(input);
    expect(result).not.toBeNull();
    expect(result!.engine).toBe('elias');
    expect(result!.zoneLevel).toBe('GEEL');
    expect(result!.impact).toEqual(ELIAS_IMPACT);
  });

  it('returns KimDirective for kim user', () => {
    const input: RoutingInput = {
      userType: 'kim',
      eliasZone: null,
      kimZone: KIM_ZONE,
    };
    const result = routeEngineDirective(input);
    expect(result).not.toBeNull();
    expect(result!.engine).toBe('kim');
    expect(result!.zoneLevel).toBe('GEEL');
    expect(result!.impact).toEqual(KIM_IMPACT);
  });

  it('returns null for elias user when eliasZone is null', () => {
    const input: RoutingInput = {
      userType: 'elias',
      eliasZone: null,
      kimZone: null,
    };
    const result = routeEngineDirective(input);
    expect(result).toBeNull();
  });

  it('returns null for kim user when kimZone is null', () => {
    const input: RoutingInput = {
      userType: 'kim',
      eliasZone: null,
      kimZone: null,
    };
    const result = routeEngineDirective(input);
    expect(result).toBeNull();
  });

  it('elias user ignores kimZone even if provided', () => {
    const input: RoutingInput = {
      userType: 'elias',
      eliasZone: ELIAS_ZONE,
      kimZone: KIM_ZONE, // should be ignored
    };
    const result = routeEngineDirective(input);
    expect(result).not.toBeNull();
    expect(result!.engine).toBe('elias');
    // Must NOT contain Kim fields
    expect((result as any).impact.stabilizationLevel).toBeUndefined();
    expect((result as any).impact.challengeLevel).toBeUndefined();
    expect((result as any).impact.autonomyLevel).toBeUndefined();
    // Must contain Elias fields
    expect((result as EliasDirective).impact.interventionLevel).toBe('MEDIUM');
    expect((result as EliasDirective).impact.reflectionDepth).toBe('MODERATE');
    expect((result as EliasDirective).impact.directiveStyle).toBe('GUIDE');
  });

  it('kim user ignores eliasZone even if provided', () => {
    const input: RoutingInput = {
      userType: 'kim',
      eliasZone: ELIAS_ZONE, // should be ignored
      kimZone: KIM_ZONE,
    };
    const result = routeEngineDirective(input);
    expect(result).not.toBeNull();
    expect(result!.engine).toBe('kim');
    // Must NOT contain Elias fields
    expect((result as any).impact.interventionLevel).toBeUndefined();
    expect((result as any).impact.reflectionDepth).toBeUndefined();
    expect((result as any).impact.directiveStyle).toBeUndefined();
    // Must contain Kim fields
    expect((result as KimDirective).impact.stabilizationLevel).toBe('MEDIUM');
    expect((result as KimDirective).impact.challengeLevel).toBe('MEDIUM');
    expect((result as KimDirective).impact.autonomyLevel).toBe('MEDIUM');
  });

  it('result is frozen (immutable)', () => {
    const input: RoutingInput = {
      userType: 'elias',
      eliasZone: ELIAS_ZONE,
      kimZone: null,
    };
    const result = routeEngineDirective(input);
    expect(result).not.toBeNull();
    expect(Object.isFrozen(result)).toBe(true);
  });
});

// ─── All zone levels route correctly ─────────────────────────

describe('routeEngineDirective — all zone levels', () => {
  const ZONE_LEVELS: ZoneLevel[] = ['ROOD', 'ORANJE', 'GEEL', 'LICHTGROEN', 'GROEN'];

  for (const level of ZONE_LEVELS) {
    it(`elias user routes ${level} correctly`, () => {
      const input: RoutingInput = {
        userType: 'elias',
        eliasZone: { level, label: `label-${level}`, impact: ELIAS_IMPACT, recommendedModel: 'gpt-4o-mini' as const, recommendedModelReason: 'test' },
        kimZone: null,
      };
      const result = routeEngineDirective(input);
      expect(result).not.toBeNull();
      expect(result!.engine).toBe('elias');
      expect(result!.zoneLevel).toBe(level);
    });

    it(`kim user routes ${level} correctly`, () => {
      const input: RoutingInput = {
        userType: 'kim',
        eliasZone: null,
        kimZone: { level, label: `label-${level}`, impact: KIM_IMPACT, recommendedModel: 'gpt-4o-mini' as const, recommendedModelReason: 'test' },
      };
      const result = routeEngineDirective(input);
      expect(result).not.toBeNull();
      expect(result!.engine).toBe('kim');
      expect(result!.zoneLevel).toBe(level);
    });
  }
});

// ─── No merge behavior ──────────────────────────────────────

describe('routeEngineDirective — no merge behavior', () => {
  it('never returns an object with both Elias and Kim fields', () => {
    // Test with both zones provided for both user types
    for (const userType of ['elias', 'kim'] as const) {
      const input: RoutingInput = {
        userType,
        eliasZone: ELIAS_ZONE,
        kimZone: KIM_ZONE,
      };
      const result = routeEngineDirective(input);
      expect(result).not.toBeNull();

      if (result!.engine === 'elias') {
        // Must have Elias fields only
        expect(result!.impact).toHaveProperty('interventionLevel');
        expect(result!.impact).toHaveProperty('reflectionDepth');
        expect(result!.impact).toHaveProperty('directiveStyle');
        expect(result!.impact).not.toHaveProperty('stabilizationLevel');
        expect(result!.impact).not.toHaveProperty('autonomyLevel');
      } else {
        // Must have Kim fields only
        expect(result!.impact).toHaveProperty('stabilizationLevel');
        expect(result!.impact).toHaveProperty('challengeLevel');
        expect(result!.impact).toHaveProperty('autonomyLevel');
        expect(result!.impact).not.toHaveProperty('interventionLevel');
        expect(result!.impact).not.toHaveProperty('reflectionDepth');
      }
    }
  });

  it('engine field matches userType exactly', () => {
    const eliasResult = routeEngineDirective({
      userType: 'elias',
      eliasZone: ELIAS_ZONE,
      kimZone: KIM_ZONE,
    });
    expect(eliasResult!.engine).toBe('elias');

    const kimResult = routeEngineDirective({
      userType: 'kim',
      eliasZone: ELIAS_ZONE,
      kimZone: KIM_ZONE,
    });
    expect(kimResult!.engine).toBe('kim');
  });
});
