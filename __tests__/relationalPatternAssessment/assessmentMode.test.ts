import { describe, it, expect } from 'vitest';
import {
  detectAssessmentRequest,
  detectAssessmentSignals,
  buildAssessmentDirective,
} from '../../lib/engine/kim/relational-pattern-assessment';

describe('RELATIONAL_PATTERN_ASSESSMENT_MODE', () => {
  describe('detectAssessmentRequest', () => {
    it('T1: detects "wat vind je van mijn relatie?"', () => {
      expect(detectAssessmentRequest('wat vind je van mijn relatie?')).toBe(true);
    });
    it('T2: detects "is deze relatie gezond?"', () => {
      expect(detectAssessmentRequest('is deze relatie nog gezond?')).toBe(true);
    });
    it('T3: detects "is dit nog gelijkwaardig"', () => {
      expect(detectAssessmentRequest('is dit nog gelijkwaardig')).toBe(true);
    });
    it('T4: detects "what do you think of my relationship"', () => {
      expect(detectAssessmentRequest('what do you think about my relationship?')).toBe(true);
    });
    it('T5: detects "op basis van alles wat je weet"', () => {
      expect(detectAssessmentRequest('op basis van alles wat je weet, wat denk je?')).toBe(true);
    });
    it('T6: detects "ben ik te hard?"', () => {
      expect(detectAssessmentRequest('ben ik te hard?')).toBe(true);
    });
    it('T7: does NOT detect normal message', () => {
      expect(detectAssessmentRequest('ik voel me moe vandaag')).toBe(false);
    });
    it('T8: does NOT detect boundary statement', () => {
      expect(detectAssessmentRequest('ik wil een grens stellen')).toBe(false);
    });
  });

  describe('detectAssessmentSignals', () => {
    it('T9: detects trust damage from "bedrogen"', () => {
      const result = detectAssessmentSignals('hij heeft me weer bedrogen');
      expect(result.trustDamageSignals).toBe(true);
    });
    it('T10: detects role confusion from "ik moet alles regelen"', () => {
      const result = detectAssessmentSignals('ik moet alles regelen in huis');
      expect(result.roleConfusionSignals).toBe(true);
    });
    it('T11: detects boundary fatigue', () => {
      const result = detectAssessmentSignals('ik ben moe van grenzen stellen, hoeveel keer nog');
      expect(result.boundaryFatigueSignals).toBe(true);
    });
    it('T12: detects recovery responsibility', () => {
      const result = detectAssessmentSignals('zonder mij lukt het niet voor hem');
      expect(result.recoveryResponsibilitySignals).toBe(true);
    });
  });

  describe('buildAssessmentDirective', () => {
    const baseInput = {
      currentUserMessage: 'wat vind je van mijn relatie?',
      safetyLevel: 'none' as const,
      relationalHarmPatternActive: false,
      trustDamageSignals: false,
      roleConfusionSignals: false,
      boundaryFatigueSignals: false,
      recoveryResponsibilitySignals: false,
      hasBackpackData: true,
      hasRelationalHistory: true,
    };

    it('T13: full assessment includes 6 steps', () => {
      const result = buildAssessmentDirective(baseInput);
      expect(result.isActive).toBe(true);
      expect(result.gptDirective).toContain('STEP 1');
      expect(result.gptDirective).toContain('STEP 2');
      expect(result.gptDirective).toContain('STEP 3');
      expect(result.gptDirective).toContain('STEP 4');
      expect(result.gptDirective).toContain('STEP 5');
      expect(result.gptDirective).toContain('STEP 6');
    });

    it('T14: full assessment includes required formulations', () => {
      const result = buildAssessmentDirective(baseInput);
      expect(result.gptDirective).toContain('Op basis van wat je beschrijft');
      expect(result.gptDirective).toContain('Jij bent niet verantwoordelijk voor het herstel van de ander');
      expect(result.gptDirective).toContain('Herstel vraagt zichtbaar gedrag over tijd');
    });

    it('T15: full assessment includes forbidden list', () => {
      const result = buildAssessmentDirective(baseInput);
      expect(result.gptDirective).toContain('je moet weg');
      expect(result.gptDirective).toContain('je moet blijven');
      expect(result.gptDirective).toContain('dit is toxisch');
    });

    it('T16: safety override blocks full assessment', () => {
      const result = buildAssessmentDirective({ ...baseInput, safetyLevel: 'crisis' });
      expect(result.isActive).toBe(true);
      expect(result.gptDirective).toContain('SAFETY OVERRIDE');
      expect(result.gptDirective).not.toContain('STEP 1');
    });

    it('T17: insufficient data gives honest limitation', () => {
      const result = buildAssessmentDirective({ ...baseInput, hasBackpackData: false, hasRelationalHistory: false });
      expect(result.isActive).toBe(true);
      expect(result.gptDirective).toContain('INSUFFICIENT DATA');
      expect(result.gptDirective).toContain('Ik kan dit niet stevig beoordelen');
    });

    it('T18: RELATIONAL_HARM_PATTERN blocks early perspective', () => {
      const result = buildAssessmentDirective({ ...baseInput, relationalHarmPatternActive: true });
      expect(result.gptDirective).toContain('RELATIONAL_HARM_PATTERN IS ACTIVE');
      expect(result.gptDirective).toContain('Do NOT open perspective early');
      expect(result.gptDirective).toContain('FIRST name the damage');
    });

    it('T19: trust damage signal included in context', () => {
      const result = buildAssessmentDirective({ ...baseInput, trustDamageSignals: true });
      expect(result.gptDirective).toContain('TRUST DAMAGE detected');
    });

    it('T20: role confusion signal included in context', () => {
      const result = buildAssessmentDirective({ ...baseInput, roleConfusionSignals: true });
      expect(result.gptDirective).toContain('ROLE CONFUSION detected');
    });

    it('T21: no relationship decision allowed', () => {
      const result = buildAssessmentDirective(baseInput);
      expect(result.gptDirective).toContain('Do NOT advise leaving or staying');
    });

    it('T22: no fixed person names', () => {
      const result = buildAssessmentDirective(baseInput);
      expect(result.gptDirective).toContain('Do NOT use fixed person names');
    });

    it('T23: no diagnosis', () => {
      const result = buildAssessmentDirective(baseInput);
      expect(result.gptDirective).toContain('Do NOT diagnose');
    });

    it('T24: K05 override remains active', () => {
      const result = buildAssessmentDirective(baseInput);
      expect(result.gptDirective).toContain('K05 override remains active');
    });
  });
});
