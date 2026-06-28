/**
 * Testing utilities for LocalDeviceTimeService.
 *
 * Provides fixed and mock TimeProviders for deterministic testing.
 * Import only in test files.
 */

import type { TimeProvider } from './types';
import { LocalDeviceTimeService } from './LocalDeviceTimeService';

/**
 * Creates a fixed TimeProvider that always returns the same moment.
 * Useful for snapshot consistency tests.
 */
export function createFixedTimeProvider(options: {
  /** ISO string or epoch ms for the fixed moment. */
  time: string | number;
  /** IANA timezone. Default: 'Europe/Amsterdam'. */
  timeZone?: string;
  /** Locale string. Default: 'nl-NL'. */
  locale?: string;
}): TimeProvider {
  const epochMs = typeof options.time === 'string'
    ? new Date(options.time).getTime()
    : options.time;
  const timeZone = options.timeZone ?? 'Europe/Amsterdam';
  const locale = options.locale ?? 'nl-NL';
  let monotonicCounter = 0;

  return {
    nowMs: () => epochMs,
    getTimeZone: () => timeZone,
    getLocale: () => locale,
    getMonotonicMs: () => ++monotonicCounter,
  };
}

/**
 * Creates a mutable TimeProvider where time can be advanced.
 * Useful for testing midnight crossings and timezone changes.
 */
export function createMutableTimeProvider(options?: {
  startTime?: string | number;
  timeZone?: string;
  locale?: string;
}): TimeProvider & {
  setTime(time: string | number): void;
  advanceMs(ms: number): void;
  setTimeZone(tz: string): void;
  setLocale(locale: string): void;
} {
  let currentEpochMs = options?.startTime
    ? (typeof options.startTime === 'string' ? new Date(options.startTime).getTime() : options.startTime)
    : Date.now();
  let currentTimeZone = options?.timeZone ?? 'Europe/Amsterdam';
  let currentLocale = options?.locale ?? 'nl-NL';
  let monotonicCounter = 0;

  const provider = {
    nowMs: () => currentEpochMs,
    getTimeZone: () => currentTimeZone,
    getLocale: () => currentLocale,
    getMonotonicMs: () => ++monotonicCounter,
    setTime(time: string | number) {
      currentEpochMs = typeof time === 'string' ? new Date(time).getTime() : time;
    },
    advanceMs(ms: number) {
      currentEpochMs += ms;
    },
    setTimeZone(tz: string) {
      currentTimeZone = tz;
    },
    setLocale(locale: string) {
      currentLocale = locale;
    },
  };

  return provider;
}

/**
 * Helper to install a fixed provider on LocalDeviceTimeService for a test,
 * and automatically restore it after.
 *
 * Usage:
 * ```ts
 * const restore = installTestProvider({ time: '2026-06-28T08:30:00Z', timeZone: 'Europe/Brussels' });
 * // ... test code ...
 * restore();
 * ```
 */
export function installTestProvider(options: {
  time: string | number;
  timeZone?: string;
  locale?: string;
}): () => void {
  const provider = createFixedTimeProvider(options);
  LocalDeviceTimeService._setProvider(provider);
  LocalDeviceTimeService.refreshDeviceTimeContext();
  return () => {
    LocalDeviceTimeService._resetProvider();
  };
}
