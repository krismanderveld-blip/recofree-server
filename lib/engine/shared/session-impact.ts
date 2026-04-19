/**
 * Block 7: Session Impact Skeleton
 * Shared Engine — Pure structural skeleton
 *
 * - Accepts UserDat
 * - Produces SessionImpact: presence/count signals only
 * - No calculations, no scoring, no interpretation
 * - No trigger weighting, grouping, or priority
 * - No zone transitions, decay, or escalation
 * - No side effects
 */

import { UserDat } from "./userdat-filter";

/** Trigger impact: presence and count only. */
export interface TriggerImpact {
  readonly hasTriggers: boolean;
  readonly triggerCount: number;
}

/** Backpack impact: presence and count only. */
export interface BackpackImpact {
  readonly hasBackpackEntries: boolean;
  readonly entryCount: number;
}

/** Session impact metadata. */
export interface SessionImpactMeta {
  readonly createdAt: number;
}

/** Session impact skeleton. All fields deterministic from input. */
export interface SessionImpact {
  readonly sessionId: string;
  readonly triggerImpact: TriggerImpact;
  readonly backpackImpact: BackpackImpact;
  readonly meta: SessionImpactMeta;
}

/**
 * Creates a SessionImpact from UserDat.
 * Derives presence/count signals directly from UserDat.
 * Does not modify UserDat. Does not infer meaning beyond presence/count.
 * Throws if input is invalid.
 */
export function createSessionImpact(userDat: UserDat): SessionImpact {
  if (!userDat) {
    throw new Error("UserDat is mandatory.");
  }

  return Object.freeze({
    sessionId: userDat.sessionId,
    triggerImpact: Object.freeze({
      hasTriggers: userDat.triggerCount > 0,
      triggerCount: userDat.triggerCount,
    }),
    backpackImpact: Object.freeze({
      hasBackpackEntries: userDat.backpackEntryCount > 0,
      entryCount: userDat.backpackEntryCount,
    }),
    meta: Object.freeze({
      createdAt: Date.now(),
    }),
  });
}
