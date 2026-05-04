/**
 * VSP Resolution Layer — Elias Engine
 *
 * SEPARATE from computeEliasZone(). This module resolves the final Elias zone
 * by combining the user-reported VSP level with the system-computed zone.
 *
 * computeEliasZone() remains pure — it detects.
 * resolveEliasZone() decides — it resolves.
 *
 * These are two separate responsibilities that MUST NOT be mixed.
 *
 * RESOLUTION LOGIC:
 *
 *   1. vsp == null → BLOCKED_PRECHAT_REQUIRED (no engine decision, no GPT call)
 *   2. vsp == PAARS → finalSeverity = 5, CRISIS mode, VSP_PAARS_OVERRIDE
 *   3. Otherwise:
 *      - vspSeverity = mapVspToSeverity(vsp)
 *      - computedSeverity = mapComputedEliasZoneToSeverity(computedZone)
 *      - finalSeverity = max(vspSeverity, computedSeverity)
 *      - If equal: source = VSP (tie-break)
 *      - If computed > vsp: source = COMPUTED
 *      - If vsp > computed: source = VSP
 *
 * SEVERITY SCALES:
 *
 *   VSP severity:
 *     GROEN = 1, GEEL = 2, ORANJE = 3, ROOD = 4, PAARS = 5
 *
 *   Computed zone severity:
 *     GROEN = 1, LICHTGROEN = 1, GEEL = 2, ORANJE = 3, ROOD = 4
 *
 * FINAL ZONE LABEL MAPPING:
 *   1 = GROEN, 2 = GEEL, 3 = ORANJE, 4 = ROOD, 5 = PAARS
 *
 * RULES:
 * - Engine-level ONLY — no pipeline logic, no UI logic
 * - No default VSP (never insert GROEN for missing VSP)
 * - null VSP = blocked (chat cannot start)
 * - VSP is Elias-only. Kim uses Eigen Regie.
 * - No Kim Eigen Regie types reused for VSP
 * - computeEliasZone() is never called with VSP
 */

import type { ZoneLevel } from '../zone-types';
import type { VspLevel } from './vsp';

// ─── Resolution Reason ────────────────────────────────────────

export type ResolutionReason =
  | 'BLOCKED_PRECHAT_REQUIRED'
  | 'VSP_PAARS_OVERRIDE'
  | 'USER_REPORTED_RISK_HIGHER_THAN_COMPUTED'
  | 'COMPUTED_RISK_HIGHER_THAN_USER_REPORTED'
  | 'VSP_USER_REPORTED_TIE_BREAK';

// ─── Resolution Source ────────────────────────────────────────

export type ResolutionSource = 'VSP' | 'COMPUTED' | 'NONE';

// ─── Final Zone Label ─────────────────────────────────────────

/**
 * Final resolved zone label after VSP + computed combination.
 * Uses 5 levels including PAARS (which does not exist in ZoneLevel).
 */
export type FinalZoneLabel = 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS';

// ─── Resolved Elias Zone ──────────────────────────────────────

export interface ResolvedEliasZone {
  /** Final severity (1–5). null when blocked. */
  readonly finalSeverity: number | null;
  /** Final zone label. null when blocked. */
  readonly finalZoneLabel: FinalZoneLabel | null;
  /** Source of the final decision */
  readonly source: ResolutionSource;
  /** Reason for the resolution */
  readonly reason: ResolutionReason;
  /** Original VSP level (null = not submitted) */
  readonly vspLevel: VspLevel | null;
  /** Original computed zone level */
  readonly computedZone: ZoneLevel;
  /** Whether chat is blocked (VSP not submitted) */
  readonly isBlocked: boolean;
  /** Whether this is a crisis state (PAARS or severity 5) */
  readonly isCrisis: boolean;
}

// ─── Resolution Input ─────────────────────────────────────────

export interface ResolutionInput {
  /** User-reported VSP level. null if not yet submitted. */
  readonly vsp: VspLevel | null;
  /** System-computed zone level from computeEliasZone() */
  readonly computedZone: ZoneLevel;
}

// ─── Severity Mappings ────────────────────────────────────────

/**
 * VSP severity mapping.
 * GROEN=1, GEEL=2, ORANJE=3, ROOD=4, PAARS=5
 */
const VSP_SEVERITY: Readonly<Record<VspLevel, number>> = Object.freeze({
  GROEN: 1,
  GEEL: 2,
  ORANJE: 3,
  ROOD: 4,
  PAARS: 5,
});

/**
 * Computed Elias zone severity mapping.
 * GROEN=1, LICHTGROEN=1, GEEL=2, ORANJE=3, ROOD=4
 *
 * Note: LICHTGROEN maps to 1 (same as GROEN) per specification.
 */
const COMPUTED_SEVERITY: Readonly<Record<ZoneLevel, number>> = Object.freeze({
  GROEN: 1,
  LICHTGROEN: 1,
  GEEL: 2,
  ORANJE: 3,
  ROOD: 4,
});

/**
 * Final severity → FinalZoneLabel mapping.
 * 1=GROEN, 2=GEEL, 3=ORANJE, 4=ROOD, 5=PAARS
 */
const SEVERITY_TO_LABEL: Readonly<Record<number, FinalZoneLabel>> = Object.freeze({
  1: 'GROEN',
  2: 'GEEL',
  3: 'ORANJE',
  4: 'ROOD',
  5: 'PAARS',
});

// ─── Adapter Functions (exported for testing) ─────────────────

export function mapVspToSeverity(vsp: VspLevel): number {
  return VSP_SEVERITY[vsp];
}

export function mapComputedEliasZoneToSeverity(computedZone: ZoneLevel): number {
  return COMPUTED_SEVERITY[computedZone];
}

// ─── Resolution Function ──────────────────────────────────────

/**
 * Resolve the final Elias zone from VSP + computed zone.
 *
 * This is the DECISION layer. computeEliasZone() is the DETECTION layer.
 * They are never mixed.
 *
 * @param input - VSP level (nullable) + computed zone level
 * @returns ResolvedEliasZone with all resolution metadata
 */
export function resolveEliasZone(input: ResolutionInput): ResolvedEliasZone {
  const { vsp, computedZone } = input;

  // Case 1: VSP not submitted → BLOCKED
  if (vsp === null) {
    return Object.freeze({
      finalSeverity: null,
      finalZoneLabel: null,
      source: 'NONE' as const,
      reason: 'BLOCKED_PRECHAT_REQUIRED' as const,
      vspLevel: null,
      computedZone,
      isBlocked: true,
      isCrisis: false,
    });
  }

  // Case 2: PAARS → always CRISIS override
  if (vsp === 'PAARS') {
    return Object.freeze({
      finalSeverity: 5,
      finalZoneLabel: 'PAARS' as FinalZoneLabel,
      source: 'VSP' as const,
      reason: 'VSP_PAARS_OVERRIDE' as const,
      vspLevel: vsp,
      computedZone,
      isBlocked: false,
      isCrisis: true,
    });
  }

  // Case 3: Compare severities
  const vspSeverity = mapVspToSeverity(vsp);
  const computedSeverity = mapComputedEliasZoneToSeverity(computedZone);
  const finalSeverity = Math.max(vspSeverity, computedSeverity);
  const finalZoneLabel = SEVERITY_TO_LABEL[finalSeverity];

  let source: ResolutionSource;
  let reason: ResolutionReason;

  if (vspSeverity === computedSeverity) {
    // Tie → VSP wins
    source = 'VSP';
    reason = 'VSP_USER_REPORTED_TIE_BREAK';
  } else if (computedSeverity > vspSeverity) {
    // System detects higher risk → escalate
    source = 'COMPUTED';
    reason = 'COMPUTED_RISK_HIGHER_THAN_USER_REPORTED';
  } else {
    // User reports higher risk → respect
    source = 'VSP';
    reason = 'USER_REPORTED_RISK_HIGHER_THAN_COMPUTED';
  }

  return Object.freeze({
    finalSeverity,
    finalZoneLabel,
    source,
    reason,
    vspLevel: vsp,
    computedZone,
    isBlocked: false,
    isCrisis: finalSeverity >= 5,
  });
}
