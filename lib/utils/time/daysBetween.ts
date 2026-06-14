/**
 * Calculate the number of days between two ISO timestamps.
 */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return (to - from) / (24 * 60 * 60 * 1000);
}
