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
      expect(result.intervention).toContain('vertragen');
      expect(result.gptInstruction).toBeTruthy();
      expect(result.requiresRegulationTone).toBe(true);
    });

    it('ORANGE zone → regulate', () => {
      const result = applyRegulation('ORANGE', 'normal');
      expect(result.action).toBe('regulate');
      expect(result.intervention).toContain('Blijf even hier');
      expect(result.gptInstruction).toContain('oranje zone');
    });

    it('RED zone → stabilize', () => {
      const result = applyRegulation('RED', 'normal');
      expect(result.action).toBe('stabilize');
      expect(result.intervention).toContain('niets te begrijpen');
      expect(result.gptInstruction).toContain('rode zone');
    });

    it('PURPLE zone → ground', () => {
      const result = applyRegulation('PURPLE', 'normal');
      expect(result.action).toBe('ground');
      expect(result.intervention).toContain('3 dingen');
      expect(result.gptInstruction).toContain('paarse zone');
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
    it('light depth adds "geen uitleg, geen reflectie"', () => {
      const result = applyRegulation('RED', 'deep'); // forced to light
      expect(result.gptInstruction).toContain('Geen uitleg, geen reflectie');
    });

    it('normal depth adds "kort reflecteren"', () => {
      const result = applyRegulation('ORANGE', 'normal');
      expect(result.gptInstruction).toContain('kort reflecteren');
    });

    it('deep depth on yellow allows doorvragen', () => {
      const result = applyRegulation('YELLOW', 'deep');
      expect(result.gptInstruction).toContain('doorvragen');
    });
  });

  // ─── Anti-Repetition Safeguard ──────────────────────────────

  describe('anti-repetition safeguard', () => {
    it('no previous message → normal intervention', () => {
      const result = applyRegulation('ORANGE', 'normal', null);
      expect(result.wasSoftened).toBe(false);
      expect(result.wasSkipped).toBe(false);
      expect(result.intervention).toContain('Blijf even hier');
    });

    it('previous message WITHOUT regulation → normal intervention', () => {
      const result = applyRegulation('ORANGE', 'normal', 'Ik begrijp dat het moeilijk is. Vertel me meer.');
      expect(result.wasSoftened).toBe(false);
      expect(result.wasSkipped).toBe(false);
      expect(result.intervention).toContain('Blijf even hier');
    });

    it('previous message WITH regulation + YELLOW zone → SKIP intervention', () => {
      const prevMsg = 'Even vertragen. Wat voel je nu precies? Ik ben hier voor je.';
      const result = applyRegulation('YELLOW', 'normal', prevMsg);
      expect(result.wasSkipped).toBe(true);
      expect(result.wasSoftened).toBe(false);
      expect(result.intervention).toBeNull(); // skipped = no intervention text
      expect(result.gptInstruction).toBeTruthy(); // still gets softened instruction
      expect(result.gptInstruction).toContain('vervolg');
    });

    it('previous message WITH regulation + ORANGE zone → SOFTEN intervention', () => {
      const prevMsg = 'Blijf even hier. Adem rustig in en uit.';
      const result = applyRegulation('ORANGE', 'normal', prevMsg);
      expect(result.wasSoftened).toBe(true);
      expect(result.wasSkipped).toBe(false);
      expect(result.intervention).toBeTruthy();
      expect(result.intervention).not.toContain('Blijf even hier'); // not the original
      expect(result.intervention).toContain('Goed zo'); // softened variant
    });

    it('previous message WITH regulation + RED zone → SOFTEN intervention', () => {
      const prevMsg = 'Je hoeft nu niets te begrijpen. Gewoon even hier blijven.';
      const result = applyRegulation('RED', 'normal', prevMsg);
      expect(result.wasSoftened).toBe(true);
      expect(result.wasSkipped).toBe(false);
      expect(result.intervention).toContain('nergens heen'); // softened variant
    });

    it('previous message WITH regulation + PURPLE zone → SOFTEN intervention', () => {
      const prevMsg = 'Kijk even rond. Noem 3 dingen die je ziet.';
      const result = applyRegulation('PURPLE', 'normal', prevMsg);
      expect(result.wasSoftened).toBe(true);
      expect(result.intervention).toContain('hier. Dat is genoeg'); // softened variant
    });

    it('previous message WITH regulation + GREEN zone → no intervention (reflect)', () => {
      const prevMsg = 'Adem rustig in en uit. Je bent veilig.';
      const result = applyRegulation('GREEN', 'normal', prevMsg);
      expect(result.action).toBe('reflect');
      expect(result.intervention).toBeNull();
      expect(result.wasSoftened).toBe(false);
      expect(result.wasSkipped).toBe(false);
    });

    it('softened GPT instructions contain "vervolg" label', () => {
      const prevMsg = 'Adem rustig in en uit. Blijf even hier.';
      const result = applyRegulation('ORANGE', 'normal', prevMsg);
      expect(result.gptInstruction).toContain('vervolg');
      expect(result.gptInstruction).toContain('Herhaal');
    });

    it('detects GPT-generated regulation phrases (not just exact micro-interventions)', () => {
      // GPT might generate its own regulation phrasing
      const prevMsg = 'Ik ben er voor je. Adem in... en adem uit. Je bent veilig hier.';
      const result = applyRegulation('ORANGE', 'normal', prevMsg);
      expect(result.wasSoftened).toBe(true); // should detect 'adem in' and 'je bent veilig'
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
