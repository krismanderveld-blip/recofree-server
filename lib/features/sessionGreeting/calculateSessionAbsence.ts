/**
 * Session Greeting V3 — Absence Awareness
 *
 * Calculates the absence band based on time since last session start.
 * Uses lastSessionStartedAt from user.dat (read BEFORE session stats update).
 *
 * Bands:
 * - NONE: no previous session or invalid timestamp
 * - SHORT: < 3 days (no special treatment)
 * - RETURN_AFTER_ABSENCE: >= 3 days and < 14 days
 * - LONG_RETURN: >= 14 days (extra gentle, no alarm)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type SessionAbsenceBand =
  | 'NONE'
  | 'SHORT'
  | 'RETURN_AFTER_ABSENCE'
  | 'LONG_RETURN';

export interface SessionAbsenceResult {
  band: SessionAbsenceBand;
  isReturnAfterAbsence: boolean;
  absenceDaysExact: number | null;
  absenceHoursExact: number | null;
  lastSessionStartedAt: string | null;
  thresholdDays: number;
  reason: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const ABSENCE_SHORT_MAX_DAYS = 2;
export const ABSENCE_RETURN_MIN_DAYS = 3;
export const ABSENCE_LONG_RETURN_MIN_DAYS = 14;

// ─── Main Function ───────────────────────────────────────────────────────────

export interface CalculateSessionAbsenceInput {
  nowIso: string;
  lastSessionStartedAt?: string | null;
}

export function calculateSessionAbsence(
  input: CalculateSessionAbsenceInput,
): SessionAbsenceResult {
  const thresholdDays = ABSENCE_RETURN_MIN_DAYS;

  if (!input.lastSessionStartedAt) {
    return {
      band: 'NONE',
      isReturnAfterAbsence: false,
      absenceDaysExact: null,
      absenceHoursExact: null,
      lastSessionStartedAt: null,
      thresholdDays,
      reason: 'No previous session timestamp available.',
    };
  }

  const now = new Date(input.nowIso).getTime();
  const last = new Date(input.lastSessionStartedAt).getTime();

  if (Number.isNaN(now) || Number.isNaN(last) || now <= last) {
    return {
      band: 'NONE',
      isReturnAfterAbsence: false,
      absenceDaysExact: null,
      absenceHoursExact: null,
      lastSessionStartedAt: input.lastSessionStartedAt,
      thresholdDays,
      reason: 'Invalid or future lastSessionStartedAt.',
    };
  }

  const absenceHoursExact = (now - last) / (60 * 60 * 1000);
  const absenceDaysExact = absenceHoursExact / 24;

  if (absenceDaysExact >= ABSENCE_LONG_RETURN_MIN_DAYS) {
    return {
      band: 'LONG_RETURN',
      isReturnAfterAbsence: true,
      absenceDaysExact,
      absenceHoursExact,
      lastSessionStartedAt: input.lastSessionStartedAt,
      thresholdDays,
      reason: 'User returns after long absence.',
    };
  }

  if (absenceDaysExact >= ABSENCE_RETURN_MIN_DAYS) {
    return {
      band: 'RETURN_AFTER_ABSENCE',
      isReturnAfterAbsence: true,
      absenceDaysExact,
      absenceHoursExact,
      lastSessionStartedAt: input.lastSessionStartedAt,
      thresholdDays,
      reason: 'User returns after absence threshold.',
    };
  }

  return {
    band: 'SHORT',
    isReturnAfterAbsence: false,
    absenceDaysExact,
    absenceHoursExact,
    lastSessionStartedAt: input.lastSessionStartedAt,
    thresholdDays,
    reason: 'Absence below return threshold.',
  };
}
