/**
 * Debug Layer: Engine Snapshot
 * Full transparent snapshot of engine state for debugging
 *
 * - Accepts UserDat, SessionImpact, FailsafeState
 * - Passes all by reference, no copying, no transformation
 * - Validates sessionId consistency across all inputs
 * - No logging, no formatting, no printing, no UI logic
 * - No interpretation, no decision making
 * - No side effects
 */

import { UserDat } from "../shared/userdat-filter";
import { SessionImpact } from "../shared/session-impact";
import { FailsafeState } from "../shared/failsafe";

/** Debug snapshot metadata. */
export interface DebugSnapshotMeta {
  readonly createdAt: number;
}

/** Debug snapshot. All inputs passed by reference. */
export interface DebugSnapshot {
  readonly sessionId: string;
  readonly userdat: UserDat;
  readonly impact: SessionImpact;
  readonly failsafe: FailsafeState;
  readonly meta: DebugSnapshotMeta;
}

/**
 * Creates a DebugSnapshot from UserDat, SessionImpact, and FailsafeState.
 * Throws if any input is missing.
 * Throws if sessionId is inconsistent across inputs.
 * Does not modify inputs.
 */
export function createDebugSnapshot(
  userdat: UserDat,
  impact: SessionImpact,
  failsafe: FailsafeState
): DebugSnapshot {
  if (!userdat) {
    throw new Error("UserDat is mandatory.");
  }
  if (!impact) {
    throw new Error("SessionImpact is mandatory.");
  }
  if (!failsafe) {
    throw new Error("FailsafeState is mandatory.");
  }

  if (userdat.sessionId !== impact.sessionId) {
    throw new Error(
      "sessionId mismatch: UserDat and SessionImpact have different sessionIds."
    );
  }
  if (userdat.sessionId !== failsafe.sessionId) {
    throw new Error(
      "sessionId mismatch: UserDat and FailsafeState have different sessionIds."
    );
  }

  return Object.freeze({
    sessionId: userdat.sessionId,
    userdat,
    impact,
    failsafe,
    meta: Object.freeze({
      createdAt: Date.now(),
    }),
  });
}
