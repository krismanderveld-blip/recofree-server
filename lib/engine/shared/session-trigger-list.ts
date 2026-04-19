/**
 * Block 4: Session Trigger List
 * Shared Engine — Structured trigger storage per session
 *
 * - Append-only, immutable updates
 * - Preserves insertion order
 * - No deduplication, no sorting, no auto-removal, no max size
 * - No trigger evaluation, stacking, filtering, decay, or effects
 * - No side effects, no hidden behavior
 * - References: Trigger type from trigger-object.ts only
 */

import { Trigger } from "./trigger-object";

/** Session trigger list. Append-only, immutable. */
export interface SessionTriggerList {
  readonly sessionId: string;
  readonly triggers: readonly Trigger[];
}

/**
 * Creates a new SessionTriggerList for a session.
 * Requires sessionId. Initializes with empty trigger list.
 * Throws if sessionId is missing.
 */
export function createSessionTriggerList(
  sessionId: string
): SessionTriggerList {
  if (!sessionId) {
    throw new Error("sessionId is mandatory.");
  }
  return Object.freeze({ sessionId, triggers: Object.freeze([]) });
}

/**
 * Appends one trigger to a SessionTriggerList.
 * Returns a NEW SessionTriggerList. Does not mutate the original.
 * Preserves insertion order. Appends at end.
 * Does not evaluate, reject duplicates, or inspect trigger meaning.
 */
export function appendTrigger(
  list: SessionTriggerList,
  trigger: Trigger
): SessionTriggerList {
  return Object.freeze({
    sessionId: list.sessionId,
    triggers: Object.freeze([...list.triggers, trigger]),
  });
}

/** Returns the full trigger list. Read-only. */
export function getTriggers(list: SessionTriggerList): readonly Trigger[] {
  return list.triggers;
}

/** Returns the trigger count. */
export function getTriggerCount(list: SessionTriggerList): number {
  return list.triggers.length;
}
