/**
 * Block 2: Session Shell
 * Shared Engine — Container only
 *
 * - Session structure: unique identifier + reference to Zone Core state
 * - No additional fields
 * - Creation requires zone input, uses Zone Core initialization
 * - Cannot create session without valid zone
 * - Can read zone via Zone Core
 * - Cannot modify zone
 * - No triggers, no behavior, no interpretation, no impact logic
 * - No references to other blocks except Zone Core
 */

import {
  Zone,
  SessionZoneState,
  createSessionZone,
  getZone,
} from "./zone-core";

/** Session structure. Contains unique identifier and Zone Core state. No additional fields. */
export interface Session {
  readonly id: string;
  readonly zoneState: SessionZoneState;
}

/**
 * Creates a session.
 * Requires a unique session identifier and a valid zone.
 * Uses Zone Core initialization. Cannot create without valid zone.
 */
export function createSession(sessionId: string, zone: Zone): Session {
  const zoneState = createSessionZone(sessionId, zone);
  return Object.freeze({ id: sessionId, zoneState });
}

/** Reads the zone from a session via Zone Core. */
export function readSessionZone(session: Session): Zone {
  return getZone(session.zoneState);
}
