/**
 * Orchestration — Routing Layer
 *
 * Selects the correct engine output based on userType.
 * Elias users get EliasImpact. Kim users get KimImpact.
 * Never both. Never merged.
 *
 * RULES:
 * - No merging of EliasImpact and KimImpact
 * - No conflict resolution
 * - No derived values
 * - No transformation
 * - Pure routing only
 */

import type { UserType } from '../ai/types';
import type { ZoneLevel } from './zone-types';
import type { EliasImpact } from './elias/zone';
import type { KimImpact } from './kim/zone';

// ─── Engine Directive (Discriminated Union) ───────────────────

export interface EliasDirective {
  readonly engine: 'elias';
  readonly zoneLevel: ZoneLevel;
  readonly zoneLabel: string;
  readonly impact: EliasImpact;
}

export interface KimDirective {
  readonly engine: 'kim';
  readonly zoneLevel: ZoneLevel;
  readonly zoneLabel: string;
  readonly impact: KimImpact;
}

export type EngineDirective = EliasDirective | KimDirective;

// ─── Routing Input ────────────────────────────────────────────

export interface RoutingInput {
  readonly userType: UserType;
  readonly eliasZone: {
    readonly level: ZoneLevel;
    readonly label: string;
    readonly impact: EliasImpact;
  } | null;
  readonly kimZone: {
    readonly level: ZoneLevel;
    readonly label: string;
    readonly impact: KimImpact;
  } | null;
}

// ─── Route Engine Directive ───────────────────────────────────

/**
 * Select the correct engine directive based on userType.
 *
 * - userType 'elias' → EliasDirective (from Elias zone)
 * - userType 'kim' → KimDirective (from Kim zone), or null if Kim zone unavailable
 *
 * Returns null only when Kim user has not submitted Eigen Regie.
 */
export function routeEngineDirective(input: RoutingInput): EngineDirective | null {
  if (input.userType === 'elias') {
    if (input.eliasZone === null) {
      return null;
    }
    return Object.freeze({
      engine: 'elias' as const,
      zoneLevel: input.eliasZone.level,
      zoneLabel: input.eliasZone.label,
      impact: input.eliasZone.impact,
    });
  }

  if (input.userType === 'kim') {
    if (input.kimZone === null) {
      return null;
    }
    return Object.freeze({
      engine: 'kim' as const,
      zoneLevel: input.kimZone.level,
      zoneLabel: input.kimZone.label,
      impact: input.kimZone.impact,
    });
  }

  return null;
}
