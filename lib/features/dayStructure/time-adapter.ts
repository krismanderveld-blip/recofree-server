/**
 * Dagstructuur Feature — Time Adapter
 *
 * Implements DayStructureTimePort using LocalDeviceTimeService.
 * All time logic for the dagstructuur feature flows through this adapter.
 */

import { LocalDeviceTimeService } from '@/lib/core/time';
import type { DayStructureTimePort, Weekday } from './types';
import { WEEKDAY_FROM_NUMBER, WEEKDAY_TO_NUMBER } from './types';

/**
 * Parse "HH:mm" string into hours and minutes.
 */
function parseHHMM(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

/**
 * Convert hours and minutes to total minutes since midnight.
 */
function toMinutesSinceMidnight(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

/**
 * DayStructureTimeAdapter — singleton adapter bridging LocalDeviceTimeService
 * to the dagstructuur feature's time needs.
 */
export const DayStructureTimeAdapter: DayStructureTimePort = {
  getCurrentWeekday(): Weekday {
    const snapshot = LocalDeviceTimeService.now();
    return WEEKDAY_FROM_NUMBER[snapshot.localWeekday] ?? 'monday';
  },

  getCurrentLocalDayKey(): string {
    return LocalDeviceTimeService.getCurrentLocalDayKey();
  },

  getCurrentTimezone(): string {
    return LocalDeviceTimeService.getCurrentTimeZone();
  },

  getCurrentLocalTime(): string {
    const snapshot = LocalDeviceTimeService.now();
    const h = String(snapshot.localHour).padStart(2, '0');
    const m = String(snapshot.localMinute).padStart(2, '0');
    return `${h}:${m}`;
  },

  resolveNextOccurrence(weekday: Weekday, localTime: string): Date {
    const snapshot = LocalDeviceTimeService.now();
    const currentWeekdayNum = snapshot.localWeekday; // 1=Mon, 7=Sun
    const targetWeekdayNum = WEEKDAY_TO_NUMBER[weekday];

    const { hours: targetH, minutes: targetM } = parseHHMM(localTime);

    // Calculate days until target weekday
    let daysUntil = targetWeekdayNum - currentWeekdayNum;
    if (daysUntil < 0) {
      daysUntil += 7;
    }

    // If same day, check if time has already passed
    if (daysUntil === 0) {
      const currentMinutes = toMinutesSinceMidnight(snapshot.localHour, snapshot.localMinute);
      const targetMinutes = toMinutesSinceMidnight(targetH, targetM);
      if (targetMinutes <= currentMinutes) {
        // Time already passed today, schedule for next week
        daysUntil = 7;
      }
    }

    // Build the target date in local time
    // Start from today's local date and add daysUntil
    const [year, month, day] = snapshot.localDate.split('-').map(Number);
    const baseDate = new Date(year!, month! - 1, day!);
    baseDate.setDate(baseDate.getDate() + daysUntil);
    baseDate.setHours(targetH, targetM, 0, 0);

    // Adjust for timezone: we need to produce a Date that, when interpreted
    // in the device timezone, shows the correct local time.
    // Since we're constructing from local parts, this should be correct
    // as long as we're running on the device (Date uses local timezone).
    return baseDate;
  },

  compareLocalClockTimes(a: string, b: string): number {
    const aMinutes = (() => {
      const { hours, minutes } = parseHHMM(a);
      return toMinutesSinceMidnight(hours, minutes);
    })();
    const bMinutes = (() => {
      const { hours, minutes } = parseHHMM(b);
      return toMinutesSinceMidnight(hours, minutes);
    })();
    return aMinutes - bMinutes;
  },

  hasTimezoneChanged(previousTimezone: string): boolean {
    const currentTz = LocalDeviceTimeService.getCurrentTimeZone();
    return currentTz !== previousTimezone;
  },

  getTimezoneOffsetMinutes(): number {
    const snapshot = LocalDeviceTimeService.now();
    return snapshot.offsetMinutes;
  },
};
