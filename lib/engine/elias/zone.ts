/**
 * Elias Zone — Engine-level zone computation
 *
 * Maps existing Elias engine outputs to the unified ZoneResult.
 *
 * Elias zones are based on:
 * - crisisLevel (0 = normal, 1 = concern, 2 = crisis)
 * - distressScore (0–10 scale, from slider-interpretation.ts)
 * - resilienceScore (0–10 scale, from slider-interpretation.ts)
 * - stageOfChange (from intake/user.dat)
 *
 * Zone determination priority:
 * 1. crisisLevel >= 2 → ROOD (always, overrides everything)
 * 2. crisisLevel === 1 → ORANJE (elevated monitoring)
 * 3. distress >= 7.5 && resilience <= 3 → ROOD (extreme distress without coping)
 * 4. distress >= 5.5 → ORANJE (elevated distress)
 * 5. distress >= 3.5 → GEEL (moderate distress)
 * 6. stageOfChange === 'precontemplation' → GEEL (not ready, keep cautious)
 * 7. distress < 3.5 && resilience >= 5 → GROEN (stable + coping)
 * 8. default → LICHTGROEN (mild concern, growing stability)
 *
 * These thresholds align with existing engine behavior:
 * - state-analyzer.ts: critical at active suicidal/self-harm, high at distress >= 7.5 && resilience <= 3
 * - crisis/detector.ts: level 2 = emergency, level 1 = intervene
 * - state-logic.ts: eliasStateAllowedDepth uses same distress/risk ranges
 *
 * RULES:
 * - Engine-level ONLY — no pipeline logic, no UI logic
 * - No combination with Kim data or Eigen Regie
 * - No inference. No fallback.
 * - Always computable (unlike Kim, which requires Eigen Regie input)
 */

import type { ZoneLevel, ZoneResult, ZoneImpact } from '../zone-types';
import type { StageOfChange } from '../../ai/types';

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

// ─── Zone Labels (Dutch) ───────────────────────────────────────

/**
 * Human-readable labels per zone for Elias.
 * Based on the addiction recovery perspective.
 */
const ELIAS_ZONE_LABELS: Readonly<Record<ZoneLevel, string>> = Object.freeze({
  ROOD: 'Crisis of hoge nood',
  ORANJE: 'Verhoogde spanning',
  GEEL: 'Matige spanning',
  LICHTGROEN: 'Groeiende stabiliteit',
  GROEN: 'Stabiel en veerkrachtig',
});

// ─── Zone Impact Directives ────────────────────────────────────

/**
 * Elias behavioral directives per zone.
 * These directly impact how Elias responds.
 *
 * ROOD:       stabiliseren, geen confrontatie
 * ORANJE:     de-escaleren, zachte begeleiding
 * GEEL:       bewustwording, reflectie stimuleren
 * LICHTGROEN: versterken, inzicht verdiepen
 * GROEN:      uitdagen, groei ondersteunen
 */
const ELIAS_ZONE_IMPACTS: Readonly<Record<ZoneLevel, ZoneImpact>> = Object.freeze({
  ROOD: Object.freeze({
    primaryDirective: 'stabiliseren',
    secondaryDirective: 'geen confrontatie',
  }),
  ORANJE: Object.freeze({
    primaryDirective: 'de-escaleren',
    secondaryDirective: 'zachte begeleiding',
  }),
  GEEL: Object.freeze({
    primaryDirective: 'bewustwording',
    secondaryDirective: 'reflectie stimuleren',
  }),
  LICHTGROEN: Object.freeze({
    primaryDirective: 'versterken',
    secondaryDirective: 'inzicht verdiepen',
  }),
  GROEN: Object.freeze({
    primaryDirective: 'uitdagen',
    secondaryDirective: 'groei ondersteunen',
  }),
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
  // Priority 1: Active crisis → ROOD
  if (input.crisisLevel >= 2) {
    return 'ROOD';
  }

  // Priority 2: Extreme distress without coping → ROOD
  if (input.distressScore >= 7.5 && input.resilienceScore <= 3) {
    return 'ROOD';
  }

  // Priority 3: Elevated monitoring → ORANJE
  if (input.crisisLevel === 1) {
    return 'ORANJE';
  }

  // Priority 4: Elevated distress → ORANJE
  if (input.distressScore >= 5.5) {
    return 'ORANJE';
  }

  // Priority 5: Moderate distress → GEEL
  if (input.distressScore >= 3.5) {
    return 'GEEL';
  }

  // Priority 6: Not ready for change → GEEL (cautious approach)
  if (input.stageOfChange === 'precontemplation') {
    return 'GEEL';
  }

  // Priority 7: Low distress + good resilience → GROEN
  if (input.distressScore < 3.5 && input.resilienceScore >= 5) {
    return 'GROEN';
  }

  // Default: mild concern, growing stability → LICHTGROEN
  return 'LICHTGROEN';
}

// ─── Compute Elias Zone ────────────────────────────────────────

/**
 * Compute Elias zone from existing engine outputs.
 *
 * Input:  EliasZoneInput (crisisLevel, distressScore, resilienceScore, stageOfChange)
 * Output: ZoneResult with level, label, and impact
 *
 * Unlike Kim zone, Elias zone is always computable (no null case).
 */
export function computeEliasZone(input: EliasZoneInput): ZoneResult {
  const level = determineEliasZoneLevel(input);
  const label = ELIAS_ZONE_LABELS[level];
  const impact = ELIAS_ZONE_IMPACTS[level];

  return Object.freeze({
    level,
    label,
    impact,
  });
}
