/**
 * Tendency Confirmation Layer V2 — Multi-Source Verification
 *
 * Schema/mode tendencies are CANDIDATES until confirmed through multiple sources.
 * A single acknowledgment (clinical OR user) does NOT confirm — it deepens exploration.
 * Only multi-source verified tendencies are injected into the KNOWN USER PATTERNS block.
 * Unconfirmed tendencies still feed the SchemaMode engine (deterministic per-turn detection).
 *
 * Confirmation requires MULTI-SOURCE VERIFICATION:
 * - Path A: auto-detect (freq≥3 + conf≥0.7) + clinicalAcknowledged + userAcknowledged
 * - Path B: auto-detect (freq≥3 + conf≥0.7) + (clinicalAcknowledged OR userAcknowledged) + freq≥5
 * - Path C: frequency ≥ 8 (overwhelming repetition overrides)
 *
 * Acknowledgment (single source) → stays CANDIDATE but:
 * - Gets `acknowledged: true` status
 * - May appear in prompt as "mogelijk patroon" (exploratory, cautious)
 * - Engine may explore deeper (more schema-gerichte interventies)
 *
 * Once confirmed, a tendency stays confirmed unless manually revoked.
 */

// ─── Thresholds ────────────────────────────────────────────────────
export const AUTO_CONFIRM_FREQUENCY_THRESHOLD = 3;
export const AUTO_CONFIRM_CONFIDENCE_THRESHOLD = 0.7;
export const MULTI_SOURCE_FREQUENCY_THRESHOLD = 5;
export const OVERWHELMING_FREQUENCY_THRESHOLD = 8;

// ─── Types ─────────────────────────────────────────────────────────
export type ConfirmationSource = 'auto' | 'clinical' | 'user' | 'multi-source' | 'overwhelming';

export type AcknowledgmentStatus = 'none' | 'clinical' | 'user' | 'both';

export interface TendencyAcknowledgmentFields {
  /** Whether a clinician has acknowledged this pattern in clinical mode */
  clinicalAcknowledged?: boolean;
  /** ISO timestamp of clinical acknowledgment */
  clinicalAcknowledgedAt?: string;
  /** Whether the user has self-acknowledged this pattern in chat */
  userAcknowledged?: boolean;
  /** ISO timestamp of user acknowledgment */
  userAcknowledgedAt?: string;
  /** Cumulative acknowledgment score (auto=1 per detect, clinical=2, user=2) */
  acknowledgmentScore?: number;
}

export interface TendencyConfirmable extends TendencyAcknowledgmentFields {
  frequency: number;
  confidence?: number;
  confirmed?: boolean;
  confirmedAt?: string;
}

export interface TendencyConfirmationResult {
  /** Whether the tendency was newly confirmed in this pass */
  newlyConfirmed: boolean;
  /** The source of confirmation (if confirmed) */
  source?: ConfirmationSource;
}

export interface AcknowledgmentResult {
  /** Whether the tendency was newly acknowledged */
  newlyAcknowledged: boolean;
  /** The acknowledgment source */
  source: 'clinical' | 'user';
  /** Whether this acknowledgment triggered confirmation (multi-source) */
  triggeredConfirmation: boolean;
}

// ─── Acknowledgment Status ────────────────────────────────────────

/**
 * Get the acknowledgment status of a tendency.
 */
export function getAcknowledgmentStatus(tendency: TendencyAcknowledgmentFields): AcknowledgmentStatus {
  const hasClinical = tendency.clinicalAcknowledged === true;
  const hasUser = tendency.userAcknowledged === true;
  if (hasClinical && hasUser) return 'both';
  if (hasClinical) return 'clinical';
  if (hasUser) return 'user';
  return 'none';
}

/**
 * Check if a tendency is acknowledged (at least one source).
 * Acknowledged candidates may appear in prompt as exploratory context.
 */
export function isAcknowledged(tendency: TendencyAcknowledgmentFields): boolean {
  return tendency.clinicalAcknowledged === true || tendency.userAcknowledged === true;
}

// ─── Core Confirmation Logic ──────────────────────────────────────

/**
 * Check if a tendency meets auto-detect threshold (necessary but NOT sufficient for confirmation).
 */
export function meetsAutoDetectThreshold(tendency: {
  frequency: number;
  confidence?: number;
}): boolean {
  return (
    tendency.frequency >= AUTO_CONFIRM_FREQUENCY_THRESHOLD &&
    (tendency.confidence ?? 0) >= AUTO_CONFIRM_CONFIDENCE_THRESHOLD
  );
}

/**
 * V2: Check if a tendency should be CONFIRMED (multi-source verification).
 *
 * Confirmation paths:
 * - Path A: auto-detect threshold met + clinicalAcknowledged + userAcknowledged
 * - Path B: auto-detect threshold met + (clinical OR user) + frequency ≥ 5
 * - Path C: frequency ≥ 8 (overwhelming repetition)
 */
export function shouldConfirm(tendency: TendencyConfirmable): { confirm: boolean; source: ConfirmationSource } {
  // Already confirmed — no-op
  if (tendency.confirmed) return { confirm: false, source: 'auto' };

  const meetsAuto = meetsAutoDetectThreshold(tendency);
  const hasClinical = tendency.clinicalAcknowledged === true;
  const hasUser = tendency.userAcknowledged === true;

  // Path C: Overwhelming repetition (freq≥8) — overrides all other requirements
  if (tendency.frequency >= OVERWHELMING_FREQUENCY_THRESHOLD) {
    return { confirm: true, source: 'overwhelming' };
  }

  // Path A: Full multi-source (auto + clinical + user)
  if (meetsAuto && hasClinical && hasUser) {
    return { confirm: true, source: 'multi-source' };
  }

  // Path B: Auto + one ack + higher frequency
  if (meetsAuto && (hasClinical || hasUser) && tendency.frequency >= MULTI_SOURCE_FREQUENCY_THRESHOLD) {
    return { confirm: true, source: 'multi-source' };
  }

  return { confirm: false, source: 'auto' };
}

/**
 * DEPRECATED: Old auto-confirm check. Kept for backward compat but now uses V2 logic.
 */
export function shouldAutoConfirm(tendency: {
  frequency: number;
  confidence?: number;
  confirmed?: boolean;
  clinicalAcknowledged?: boolean;
  userAcknowledged?: boolean;
  acknowledgmentScore?: number;
}): boolean {
  if (tendency.confirmed) return false;
  return shouldConfirm(tendency as TendencyConfirmable).confirm;
}

/**
 * Apply multi-source confirmation to all tendencies.
 * Returns a new array with confirmed flags set where multi-source criteria are met.
 * Does NOT mutate the input array.
 */
export function applyAutoConfirmation<
  T extends TendencyConfirmable
>(tendencies: T[], now: string): T[] {
  return tendencies.map((t) => {
    if (t.confirmed) return t; // Already confirmed
    const result = shouldConfirm(t);
    if (result.confirm) {
      return {
        ...t,
        confirmed: true,
        confirmedAt: now,
      };
    }
    return t;
  });
}

// ─── Acknowledgment Application ───────────────────────────────────

/**
 * Apply clinical acknowledgment to a specific tendency by ID.
 * Does NOT confirm — only marks as clinically acknowledged.
 * May trigger confirmation if multi-source criteria are now met.
 * Returns the updated array. Does NOT mutate.
 */
export function applyClinicalAcknowledgment<
  T extends TendencyConfirmable
>(
  tendencies: T[],
  idField: string,
  targetId: string,
  now: string,
): { tendencies: T[]; result: AcknowledgmentResult | null } {
  let ackResult: AcknowledgmentResult | null = null;
  const updated = tendencies.map((t) => {
    if (String((t as any)[idField]) !== targetId) return t;
    if (t.clinicalAcknowledged) return t; // Already acknowledged
    const newT = {
      ...t,
      clinicalAcknowledged: true,
      clinicalAcknowledgedAt: now,
      acknowledgmentScore: (t.acknowledgmentScore ?? 0) + 2,
    };
    const confirmResult = shouldConfirm(newT);
    if (confirmResult.confirm) {
      ackResult = { newlyAcknowledged: true, source: 'clinical', triggeredConfirmation: true };
      return { ...newT, confirmed: true, confirmedAt: now };
    }
    ackResult = { newlyAcknowledged: true, source: 'clinical', triggeredConfirmation: false };
    return newT;
  });
  return { tendencies: updated, result: ackResult };
}

/**
 * Apply user self-acknowledgment to a specific tendency by ID.
 * Does NOT confirm — only marks as user-acknowledged.
 * May trigger confirmation if multi-source criteria are now met.
 * Returns the updated array. Does NOT mutate.
 */
export function applyUserAcknowledgment<
  T extends TendencyConfirmable
>(
  tendencies: T[],
  idField: string,
  targetId: string,
  now: string,
): { tendencies: T[]; result: AcknowledgmentResult | null } {
  let ackResult: AcknowledgmentResult | null = null;
  const updated = tendencies.map((t) => {
    if (String((t as any)[idField]) !== targetId) return t;
    if (t.userAcknowledged) return t; // Already acknowledged
    const newT = {
      ...t,
      userAcknowledged: true,
      userAcknowledgedAt: now,
      acknowledgmentScore: (t.acknowledgmentScore ?? 0) + 2,
    };
    const confirmResult = shouldConfirm(newT);
    if (confirmResult.confirm) {
      ackResult = { newlyAcknowledged: true, source: 'user', triggeredConfirmation: true };
      return { ...newT, confirmed: true, confirmedAt: now };
    }
    ackResult = { newlyAcknowledged: true, source: 'user', triggeredConfirmation: false };
    return newT;
  });
  return { tendencies: updated, result: ackResult };
}

/**
 * DEPRECATED: Old manual confirm. Now routes through acknowledgment system.
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

// ─── Filtering ────────────────────────────────────────────────────

/**
 * Filter tendencies to only CONFIRMED ones.
 * Used by KNOWN USER PATTERNS block builder (assertive injection).
 */
export function getConfirmedOnly<T extends { confirmed?: boolean }>(tendencies: T[]): T[] {
  return tendencies.filter((t) => t.confirmed === true);
}

/**
 * Filter tendencies to ACKNOWLEDGED but NOT confirmed.
 * Used for exploratory prompt injection ("mogelijk patroon").
 */
export function getAcknowledgedCandidates<T extends TendencyConfirmable>(tendencies: T[]): T[] {
  return tendencies.filter((t) => !t.confirmed && isAcknowledged(t));
}

/**
 * Get all tendencies (confirmed + unconfirmed + acknowledged).
 * Used by SchemaMode engine which needs ALL candidates.
 */
export function getAllCandidates<T>(tendencies: T[]): T[] {
  return tendencies;
}

// ─── User Self-Acknowledgment Detection ───────────────────────────

/**
 * Acknowledgment patterns — phrases that indicate the user recognizes a pattern.
 * Matched case-insensitively as substrings of the user message.
 */
const USER_ACK_PATTERNS_NL: ReadonlyArray<string> = [
  'ja dat herken ik',
  'dat herken ik',
  'herken ik wel',
  'dat klopt',
  'klopt helemaal',
  'zo voelt het',
  'zo zit het',
  'dat is precies',
  'precies wat er gebeurt',
  'ik merk dat ook',
  'dat doe ik inderdaad',
  'dat is wat ik doe',
  'zo gaat het altijd',
  'altijd hetzelfde patroon',
  'ik zie het patroon',
  'dat patroon herken ik',
  'ja dat ben ik',
  'dat is typisch voor mij',
  'ik val altijd terug',
  'dat overkomt me steeds',
];

const USER_ACK_PATTERNS_EN: ReadonlyArray<string> = [
  'yes i recognize that',
  'i recognize that',
  'that sounds like me',
  'that is exactly',
  'exactly what happens',
  'i notice that too',
  'that is what i do',
  'it always goes like that',
  'same pattern',
  'i see the pattern',
  'that pattern is me',
  'that is typical for me',
  'i always fall back',
  'keeps happening to me',
  'you are right about that',
  'that makes sense',
  'i do that',
];

/**
 * Detect if the user message contains a self-acknowledgment of a pattern.
 * Returns true if the message matches any acknowledgment pattern.
 *
 * Note: This is a NECESSARY but not SUFFICIENT condition.
 * The caller must also verify that a schema/mode was active in the previous turn
 * to know WHAT is being acknowledged.
 */
export function detectUserAcknowledgment(message: string): boolean {
  const lower = message.toLowerCase().trim();
  // Must be at least 3 words to avoid false positives on "ja" alone
  if (lower.split(/\s+/).length < 3) return false;
  return (
    USER_ACK_PATTERNS_NL.some(p => lower.includes(p)) ||
    USER_ACK_PATTERNS_EN.some(p => lower.includes(p))
  );
}

// ─── Clinical Acknowledgment Detection ────────────────────────────

/**
 * Clinical acknowledgment patterns — phrases a clinician uses to confirm a pattern.
 * These are only checked when clinicalModeActive === true.
 */
const CLINICAL_ACK_PATTERNS: ReadonlyArray<string> = [
  'bevestig schema',
  'bevestig modus',
  'schema bevestigd',
  'modus bevestigd',
  'confirm schema',
  'confirm mode',
  'schema confirmed',
  'mode confirmed',
  'patroon bevestigd',
  'pattern confirmed',
  'ik bevestig',
  'i confirm',
];

/**
 * Detect if the clinical mode message contains a pattern confirmation.
 * Only call when clinicalModeActive === true.
 */
export function detectClinicalAcknowledgment(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return CLINICAL_ACK_PATTERNS.some(p => lower.includes(p));
}

// ─── Stats ────────────────────────────────────────────────────────

/**
 * Summary stats for debug/trace output.
 */
export function getConfirmationStats(tendencies: Array<TendencyConfirmable>): {
  total: number;
  confirmed: number;
  acknowledged: number;
  candidates: number;
} {
  const confirmed = tendencies.filter((t) => t.confirmed === true).length;
  const acknowledged = tendencies.filter((t) => !t.confirmed && isAcknowledged(t)).length;
  return {
    total: tendencies.length,
    confirmed,
    acknowledged,
    candidates: tendencies.length - confirmed - acknowledged,
  };
}
