/**
 * Deepening Fragment Cache — LOCAL MODULE
 *
 * Purpose: Cache deepening fragments within a session so that repeated
 * references to the same person/schema don't require re-scanning the
 * full backpack/logs.dat stores every turn.
 *
 * Design:
 * - In-memory Map keyed by `{type}:{label}` (e.g. "person:Sarah", "schema:verlating")
 * - Cleared on session end (new session = fresh cache)
 * - TTL per entry: 30 minutes (safety net for long sessions)
 * - Max entries: 20 (prevents unbounded growth)
 * - Cache hit returns the fragment directly; cache miss triggers normal retrieval
 *
 * Integration:
 * - resolveDeepening() checks cache before calling retrieve* functions
 * - After retrieval, fragment is stored in cache
 * - Pipeline calls clearDeepeningCache() on session start
 */

import type { DeepeningFragment } from './context-dat-deepening';

// ─── Types ────────────────────────────────────────────────────

interface CacheEntry {
  fragment: DeepeningFragment;
  cachedAt: number; // Date.now()
  hitCount: number;
}

export interface DeepeningCacheStats {
  hits: number;
  misses: number;
  entries: number;
  evictions: number;
}

// ─── Constants ────────────────────────────────────────────────

const MAX_ENTRIES = 20;
const TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Cache Store ─────────────────────────────────────────────

let cache = new Map<string, CacheEntry>();
let stats: DeepeningCacheStats = { hits: 0, misses: 0, entries: 0, evictions: 0 };

// ─── Public API ──────────────────────────────────────────────

/**
 * Build a cache key from fragment type and label.
 */
export function buildCacheKey(type: DeepeningFragment['type'], label: string): string {
  return `${type}:${label.toLowerCase().trim()}`;
}

/**
 * Look up a cached deepening fragment.
 * Returns the fragment if found and not expired, null otherwise.
 */
export function getCachedFragment(type: DeepeningFragment['type'], label: string): DeepeningFragment | null {
  const key = buildCacheKey(type, label);
  const entry = cache.get(key);

  if (!entry) {
    stats.misses++;
    return null;
  }

  // Check TTL
  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(key);
    stats.entries = cache.size;
    stats.misses++;
    return null;
  }

  entry.hitCount++;
  stats.hits++;
  return entry.fragment;
}

/**
 * Store a deepening fragment in the cache.
 * Evicts oldest entry if max capacity is reached.
 */
export function cacheFragment(fragment: DeepeningFragment): void {
  const key = buildCacheKey(fragment.type, fragment.label);

  // Evict oldest if at capacity and this is a new key
  if (!cache.has(key) && cache.size >= MAX_ENTRIES) {
    evictOldest();
  }

  cache.set(key, {
    fragment,
    cachedAt: Date.now(),
    hitCount: 0,
  });
  stats.entries = cache.size;
}

/**
 * Clear the entire cache. Called on session start.
 */
export function clearDeepeningCache(): void {
  cache = new Map();
  stats = { hits: 0, misses: 0, entries: 0, evictions: 0 };
}

/**
 * Get current cache statistics (for trace/debug).
 */
export function getDeepeningCacheStats(): DeepeningCacheStats {
  return { ...stats };
}

/**
 * Get number of cached entries (for testing).
 */
export function getCacheSize(): number {
  return cache.size;
}

// ─── Internal ────────────────────────────────────────────────

function evictOldest(): void {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, entry] of cache.entries()) {
    if (entry.cachedAt < oldestTime) {
      oldestTime = entry.cachedAt;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    cache.delete(oldestKey);
    stats.evictions++;
    stats.entries = cache.size;
  }
}
