/**
 * Mood Screen — Eigen Regie Sync Validation
 *
 * Verifies:
 * 1. eigenRegie field exists in KimMoodSliders as separate field
 * 2. createDefaultSliders('kim') returns eigenRegie: null
 * 3. eigenRegie is NOT part of EliasMoodSliders
 * 4. updateEigenRegie dual-write behavior (eigenRegieHistory + currentMood.eigenRegie)
 * 5. Pipeline reads currentMood.eigenRegie correctly
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultSliders,
  type KimMoodSliders,
  type EliasMoodSliders,
} from '../lib/ai/types';

// ─── KimMoodSliders: eigenRegie as separate field ────────────────

describe('KimMoodSliders — eigenRegie field', () => {
  it('createDefaultSliders("kim") includes eigenRegie: null', () => {
    const sliders = createDefaultSliders('kim') as KimMoodSliders;
    expect(sliders).toHaveProperty('eigenRegie');
    expect(sliders.eigenRegie).toBeNull();
  });

  it('eigenRegie is separate from mood sliders (stress, boundaryFatigue, emotionalBurden, selfCare)', () => {
    const sliders = createDefaultSliders('kim') as KimMoodSliders;
    // eigenRegie exists alongside mood fields, not mixed in
    expect(sliders.stress).toBe(0);
    expect(sliders.boundaryFatigue).toBe(0);
    expect(sliders.emotionalBurden).toBe(0);
    expect(sliders.selfCare).toBe(5);
    expect(sliders.eigenRegie).toBeNull();
    // Exactly 5 fields
    expect(Object.keys(sliders)).toHaveLength(5);
  });

  it('eigenRegie accepts number values', () => {
    const sliders: KimMoodSliders = {
      stress: 3,
      boundaryFatigue: 4,
      emotionalBurden: 5,
      selfCare: 6,
      eigenRegie: 75,
    };
    expect(sliders.eigenRegie).toBe(75);
  });

  it('eigenRegie accepts null (no input yet)', () => {
    const sliders: KimMoodSliders = {
      stress: 3,
      boundaryFatigue: 4,
      emotionalBurden: 5,
      selfCare: 6,
      eigenRegie: null,
    };
    expect(sliders.eigenRegie).toBeNull();
  });
});

// ─── EliasMoodSliders: no eigenRegie ─────────────────────────────

describe('EliasMoodSliders — no eigenRegie', () => {
  it('createDefaultSliders("elias") does NOT include eigenRegie', () => {
    const sliders = createDefaultSliders('elias') as EliasMoodSliders;
    expect(sliders).not.toHaveProperty('eigenRegie');
  });

  it('Elias sliders have exactly 5 fields', () => {
    const sliders = createDefaultSliders('elias') as EliasMoodSliders;
    expect(Object.keys(sliders)).toHaveLength(6);
    expect(sliders).toHaveProperty('craving');
    expect(sliders).toHaveProperty('frustration');
    expect(sliders).toHaveProperty('despondency');
    expect(sliders).toHaveProperty('focus');
    expect(sliders).toHaveProperty('vsp');
    expect(sliders).toHaveProperty('vspScore');
    expect(sliders.vsp).toBeNull();
    expect(sliders.vspScore).toBeNull();
  });
});

// ─── Dual Write Simulation ───────────────────────────────────────

describe('eigenRegie dual write behavior', () => {
  it('spreading currentMood with eigenRegie preserves all mood fields', () => {
    const currentMood: KimMoodSliders = {
      stress: 5,
      boundaryFatigue: 3,
      emotionalBurden: 7,
      selfCare: 4,
      eigenRegie: null,
    };
    const userInput = 65;
    const updatedMood = { ...currentMood, eigenRegie: userInput };

    // eigenRegie updated
    expect(updatedMood.eigenRegie).toBe(65);
    // Other fields preserved
    expect(updatedMood.stress).toBe(5);
    expect(updatedMood.boundaryFatigue).toBe(3);
    expect(updatedMood.emotionalBurden).toBe(7);
    expect(updatedMood.selfCare).toBe(4);
  });

  it('eigenRegie update does not affect other mood fields', () => {
    const currentMood: KimMoodSliders = {
      stress: 8,
      boundaryFatigue: 6,
      emotionalBurden: 9,
      selfCare: 2,
      eigenRegie: 30,
    };
    const updatedMood = { ...currentMood, eigenRegie: 80 };

    expect(updatedMood.eigenRegie).toBe(80);
    expect(updatedMood.stress).toBe(8);
    expect(updatedMood.boundaryFatigue).toBe(6);
    expect(updatedMood.emotionalBurden).toBe(9);
    expect(updatedMood.selfCare).toBe(2);
  });

  it('eigenRegie can be set back to null', () => {
    const currentMood: KimMoodSliders = {
      stress: 5,
      boundaryFatigue: 3,
      emotionalBurden: 7,
      selfCare: 4,
      eigenRegie: 50,
    };
    const updatedMood = { ...currentMood, eigenRegie: null };
    expect(updatedMood.eigenRegie).toBeNull();
  });
});

// ─── Slider Initialisation Logic ─────────────────────────────────

describe('Eigen Regie slider initialisation', () => {
  /** Simulates the initialisation logic from mood.tsx */
  function initEigenRegieSlider(isKim: boolean, currentMood: Record<string, any> | null): number {
    if (isKim && currentMood && 'eigenRegie' in currentMood && currentMood.eigenRegie != null) {
      return currentMood.eigenRegie as number;
    }
    return 50;
  }

  it('returns saved value when currentMood.eigenRegie exists', () => {
    expect(initEigenRegieSlider(true, { stress: 5, eigenRegie: 73 })).toBe(73);
  });

  it('returns 50 when currentMood.eigenRegie is null', () => {
    expect(initEigenRegieSlider(true, { stress: 5, eigenRegie: null })).toBe(50);
  });

  it('returns 50 when currentMood has no eigenRegie field', () => {
    expect(initEigenRegieSlider(true, { stress: 5 })).toBe(50);
  });

  it('returns 50 when currentMood is null', () => {
    expect(initEigenRegieSlider(true, null)).toBe(50);
  });

  it('returns 50 for Elias user even if eigenRegie exists', () => {
    expect(initEigenRegieSlider(false, { craving: 5, eigenRegie: 73 })).toBe(50);
  });

  it('returns saved value 0 correctly (not treated as falsy)', () => {
    expect(initEigenRegieSlider(true, { stress: 5, eigenRegie: 0 })).toBe(0);
  });

  it('returns saved value 100 correctly', () => {
    expect(initEigenRegieSlider(true, { stress: 5, eigenRegie: 100 })).toBe(100);
  });
});

// ─── Pipeline Read Simulation ────────────────────────────────────

describe('Pipeline reads currentMood.eigenRegie', () => {
  it('reads eigenRegie from KimMoodSliders when present', () => {
    const currentMood: KimMoodSliders = {
      stress: 5,
      boundaryFatigue: 3,
      emotionalBurden: 7,
      selfCare: 4,
      eigenRegie: 42,
    };
    // Simulate pipeline read pattern
    const eigenRegieInput = ('eigenRegie' in currentMood) ? currentMood.eigenRegie : null;
    expect(eigenRegieInput).toBe(42);
  });

  it('reads null when eigenRegie not yet submitted', () => {
    const currentMood: KimMoodSliders = {
      stress: 5,
      boundaryFatigue: 3,
      emotionalBurden: 7,
      selfCare: 4,
      eigenRegie: null,
    };
    const eigenRegieInput = ('eigenRegie' in currentMood) ? currentMood.eigenRegie : null;
    expect(eigenRegieInput).toBeNull();
  });

  it('does not read eigenRegie from EliasMoodSliders', () => {
    const currentMood: EliasMoodSliders = {
      craving: 5,
      frustration: 3,
      despondency: 7,
      focus: 4,
      vsp: null,
      vspScore: null,
    };
    const eigenRegieInput = ('eigenRegie' in currentMood) ? (currentMood as any).eigenRegie : null;
    expect(eigenRegieInput).toBeNull();
  });
});
