/**
 * VSP Insight Phase Tracker
 *
 * Tracks phase transitions (state changes) across sessions.
 * Detects when user moves between insight states and records:
 * - Duration in state
 * - What helped (soothing option, grounding, etc.)
 * - Source signals that triggered transition
 *
 * All data stored locally only (never communicated).
 */

import type {
  VspInsightState,
  VspZone,
  VspPhaseTransitionCandidate,
  VspPhaseTransitionExample,
  VspSignalSource,
  VspMoodSlidersSnapshot,
  VspSoothingChoiceEvent,
} from "./vspInsightTypes";

export interface PhaseTrackerState {
  currentState: VspInsightState;
  currentZone: VspZone;
  enteredAt: string; // ISO timestamp
  lastSoothingChoiceEvent: VspSoothingChoiceEvent | null;
}

/**
 * Detect if a phase transition has occurred.
 * Returns a candidate if state changed, null otherwise.
 */
export function detectPhaseTransition(
  previous: PhaseTrackerState | null,
  current: {
    insightState: VspInsightState;
    zone: VspZone;
    nowIso: string;
    sourceSignals: VspSignalSource[];
    lastSoothingChoiceEvent: VspSoothingChoiceEvent | null;
  }
): VspPhaseTransitionCandidate | null {
  if (!previous) return null;

  // No transition if state hasn't changed
  if (previous.currentState === current.insightState) return null;

  // Calculate duration
  const enteredMs = new Date(previous.enteredAt).getTime();
  const nowMs = new Date(current.nowIso).getTime();
  const durationSeconds = Math.max(0, Math.round((nowMs - enteredMs) / 1000));

  // Determine if a soothing action helped
  let helpfulActionId: string | null = null;
  if (
    previous.lastSoothingChoiceEvent &&
    isPositiveTransition(previous.currentState, current.insightState)
  ) {
    helpfulActionId = previous.lastSoothingChoiceEvent.selectedOptionId;
  }

  // Calculate confidence based on signal count and duration
  const confidence = computeTransitionConfidence(
    durationSeconds,
    current.sourceSignals.length,
    previous.currentState,
    current.insightState
  );

  return {
    fromState: previous.currentState,
    toState: current.insightState,
    fromZone: previous.currentZone,
    toZone: current.zone,
    transitionAt: current.nowIso,
    durationSeconds,
    possibleHelpfulActionId: helpfulActionId,
    sourceSignals: current.sourceSignals,
    confidence,
  };
}

/**
 * Convert a transition candidate to a stored example.
 * Generates safe summary text (no raw user content).
 */
export function candidateToExample(
  candidate: VspPhaseTransitionCandidate,
  exampleId: string,
  triggerContext: string,
  helpfulAction: string | null
): VspPhaseTransitionExample {
  return {
    exampleId,
    fromState: candidate.fromState,
    toState: candidate.toState,
    fromZone: candidate.fromZone,
    toZone: candidate.toZone,
    transitionAt: candidate.transitionAt,
    durationSeconds: candidate.durationSeconds,
    triggerContextSafeSummary: triggerContext,
    helpfulActionSafeSummary: helpfulAction,
    soothingOptionId: candidate.possibleHelpfulActionId,
    userConfirmedHelpful: null, // to be confirmed later
    sourceSignals: candidate.sourceSignals,
  };
}

/**
 * Create a new phase tracker state.
 */
export function createPhaseTrackerState(
  insightState: VspInsightState,
  zone: VspZone,
  nowIso: string,
  lastSoothingChoiceEvent: VspSoothingChoiceEvent | null = null
): PhaseTrackerState {
  return {
    currentState: insightState,
    currentZone: zone,
    enteredAt: nowIso,
    lastSoothingChoiceEvent,
  };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Determine if transition is "positive" (toward safety/green).
 */
function isPositiveTransition(from: VspInsightState, to: VspInsightState): boolean {
  const stateOrder: Record<VspInsightState, number> = {
    OVERWHELMED_ORANGE_RED: 0,
    RATIONAL_GREEN: 1,
    REAL_GREEN: 2,
    UNKNOWN: 0,
  };
  return stateOrder[to] > stateOrder[from];
}

/**
 * Compute confidence of transition detection.
 */
function computeTransitionConfidence(
  durationSeconds: number,
  signalCount: number,
  fromState: VspInsightState,
  toState: VspInsightState
): number {
  let confidence = 0.5;

  // More signals = higher confidence
  if (signalCount >= 3) confidence += 0.2;
  else if (signalCount >= 1) confidence += 0.1;

  // Longer duration in previous state = more reliable transition
  if (durationSeconds >= 300) confidence += 0.15; // 5+ minutes
  else if (durationSeconds >= 60) confidence += 0.1; // 1+ minute

  // Dramatic transitions (overwhelm → real green) are more notable
  if (fromState === "OVERWHELMED_ORANGE_RED" && toState === "REAL_GREEN") {
    confidence += 0.1;
  }

  return Math.min(1.0, confidence);
}
