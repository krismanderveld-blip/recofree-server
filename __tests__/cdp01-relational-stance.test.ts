/**
 * CDP01 RELATIONAL STANCE — Proof Tests
 *
 * Verifies:
 * 1. New prompt contains correct stance (no diagnostic language)
 * 2. Forbidden framing list is complete
 * 3. 5 scenario tests: reddersrol, schuld bij zelfzorg, controle uit angst,
 *    identiteitsverlies, conflict zonder safety
 * 4. K05 override respect (bare boundary from CDP01 gets corrected)
 * 5. Safety and RELATIONAL_HARM_PATTERN exceptions are not overridden
 */
import { describe, it, expect, vi } from 'vitest';
import { buildCodepK01PromptPayload } from '@/lib/engine/kim/modules/CODEP-K01/codepK01.promptBuilder';
import { scanLayer1 } from '../server/k05-cross-module-override';

// Mock detection result for building prompt
const mockDetection = {
  activated: true,
  confidence: 0.8,
  selectedInterventionType: 'identity_fusion' as const,
  triggers: ['rescue_behavior'],
  signals: [],
};

// ─── 1. New Prompt Stance ──────────────────────────────────────────────

describe('CDP01 — New Relational Stance', () => {
  const payload = buildCodepK01PromptPayload(mockDetection as any);

  it('compactPrompt contains new stance keywords', () => {
    expect(payload.compactPrompt).toContain('self-loss');
    expect(payload.compactPrompt).toContain('love without self-loss');
    expect(payload.compactPrompt).toContain('WITHOUT labeling');
    expect(payload.compactPrompt).not.toContain('identity fusion');
    expect(payload.compactPrompt).not.toContain('codependent');
  });

  it('fullPrompt contains 6-step response framework', () => {
    expect(payload.fullPrompt).toContain('CDP01 RESPONSE FRAMEWORK');
    expect(payload.fullPrompt).toContain('1. Validate the love or care behind the pattern');
    expect(payload.fullPrompt).toContain('2. Name the self-loss carefully');
    expect(payload.fullPrompt).toContain('3. Distinguish between supporting, rescuing, controlling');
    expect(payload.fullPrompt).toContain('4. Ask maximum ONE self-insight question');
    expect(payload.fullPrompt).toContain('5. Offer ONE small self-direction step');
    expect(payload.fullPrompt).toContain('6. Preserve connection');
  });

  it('fullPrompt does NOT contain old diagnostic framing', () => {
    expect(payload.fullPrompt).not.toContain('existing only through partner');
    expect(payload.fullPrompt).not.toContain('identity fusion');
    expect(payload.fullPrompt).not.toContain('boundary absence');
    // These phrases appear in the FORBIDDEN list (correct), but not as instructions to USE them
    // Check they are not in the allowed/instructional sections
    expect(payload.fullPrompt).not.toContain('Your role: NAME the pattern without EVER using the word');
    expect(payload.fullPrompt).not.toContain('Never say \'you are codependent\'');
  });

  it('fullPrompt contains allowed language examples', () => {
    expect(payload.fullPrompt).toContain('Your life seems to be getting smaller');
    expect(payload.fullPrompt).toContain('Love does not have to mean that you disappear');
    expect(payload.fullPrompt).toContain('You can stay involved without losing yourself');
    expect(payload.fullPrompt).toContain('enough room for you');
    expect(payload.fullPrompt).toContain('make the connection healthier');
  });

  it('fullPrompt contains example correct response', () => {
    expect(payload.fullPrompt).toContain('I hear how much you care');
    expect(payload.fullPrompt).toContain('your own space seems to be getting smaller');
    expect(payload.fullPrompt).toContain('one small choice today that is yours');
    expect(payload.fullPrompt).toContain('without having to write the other person off');
  });
});

// ─── 2. Forbidden Framing List ─────────────────────────────────────────

describe('CDP01 — Forbidden Framing', () => {
  const payload = buildCodepK01PromptPayload(mockDetection as any);

  it('forbiddenOutput blocks all diagnostic labels', () => {
    expect(payload.forbiddenOutput).toContain('codependent');
    expect(payload.forbiddenOutput).toContain('codependentie');
    expect(payload.forbiddenOutput).toContain('co-dependent');
    expect(payload.forbiddenOutput).toContain('diagnose');
    expect(payload.forbiddenOutput).toContain('ongezond gehecht');
    expect(payload.forbiddenOutput).toContain('je hebt een stoornis');
    expect(payload.forbiddenOutput).toContain('je bent ziek');
  });

  it('forbiddenOutput blocks distance-pushing language', () => {
    expect(payload.forbiddenOutput).toContain('je moet loslaten');
    expect(payload.forbiddenOutput).toContain('je moet hem verlaten');
    expect(payload.forbiddenOutput).toContain('je moet afstand nemen');
    expect(payload.forbiddenOutput).toContain('je moet loskomen');
  });

  it('forbiddenOutput blocks blaming/shaming language', () => {
    expect(payload.forbiddenOutput).toContain('je bent te betrokken');
    expect(payload.forbiddenOutput).toContain('je laat je gebruiken');
    expect(payload.forbiddenOutput).toContain('je houdt dit zelf in stand');
    expect(payload.forbiddenOutput).toContain('je bent verslaafd aan hem');
  });

  it('forbiddenOutput blocks identity erasure framing', () => {
    expect(payload.forbiddenOutput).toContain('je bestaat alleen door de ander');
    expect(payload.forbiddenOutput).toContain('je leeft alleen via de ander');
    expect(payload.forbiddenOutput).toContain('existing only through partner');
    expect(payload.forbiddenOutput).toContain('afhankelijk van de ander als identiteit');
  });
});

// ─── 3. Scenario Tests ─────────────────────────────────────────────────

describe('CDP01 — Scenario Coverage', () => {
  const payload = buildCodepK01PromptPayload(mockDetection as any);

  it('SCENARIO 1: Reddersrol — prompt guides toward distinguishing rescue from support', () => {
    // The prompt must contain guidance to distinguish rescuing from supporting
    expect(payload.fullPrompt).toContain('Distinguish between supporting, rescuing, controlling');
    expect(payload.fullPrompt).toContain('taking over than supporting');
    // And must NOT frame rescue as inherently wrong
    expect(payload.fullPrompt).not.toContain('stop rescuing');
    expect(payload.fullPrompt).not.toContain('you must stop helping');
  });

  it('SCENARIO 2: Schuld bij zelfzorg — prompt validates love before naming self-loss', () => {
    // Step 1 of framework: validate love/care first
    expect(payload.fullPrompt).toContain('1. Validate the love or care behind the pattern');
    // Then step 2: name self-loss
    expect(payload.fullPrompt).toContain('2. Name the self-loss carefully');
    // Must not frame self-care as selfish
    expect(payload.fullPrompt).not.toContain('selfish');
    expect(payload.fullPrompt).not.toContain('you are neglecting yourself');
  });

  it('SCENARIO 3: Controle uit angst — prompt explores fear underneath control', () => {
    // The relational connection check distinguishes fear from control
    expect(payload.fullPrompt).toContain('fear');
    expect(payload.fullPrompt).toContain('control');
    expect(payload.fullPrompt).toContain('love');
    // Must distinguish, not blame
    expect(payload.fullPrompt).toContain('Distinguish');
  });

  it('SCENARIO 4: "Zonder de ander weet ik niet wie ik ben" — prompt does NOT use identity erasure framing', () => {
    // Must NOT say "you only exist through the other person"
    expect(payload.fullPrompt).not.toContain('existing only through partner');
    expect(payload.fullPrompt).not.toContain('identity fusion');
    // Must use softer framing
    expect(payload.fullPrompt).toContain('life may be shrinking');
    expect(payload.fullPrompt).toContain('still needs room');
  });

  it('SCENARIO 5: Relationeel conflict zonder safety — prompt preserves connection', () => {
    // Step 6: preserve connection
    expect(payload.fullPrompt).toContain('6. Preserve connection');
    expect(payload.fullPrompt).toContain('no demonizing the other person');
    expect(payload.fullPrompt).toContain('no distance as default');
    // Bridge direction
    expect(payload.fullPrompt).toContain('love without self-loss');
  });
});

// ─── 4. K05 Override Respect ────────────────────────────────────────────

describe('CDP01 — K05 Override Respect', () => {
  it('CDP01 bare boundary response triggers K05 Layer 1 detection', () => {
    // Simulate a CDP01 response that sets a boundary without repair path
    const bareBoundaryResponse = 'Ik hoor je pijn. Maar ik kan dit niet accepteren. Ik stop met dit gesprek.';
    const layer1 = scanLayer1(bareBoundaryResponse);
    expect(layer1.boundaryDetected).toBe(true);
    expect(layer1.repairPathDetected).toBe(false);
    expect(layer1.needsLayer2).toBe(true);
    // This proves: if CDP01 generates a bare boundary, K05 override WILL catch it
  });

  it('CDP01 response with repair path does NOT trigger K05 override', () => {
    // Simulate a correct CDP01 response with bridge
    const goodResponse = 'Je leven lijkt kleiner te worden rond de ander. Maar liefde hoeft niet te betekenen dat jij verdwijnt. Wat is één kleine keuze vandaag die van jou is, zonder dat je de ander hoeft af te schrijven? Laten we samen kijken hoe je betrokken kunt blijven.';
    const layer1 = scanLayer1(goodResponse);
    // This should NOT trigger override (no boundary signal, or has repair path)
    expect(layer1.needsLayer2).toBe(false);
  });
});

// ─── 5. Safety and Harm Exception Proofs ────────────────────────────────

describe('CDP01 — Safety and Harm Exceptions', () => {
  it('CDP01 prompt does not override crisis', () => {
    const payload = buildCodepK01PromptPayload(mockDetection as any);
    expect(payload.gptMayOverrideCrisis).toBe(false);
  });

  it('CDP01 prompt does not allow diagnosis', () => {
    const payload = buildCodepK01PromptPayload(mockDetection as any);
    expect(payload.gptMayDiagnose).toBe(false);
  });

  it('CDP01 prompt does not use Elias data', () => {
    const payload = buildCodepK01PromptPayload(mockDetection as any);
    expect(payload.gptMayUseEliasData).toBe(false);
  });

  it('CDP01 prompt does not tell Kim to control loved one', () => {
    const payload = buildCodepK01PromptPayload(mockDetection as any);
    expect(payload.gptMayTellKimToControlLovedOne).toBe(false);
  });
});
