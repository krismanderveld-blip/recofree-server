/**
 * Clinical Memory Distillation — Pure Mappers
 *
 * FASE 8C: Pure mapping functions. No runtime integration.
 * No AsyncStorage, no server, no pipeline, no prompt, no side effects.
 */
import type { ClinicalMemoryCertainty, ClinicalMemoryFreshness } from './clinical-memory-distillation-types';

// ─── 1. mapConfidenceToClinicalMemoryCertainty ─────────────────────────────
export function mapConfidenceToClinicalMemoryCertainty(
  confidence: 'low' | 'medium' | 'high' | string | undefined,
  isUserConfirmed: boolean = false,
): ClinicalMemoryCertainty {
  if (isUserConfirmed) return 'confirmed_by_user';
  switch (confidence) {
    case 'high': return 'high_confidence_inference';
    case 'medium': return 'medium_confidence_inference';
    case 'low': return 'low_confidence_inference';
    default: return 'unknown';
  }
}

// ─── 2. mapTimestampToFreshness ────────────────────────────────────────────
export function mapTimestampToFreshness(
  timestampLocal: string | undefined | null,
  nowLocal: string,
): ClinicalMemoryFreshness {
  if (!timestampLocal) return 'unknown';

  const ts = new Date(timestampLocal).getTime();
  const now = new Date(nowLocal).getTime();

  if (isNaN(ts) || isNaN(now)) return 'unknown';

  const diffMs = now - ts;
  if (diffMs < 0) return 'current_session'; // future timestamp = current session

  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Same calendar day
  const tsDate = new Date(timestampLocal).toISOString().slice(0, 10);
  const nowDate = new Date(nowLocal).toISOString().slice(0, 10);
  if (tsDate === nowDate) return 'today';

  if (diffDays <= 7) return 'last_7_days';
  if (diffDays <= 30) return 'last_30_days';
  if (diffDays > 90) return 'stale';
  return 'older_than_30_days';
}

// ─── 3. mapZoneToVSPZone ──────────────────────────────────────────────────
export function mapZoneToVSPZone(
  zone: string | undefined | null,
): 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'unknown' {
  if (!zone) return 'unknown';
  const normalized = zone.toLowerCase().trim();
  switch (normalized) {
    case 'green':
    case 'groen':
      return 'green';
    case 'yellow':
    case 'geel':
      return 'yellow';
    case 'orange':
    case 'oranje':
      return 'orange';
    case 'red':
    case 'rood':
      return 'red';
    case 'purple':
    case 'paars':
      return 'purple';
    default:
      return 'unknown';
  }
}

// ─── 4. mapTrend ──────────────────────────────────────────────────────────
export function mapTrend(
  values: number[],
): 'improving' | 'worsening' | 'stable' | 'volatile' | 'unknown' {
  if (!values || values.length < 3) return 'unknown';

  // Calculate differences
  const diffs: number[] = [];
  for (let i = 1; i < values.length; i++) {
    diffs.push(values[i] - values[i - 1]);
  }

  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance = diffs.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / diffs.length;
  const stdDev = Math.sqrt(variance);

  // Volatile: high standard deviation relative to range
  const range = Math.max(...values) - Math.min(...values);
  if (range > 0 && stdDev / range > 0.4) return 'volatile';

  // Threshold for meaningful change
  const threshold = range > 0 ? range * 0.1 : 0.5;

  if (avgDiff < -threshold) return 'improving'; // decreasing risk = improving
  if (avgDiff > threshold) return 'worsening'; // increasing risk = worsening
  return 'stable';
}

// ─── 5. truncateAnchorText ────────────────────────────────────────────────
export function truncateAnchorText(
  text: string | undefined | null,
  maxLength: number,
): string {
  if (!text || text.trim().length === 0) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  // Cut at word boundary
  const cut = trimmed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.6) {
    return cut.slice(0, lastSpace) + '...';
  }
  return cut + '...';
}
