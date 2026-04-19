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
   * "In hoeverre werd jouw dag vandaag bepaald door de keuzes van de ander?"
   * 0 = volledig eigen regie, 100 = volledig bepaald door de ander.
   *
   * If not yet submitted today, pass null.
   */
  readonly eigenRegieInput: number | null;
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
  });
}

// Re-export Eigen Regie types for consumers
export type { EigenRegieResult, EigenRegieZone, EigenRegieImpact };
