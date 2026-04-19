/**
 * Block 8: Failsafe Skeleton
 * Shared Engine — Pure state definition
 *
 * - Accepts SessionImpact
 * - Produces FailsafeState: limits, current counts, flags
 * - No blocking behavior, no trimming, no cleanup
 * - No prioritization, decay, escalation
 * - No linking to zone, personas, or GPT
 * - No side effects
 */

import { SessionImpact } from "./session-impact";

/** Static limits. */
export interface FailsafeLimits {
  readonly maxTriggersPerSession: number;
  readonly maxBackpackEntriesPerSession: number;
}

/** Current counts from SessionImpact. */
export interface FailsafeCurrent {
  readonly triggerCount: number;
  readonly backpackEntryCount: number;
}

/** Derived flags. */
export interface FailsafeFlags {
  readonly triggerLimitReached: boolean;
  readonly backpackLimitReached: boolean;
}

/** Failsafe metadata. */
export interface FailsafeMeta {
  readonly createdAt: number;
}

/** Failsafe state. Deterministic from SessionImpact. */
export interface FailsafeState {
  readonly sessionId: string;
  readonly limits: FailsafeLimits;
  readonly current: FailsafeCurrent;
  readonly flags: FailsafeFlags;
  readonly meta: FailsafeMeta;
}

/**
 * Creates a FailsafeState from SessionImpact.
 * Static limits defined inside. Flags derived from counts vs limits.
 * Throws if input is invalid. Does not modify SessionImpact.
 */
export function createFailsafeState(impact: SessionImpact): FailsafeState {
  if (!impact) {
    throw new Error("SessionImpact is mandatory.");
  }

  const maxTriggersPerSession = 100;
  const maxBackpackEntriesPerSession = 100;

  const triggerCount = impact.triggerImpact.triggerCount;
  const backpackEntryCount = impact.backpackImpact.entryCount;

  return Object.freeze({
    sessionId: impact.sessionId,
    limits: Object.freeze({
      maxTriggersPerSession,
      maxBackpackEntriesPerSession,
    }),
    current: Object.freeze({
      triggerCount,
      backpackEntryCount,
    }),
    flags: Object.freeze({
      triggerLimitReached: triggerCount >= maxTriggersPerSession,
      backpackLimitReached: backpackEntryCount >= maxBackpackEntriesPerSession,
    }),
    meta: Object.freeze({
      createdAt: Date.now(),
    }),
  });
}
