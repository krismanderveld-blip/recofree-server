/**
 * GUIDANCE DEPTH RESOLVER
 * 
 * Determines the effective response depth deterministically.
 * Shared between Kim and Elias. No server dependency.
 * 
 * Rules (priority order):
 * 1. Safety/crisis wins always
 * 2. Purple/red forces low/stabilizing
 * 3. Orange caps at medium
 * 4. Insufficient context caps at low
 * 5. Relational harm forces minimum medium (Kim)
 * 6. Relapse risk forces minimum medium (Elias)
 * 7. Explicit deep request elevates to high
 * 8. Default mapping (light→low, normal→medium, deep→high)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserGuidanceDepth = 'light' | 'normal' | 'deep';
export type EffectiveDepth = 'safety' | 'low' | 'medium' | 'high';
export type FormulationMode = 'none' | 'low' | 'medium' | 'high';
export type ContextQuality = 'insufficient' | 'partial' | 'sufficient' | 'rich';
export type Persona = 'kim' | 'elias';

export interface GuidanceDepthInput {
  persona: Persona;
  userGuidanceDepth: UserGuidanceDepth;
  zone: string;
  crisisLevel: number;
  safetyFirstActive: boolean;
  relationalHarmPatternActive: boolean;
  relapseRiskActive: boolean;
  explicitDeepRequest: boolean;
  contextQuality: ContextQuality;
}

export interface GuidanceDepthResult {
  userDepth: UserGuidanceDepth;
  effectiveDepth: EffectiveDepth;
  maxFormulationMode: FormulationMode;
  reason: string;
  wasUserDepthOverridden: boolean;
}

// ─── Resolver ────────────────────────────────────────────────────────────────

export function resolveGuidanceDepth(input: GuidanceDepthInput): GuidanceDepthResult {
  const { persona, userGuidanceDepth, zone, crisisLevel, safetyFirstActive, relationalHarmPatternActive, relapseRiskActive, explicitDeepRequest, contextQuality } = input;

  const normalizedZone = zone?.toLowerCase() ?? 'green';

  // ── RULE 1: Safety/crisis wins always ──
  if (safetyFirstActive || crisisLevel >= 2) {
    return {
      userDepth: userGuidanceDepth,
      effectiveDepth: 'safety',
      maxFormulationMode: 'none',
      reason: 'safety_first',
      wasUserDepthOverridden: true,
    };
  }

  // ── RULE 2: Purple/red forces low/stabilizing ──
  if (normalizedZone === 'purple' || normalizedZone === 'red') {
    return {
      userDepth: userGuidanceDepth,
      effectiveDepth: 'low',
      maxFormulationMode: 'low',
      reason: 'zone_limits_depth',
      wasUserDepthOverridden: userGuidanceDepth !== 'light',
    };
  }

  // ── RULE 3: Orange caps at medium ──
  if (normalizedZone === 'orange') {
    let effectiveDepth: EffectiveDepth;
    if (userGuidanceDepth === 'light') {
      effectiveDepth = 'low';
    } else {
      effectiveDepth = 'medium';
    }
    return {
      userDepth: userGuidanceDepth,
      effectiveDepth,
      maxFormulationMode: effectiveDepth,
      reason: 'orange_max_medium',
      wasUserDepthOverridden: userGuidanceDepth === 'deep',
    };
  }

  // ── RULE 4: Insufficient context caps at low ──
  if (contextQuality === 'insufficient') {
    return {
      userDepth: userGuidanceDepth,
      effectiveDepth: 'low',
      maxFormulationMode: 'low',
      reason: 'insufficient_context',
      wasUserDepthOverridden: userGuidanceDepth !== 'light',
    };
  }

  // ── RULE 7: Explicit deep request (checked before 5/6 to allow override) ──
  if (explicitDeepRequest && (contextQuality === 'sufficient' || contextQuality === 'rich') && normalizedZone !== 'orange') {
    return {
      userDepth: userGuidanceDepth,
      effectiveDepth: 'high',
      maxFormulationMode: 'high',
      reason: 'explicit_deep_request',
      wasUserDepthOverridden: userGuidanceDepth !== 'deep',
    };
  }

  // ── RULE 5: Relational harm forces minimum medium (Kim only) ──
  if (persona === 'kim' && relationalHarmPatternActive) {
    const baseDepth = mapUserDepthToEffective(userGuidanceDepth);
    const effectiveDepth: EffectiveDepth = baseDepth === 'low' ? 'medium' : baseDepth;
    const formulationMode: FormulationMode = effectiveDepth === 'safety' ? 'none' : effectiveDepth;
    return {
      userDepth: userGuidanceDepth,
      effectiveDepth,
      maxFormulationMode: formulationMode,
      reason: baseDepth === 'low' ? 'harm_requires_minimum_depth' : `harm_active_depth_${effectiveDepth}`,
      wasUserDepthOverridden: baseDepth === 'low',
    };
  }

  // ── RULE 6: Relapse risk forces minimum medium (Elias only) ──
  if (persona === 'elias' && relapseRiskActive) {
    const baseDepth = mapUserDepthToEffective(userGuidanceDepth);
    const effectiveDepth: EffectiveDepth = baseDepth === 'low' ? 'medium' : baseDepth;
    const formulationMode: FormulationMode = effectiveDepth === 'safety' ? 'none' : effectiveDepth;
    return {
      userDepth: userGuidanceDepth,
      effectiveDepth,
      maxFormulationMode: formulationMode,
      reason: baseDepth === 'low' ? 'relapse_requires_minimum_depth' : `relapse_active_depth_${effectiveDepth}`,
      wasUserDepthOverridden: baseDepth === 'low',
    };
  }

  // ── RULE 8: Default mapping (green/yellow, no overrides) ──
  const effectiveDepth = mapUserDepthToEffective(userGuidanceDepth);
  const formulationMode: FormulationMode = effectiveDepth === 'safety' ? 'none' : effectiveDepth;
  return {
    userDepth: userGuidanceDepth,
    effectiveDepth,
    maxFormulationMode: formulationMode,
    reason: 'default_mapping',
    wasUserDepthOverridden: false,
  };
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function mapUserDepthToEffective(userDepth: UserGuidanceDepth): EffectiveDepth {
  switch (userDepth) {
    case 'light': return 'low';
    case 'normal': return 'medium';
    case 'deep': return 'high';
    default: return 'medium';
  }
}
