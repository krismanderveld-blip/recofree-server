/**
 * Block 1: Zone Core
 * Shared Engine — Pure state only
 *
 * - Zone enum: values 1–5, numeric only, no labels, no meaning
 * - Session zone state: one zone per session, stored as integer
 * - Initialization: zone must be explicitly set, no default
 * - Access: read-only after initialization
 * - No triggers, no logic, no interpretation, no mapping, no side effects
 * - No references to other blocks
 */

/** Zone values: 1–5. Numeric only. No labels. No meaning attached. */
export enum Zone {
  Z1 = 1,
  Z2 = 2,
  Z3 = 3,
  Z4 = 4,
  Z5 = 5,
}

/** Session zone state. Read-only after creation. */
export interface SessionZoneState {
  readonly sessionId: string;
  readonly zone: Zone;
}

/**
 * Creates a session zone state.
 * Zone must be explicitly provided. No default value.
 * Throws if zone is not provided or not a valid Zone value (1–5).
 */
export function createSessionZone(
  sessionId: string,
  zone: Zone
): SessionZoneState {
  if (zone === undefined || zone === null) {
    throw new Error("Zone must be explicitly provided. No default value.");
  }

  if (!(zone in Zone)) {
    throw new Error(
      `Invalid zone value: ${zone}. Must be 1, 2, 3, 4, or 5.`
    );
  }

  return Object.freeze({ sessionId, zone });
}

/** Reads the zone from a session zone state. */
export function getZone(state: SessionZoneState): Zone {
  return state.zone;
}
