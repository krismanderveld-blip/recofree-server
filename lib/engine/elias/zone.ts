/**
 * Elias Zone — Engine-level zone computation
 *
 * Maps existing Elias engine outputs to a typed ZoneResult<EliasImpact>.
 *
 * Elias zones are based on:
 * - crisisLevel (0 = normal, 1 = concern, 2 = crisis)
 * - distressScore (0–10 scale, from slider-interpretation.ts)
 * - resilienceScore (0–10 scale, from slider-interpretation.ts)
 * - stageOfChange (from intake/user.dat)
 *
 * Zone determination priority:
 * 1. crisisLevel >= 2 → ROOD (always, overrides everything)
 * 2. distress >= 7.5 && resilience <= 3 → ROOD (extreme distress without coping)
 * 3. crisisLevel === 1 → ORANJE (elevated monitoring)
 * 4. distress >= 5.5 → ORANJE (elevated distress)
 * 5. distress >= 3.5 → GEEL (moderate distress)
 * 6. stageOfChange === 'precontemplation' → GEEL (not ready, keep cautious)
 * 7. distress < 3.5 && resilience >= 5 → GROEN (stable + coping)
 * 8. default → LICHTGROEN (mild concern, growing stability)
 *
 * EliasImpact: deterministic behavioral directives per zone.
 * - interventionLevel: NONE | LOW | MEDIUM | HIGH | CRISIS
 * - reflectionDepth: NONE | SURFACE | MODERATE | DEEP
 * - directiveStyle: NONE | SUGGEST | GUIDE | DIRECT
 *
 * Each zone maps to exactly one fixed EliasImpact. No conditions inside mapping.
 *
 * RULES:
 * - Engine-level ONLY — no pipeline logic, no UI logic
 * - No combination with Kim data or Eigen Regie
 * - No inference. No fallback.
 * - Always computable (unlike Kim, which requires Eigen Regie input)
 */

import type { ZoneLevel, ZoneResult } from '../zone-types';
import type { StageOfChange } from '../../ai/types';

// ─── Elias Impact Enums ───────────────────────────────────────

export type EliasInterventionLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRISIS';
export type EliasReflectionDepth = 'NONE' | 'SURFACE' | 'MODERATE' | 'DEEP';
export type EliasDirectiveStyle = 'NONE' | 'SUGGEST' | 'GUIDE' | 'DIRECT';

// ─── Elias Impact Type ────────────────────────────────────────

export interface EliasImpact {
  readonly interventionLevel: EliasInterventionLevel;
  readonly reflectionDepth: EliasReflectionDepth;
  readonly directiveStyle: EliasDirectiveStyle;
}

// ─── Elias Zone Impact Map ────────────────────────────────────

/**
 * Fixed mapping: ZoneLevel → EliasImpact.
 * Each zone has exactly one deterministic impact object.
 * No conditions. No inference. No deviation.
 */
export const eliasZoneImpactMap: Readonly<Record<ZoneLevel, EliasImpact>> = Object.freeze({
  ROOD: Object.freeze({
    interventionLevel: 'CRISIS' as const,
    reflectionDepth: 'NONE' as const,
    directiveStyle: 'DIRECT' as const,
  }),
  ORANJE: Object.freeze({
    interventionLevel: 'HIGH' as const,
    reflectionDepth: 'SURFACE' as const,
    directiveStyle: 'DIRECT' as const,
  }),
  GEEL: Object.freeze({
    interventionLevel: 'MEDIUM' as const,
    reflectionDepth: 'MODERATE' as const,
    directiveStyle: 'GUIDE' as const,
  }),
  LICHTGROEN: Object.freeze({
    interventionLevel: 'LOW' as const,
    reflectionDepth: 'MODERATE' as const,
    directiveStyle: 'SUGGEST' as const,
  }),
  GROEN: Object.freeze({
    interventionLevel: 'NONE' as const,
    reflectionDepth: 'DEEP' as const,
    directiveStyle: 'NONE' as const,
  }),
});

// ─── Input ─────────────────────────────────────────────────────

export interface EliasZoneInput {
  /** Crisis level from CrisisAssessment (0 = normal, 1 = concern, 2 = crisis) */
  readonly crisisLevel: number;
  /** Distress score on 0–10 scale (from eliasDistressScore) */
  readonly distressScore: number;
  /** Resilience score on 0–10 scale (from eliasResilienceScore) */
  readonly resilienceScore: number;
  /** Current stage of change */
  readonly stageOfChange: StageOfChange;
}

// // ─── Zone Labels ────────────────────────────────────────

const ELIAS_ZONE_LABELS: Readonly<Record<ZoneLevel, string>> = Object.freeze({
  ROOD: 'Crisis or high distress',
  ORANJE: 'Elevated tension',
  GEEL: 'Moderate tension',
  LICHTGROEN: 'Growing stability',
  GROEN: 'Stable and resilient',
});

// ─── Zone Level Determination ──────────────────────────────────

/**
 * Determine the Elias zone level from engine outputs.
 *
 * Priority order (first match wins):
 * 1. crisisLevel >= 2 → ROOD
 * 2. distress >= 7.5 && resilience <= 3 → ROOD
 * 3. crisisLevel === 1 → ORANJE
 * 4. distress >= 5.5 → ORANJE
 * 5. distress >= 3.5 → GEEL
 * 6. stageOfChange === 'precontemplation' → GEEL
 * 7. distress < 3.5 && resilience >= 5 → GROEN
 * 8. default → LICHTGROEN
 */
function determineEliasZoneLevel(input: EliasZoneInput): ZoneLevel {
  if (input.crisisLevel >= 2) {
    return 'ROOD';
  }

  if (input.distressScore >= 7.5 && input.resilienceScore <= 3) {
    return 'ROOD';
  }

  if (input.crisisLevel === 1) {
    return 'ORANJE';
  }

  if (input.distressScore >= 5.5) {
    return 'ORANJE';
  }

  if (input.distressScore >= 3.5) {
    return 'GEEL';
  }

  if (input.stageOfChange === 'precontemplation' && input.distressScore < 3.5) {
    return 'GEEL';
  }

  if (input.distressScore < 3.5 && input.resilienceScore >= 5) {
    return 'GROEN';
  }

  return 'LICHTGROEN';
}

// ─── Compute Elias Zone ────────────────────────────────────────

/**
 * Compute Elias zone from existing engine outputs.
 *
 * Input:  EliasZoneInput (crisisLevel, distressScore, resilienceScore, stageOfChange)
 * Output: ZoneResult<EliasImpact> with level, label, and typed impact
 *
 * Unlike Kim zone, Elias zone is always computable (no null case).
 */
export function computeEliasZone(input: EliasZoneInput): ZoneResult<EliasImpact> {
  const level = determineEliasZoneLevel(input);
  const label = ELIAS_ZONE_LABELS[level];
  const impact = eliasZoneImpactMap[level];

  return Object.freeze({
    level,
    label,
    impact,
  });
}
