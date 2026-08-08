import { describe, it, expect } from 'vitest';
import { detectDepthLevel, buildDepthAndNamingDirective } from '../../lib/engine/kim/depth-and-naming-layer';

describe('GLOBAL_KIM_DEPTH_AND_NAMING_LAYER', () => {
  describe('detectDepthLevel', () => {
    it('T1: HIGH for betrayal/bedrog', () => {
      expect(detectDepthLevel('hij heeft me weer bedrogen', 'none', false, true)).toBe('HIGH');
    });
    it('T2: HIGH for repeated pattern', () => {
      expect(detectDepthLevel('dit gebeurt telkens opnieuw', 'none', false, true)).toBe('HIGH');
    });
    it('T3: HIGH for child context', () => {
      expect(detectDepthLevel('mijn kinderen zien dit ook', 'none', false, true)).toBe('HIGH');
    });
    it('T4: MEDIUM for conflict', () => {
      expect(detectDepthLevel('we hadden weer ruzie gisteren', 'none', false, true)).toBe('MEDIUM');
    });
    it('T5: MEDIUM for boundary', () => {
      expect(detectDepthLevel('ik wil een grens stellen maar weet niet hoe', 'none', false, true)).toBe('MEDIUM');
    });
    it('T6: MEDIUM for partner mention', () => {
      expect(detectDepthLevel('hij doet alsof er niets aan de hand is', 'none', false, true)).toBe('MEDIUM');
    });
    it('T7: LOW for general emotional message', () => {
      expect(detectDepthLevel('ik voel me vandaag wat beter dan gisteren', 'none', false, true)).toBe('LOW');
    });
    it('T8: SKIP for crisis', () => {
      expect(detectDepthLevel('hij heeft me bedrogen', 'crisis', true, true)).toBe('SKIP');
    });
    it('T9: SKIP for very short message', () => {
      expect(detectDepthLevel('ok', 'none', false, true)).toBe('SKIP');
    });
    it('T10: SKIP for practical question', () => {
      expect(detectDepthLevel('hoe laat is het?', 'none', false, true)).toBe('SKIP');
    });
    it('T11: SKIP for Elias (not Kim)', () => {
      expect(detectDepthLevel('hij heeft me bedrogen', 'none', false, false)).toBe('SKIP');
    });
  });

  describe('buildDepthAndNamingDirective', () => {
    it('T12: SKIP returns empty', () => {
      expect(buildDepthAndNamingDirective('SKIP')).toBe('');
    });
    it('T13: LOW includes pattern + direction requirement', () => {
      const result = buildDepthAndNamingDirective('LOW');
      expect(result).toContain('DEPTH PROFILE: LOW');
      expect(result).toContain('ONE concrete pattern sentence');
      expect(result).toContain('ONE direction');
    });
    it('T14: MEDIUM includes responsibility correction', () => {
      const result = buildDepthAndNamingDirective('MEDIUM');
      expect(result).toContain('DEPTH PROFILE: MEDIUM');
      expect(result).toContain('Responsibility correction');
      expect(result).toContain('Recovery direction');
    });
    it('T15: HIGH includes evidence-bound reasoning', () => {
      const result = buildDepthAndNamingDirective('HIGH');
      expect(result).toContain('DEPTH PROFILE: HIGH');
      expect(result).toContain('Evidence-bound reasoning');
      expect(result).toContain('Repair conditions');
    });
    it('T16: all levels include forbidden weak outputs', () => {
      for (const level of ['LOW', 'MEDIUM', 'HIGH'] as const) {
        const result = buildDepthAndNamingDirective(level);
        expect(result).toContain('wat zou je helpen?');
        expect(result).toContain('wat heb je nodig?');
      }
    });
    it('T17: all levels include naming layers', () => {
      for (const level of ['LOW', 'MEDIUM', 'HIGH'] as const) {
        const result = buildDepthAndNamingDirective(level);
        expect(result).toContain('PATROON');
        expect(result).toContain('VERANTWOORDELIJKHEID');
        expect(result).toContain('VERBINDING');
      }
    });
    it('T18: all levels include style rules', () => {
      for (const level of ['LOW', 'MEDIUM', 'HIGH'] as const) {
        const result = buildDepthAndNamingDirective(level);
        expect(result).toContain('Warm, adult, concrete');
        expect(result).toContain('Sharp on patterns');
      }
    });
    it('T19: all levels include ending rule', () => {
      for (const level of ['LOW', 'MEDIUM', 'HIGH'] as const) {
        const result = buildDepthAndNamingDirective(level);
        expect(result).toContain('ENDING RULE');
        expect(result).toContain('Never end with weak questions');
      }
    });
  });
});
