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
 *
 * Does NOT modify any input.
 * Does NOT create new behavior.
 */

import type { StateAnalysis, ToneDirective, PacingDirective } from '../../rugzak/state-analyzer';
import type { DominantState } from '../../rugzak/dominant-state-selector';
import type { CrisisAssessment } from '../../crisis/detector';
import type { MoodSliders, StageOfChange } from '../../ai/types';
import type { ZoneColor } from '../../rugzak/short-term-memory-buffer';

// ─── Input ──────────────────────────────────────────────────

export interface EliasDecisionInput {
  readonly analysis: StateAnalysis;
  readonly dominantState: DominantState;
  readonly crisis: CrisisAssessment;
  readonly stageOfChange: StageOfChange;
  readonly moodSliders: MoodSliders;
  readonly currentZoneColor: ZoneColor;
  readonly currentZoneScore: number;
}

// ─── Output ─────────────────────────────────────────────────

export interface EliasDecision {
  readonly dominantModule: string;
  readonly crisisLevel: number;
  readonly zone: {
    readonly calculated: ZoneColor;
  };
  readonly tone: ToneDirective;
  readonly pacing: PacingDirective;
  readonly interventionDepth: number;
  readonly challengeLevel: number;
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

  return Object.freeze({
    // From DominantState
    dominantModule: input.dominantState.dominantModule,

    // From CrisisAssessment
    crisisLevel: input.crisis.level,

    // From buffer zone (passed through input)
    zone: Object.freeze({
      calculated: input.currentZoneColor,
    }),

    // From StateAnalysis
    tone: input.analysis.tone,
    pacing: input.analysis.pacing,

    // Direct mapping: interventionDepth = suggestionIntensity
    interventionDepth: input.analysis.suggestionIntensity,

    // Direct mapping: challengeLevel = riskScore / 10, rounded
    challengeLevel: Math.round(input.dominantState.riskScore / 10),
  });
}
