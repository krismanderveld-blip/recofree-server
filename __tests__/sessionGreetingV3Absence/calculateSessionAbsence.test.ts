/**
 * Absence Awareness — calculateSessionAbsence Tests
 * Tests: band classification, edge cases, invalid timestamps
 */
import { describe, it, expect } from 'vitest';
import {
  calculateSessionAbsence,
  ABSENCE_RETURN_MIN_DAYS,
  ABSENCE_LONG_RETURN_MIN_DAYS,
} from '@/lib/features/sessionGreeting/calculateSessionAbsence';

const NOW = '2026-06-15T09:00:00.000Z';

describe('calculateSessionAbsence', () => {
  it('A1: Returns NONE when lastSessionStartedAt is null', () => {
    const result = calculateSessionAbsence({ nowIso: NOW, lastSessionStartedAt: null });
    expect(result.band).toBe('NONE');
    expect(result.isReturnAfterAbsence).toBe(false);
    expect(result.absenceDaysExact).toBeNull();
  });

  it('A2: Returns NONE when lastSessionStartedAt is undefined', () => {
    const result = calculateSessionAbsence({ nowIso: NOW, lastSessionStartedAt: undefined });
    expect(result.band).toBe('NONE');
  });

  it('A3: Returns SHORT when absence < 3 days (1 day)', () => {
    const lastSession = '2026-06-14T09:00:00.000Z'; // 1 day ago
    const result = calculateSessionAbsence({ nowIso: NOW, lastSessionStartedAt: lastSession });
    expect(result.band).toBe('SHORT');
    expect(result.isReturnAfterAbsence).toBe(false);
    expect(result.absenceDaysExact).toBeCloseTo(1, 1);
  });

  it('A4: Returns SHORT when absence is exactly 2.9 days', () => {
    const lastSession = new Date(new Date(NOW).getTime() - 2.9 * 24 * 60 * 60 * 1000).toISOString();
    const result = calculateSessionAbsence({ nowIso: NOW, lastSessionStartedAt: lastSession });
    expect(result.band).toBe('SHORT');
    expect(result.isReturnAfterAbsence).toBe(false);
  });

  it('A5: Returns RETURN_AFTER_ABSENCE when absence is exactly 3 days', () => {
    const lastSession = new Date(new Date(NOW).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const result = calculateSessionAbsence({ nowIso: NOW, lastSessionStartedAt: lastSession });
    expect(result.band).toBe('RETURN_AFTER_ABSENCE');
    expect(result.isReturnAfterAbsence).toBe(true);
    expect(result.absenceDaysExact).toBeCloseTo(3, 1);
  });

  it('A6: Returns RETURN_AFTER_ABSENCE when absence is 7 days', () => {
    const lastSession = new Date(new Date(NOW).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = calculateSessionAbsence({ nowIso: NOW, lastSessionStartedAt: lastSession });
    expect(result.band).toBe('RETURN_AFTER_ABSENCE');
    expect(result.isReturnAfterAbsence).toBe(true);
    expect(result.absenceDaysExact).toBeCloseTo(7, 1);
  });

  it('A7: Returns LONG_RETURN when absence is exactly 14 days', () => {
    const lastSession = new Date(new Date(NOW).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const result = calculateSessionAbsence({ nowIso: NOW, lastSessionStartedAt: lastSession });
    expect(result.band).toBe('LONG_RETURN');
    expect(result.isReturnAfterAbsence).toBe(true);
    expect(result.absenceDaysExact).toBeCloseTo(14, 1);
  });

  it('A8: Returns LONG_RETURN when absence is 30 days', () => {
    const lastSession = new Date(new Date(NOW).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = calculateSessionAbsence({ nowIso: NOW, lastSessionStartedAt: lastSession });
    expect(result.band).toBe('LONG_RETURN');
    expect(result.isReturnAfterAbsence).toBe(true);
    expect(result.absenceDaysExact).toBeCloseTo(30, 1);
  });

  it('A9: Returns NONE when lastSessionStartedAt is in the future', () => {
    const futureSession = '2026-06-16T09:00:00.000Z';
    const result = calculateSessionAbsence({ nowIso: NOW, lastSessionStartedAt: futureSession });
    expect(result.band).toBe('NONE');
    expect(result.isReturnAfterAbsence).toBe(false);
  });

  it('A10: Returns NONE when lastSessionStartedAt is invalid string', () => {
    const result = calculateSessionAbsence({ nowIso: NOW, lastSessionStartedAt: 'not-a-date' });
    expect(result.band).toBe('NONE');
    expect(result.isReturnAfterAbsence).toBe(false);
  });

  it('A11: Threshold constants are correct', () => {
    expect(ABSENCE_RETURN_MIN_DAYS).toBe(3);
    expect(ABSENCE_LONG_RETURN_MIN_DAYS).toBe(14);
  });

  it('A12: absenceHoursExact is calculated correctly', () => {
    const lastSession = new Date(new Date(NOW).getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const result = calculateSessionAbsence({ nowIso: NOW, lastSessionStartedAt: lastSession });
    expect(result.absenceHoursExact).toBeCloseTo(120, 0);
  });
});
