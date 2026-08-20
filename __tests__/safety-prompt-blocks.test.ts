/**
 * P1 SAFETY PROMPT BLOCK TESTS
 * 
 * Tests that safety-critical prompt blocks are:
 * 1. Always present when needed
 * 2. Contain correct content (no forbidden language)
 * 3. Persona-separated correctly
 */
import { describe, it, expect } from 'vitest';
import { ELIAS_IDENTITY_PROMPT, eliasCrisisInstructions } from '@/lib/engine/elias/prompt-block';
import { KIM_IDENTITY_PROMPT, kimCrisisInstructions } from '@/lib/engine/kim/prompt-block';
import { getCrisisNumbersForPrompt } from '@/lib/engine/crisis-prompt-helper';
import { CONTEXT_AWARE_APPLICATION_CONTRACT } from '@/lib/engine/shared/context-application-contract';
import { buildClientSystemPrompt } from '@/lib/ai/prompt/client-system-prompt-builder';

describe('Safety Prompt Blocks', () => {
  // ═══ CRISIS NUMBERS ═══
  describe('Crisis Numbers', () => {
    it('getCrisisNumbersForPrompt returns Belgian numbers by default', () => {
      const result = getCrisisNumbersForPrompt();
      expect(result.footerLine).toContain('1813');
      expect(result.numbersList).toBeTruthy();
    });

    it('getCrisisNumbersForPrompt returns Belgian numbers for BE', () => {
      const result = getCrisisNumbersForPrompt('BE', 'nl');
      expect(result.footerLine).toContain('1813');
      expect(result.footerLine).toContain('112');
    });

    it('getCrisisNumbersForPrompt returns NL numbers for NL', () => {
      const result = getCrisisNumbersForPrompt('NL', 'nl');
      expect(result.footerLine).toContain('113');
      expect(result.footerLine).toContain('112');
    });

    it('getCrisisNumbersForPrompt returns English text for en locale', () => {
      const result = getCrisisNumbersForPrompt('BE', 'en');
      expect(result.footerLine).toContain('call');
    });

    it('getCrisisNumbersForPrompt returns French text for fr locale', () => {
      const result = getCrisisNumbersForPrompt('BE', 'fr');
      expect(result.footerLine).toContain('appeler');
    });
  });

  // ═══ ELIAS CRISIS INSTRUCTIONS ═══
  describe('Elias Crisis Instructions', () => {
    it('contains presence-first protocol at crisisLevel 2', () => {
      const result = eliasCrisisInstructions(2);
      expect(result).toContain('CRISIS ACTIVE');
      expect(result).toContain('PRESENCE');
      expect(result).toContain('SAFETY');
      expect(result).toContain('1813');
      expect(result).toContain('112');
    });

    it('contains presence-first protocol at crisisLevel 3', () => {
      const result = eliasCrisisInstructions(3);
      expect(result).toContain('CRISIS ACTIVE');
      expect(result).toContain('1813');
    });

    it('contains mandatory crisis footer instruction', () => {
      const result = eliasCrisisInstructions(2);
      expect(result).toContain('MANDATORY CRISIS FOOTER');
    });

    it('never skip presence rule', () => {
      const result = eliasCrisisInstructions(2);
      expect(result).toContain('NEVER skip presence');
    });
  });

  // ═══ KIM CRISIS INSTRUCTIONS ═══
  describe('Kim Crisis Instructions', () => {
    it('contains crisis protocol at crisisLevel 2', () => {
      const result = kimCrisisInstructions(2);
      expect(result).toContain('CRISIS');
      expect(result).toContain('1813');
      expect(result).toContain('112');
    });

    it('contains presence-first protocol', () => {
      const result = kimCrisisInstructions(2);
      expect(result).toContain('PRESENCE');
      expect(result).toContain('SAFETY');
    });
  });

  // ═══ ELIAS IDENTITY ═══
  describe('Elias Identity Prompt', () => {
    it('exists and is non-empty', () => {
      expect(ELIAS_IDENTITY_PROMPT).toBeTruthy();
      expect(ELIAS_IDENTITY_PROMPT.length).toBeGreaterThan(100);
    });

    it('contains correct persona name', () => {
      expect(ELIAS_IDENTITY_PROMPT).toContain('Elias');
    });

    it('contains recovery-focused language', () => {
      expect(ELIAS_IDENTITY_PROMPT).toContain('addiction');
    });

    it('does NOT contain diagnostic labels', () => {
      const forbidden = ['codependent', 'toxic', 'narcissist', 'borderline', 'bipolar'];
      for (const word of forbidden) {
        expect(ELIAS_IDENTITY_PROMPT.toLowerCase()).not.toContain(word);
      }
    });

    it('does NOT contain fixed person names', () => {
      const forbidden = ['Melissa', 'Jules', 'Kris', 'Marie'];
      for (const name of forbidden) {
        expect(ELIAS_IDENTITY_PROMPT).not.toContain(name);
      }
    });

    it('contains warmth rule', () => {
      expect(ELIAS_IDENTITY_PROMPT).toContain('WARMTH RULE');
    });

    it('contains first response rule', () => {
      expect(ELIAS_IDENTITY_PROMPT).toContain('FIRST RESPONSE RULE');
    });

    it('contains crisis section', () => {
      expect(ELIAS_IDENTITY_PROMPT).toContain('CRISIS');
    });
  });

  // ═══ KIM IDENTITY ═══
  describe('Kim Identity Prompt', () => {
    it('exists and is non-empty', () => {
      expect(KIM_IDENTITY_PROMPT).toBeTruthy();
      expect(KIM_IDENTITY_PROMPT.length).toBeGreaterThan(100);
    });

    it('contains correct persona name', () => {
      expect(KIM_IDENTITY_PROMPT).toContain('Kim');
    });

    it('is a relational therapist, not grenzenvriendin', () => {
      expect(KIM_IDENTITY_PROMPT.toLowerCase()).not.toContain('grenzenvriendin');
    });

    it('does NOT take sides against the person with addiction', () => {
      expect(KIM_IDENTITY_PROMPT).toContain('without turning them against');
    });

    it('does NOT contain diagnostic labels', () => {
      // Note: 'toxic' is excluded because 'intoxication' contains it legitimately
      const forbidden = ['codependent', 'narcissist', 'borderline', 'bipolar'];
      for (const word of forbidden) {
        expect(KIM_IDENTITY_PROMPT.toLowerCase()).not.toContain(word);
      }
      // Check 'toxic' as standalone word (not part of 'intoxication')
      const toxicMatches = KIM_IDENTITY_PROMPT.toLowerCase().match(/\btoxic\b/g);
      expect(toxicMatches).toBeNull();
    });

    it('does NOT contain fixed person names', () => {
      const forbidden = ['Melissa', 'Jules', 'Kris', 'Marie'];
      for (const name of forbidden) {
        expect(KIM_IDENTITY_PROMPT).not.toContain(name);
      }
    });

    it('contains core stance about relationship as system', () => {
      expect(KIM_IDENTITY_PROMPT).toContain('CORE STANCE');
    });

    it('validates caregiver pain without condemning the other', () => {
      expect(KIM_IDENTITY_PROMPT).toContain('validates the experience');
    });

    it('contains first response rule', () => {
      expect(KIM_IDENTITY_PROMPT).toContain('FIRST RESPONSE RULE');
    });
  });

  // ═══ CONTEXT APPLICATION CONTRACT ═══
  describe('Context Application Contract', () => {
    it('exists and is non-empty', () => {
      expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toBeTruthy();
      expect(CONTEXT_AWARE_APPLICATION_CONTRACT.length).toBeGreaterThan(100);
    });

    it('contains MANDATORY header', () => {
      expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('MANDATORY');
    });

    it('contains deceased safety rule', () => {
      expect(CONTEXT_AWARE_APPLICATION_CONTRACT.toLowerCase()).toContain('deceased');
    });

    it('does NOT contain fixed person names', () => {
      const forbidden = ['Melissa', 'Jules', 'Kris', 'Marie'];
      for (const name of forbidden) {
        expect(CONTEXT_AWARE_APPLICATION_CONTRACT).not.toContain(name);
      }
    });
  });

  // ═══ CLIENT PROMPT BUILDER CRISIS INJECTION ═══
  describe('Client Prompt Builder Crisis Injection', () => {
    it('injects Elias crisis instructions at crisisLevel 2', () => {
      
      const result = buildClientSystemPrompt({
        persona: 'elias',
        crisisLevel: 2,
        safetyLevel: 'crisis',
      });
      expect(result.systemPrompt).toContain('CRISIS ACTIVE');
      expect(result.systemPrompt).toContain('1813');
      expect(result.systemPrompt).toContain('112');
      expect(result.debug?.includedSections).toContain('crisisInstructions');
    });

    it('injects Kim crisis instructions at crisisLevel 2', () => {
      
      const result = buildClientSystemPrompt({
        persona: 'kim',
        crisisLevel: 2,
        safetyLevel: 'crisis',
      });
      expect(result.systemPrompt).toContain('CRISIS');
      expect(result.systemPrompt).toContain('1813');
      expect(result.systemPrompt).toContain('112');
      expect(result.debug?.includedSections).toContain('crisisInstructions');
    });

    it('injects vigilance at crisisLevel 1', () => {
      
      const result = buildClientSystemPrompt({
        persona: 'elias',
        crisisLevel: 1,
        safetyLevel: 'none',
      });
      expect(result.systemPrompt).toContain('HEIGHTENED VIGILANCE');
      expect(result.debug?.includedSections).toContain('crisisVigilance');
    });

    it('does NOT inject crisis at crisisLevel 0', () => {
      
      const result = buildClientSystemPrompt({
        persona: 'elias',
        crisisLevel: 0,
        safetyLevel: 'none',
      });
      expect(result.systemPrompt).not.toContain('CRISIS ACTIVE');
      expect(result.systemPrompt).not.toContain('HEIGHTENED VIGILANCE');
    });

    it('always includes contextApplicationContract regardless of projectionContext', () => {
      
      // Without projectionContext
      const result1 = buildClientSystemPrompt({
        persona: 'elias',
        crisisLevel: 0,
        safetyLevel: 'none',
      });
      expect(result1.debug?.includedSections).toContain('contextApplicationContract');
      expect(result1.systemPrompt).toContain('MANDATORY');

      // With projectionContext
      const result2 = buildClientSystemPrompt({
        persona: 'kim',
        crisisLevel: 0,
        safetyLevel: 'none',
        projectionContext: 'Some projection context',
      });
      expect(result2.debug?.includedSections).toContain('contextApplicationContract');
    });

    it('includes diary when ageCategory is absent', () => {
      
      const result = buildClientSystemPrompt({
        persona: 'elias',
        crisisLevel: 0,
        safetyLevel: 'none',
        diarySummary: 'Vandaag voelde ik me beter.',
      });
      expect(result.systemPrompt).toContain('RECENT DIARY CONTEXT');
      expect(result.systemPrompt).toContain('Vandaag voelde ik me beter.');
      expect(result.debug?.includedSections).toContain('diary');
    });

    it('includes diary when ageCategory is present', () => {
      
      const result = buildClientSystemPrompt({
        persona: 'elias',
        crisisLevel: 0,
        safetyLevel: 'none',
        ageCategory: 'adult',
        diarySummary: 'Vandaag voelde ik me beter.',
      });
      expect(result.systemPrompt).toContain('RECENT DIARY CONTEXT');
      expect(result.debug?.includedSections).toContain('diary');
      expect(result.debug?.includedSections).toContain('ageCategory');
    });
  });
});
