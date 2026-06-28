/**
 * LocalDeviceTimeService — Type definitions.
 *
 * Central type contract for all time-related operations in RecoFree.
 * No component, engine, or utility should use `new Date()` directly.
 */

/**
 * Canonical snapshot of local device time at a single moment.
 * All fields are derived from the same base instant to guarantee consistency.
 */
export interface LocalTimeSnapshot {
  /** ISO-8601 UTC representation (e.g. "2026-06-28T06:30:00.000Z"). For storage/audit. */
  utcIso: string;
  /** Unix timestamp in milliseconds. For sorting, comparison, duration calculation. */
  epochMs: number;
  /** IANA timezone of the device (e.g. "Europe/Brussels"). */
  timeZone: string;
  /** Device locale (e.g. "nl-BE"). */
  locale: string;
  /** Local date as YYYY-MM-DD. */
  localDate: string;
  /** Local time as HH:mm:ss. */
  localTime: string;
  /** Local hour 0-23. Used for greetings and day parts. */
  localHour: number;
  /** Local minute 0-59. */
  localMinute: number;
  /** Local day key YYYY-MM-DD. For grouping mood-history, diary, daily limits. */
  localDayKey: string;
  /** Local month key YYYY-MM. */
  localMonthKey: string;
  /** Local weekday 1 (Monday) to 7 (Sunday), ISO-8601 numbering. */
  localWeekday: number;
  /** UTC offset in minutes at moment of capture. Informational only. */
  offsetMinutes: number;
  /** Always "device_local_time". */
  source: 'device_local_time';
  /** Monotonic timestamp (performance.now or Date.now fallback) for debugging. */
  capturedAtMonotonicMs: number;
}

/**
 * Day part derived from localHour.
 * Boundaries:
 *   morning:   05:00 – 11:59
 *   afternoon: 12:00 – 16:59
 *   evening:   17:00 – 21:59
 *   night:     22:00 – 04:59
 */
export type CyclePart = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * CycleTimestamp — backwards-compatible object that existing session-greeting,
 * logs, mood-history, and session lifecycle code can consume.
 */
export interface CycleTimestamp {
  utcIso: string;
  epochMs: number;
  localDate: string;
  localDayKey: string;
  localHour: number;
  timeZone: string;
  locale: string;
  cyclePart: CyclePart;
  source: 'device_local_time';
}

/**
 * Options for formatLocalTime().
 */
export interface FormatLocalTimeOptions {
  /** Date style: 'full' | 'long' | 'medium' | 'short'. Default: 'medium'. */
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  /** Time style: 'full' | 'long' | 'medium' | 'short'. Default: 'short'. */
  timeStyle?: 'full' | 'long' | 'medium' | 'short';
  /** Override locale for formatting. Uses device locale if omitted. */
  locale?: string;
}

/**
 * Internal device context (cached between foreground events).
 */
export interface DeviceTimeContext {
  timeZone: string;
  locale: string;
  lastRefreshEpochMs: number;
}

/**
 * TimeProvider interface for testability.
 * Production uses device clock; tests inject fixed/mock providers.
 */
export interface TimeProvider {
  /** Return current epoch milliseconds. */
  nowMs(): number;
  /** Return current IANA timezone. */
  getTimeZone(): string;
  /** Return current device locale string. */
  getLocale(): string;
  /** Return monotonic timestamp (ms). */
  getMonotonicMs(): number;
}
