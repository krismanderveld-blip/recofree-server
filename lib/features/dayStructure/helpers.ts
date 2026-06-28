/**
 * Dagstructuur Feature — Helpers
 *
 * Utility functions for creating, copying, and transforming day structure data.
 */

import type {
  TimeBlock,
  DaySchema,
  WeekSchema,
  DayStructureDocumentV1,
  Weekday,
  BlockKind,
  NotificationProfile,
} from './types';
import { WEEKDAYS } from './types';

// ─── UUID Generation ────────────────────────────────────────────────────────

/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID if available, otherwise fallback.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Factory Functions ──────────────────────────────────────────────────────

/**
 * Create an empty week schema with all 7 days initialized to empty blocks.
 */
export function createEmptyWeekSchema(): WeekSchema {
  const schema = {} as WeekSchema;
  for (const weekday of WEEKDAYS) {
    schema[weekday] = { weekday, blocks: [] };
  }
  return schema;
}

/**
 * Create a new empty document.
 */
export function createEmptyDocument(timezone: string): DayStructureDocumentV1 {
  const now = new Date().toISOString();
  return {
    version: 1,
    weekSchema: createEmptyWeekSchema(),
    timezoneAtLastPlanning: timezone,
    lastEditedAt: now,
    createdAt: now,
  };
}

/**
 * Create a new time block with defaults.
 */
export function createBlock(params: {
  label: string;
  kind: BlockKind;
  startTime: string;
  endTime: string;
  orderIndex: number;
  notificationProfile?: NotificationProfile;
}): TimeBlock {
  const defaultProfile: NotificationProfile =
    params.kind === 'wake' ? 'alarm' : params.kind === 'activity' ? 'push' : 'none';

  return {
    id: generateId(),
    label: params.label,
    kind: params.kind,
    startTime: params.startTime,
    endTime: params.endTime,
    orderIndex: params.orderIndex,
    notificationProfile: params.notificationProfile ?? defaultProfile,
  };
}

// ─── Copy Operations ────────────────────────────────────────────────────────

/**
 * Copy a day's blocks to another weekday, generating new IDs.
 */
export function copyDayBlocks(sourceBlocks: TimeBlock[]): TimeBlock[] {
  return sourceBlocks.map((block) => ({
    ...block,
    id: generateId(),
  }));
}

/**
 * Copy one day's schema to all other weekdays in the week.
 * Returns a new WeekSchema with the source day's blocks copied to all days.
 */
export function copyDayToAllWeekdays(
  weekSchema: WeekSchema,
  sourceDay: Weekday,
): WeekSchema {
  const sourceBlocks = weekSchema[sourceDay]?.blocks ?? [];
  const newSchema = { ...weekSchema };

  for (const weekday of WEEKDAYS) {
    if (weekday === sourceDay) continue;
    newSchema[weekday] = {
      weekday,
      blocks: copyDayBlocks(sourceBlocks),
    };
  }

  return newSchema;
}

/**
 * Copy one day's schema to specific weekdays.
 */
export function copyDayToWeekdays(
  weekSchema: WeekSchema,
  sourceDay: Weekday,
  targetDays: Weekday[],
): WeekSchema {
  const sourceBlocks = weekSchema[sourceDay]?.blocks ?? [];
  const newSchema = { ...weekSchema };

  for (const weekday of targetDays) {
    if (weekday === sourceDay) continue;
    newSchema[weekday] = {
      weekday,
      blocks: copyDayBlocks(sourceBlocks),
    };
  }

  return newSchema;
}

// ─── Block Manipulation ─────────────────────────────────────────────────────

/**
 * Insert a block into a day's blocks at the correct order position.
 * Re-indexes all blocks after insertion.
 */
export function insertBlock(blocks: TimeBlock[], newBlock: TimeBlock): TimeBlock[] {
  const updated = [...blocks, newBlock].sort((a, b) => a.orderIndex - b.orderIndex);
  // Re-index
  return updated.map((block, index) => ({ ...block, orderIndex: index }));
}

/**
 * Remove a block by ID and re-index remaining blocks.
 */
export function removeBlock(blocks: TimeBlock[], blockId: string): TimeBlock[] {
  const filtered = blocks.filter((b) => b.id !== blockId);
  return filtered.map((block, index) => ({ ...block, orderIndex: index }));
}

/**
 * Update a block by ID within a blocks array.
 */
export function updateBlock(
  blocks: TimeBlock[],
  blockId: string,
  updates: Partial<Omit<TimeBlock, 'id'>>,
): TimeBlock[] {
  return blocks.map((block) =>
    block.id === blockId ? { ...block, ...updates } : block,
  );
}

/**
 * Reorder blocks by moving a block from one index to another.
 */
export function reorderBlocks(
  blocks: TimeBlock[],
  fromIndex: number,
  toIndex: number,
): TimeBlock[] {
  const sorted = [...blocks].sort((a, b) => a.orderIndex - b.orderIndex);
  const [moved] = sorted.splice(fromIndex, 1);
  if (!moved) return blocks;
  sorted.splice(toIndex, 0, moved);
  return sorted.map((block, index) => ({ ...block, orderIndex: index }));
}

// ─── Query Helpers ──────────────────────────────────────────────────────────

/**
 * Get blocks for the current weekday from a week schema.
 */
export function getBlocksForWeekday(
  weekSchema: WeekSchema,
  weekday: Weekday,
): TimeBlock[] {
  return weekSchema[weekday]?.blocks ?? [];
}

/**
 * Check if a day has any configured blocks.
 */
export function isDayConfigured(weekSchema: WeekSchema, weekday: Weekday): boolean {
  return (weekSchema[weekday]?.blocks.length ?? 0) > 0;
}

/**
 * Check if any day in the week has configured blocks.
 */
export function hasAnyConfiguredDay(weekSchema: WeekSchema): boolean {
  return WEEKDAYS.some((weekday) => isDayConfigured(weekSchema, weekday));
}

/**
 * Get the wake block for a day (if any).
 */
export function getWakeBlock(weekSchema: WeekSchema, weekday: Weekday): TimeBlock | undefined {
  return weekSchema[weekday]?.blocks.find((b) => b.kind === 'wake');
}

/**
 * Get the sleep block for a day (if any).
 */
export function getSleepBlock(weekSchema: WeekSchema, weekday: Weekday): TimeBlock | undefined {
  return weekSchema[weekday]?.blocks.find((b) => b.kind === 'sleep');
}

/**
 * Get all activity blocks for a day, sorted by orderIndex.
 */
export function getActivityBlocks(weekSchema: WeekSchema, weekday: Weekday): TimeBlock[] {
  return (weekSchema[weekday]?.blocks ?? [])
    .filter((b) => b.kind === 'activity')
    .sort((a, b) => a.orderIndex - b.orderIndex);
}
