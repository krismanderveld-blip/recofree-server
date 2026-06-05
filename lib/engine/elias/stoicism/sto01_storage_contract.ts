/**
 * STO01 Stoicism Integration — Storage Contract
 *
 * Session state management and progress persistence for STO01.
 * Follows the same pattern as SW01 storage contract.
 *
 * MODULE_ID: STO01
 * PIPELINE POSITION: 5e4 (after SW01)
 */

import type {
  STO01SessionState,
  STO01Progress,
  STO01Principle,
  STO01InterventionType,
  STO01ActivationStrength,
} from './sto01_types';
import { createDefaultSTO01Progress } from './sto01_types';

// ─── Session State (in-memory, reset per session) ───────────────────────────

let sessionState: STO01SessionState = {
  active: false,
  activationsThisSession: 0,
  principlesUsed: [],
  interventionsUsed: [],
  lastActivationStrength: null,
  peakActivationStrength: null,
};

/**
 * Get the current STO01 session state.
 */
export function getSTO01SessionState(): STO01SessionState {
  return { ...sessionState };
}

/**
 * Reset STO01 session state. Called at session start.
 */
export function resetSTO01SessionState(): void {
  sessionState = {
    active: false,
    activationsThisSession: 0,
    principlesUsed: [],
    interventionsUsed: [],
    lastActivationStrength: null,
    peakActivationStrength: null,
  };
}

/**
 * Update STO01 session state after an activation.
 */
export function updateSTO01SessionState(
  principle: STO01Principle,
  intervention: STO01InterventionType,
  strength: STO01ActivationStrength
): void {
  sessionState.active = true;
  sessionState.activationsThisSession += 1;

  if (!sessionState.principlesUsed.includes(principle)) {
    sessionState.principlesUsed.push(principle);
  }
  if (!sessionState.interventionsUsed.includes(intervention)) {
    sessionState.interventionsUsed.push(intervention);
  }

  sessionState.lastActivationStrength = strength;

  // Track peak activation strength
  const strengthOrder: STO01ActivationStrength[] = ['low', 'medium', 'high'];
  const currentPeakIdx = sessionState.peakActivationStrength
    ? strengthOrder.indexOf(sessionState.peakActivationStrength)
    : -1;
  const newIdx = strengthOrder.indexOf(strength);
  if (newIdx > currentPeakIdx) {
    sessionState.peakActivationStrength = strength;
  }
}

// ─── Progress Persistence (stored in userDat) ───────────────────────────────

/**
 * Update STO01 progress after a session ends.
 * Called by the pipeline during post-chat continuity update.
 */
export function updateSTO01Progress(
  existing: STO01Progress | undefined,
  sessionStateSnapshot: STO01SessionState
): STO01Progress {
  const progress = existing ?? createDefaultSTO01Progress();

  if (!sessionStateSnapshot.active) {
    return progress;
  }

  progress.sessionsWithStoicism += 1;
  progress.totalActivations += sessionStateSnapshot.activationsThisSession;

  // Merge principles used
  for (const p of sessionStateSnapshot.principlesUsed) {
    if (!progress.principlesUsedAllTime.includes(p)) {
      progress.principlesUsedAllTime.push(p);
    }
  }

  // Merge interventions used
  for (const i of sessionStateSnapshot.interventionsUsed) {
    if (!progress.interventionsUsedAllTime.includes(i)) {
      progress.interventionsUsedAllTime.push(i);
    }
  }

  // Update last used
  if (sessionStateSnapshot.principlesUsed.length > 0) {
    progress.lastPrincipleUsed =
      sessionStateSnapshot.principlesUsed[sessionStateSnapshot.principlesUsed.length - 1];
  }
  if (sessionStateSnapshot.interventionsUsed.length > 0) {
    progress.lastInterventionUsed =
      sessionStateSnapshot.interventionsUsed[sessionStateSnapshot.interventionsUsed.length - 1];
  }

  return progress;
}
