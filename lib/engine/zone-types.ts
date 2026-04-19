/**
 * Zone Types — Shared structural definitions for the zone system
 *
 * Both Elias and Kim engines produce a ZoneResult as part of their decision output.
 * The zone system is engine-level ONLY — no pipeline logic, no UI logic.
 *
 * ZoneLevel: 5-level spectrum from ROOD (highest concern) to GROEN (lowest concern)
 * ZoneResult: computed zone + label + impact directives
 * ZoneImpact: behavioral directives per zone (primary + secondary)
 *
 * RULES:
 * - These are STRUCTURAL TYPES ONLY — no logic, no computation
 * - Each engine (Kim, Elias) has its own zone.ts that maps inputs → ZoneResult
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

// ─── Zone Impact ───────────────────────────────────────────────

/**
 * Behavioral directives for the engine in a given zone.
 * Each engine defines its own impact values per zone.
 */
export interface ZoneImpact {
  /** Primary behavioral directive for this zone. */
  readonly primaryDirective: string;
  /** Secondary behavioral directive for this zone. */
  readonly secondaryDirective: string;
}

// ─── Zone Result ───────────────────────────────────────────────

/**
 * The computed zone output from an engine's zone function.
 * Included in the decision layer output of each engine.
 */
export interface ZoneResult {
  /** The computed zone level. */
  readonly level: ZoneLevel;
  /** Human-readable label for this zone (Dutch). */
  readonly label: string;
  /** Behavioral impact directives for this zone. */
  readonly impact: ZoneImpact;
}
