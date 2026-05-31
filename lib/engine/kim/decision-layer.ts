/**
 * Kim Decision Layer
 *
 * Centralizes all Kim decision outputs into one object,
 * including Eigen Regie as a first-class decision input.
 *
 * PURE AGGREGATION ONLY — no new logic, no interpretation.
 *
 * Reads from:
 * - StateAnalysis (state-analyzer.ts)
 * - DominantState (dominant-state-selector.ts)
 * - CrisisAssessment (crisis/detector.ts)
 * - mood sliders (current)
 * - Eigen Regie (user input → engine score → zone → impact)
 * - Kim Zone (from Eigen Regie → ZoneResult)
 *
 * Does NOT modify any input.
 * Does NOT create new behavior.
 * Does NOT combine Eigen Regie with other systems.
 */

import type { StateAnalysis, ToneDirective, PacingDirective } from '../../rugzak/state-analyzer';
import type { DominantState } from '../../rugzak/dominant-state-selector';
import type { CrisisAssessment } from '../../crisis/detector';
import type { MoodSliders } from '../../ai/types';
import type { ZoneColor } from '../../rugzak/short-term-memory-buffer';
import type { ZoneResult } from '../zone-types';
import type { KimImpact } from './zone';
import {
  processEigenRegie,
  type EigenRegieResult,
  type EigenRegieZone,
  type EigenRegieImpact,
} from './eigen-regie';
import { computeKimZone } from './zone';

// ─── Input ──────────────────────────────────────────────────

export interface KimDecisionInput {
  readonly analysis: StateAnalysis;
  readonly dominantState: DominantState;
  readonly crisis: CrisisAssessment;
  readonly moodSliders: MoodSliders;
  readonly currentZoneColor: ZoneColor;
  readonly currentZoneScore: number;
  /**
   * Raw user input from Eigen Regie daily reflection (0–100).
   * "To what extent was your day today determined by the choices of the other person?"
   * 0 = full self-governance, 100 = fully determined by the other person.
   *
   * If not yet submitted today, pass null.
   */
  readonly eigenRegieInput: number | null;
  /** Whether the backpack has at least one section with content. */
  readonly hasBackpackContent: boolean;
}

// ─── Output ─────────────────────────────────────────────────

export interface KimDecision {
  readonly dominantModule: string;
  readonly crisisLevel: number;
  readonly zone: {
    /** Legacy buffer zone color (passthrough from buffer). */
    readonly calculated: ZoneColor;
    /** Engine-computed zone from Eigen Regie. Null if Eigen Regie not submitted. */
    readonly engine: ZoneResult<KimImpact> | null;
  };
  readonly tone: ToneDirective;
  readonly pacing: PacingDirective;
  readonly interventionDepth: number;
  readonly challengeLevel: number;
  /**
   * Eigen Regie result — null if user has not submitted today's reflection.
   * When present, the impact directives should guide Kim's behavior.
   */
  readonly eigenRegie: EigenRegieResult | null;
  /**
   * Kim crisis flag — true when eigenRegie userInput < 10.
   * Equivalent of Elias isCrisis (PAARS). Triggers gpt-4o + ground regulation.
   */
  readonly isKimCrisis: boolean;
  /** Engine-recommended model for this message. */
  readonly recommendedModel: 'gpt-4o' | 'gpt-4o-mini';
  /** Reason for the model recommendation. */
  readonly recommendedModelReason: string;
}

// ─── Aggregation ────────────────────────────────────────────

export function createKimDecision(input: KimDecisionInput): KimDecision {
  if (!input) {
    throw new Error('KimDecisionInput is required');
  }
  if (!input.analysis) {
    throw new Error('KimDecisionInput.analysis is required');
  }
  if (!input.dominantState) {
    throw new Error('KimDecisionInput.dominantState is required');
  }
  if (!input.crisis) {
    throw new Error('KimDecisionInput.crisis is required');
  }

  // Process Eigen Regie if user has submitted today's reflection
  const eigenRegie = input.eigenRegieInput !== null
    ? processEigenRegie(input.eigenRegieInput)
    : null;

  // Compute Kim engine zone from Eigen Regie result
  const engineZone = computeKimZone(eigenRegie);

  // ── Model recommendation logic ──
  // gpt-4o when: isKimCrisis OR riskScore >= 7 OR eigenRegie <= 30 OR backpack has content
  const isKimCrisis = eigenRegie !== null && eigenRegie.userInput < 10;
  const riskScore = input.dominantState.riskScore;
  const eigenRegieScore = eigenRegie?.userInput ?? null;

  let recommendedModel: 'gpt-4o' | 'gpt-4o-mini' = 'gpt-4o-mini';
  let recommendedModelReason = 'default (low complexity)';

  if (isKimCrisis) {
    recommendedModel = 'gpt-4o';
    recommendedModelReason = 'isKimCrisis=true';
  } else if (riskScore >= 7) {
    recommendedModel = 'gpt-4o';
    recommendedModelReason = `riskScore=${riskScore} (>=7)`;
  } else if (eigenRegieScore !== null && eigenRegieScore <= 30) {
    recommendedModel = 'gpt-4o';
    recommendedModelReason = `eigenRegie=${eigenRegieScore} (<=30)`;
  } else if (input.hasBackpackContent) {
    recommendedModel = 'gpt-4o';
    recommendedModelReason = 'backpack has content';
  }

  return Object.freeze({
    // From DominantState
    dominantModule: input.dominantState.dominantModule,

    // From CrisisAssessment
    crisisLevel: input.crisis.level,

    // Zone: legacy buffer passthrough + engine-computed zone
    zone: Object.freeze({
      calculated: input.currentZoneColor,
      engine: engineZone,
    }),

    // From StateAnalysis
    tone: input.analysis.tone,
    pacing: input.analysis.pacing,

    // Direct mapping: interventionDepth = suggestionIntensity
    interventionDepth: input.analysis.suggestionIntensity,

    // Direct mapping: challengeLevel = riskScore / 10, rounded
    challengeLevel: Math.round(input.dominantState.riskScore / 10),

    // Eigen Regie — null if not submitted, full result if submitted
    eigenRegie,

    // Kim crisis: eigenRegie userInput < 10 (user reports almost no self-regulation)
    isKimCrisis,

    // Engine-recommended model
    recommendedModel,
    recommendedModelReason,
  });
}

// Re-export Eigen Regie types for consumers
export type { EigenRegieResult, EigenRegieZone, EigenRegieImpact };
