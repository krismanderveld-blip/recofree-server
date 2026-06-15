/**
 * Time comparison helpers for Session Greeting Engine.
 * All functions are pure and deterministic (accept nowIso as parameter).
 */

/**
 * Check if two ISO timestamps fall on the same local calendar day.
 */
export function isSameLocalCalendarDay(
  isoA: string,
  isoB: string,
  timezone: string
): boolean {
  const dateA = toLocalDateString(isoA, timezone);
  const dateB = toLocalDateString(isoB, timezone);
  return dateA === dateB;
}

/**
 * Get age of an ISO timestamp in fractional days relative to nowIso.
 */
export function getAgeInDays(targetIso: string, nowIso: string): number {
  const nowMs = new Date(nowIso).getTime();
  const targetMs = new Date(targetIso).getTime();
  return (nowMs - targetMs) / (1000 * 60 * 60 * 24);
}

/**
 * Get age of an ISO timestamp in fractional hours relative to nowIso.
 */
export function getAgeInHours(targetIso: string, nowIso: string): number {
  const nowMs = new Date(nowIso).getTime();
  const targetMs = new Date(targetIso).getTime();
  return (nowMs - targetMs) / (1000 * 60 * 60);
}

/**
 * Check if target is less than N days old relative to nowIso.
 * Strictly less than (not equal).
 */
export function isUnderDays(targetIso: string, nowIso: string, days: number): boolean {
  return getAgeInDays(targetIso, nowIso) < days;
}

/**
 * Check if target is less than N hours old relative to nowIso.
 * Strictly less than (not equal).
 */
export function isUnderHours(targetIso: string, nowIso: string, hours: number): boolean {
  return getAgeInHours(targetIso, nowIso) < hours;
}

/**
 * Convert ISO timestamp to local date string (YYYY-MM-DD) in given timezone.
 */
function toLocalDateString(iso: string, timezone: string): string {
  try {
    const date = new Date(iso);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find(p => p.type === 'year')?.value ?? '';
    const month = parts.find(p => p.type === 'month')?.value ?? '';
    const day = parts.find(p => p.type === 'day')?.value ?? '';
    return `${year}-${month}-${day}`;
  } catch {
    // Fallback: use UTC date
    return iso.slice(0, 10);
  }
}
