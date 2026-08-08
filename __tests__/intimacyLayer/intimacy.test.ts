import { describe, it, expect } from 'vitest';
import { detectIntimacyAffectionQuestion, buildIntimacyAffectionDirective } from '../../lib/engine/kim/intimacy-affection-layer';

describe('INTIMACY_AFFECTION_EXPLANATION_LAYER', () => {
  describe('detectIntimacyAffectionQuestion', () => {
    it('T1: detects "ik voel geen affectie meer"', () => {
      expect(detectIntimacyAffectionQuestion('ik voel geen affectie meer')).toBe(true);
    });
    it('T2: detects "geen zin in seks"', () => {
      expect(detectIntimacyAffectionQuestion('ik heb geen zin in seks sinds het bedrog')).toBe(true);
    });
    it('T3: detects "zegt dat ik koud ben"', () => {
      expect(detectIntimacyAffectionQuestion('hij zegt dat ik koud ben')).toBe(true);
    });
    it('T4: detects "wil niet knuffelen"', () => {
      expect(detectIntimacyAffectionQuestion('ik wil niet knuffelen')).toBe(true);
    });
    it('T5: detects "samen in bad"', () => {
      expect(detectIntimacyAffectionQuestion('hij wil samen in bad maar ik wil niet')).toBe(true);
    });
    it('T6: detects English "i feel no affection"', () => {
      expect(detectIntimacyAffectionQuestion('i feel no affection anymore')).toBe(true);
    });
    it('T7: does NOT detect normal message', () => {
      expect(detectIntimacyAffectionQuestion('ik voel me moe vandaag')).toBe(false);
    });
  });

  describe('buildIntimacyAffectionDirective', () => {
    const baseInput = { safetyLevel: 'none' as const, relationalHarmPatternActive: false };

    it('T8: includes 6 steps', () => {
      const result = buildIntimacyAffectionDirective(baseInput);
      expect(result).toContain('STEP 1');
      expect(result).toContain('STEP 2');
      expect(result).toContain('STEP 3');
      expect(result).toContain('STEP 4');
      expect(result).toContain('STEP 5');
      expect(result).toContain('STEP 6');
    });
    it('T9: includes trust damage as inhibitor', () => {
      const result = buildIntimacyAffectionDirective(baseInput);
      expect(result).toContain('trust damage');
    });
    it('T10: includes partner dynamic shift', () => {
      const result = buildIntimacyAffectionDirective(baseInput);
      expect(result).toContain('partner-partner');
    });
    it('T11: includes forbidden list', () => {
      const result = buildIntimacyAffectionDirective(baseInput);
      expect(result).toContain('je moet jezelf openstellen');
      expect(result).toContain('seks hoort bij een relatie');
      expect(result).toContain('wat zou jou helpen?');
    });
    it('T12: includes required minimum 3 inhibitors', () => {
      const result = buildIntimacyAffectionDirective(baseInput);
      expect(result).toContain('at least THREE concrete inhibitors');
    });
    it('T13: safety override blocks response', () => {
      const result = buildIntimacyAffectionDirective({ ...baseInput, safetyLevel: 'crisis' });
      expect(result).toContain('SAFETY OVERRIDE');
      expect(result).not.toContain('STEP 1');
    });
    it('T14: RELATIONAL_HARM_PATTERN adds harm override', () => {
      const result = buildIntimacyAffectionDirective({ ...baseInput, relationalHarmPatternActive: true });
      expect(result).toContain('RELATIONAL_HARM_PATTERN IS ACTIVE');
      expect(result).toContain('Do NOT minimize harm');
    });
    it('T15: K05 override remains active', () => {
      const result = buildIntimacyAffectionDirective(baseInput);
      expect(result).toContain('K05 override remains active');
    });
    it('T16: no weak ending allowed', () => {
      const result = buildIntimacyAffectionDirective(baseInput);
      expect(result).toContain('Do NOT end with "wat zou je helpen?"');
    });
  });
});
