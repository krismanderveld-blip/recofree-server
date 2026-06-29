/**
 * InternalClockService — Self-incrementing internal clock for RecoFree.
 *
 * Calibrates once at app-start from LocalDeviceTimeService, then computes
 * current time by adding elapsed milliseconds to the calibration anchor.
 * No setInterval needed — each call to now() is computed on-the-fly.
 *
 * Recalibrates when:
 * - App returns to foreground and timezone has changed
 * - Explicitly requested via calibrate()
 *
 * This is the SINGLE SOURCE OF TRUTH for time in the app.
 * Both greeting and dagstructuur read from this service.
 */

import { LocalDeviceTimeService, deriveCyclePart } from './LocalDeviceTimeService';
import type { CyclePart } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InternalClockSnapshot {
  /** Local hour 0-23 */
  localHour: number;
  /** Local minute 0-59 */
  localMinute: number;
  /** Local date as YYYY-MM-DD */
  localDate: string;
  /** Local time as HH:mm:ss */
  localTime: string;
  /** Day part derived from localHour */
  daypart: CyclePart;
  /** IANA timezone */
  timezone: string;
  /** Device locale */
  locale: string;
  /** ISO weekday 1=Mon, 7=Sun */
  localWeekday: number;
  /** Epoch milliseconds (computed) */
  epochMs: number;
  /** UTC ISO string (computed) */
  utcIso: string;
  /** Offset from UTC in minutes */
  offsetMinutes: number;
}

// ─── Calibration State ──────────────────────────────────────────────────────

interface CalibrationAnchor {
  /** The epoch ms at calibration moment (from Date.now()) */
  anchorEpochMs: number;
  /** The local time parts at calibration moment */
  anchorLocalHour: number;
  anchorLocalMinute: number;
  anchorLocalSecond: number;
  anchorLocalDate: string;
  anchorLocalWeekday: number;
  anchorTimezone: string;
  anchorLocale: string;
  anchorOffsetMinutes: number;
}

let calibration: CalibrationAnchor | null = null;
let isCalibrated = false;

// ─── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Compute current local time parts from calibration anchor + elapsed time.
 * This avoids calling the device clock on every access.
 */
function computeCurrentFromAnchor(): InternalClockSnapshot {
  if (!calibration) {
    // Fallback: calibrate now if not yet done
    InternalClockService.calibrate();
    return computeCurrentFromAnchor();
  }

  const now = Date.now();
  const elapsedMs = now - calibration.anchorEpochMs;

  // Compute total seconds since anchor's local midnight
  const anchorSecondsSinceMidnight =
    calibration.anchorLocalHour * 3600 +
    calibration.anchorLocalMinute * 60 +
    calibration.anchorLocalSecond;

  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  let totalSecondsSinceMidnight = anchorSecondsSinceMidnight + elapsedSeconds;

  // Calculate how many days have passed
  const daysPassed = Math.floor(totalSecondsSinceMidnight / 86400);
  totalSecondsSinceMidnight = totalSecondsSinceMidnight % 86400;
  if (totalSecondsSinceMidnight < 0) {
    totalSecondsSinceMidnight += 86400;
  }

  const localHour = Math.floor(totalSecondsSinceMidnight / 3600);
  const localMinute = Math.floor((totalSecondsSinceMidnight % 3600) / 60);
  const localSecond = totalSecondsSinceMidnight % 60;

  // Compute local date by advancing anchor date by daysPassed
  const [year, month, day] = calibration.anchorLocalDate.split('-').map(Number);
  const dateObj = new Date(year!, month! - 1, day!);
  dateObj.setDate(dateObj.getDate() + daysPassed);
  const localDate = [
    String(dateObj.getFullYear()),
    String(dateObj.getMonth() + 1).padStart(2, '0'),
    String(dateObj.getDate()).padStart(2, '0'),
  ].join('-');

  // Compute weekday (advance from anchor weekday)
  let localWeekday = ((calibration.anchorLocalWeekday - 1 + daysPassed) % 7 + 7) % 7 + 1;

  // Format time string
  const localTime = [
    String(localHour).padStart(2, '0'),
    String(localMinute).padStart(2, '0'),
    String(localSecond).padStart(2, '0'),
  ].join(':');

  // Compute epoch ms (anchor + elapsed)
  const epochMs = now;

  // Compute UTC ISO from epoch
  const utcIso = new Date(epochMs).toISOString();

  return {
    localHour,
    localMinute,
    localDate,
    localTime,
    daypart: deriveCyclePart(localHour),
    timezone: calibration.anchorTimezone,
    locale: calibration.anchorLocale,
    localWeekday,
    epochMs,
    utcIso,
    offsetMinutes: calibration.anchorOffsetMinutes,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const InternalClockService = {
  /**
   * Calibrate the internal clock from LocalDeviceTimeService.
   * Call at app-start and on timezone change.
   */
  calibrate(): void {
    const snapshot = LocalDeviceTimeService.now();
    const secondStr = snapshot.localTime.split(':')[2] ?? '0';
    const localSecond = parseInt(secondStr, 10);

    calibration = {
      anchorEpochMs: snapshot.epochMs,
      anchorLocalHour: snapshot.localHour,
      anchorLocalMinute: snapshot.localMinute,
      anchorLocalSecond: localSecond,
      anchorLocalDate: snapshot.localDate,
      anchorLocalWeekday: snapshot.localWeekday,
      anchorTimezone: snapshot.timeZone,
      anchorLocale: snapshot.locale,
      anchorOffsetMinutes: snapshot.offsetMinutes,
    };
    isCalibrated = true;

    console.log(
      `[InternalClock] Calibrated: ${snapshot.localDate} ${snapshot.localTime} (${snapshot.timeZone})`
    );
  },

  /**
   * Check if timezone changed and recalibrate if needed.
   * Returns true if recalibration occurred.
   */
  checkAndRecalibrate(): boolean {
    const { timeZoneChanged } = LocalDeviceTimeService.refreshDeviceTimeContext();
    if (timeZoneChanged) {
      console.log('[InternalClock] Timezone changed — recalibrating');
      this.calibrate();
      return true;
    }
    return false;
  },

  /**
   * Get current time from the internal clock.
   * This is the SINGLE SOURCE OF TRUTH for all time reads in the app.
   */
  now(): InternalClockSnapshot {
    return computeCurrentFromAnchor();
  },

  /**
   * Whether the clock has been calibrated at least once.
   */
  isCalibrated(): boolean {
    return isCalibrated;
  },

  /**
   * Get current daypart (morning/afternoon/evening/night).
   */
  getDaypart(): CyclePart {
    return this.now().daypart;
  },

  /**
   * Get current local hour (0-23).
   */
  getLocalHour(): number {
    return this.now().localHour;
  },

  /**
   * Get current timezone.
   */
  getTimezone(): string {
    if (!calibration) this.calibrate();
    return calibration!.anchorTimezone;
  },

  /**
   * Get current local date as YYYY-MM-DD.
   */
  getLocalDate(): string {
    return this.now().localDate;
  },

  // ─── Testing Support ────────────────────────────────────────────────────

  /**
   * Force-set calibration for testing. Production code should never call this.
   */
  _forceCalibration(anchor: CalibrationAnchor): void {
    calibration = anchor;
    isCalibrated = true;
  },

  /**
   * Reset calibration state. For testing only.
   */
  _reset(): void {
    calibration = null;
    isCalibrated = false;
  },

  /**
   * Get raw calibration anchor. For testing/debugging only.
   */
  _getCalibration(): CalibrationAnchor | null {
    return calibration;
  },
};
