/**
 * SW01 Shadow Work — Storage Contract
 *
 * Manages session state and progress persistence for SW01.
 * Follows the same pattern as K04/K06 modules.
 *
 * CANON: shadowwork.txt section 19
 */

import type { SW01Progress, SW01EngineResult, InterventionMode } from './sw01_shadow_types';
import { createDefaultSW01Progress } from './sw01_shadow_types';

// ─── Session State ───────────────────────────────────────────────────────────

export interface SW01SessionState {
  active: boolean;
  signalsDetected: number;
  loopsNamed: string[];
  projectionsProcessed: number;
  journalPromptsGiven: number;
  lastInterventionMode: InterventionMode | null;
  peakConfidence: number;
}

let sessionState: SW01SessionState = createDefaultSessionState();

function createDefaultSessionState(): SW01SessionState {
  return {
    active: false,
    signalsDetected: 0,
    loopsNamed: [],
    projectionsProcessed: 0,
    journalPromptsGiven: 0,
    lastInterventionMode: null,
    peakConfidence: 0,
  };
}

// ─── Session State Management ────────────────────────────────────────────────

export function getSW01SessionState(): SW01SessionState {
  return { ...sessionState };
}

export function resetSW01SessionState(): void {
  sessionState = createDefaultSessionState();
}

export function updateSW01SessionState(result: SW01EngineResult): void {
  if (!result.active) return;

  sessionState.active = true;
  sessionState.signalsDetected += result.signals.length;
  sessionState.lastInterventionMode = result.interventionMode;

  if (result.confidence > sessionState.peakConfidence) {
    sessionState.peakConfidence = result.confidence;
  }

  if (result.activeLoop && !sessionState.loopsNamed.includes(result.activeLoop.loop_id)) {
    sessionState.loopsNamed.push(result.activeLoop.loop_id);
  }

  if (result.projectionActive) {
    sessionState.projectionsProcessed += 1;
  }

  if (result.interventionMode === 'journal_prompt' || result.journalPrompt) {
    sessionState.journalPromptsGiven += 1;
  }
}

// ─── Progress Persistence ────────────────────────────────────────────────────

/**
 * Update SW01Progress at end of session based on session state.
 */
export function updateSW01Progress(
  existing: SW01Progress | undefined
): SW01Progress {
  const progress = existing ?? createDefaultSW01Progress();

  if (!sessionState.active) return progress;

  progress.sessionsWithShadowWork += 1;

  // Merge loops identified
  for (const loopId of sessionState.loopsNamed) {
    if (!progress.loopsIdentified.includes(loopId)) {
      progress.loopsIdentified.push(loopId);
    }
  }

  // Update projections processed
  progress.projectionsProcessed += sessionState.projectionsProcessed;

  // Update journal prompts given
  progress.journalPromptsGiven += sessionState.journalPromptsGiven;

  // Update last active loop
  if (sessionState.loopsNamed.length > 0) {
    progress.lastActiveLoop = sessionState.loopsNamed[sessionState.loopsNamed.length - 1];
  }

  // Update last intervention mode
  if (sessionState.lastInterventionMode) {
    progress.lastInterventionMode = sessionState.lastInterventionMode;
  }

  return progress;
}
