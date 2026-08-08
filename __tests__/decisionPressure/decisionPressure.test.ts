import { describe, it, expect } from 'vitest';
import { detectDecisionPressure, buildDecisionPressureDirective } from '../../lib/engine/kim/decision-pressure-layer';

describe('DECISION_PRESSURE_RESPONSE_LAYER', () => {
  describe('detectDecisionPressure', () => {
    it('T1: detects "moet ik blijven of weggaan?"', () => {
      expect(detectDecisionPressure('moet ik blijven of weggaan?').isActive).toBe(true);
    });
    it('T2: detects "is dit nog herstelbaar?"', () => {
      expect(detectDecisionPressure('is dit nog herstelbaar?').isActive).toBe(true);
    });
    it('T3: detects "moet ik afstand nemen?"', () => {
      expect(detectDecisionPressure('moet ik afstand nemen?').isActive).toBe(true);
    });
    it('T4: detects "should i stay or leave"', () => {
      expect(detectDecisionPressure('should i stay or leave?').isActive).toBe(true);
    });
    it('T5: does NOT detect normal message', () => {
      expect(detectDecisionPressure('ik voel me moe vandaag').isActive).toBe(false);
    });
    it('T6: detects child context from history', () => {
      const result = detectDecisionPressure('moet ik blijven?', ['mijn zoon vertrouwt hem niet meer']);
      expect(result.isActive).toBe(true);
      expect(result.hasChildContext).toBe(true);
    });
    it('T7: detects affection context', () => {
      const result = detectDecisionPressure('moet ik blijven? ik voel geen affectie meer');
      expect(result.isActive).toBe(true);
      expect(result.hasAffectionContext).toBe(true);
    });
    it('T8: detects shame context', () => {
      const result = detectDecisionPressure('moet ik weggaan? ik schaam me dat ik lieg');
      expect(result.isActive).toBe(true);
      expect(result.hasShameContext).toBe(true);
    });
  });

  describe('buildDecisionPressureDirective', () => {
    const baseInput = {
      safetyLevel: 'none' as const,
      relationalHarmPatternActive: false,
      hasChildContext: false,
      hasAffectionContext: false,
      hasShameContext: false,
    };

    it('T9: includes 6 steps', () => {
      const result = buildDecisionPressureDirective(baseInput);
      expect(result).toContain('STEP 1');
      expect(result).toContain('STEP 2');
      expect(result).toContain('STEP 3');
      expect(result).toContain('STEP 4');
      expect(result).toContain('STEP 5');
      expect(result).toContain('STEP 6');
    });
    it('T10: includes no-decision statement', () => {
      const result = buildDecisionPressureDirective(baseInput);
      expect(result).toContain('cannot and will not decide');
    });
    it('T11: includes recoverability conditions', () => {
      const result = buildDecisionPressureDirective(baseInput);
      expect(result).toContain('Langdurige nuchterheid');
      expect(result).toContain('Eerlijkheid');
      expect(result).toContain('Transparantie');
      expect(result).toContain('Initiatief vanuit de afhankelijke');
    });
    it('T12: includes forbidden list', () => {
      const result = buildDecisionPressureDirective(baseInput);
      expect(result).toContain('je moet weggaan');
      expect(result).toContain('je moet blijven');
      expect(result).toContain('wat zou je helpen?');
    });
    it('T13: safety override blocks full response', () => {
      const result = buildDecisionPressureDirective({ ...baseInput, safetyLevel: 'crisis' });
      expect(result).toContain('SAFETY OVERRIDE');
      expect(result).not.toContain('STEP 1');
    });
    it('T14: child context adds child-specific requirements', () => {
      const result = buildDecisionPressureDirective({ ...baseInput, hasChildContext: true });
      expect(result).toContain('CHILD CONTEXT ACTIVE');
      expect(result).toContain('Partnerherstel is niet automatisch kindherstel');
      expect(result).toContain('vertrouwen tussen het kind');
    });
    it('T15: affection context adds affection requirements', () => {
      const result = buildDecisionPressureDirective({ ...baseInput, hasAffectionContext: true });
      expect(result).toContain('AFFECTION/INTIMACY CONTEXT ACTIVE');
      expect(result).toContain('Affectie kan niet losgekoppeld worden van veiligheid');
    });
    it('T16: shame context adds shame requirements', () => {
      const result = buildDecisionPressureDirective({ ...baseInput, hasShameContext: true });
      expect(result).toContain('SHAME CONTEXT ACTIVE');
      expect(result).toContain('Verzacht de schaamte');
    });
    it('T17: RELATIONAL_HARM_PATTERN adds harm override', () => {
      const result = buildDecisionPressureDirective({ ...baseInput, relationalHarmPatternActive: true });
      expect(result).toContain('RELATIONAL_HARM_PATTERN IS ACTIVE');
      expect(result).toContain('Do NOT minimize harm');
    });
    it('T18: K05 override remains active', () => {
      const result = buildDecisionPressureDirective(baseInput);
      expect(result).toContain('K05 override remains active');
    });
    it('T19: no fixed person names', () => {
      const result = buildDecisionPressureDirective(baseInput);
      expect(result).toContain('Do NOT use fixed person names');
    });
    it('T20: maximum one question rule', () => {
      const result = buildDecisionPressureDirective(baseInput);
      expect(result).toContain('Maximum one question');
    });
  });
});
