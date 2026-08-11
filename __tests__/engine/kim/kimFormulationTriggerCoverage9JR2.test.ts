import { describe, it, expect } from 'vitest';
import { buildKimRelationalFormulationContext } from '@/lib/engine/kim/relational-formulation/kim-relational-formulation-engine';

function makeInput(msg: string) {
  return {
    persona: 'kim' as const,
    userMessage: msg,
    normalizedMessage: msg,
    effectiveDepth: 'medium' as const,
    safetyActive: false,
    crisisActive: false,
    guidanceDepth: 'normal' as const,
    currentZone: 'green' as const,
    moduleId: 'K01',
    memoryFacts: [],
    engineSignals: [],
    localTimestamp: '2026-08-11T12:00:00',
    relationalHarmPatternActive: false,
  };
}

describe('FASE 9J-R2: Kim Formulation Trigger Coverage', () => {
  // ── RESCUE POSITIVE ──
  describe('Rescue / Recovery Ownership — Positive', () => {
    it('1. "Hoe zorg ik ervoor dat hij zijn therapie blijft volgen?" triggers rescue', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Hoe zorg ik ervoor dat hij zijn therapie blijft volgen?'));
      expect(ctx.mode).not.toBe('insufficient_context');
      expect(ctx.mustMention.some(m => m.includes('verantwoordelijkheid'))).toBe(true);
      expect(ctx.mustAvoid.some(m => m.includes('therapietrouw'))).toBe(true);
    });

    it('2. "Ik moet hem gemotiveerd houden om niet opnieuw te drinken" triggers rescue', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Ik moet hem gemotiveerd houden om niet opnieuw te drinken.'));
      expect(ctx.mode).not.toBe('insufficient_context');
      expect(ctx.mustMention.some(m => m.includes('verantwoordelijkheid') || m.includes('diens'))).toBe(true);
    });

    it('3. "Als ik hem niet controleer gaat het weer mis" triggers rescue', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Als ik hem niet controleer gaat het weer mis.'));
      expect(ctx.mode).not.toBe('insufficient_context');
      expect(ctx.mustAvoid.some(m => m.includes('controle'))).toBe(true);
    });
  });

  // ── RESCUE NEGATIVE ──
  describe('Rescue / Recovery Ownership — Negative', () => {
    it('4. "We plannen samen het huishouden" does NOT trigger rescue', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('We plannen samen het huishouden.'));
      expect(ctx.mustMention.some(m => m.includes('herstel/verandering van de ander'))).toBe(false);
    });

    it('5. "We hebben afgesproken wie de kinderen ophaalt" does NOT trigger rescue', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('We hebben afgesproken wie de kinderen ophaalt.'));
      expect(ctx.mustMention.some(m => m.includes('herstel/verandering van de ander'))).toBe(false);
    });

    it('6. "We willen samen beter communiceren" does NOT trigger rescue', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('We willen samen beter communiceren.'));
      expect(ctx.mustMention.some(m => m.includes('herstel/verandering van de ander'))).toBe(false);
    });
  });

  // ── MINDREADING POSITIVE ──
  describe('Mindreading — Positive', () => {
    it('7. "Hij doet het expres om mij te kwetsen" triggers mindreading', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Hij doet het expres om mij te kwetsen.'));
      expect(ctx.mode).not.toBe('insufficient_context');
      expect(ctx.mustMention.some(m => m.includes('observeerbaar') || m.includes('intentie'))).toBe(true);
      expect(ctx.mustAvoid.some(m => m.includes('intentie bevestigen'))).toBe(true);
    });

    it('8. "Ze drinkt alleen maar om mij te manipuleren" triggers mindreading', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Ze drinkt alleen maar om mij te manipuleren.'));
      expect(ctx.mode).not.toBe('insufficient_context');
      expect(ctx.mustAvoid.some(m => m.includes('intentie') || m.includes('verklaring'))).toBe(true);
    });

    it('9. "Hij wil gewoon dat ik alles voor hem oplos" triggers mindreading', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Hij wil gewoon dat ik alles voor hem oplos.'));
      expect(ctx.mode).not.toBe('insufficient_context');
      expect(ctx.mustMention.some(m => m.includes('pijn') || m.includes('impact'))).toBe(true);
    });
  });

  // ── MINDREADING NEGATIVE ──
  describe('Mindreading — Negative', () => {
    it('10. "Hij zei letterlijk dat hij niet naar therapie wil" does NOT trigger mindreading', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Hij zei letterlijk dat hij niet naar therapie wil.'));
      expect(ctx.mustAvoid.some(m => m.includes('intentie bevestigen'))).toBe(false);
    });

    it('11. "Ze vertelde me dat ze gisteren gedronken heeft" does NOT trigger mindreading', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Ze vertelde me dat ze gisteren gedronken heeft.'));
      expect(ctx.mustAvoid.some(m => m.includes('intentie bevestigen'))).toBe(false);
    });

    it('12. "Hij kwam niet thuis" does NOT trigger mindreading', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Hij kwam niet thuis.'));
      expect(ctx.mustAvoid.some(m => m.includes('intentie bevestigen'))).toBe(false);
    });
  });

  // ── MEDICAL POSITIVE ──
  describe('Medical Boundary — Positive', () => {
    it('13. "Is zijn agressie door alcoholontwenning?" triggers medical', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Is zijn agressie door alcoholontwenning?'));
      expect(ctx.mode).not.toBe('insufficient_context');
      expect(ctx.mustMention.some(m => m.includes('arts') || m.includes('behandelteam'))).toBe(true);
      expect(ctx.mustAvoid.some(m => m.includes('diagnose'))).toBe(true);
    });

    it('14. "Kan die medicatie maken dat ze zo reageert?" triggers medical', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Kan die medicatie maken dat ze zo reageert?'));
      expect(ctx.mode).not.toBe('insufficient_context');
      expect(ctx.mustAvoid.some(m => m.includes('medische zekerheid') || m.includes('diagnose'))).toBe(true);
    });

    it('15. "Komt zijn geheugenverlies door het drinken?" triggers medical', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Komt zijn geheugenverlies door het drinken?'));
      expect(ctx.mode).not.toBe('insufficient_context');
      expect(ctx.mustMention.some(m => m.includes('arts') || m.includes('behandelteam'))).toBe(true);
    });
  });

  // ── MEDICAL NEGATIVE ──
  describe('Medical Boundary — Negative', () => {
    it('16. "Ik voel me uitgeput door zijn gedrag" does NOT trigger medical', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Ik voel me uitgeput door zijn gedrag.'));
      expect(ctx.mustMention.some(m => m.includes('arts') || m.includes('behandelteam'))).toBe(false);
    });

    it('17. "Ik weet niet meer hoe ik hiermee moet omgaan" does NOT trigger medical', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Ik weet niet meer hoe ik hiermee moet omgaan.'));
      expect(ctx.mustMention.some(m => m.includes('arts') || m.includes('behandelteam'))).toBe(false);
    });

    it('18. "Waarom raakt dit mij zo hard?" does NOT trigger medical', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Waarom raakt dit mij zo hard?'));
      expect(ctx.mustMention.some(m => m.includes('arts') || m.includes('behandelteam'))).toBe(false);
    });
  });

  // ── REPEATED HARM POSITIVE ──
  describe('Repeated Relational Harm — Positive', () => {
    it('19. "Hij liegt telkens opnieuw tegen mij" triggers repeated harm', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Hij liegt telkens opnieuw tegen mij.'));
      expect(ctx.mode).not.toBe('insufficient_context');
      expect(ctx.mustMention.some(m => m.includes('impact') || m.includes('herhaald'))).toBe(true);
      expect(ctx.mustMention.some(m => m.includes('eigen regie'))).toBe(true);
    });

    it('20. "Elke keer belooft hij iets en breekt hij het weer" triggers repeated harm', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Elke keer belooft hij iets en breekt hij het weer.'));
      expect(ctx.mode).not.toBe('insufficient_context');
      expect(ctx.mustAvoid.some(m => m.includes('demonisering'))).toBe(true);
    });

    it('21. "Hij overschrijdt steeds dezelfde grens" triggers repeated harm', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Hij overschrijdt steeds dezelfde grens.'));
      expect(ctx.mode).not.toBe('insufficient_context');
      expect(ctx.mustMention.some(m => m.includes('concrete stap'))).toBe(true);
    });
  });

  // ── REPEATED HARM NEGATIVE ──
  describe('Repeated Relational Harm — Negative', () => {
    it('22. "We zijn het niet eens over schoolkeuze" does NOT trigger repeated harm', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('We zijn het niet eens over schoolkeuze.'));
      expect(ctx.mustMention.some(m => m.includes('herhaald patroon'))).toBe(false);
    });

    it('23. "We hadden ruzie over geld" does NOT trigger repeated harm', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('We hadden ruzie over geld.'));
      expect(ctx.mustMention.some(m => m.includes('herhaald patroon'))).toBe(false);
    });

    it('24. "Hij vergat boodschappen te doen" does NOT trigger repeated harm', () => {
      const ctx = buildKimRelationalFormulationContext(makeInput('Hij vergat boodschappen te doen.'));
      expect(ctx.mustMention.some(m => m.includes('herhaald patroon'))).toBe(false);
    });
  });
});
