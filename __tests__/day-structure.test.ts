/**
 * Dagstructuur Feature — Unit Tests
 *
 * Tests for: validation, helpers, time-adapter, types consistency
 */

import { describe, it, expect } from 'vitest';
import {
  createBlock,
  createEmptyWeekSchema,
  createEmptyDocument,
  copyDayBlocks,
  insertBlock,
  removeBlock,
  reorderBlocks,
  getWakeBlock,
  getSleepBlock,
  getActivityBlocks,
  isDayConfigured,
  hasAnyConfiguredDay,
} from '../lib/features/dayStructure/helpers';
import {
  validateBlock,
  validateDay,
  validateWeek,
} from '../lib/features/dayStructure/validation';
import {
  WEEKDAYS,
  WEEKDAY_TO_NUMBER,
  WEEKDAY_FROM_NUMBER,
  STORAGE_KEYS,
} from '../lib/features/dayStructure/types';
import type { TimeBlock, DaySchema, WeekSchema } from '../lib/features/dayStructure/types';
import {
  DEFAULT_WAKE_TIME,
  DEFAULT_SLEEP_TIME,
  MAX_BLOCKS_PER_DAY,
  MAX_LABEL_LENGTH,
} from '../lib/features/dayStructure/constants';
import { DayStructureTimeAdapter } from '../lib/features/dayStructure/time-adapter';

// ─── Types & Constants ──────────────────────────────────────────────────────

describe('DayStructure Types & Constants', () => {
  it('WEEKDAYS has 7 entries', () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toBe('monday');
    expect(WEEKDAYS[6]).toBe('sunday');
  });

  it('WEEKDAY_TO_NUMBER maps correctly', () => {
    expect(WEEKDAY_TO_NUMBER.monday).toBe(1);
    expect(WEEKDAY_TO_NUMBER.sunday).toBe(7);
  });

  it('WEEKDAY_FROM_NUMBER maps correctly', () => {
    expect(WEEKDAY_FROM_NUMBER[1]).toBe('monday');
    expect(WEEKDAY_FROM_NUMBER[7]).toBe('sunday');
  });

  it('STORAGE_KEYS are defined', () => {
    expect(STORAGE_KEYS.DOCUMENT).toBeTruthy();
    expect(STORAGE_KEYS.COMPLETION).toBeTruthy();
    expect(STORAGE_KEYS.NOTIFICATION_INDEX).toBeTruthy();
    expect(STORAGE_KEYS.BELL_STATE).toBeTruthy();
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

describe('DayStructure Helpers', () => {
  describe('createBlock', () => {
    it('creates a block with generated id', () => {
      const block = createBlock({
        label: 'Test',
        kind: 'activity',
        startTime: '09:00',
        endTime: '10:00',
        orderIndex: 0,
      });
      expect(block.id).toBeTruthy();
      expect(block.label).toBe('Test');
      expect(block.kind).toBe('activity');
      expect(block.startTime).toBe('09:00');
      expect(block.endTime).toBe('10:00');
      expect(block.notificationProfile).toBe('push'); // default for activity
    });

    it('creates a wake block with alarm profile by default', () => {
      const block = createBlock({
        label: 'Opstaan',
        kind: 'wake',
        startTime: '07:00',
        endTime: '07:00',
        orderIndex: 0,
      });
      expect(block.kind).toBe('wake');
      expect(block.notificationProfile).toBe('alarm');
    });

    it('creates a sleep block with none profile by default', () => {
      const block = createBlock({
        label: '',
        kind: 'sleep',
        startTime: '23:00',
        endTime: '23:00',
        orderIndex: 0,
      });
      expect(block.kind).toBe('sleep');
      expect(block.notificationProfile).toBe('none');
    });
  });

  describe('createEmptyWeekSchema', () => {
    it('creates schema with all 7 days empty', () => {
      const schema = createEmptyWeekSchema();
      for (const day of WEEKDAYS) {
        expect(schema[day]).toBeDefined();
        expect(schema[day].blocks).toHaveLength(0);
        expect(schema[day].weekday).toBe(day);
      }
    });
  });

  describe('createEmptyDocument', () => {
    it('creates document with version 1 and empty schema', () => {
      const doc = createEmptyDocument('Europe/Amsterdam');
      expect(doc.version).toBe(1);
      expect(doc.weekSchema).toBeDefined();
      expect(doc.createdAt).toBeTruthy();
      expect(doc.lastEditedAt).toBeTruthy();
      expect(doc.timezoneAtLastPlanning).toBe('Europe/Amsterdam');
    });
  });

  describe('copyDayBlocks', () => {
    it('creates deep copy with new IDs', () => {
      const original: TimeBlock[] = [
        createBlock({ label: 'A', kind: 'activity', startTime: '09:00', endTime: '10:00', orderIndex: 0 }),
        createBlock({ label: 'B', kind: 'activity', startTime: '10:00', endTime: '11:00', orderIndex: 1 }),
      ];
      const copy = copyDayBlocks(original);
      expect(copy).toHaveLength(2);
      expect(copy[0].id).not.toBe(original[0].id);
      expect(copy[0].label).toBe('A');
      expect(copy[1].label).toBe('B');
    });
  });

  describe('insertBlock', () => {
    it('inserts block and re-indexes by orderIndex', () => {
      const blocks: TimeBlock[] = [
        createBlock({ label: 'A', kind: 'activity', startTime: '09:00', endTime: '10:00', orderIndex: 0 }),
        createBlock({ label: 'C', kind: 'activity', startTime: '11:00', endTime: '12:00', orderIndex: 2 }),
      ];
      const newBlock = createBlock({ label: 'B', kind: 'activity', startTime: '10:00', endTime: '11:00', orderIndex: 1 });
      const result = insertBlock(blocks, newBlock);
      expect(result).toHaveLength(3);
      expect(result[0].label).toBe('A');
      expect(result[1].label).toBe('B');
      expect(result[2].label).toBe('C');
      // Re-indexed
      expect(result[0].orderIndex).toBe(0);
      expect(result[1].orderIndex).toBe(1);
      expect(result[2].orderIndex).toBe(2);
    });
  });

  describe('removeBlock', () => {
    it('removes block and reindexes', () => {
      const blocks: TimeBlock[] = [
        createBlock({ label: 'A', kind: 'activity', startTime: '09:00', endTime: '10:00', orderIndex: 0 }),
        createBlock({ label: 'B', kind: 'activity', startTime: '10:00', endTime: '11:00', orderIndex: 1 }),
        createBlock({ label: 'C', kind: 'activity', startTime: '11:00', endTime: '12:00', orderIndex: 2 }),
      ];
      const result = removeBlock(blocks, blocks[1].id);
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('A');
      expect(result[1].label).toBe('C');
      expect(result[1].orderIndex).toBe(1);
    });
  });

  describe('reorderBlocks', () => {
    it('moves block from index 0 to index 2', () => {
      const blocks: TimeBlock[] = [
        createBlock({ label: 'A', kind: 'activity', startTime: '09:00', endTime: '10:00', orderIndex: 0 }),
        createBlock({ label: 'B', kind: 'activity', startTime: '10:00', endTime: '11:00', orderIndex: 1 }),
        createBlock({ label: 'C', kind: 'activity', startTime: '11:00', endTime: '12:00', orderIndex: 2 }),
      ];
      const result = reorderBlocks(blocks, 0, 2);
      expect(result[0].label).toBe('B');
      expect(result[1].label).toBe('C');
      expect(result[2].label).toBe('A');
    });
  });

  describe('getWakeBlock / getSleepBlock / getActivityBlocks', () => {
    it('filters blocks by kind from week schema', () => {
      const schema = createEmptyWeekSchema();
      schema.monday.blocks = [
        createBlock({ label: '', kind: 'wake', startTime: '07:00', endTime: '07:00', orderIndex: 0 }),
        createBlock({ label: 'Walk', kind: 'activity', startTime: '08:00', endTime: '09:00', orderIndex: 1 }),
        createBlock({ label: 'Work', kind: 'activity', startTime: '09:00', endTime: '17:00', orderIndex: 2 }),
        createBlock({ label: '', kind: 'sleep', startTime: '23:00', endTime: '23:00', orderIndex: 3 }),
      ];
      expect(getWakeBlock(schema, 'monday')?.kind).toBe('wake');
      expect(getSleepBlock(schema, 'monday')?.kind).toBe('sleep');
      expect(getActivityBlocks(schema, 'monday')).toHaveLength(2);
    });
  });

  describe('isDayConfigured / hasAnyConfiguredDay', () => {
    it('detects configured days', () => {
      const schema = createEmptyWeekSchema();
      expect(isDayConfigured(schema, 'monday')).toBe(false);
      expect(hasAnyConfiguredDay(schema)).toBe(false);

      schema.monday.blocks.push(
        createBlock({ label: '', kind: 'wake', startTime: '07:00', endTime: '07:00', orderIndex: 0 }),
      );
      expect(isDayConfigured(schema, 'monday')).toBe(true);
      expect(hasAnyConfiguredDay(schema)).toBe(true);
    });
  });
});

// ─── Validation ─────────────────────────────────────────────────────────────

describe('DayStructure Validation', () => {
  describe('validateBlock', () => {
    it('passes for valid activity block', () => {
      const block = createBlock({
        label: 'Walk',
        kind: 'activity',
        startTime: '09:00',
        endTime: '10:00',
        orderIndex: 0,
      });
      const errors = validateBlock(block);
      expect(errors).toHaveLength(0);
    });

    it('fails for empty label on activity', () => {
      const block = createBlock({
        label: '',
        kind: 'activity',
        startTime: '09:00',
        endTime: '10:00',
        orderIndex: 0,
      });
      const errors = validateBlock(block);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.code === 'MISSING_LABEL')).toBe(true);
    });

    it('fails for invalid time format', () => {
      const block = createBlock({
        label: 'Test',
        kind: 'activity',
        startTime: '25:00',
        endTime: '10:00',
        orderIndex: 0,
      });
      const errors = validateBlock(block);
      expect(errors.some((e) => e.code === 'INVALID_TIME_FORMAT')).toBe(true);
    });

    it('fails for label exceeding max length', () => {
      const block = createBlock({
        label: 'A'.repeat(MAX_LABEL_LENGTH + 1),
        kind: 'activity',
        startTime: '09:00',
        endTime: '10:00',
        orderIndex: 0,
      });
      const errors = validateBlock(block);
      expect(errors.some((e) => e.code === 'MISSING_LABEL')).toBe(true);
    });

    it('allows empty label for wake/sleep blocks', () => {
      const wake = createBlock({
        label: '',
        kind: 'wake',
        startTime: '07:00',
        endTime: '07:00',
        orderIndex: 0,
      });
      const sleep = createBlock({
        label: '',
        kind: 'sleep',
        startTime: '23:00',
        endTime: '23:00',
        orderIndex: 0,
      });
      expect(validateBlock(wake)).toHaveLength(0);
      expect(validateBlock(sleep)).toHaveLength(0);
    });

    it('fails for activity with start equals end', () => {
      const block = createBlock({
        label: 'Test',
        kind: 'activity',
        startTime: '09:00',
        endTime: '09:00',
        orderIndex: 0,
      });
      const errors = validateBlock(block);
      expect(errors.some((e) => e.code === 'START_EQUALS_END')).toBe(true);
    });
  });

  describe('validateDay', () => {
    it('passes for valid day with wake + activities + sleep (non-overlapping)', () => {
      const day: DaySchema = {
        weekday: 'monday',
        blocks: [
          createBlock({ label: '', kind: 'wake', startTime: '07:00', endTime: '07:30', orderIndex: 0 }),
          createBlock({ label: 'Work', kind: 'activity', startTime: '09:00', endTime: '17:00', orderIndex: 1 }),
          createBlock({ label: '', kind: 'sleep', startTime: '23:00', endTime: '23:30', orderIndex: 2 }),
        ],
      };
      const errors = validateDay(day);
      expect(errors).toHaveLength(0);
    });

    it('fails for multiple wake blocks', () => {
      const day: DaySchema = {
        weekday: 'monday',
        blocks: [
          createBlock({ label: '', kind: 'wake', startTime: '07:00', endTime: '07:30', orderIndex: 0 }),
          createBlock({ label: '', kind: 'wake', startTime: '08:00', endTime: '08:30', orderIndex: 1 }),
        ],
      };
      const errors = validateDay(day);
      expect(errors.some((e) => e.code === 'DUPLICATE_WAKE')).toBe(true);
    });

    it('fails for too many blocks', () => {
      const blocks: TimeBlock[] = [];
      for (let i = 0; i <= MAX_BLOCKS_PER_DAY; i++) {
        const h = i % 24;
        const nextH = (i + 1) % 24;
        blocks.push(
          createBlock({
            label: `Block ${i}`,
            kind: 'activity',
            startTime: `${String(h).padStart(2, '0')}:00`,
            endTime: `${String(nextH).padStart(2, '0')}:00`,
            orderIndex: i,
          }),
        );
      }
      const day: DaySchema = { weekday: 'monday', blocks };
      const errors = validateDay(day);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateWeek', () => {
    it('passes for empty week', () => {
      const schema = createEmptyWeekSchema();
      const errors = validateWeek(schema);
      expect(errors).toHaveLength(0);
    });

    it('passes for valid week with one configured day (non-overlapping blocks)', () => {
      const schema = createEmptyWeekSchema();
      schema.monday.blocks = [
        createBlock({ label: '', kind: 'wake', startTime: '07:00', endTime: '07:30', orderIndex: 0 }),
        createBlock({ label: 'Work', kind: 'activity', startTime: '09:00', endTime: '17:00', orderIndex: 1 }),
      ];
      const errors = validateWeek(schema);
      expect(errors).toHaveLength(0);
    });
  });
});

// ─── Time Adapter ───────────────────────────────────────────────────────────

describe('DayStructure TimeAdapter', () => {
  it('getCurrentWeekday returns a valid weekday', () => {
    const weekday = DayStructureTimeAdapter.getCurrentWeekday();
    expect(WEEKDAYS).toContain(weekday);
  });

  it('getCurrentLocalDayKey returns YYYY-MM-DD format', () => {
    const key = DayStructureTimeAdapter.getCurrentLocalDayKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('getCurrentTimezone returns a non-empty string', () => {
    const tz = DayStructureTimeAdapter.getCurrentTimezone();
    expect(tz.length).toBeGreaterThan(0);
  });

  it('getCurrentLocalTime returns HH:mm format', () => {
    const time = DayStructureTimeAdapter.getCurrentLocalTime();
    expect(time).toMatch(/^\d{2}:\d{2}$/);
  });

  it('compareLocalClockTimes works correctly', () => {
    expect(DayStructureTimeAdapter.compareLocalClockTimes('08:00', '09:00')).toBeLessThan(0);
    expect(DayStructureTimeAdapter.compareLocalClockTimes('09:00', '08:00')).toBeGreaterThan(0);
    expect(DayStructureTimeAdapter.compareLocalClockTimes('08:00', '08:00')).toBe(0);
    expect(DayStructureTimeAdapter.compareLocalClockTimes('23:59', '00:01')).toBeGreaterThan(0);
  });

  it('hasTimezoneChanged detects changes', () => {
    const current = DayStructureTimeAdapter.getCurrentTimezone();
    expect(DayStructureTimeAdapter.hasTimezoneChanged(current)).toBe(false);
    expect(DayStructureTimeAdapter.hasTimezoneChanged('Fake/Timezone')).toBe(true);
  });

  it('resolveNextOccurrence returns a future Date', () => {
    const result = DayStructureTimeAdapter.resolveNextOccurrence('monday', '07:00');
    expect(result instanceof Date).toBe(true);
    expect(result.getTime()).toBeGreaterThan(0);
  });

  it('getTimezoneOffsetMinutes returns a number', () => {
    const offset = DayStructureTimeAdapter.getTimezoneOffsetMinutes();
    expect(typeof offset).toBe('number');
  });
});
