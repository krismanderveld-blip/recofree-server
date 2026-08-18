/**
 * Context Dat Session Cache
 * 
 * Volatile in-memory cache for contextDatSerialized.
 * Built at SESSION_INIT or backpack-dirty, reused for follow-up messages.
 * Cleared on app restart (no AsyncStorage — volatile only).
 * 
 * This ensures schemas/modes/triggers/lifeStatus reach GPT at every follow-up,
 * not just at session start.
 */

let cachedContextDatSerialized: string | undefined = undefined;
let cacheSource: 'session_init' | 'backpack_dirty_rebuild' | 'none' = 'none';
let cacheTimestamp: number = 0;
let cachedPersona: 'elias' | 'kim' | undefined = undefined;

/**
 * Store contextDatSerialized in volatile session cache.
 * Called after successful distillation at SESSION_INIT or backpack-dirty.
 */
export function cacheContextDat(
  serialized: string,
  source: 'session_init' | 'backpack_dirty_rebuild',
  persona: 'elias' | 'kim'
): void {
  cachedContextDatSerialized = serialized;
  cacheSource = source;
  cacheTimestamp = Date.now();
  cachedPersona = persona;
}

/**
 * Retrieve cached contextDatSerialized for follow-up messages.
 * Returns undefined if no cache exists or persona mismatch.
 */
export function getCachedContextDat(persona: 'elias' | 'kim'): string | undefined {
  if (!cachedContextDatSerialized) return undefined;
  // Strict persona separation: never return Kim context for Elias or vice versa
  if (cachedPersona !== persona) return undefined;
  return cachedContextDatSerialized;
}

/**
 * Get cache metadata for debug/clinical dropdown.
 */
export function getContextDatCacheStatus(persona: 'elias' | 'kim'): {
  present: boolean;
  source: 'session_init_cache' | 'rebuilt' | 'missing';
  chars: number;
  ageMs: number;
  personaMatch: boolean;
} {
  if (!cachedContextDatSerialized || cachedPersona !== persona) {
    return { present: false, source: 'missing', chars: 0, ageMs: 0, personaMatch: false };
  }
  return {
    present: true,
    source: cacheSource === 'session_init' ? 'session_init_cache' : 'rebuilt',
    chars: cachedContextDatSerialized.length,
    ageMs: Date.now() - cacheTimestamp,
    personaMatch: true,
  };
}

/**
 * Clear the cache (e.g., on session end or persona switch).
 */
export function clearContextDatCache(): void {
  cachedContextDatSerialized = undefined;
  cacheSource = 'none';
  cacheTimestamp = 0;
  cachedPersona = undefined;
}

/**
 * Check if cache is stale (older than 30 minutes).
 * Stale cache is still usable but should be rebuilt when possible.
 */
export function isContextDatCacheStale(): boolean {
  if (!cachedContextDatSerialized) return true;
  const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
  return (Date.now() - cacheTimestamp) > STALE_THRESHOLD_MS;
}
