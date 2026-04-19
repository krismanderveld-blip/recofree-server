/**
 * Block 3: Trigger Object
 * Shared Engine — Pure data model only
 *
 * - Trigger kinds: "event" | "state"
 * - Trigger modes: "binary" | "weighted"
 * - Binary triggers have `active` (boolean), no `weight`
 * - Weighted triggers have `weight` (number), no `active`
 * - Binary and weighted fields must never coexist
 * - All fields mandatory, no defaults
 * - Invalid combinations throw
 * - No session coupling
 * - No interpretation, no impact on zone, no behavior
 * - No references to other blocks
 */

/** Trigger kinds. Exactly 2. */
export type TriggerKind = "event" | "state";

/** Trigger modes. Exactly 2. */
export type TriggerMode = "binary" | "weighted";

/** Shared fields present on every trigger. */
interface TriggerBase {
  readonly id: string;
  readonly kind: TriggerKind;
  readonly type: string;
  readonly source: string;
  readonly sessionId: string;
  readonly createdAt: number;
}

/** Binary trigger: has `active`, no `weight`. */
export interface BinaryTrigger extends TriggerBase {
  readonly mode: "binary";
  readonly active: boolean;
}

/** Weighted trigger: has `weight`, no `active`. */
export interface WeightedTrigger extends TriggerBase {
  readonly mode: "weighted";
  readonly weight: number;
}

/** Discriminated union. A trigger is either binary or weighted, never both. */
export type Trigger = BinaryTrigger | WeightedTrigger;

/** Input for creating a binary trigger. */
export interface CreateBinaryTriggerInput {
  id: string;
  kind: TriggerKind;
  type: string;
  source: string;
  sessionId: string;
  createdAt: number;
  mode: "binary";
  active: boolean;
}

/** Input for creating a weighted trigger. */
export interface CreateWeightedTriggerInput {
  id: string;
  kind: TriggerKind;
  type: string;
  source: string;
  sessionId: string;
  createdAt: number;
  mode: "weighted";
  weight: number;
}

/** Input union for trigger creation. */
export type CreateTriggerInput =
  | CreateBinaryTriggerInput
  | CreateWeightedTriggerInput;

/**
 * Creates a trigger.
 * Validates all mandatory fields and mode-specific constraints.
 * Throws on invalid input.
 */
export function createTrigger(input: CreateTriggerInput): Trigger {
  if (!input.id) {
    throw new Error("id is mandatory.");
  }
  if (input.kind !== "event" && input.kind !== "state") {
    throw new Error('kind is mandatory. Must be "event" or "state".');
  }
  if (input.mode !== "binary" && input.mode !== "weighted") {
    throw new Error('mode is mandatory. Must be "binary" or "weighted".');
  }
  if (!input.type) {
    throw new Error("type is mandatory.");
  }
  if (!input.source) {
    throw new Error("source is mandatory.");
  }
  if (!input.sessionId) {
    throw new Error("sessionId is mandatory.");
  }
  if (input.createdAt === undefined || input.createdAt === null) {
    throw new Error("createdAt is mandatory.");
  }

  if (input.mode === "binary") {
    if (input.active === undefined || input.active === null) {
      throw new Error("active is required for binary triggers.");
    }
    if ("weight" in input && (input as Record<string, unknown>).weight !== undefined) {
      throw new Error("weight must NOT exist on binary triggers.");
    }
    return Object.freeze({
      id: input.id,
      kind: input.kind,
      mode: "binary" as const,
      type: input.type,
      source: input.source,
      sessionId: input.sessionId,
      createdAt: input.createdAt,
      active: input.active,
    });
  }

  if (input.mode === "weighted") {
    if (input.weight === undefined || input.weight === null) {
      throw new Error("weight is required for weighted triggers.");
    }
    if ("active" in input && (input as Record<string, unknown>).active !== undefined) {
      throw new Error("active must NOT exist on weighted triggers.");
    }
    return Object.freeze({
      id: input.id,
      kind: input.kind,
      mode: "weighted" as const,
      type: input.type,
      source: input.source,
      sessionId: input.sessionId,
      createdAt: input.createdAt,
      weight: input.weight,
    });
  }

  throw new Error("Invalid trigger mode.");
}
