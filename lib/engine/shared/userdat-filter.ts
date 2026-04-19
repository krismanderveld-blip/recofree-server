/**
 * Block 6: User.dat Filter Layer
 * Shared Engine — Pure aggregation only
 *
 * - Accepts SessionTriggerList and BackpackContainer
 * - Produces UserDat: direct pass-through of triggers and backpack entries
 * - No filtering, no sorting, no grouping, no transformation
 * - No scoring, no interpretation, no decay, no stacking
 * - No links to zone changes or behavior
 * - No side effects
 */

import { Trigger } from "./trigger-object";
import { SessionTriggerList, getTriggers, getTriggerCount } from "./session-trigger-list";
import { BackpackContainer, BackpackEntry, getEntries, getEntryCount } from "./backpack-container";

/** UserDat structure. Read-only. Exactly these fields. */
export interface UserDat {
  readonly sessionId: string;
  readonly triggerCount: number;
  readonly triggers: readonly Trigger[];
  readonly backpackEntryCount: number;
  readonly backpackEntries: readonly BackpackEntry[];
}

/**
 * Creates a UserDat from SessionTriggerList and BackpackContainer.
 * Triggers and backpack entries are passed through directly, no modification.
 * Counts reflect actual list sizes.
 * Throws if inputs are missing.
 */
export function createUserDat(
  triggerList: SessionTriggerList,
  backpack: BackpackContainer
): UserDat {
  if (!triggerList) {
    throw new Error("SessionTriggerList is mandatory.");
  }
  if (!backpack) {
    throw new Error("BackpackContainer is mandatory.");
  }

  const triggers = getTriggers(triggerList);
  const entries = getEntries(backpack);

  return Object.freeze({
    sessionId: triggerList.sessionId,
    triggerCount: getTriggerCount(triggerList),
    triggers,
    backpackEntryCount: getEntryCount(backpack),
    backpackEntries: entries,
  });
}
