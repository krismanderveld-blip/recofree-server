/**
 * Kim Zone — Engine-level zone computation
 *
 * Maps Kim Eigen Regie output to a typed ZoneResult<KimImpact>.
 *
 * Kim zones are based EXCLUSIVELY on Eigen Regie levels.
 *
 * KimImpact: deterministic behavioral directives per zone.
 * - stabilizationLevel: NONE | LOW | MEDIUM | HIGH
 * - challengeLevel: NONE | LOW | MEDIUM | HIGH
 * - autonomyLevel: LOW | MEDIUM | HIGH
 *
 * Each zone maps to exactly one fixed KimImpact. No conditions inside mapping.
 *
 * RULES:
 * - Kim zone = Eigen Regie zone. No other inputs.
 * - No combination with sliders, crisis, or buffer data.
 * - No inference. No fallback.
 * - If Eigen Regie is not available (null), zone cannot be computed.
 * - Engine-level ONLY — no pipeline logic, no UI logic.
 */

import type { ZoneLevel, ZoneResult } from '../zone-types';
import type { EigenRegieResult, EigenRegieZone } from './eigen-regie';

// ─── Kim Impact Enums ─────────────────────────────────────────

export type KimStabilizationLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
export type KimChallengeLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
export type KimAutonomyLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// ─── Kim Impact Type ──────────────────────────────────────────

export interface KimImpact {
  readonly stabilizationLevel: KimStabilizationLevel;
  readonly challengeLevel: KimChallengeLevel;
  readonly autonomyLevel: KimAutonomyLevel;
}

// ─── Kim Zone Impact Map ──────────────────────────────────────

/**
 * Fixed mapping: ZoneLevel → KimImpact.
 * Each zone has exactly one deterministic impact object.
 * No conditions. No inference. No deviation.
 */
export const kimZoneImpactMap: Readonly<Record<ZoneLevel, KimImpact>> = Object.freeze({
  ROOD: Object.freeze({
    stabilizationLevel: 'HIGH' as const,
    challengeLevel: 'NONE' as const,
    autonomyLevel: 'LOW' as const,
  }),
  ORANJE: Object.freeze({
    stabilizationLevel: 'HIGH' as const,
    challengeLevel: 'LOW' as const,
    autonomyLevel: 'LOW' as const,
  }),
  GEEL: Object.freeze({
    stabilizationLevel: 'MEDIUM' as const,
    challengeLevel: 'MEDIUM' as const,
    autonomyLevel: 'MEDIUM' as const,
  }),
  LICHTGROEN: Object.freeze({
    stabilizationLevel: 'LOW' as const,
    challengeLevel: 'MEDIUM' as const,
    autonomyLevel: 'HIGH' as const,
  }),
  GROEN: Object.freeze({
    stabilizationLevel: 'NONE' as const,
    challengeLevel: 'HIGH' as const,
    autonomyLevel: 'HIGH' as const,
  }),
});

// ─── Zone Labels ─────────────────────────────────────────────

const KIM_ZONE_LABELS: Readonly<Record<ZoneLevel, string>> = Object.freeze({
  ROOD: 'Loss of self-direction',
  ORANJE: 'Limited self-direction',
  GEEL: 'Fluctuating self-direction',
  LICHTGROEN: 'Growing self-direction',
  GROEN: 'Strong self-direction',
});

// ─── Eigen Regie Zone → ZoneLevel Mapping ──────────────────────

function eigenRegieZoneToLevel(eigenRegieZone: EigenRegieZone): ZoneLevel {
  return eigenRegieZone as ZoneLevel;
}

// ─── Compute Kim Zone ──────────────────────────────────────────

/**
 * Compute Kim zone from Eigen Regie result.
 *
 * Input:  EigenRegieResult (from processEigenRegie)
 * Output: ZoneResult<KimImpact> with level, label, and typed impact
 *
 * Returns null if eigenRegieResult is null (user has not submitted today).
 */
export function computeKimZone(eigenRegieResult: EigenRegieResult | null): ZoneResult<KimImpact> | null {
  if (eigenRegieResult === null) {
    return null;
  }

  const level = eigenRegieZoneToLevel(eigenRegieResult.zone);
  const label = KIM_ZONE_LABELS[level];
  const impact = kimZoneImpactMap[level];

  return Object.freeze({
    level,
    label,
    impact,
  });
}
