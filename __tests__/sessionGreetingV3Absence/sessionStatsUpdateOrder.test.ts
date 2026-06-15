/**
 * Absence Awareness — Session Stats Update Order Tests
 * Critical: lastSessionStartedAt must be read BEFORE update, updated AFTER greeting
 */
import { describe, it, expect } from 'vitest';
import { calculateSessionAbsence } from '@/lib/features/sessionGreeting/calculateSessionAbsence';

describe('Session Stats Update Order', () => {
  it('E1: calculateSessionAbsence reads the OLD lastSessionStartedAt (not current time)', () => {
    // Simulates: user last opened app 5 days ago
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const result = calculateSessionAbsence({
      nowIso,
      lastSessionStartedAt: fiveDaysAgo,
    });

    // Should detect 5 days absence, NOT 0
    expect(result.absenceDaysExact).toBeCloseTo(5, 0);
    expect(result.band).toBe('RETURN_AFTER_ABSENCE');
    expect(result.isReturnAfterAbsence).toBe(true);
  });

  it('E2: If lastSessionStartedAt were updated BEFORE calculation, absence would be 0 (NONE band)', () => {
    // This test documents the WRONG behavior that would happen if stats were updated first
    const nowIso = new Date().toISOString();
    const justNow = nowIso; // If we updated lastSessionStartedAt to now before calculating

    const result = calculateSessionAbsence({
      nowIso,
      lastSessionStartedAt: justNow,
    });

    // now <= last returns NONE (treated as invalid/same-moment)
    expect(result.band).toBe('NONE');
    expect(result.isReturnAfterAbsence).toBe(false);
  });

  it('E3: Correct order: read old value → calculate absence → generate greeting → update timestamp', () => {
    // Simulates the correct pipeline order
    const oldLastSession = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    // Step 1: Read OLD lastSessionStartedAt
    const readValue = oldLastSession;

    // Step 2: Calculate absence with old value
    const absence = calculateSessionAbsence({
      nowIso,
      lastSessionStartedAt: readValue,
    });

    // Step 3: Verify absence is correctly detected
    expect(absence.absenceDaysExact).toBeCloseTo(10, 0);
    expect(absence.band).toBe('RETURN_AFTER_ABSENCE');

    // Step 4: AFTER greeting generation, update the timestamp
    const updatedLastSession = nowIso;

    // Step 5: Verify next calculation with updated value shows NONE (now <= last)
    const nextAbsence = calculateSessionAbsence({
      nowIso,
      lastSessionStartedAt: updatedLastSession,
    });
    // now === last means now <= last, so band is NONE
    expect(nextAbsence.band).toBe('NONE');
  });

  it('E4: LONG_RETURN correctly detected at 14+ days', () => {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const result = calculateSessionAbsence({
      nowIso,
      lastSessionStartedAt: fourteenDaysAgo,
    });

    expect(result.band).toBe('LONG_RETURN');
    expect(result.isReturnAfterAbsence).toBe(true);
    expect(result.absenceDaysExact).toBeCloseTo(14, 0);
  });

  it('E5: Absence at exactly 2.99 days does NOT trigger return', () => {
    const almostThreeDays = new Date(Date.now() - 2.99 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const result = calculateSessionAbsence({
      nowIso,
      lastSessionStartedAt: almostThreeDays,
    });

    expect(result.band).toBe('SHORT');
    expect(result.isReturnAfterAbsence).toBe(false);
  });
});
