/**
 * Dagstructuur Feature — Validation
 *
 * Validates individual blocks, day schemas, and the full week schema.
 * Returns structured ValidationError[] for programmatic handling.
 */

import type { TimeBlock, DaySchema, WeekSchema, ValidationError } from './types';
import { WEEKDAYS } from './types';
import { MAX_BLOCKS_PER_DAY, MAX_LABEL_LENGTH, MIN_LABEL_LENGTH } from './constants';
import { DayStructureTimeAdapter } from './time-adapter';

// ─── Helpers ────────────────────────────────────────────────────────────────

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidTimeFormat(time: string): boolean {
  return TIME_REGEX.test(time);
}

/**
 * Convert "HH:mm" to minutes since midnight.
 */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Check if two blocks overlap, considering midnight crossing.
 * Two blocks overlap if their time ranges intersect.
 */
function blocksOverlap(a: TimeBlock, b: TimeBlock): boolean {
  const aStart = toMinutes(a.startTime);
  const aEnd = toMinutes(a.endTime);
  const bStart = toMinutes(b.startTime);
  const bEnd = toMinutes(b.endTime);

  // Normalize ranges for midnight crossing
  const aRanges = aEnd > aStart
    ? [{ start: aStart, end: aEnd }]
    : [{ start: aStart, end: 24 * 60 }, { start: 0, end: aEnd }];

  const bRanges = bEnd > bStart
    ? [{ start: bStart, end: bEnd }]
    : [{ start: bStart, end: 24 * 60 }, { start: 0, end: bEnd }];

  // Check if any pair of ranges overlap
  for (const ar of aRanges) {
    for (const br of bRanges) {
      if (ar.start < br.end && br.start < ar.end) {
        return true;
      }
    }
  }
  return false;
}

// ─── Block Validation ───────────────────────────────────────────────────────

/**
 * Validate a single time block.
 */
export function validateBlock(block: TimeBlock): ValidationError[] {
  const errors: ValidationError[] = [];

  // Label check (wake/sleep blocks don't require labels)
  if (block.kind === 'activity' && (!block.label || block.label.trim().length < MIN_LABEL_LENGTH)) {
    errors.push({
      target: block.id,
      code: 'MISSING_LABEL',
      messageKey: 'dayStructure.validation.missing_label',
    });
  }
  if (block.label && block.label.length > MAX_LABEL_LENGTH) {
    errors.push({
      target: block.id,
      code: 'MISSING_LABEL',
      messageKey: 'dayStructure.validation.label_too_long',
    });
  }

  // Time format check
  if (!isValidTimeFormat(block.startTime)) {
    errors.push({
      target: block.id,
      code: 'INVALID_TIME_FORMAT',
      messageKey: 'dayStructure.validation.invalid_start_time',
    });
  }
  if (!isValidTimeFormat(block.endTime)) {
    errors.push({
      target: block.id,
      code: 'INVALID_TIME_FORMAT',
      messageKey: 'dayStructure.validation.invalid_end_time',
    });
  }

  // Start equals end (zero-duration block) — allowed for wake/sleep (point-in-time)
  if (block.startTime === block.endTime && block.kind === 'activity') {
    errors.push({
      target: block.id,
      code: 'START_EQUALS_END',
      messageKey: 'dayStructure.validation.start_equals_end',
    });
  }

  // Alarm only on wake blocks
  if (block.notificationProfile === 'alarm' && block.kind !== 'wake') {
    errors.push({
      target: block.id,
      code: 'ALARM_ON_NON_WAKE',
      messageKey: 'dayStructure.validation.alarm_on_non_wake',
    });
  }

  // Order index check
  if (block.orderIndex < 0 || !Number.isInteger(block.orderIndex)) {
    errors.push({
      target: block.id,
      code: 'INVALID_ORDER_INDEX',
      messageKey: 'dayStructure.validation.invalid_order_index',
    });
  }

  return errors;
}

// ─── Day Validation ─────────────────────────────────────────────────────────

/**
 * Validate a full day schema.
 */
export function validateDay(day: DaySchema): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate each block individually
  for (const block of day.blocks) {
    errors.push(...validateBlock(block));
  }

  // Max blocks check
  if (day.blocks.length > MAX_BLOCKS_PER_DAY) {
    errors.push({
      target: 'day',
      code: 'INVALID_ORDER_INDEX',
      messageKey: 'dayStructure.validation.too_many_blocks',
    });
  }

  // Max 1 wake block per day
  const wakeBlocks = day.blocks.filter(b => b.kind === 'wake');
  if (wakeBlocks.length > 1) {
    errors.push({
      target: 'day',
      code: 'DUPLICATE_WAKE',
      messageKey: 'dayStructure.validation.duplicate_wake',
    });
  }

  // Max 1 sleep block per day
  const sleepBlocks = day.blocks.filter(b => b.kind === 'sleep');
  if (sleepBlocks.length > 1) {
    errors.push({
      target: 'day',
      code: 'DUPLICATE_SLEEP',
      messageKey: 'dayStructure.validation.duplicate_sleep',
    });
  }

  // Overlap check (O(n²) but n ≤ 24, acceptable)
  for (let i = 0; i < day.blocks.length; i++) {
    for (let j = i + 1; j < day.blocks.length; j++) {
      if (blocksOverlap(day.blocks[i]!, day.blocks[j]!)) {
        errors.push({
          target: day.blocks[j]!.id,
          code: 'OVERLAP',
          messageKey: 'dayStructure.validation.overlap',
        });
      }
    }
  }

  // Order index consistency
  const sorted = [...day.blocks].sort((a, b) => a.orderIndex - b.orderIndex);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i]!.orderIndex !== i) {
      errors.push({
        target: sorted[i]!.id,
        code: 'INVALID_ORDER_INDEX',
        messageKey: 'dayStructure.validation.inconsistent_order',
      });
      break; // One error is enough
    }
  }

  return errors;
}

// ─── Week Validation ────────────────────────────────────────────────────────

/**
 * Validate the full week schema.
 */
export function validateWeek(weekSchema: WeekSchema): ValidationError[] {
  const errors: ValidationError[] = [];

  // All weekdays must be present
  for (const weekday of WEEKDAYS) {
    const day = weekSchema[weekday];
    if (!day) {
      errors.push({
        target: weekday,
        code: 'INVALID_ORDER_INDEX',
        messageKey: 'dayStructure.validation.missing_weekday',
      });
      continue;
    }

    // Validate non-empty days
    if (day.blocks.length > 0) {
      errors.push(...validateDay(day));
    }
  }

  return errors;
}
