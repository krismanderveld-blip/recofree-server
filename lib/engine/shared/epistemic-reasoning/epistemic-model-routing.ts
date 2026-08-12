/**
 * FASE 9A: Epistemic Model Routing — Contract & Resolver
 *
 * Deterministic model selection based on epistemic complexity.
 * NOT YET INTEGRATED into pipeline/provider.
 * Pure function only.
 */

import type { EpistemicPersona } from './epistemic-reasoning-types';

// ─── 1. EpistemicModelRoutingInput ─────────────────────────────────────────────

export interface EpistemicModelRoutingInput {
  currentZone?: string | null;
  riskScore?: number | null;
  crisisLevel?: number | null;
  cravingLevel?: number | null;
  stressLevel?: number | null;
  cmdSelectedItemsCount?: number;
  cmdEstimatedTokens?: number;
  epistemicComplexityScore?: number;
  responsibilityComplexityScore?: number;
  medicalUncertainty?: boolean;
  contradictionDetected?: boolean;
  mindReadingRisk?: boolean;
  rescueRoleRisk?: boolean;
  relapseRisk?: boolean;
  relationalHarmRisk?: boolean;
  persona: EpistemicPersona;
}

// ─── 2. EpistemicModelRoutingOutput ────────────────────────────────────────────

export interface EpistemicModelRoutingOutput {
  selectedModel: 'gpt-4o-mini' | 'gpt-4o-2024-08-06';
  modelTier: 'mini' | 'full';
  score: number;
  mustUseFullModel: boolean;
  reasonCodes: string[];
}

// ─── 3. resolveEpistemicModelRouting ───────────────────────────────────────────

export function resolveEpistemicModelRouting(input: EpistemicModelRoutingInput): EpistemicModelRoutingOutput {
  let score = 0;
  const reasonCodes: string[] = [];

  // ── Base zone scoring ──
  const zone = (input.currentZone ?? 'green').toLowerCase();
  if (zone === 'green') score += 0;
  else if (zone === 'yellow') score += 10;
  else if (zone === 'orange') { score += 30; reasonCodes.push('zone_orange'); }
  else if (zone === 'red') { score += 60; reasonCodes.push('zone_red'); }
  else if (zone === 'purple') { score += 80; reasonCodes.push('zone_purple'); }

  // ── Safety scoring ──
  if ((input.crisisLevel ?? 0) >= 1) { score += 100; reasonCodes.push('crisis_active'); }
  if (input.medicalUncertainty) { score += 25; reasonCodes.push('medical_uncertainty'); }
  if (input.contradictionDetected) { score += 40; reasonCodes.push('contradiction_detected'); }

  // ── Memory scoring ──
  const cmdTokens = input.cmdEstimatedTokens ?? 0;
  if (cmdTokens > 900) { score += 40; reasonCodes.push('cmd_tokens_very_high'); }
  else if (cmdTokens > 600) { score += 25; reasonCodes.push('cmd_tokens_high'); }
  else if (cmdTokens > 300) { score += 10; reasonCodes.push('cmd_tokens_moderate'); }

  // ── Kim-specific scoring ──
  if (input.persona === 'kim') {
    if (input.rescueRoleRisk) { score += 25; reasonCodes.push('kim_rescue_role_risk'); }
    if (input.relationalHarmRisk) { score += 25; reasonCodes.push('kim_relational_harm_risk'); }
    if ((input.responsibilityComplexityScore ?? 0) >= 40) { score += 25; reasonCodes.push('kim_responsibility_complex'); }
  }

  // ── Elias-specific scoring ──
  if (input.persona === 'elias') {
    if (input.relapseRisk) { score += 35; reasonCodes.push('elias_relapse_risk'); }
    if ((input.cravingLevel ?? 0) >= 7) { score += 25; reasonCodes.push('elias_craving_high'); }
  }

  // ── Hard overrides ──
  let mustUseFullModel = false;

  if ((input.crisisLevel ?? 0) >= 1) mustUseFullModel = true;
  if (zone === 'red' || zone === 'purple') mustUseFullModel = true;
  if (input.medicalUncertainty && (input.responsibilityComplexityScore ?? 0) >= 40) mustUseFullModel = true;
  if (input.relapseRisk && (input.cravingLevel ?? 0) >= 7) mustUseFullModel = true;

  // ── Final routing decision ──
  const useFull = mustUseFullModel || score >= 40;

  return {
    selectedModel: useFull ? 'gpt-4o-2024-08-06' : 'gpt-4o-mini',
    modelTier: useFull ? 'full' : 'mini',
    score,
    mustUseFullModel,
    reasonCodes,
  };
}
