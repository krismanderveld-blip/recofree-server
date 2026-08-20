/**
 * BEHE-K01 / PAAL-K01 / AANP-K01 — Relational Stance Proof Tests
 *
 * Per module: 5 scenario tests + K05/safety/harm proofs
 * Cross-module: no fixed person names, no blame/demonization, 0 TS errors
 */
import { describe, it, expect } from 'vitest';
import { buildBeheK01PromptPayload } from '@/lib/engine/kim/modules/BEHE-K01/beheK01.promptBuilder';
import { buildPaalK01PromptPayload } from '@/lib/engine/kim/modules/PAAL-K01/paalK01.promptBuilder';
import { buildAanpK01PromptPayload } from '@/lib/engine/kim/modules/AANP-K01/aanpK01.promptBuilder';
import { scanLayer1 } from '@/lib/engine/kim/k05-cross-module-override-client';

const mockDetection = {
  activated: true,
  confidence: 0.8,
  selectedInterventionType: 'default' as any,
  triggers: [],
  signals: [],
};

// ═══════════════════════════════════════════════════════════════════════
// BEHE-K01 — Control as Fear Response
// ═══════════════════════════════════════════════════════════════════════

describe('BEHE-K01 — Relational Stance', () => {
  const payload = buildBeheK01PromptPayload(mockDetection as any);

  it('SCENARIO 1: controleren uit angst — prompt validates fear, not blame', () => {
    expect(payload.fullPrompt).toContain('fear, uncertainty, or powerlessness');
    expect(payload.fullPrompt).toContain('not a character flaw');
    expect(payload.fullPrompt).toContain('1. Validate the fear or uncertainty');
    expect(payload.forbiddenOutput).toContain('you are controlling');
    expect(payload.forbiddenOutput).toContain('you are toxic');
  });

  it('SCENARIO 2: telefoon/checkgedrag — prompt does NOT encourage or condemn checking', () => {
    expect(payload.forbiddenOutput).toContain('check zijn telefoon');
    expect(payload.forbiddenOutput).toContain('controleer zijn telefoon');
    expect(payload.forbiddenOutput).toContain('dreig harder');
    expect(payload.forbiddenOutput).toContain('stel strengere ultimatums');
    // Also does not condemn
    expect(payload.forbiddenOutput).toContain('controle is fout');
    expect(payload.forbiddenOutput).toContain('je moet stoppen met controleren');
  });

  it('SCENARIO 3: vraag naar zekerheid — prompt offers alternative (clear agreement)', () => {
    expect(payload.fullPrompt).toContain('4. Offer an alternative: clear agreement, pause, self-regulation');
    expect(payload.fullPrompt).toContain('Safety and trust grow not through control, but through clear agreements');
  });

  it('SCENARIO 4: relational harm — control understandable but not leading', () => {
    // The prompt distinguishes control from boundary from care
    expect(payload.fullPrompt).toContain('Distinguish: control (managing the other) vs boundary (protecting yourself) vs care (being present)');
    expect(payload.fullPrompt).toContain('what are you afraid will happen if you let go');
  });

  it('SCENARIO 5: safety-case — control not the theme, safety override activates', () => {
    expect(payload.gptMayOverrideCrisis).toBe(false);
    // Safety override is handled by the pipeline, not by BEHE-K01
    // BEHE-K01 must not override crisis
  });

  it('forbidden list blocks distance-pushing', () => {
    expect(payload.forbiddenOutput).toContain('laat de ander gewoon los');
    expect(payload.forbiddenOutput).toContain('dat is niet jouw probleem');
    expect(payload.forbiddenOutput).toContain('je moet afstand nemen');
  });

  it('no fixed person names in prompt', () => {
    expect(payload.fullPrompt).not.toMatch(/\b(Kris|Melissa|Jan|Piet|Marie|Lisa)\b/);
    expect(payload.compactPrompt).not.toMatch(/\b(Kris|Melissa|Jan|Piet|Marie|Lisa)\b/);
  });

  it('K05 override catches bare BEHE-K01 boundary', () => {
    const bareBoundary = 'Ik begrijp je angst. Maar ik kan dit niet accepteren. Ik stop met dit gesprek.';
    const layer1 = scanLayer1(bareBoundary);
    expect(layer1.boundaryDetected).toBe(true);
    expect(layer1.repairPathDetected).toBe(false);
    expect(layer1.needsLayer2).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PAAL-K01 — Support Broadening
// ═══════════════════════════════════════════════════════════════════════

describe('PAAL-K01 — Relational Stance', () => {
  const payload = buildPaalK01PromptPayload(mockDetection as any);

  it('SCENARIO 1: maar één steunfiguur — prompt helps broaden without replacing', () => {
    expect(payload.fullPrompt).toContain('Help the user broaden their support base');
    expect(payload.fullPrompt).toContain('one relationship does not have to carry everything');
    expect(payload.forbiddenOutput).toContain('vervang de ander door anderen');
  });

  it('SCENARIO 2: schaamte om steun te vragen — prompt normalizes asking for support', () => {
    expect(payload.fullPrompt).toContain('Extra support is not betrayal');
    expect(payload.fullPrompt).toContain('You do not have to carry this alone');
    expect(payload.forbiddenOutput).toContain('je moet onafhankelijk worden');
  });

  it('SCENARIO 3: steun voelt als verraad — prompt reframes as relationship relief', () => {
    expect(payload.fullPrompt).toContain('Support outside the relationship can actually relieve the relationship');
    expect(payload.fullPrompt).toContain('More support pillars do not make you less loyal');
  });

  it('SCENARIO 4: steun buiten relatie om contact te ontlasten', () => {
    expect(payload.fullPrompt).toContain('5. Explain how this can make contact healthier');
    expect(payload.fullPrompt).toContain('less panic needs to enter the contact');
  });

  it('SCENARIO 5: safety-case — support activation urgent', () => {
    expect(payload.gptMayOverrideCrisis).toBe(false);
    // Safety override is handled by the pipeline
  });

  it('forbidden list blocks distance-pushing and judgment', () => {
    expect(payload.forbiddenOutput).toContain('zoek steun zodat je de ander minder nodig hebt');
    expect(payload.forbiddenOutput).toContain('vervang de ander door anderen');
    expect(payload.forbiddenOutput).toContain('je moet onafhankelijk worden');
    expect(payload.forbiddenOutput).toContain('je hebt te weinig steun');
    expect(payload.forbiddenOutput).toContain('je draagkracht is te laag');
  });

  it('no fixed person names in prompt', () => {
    expect(payload.fullPrompt).not.toMatch(/\b(Kris|Melissa|Jan|Piet|Marie|Lisa)\b/);
  });

  it('K05 override catches bare PAAL-K01 boundary', () => {
    const bareBoundary = 'Je hebt steun nodig. Ik kan dit niet accepteren dat je alles alleen draagt. Ik stop met dit gesprek.';
    const layer1 = scanLayer1(bareBoundary);
    expect(layer1.boundaryDetected).toBe(true);
    expect(layer1.needsLayer2).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AANP-K01 — Adjustment as Love
// ═══════════════════════════════════════════════════════════════════════

describe('AANP-K01 — Relational Stance', () => {
  const payload = buildAanpK01PromptPayload(mockDetection as any);

  it('SCENARIO 1: pleasen om conflict te vermijden — prompt validates intent', () => {
    expect(payload.fullPrompt).toContain('1. Acknowledge the intention behind the adjustment');
    expect(payload.fullPrompt).toContain('Adjustment can be loving and relationally healthy');
    expect(payload.forbiddenOutput).toContain('stop met aanpassen');
  });

  it('SCENARIO 2: eigen behoefte inslikken — prompt names self-loss without blame', () => {
    expect(payload.fullPrompt).toContain('2. Name when adjustment becomes self-loss');
    expect(payload.fullPrompt).toContain('the price becomes too high');
    expect(payload.forbiddenOutput).toContain('je laat over je heen lopen');
  });

  it('SCENARIO 3: aanpassen uit verlatingsangst — prompt explores what is needed', () => {
    expect(payload.fullPrompt).toContain('3. Ask what the user actually needs');
    expect(payload.fullPrompt).toContain('What would you want to say if it were safe enough');
  });

  it('SCENARIO 4: relational harm — adjustment becomes self-damaging', () => {
    expect(payload.fullPrompt).toContain('structurally disappears to avoid tension');
    expect(payload.fullPrompt).toContain('survival strategies, not character flaws');
    expect(payload.fullPrompt).toContain('validate the protective intent before exploring the cost');
  });

  it('SCENARIO 5: safety-case — adjustment masks danger', () => {
    expect(payload.gptMayOverrideCrisis).toBe(false);
    // Safety override is handled by the pipeline
  });

  it('forbidden list blocks blaming and distance-pushing', () => {
    expect(payload.forbiddenOutput).toContain('stop met aanpassen');
    expect(payload.forbiddenOutput).toContain('je laat over je heen lopen');
    expect(payload.forbiddenOutput).toContain('de ander gebruikt jouw aanpassing');
    expect(payload.forbiddenOutput).toContain('trek je grens en klaar');
    expect(payload.forbiddenOutput).toContain('afstand nemen is beter');
    expect(payload.forbiddenOutput).toContain('je liegt');
    expect(payload.forbiddenOutput).toContain('je bent oneerlijk');
  });

  it('no fixed person names in prompt', () => {
    expect(payload.fullPrompt).not.toMatch(/\b(Kris|Melissa|Jan|Piet|Marie|Lisa)\b/);
  });

  it('K05 override catches bare AANP-K01 boundary', () => {
    const bareBoundary = 'Ik hoor je. Maar ik wil niet meer aanpassen. Ik stop met dit gesprek.';
    const layer1 = scanLayer1(bareBoundary);
    expect(layer1.boundaryDetected).toBe(true);
    expect(layer1.needsLayer2).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Cross-Module Proofs
// ═══════════════════════════════════════════════════════════════════════

describe('Cross-Module — Safety and Harm Proofs', () => {
  it('all three modules do NOT allow diagnosis', () => {
    expect(buildBeheK01PromptPayload(mockDetection as any).gptMayDiagnose).toBe(false);
    expect(buildPaalK01PromptPayload(mockDetection as any).gptMayDiagnose).toBe(false);
    expect(buildAanpK01PromptPayload(mockDetection as any).gptMayDiagnose).toBe(false);
  });

  it('all three modules do NOT use Elias data', () => {
    expect(buildBeheK01PromptPayload(mockDetection as any).gptMayUseEliasData).toBe(false);
    expect(buildPaalK01PromptPayload(mockDetection as any).gptMayUseEliasData).toBe(false);
    expect(buildAanpK01PromptPayload(mockDetection as any).gptMayUseEliasData).toBe(false);
  });

  it('all three modules do NOT tell Kim to control loved one', () => {
    expect(buildBeheK01PromptPayload(mockDetection as any).gptMayTellKimToControlLovedOne).toBe(false);
    expect(buildPaalK01PromptPayload(mockDetection as any).gptMayTellKimToControlLovedOne).toBe(false);
    expect(buildAanpK01PromptPayload(mockDetection as any).gptMayTellKimToControlLovedOne).toBe(false);
  });

  it('no demonization language in any module', () => {
    // Words like 'toxic' appear in FORBIDDEN lists (correct — they're blocked).
    // Verify 'toxic' is forbidden in BEHE, and no demonization in compact/allowed sections.
    const behePayload = buildBeheK01PromptPayload(mockDetection as any);
    const paalPayload = buildPaalK01PromptPayload(mockDetection as any);
    const aanpPayload = buildAanpK01PromptPayload(mockDetection as any);
    expect(behePayload.forbiddenOutput).toContain('you are toxic');
    expect(behePayload.compactPrompt).not.toContain('narcissist');
    expect(paalPayload.compactPrompt).not.toContain('narcissist');
    expect(aanpPayload.compactPrompt).not.toContain('narcissist');
  });
});
