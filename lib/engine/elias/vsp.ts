/**
 * Elias VSP (Vroeg Signalerings Plan) — Engine-level module
 *
 * VSP is a 5-zone emotion thermometer that measures current relapse risk.
 * It is a DIRECT USER INPUT — not computed, not inferred.
 *
 * VSP Zones (from safe to crisis):
 * 1. GROEN   — Geen spanning
 * 2. GEEL    — Lichte spanning
 * 3. ORANJE  — Hogere spanning / tijd om in te grijpen
 * 4. ROOD    — Terugval dichtbij / actie nodig
 * 5. PAARS   — Herval
 *
 * VspImpact: deterministic behavioral directives per VSP zone.
 * Uses the same field structure as EliasImpact for consistency:
 * - interventionLevel: NONE | LOW | MEDIUM | HIGH | CRISIS
 * - reflectionDepth: NONE | SURFACE | MODERATE | DEEP
 * - directiveStyle: NONE | SUGGEST | GUIDE | DIRECT
 *
 * Each VSP zone maps to exactly one fixed VspImpact. No conditions inside mapping.
 *
 * RULES:
 * - VSP is Elias-only. Kim uses Eigen Regie.
 * - VSP is self-reported, not derived from sliders or crisis detection.
 * - Engine-level ONLY — no pipeline logic, no UI logic.
 * - No combination with Kim data.
 * - No inference. No fallback.
 * - null is valid if user has not submitted VSP yet.
 */

// ─── VSP Level ────────────────────────────────────────────────

/**
 * VSP zones ordered from safe to crisis.
 * This is DIFFERENT from ZoneLevel (ROOD→GROEN) — direction is reversed,
 * and PAARS exists only in VSP (represents active relapse).
 */
export type VspLevel = 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS';

// ─── VSP Impact Enums ─────────────────────────────────────────

export type VspInterventionLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRISIS';
export type VspReflectionDepth = 'NONE' | 'SURFACE' | 'MODERATE' | 'DEEP';
export type VspDirectiveStyle = 'NONE' | 'SUGGEST' | 'GUIDE' | 'DIRECT';

// ─── VSP Impact Type ──────────────────────────────────────────

export interface VspImpact {
  readonly interventionLevel: VspInterventionLevel;
  readonly reflectionDepth: VspReflectionDepth;
  readonly directiveStyle: VspDirectiveStyle;
}

// ─── VSP Result ───────────────────────────────────────────────

export interface VspResult {
  readonly level: VspLevel;
  readonly label: string;
  readonly impact: VspImpact;
}

// ─── VSP Zone Impact Map ──────────────────────────────────────

/**
 * Fixed mapping: VspLevel → VspImpact.
 * Each zone has exactly one deterministic impact object.
 * No conditions. No inference. No deviation.
 *
 * GROEN:  No intervention needed, deep reflection possible
 * GEEL:   Low intervention, moderate reflection, gentle suggestions
 * ORANJE: Medium intervention, surface reflection, active guidance
 * ROOD:   High intervention, no reflection (too acute), direct action
 * PAARS:  Crisis — immediate direct intervention, no reflection
 */
export const vspZoneImpactMap: Readonly<Record<VspLevel, VspImpact>> = Object.freeze({
  GROEN: Object.freeze({
    interventionLevel: 'NONE' as const,
    reflectionDepth: 'DEEP' as const,
    directiveStyle: 'NONE' as const,
  }),
  GEEL: Object.freeze({
    interventionLevel: 'LOW' as const,
    reflectionDepth: 'MODERATE' as const,
    directiveStyle: 'SUGGEST' as const,
  }),
  ORANJE: Object.freeze({
    interventionLevel: 'MEDIUM' as const,
    reflectionDepth: 'SURFACE' as const,
    directiveStyle: 'GUIDE' as const,
  }),
  ROOD: Object.freeze({
    interventionLevel: 'HIGH' as const,
    reflectionDepth: 'NONE' as const,
    directiveStyle: 'DIRECT' as const,
  }),
  PAARS: Object.freeze({
    interventionLevel: 'CRISIS' as const,
    reflectionDepth: 'NONE' as const,
    directiveStyle: 'DIRECT' as const,
  }),
});

// ─── VSP Zone Labels (Dutch) ──────────────────────────────────

export const VSP_ZONE_LABELS: Readonly<Record<VspLevel, string>> = Object.freeze({
  GROEN: 'Geen spanning',
  GEEL: 'Lichte spanning',
  ORANJE: 'Hogere spanning / tijd om in te grijpen',
  ROOD: 'Terugval dichtbij / actie nodig',
  PAARS: 'Herval',
});

// ─── VSP Options (for UI rendering) ──────────────────────────

export const VSP_OPTIONS: readonly { value: VspLevel; label: string; color: string }[] = Object.freeze([
  { value: 'GROEN', label: 'Geen spanning', color: '#22C55E' },
  { value: 'GEEL', label: 'Lichte spanning', color: '#F59E0B' },
  { value: 'ORANJE', label: 'Hogere spanning / tijd om in te grijpen', color: '#F97316' },
  { value: 'ROOD', label: 'Terugval dichtbij / actie nodig', color: '#EF4444' },
  { value: 'PAARS', label: 'Herval', color: '#8B5CF6' },
]);

// ─── Compute VSP Result ───────────────────────────────────────

/**
 * Compute VSP result from user-reported VSP level.
 *
 * Input:  VspLevel (direct user input)
 * Output: VspResult with level, label, and typed impact
 *
 * Returns null if vspLevel is null (user has not submitted VSP yet).
 */
export function computeVsp(vspLevel: VspLevel | null): VspResult | null {
  if (vspLevel === null) {
    return null;
  }

  const label = VSP_ZONE_LABELS[vspLevel];
  const impact = vspZoneImpactMap[vspLevel];

  return Object.freeze({
    level: vspLevel,
    label,
    impact,
  });
}
