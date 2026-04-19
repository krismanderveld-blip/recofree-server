/**
 * Block 5: Backpack Container
 * Shared Engine — Immutable structured storage only
 *
 * - BackpackContainer: fixed (BackpackFixed) + flexible (readonly BackpackEntry[])
 * - All structures immutable
 * - Append-only for flexible entries, returns new container
 * - No relevance logic, no filtering, no interpretation, no behavior
 * - No links to triggers, zones, or session impact
 * - No references to other blocks
 */

/** Fixed backpack fields. Immutable. */
export interface BackpackFixed {
  readonly userId: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Single backpack entry. All fields required. Immutable. */
export interface BackpackEntry {
  readonly id: string;
  readonly key: string;
  readonly value: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Backpack container. Exactly 2 top-level fields: fixed + flexible. Immutable. */
export interface BackpackContainer {
  readonly fixed: BackpackFixed;
  readonly flexible: readonly BackpackEntry[];
}

/**
 * Creates a BackpackContainer.
 * Requires userId, createdAt, updatedAt.
 * Initializes with populated fixed and empty flexible list.
 * Throws if required input is missing.
 */
export function createBackpackContainer(
  userId: string,
  createdAt: number,
  updatedAt: number
): BackpackContainer {
  if (!userId) {
    throw new Error("userId is mandatory.");
  }
  if (createdAt === undefined || createdAt === null) {
    throw new Error("createdAt is mandatory.");
  }
  if (updatedAt === undefined || updatedAt === null) {
    throw new Error("updatedAt is mandatory.");
  }
  return Object.freeze({
    fixed: Object.freeze({ userId, createdAt, updatedAt }),
    flexible: Object.freeze([]),
  });
}

/** Input for creating a BackpackEntry. All fields required. */
export interface CreateBackpackEntryInput {
  id: string;
  key: string;
  value: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Creates a BackpackEntry.
 * Validates all required fields. Throws on missing or invalid input.
 */
export function createBackpackEntry(
  input: CreateBackpackEntryInput
): BackpackEntry {
  if (!input.id) {
    throw new Error("id is mandatory.");
  }
  if (!input.key) {
    throw new Error("key is mandatory.");
  }
  if (!input.value) {
    throw new Error("value is mandatory.");
  }
  if (input.createdAt === undefined || input.createdAt === null) {
    throw new Error("createdAt is mandatory.");
  }
  if (input.updatedAt === undefined || input.updatedAt === null) {
    throw new Error("updatedAt is mandatory.");
  }
  return Object.freeze({
    id: input.id,
    key: input.key,
    value: input.value,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}

/**
 * Appends one BackpackEntry to a BackpackContainer.
 * Returns a NEW BackpackContainer. Does not mutate the original.
 * Updates fixed.updatedAt only if newUpdatedAt is provided.
 */
export function appendBackpackEntry(
  container: BackpackContainer,
  entry: BackpackEntry,
  newUpdatedAt?: number
): BackpackContainer {
  return Object.freeze({
    fixed: Object.freeze({
      userId: container.fixed.userId,
      createdAt: container.fixed.createdAt,
      updatedAt:
        newUpdatedAt !== undefined ? newUpdatedAt : container.fixed.updatedAt,
    }),
    flexible: Object.freeze([...container.flexible, entry]),
  });
}

/** Returns the full fixed object. Read-only. */
export function getFixed(container: BackpackContainer): BackpackFixed {
  return container.fixed;
}

/** Returns the full flexible entry list. Read-only. */
export function getEntries(
  container: BackpackContainer
): readonly BackpackEntry[] {
  return container.flexible;
}

/** Returns the entry count. */
export function getEntryCount(container: BackpackContainer): number {
  return container.flexible.length;
}
