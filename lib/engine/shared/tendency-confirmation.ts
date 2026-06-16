/**
 * Tendency Confirmation Layer
 *
 * Schema/mode tendencies are CANDIDATES until confirmed.
 * Only confirmed tendencies are injected into the KNOWN USER PATTERNS block for GPT.
 * Unconfirmed tendencies still feed the SchemaMode engine (deterministic per-turn detection).
 *
 * Confirmation paths:
 * 1. AUTO: frequency >= 3 AND confidence >= 0.7 (faster confirmation for recurring patterns)
 * 2. CLINICAL: clinical mode explicitly acknowledges the pattern
 * 3. USER: user self-acknowledges in chat (e.g., "ja dat herken ik", "dat klopt")
 *
 * Once confirmed, a tendency stays confirmed unless manually revoked.
 */

// ─── Thresholds ────────────────────────────────────────────────────
export const AUTO_CONFIRM_FREQUENCY_THRESHOLD = 3;
export const AUTO_CONFIRM_CONFIDENCE_THRESHOLD = 0.7;

// ─── Types ─────────────────────────────────────────────────────────
export type ConfirmationSource = 'auto' | 'clinical' | 'user';

export interface TendencyConfirmationResult {
  /** Whether the tendency was newly confirmed in this pass */
  newlyConfirmed: boolean;
  /** The source of confirmation (if confirmed) */
  source?: ConfirmationSource;
}

// ─── Core Logic ────────────────────────────────────────────────────

/**
 * Check if a schema/mode tendency meets auto-confirmation criteria.
 * Does NOT mutate the tendency — returns whether it qualifies.
 */
export function shouldAutoConfirm(tendency: {
  frequency: number;
  confidence?: number;
  confirmed?: boolean;
}): boolean {
  // Already confirmed — no-op
  if (tendency.confirmed) return false;
  // Check thresholds
  return (
    tendency.frequency >= AUTO_CONFIRM_FREQUENCY_THRESHOLD &&
    (tendency.confidence ?? 0) >= AUTO_CONFIRM_CONFIDENCE_THRESHOLD
  );
}

/**
 * Apply auto-confirmation to all schema tendencies.
 * Returns a new array with confirmed flags set where thresholds are met.
 * Does NOT mutate the input array.
 */
export function applyAutoConfirmation<
  T extends { frequency: number; confidence?: number; confirmed?: boolean; confirmedAt?: string }
>(tendencies: T[], now: string): T[] {
  return tendencies.map((t) => {
    if (t.confirmed) return t; // Already confirmed
    if (shouldAutoConfirm(t)) {
      return {
        ...t,
        confirmed: true,
        confirmedAt: now,
      };
    }
    return t;
  });
}

/**
 * Manually confirm a specific tendency by ID (clinical or user acknowledgment).
 * Returns the updated array. Does NOT mutate.
 */
export function confirmTendencyById<
  T extends { confirmed?: boolean; confirmedAt?: string }
>(
  tendencies: T[],
  idField: keyof T,
  targetId: string,
  now: string,
): T[] {
  return tendencies.map((t) => {
    if (String(t[idField]) === targetId && !t.confirmed) {
      return { ...t, confirmed: true, confirmedAt: now };
    }
    return t;
  });
}

/**
 * Filter tendencies to only confirmed ones.
 * Used by KNOWN USER PATTERNS block builder.
 */
export function getConfirmedOnly<T extends { confirmed?: boolean }>(tendencies: T[]): T[] {
  return tendencies.filter((t) => t.confirmed === true);
}

/**
 * Get all tendencies (confirmed + unconfirmed).
 * Used by SchemaMode engine which needs ALL candidates.
 */
export function getAllCandidates<T>(tendencies: T[]): T[] {
  return tendencies;
}

/**
 * Summary stats for debug/trace output.
 */
export function getConfirmationStats(tendencies: Array<{ confirmed?: boolean }>): {
  total: number;
  confirmed: number;
  candidates: number;
} {
  const confirmed = tendencies.filter((t) => t.confirmed === true).length;
  return {
    total: tendencies.length,
    confirmed,
    candidates: tendencies.length - confirmed,
  };
}
