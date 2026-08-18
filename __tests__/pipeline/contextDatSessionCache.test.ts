/**
 * FASE 1: contextDat Session Cache Tests
 * Verifies that contextDatSerialized is cached at SESSION_INIT and reused at follow-up.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  cacheContextDat,
  getCachedContextDat,
  getContextDatCacheStatus,
  clearContextDatCache,
  isContextDatCacheStale,
} from '@/lib/pipeline/context-dat-session-cache';

describe('contextDat Session Cache', () => {
  beforeEach(() => {
    clearContextDatCache();
  });

  it('1. returns undefined when no cache exists', () => {
    expect(getCachedContextDat('elias')).toBeUndefined();
    expect(getCachedContextDat('kim')).toBeUndefined();
  });

  it('2. caches and retrieves contextDat for same persona', () => {
    const data = 'schemas: abandonment\nmodes: vulnerable_child\ntriggers: isolation';
    cacheContextDat(data, 'session_init', 'elias');
    expect(getCachedContextDat('elias')).toBe(data);
  });

  it('3. persona separation: Kim cannot access Elias cache', () => {
    cacheContextDat('elias context data', 'session_init', 'elias');
    expect(getCachedContextDat('kim')).toBeUndefined();
  });

  it('4. persona separation: Elias cannot access Kim cache', () => {
    cacheContextDat('kim context data', 'session_init', 'kim');
    expect(getCachedContextDat('elias')).toBeUndefined();
  });

  it('5. cache status reports correctly when present', () => {
    cacheContextDat('test data 123', 'session_init', 'elias');
    const status = getContextDatCacheStatus('elias');
    expect(status.present).toBe(true);
    expect(status.source).toBe('session_init_cache');
    expect(status.chars).toBe(13);
    expect(status.personaMatch).toBe(true);
  });

  it('6. cache status reports missing for wrong persona', () => {
    cacheContextDat('test data', 'session_init', 'elias');
    const status = getContextDatCacheStatus('kim');
    expect(status.present).toBe(false);
    expect(status.source).toBe('missing');
  });

  it('7. clearContextDatCache removes all cached data', () => {
    cacheContextDat('some data', 'session_init', 'elias');
    clearContextDatCache();
    expect(getCachedContextDat('elias')).toBeUndefined();
  });

  it('8. backpack_dirty_rebuild source is tracked correctly', () => {
    cacheContextDat('rebuilt data', 'backpack_dirty_rebuild', 'kim');
    const status = getContextDatCacheStatus('kim');
    expect(status.present).toBe(true);
    expect(status.source).toBe('rebuilt');
  });

  it('9. fresh cache is not stale', () => {
    cacheContextDat('fresh', 'session_init', 'elias');
    expect(isContextDatCacheStale()).toBe(false);
  });

  it('10. empty cache reports stale', () => {
    expect(isContextDatCacheStale()).toBe(true);
  });

  it('11. overwrite replaces previous cache', () => {
    cacheContextDat('old data', 'session_init', 'elias');
    cacheContextDat('new data', 'backpack_dirty_rebuild', 'elias');
    expect(getCachedContextDat('elias')).toBe('new data');
  });

  it('12. persona switch clears previous persona cache', () => {
    cacheContextDat('elias data', 'session_init', 'elias');
    cacheContextDat('kim data', 'session_init', 'kim');
    // Only kim should be available now (single cache slot)
    expect(getCachedContextDat('kim')).toBe('kim data');
    expect(getCachedContextDat('elias')).toBeUndefined();
  });
});
