/**
 * Zone Impact Tests
 *
 * Verifies:
 * 1. Exact mapping values per zone level for both Elias and Kim
 * 2. Zone level determination boundary conditions for computeEliasZone
 * 3. Zone level determination boundary conditions for computeKimZone
 * 4. Null handling for Kim when no Eigen Regie input
 */

import { describe, it, expect } from 'vitest';
import {
  computeEliasZone,
  eliasZoneImpactMap,
  type EliasZoneInput,
} from '../lib/engine/elias/zone';
import {
  computeKimZone,
  kimZoneImpactMap,
} from '../lib/engine/kim/zone';
import { processEigenRegie } from '../lib/engine/kim/eigen-regie';
import type { ZoneLevel } from '../lib/engine/zone-types';

// ─── Elias Impact Map: Exact Values ──────────────────────────────

describe('Elias Zone Impact Map — Exact Values', () => {
  it('ROOD → CRISIS / NONE / DIRECT', () => {
    expect(eliasZoneImpactMap.ROOD).toEqual({
      interventionLevel: 'CRISIS',
      reflectionDepth: 'NONE',
      directiveStyle: 'DIRECT',
    });
  });

  it('ORANJE → HIGH / SURFACE / DIRECT', () => {
    expect(eliasZoneImpactMap.ORANJE).toEqual({
      interventionLevel: 'HIGH',
      reflectionDepth: 'SURFACE',
      directiveStyle: 'DIRECT',
    });
  });

  it('GEEL → MEDIUM / MODERATE / GUIDE', () => {
    expect(eliasZoneImpactMap.GEEL).toEqual({
      interventionLevel: 'MEDIUM',
      reflectionDepth: 'MODERATE',
      directiveStyle: 'GUIDE',
    });
  });

  it('LICHTGROEN → LOW / MODERATE / SUGGEST', () => {
    expect(eliasZoneImpactMap.LICHTGROEN).toEqual({
      interventionLevel: 'LOW',
      reflectionDepth: 'MODERATE',
      directiveStyle: 'SUGGEST',
    });
  });

  it('GROEN → NONE / DEEP / NONE', () => {
    expect(eliasZoneImpactMap.GROEN).toEqual({
      interventionLevel: 'NONE',
      reflectionDepth: 'DEEP',
      directiveStyle: 'NONE',
    });
  });

  it('map covers all 5 zone levels', () => {
    const levels: ZoneLevel[] = ['ROOD', 'ORANJE', 'GEEL', 'LICHTGROEN', 'GROEN'];
    for (const level of levels) {
      expect(eliasZoneImpactMap[level]).toBeDefined();
    }
    expect(Object.keys(eliasZoneImpactMap)).toHaveLength(5);
  });
});

// ─── Kim Impact Map: Exact Values ────────────────────────────────

describe('Kim Zone Impact Map — Exact Values', () => {
  it('ROOD → HIGH / NONE / LOW', () => {
    expect(kimZoneImpactMap.ROOD).toEqual({
      stabilizationLevel: 'HIGH',
      challengeLevel: 'NONE',
      autonomyLevel: 'LOW',
    });
  });

  it('ORANJE → HIGH / LOW / LOW', () => {
    expect(kimZoneImpactMap.ORANJE).toEqual({
      stabilizationLevel: 'HIGH',
      challengeLevel: 'LOW',
      autonomyLevel: 'LOW',
    });
  });

  it('GEEL → MEDIUM / MEDIUM / MEDIUM', () => {
    expect(kimZoneImpactMap.GEEL).toEqual({
      stabilizationLevel: 'MEDIUM',
      challengeLevel: 'MEDIUM',
      autonomyLevel: 'MEDIUM',
    });
  });

  it('LICHTGROEN → LOW / MEDIUM / HIGH', () => {
    expect(kimZoneImpactMap.LICHTGROEN).toEqual({
      stabilizationLevel: 'LOW',
      challengeLevel: 'MEDIUM',
      autonomyLevel: 'HIGH',
    });
  });

  it('GROEN → NONE / HIGH / HIGH', () => {
    expect(kimZoneImpactMap.GROEN).toEqual({
      stabilizationLevel: 'NONE',
      challengeLevel: 'HIGH',
      autonomyLevel: 'HIGH',
    });
  });

  it('map covers all 5 zone levels', () => {
    const levels: ZoneLevel[] = ['ROOD', 'ORANJE', 'GEEL', 'LICHTGROEN', 'GROEN'];
    for (const level of levels) {
      expect(kimZoneImpactMap[level]).toBeDefined();
    }
    expect(Object.keys(kimZoneImpactMap)).toHaveLength(5);
  });
});

// ─── computeEliasZone: Boundary Tests ────────────────────────────

describe('computeEliasZone — Zone Level Boundaries', () => {
  const base: EliasZoneInput = {
    crisisLevel: 0,
    distressScore: 0,
    resilienceScore: 5,
    stageOfChange: 'contemplation',
  };

  // Priority 1: crisisLevel >= 2 → ROOD
  it('crisisLevel=2 → ROOD (overrides everything)', () => {
    const result = computeEliasZone({ ...base, crisisLevel: 2, distressScore: 0, resilienceScore: 10 });
    expect(result.level).toBe('ROOD');
    expect(result.impact).toEqual(eliasZoneImpactMap.ROOD);
  });

  it('crisisLevel=3 → ROOD', () => {
    const result = computeEliasZone({ ...base, crisisLevel: 3 });
    expect(result.level).toBe('ROOD');
  });

  // Priority 2: distress >= 7.5 && resilience <= 3 → ROOD
  it('distress=7.5, resilience=3 → ROOD', () => {
    const result = computeEliasZone({ ...base, distressScore: 7.5, resilienceScore: 3 });
    expect(result.level).toBe('ROOD');
  });

  it('distress=8, resilience=2 → ROOD', () => {
    const result = computeEliasZone({ ...base, distressScore: 8, resilienceScore: 2 });
    expect(result.level).toBe('ROOD');
  });

  it('distress=7.5, resilience=3.1 → NOT ROOD (resilience too high)', () => {
    const result = computeEliasZone({ ...base, distressScore: 7.5, resilienceScore: 3.1 });
    expect(result.level).not.toBe('ROOD');
  });

  it('distress=7.4, resilience=3 → NOT ROOD (distress too low)', () => {
    const result = computeEliasZone({ ...base, distressScore: 7.4, resilienceScore: 3 });
    expect(result.level).not.toBe('ROOD');
  });

  // Priority 3: crisisLevel === 1 → ORANJE
  it('crisisLevel=1 → ORANJE', () => {
    const result = computeEliasZone({ ...base, crisisLevel: 1, distressScore: 0 });
    expect(result.level).toBe('ORANJE');
    expect(result.impact).toEqual(eliasZoneImpactMap.ORANJE);
  });

  // Priority 4: distress >= 5.5 → ORANJE
  it('distress=5.5 → ORANJE', () => {
    const result = computeEliasZone({ ...base, distressScore: 5.5, resilienceScore: 5 });
    expect(result.level).toBe('ORANJE');
  });

  it('distress=5.4 → NOT ORANJE', () => {
    const result = computeEliasZone({ ...base, distressScore: 5.4, resilienceScore: 5 });
    expect(result.level).not.toBe('ORANJE');
  });

  // Priority 5: distress >= 3.5 → GEEL
  it('distress=3.5 → GEEL', () => {
    const result = computeEliasZone({ ...base, distressScore: 3.5, resilienceScore: 5 });
    expect(result.level).toBe('GEEL');
    expect(result.impact).toEqual(eliasZoneImpactMap.GEEL);
  });

  it('distress=5.4 → GEEL (below ORANJE threshold)', () => {
    const result = computeEliasZone({ ...base, distressScore: 5.4, resilienceScore: 5 });
    expect(result.level).toBe('GEEL');
  });

  // Priority 6: stageOfChange === 'precontemplation' → GEEL
  it('precontemplation + low distress → GEEL', () => {
    const result = computeEliasZone({ ...base, distressScore: 1, resilienceScore: 8, stageOfChange: 'precontemplation' });
    expect(result.level).toBe('GEEL');
  });

  // Priority 7: distress < 3.5 && resilience >= 5 → GROEN
  it('distress=2, resilience=5 → GROEN', () => {
    const result = computeEliasZone({ ...base, distressScore: 2, resilienceScore: 5 });
    expect(result.level).toBe('GROEN');
    expect(result.impact).toEqual(eliasZoneImpactMap.GROEN);
  });

  it('distress=3.4, resilience=5 → GROEN', () => {
    const result = computeEliasZone({ ...base, distressScore: 3.4, resilienceScore: 5 });
    expect(result.level).toBe('GROEN');
  });

  it('distress=2, resilience=4.9 → LICHTGROEN (resilience below 5)', () => {
    const result = computeEliasZone({ ...base, distressScore: 2, resilienceScore: 4.9 });
    expect(result.level).toBe('LICHTGROEN');
  });

  // Priority 8: default → LICHTGROEN
  it('distress=3, resilience=4 → LICHTGROEN (default)', () => {
    const result = computeEliasZone({ ...base, distressScore: 3, resilienceScore: 4 });
    expect(result.level).toBe('LICHTGROEN');
    expect(result.impact).toEqual(eliasZoneImpactMap.LICHTGROEN);
  });

  // Verify label is always a non-empty string
  it('every zone result has a non-empty label', () => {
    const inputs: EliasZoneInput[] = [
      { crisisLevel: 2, distressScore: 0, resilienceScore: 0, stageOfChange: 'contemplation' },
      { crisisLevel: 1, distressScore: 0, resilienceScore: 0, stageOfChange: 'contemplation' },
      { crisisLevel: 0, distressScore: 4, resilienceScore: 5, stageOfChange: 'contemplation' },
      { crisisLevel: 0, distressScore: 2, resilienceScore: 4, stageOfChange: 'contemplation' },
      { crisisLevel: 0, distressScore: 1, resilienceScore: 8, stageOfChange: 'contemplation' },
    ];
    for (const input of inputs) {
      const result = computeEliasZone(input);
      expect(result.label).toBeTruthy();
      expect(typeof result.label).toBe('string');
    }
  });
});

// ─── computeKimZone: Boundary Tests ─────────────────────────────

describe('computeKimZone — Zone Level Boundaries', () => {
  // Eigen Regie score mapping:
  // userInput 0–100, engineScore = 100 - userInput
  // engineScore 0–20 → ROOD, 21–40 → ORANJE, 41–60 → GEEL, 61–80 → LICHTGROEN, 81–100 → GROEN

  it('null input → null result', () => {
    const result = computeKimZone(null);
    expect(result).toBeNull();
  });

  // ROOD: engineScore 0–20 (userInput 80–100)
  it('userInput=100 → ROOD (engineScore=0)', () => {
    const er = processEigenRegie(100);
    const result = computeKimZone(er);
    expect(result).not.toBeNull();
    expect(result!.level).toBe('ROOD');
    expect(result!.impact).toEqual(kimZoneImpactMap.ROOD);
  });

  it('userInput=80 → ROOD (engineScore=20, boundary)', () => {
    const er = processEigenRegie(80);
    const result = computeKimZone(er);
    expect(result!.level).toBe('ROOD');
  });

  // ORANJE: engineScore 21–40 (userInput 60–79)
  it('userInput=79 → ORANJE (engineScore=21, boundary)', () => {
    const er = processEigenRegie(79);
    const result = computeKimZone(er);
    expect(result!.level).toBe('ORANJE');
    expect(result!.impact).toEqual(kimZoneImpactMap.ORANJE);
  });

  it('userInput=60 → ORANJE (engineScore=40, boundary)', () => {
    const er = processEigenRegie(60);
    const result = computeKimZone(er);
    expect(result!.level).toBe('ORANJE');
  });

  // GEEL: engineScore 41–60 (userInput 40–59)
  it('userInput=59 → GEEL (engineScore=41, boundary)', () => {
    const er = processEigenRegie(59);
    const result = computeKimZone(er);
    expect(result!.level).toBe('GEEL');
    expect(result!.impact).toEqual(kimZoneImpactMap.GEEL);
  });

  it('userInput=40 → GEEL (engineScore=60, boundary)', () => {
    const er = processEigenRegie(40);
    const result = computeKimZone(er);
    expect(result!.level).toBe('GEEL');
  });

  // LICHTGROEN: engineScore 61–80 (userInput 20–39)
  it('userInput=39 → LICHTGROEN (engineScore=61, boundary)', () => {
    const er = processEigenRegie(39);
    const result = computeKimZone(er);
    expect(result!.level).toBe('LICHTGROEN');
    expect(result!.impact).toEqual(kimZoneImpactMap.LICHTGROEN);
  });

  it('userInput=20 → LICHTGROEN (engineScore=80, boundary)', () => {
    const er = processEigenRegie(20);
    const result = computeKimZone(er);
    expect(result!.level).toBe('LICHTGROEN');
  });

  // GROEN: engineScore 81–100 (userInput 0–19)
  it('userInput=19 → GROEN (engineScore=81, boundary)', () => {
    const er = processEigenRegie(19);
    const result = computeKimZone(er);
    expect(result!.level).toBe('GROEN');
    expect(result!.impact).toEqual(kimZoneImpactMap.GROEN);
  });

  it('userInput=0 → GROEN (engineScore=100)', () => {
    const er = processEigenRegie(0);
    const result = computeKimZone(er);
    expect(result!.level).toBe('GROEN');
  });

  // Verify label is always a non-empty string
  it('every non-null zone result has a non-empty label', () => {
    for (const input of [0, 20, 40, 60, 80, 100]) {
      const er = processEigenRegie(input);
      const result = computeKimZone(er);
      expect(result).not.toBeNull();
      expect(result!.label).toBeTruthy();
      expect(typeof result!.label).toBe('string');
    }
  });
});

// ─── Impact Immutability ─────────────────────────────────────────

describe('Zone Impact Immutability', () => {
  it('eliasZoneImpactMap is frozen', () => {
    expect(Object.isFrozen(eliasZoneImpactMap)).toBe(true);
    for (const level of Object.keys(eliasZoneImpactMap) as ZoneLevel[]) {
      expect(Object.isFrozen(eliasZoneImpactMap[level])).toBe(true);
    }
  });

  it('kimZoneImpactMap is frozen', () => {
    expect(Object.isFrozen(kimZoneImpactMap)).toBe(true);
    for (const level of Object.keys(kimZoneImpactMap) as ZoneLevel[]) {
      expect(Object.isFrozen(kimZoneImpactMap[level])).toBe(true);
    }
  });

  it('computeEliasZone returns frozen result', () => {
    const result = computeEliasZone({
      crisisLevel: 0,
      distressScore: 2,
      resilienceScore: 6,
      stageOfChange: 'contemplation',
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('computeKimZone returns frozen result', () => {
    const er = processEigenRegie(50);
    const result = computeKimZone(er);
    expect(result).not.toBeNull();
    expect(Object.isFrozen(result!)).toBe(true);
  });
});
