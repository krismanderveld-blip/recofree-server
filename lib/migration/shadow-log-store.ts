/**
 * ══════════════════════════════════════════════════════════════════════════
 * SHADOW LOG STORE — LOCAL ENCRYPTED IMPLEMENTATION
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Stores shadow comparison logs locally using the same encrypted storage
 * pattern as logs.dat. No personal content ever leaves the device.
 *
 * Storage key: 'migration_shadow_log'
 * Format: JSON array of ShadowLogEntry (encrypted at rest).
 * Retention: max 200 entries (FIFO), auto-trimmed on append.
 */

import { readEncrypted, writeEncrypted } from '@/lib/crypto/storage-encryption';
import type { ShadowLogEntry, ShadowLogStore } from './shadow-log';

const STORAGE_KEY = 'migration_shadow_log';
const MAX_ENTRIES = 200;

/**
 * Create the shadow log store instance.
 */
export function createShadowLogStore(): ShadowLogStore {
  return {
    async append(entry: ShadowLogEntry): Promise<void> {
      const existing = await readEntries();
      existing.push(entry);
      // FIFO trim
      const trimmed = existing.length > MAX_ENTRIES
        ? existing.slice(existing.length - MAX_ENTRIES)
        : existing;
      await writeEncrypted(STORAGE_KEY, JSON.stringify(trimmed));
    },

    async readAll(): Promise<ShadowLogEntry[]> {
      return readEntries();
    },

    async getSummary() {
      const entries = await readEntries();
      const totalComparisons = entries.length;
      const totalMatches = entries.filter(e => e.overallSeverity === 'none').length;
      const crisisMismatches = entries.filter(e => e.crisisMismatch).length;
      const highMismatches = entries.filter(
        e => e.overallSeverity === 'high' || e.overallSeverity === 'critical'
      ).length;
      const matchRate = totalComparisons > 0 ? totalMatches / totalComparisons : 1;
      return { totalComparisons, totalMatches, crisisMismatches, highMismatches, matchRate };
    },

    async clear(): Promise<void> {
      await writeEncrypted(STORAGE_KEY, JSON.stringify([]));
    },
  };
}

// ─── Internal ─────────────────────────────────────────────────────────

async function readEntries(): Promise<ShadowLogEntry[]> {
  try {
    const raw = await readEncrypted(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ShadowLogEntry[];
  } catch {
    return [];
  }
}
