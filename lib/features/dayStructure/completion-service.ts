/**
 * Dagstructuur Feature — Completion Service
 *
 * Tracks which blocks have been checked off per localDayKey.
 * Persisted encrypted. No engine/greeting side effects.
 */

import { readEncrypted, writeEncrypted } from '@/lib/crypto/storage-encryption';
import type { CompletionStore, DayCompletion } from './types';
import { STORAGE_KEYS } from './types';
import { COMPLETION_RETENTION_DAYS } from './constants';
import { DayStructureTimeAdapter } from './time-adapter';

// ─── Storage ────────────────────────────────────────────────────────────────

/**
 * Load the full completion store from encrypted storage.
 */
async function loadStore(): Promise<CompletionStore> {
  try {
    const raw = await readEncrypted(STORAGE_KEYS.COMPLETION);
    if (!raw) return {};
    return JSON.parse(raw) as CompletionStore;
  } catch (error) {
    console.error('[DayStructure/Completion] Failed to load store:', error);
    return {};
  }
}

/**
 * Save the full completion store to encrypted storage.
 */
async function saveStore(store: CompletionStore): Promise<void> {
  const json = JSON.stringify(store);
  await writeEncrypted(STORAGE_KEYS.COMPLETION, json);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get completion state for a specific day.
 */
export async function getCompletion(localDayKey: string): Promise<DayCompletion> {
  const store = await loadStore();
  return store[localDayKey] ?? { localDayKey, completedBlockIds: [] };
}

/**
 * Get completion state for today.
 */
export async function getTodayCompletion(): Promise<DayCompletion> {
  const today = DayStructureTimeAdapter.getCurrentLocalDayKey();
  return getCompletion(today);
}

/**
 * Toggle a block's completion state for a given day.
 * Returns the updated DayCompletion.
 */
export async function toggleBlockCompletion(
  localDayKey: string,
  blockId: string,
): Promise<DayCompletion> {
  const store = await loadStore();
  const dayCompletion = store[localDayKey] ?? { localDayKey, completedBlockIds: [] };

  const index = dayCompletion.completedBlockIds.indexOf(blockId);
  if (index >= 0) {
    // Remove (uncheck)
    dayCompletion.completedBlockIds.splice(index, 1);
  } else {
    // Add (check)
    dayCompletion.completedBlockIds.push(blockId);
  }

  store[localDayKey] = dayCompletion;
  await saveStore(store);
  return dayCompletion;
}

/**
 * Check if a specific block is completed for a given day.
 */
export async function isBlockCompleted(
  localDayKey: string,
  blockId: string,
): Promise<boolean> {
  const completion = await getCompletion(localDayKey);
  return completion.completedBlockIds.includes(blockId);
}

/**
 * Clear completion for a specific day (e.g., when day resets).
 */
export async function clearDayCompletion(localDayKey: string): Promise<void> {
  const store = await loadStore();
  delete store[localDayKey];
  await saveStore(store);
}

/**
 * Clean up old completion entries beyond retention period.
 * Call periodically (e.g., at app start).
 */
export async function cleanupOldCompletions(): Promise<number> {
  const store = await loadStore();
  const today = DayStructureTimeAdapter.getCurrentLocalDayKey();
  const todayDate = new Date(today);
  let removedCount = 0;

  for (const dayKey of Object.keys(store)) {
    const entryDate = new Date(dayKey);
    const diffMs = todayDate.getTime() - entryDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays > COMPLETION_RETENTION_DAYS) {
      delete store[dayKey];
      removedCount++;
    }
  }

  if (removedCount > 0) {
    await saveStore(store);
  }

  return removedCount;
}

/**
 * Get completion counts for a day: { total, completed }.
 */
export async function getCompletionCounts(
  localDayKey: string,
  totalBlockIds: string[],
): Promise<{ total: number; completed: number }> {
  const completion = await getCompletion(localDayKey);
  // Only count completions for blocks that still exist
  const validCompletions = completion.completedBlockIds.filter((id) =>
    totalBlockIds.includes(id),
  );
  return {
    total: totalBlockIds.length,
    completed: validCompletions.length,
  };
}

/**
 * Get the current streak: number of consecutive days (ending yesterday)
 * where at least 1 block was completed.
 */
export async function getStreak(): Promise<number> {
  const store = await loadStore();
  const today = DayStructureTimeAdapter.getCurrentLocalDayKey();
  const todayDate = new Date(today);
  let streak = 0;

  // Check yesterday backwards
  for (let i = 1; i <= COMPLETION_RETENTION_DAYS; i++) {
    const checkDate = new Date(todayDate);
    checkDate.setDate(checkDate.getDate() - i);
    const dayKey = checkDate.toISOString().slice(0, 10);
    const dayCompletion = store[dayKey];
    if (dayCompletion && dayCompletion.completedBlockIds.length > 0) {
      streak++;
    } else {
      break;
    }
  }

  // Also count today if any blocks completed
  const todayCompletion = store[today];
  if (todayCompletion && todayCompletion.completedBlockIds.length > 0) {
    streak++;
  }

  return streak;
}
