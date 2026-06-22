/**
 * Session Greeting V3.3 — Central Timestamp-Based Source Dominance
 *
 * Replaces the old source-based hierarchy (session > diary > gratitude)
 * with a single timestamp comparison across all historical sources.
 *
 * The source with the most recent timestamp dominates the greeting content.
 * No fixed hierarchy — purely recency-driven.
 *
 * VSP-zone and TODAY_MOOD are NOT part of this comparison:
 * - VSP-zone is always the "now" (current moment) and is added separately
 * - TODAY_MOOD is a same-day signal, handled independently
 *
 * This function only determines which of the 3 historical sources
 * (diary, gratitude, logs/session) should get the highest relevance boost.
 */

export type HistoricalSourceType = 'RECENT_DIARY' | 'RECENT_GRATITUDE' | 'LAST_SESSION_SUMMARY';

export interface HistoricalSourceEntry {
  sourceType: HistoricalSourceType;
  timestamp: string; // ISO date string
  available: boolean; // whether this source has actual content
}

export interface MostRecentSourceResult {
  /** The source type that has the most recent timestamp */
  dominant: HistoricalSourceType | null;
  /** All sources sorted by recency (most recent first), only those that are available */
  ranked: HistoricalSourceType[];
  /** The timestamps used for comparison (for debug logging) */
  timestamps: Record<string, string>;
}

/**
 * Compares timestamps of the 3 historical greeting sources and returns
 * which one is most recent (and therefore should dominate greeting content).
 *
 * Rules:
 * 1. Only available sources (with actual content) participate.
 * 2. The source with the newest timestamp wins — no fixed hierarchy.
 * 3. If timestamps are equal (same day), session content wins as tiebreaker
 *    (because it represents actual conversation, which is richer context).
 * 4. If no sources are available, returns null.
 */
export function selectMostRecentGreetingSource(
  sources: HistoricalSourceEntry[],
): MostRecentSourceResult {
  const available = sources.filter(s => s.available && s.timestamp);

  if (available.length === 0) {
    return { dominant: null, ranked: [], timestamps: {} };
  }

  // Sort by timestamp descending (most recent first)
  const sorted = [...available].sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    if (tB !== tA) return tB - tA;
    // Tiebreaker: session > diary > gratitude (session is richer context)
    const priority: Record<HistoricalSourceType, number> = {
      'LAST_SESSION_SUMMARY': 0,
      'RECENT_DIARY': 1,
      'RECENT_GRATITUDE': 2,
    };
    return (priority[a.sourceType] ?? 99) - (priority[b.sourceType] ?? 99);
  });

  const timestamps: Record<string, string> = {};
  for (const s of available) {
    timestamps[s.sourceType] = s.timestamp;
  }

  return {
    dominant: sorted[0].sourceType,
    ranked: sorted.map(s => s.sourceType),
    timestamps,
  };
}

/**
 * Recency dominance bonuses applied to the winning source.
 * The dominant source gets a large boost to ensure it outscores others
 * regardless of base relevance differences.
 *
 * These replace the old fixed base scores (0.93 for session, 0.85 cap for diary).
 */
export const DOMINANCE_BONUS = {
  /** The most recent source gets this bonus */
  first: 0.25,
  /** Second most recent gets this bonus */
  second: 0.10,
  /** Third gets no bonus */
  third: 0.0,
} as const;
