/**
 * InternalClockService — Single source of truth for time in RecoFree.
 *
 * DESIGN: Always reads fresh device time via LocalDeviceTimeService.
 * The "internal clock" concept means all app code reads time through THIS
 * service (not raw Date()), enabling:
 * - Centralized timezone tracking
 * - Automatic recalibration on foreground return
 * - Test-time override capability
 *
 * Recalibrates (refreshes device context) when:
 * - App starts (mount)
 * - App returns to foreground (every time, not just timezone change)
 * - Timezone changes detected
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
  /** Epoch milliseconds */
  epochMs: number;
  /** UTC ISO string */
  utcIso: string;
  /** Offset from UTC in minutes */
  offsetMinutes: number;
}

// ─── State ──────────────────────────────────────────────────────────────────

let lastKnownTimezone: string | null = null;
let isInitialized = false;

// Testing override
let testOverride: InternalClockSnapshot | null = null;

// ─── Public API ─────────────────────────────────────────────────────────────

export const InternalClockService = {
  /**
   * Initialize the internal clock. Call at app-start.
   * Refreshes the device time context and records the timezone.
   */
  calibrate(): void {
    LocalDeviceTimeService.refreshDeviceTimeContext();
    const snapshot = LocalDeviceTimeService.now();
    lastKnownTimezone = snapshot.timeZone;
    isInitialized = true;

    console.log(
      `[InternalClock] Calibrated: ${snapshot.localDate} ${snapshot.localTime} (${snapshot.timeZone})`
    );
  },

  /**
   * Recalibrate on foreground return.
   * Always refreshes device context to ensure fresh time.
   * Returns whether the timezone changed (useful for notification rescheduling).
   */
  recalibrateOnForeground(): { timeZoneChanged: boolean } {
    const { timeZoneChanged } = LocalDeviceTimeService.refreshDeviceTimeContext();
    const snapshot = LocalDeviceTimeService.now();

    if (timeZoneChanged) {
      console.log(
        `[InternalClock] Timezone changed: ${lastKnownTimezone} → ${snapshot.timeZone}`
      );
      lastKnownTimezone = snapshot.timeZone;
    }

    return { timeZoneChanged };
  },

  /**
   * Check if timezone changed and recalibrate if needed.
   * Returns true if timezone changed.
   * @deprecated Use recalibrateOnForeground() instead.
   */
  checkAndRecalibrate(): boolean {
    const { timeZoneChanged } = this.recalibrateOnForeground();
    return timeZoneChanged;
  },

  /**
   * Get current time from the internal clock.
   * This is the SINGLE SOURCE OF TRUTH for all time reads in the app.
   *
   * Always reads fresh device time — no stale anchor, no drift.
   */
  now(): InternalClockSnapshot {
    // Test override takes precedence
    if (testOverride) return testOverride;

    // Ensure initialized
    if (!isInitialized) {
      this.calibrate();
    }

    const snapshot = LocalDeviceTimeService.now();

    return {
      localHour: snapshot.localHour,
      localMinute: snapshot.localMinute,
      localDate: snapshot.localDate,
      localTime: snapshot.localTime,
      daypart: deriveCyclePart(snapshot.localHour),
      timezone: snapshot.timeZone,
      locale: snapshot.locale,
      localWeekday: snapshot.localWeekday,
      epochMs: snapshot.epochMs,
      utcIso: snapshot.utcIso,
      offsetMinutes: snapshot.offsetMinutes,
    };
  },

  /**
   * Whether the clock has been initialized at least once.
   */
  isCalibrated(): boolean {
    return isInitialized;
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
    return this.now().timezone;
  },

  /**
   * Get current local date as YYYY-MM-DD.
   */
  getLocalDate(): string {
    return this.now().localDate;
  },

  // ─── Testing Support ────────────────────────────────────────────────────

  /**
   * Override the clock output for testing. Pass null to clear.
   */
  _setTestOverride(override: InternalClockSnapshot | null): void {
    testOverride = override;
  },

  /**
   * Reset all state. For testing only.
   */
  _reset(): void {
    lastKnownTimezone = null;
    isInitialized = false;
    testOverride = null;
  },

  /**
   * Get last known timezone. For debugging.
   */
  _getLastKnownTimezone(): string | null {
    return lastKnownTimezone;
  },
};
