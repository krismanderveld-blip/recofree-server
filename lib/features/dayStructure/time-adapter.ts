/**
 * Dagstructuur Feature — Time Adapter
 *
 * Implements DayStructureTimePort using InternalClockService (single source of truth).
 * All time logic for the dagstructuur feature flows through this adapter.
 */

import { InternalClockService } from '@/lib/core/time';
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
 * DayStructureTimeAdapter — singleton adapter bridging InternalClockService
 * to the dagstructuur feature's time needs.
 *
 * Uses InternalClockService.now() as the single source of truth for all
 * time reads (weekday, date, timezone, local time).
 */
export const DayStructureTimeAdapter: DayStructureTimePort = {
  getCurrentWeekday(): Weekday {
    const clock = InternalClockService.now();
    return WEEKDAY_FROM_NUMBER[clock.localWeekday] ?? 'monday';
  },

  getCurrentLocalDayKey(): string {
    return InternalClockService.getLocalDate();
  },

  getCurrentTimezone(): string {
    return InternalClockService.getTimezone();
  },

  getCurrentLocalTime(): string {
    const clock = InternalClockService.now();
    const h = String(clock.localHour).padStart(2, '0');
    const m = String(clock.localMinute).padStart(2, '0');
    return `${h}:${m}`;
  },

  resolveNextOccurrence(weekday: Weekday, localTime: string): Date {
    const clock = InternalClockService.now();
    const currentWeekdayNum = clock.localWeekday; // 1=Mon, 7=Sun
    const targetWeekdayNum = WEEKDAY_TO_NUMBER[weekday];

    const { hours: targetH, minutes: targetM } = parseHHMM(localTime);

    // Calculate days until target weekday
    let daysUntil = targetWeekdayNum - currentWeekdayNum;
    if (daysUntil < 0) {
      daysUntil += 7;
    }

    // If same day, check if time has already passed
    if (daysUntil === 0) {
      const currentMinutes = toMinutesSinceMidnight(clock.localHour, clock.localMinute);
      const targetMinutes = toMinutesSinceMidnight(targetH, targetM);
      if (targetMinutes <= currentMinutes) {
        // Time already passed today, schedule for next week
        daysUntil = 7;
      }
    }

    // Build the target date in local time
    const [year, month, day] = clock.localDate.split('-').map(Number);
    const baseDate = new Date(year!, month! - 1, day!);
    baseDate.setDate(baseDate.getDate() + daysUntil);
    baseDate.setHours(targetH, targetM, 0, 0);

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
    const currentTz = InternalClockService.getTimezone();
    return currentTz !== previousTimezone;
  },

  getTimezoneOffsetMinutes(): number {
    const clock = InternalClockService.now();
    return clock.offsetMinutes;
  },
};
