/**
 * KIM RELATIONAL STANCE FILTER — Test Cases
 *
 * 5 scenarios demonstrating the filter's behavior:
 * 1. Naaste voelt zich onder druk gezet
 * 2. Naaste is boos op de persoon met verslaving
 * 3. Grens stellen zonder breuk
 * 4. Leugen of vertrouwensbreuk
 * 5. Safety-case waar verbinding wijkt voor veiligheid
 */
import { describe, it, expect } from 'vitest';
import {
  detectRelationalSignals,
  applyRelationalStanceFilter,
  type RelationalStanceFilterInput,
} from '../lib/engine/kim/relational-stance-filter';
import { KIM_IDENTITY_PROMPT } from '@/lib/engine/kim/prompt-block';

describe('Kim Relational Stance Filter', () => {
  // ─── Case 1: Naaste voelt zich onder druk gezet ────────────────────
  describe('Case 1: Naaste voelt zich onder druk gezet', () => {
    const userMessage = 'De ander zet mij onder druk met boze berichten en het is niet eerlijk.';

    it('detects relationship conflict and blame risk signals', () => {
      const signals = detectRelationalSignals(userMessage);
      expect(signals.relationshipConflictSignal).toBe(true);
      expect(signals.partnerJudgmentRisk).toBe(true);
      expect(signals.connectionOpportunity).toBe(true);
    });

    it('requires perspective shift and blocks blame language', () => {
      const signals = detectRelationalSignals(userMessage);
      const result = applyRelationalStanceFilter({
        selectedModule: 'KO1',
        safetyLevel: 'none',
        userDistress: 45,
        ...signals,
      });
      expect(result.requirePerspectiveShift).toBe(true);
      expect(result.blockBlameLanguage).toBe(true);
      expect(result.requireSafetyOverride).toBe(false);
      expect(result.gptDirective).toContain('PERSPECTIVE SHIFT REQUIRED');
      expect(result.gptDirective).toContain('BLAME LANGUAGE BLOCKED');
      expect(result.gptDirective).toContain('CONNECTION OPPORTUNITY');
    });

    it('directive instructs GPT to explore what the other person might feel', () => {
      const signals = detectRelationalSignals(userMessage);
      const result = applyRelationalStanceFilter({
        selectedModule: 'KO1',
        safetyLevel: 'none',
        userDistress: 45,
        ...signals,
      });
      expect(result.gptDirective).toContain('what the other person might be feeling');
      expect(result.gptDirective).not.toContain('chosen a side');
    });
  });

  // ─── Case 2: Naaste is boos op de persoon met verslaving ───────────
  describe('Case 2: Naaste is boos op de persoon met verslaving', () => {
    const userMessage = 'Ik ben zo kwaad op de ander. Alles is altijd zijn schuld en ik kan er niet meer tegen.';

    it('detects conflict and blame risk', () => {
      const signals = detectRelationalSignals(userMessage);
      expect(signals.relationshipConflictSignal).toBe(true);
      expect(signals.partnerJudgmentRisk).toBe(true);
    });

    it('blocks blame language and requires perspective shift', () => {
      const signals = detectRelationalSignals(userMessage);
      const result = applyRelationalStanceFilter({
        selectedModule: 'K01',
        safetyLevel: 'none',
        userDistress: 60,
        ...signals,
      });
      expect(result.blockBlameLanguage).toBe(true);
      expect(result.requirePerspectiveShift).toBe(true);
      expect(result.gptDirective).toContain('Do NOT say "the other person is putting pressure on you"');
      expect(result.gptDirective).toContain('name the PATTERN');
    });
  });

  // ─── Case 3: Grens stellen zonder breuk ────────────────────────────
  describe('Case 3: Grens stellen zonder breuk', () => {
    const userMessage = 'Ik wil een grens stellen want ik kan de ruzie niet meer aan, maar ik wil de relatie niet kapot maken.';

    it('detects boundary advice and connection opportunity', () => {
      const signals = detectRelationalSignals(userMessage);
      expect(signals.boundaryAdvicePresent).toBe(true);
      expect(signals.relationshipConflictSignal).toBe(true);
      expect(signals.connectionOpportunity).toBe(true);
    });

    it('requires bridge boundary with reconnection path', () => {
      const signals = detectRelationalSignals(userMessage);
      const result = applyRelationalStanceFilter({
        selectedModule: 'K01',
        safetyLevel: 'none',
        userDistress: 35,
        ...signals,
      });
      expect(result.requireBridgeBoundary).toBe(true);
      expect(result.gptDirective).toContain('BRIDGE BOUNDARY REQUIRED');
      expect(result.gptDirective).toContain('path to reconnection');
      expect(result.gptDirective).toContain('I want to stay connected');
    });
  });

  // ─── Case 4: Leugen of vertrouwensbreuk ────────────────────────────
  describe('Case 4: Leugen of vertrouwensbreuk', () => {
    const userMessage = 'De ander heeft weer gelogen. Ik vertrouw niets meer. Ik weet niet of ik dit nog kan.';

    it('detects conflict, blame risk, and distance risk', () => {
      const signals = detectRelationalSignals(userMessage);
      expect(signals.relationshipConflictSignal).toBe(true);
      // 'weer gelogen' + 'vertrouw niets meer' triggers harm pattern
      expect(signals.relationalHarmPatternSignal).toBe(true);
      expect(signals.repeatedBetrayalSignal).toBe(true);
      expect(signals.chronicTrustDamageSignal).toBe(true);
    });

    it('activates harm layer — blocks early perspective shift, requires repair conditions', () => {
      const signals = detectRelationalSignals(userMessage);
      const result = applyRelationalStanceFilter({
        selectedModule: 'KO1',
        safetyLevel: 'none',
        userDistress: 70,
        ...signals,
      });
      expect(result.requireHarmValidationFirst).toBe(true);
      expect(result.blockEarlyPerspectiveShift).toBe(true);
      expect(result.requireRepairConditions).toBe(true);
      expect(result.requireSafetyOverride).toBe(false);
      expect(result.gptDirective).toContain('RELATIONAL_HARM_PATTERN');
      expect(result.gptDirective).toContain('REPAIR CONDITIONS REQUIRED');
    });
  });

  // ─── Case 5: Safety-case (verbinding wijkt voor veiligheid) ────────
  describe('Case 5: Safety override — violence/threat', () => {
    const userMessage = 'De ander dreigt mij en ik ben bang. De ander schreeuwt en gooit dingen stuk.';

    it('detects conflict signals', () => {
      const signals = detectRelationalSignals(userMessage);
      expect(signals.relationshipConflictSignal).toBe(true);
    });

    it('activates safety override — no perspective shift, no bridge boundary', () => {
      const signals = detectRelationalSignals(userMessage);
      const result = applyRelationalStanceFilter({
        selectedModule: 'KO1',
        safetyLevel: 'elevated',
        userDistress: 90,
        ...signals,
      });
      expect(result.requireSafetyOverride).toBe(true);
      expect(result.requirePerspectiveShift).toBe(false);
      expect(result.requireBridgeBoundary).toBe(false);
      expect(result.gptDirective).toContain('SAFETY OVERRIDE');
      expect(result.gptDirective).toContain('Do NOT judge the other person');
      expect(result.gptDirective).toContain('You should not face this risk alone');
    });

    it('safety directive still blocks character judgment', () => {
      const signals = detectRelationalSignals(userMessage);
      const result = applyRelationalStanceFilter({
        selectedModule: 'KO1',
        safetyLevel: 'crisis',
        userDistress: 95,
        ...signals,
      });
      expect(result.blockBlameLanguage).toBe(true);
      expect(result.gptDirective).toContain('without character judgment');
    });
  });

  // ─── Identity Prompt Verification ──────────────────────────────────
  describe('KIM_IDENTITY_PROMPT verification', () => {
    it('no longer contains "chosen a side" language', () => {
      expect(KIM_IDENTITY_PROMPT).not.toContain('chosen a side');
      expect(KIM_IDENTITY_PROMPT).not.toContain('Always on their side');
      expect(KIM_IDENTITY_PROMPT).not.toContain('place responsibility where it belongs');
    });

    it('contains relational system perspective', () => {
      expect(KIM_IDENTITY_PROMPT).toContain('do not choose between people');
      expect(KIM_IDENTITY_PROMPT).toContain('relationship as a system');
      expect(KIM_IDENTITY_PROMPT).toContain('boundaries as bridges');
      expect(KIM_IDENTITY_PROMPT).toContain('Perspective curiosity');
    });

    it('contains forbidden framing rules', () => {
      expect(KIM_IDENTITY_PROMPT).toContain('never frame the other person as the attacker');
      expect(KIM_IDENTITY_PROMPT).toContain('never advise to leave, stay, cut contact');
      expect(KIM_IDENTITY_PROMPT).toContain('never use fixed person names');
    });

    it('contains bridge boundary formula', () => {
      expect(KIM_IDENTITY_PROMPT).toContain('Path to reconnection');
      expect(KIM_IDENTITY_PROMPT).toContain('I want to stay connected');
    });
  });
});

// ─── RELATIONAL_HARM_MIDDLE_LAYER Tests ──────────────────────────────────

describe('Kim Relational Harm Middle Layer', () => {
  // Case 6: Herhaald bedrog
  describe('Case 6: Herhaald bedrog (repeated betrayal)', () => {
    const userMessage = 'De ander is opnieuw vreemdgegaan. Het is niet de eerste keer. Ik weet niet meer wat ik nog moet geloven.';

    it('detects relational harm pattern signal', () => {
      const signals = detectRelationalSignals(userMessage);
      expect(signals.relationalHarmPatternSignal).toBe(true);
      expect(signals.repeatedBetrayalSignal).toBe(true);
    });

    it('blocks early perspective shift and requires harm validation first', () => {
      const signals = detectRelationalSignals(userMessage);
      const result = applyRelationalStanceFilter({
        selectedModule: 'KO1',
        safetyLevel: 'none',
        userDistress: 75,
        ...signals,
      });
      expect(result.requireHarmValidationFirst).toBe(true);
      expect(result.blockEarlyPerspectiveShift).toBe(true);
      expect(result.requireRepairConditions).toBe(true);
      expect(result.requirePerspectiveShift).toBe(false); // Blocked at harm level
      expect(result.requireSafetyOverride).toBe(false);
    });

    it('directive contains harm pattern response sequence', () => {
      const signals = detectRelationalSignals(userMessage);
      const result = applyRelationalStanceFilter({
        selectedModule: 'KO1',
        safetyLevel: 'none',
        userDistress: 75,
        ...signals,
      });
      expect(result.gptDirective).toContain('RELATIONAL_HARM_PATTERN');
      expect(result.gptDirective).toContain('EARLY PERSPECTIVE SHIFT BLOCKED');
      expect(result.gptDirective).toContain('REPAIR CONDITIONS REQUIRED');
      expect(result.gptDirective).not.toContain('PERSPECTIVE SHIFT REQUIRED');
    });
  });

  // Case 7: Herhaald liegen
  describe('Case 7: Herhaald liegen (repeated lying)', () => {
    const userMessage = 'De ander zegt telkens dat het de laatste keer is, maar ik kom steeds opnieuw leugens tegen.';

    it('detects repeated betrayal and harm pattern', () => {
      const signals = detectRelationalSignals(userMessage);
      expect(signals.repeatedBetrayalSignal).toBe(true);
      expect(signals.relationalHarmPatternSignal).toBe(true);
    });

    it('blocks perspective shift — does NOT ask what the other person feels', () => {
      const signals = detectRelationalSignals(userMessage);
      const result = applyRelationalStanceFilter({
        selectedModule: 'LEUGEN-K01',
        safetyLevel: 'none',
        userDistress: 65,
        ...signals,
      });
      expect(result.blockEarlyPerspectiveShift).toBe(true);
      expect(result.gptDirective).toContain('Do NOT start with "what might the other person feel?"');
    });
  });

  // Case 8: User already over-empathizing
  describe('Case 8: User already over-empathizing', () => {
    const userMessage = 'Ik begrijp het wel, ik weet dat het moeilijk is voor de ander, maar de ander liegt telkens opnieuw en ik kan er niet meer tegen.';

    it('detects over-empathizing and harm pattern', () => {
      const signals = detectRelationalSignals(userMessage);
      expect(signals.userAlreadyOverEmpathizing).toBe(true);
      expect(signals.relationalHarmPatternSignal).toBe(true);
      expect(signals.minimizationRisk).toBe(true);
    });

    it('blocks perspective shift and warns about minimization', () => {
      const signals = detectRelationalSignals(userMessage);
      const result = applyRelationalStanceFilter({
        selectedModule: 'K01',
        safetyLevel: 'none',
        userDistress: 55,
        ...signals,
      });
      expect(result.blockEarlyPerspectiveShift).toBe(true);
      expect(result.gptDirective).toContain('USER OVER-EMPATHIZING DETECTED');
      expect(result.gptDirective).toContain('MINIMIZATION RISK');
    });
  });

  // Case 9: Normal friction (NOT harm pattern) — perspective shift still works
  describe('Case 9: Normal friction — perspective shift still allowed', () => {
    const userMessage = 'We hadden ruzie over iets stoms en nu praat de ander niet meer met mij.';

    it('detects conflict but NOT harm pattern', () => {
      const signals = detectRelationalSignals(userMessage);
      expect(signals.relationshipConflictSignal).toBe(true);
      expect(signals.relationalHarmPatternSignal).toBe(false);
    });

    it('allows perspective shift for normal friction', () => {
      const signals = detectRelationalSignals(userMessage);
      const result = applyRelationalStanceFilter({
        selectedModule: 'KO1',
        safetyLevel: 'none',
        userDistress: 40,
        ...signals,
      });
      expect(result.requirePerspectiveShift).toBe(true);
      expect(result.requireHarmValidationFirst).toBe(false);
      expect(result.blockEarlyPerspectiveShift).toBe(false);
      expect(result.gptDirective).toContain('PERSPECTIVE SHIFT REQUIRED');
    });
  });
});
