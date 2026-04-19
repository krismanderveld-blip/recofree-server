/**
 * Kim Zone — Engine-level zone computation
 *
 * Maps Kim Eigen Regie output to the unified ZoneResult.
 *
 * Kim zones are based EXCLUSIVELY on Eigen Regie levels.
 * The Eigen Regie 5-step model already defines:
 *   - engineEigenRegieScore (0–100, inverted from user input)
 *   - EigenRegieZone (ROOD/ORANJE/GEEL/LICHTGROEN/GROEN)
 *   - EigenRegieImpact (primaryDirective + secondaryDirective)
 *
 * This module maps those existing Eigen Regie outputs to the shared
 * ZoneResult type used by the Kim decision layer.
 *
 * RULES:
 * - Kim zone = Eigen Regie zone. No other inputs.
 * - No combination with sliders, crisis, or buffer data.
 * - No inference. No fallback.
 * - If Eigen Regie is not available (null), zone cannot be computed.
 * - Engine-level ONLY — no pipeline logic, no UI logic.
 */

import type { ZoneLevel, ZoneResult, ZoneImpact } from '../zone-types';
import type { EigenRegieResult, EigenRegieZone } from './eigen-regie';

// ─── Zone Labels (Dutch) ───────────────────────────────────────

/**
 * Human-readable labels per zone for Kim.
 * Based on the Eigen Regie perspective (self-governance of the loved one).
 */
const KIM_ZONE_LABELS: Readonly<Record<ZoneLevel, string>> = Object.freeze({
  ROOD: 'Verlies van eigen regie',
  ORANJE: 'Beperkte eigen regie',
  GEEL: 'Wisselende eigen regie',
  LICHTGROEN: 'Groeiende eigen regie',
  GROEN: 'Sterke eigen regie',
});

// ─── Eigen Regie Zone → ZoneLevel Mapping ──────────────────────

/**
 * Direct 1:1 mapping from EigenRegieZone to ZoneLevel.
 * Both use the same 5-level Dutch names — this is intentional.
 * The mapping exists to decouple the zone system from the Eigen Regie type.
 */
function eigenRegieZoneToLevel(eigenRegieZone: EigenRegieZone): ZoneLevel {
  // EigenRegieZone and ZoneLevel share the same values by design
  return eigenRegieZone as ZoneLevel;
}

// ─── Compute Kim Zone ──────────────────────────────────────────

/**
 * Compute Kim zone from Eigen Regie result.
 *
 * Input:  EigenRegieResult (from processEigenRegie)
 * Output: ZoneResult with level, label, and impact
 *
 * The impact directives come directly from the Eigen Regie impact —
 * they are the same values, just wrapped in the shared ZoneImpact type.
 *
 * Returns null if eigenRegieResult is null (user has not submitted today).
 */
export function computeKimZone(eigenRegieResult: EigenRegieResult | null): ZoneResult | null {
  if (eigenRegieResult === null) {
    return null;
  }

  const level = eigenRegieZoneToLevel(eigenRegieResult.zone);
  const label = KIM_ZONE_LABELS[level];
  const impact: ZoneImpact = Object.freeze({
    primaryDirective: eigenRegieResult.impact.primaryDirective,
    secondaryDirective: eigenRegieResult.impact.secondaryDirective,
  });

  return Object.freeze({
    level,
    label,
    impact,
  });
}
