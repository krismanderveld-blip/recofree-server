/**
 * Elias Decision Layer
 *
 * Centralizes all existing Elias decision outputs into one object.
 * PURE AGGREGATION ONLY — no new logic, no interpretation.
 *
 * Reads from:
 * - StateAnalysis (state-analyzer.ts)
 * - DominantState (dominant-state-selector.ts)
 * - CrisisAssessment (crisis/detector.ts)
 * - stageOfChange (from intake)
 * - mood sliders (current)
 * - Elias Zone (from crisis, distress, resilience, stageOfChange → ZoneResult)
 * - VSP Resolution (resolveEliasZone → ResolvedEliasZone → computeEliasImpact)
 *
 * FLOW:
 *   1. computeEliasZone(...)         → computed zone (detection, pure)
 *   2. resolveEliasZone(vsp, zone)   → ResolvedEliasZone (decision, separate layer)
 *   3. IF isBlocked → HARD STOP. No impact. No GPT. Pipeline must redirect.
 *   4. computeEliasImpact(resolved)  → EliasImpact (behavioral directives)
 *
 * Does NOT modify any input.
 * Does NOT create new behavior.
 * Does NOT mix VSP into computeEliasZone.
 */

import type { StateAnalysis, ToneDirective, PacingDirective } from '../../rugzak/state-analyzer';
import type { DominantState } from '../../rugzak/dominant-state-selector';
import type { CrisisAssessment } from '../../crisis/detector';
import type { MoodSliders, StageOfChange } from '../../ai/types';
import type { ZoneColor } from '../../rugzak/short-term-memory-buffer';
import type { ZoneResult } from '../zone-types';
import type { EliasImpact } from './zone';
import { computeEliasZone } from './zone';
import { eliasDistressScore, eliasResilienceScore } from './slider-interpretation';
import type { VspLevel } from './vsp';
import { resolveEliasZone, type ResolvedEliasZone } from './vsp-resolution';
import { computeEliasImpact } from './vsp-impact';

// ─── Input ──────────────────────────────────────────────────

export interface EliasDecisionInput {
  readonly analysis: StateAnalysis;
  readonly dominantState: DominantState;
  readonly crisis: CrisisAssessment;
  readonly stageOfChange: StageOfChange;
  readonly moodSliders: MoodSliders;
  readonly currentZoneColor: ZoneColor;
  readonly currentZoneScore: number;
  /**
   * VSP (Vroeg Signalerings Plan) — user-reported relapse risk level.
   * null if user has not submitted VSP yet this session.
   * When null: resolvedZone.isBlocked = true → pipeline HARD STOP.
   */
  readonly vspInput: VspLevel | null;
  /** Whether the backpack has at least one section with content. */
  readonly hasBackpackContent: boolean;
}

// ─── Output ─────────────────────────────────────────────────

export interface EliasDecision {
  readonly dominantModule: string;
  readonly crisisLevel: number;
  readonly zone: {
    /** Legacy buffer zone color (passthrough from buffer). */
    readonly calculated: ZoneColor;
    /** Engine-computed zone from Elias engine outputs (detection, pure). */
    readonly computed: ZoneResult<EliasImpact>;
    /** Resolved zone from VSP resolution layer (decision). */
    readonly resolved: ResolvedEliasZone;
    /** Final EliasImpact based on resolved zone. null when blocked. */
    readonly impact: EliasImpact | null;
  };
  readonly tone: ToneDirective;
  readonly pacing: PacingDirective;
  readonly interventionDepth: number;
  readonly challengeLevel: number;
  /** Whether chat is blocked (VSP not submitted). Pipeline HARD STOP. */
  readonly isBlocked: boolean;
  /** Engine-recommended model for this message. */
  readonly recommendedModel: 'gpt-4o' | 'gpt-4o-mini';
  /** Reason for the model recommendation. */
  readonly recommendedModelReason: string;
}

// ─── Aggregation ────────────────────────────────────────────

export function createEliasDecision(input: EliasDecisionInput): EliasDecision {
  if (!input) {
    throw new Error('EliasDecisionInput is required');
  }
  if (!input.analysis) {
    throw new Error('EliasDecisionInput.analysis is required');
  }
  if (!input.dominantState) {
    throw new Error('EliasDecisionInput.dominantState is required');
  }
  if (!input.crisis) {
    throw new Error('EliasDecisionInput.crisis is required');
  }

  // Step 1: Compute Elias zone (detection — pure, no VSP)
  const computedZone = computeEliasZone({
    crisisLevel: input.crisis.level,
    distressScore: eliasDistressScore(input.moodSliders),
    resilienceScore: eliasResilienceScore(input.moodSliders),
    stageOfChange: input.stageOfChange,
  });

  // Step 2: Resolve final zone (decision — separate layer)
  const resolvedZone = resolveEliasZone({
    vsp: input.vspInput,
    computedZone: computedZone.level,
  });

  // Step 3: HARD STOP check — if blocked, NO impact computation
  // Pipeline must not proceed to GPT when isBlocked == true
  const impact: EliasImpact | null = resolvedZone.isBlocked
    ? null
    : computeEliasImpact(resolvedZone);

  // ── Model recommendation logic ──
  // gpt-4o when: isCrisis OR riskScore >= 7 OR vspLevel >= ORANJE (always, regardless of other conditions) OR backpack has content
  const isCrisis = resolvedZone.isCrisis;
  const riskScore = input.dominantState.riskScore;
  const vspLevel = input.vspInput;
  const vspIsHighRisk = vspLevel === 'ORANJE' || vspLevel === 'ROOD' || vspLevel === 'PAARS';

  let recommendedModel: 'gpt-4o' | 'gpt-4o-mini' = 'gpt-4o-mini';
  let recommendedModelReason = 'default (low complexity)';

  if (isCrisis) {
    recommendedModel = 'gpt-4o';
    recommendedModelReason = 'isCrisis=true';
  } else if (riskScore >= 7) {
    recommendedModel = 'gpt-4o';
    recommendedModelReason = `riskScore=${riskScore} (>=7)`;
  } else if (vspIsHighRisk) {
    recommendedModel = 'gpt-4o';
    recommendedModelReason = `vspLevel=${vspLevel} (>=ORANJE)`;
  } else if (input.hasBackpackContent) {
    recommendedModel = 'gpt-4o';
    recommendedModelReason = 'backpack has content';
  }

  return Object.freeze({
    // From DominantState
    dominantModule: input.dominantState.dominantModule,

    // From CrisisAssessment
    crisisLevel: input.crisis.level,

    // Zone: legacy buffer passthrough + computed + resolved + impact
    zone: Object.freeze({
      calculated: input.currentZoneColor,
      computed: computedZone,
      resolved: resolvedZone,
      impact,
    }),

    // From StateAnalysis
    tone: input.analysis.tone,
    pacing: input.analysis.pacing,

    // Direct mapping: interventionDepth = suggestionIntensity
    interventionDepth: input.analysis.suggestionIntensity,

    // Direct mapping: challengeLevel = riskScore / 10, rounded
    challengeLevel: Math.round(input.dominantState.riskScore / 10),

    // Blocked state propagated from resolution layer
    isBlocked: resolvedZone.isBlocked,

    // Engine-recommended model
    recommendedModel,
    recommendedModelReason,
  });
}
