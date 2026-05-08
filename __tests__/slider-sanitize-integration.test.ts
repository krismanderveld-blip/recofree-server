/**
 * Integration test: slider sanitization in moodHistory
 *
 * Verifies that after session-end → restore → next session,
 * moodHistory.sliders contains only numeric keys.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeSliders } from '../lib/engine/shared/slider-sanitize';

describe('sanitizeSliders', () => {
  it('removes non-numeric values from slider objects', () => {
    const input = {
      craving: 6,
      frustration: 4,
      despondency: 7,
      focus: 3,
      vsp: 'GEEL',
    };
    const result = sanitizeSliders(input);
    expect(result).toEqual({
      craving: 6,
      frustration: 4,
      despondency: 7,
      focus: 3,
    });
    expect('vsp' in result).toBe(false);
  });

  it('removes null values', () => {
    const input = {
      craving: 5,
      frustration: 3,
      vsp: null,
    };
    const result = sanitizeSliders(input as any);
    expect(result).toEqual({
      craving: 5,
      frustration: 3,
    });
  });

  it('handles Kim sliders with eigenRegie as number (keeps it)', () => {
    const input = {
      stress: 4,
      boundaryFatigue: 6,
      emotionalBurden: 5,
      selfCare: 7,
      eigenRegie: 65,
    };
    const result = sanitizeSliders(input);
    expect(result).toEqual(input); // all numeric, nothing removed
  });

  it('handles Kim sliders with eigenRegie as null (removes it)', () => {
    const input = {
      stress: 4,
      boundaryFatigue: 6,
      emotionalBurden: 5,
      selfCare: 7,
      eigenRegie: null,
    };
    const result = sanitizeSliders(input as any);
    expect(result).toEqual({
      stress: 4,
      boundaryFatigue: 6,
      emotionalBurden: 5,
      selfCare: 7,
    });
  });

  it('returns empty object for all-string input', () => {
    const input = { vsp: 'ROOD', status: 'active' };
    const result = sanitizeSliders(input);
    expect(result).toEqual({});
  });

  it('returns same object for all-numeric input', () => {
    const input = { craving: 8, frustration: 2, despondency: 5, focus: 6 };
    const result = sanitizeSliders(input);
    expect(result).toEqual(input);
  });
});

describe('moodHistory migration simulation', () => {
  it('sanitizes polluted moodHistory entries (simulates app load migration)', () => {
    const pollutedHistory = [
      { sliders: { craving: 4, frustration: 3, despondency: 5, focus: 4, vsp: 'GROEN' }, timestamp: '2026-03-20T10:00:00Z' },
      { sliders: { craving: 7, frustration: 6, despondency: 8, focus: 2, vsp: 'GEEL' }, timestamp: '2026-04-01T14:30:00Z' },
      { sliders: { craving: 5, frustration: 4, despondency: 6, focus: 3 }, timestamp: '2026-04-10T09:00:00Z' },
    ];

    const cleanHistory = pollutedHistory.map((entry) => ({
      ...entry,
      sliders: sanitizeSliders(entry.sliders),
    }));

    // First two entries should have vsp removed
    expect('vsp' in cleanHistory[0].sliders).toBe(false);
    expect('vsp' in cleanHistory[1].sliders).toBe(false);
    // Third entry was already clean
    expect(cleanHistory[2].sliders).toEqual({ craving: 5, frustration: 4, despondency: 6, focus: 3 });

    // All entries should only have numeric values
    cleanHistory.forEach((entry) => {
      Object.values(entry.sliders).forEach((v) => {
        expect(typeof v).toBe('number');
      });
    });
  });

  it('is idempotent — running sanitize on already-clean data changes nothing', () => {
    const cleanHistory = [
      { sliders: { craving: 4, frustration: 3, despondency: 5, focus: 4 }, timestamp: '2026-03-20T10:00:00Z' },
    ];

    const result = cleanHistory.map((entry) => ({
      ...entry,
      sliders: sanitizeSliders(entry.sliders),
    }));

    expect(result).toEqual(cleanHistory);
  });
});
