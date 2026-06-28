/**
 * LocalDeviceTimeService — Central local device time source for RecoFree.
 *
 * This is the ONLY place in the app that may read the device clock directly.
 * All components, engines, modules, logging, greetings, mood-history, diary,
 * session lifecycle, and notification preparation MUST use this service.
 *
 * Forbidden pattern: `new Date()` anywhere outside this file and its tests.
 * Allowed pattern: `LocalDeviceTimeService.now()` or the `useLocalDeviceTime()` hook.
 */

import type {
  LocalTimeSnapshot,
  CycleTimestamp,
  CyclePart,
  FormatLocalTimeOptions,
  DeviceTimeContext,
  TimeProvider,
} from './types';

// ─── Default Device Provider ────────────────────────────────────────────────

/**
 * Production TimeProvider: reads from the actual device clock.
 */
const deviceProvider: TimeProvider = {
  nowMs: () => Date.now(),
  getTimeZone: () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'Europe/Amsterdam'; // Safe fallback for Benelux-focused app
    }
  },
  getLocale: () => {
    try {
      // Use Intl to detect device locale
      const resolved = Intl.DateTimeFormat().resolvedOptions();
      return resolved.locale || 'nl-NL';
    } catch {
      return 'nl-NL';
    }
  },
  getMonotonicMs: () => {
    // performance.now() is available in React Native (Hermes) and web
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now();
    }
    return Date.now();
  },
};

// ─── Service State ──────────────────────────────────────────────────────────

let activeProvider: TimeProvider = deviceProvider;
let cachedContext: DeviceTimeContext | null = null;

// ─── Internal Helpers ───────────────────────────────────────────────────────

function getLocalParts(epochMs: number, timeZone: string): {
  localDate: string;
  localTime: string;
  localHour: number;
  localMinute: number;
  localWeekday: number;
  offsetMinutes: number;
} {
  const date = new Date(epochMs);

  // Get local date parts via Intl (timezone-aware, no manual offset)
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = dateParts.find(p => p.type === 'year')?.value ?? '2026';
  const month = dateParts.find(p => p.type === 'month')?.value ?? '01';
  const day = dateParts.find(p => p.type === 'day')?.value ?? '01';
  const localDate = `${year}-${month}-${day}`;

  // Get local time parts
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hourStr = timeParts.find(p => p.type === 'hour')?.value ?? '00';
  const minuteStr = timeParts.find(p => p.type === 'minute')?.value ?? '00';
  const secondStr = timeParts.find(p => p.type === 'second')?.value ?? '00';
  const localHour = parseInt(hourStr, 10);
  const localMinute = parseInt(minuteStr, 10);
  const localTime = `${hourStr}:${minuteStr}:${secondStr}`;

  // Get weekday (1=Monday to 7=Sunday, ISO-8601)
  const weekdayParts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).formatToParts(date);
  const weekdayStr = weekdayParts.find(p => p.type === 'weekday')?.value ?? 'Mon';
  const weekdayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  const localWeekday = weekdayMap[weekdayStr] ?? 1;

  // Calculate offset: difference between UTC and local time in minutes
  // We derive this from the local hour/minute vs UTC hour/minute
  const utcHour = date.getUTCHours();
  const utcMinute = date.getUTCMinutes();
  let offsetMinutes = (localHour * 60 + localMinute) - (utcHour * 60 + utcMinute);
  // Handle day boundary wrap
  if (offsetMinutes > 720) offsetMinutes -= 1440;
  if (offsetMinutes < -720) offsetMinutes += 1440;

  return { localDate, localTime, localHour, localMinute, localWeekday, offsetMinutes };
}

function deriveCyclePart(localHour: number): CyclePart {
  if (localHour >= 5 && localHour < 12) return 'morning';
  if (localHour >= 12 && localHour < 17) return 'afternoon';
  if (localHour >= 17 && localHour < 22) return 'evening';
  return 'night';
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const LocalDeviceTimeService = {
  /**
   * Returns a complete LocalTimeSnapshot from the current device clock.
   * All fields are derived from the same base instant.
   */
  now(): LocalTimeSnapshot {
    const context = this._getContext();
    const epochMs = activeProvider.nowMs();
    const monotonicMs = activeProvider.getMonotonicMs();
    const date = new Date(epochMs);
    const utcIso = date.toISOString();

    const { localDate, localTime, localHour, localMinute, localWeekday, offsetMinutes } =
      getLocalParts(epochMs, context.timeZone);

    return {
      utcIso,
      epochMs,
      timeZone: context.timeZone,
      locale: context.locale,
      localDate,
      localTime,
      localHour,
      localMinute,
      localDayKey: localDate, // Same format, semantic distinction
      localMonthKey: localDate.slice(0, 7),
      localWeekday,
      offsetMinutes,
      source: 'device_local_time',
      capturedAtMonotonicMs: monotonicMs,
    };
  },

  /**
   * Returns local date as "YYYY-MM-DD".
   */
  getCurrentLocalDate(): string {
    return this.now().localDate;
  },

  /**
   * Returns local day key as "YYYY-MM-DD" (for storage/grouping).
   */
  getCurrentLocalDayKey(): string {
    return this.now().localDayKey;
  },

  /**
   * Returns local hour 0-23.
   */
  getCurrentLocalHour(): number {
    return this.now().localHour;
  },

  /**
   * Returns current IANA timezone of the device.
   */
  getCurrentTimeZone(): string {
    return this._getContext().timeZone;
  },

  /**
   * Returns locale-aware formatted local time string.
   */
  formatLocalTime(options?: FormatLocalTimeOptions): string {
    const context = this._getContext();
    const epochMs = activeProvider.nowMs();
    const date = new Date(epochMs);
    const locale = options?.locale ?? context.locale;

    try {
      const formatter = new Intl.DateTimeFormat(locale, {
        timeZone: context.timeZone,
        dateStyle: options?.dateStyle ?? 'medium',
        timeStyle: options?.timeStyle ?? 'short',
      });
      return formatter.format(date);
    } catch {
      return date.toISOString();
    }
  },

  /**
   * Returns a CycleTimestamp compatible with existing session-greeting,
   * logs, mood-history, and session lifecycle code.
   */
  toCycleTimestamp(): CycleTimestamp {
    const snapshot = this.now();
    return {
      utcIso: snapshot.utcIso,
      epochMs: snapshot.epochMs,
      localDate: snapshot.localDate,
      localDayKey: snapshot.localDayKey,
      localHour: snapshot.localHour,
      timeZone: snapshot.timeZone,
      locale: snapshot.locale,
      cyclePart: deriveCyclePart(snapshot.localHour),
      source: 'device_local_time',
    };
  },

  /**
   * Converts a stored UTC timestamp to local representation.
   * If timeZone is not provided, uses current device timezone.
   * For historical display, pass the original stored timezone.
   */
  fromUtcToLocal(utcIso: string, timeZone?: string): {
    localDate: string;
    localTime: string;
    localHour: number;
    localDayKey: string;
    timeZone: string;
  } {
    const tz = timeZone ?? this._getContext().timeZone;
    const epochMs = new Date(utcIso).getTime();
    const { localDate, localTime, localHour } = getLocalParts(epochMs, tz);
    return {
      localDate,
      localTime,
      localHour,
      localDayKey: localDate,
      timeZone: tz,
    };
  },

  /**
   * Determines if the local day has changed since a previous snapshot.
   * Compares on localDayKey, NOT on UTC date.
   */
  hasLocalDayChanged(previousSnapshot: Pick<LocalTimeSnapshot, 'localDayKey'>): boolean {
    const current = this.now();
    return current.localDayKey !== previousSnapshot.localDayKey;
  },

  /**
   * Reloads locale and timezone from the device.
   * Call on: app launch, app foreground, session start, timezone change.
   * Returns the new context and whether timezone changed.
   */
  refreshDeviceTimeContext(): { context: DeviceTimeContext; timeZoneChanged: boolean } {
    const previousTz = cachedContext?.timeZone ?? null;
    const newTimeZone = activeProvider.getTimeZone();
    const newLocale = activeProvider.getLocale();
    const newContext: DeviceTimeContext = {
      timeZone: newTimeZone,
      locale: newLocale,
      lastRefreshEpochMs: activeProvider.nowMs(),
    };
    cachedContext = newContext;
    return {
      context: newContext,
      timeZoneChanged: previousTz !== null && previousTz !== newTimeZone,
    };
  },

  // ─── Internal ─────────────────────────────────────────────────────────────

  /**
   * Gets or initializes the cached device context.
   */
  _getContext(): DeviceTimeContext {
    if (!cachedContext) {
      this.refreshDeviceTimeContext();
    }
    return cachedContext!;
  },

  // ─── Testing Support ──────────────────────────────────────────────────────

  /**
   * Replaces the active TimeProvider. For testing only.
   */
  _setProvider(provider: TimeProvider): void {
    activeProvider = provider;
    cachedContext = null; // Force re-read on next access
  },

  /**
   * Restores the default device provider. For testing only.
   */
  _resetProvider(): void {
    activeProvider = deviceProvider;
    cachedContext = null;
  },

  /**
   * Returns the current cached context (for debugging/testing).
   */
  _getCachedContext(): DeviceTimeContext | null {
    return cachedContext;
  },
};

// ─── Utility Exports ────────────────────────────────────────────────────────

/**
 * Derive CyclePart from a local hour. Exported for use in greeting logic.
 */
export { deriveCyclePart };

export type { LocalTimeSnapshot, CycleTimestamp, CyclePart, FormatLocalTimeOptions, TimeProvider };
