/**
 * Dagstructuur Feature — Day Structure Service
 *
 * High-level service for CRUD operations on the day structure.
 * Coordinates between repository, validation, helpers, and notifications.
 */

import type {
  DayStructureDocumentV1,
  TimeBlock,
  Weekday,
  WeekSchema,
  BlockKind,
} from './types';
import { WEEKDAYS } from './types';
import {
  loadDocument,
  saveDocument,
  loadOrCreateDocument,
  deleteDocument,
} from './repository';
import {
  createBlock,
  copyDayToAllWeekdays,
  copyDayToWeekdays,
  copyActivitiesToWeekdays,
  insertBlock,
  removeBlock,
  updateBlock,
  reorderBlocks,
  hasAnyConfiguredDay,
  getBlocksForWeekday,
} from './helpers';
import { validateDay } from './validation';
import { DayStructureTimeAdapter } from './time-adapter';
import { scheduleAllNotifications } from './notification-service';
import { loadBellState } from './permission-service';

// ─── Auto-Reschedule Helper ────────────────────────────────────────────────

/**
 * Reschedule OS-level notifications after any schema change,
 * but only if the bell is currently enabled.
 * This ensures notifications always reflect the latest schema
 * even when the user edits blocks in the editor.
 */
async function autoRescheduleIfBellEnabled(weekSchema: WeekSchema): Promise<void> {
  try {
    const bellState = await loadBellState();
    if (bellState !== 'enabled') return;
    await scheduleAllNotifications(weekSchema);
    console.log('[DayStructure/Service] Auto-rescheduled notifications after schema change');
  } catch (error) {
    console.error('[DayStructure/Service] Auto-reschedule failed:', error);
  }
}

// ─── Document Lifecycle ─────────────────────────────────────────────────────

/**
 * Get the current document (or empty if none exists).
 */
export async function getDocument(): Promise<DayStructureDocumentV1> {
  return loadOrCreateDocument();
}

/**
 * Check if a day structure has been configured.
 */
export async function isConfigured(): Promise<boolean> {
  const doc = await loadDocument();
  if (!doc) return false;
  return hasAnyConfiguredDay(doc.weekSchema);
}

/**
 * Save a complete week schema (e.g., after wizard completion).
 * Validates before saving.
 */
export async function saveWeekSchema(
  weekSchema: WeekSchema,
): Promise<{ success: boolean; errors: string[] }> {
  const doc = await loadOrCreateDocument();

  // Validate all configured days
  const errors: string[] = [];
  for (const weekday of WEEKDAYS) {
    const day = weekSchema[weekday];
    if (day && day.blocks.length > 0) {
      const dayErrors = validateDay(day);
      errors.push(...dayErrors.map((e) => e.messageKey));
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const updated: DayStructureDocumentV1 = {
    ...doc,
    weekSchema,
    lastEditedAt: new Date().toISOString(),
    timezoneAtLastPlanning: DayStructureTimeAdapter.getCurrentTimezone(),
  };

  await saveDocument(updated);

  // Auto-reschedule notifications if bell is enabled
  await autoRescheduleIfBellEnabled(weekSchema);

  return { success: true, errors: [] };
}

/**
 * Reset the entire day structure (delete document).
 */
export async function resetDayStructure(): Promise<void> {
  await deleteDocument();
}

// ─── Day Operations ─────────────────────────────────────────────────────────

/**
 * Get blocks for a specific weekday.
 */
export async function getDayBlocks(weekday: Weekday): Promise<TimeBlock[]> {
  const doc = await loadOrCreateDocument();
  return getBlocksForWeekday(doc.weekSchema, weekday);
}

/**
 * Get blocks for today.
 */
export async function getTodayBlocks(): Promise<TimeBlock[]> {
  const today = DayStructureTimeAdapter.getCurrentWeekday();
  return getDayBlocks(today);
}

/**
 * Save blocks for a specific day. Validates before saving.
 */
export async function saveDayBlocks(
  weekday: Weekday,
  blocks: TimeBlock[],
): Promise<{ success: boolean; errors: string[] }> {
  const doc = await loadOrCreateDocument();
  const daySchema = { weekday, blocks };

  const dayErrors = validateDay(daySchema);
  if (dayErrors.length > 0) {
    return { success: false, errors: dayErrors.map((e) => e.messageKey) };
  }

  const updatedSchema = { ...doc.weekSchema, [weekday]: daySchema };
  const updated: DayStructureDocumentV1 = {
    ...doc,
    weekSchema: updatedSchema,
    lastEditedAt: new Date().toISOString(),
    timezoneAtLastPlanning: DayStructureTimeAdapter.getCurrentTimezone(),
  };

  await saveDocument(updated);

  // Auto-reschedule notifications if bell is enabled
  await autoRescheduleIfBellEnabled(updatedSchema);

  return { success: true, errors: [] };
}

// ─── Block Operations ───────────────────────────────────────────────────────

/**
 * Add a new block to a day.
 */
export async function addBlock(
  weekday: Weekday,
  params: {
    label: string;
    kind: BlockKind;
    startTime: string;
    endTime: string;
  },
): Promise<{ success: boolean; errors: string[]; block?: TimeBlock }> {
  const doc = await loadOrCreateDocument();
  const currentBlocks = getBlocksForWeekday(doc.weekSchema, weekday);

  const newBlock = createBlock({
    ...params,
    orderIndex: currentBlocks.length,
  });

  const updatedBlocks = insertBlock(currentBlocks, newBlock);
  const result = await saveDayBlocks(weekday, updatedBlocks);

  return { ...result, block: result.success ? newBlock : undefined };
}

/**
 * Remove a block from a day.
 */
export async function deleteBlock(
  weekday: Weekday,
  blockId: string,
): Promise<{ success: boolean; errors: string[] }> {
  const doc = await loadOrCreateDocument();
  const currentBlocks = getBlocksForWeekday(doc.weekSchema, weekday);
  const updatedBlocks = removeBlock(currentBlocks, blockId);
  return saveDayBlocks(weekday, updatedBlocks);
}

/**
 * Update a block's properties.
 */
export async function editBlock(
  weekday: Weekday,
  blockId: string,
  updates: Partial<Omit<TimeBlock, 'id'>>,
): Promise<{ success: boolean; errors: string[] }> {
  const doc = await loadOrCreateDocument();
  const currentBlocks = getBlocksForWeekday(doc.weekSchema, weekday);
  const updatedBlocks = updateBlock(currentBlocks, blockId, updates);
  return saveDayBlocks(weekday, updatedBlocks);
}

/**
 * Reorder blocks within a day.
 */
export async function moveBlock(
  weekday: Weekday,
  fromIndex: number,
  toIndex: number,
): Promise<{ success: boolean; errors: string[] }> {
  const doc = await loadOrCreateDocument();
  const currentBlocks = getBlocksForWeekday(doc.weekSchema, weekday);
  const updatedBlocks = reorderBlocks(currentBlocks, fromIndex, toIndex);
  return saveDayBlocks(weekday, updatedBlocks);
}

// ─── Copy Operations ────────────────────────────────────────────────────────

/**
 * Copy one day's structure to all other weekdays.
 */
export async function copyToAllDays(
  sourceDay: Weekday,
): Promise<{ success: boolean; errors: string[] }> {
  const doc = await loadOrCreateDocument();
  const newSchema = copyDayToAllWeekdays(doc.weekSchema, sourceDay);
  return saveWeekSchema(newSchema);
}

/**
 * Copy one day's structure to specific weekdays.
 */
export async function copyToSpecificDays(
  sourceDay: Weekday,
  targetDays: Weekday[],
): Promise<{ success: boolean; errors: string[] }> {
  const doc = await loadOrCreateDocument();
  const newSchema = copyDayToWeekdays(doc.weekSchema, sourceDay, targetDays);
  return saveWeekSchema(newSchema);
}

/**
 * Copy only activity blocks from one day to specific weekdays.
 * Keeps existing wake/sleep blocks on target days intact.
 */
export async function copyActivitiesToSpecificDays(
  sourceDay: Weekday,
  targetDays: Weekday[],
): Promise<{ success: boolean; errors: string[] }> {
  const doc = await loadOrCreateDocument();
  const newSchema = copyActivitiesToWeekdays(doc.weekSchema, sourceDay, targetDays);
  return saveWeekSchema(newSchema);
}

/**
 * Get a snapshot of the current week schema (for undo purposes).
 */
export async function getWeekSchemaSnapshot(): Promise<WeekSchema> {
  const doc = await loadOrCreateDocument();
  // Deep clone to prevent mutation
  return JSON.parse(JSON.stringify(doc.weekSchema));
}

/**
 * Restore a previously saved week schema snapshot (undo).
 */
export async function restoreWeekSchemaSnapshot(
  snapshot: WeekSchema,
): Promise<{ success: boolean; errors: string[] }> {
  return saveWeekSchema(snapshot);
}

// ─── Query Helpers ──────────────────────────────────────────────────────────

/**
 * Get the timezone stored at last planning.
 */
export async function getLastPlanningTimezone(): Promise<string | null> {
  const doc = await loadDocument();
  return doc?.timezoneAtLastPlanning ?? null;
}

/**
 * Check if timezone has changed since last planning.
 */
export async function hasTimezoneChangedSinceLastPlanning(): Promise<boolean> {
  const lastTz = await getLastPlanningTimezone();
  if (!lastTz) return false;
  return DayStructureTimeAdapter.hasTimezoneChanged(lastTz);
}
