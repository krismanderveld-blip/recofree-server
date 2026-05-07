import { describe, it, expect } from 'vitest';
import {
  applyRegulation,
  requiresPreRegulation,
  type ZoneColor,
  type RegulationResult,
} from '../lib/rugzak/regulation-layer';

describe('regulation-layer', () => {
  // ─── Zone → Action Mapping ──────────────────────────────────

  describe('zone → action mapping', () => {
    it('GREEN zone → reflect (no intervention)', () => {
      const result = applyRegulation('GREEN', 'normal');
      expect(result.action).toBe('reflect');
      expect(result.intervention).toBeNull();
      expect(result.gptInstruction).toBeNull();
      expect(result.requiresRegulationTone).toBe(false);
      expect(result.wasSoftened).toBe(false);
      expect(result.wasSkipped).toBe(false);
    });

    it('YELLOW zone → slow_down', () => {
      const result = applyRegulation('YELLOW', 'normal');
      expect(result.action).toBe('slow_down');
      expect(result.intervention).toContain('slow down');
      expect(result.gptInstruction).toBeTruthy();
      expect(result.requiresRegulationTone).toBe(true);
    });

    it('ORANGE zone → regulate', () => {
      const result = applyRegulation('ORANGE', 'normal');
      expect(result.action).toBe('regulate');
      expect(result.intervention).toContain('Stay here for a moment');
      expect(result.gptInstruction).toContain('orange zone');
    });

    it('RED zone → stabilize', () => {
      const result = applyRegulation('RED', 'normal');
      expect(result.action).toBe('stabilize');
      expect(result.intervention).toContain('don\'t need to understand');
      expect(result.gptInstruction).toContain('red zone');
    });

    it('PURPLE zone → ground', () => {
      const result = applyRegulation('PURPLE', 'normal');
      expect(result.action).toBe('ground');
      expect(result.intervention).toContain('3 things');
      expect(result.gptInstruction).toContain('purple zone');
    });
  });

  // ─── Guidance Depth Integration ─────────────────────────────

  describe('guidance depth ceiling', () => {
    it('RED zone forces light depth regardless of user setting', () => {
      const result = applyRegulation('RED', 'deep');
      expect(result.effectiveDepth).toBe('light');
    });

    it('PURPLE zone forces light depth', () => {
      const result = applyRegulation('PURPLE', 'deep');
      expect(result.effectiveDepth).toBe('light');
    });

    it('ORANGE zone caps at normal depth', () => {
      const resultDeep = applyRegulation('ORANGE', 'deep');
      expect(resultDeep.effectiveDepth).toBe('normal');

      const resultNormal = applyRegulation('ORANGE', 'normal');
      expect(resultNormal.effectiveDepth).toBe('normal');

      const resultLight = applyRegulation('ORANGE', 'light');
      expect(resultLight.effectiveDepth).toBe('light');
    });

    it('GREEN zone allows user depth setting', () => {
      expect(applyRegulation('GREEN', 'deep').effectiveDepth).toBe('deep');
      expect(applyRegulation('GREEN', 'normal').effectiveDepth).toBe('normal');
      expect(applyRegulation('GREEN', 'light').effectiveDepth).toBe('light');
    });

    it('YELLOW zone allows user depth setting', () => {
      expect(applyRegulation('YELLOW', 'deep').effectiveDepth).toBe('deep');
      expect(applyRegulation('YELLOW', 'normal').effectiveDepth).toBe('normal');
    });
  });

  // ─── Depth-Adjusted Instructions ────────────────────────────

  describe('depth-adjusted GPT instructions', () => {
    it('light depth adds "No explanation, no reflection"', () => {
      const result = applyRegulation('RED', 'deep'); // forced to light
      expect(result.gptInstruction).toContain('No explanation, no reflection');
    });

    it('normal depth adds "briefly reflect"', () => {
      const result = applyRegulation('ORANGE', 'normal');
      expect(result.gptInstruction).toContain('briefly reflect');
    });

    it('deep depth on yellow allows probe further', () => {
      const result = applyRegulation('YELLOW', 'deep');
      expect(result.gptInstruction).toContain('probe further');
    });
  });

  // ─── Anti-Repetition Safeguard ──────────────────────────────

  describe('anti-repetition safeguard', () => {
    it('no previous message → normal intervention', () => {
      const result = applyRegulation('ORANGE', 'normal', null);
      expect(result.wasSoftened).toBe(false);
      expect(result.wasSkipped).toBe(false);
      expect(result.intervention).toContain('Stay here for a moment');
    });

    it('previous message WITHOUT regulation → normal intervention', () => {
      const result = applyRegulation('ORANGE', 'normal', 'I understand that it is difficult. Tell me more.');
      expect(result.wasSoftened).toBe(false);
      expect(result.wasSkipped).toBe(false);
      expect(result.intervention).toContain('Stay here for a moment');
    });

    it('previous message WITH regulation + YELLOW zone → SKIP intervention', () => {
      const prevMsg = 'Let\'s slow down. What do you feel right now? I\'m here for you.';
      const result = applyRegulation('YELLOW', 'normal', prevMsg);
      expect(result.wasSkipped).toBe(true);
      expect(result.wasSoftened).toBe(false);
      expect(result.intervention).toBeNull(); // skipped = no intervention text
      expect(result.gptInstruction).toBeTruthy(); // still gets softened instruction
      expect(result.gptInstruction).toContain('continuation');
    });

    it('previous message WITH regulation + ORANGE zone → SOFTEN intervention', () => {
      const prevMsg = 'Stay here for a moment. Breathe calmly in and out.';
      const result = applyRegulation('ORANGE', 'normal', prevMsg);
      expect(result.wasSoftened).toBe(true);
      expect(result.wasSkipped).toBe(false);
      expect(result.intervention).toBeTruthy();
      expect(result.intervention).not.toContain('Stay here for a moment'); // not the original
      expect(result.intervention).toContain('Good'); // softened variant
    });

    it('previous message WITH regulation + RED zone → SOFTEN intervention', () => {
      const prevMsg = 'You don\'t need to understand anything right now. Just stay here.';
      const result = applyRegulation('RED', 'normal', prevMsg);
      expect(result.wasSoftened).toBe(true);
      expect(result.wasSkipped).toBe(false);
      expect(result.intervention).toContain('not going anywhere'); // softened variant
    });

    it('previous message WITH regulation + PURPLE zone → SOFTEN intervention', () => {
      const prevMsg = 'Look around. Name 3 things you can see.';
      const result = applyRegulation('PURPLE', 'normal', prevMsg);
      expect(result.wasSoftened).toBe(true);
      expect(result.intervention).toContain('here. That'); // softened variant
    });

    it('previous message WITH regulation + GREEN zone → no intervention (reflect)', () => {
      const prevMsg = 'Breathe in and out slowly. You are safe.';
      const result = applyRegulation('GREEN', 'normal', prevMsg);
      expect(result.action).toBe('reflect');
      expect(result.intervention).toBeNull();
      expect(result.wasSoftened).toBe(false);
      expect(result.wasSkipped).toBe(false);
    });

    it('softened GPT instructions contain "continuation" label', () => {
      const prevMsg = 'Breathe in and out slowly. Stay here for a moment.';
      const result = applyRegulation('ORANGE', 'normal', prevMsg);
      expect(result.gptInstruction).toContain('continuation');
      expect(result.gptInstruction).toContain('NOT repeat');
    });

    it('detects GPT-generated regulation phrases (not just exact micro-interventions)', () => {
      // GPT might generate its own regulation phrasing
      const prevMsg = 'I\'m here for you. Breathe in... and breathe out. You are safe here.';
      const result = applyRegulation('ORANGE', 'normal', prevMsg);
      expect(result.wasSoftened).toBe(true); // should detect 'breathe in' and 'you are safe'
    });
  });

  // ─── requiresPreRegulation ──────────────────────────────────

  describe('requiresPreRegulation', () => {
    it('returns false for GREEN', () => {
      expect(requiresPreRegulation('GREEN')).toBe(false);
    });

    it('returns false for YELLOW', () => {
      expect(requiresPreRegulation('YELLOW')).toBe(false);
    });

    it('returns true for ORANGE', () => {
      expect(requiresPreRegulation('ORANGE')).toBe(true);
    });

    it('returns true for RED', () => {
      expect(requiresPreRegulation('RED')).toBe(true);
    });

    it('returns true for PURPLE', () => {
      expect(requiresPreRegulation('PURPLE')).toBe(true);
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty previous message', () => {
      const result = applyRegulation('ORANGE', 'normal', '');
      expect(result.wasSoftened).toBe(false);
      expect(result.wasSkipped).toBe(false);
    });

    it('handles undefined previous message', () => {
      const result = applyRegulation('RED', 'normal', undefined);
      expect(result.wasSoftened).toBe(false);
    });

    it('handles unknown zone gracefully', () => {
      const result = applyRegulation('UNKNOWN' as ZoneColor, 'normal');
      expect(result.action).toBe('reflect');
    });

    it('result always includes zone and effectiveDepth', () => {
      const zones: ZoneColor[] = ['GREEN', 'YELLOW', 'ORANGE', 'RED', 'PURPLE'];
      for (const zone of zones) {
        const result = applyRegulation(zone, 'normal');
        expect(result.zone).toBe(zone);
        expect(['light', 'normal', 'deep']).toContain(result.effectiveDepth);
      }
    });
  });
});
