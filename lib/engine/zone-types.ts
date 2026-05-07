/**
 * Zone Types — Shared structural definitions for the zone system
 *
 * Both Elias and Kim engines produce a ZoneResult as part of their decision output.
 * The zone system is engine-level ONLY — no pipeline logic, no UI logic.
 *
 * ZoneLevel: 5-level spectrum from ROOD (highest concern) to GROEN (lowest concern)
 * ZoneResult<T>: computed zone + label + typed impact
 *
 * Each engine defines its own impact type:
 * - EliasImpact (interventionLevel, reflectionDepth, directiveStyle)
 * - KimImpact (stabilizationLevel, challengeLevel, autonomyLevel)
 *
 * RULES:
 * - These are STRUCTURAL TYPES ONLY — no logic, no computation
 * - Each engine (Kim, Elias) has its own zone.ts with typed impact mapping
 * - No duplication of mapping logic between engines
 * - No pipeline or UI code should import zone computation functions
 */

// ─── Zone Level ────────────────────────────────────────────────

/**
 * 5-level zone spectrum, shared across both engines.
 *
 * ROOD       = highest concern / lowest autonomy
 * ORANJE     = elevated concern
 * GEEL       = moderate / transitional
 * LICHTGROEN = mild concern / growing stability
 * GROEN      = lowest concern / highest autonomy
 */
export type ZoneLevel = 'ROOD' | 'ORANJE' | 'GEEL' | 'LICHTGROEN' | 'GROEN';

// ─── Zone Result ───────────────────────────────────────────────

/**
 * The computed zone output from an engine's zone function.
 * Generic over the impact type — each engine provides its own.
 */
export interface ZoneResult<T> {
  /** The computed zone level. */
  readonly level: ZoneLevel;
  /** Human-readable label for this zone. */
  readonly label: string;
  /** Typed behavioral impact for this zone. */
  readonly impact: T;
}
