/**
 * FASE 9L: Kim Nano Semantic Detector Integration Tests
 * Tests that nano themes correctly supplement regex detection.
 */
import { describe, it, expect } from 'vitest';
import { buildKimRelationalFormulationContext } from '@/lib/engine/kim/relational-formulation/kim-relational-formulation-engine';

function makeInput(msg: string, overrides: Record<string, any> = {}) {
  return {
    persona: 'kim' as const,
    userMessage: msg,
    normalizedMessage: msg,
    effectiveDepth: 'medium' as const,
    safetyActive: false,
    crisisActive: false,
    relationalHarmPatternActive: false,
    guidanceDepth: 'normal' as const,
    currentZone: 'green' as const,
    moduleId: 'K01',
    memoryFacts: [] as string[],
    engineSignals: [] as string[],
    semanticThemes: [] as string[],
    localTimestamp: '2026-08-11T12:00:00',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// A. VOCABULARY TESTS
// ═══════════════════════════════════════════════════════════════

describe('FASE 9L — A. Vocabulary', () => {
  it('medical labels are accepted by engine without crash', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'test', { semanticThemes: ['medical_concern_partner', 'withdrawal_symptoms', 'organ_damage_concern'] }
    ));
    expect(ctx.persona).toBe('kim');
  });

  it('rescue labels are accepted', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'test', { semanticThemes: ['rescue_role', 'controlling_other_recovery', 'managing_other_sobriety'] }
    ));
    expect(ctx.persona).toBe('kim');
  });

  it('mindreading labels are accepted', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'test', { semanticThemes: ['intent_attribution', 'motive_assumption', 'deliberate_harm_belief'] }
    ));
    expect(ctx.persona).toBe('kim');
  });

  it('self-loss labels are accepted', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'test', { semanticThemes: ['emotional_dependency', 'self_loss_through_other', 'day_depends_on_other'] }
    ));
    expect(ctx.persona).toBe('kim');
  });
});

// ═══════════════════════════════════════════════════════════════
// B. MEDICAL — nano-only positive + negative
// ═══════════════════════════════════════════════════════════════

describe('FASE 9L — B. Medical (nano-supplemented)', () => {
  it('B1+ ontwenningsverschijnselen via nano theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Ik denk dat hij ontwenningsverschijnselen heeft.',
      { semanticThemes: ['withdrawal_symptoms'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustMention.some(m => m.includes('arts') || m.includes('behandelteam'))).toBe(true);
    expect(ctx.mustAvoid.some(m => m.includes('diagnose'))).toBe(true);
  });

  it('B2+ lever kapot via nano theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Zijn lever is kapot van het drinken.',
      { semanticThemes: ['organ_damage_concern'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustMention.some(m => m.includes('arts') || m.includes('behandelteam'))).toBe(true);
  });

  it('B3+ geheugen beschadigd via nano theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Kan zijn geheugen hierdoor beschadigd zijn?',
      { semanticThemes: ['medical_concern_partner'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustMention.some(m => m.includes('arts') || m.includes('behandelteam'))).toBe(true);
  });

  it('B4- ziek van zorgen (figurative) — no medical', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Ik voel me ziek van zorgen.',
      { semanticThemes: ['emotional_overwhelm'] }
    ));
    expect(ctx.mustMention.some(m => m.includes('arts') || m.includes('behandelteam'))).toBe(false);
  });

  it('B5- misselijk van stress — no medical', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Dit maakt me misselijk van stress.',
      { semanticThemes: ['emotional_overwhelm'] }
    ));
    expect(ctx.mustMention.some(m => m.includes('arts') || m.includes('behandelteam'))).toBe(false);
  });

  it('B6- kapot van vermoeidheid — no medical', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Ik ben kapot van vermoeidheid.',
      { semanticThemes: ['exhaustion'] }
    ));
    expect(ctx.mustMention.some(m => m.includes('arts') || m.includes('behandelteam'))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// C. RESCUE — nano-only positive + negative
// ═══════════════════════════════════════════════════════════════

describe('FASE 9L — C. Rescue (nano-supplemented)', () => {
  it('C1+ nuchter houden via nano theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Ik moet ervoor zorgen dat hij nuchter blijft.',
      { semanticThemes: ['rescue_role'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustMention.some(m => m.includes('verantwoordelijkheid') || m.includes('diens'))).toBe(true);
    expect(ctx.mustAvoid.some(m => m.includes('therapietrouw') || m.includes('controle'))).toBe(true);
  });

  it('C2+ herstel volhouden via nano theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Zonder mij houdt hij zijn herstel niet vol.',
      { semanticThemes: ['controlling_other_recovery'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustMention.some(m => m.includes('verantwoordelijkheid') || m.includes('diens'))).toBe(true);
  });

  it('C3+ gebruik onder controle houden via nano theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Ik moet haar gebruik onder controle houden.',
      { semanticThemes: ['managing_other_sobriety'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustAvoid.some(m => m.includes('therapietrouw') || m.includes('controle'))).toBe(true);
  });

  it('C4- plannen samen huishouden — no rescue', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'We plannen samen het huishouden.',
      { semanticThemes: ['general_question'] }
    ));
    expect(ctx.mustAvoid.some(m => m.includes('therapietrouw van partner te managen'))).toBe(false);
  });

  it('C5- afspraken kinderen — no rescue', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'We maken samen afspraken over de kinderen.',
      { semanticThemes: ['general_question'] }
    ));
    expect(ctx.mustAvoid.some(m => m.includes('therapietrouw van partner te managen'))).toBe(false);
  });

  it('C6- steunen bij eigen hulp — no rescue', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Ik wil hem steunen nu hij zelf hulp heeft gezocht.',
      { semanticThemes: ['support_pillars'] }
    ));
    expect(ctx.mustAvoid.some(m => m.includes('therapietrouw van partner te managen'))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// D. MINDREADING — nano-only positive + negative
// ═══════════════════════════════════════════════════════════════

describe('FASE 9L — D. Mindreading (nano-supplemented)', () => {
  it('D1+ om mij te straffen via nano theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Hij doet dat om mij te straffen.',
      { semanticThemes: ['intent_attribution'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustAvoid.some(m => m.includes('intentie bevestigen'))).toBe(true);
    expect(ctx.mustMention.some(m => m.includes('observeerbaar') || m.includes('impact') || m.includes('pijn'))).toBe(true);
  });

  it('D2+ expres pijn doen via nano theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Ze drinkt expres om mij pijn te doen.',
      { semanticThemes: ['deliberate_harm_belief'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustAvoid.some(m => m.includes('intentie bevestigen'))).toBe(true);
  });

  it('D3+ wil dat ik bang ben via nano theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Hij wil dat ik bang ben.',
      { semanticThemes: ['motive_assumption'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustAvoid.some(m => m.includes('intentie bevestigen'))).toBe(true);
  });

  it('D4- zei letterlijk — no mindreading (negative filter)', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Hij zei letterlijk dat hij niet naar therapie wil.',
      { semanticThemes: ['broken_trust'] }
    ));
    // No mindreading themes, so no mindreading detection
    expect(ctx.mustAvoid.some(m => m.includes('intentie bevestigen'))).toBe(false);
  });

  it('D5- vertelde dat ze gebruikt heeft — no mindreading', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Ze vertelde me dat ze gisteren gebruikt heeft.',
      { semanticThemes: ['broken_trust'] }
    ));
    expect(ctx.mustAvoid.some(m => m.includes('intentie bevestigen'))).toBe(false);
  });

  it('D6- kwam niet thuis — no mindreading', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Hij kwam vannacht niet thuis.',
      { semanticThemes: ['broken_trust'] }
    ));
    expect(ctx.mustAvoid.some(m => m.includes('intentie bevestigen'))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// E. REPEATED HARM — positive + negative
// ═══════════════════════════════════════════════════════════════

describe('FASE 9L — E. Repeated Harm (nano-supplemented)', () => {
  it('E1+ herhaald liegen with broken_trust theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Hij heeft al zo vaak gelogen dat ik niet meer weet wat ik moet geloven.',
      { semanticThemes: ['broken_trust'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustMention.some(m => m.includes('herhaald') || m.includes('impact'))).toBe(true);
  });

  it('E2+ herhaald bedrog with betrayal theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Elke keer belooft hij beterschap maar het verandert nooit.',
      { semanticThemes: ['betrayal'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustMention.some(m => m.includes('herhaald') || m.includes('eigen regie'))).toBe(true);
  });

  it('E3+ telkens grenzen overschrijden', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Hij overschrijdt telkens dezelfde grens die we hebben afgesproken.',
      { semanticThemes: ['broken_trust'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
  });

  it('E4- gewone miscommunicatie — no repeated harm', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'We hadden een misverstand over wie de kinderen zou ophalen.',
      { semanticThemes: ['general_question'] }
    ));
    expect(ctx.mustMention.some(m => m.includes('herhaald patroon'))).toBe(false);
  });

  it('E5- schoolkeuze — no repeated harm', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'We zijn het niet eens over de schoolkeuze.',
      { semanticThemes: ['general_question'] }
    ));
    expect(ctx.mustMention.some(m => m.includes('herhaald patroon'))).toBe(false);
  });

  it('E6- huishoudelijke discussie — no repeated harm', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'We hebben ruzie over de afwas.',
      { semanticThemes: ['general_question'] }
    ));
    expect(ctx.mustMention.some(m => m.includes('herhaald patroon'))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// F. SELF-LOSS — positive + negative
// ═══════════════════════════════════════════════════════════════

describe('FASE 9L — F. Self-Loss (new detector)', () => {
  it('F1+ dag hangt af via nano theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Mijn hele dag hangt af van hoe hij thuiskomt.',
      { semanticThemes: ['day_depends_on_other'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustMention.some(m => m.includes('eigen regie') || m.includes('eigen ruimte'))).toBe(true);
    expect(ctx.mustAvoid.some(m => m.includes('partner controleren'))).toBe(true);
  });

  it('F2+ plan niets meer via nano theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Ik plan niets meer omdat ik nooit weet hoe zij zal zijn.',
      { semanticThemes: ['self_loss_through_other'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustMention.some(m => m.includes('eigen regie') || m.includes('controle'))).toBe(true);
  });

  it('F3+ kan zelf niets meer via nano theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Als het slecht met hem gaat, kan ik zelf niets meer.',
      { semanticThemes: ['emotional_dependency'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustMention.some(m => m.includes('eigen regie') || m.includes('eigen ruimte'))).toBe(true);
  });

  it('F4+ alles draait rond gebruik via nano theme', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Alles in mijn leven draait rond zijn gebruik.',
      { semanticThemes: ['self_loss_through_other'] }
    ));
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.mustAvoid.some(m => m.includes('partner controleren') || m.includes('pathologiserende'))).toBe(true);
  });

  it('F5- mis hem als hij laat is — no self-loss', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Ik mis hem wanneer hij laat thuiskomt.',
      { semanticThemes: ['loneliness'] }
    ));
    expect(ctx.mustMention.some(m => m.includes('eigen regie') && m.includes('eigen ruimte'))).toBe(false);
  });

  it('F6- veel tijd samen — no self-loss', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'We brengen veel tijd samen door.',
      { semanticThemes: ['general_question'] }
    ));
    expect(ctx.mustMention.some(m => m.includes('eigen regie') && m.includes('eigen ruimte'))).toBe(false);
  });

  it('F7- rekening houden met werkuren — no self-loss', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Ik hou rekening met zijn werkuren.',
      { semanticThemes: ['general_question'] }
    ));
    expect(ctx.mustMention.some(m => m.includes('eigen regie') && m.includes('eigen ruimte'))).toBe(false);
  });

  it('F8- bezorgd omdat ziek — no self-loss', () => {
    const ctx = buildKimRelationalFormulationContext(makeInput(
      'Ik was vandaag bezorgd omdat hij ziek was.',
      { semanticThemes: ['general_question'] }
    ));
    expect(ctx.mustMention.some(m => m.includes('eigen regie') && m.includes('eigen ruimte'))).toBe(false);
  });
});
