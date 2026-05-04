/**
 * VSP Impact — Elias Engine
 *
 * Maps the resolved zone to an EliasImpact.
 * This is called AFTER resolveEliasZone() produces a ResolvedEliasZone.
 *
 * Flow:
 *   computeEliasZone(...)        → computed zone (detection)
 *   resolveEliasZone(vsp, zone)  → ResolvedEliasZone (decision)
 *   computeEliasImpact(resolved) → EliasImpact (behavioral directives)
 *
 * computeEliasImpact receives the FULL ResolvedEliasZone, not just finalZoneLabel.
 * Reason: impact may depend on context (source, reason, isCrisis, etc.)
 *
 * RULES:
 * - Engine-level ONLY
 * - No pipeline logic, no UI logic
 * - NEVER called when resolvedZone.isBlocked == true (hard stop before this point)
 * - Each finalZoneLabel maps to exactly one fixed EliasImpact
 * - No conditions. No inference. No deviation.
 */

import type { EliasImpact } from './zone';
import type { ResolvedEliasZone, FinalZoneLabel } from './vsp-resolution';

// ─── Final Zone Impact Map ────────────────────────────────────

/**
 * Fixed mapping: FinalZoneLabel → EliasImpact.
 *
 * GROEN:  No intervention, deep reflection possible
 * GEEL:   Medium intervention, moderate reflection, guided
 * ORANJE: High intervention, surface reflection, direct
 * ROOD:   Crisis intervention, no reflection, direct
 * PAARS:  Crisis intervention, no reflection, direct (same as ROOD — both are crisis)
 */
export const finalZoneImpactMap: Readonly<Record<FinalZoneLabel, EliasImpact>> = Object.freeze({
  GROEN: Object.freeze({
    interventionLevel: 'NONE' as const,
    reflectionDepth: 'DEEP' as const,
    directiveStyle: 'NONE' as const,
  }),
  GEEL: Object.freeze({
    interventionLevel: 'MEDIUM' as const,
    reflectionDepth: 'MODERATE' as const,
    directiveStyle: 'GUIDE' as const,
  }),
  ORANJE: Object.freeze({
    interventionLevel: 'HIGH' as const,
    reflectionDepth: 'SURFACE' as const,
    directiveStyle: 'DIRECT' as const,
  }),
  ROOD: Object.freeze({
    interventionLevel: 'CRISIS' as const,
    reflectionDepth: 'NONE' as const,
    directiveStyle: 'DIRECT' as const,
  }),
  PAARS: Object.freeze({
    interventionLevel: 'CRISIS' as const,
    reflectionDepth: 'NONE' as const,
    directiveStyle: 'DIRECT' as const,
  }),
});

// ─── Compute Impact ───────────────────────────────────────────

/**
 * Compute EliasImpact from the full ResolvedEliasZone.
 *
 * PRECONDITION: resolvedZone.isBlocked MUST be false.
 * If isBlocked is true, this function MUST NOT be called (hard stop in pipeline).
 *
 * @param resolvedZone - The full ResolvedEliasZone from resolveEliasZone().
 *                       Contains finalSeverity, finalZoneLabel, source, reason,
 *                       vspLevel, computedZone, isCrisis.
 * @returns EliasImpact — deterministic behavioral directives
 * @throws Error if called with a blocked zone (programming error)
 */
export function computeEliasImpact(resolvedZone: ResolvedEliasZone): EliasImpact {
  if (resolvedZone.isBlocked) {
    throw new Error(
      'computeEliasImpact() MUST NOT be called when resolvedZone.isBlocked == true. ' +
      'Pipeline must hard-stop before reaching this point.'
    );
  }

  if (resolvedZone.finalZoneLabel === null) {
    throw new Error(
      'computeEliasImpact() received null finalZoneLabel on a non-blocked zone. ' +
      'This indicates a bug in resolveEliasZone().'
    );
  }

  return finalZoneImpactMap[resolvedZone.finalZoneLabel];
}
