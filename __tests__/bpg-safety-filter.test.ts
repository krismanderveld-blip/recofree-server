import { describe, it, expect } from 'vitest';
import { applyBPGSafetyFilter } from '@/lib/engine/kim/modules/bedr01-par01-gasl01-safety-filter';

// ═══ BEDR01 Tests ═══
describe('BPG Safety Filter: BEDR01', () => {
  it('blocks "een bedrieger verandert niet"', () => {
    const r = applyBPGSafetyFilter('Een bedrieger verandert niet, dat weet je.', 'BEDR01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('module_specific');
    expect(r.correctedText).toContain('echte schade');
  });

  it('blocks "dit toont wie de ander echt is"', () => {
    const r = applyBPGSafetyFilter('Dit toont wie de ander echt is.', 'BEDR01');
    expect(r.safe).toBe(false);
  });

  it('blocks forced forgiveness', () => {
    const r = applyBPGSafetyFilter('Je moet dit vergeven om verder te kunnen.', 'BEDR01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('module_specific');
  });

  it('blocks minimizing with addiction excuse', () => {
    const r = applyBPGSafetyFilter('Neem het niet persoonlijk, het is de verslaving.', 'BEDR01');
    expect(r.safe).toBe(false);
  });

  it('allows pain validation without demonizing', () => {
    const r = applyBPGSafetyFilter('Dit is echte schade. Je pijn hoeft niet kleiner gemaakt te worden. Er hoeft nu niets besloten te worden.', 'BEDR01');
    expect(r.safe).toBe(true);
  });

  it('RELATIONAL_HARM_PATTERN uses repair conditions', () => {
    const r = applyBPGSafetyFilter('Het kwam door de verslaving, probeer het te begrijpen.', 'BEDR01', { relationalHarmActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('harm_minimization');
    expect(r.correctedText).toContain('herhaalde schade');
  });

  it('safety-first blocks connection forcing', () => {
    const r = applyBPGSafetyFilter('Blijf beschikbaar voor de ander.', 'BEDR01', { safetyActive: true });
    expect(r.safe).toBe(false);
    expect(r.correctedText).toContain('veiligheid voor verbinding');
  });

  it('blocks demonization', () => {
    const r = applyBPGSafetyFilter('De ander heeft jou kapotgemaakt.', 'BEDR01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('demonization');
  });

  it('blocks absolute acquittal', () => {
    const r = applyBPGSafetyFilter('Jij hebt niets verkeerd gedaan.', 'BEDR01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('acquittal');
  });

  it('no fixed person names in fallback', () => {
    const r = applyBPGSafetyFilter('Een bedrieger verandert niet.', 'BEDR01');
    expect(r.correctedText).not.toMatch(/\b(Kris|Melissa|Jan|Piet)\b/);
  });
});

// ═══ PAR01 Tests ═══
describe('BPG Safety Filter: PAR01', () => {
  it('blocks "je moet dit controleren"', () => {
    const r = applyBPGSafetyFilter('Je moet dit controleren om zekerheid te krijgen.', 'PAR01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('module_specific');
    expect(r.correctedText).toContain('onrust voelt echt');
  });

  it('blocks "check zijn/haar telefoon"', () => {
    const r = applyBPGSafetyFilter('Check zijn telefoon als je twijfelt.', 'PAR01');
    expect(r.safe).toBe(false);
  });

  it('blocks "volg je gevoel het klopt vast"', () => {
    const r = applyBPGSafetyFilter('Volg je gevoel, het klopt vast.', 'PAR01');
    expect(r.safe).toBe(false);
  });

  it('blocks "je bent paranoïde"', () => {
    const r = applyBPGSafetyFilter('Je bent paranoïde, er is niets aan de hand.', 'PAR01');
    expect(r.safe).toBe(false);
  });

  it('blocks "je beeldt je dit in"', () => {
    const r = applyBPGSafetyFilter('Je beeldt je dit in.', 'PAR01');
    expect(r.safe).toBe(false);
  });

  it('allows distinguishing feeling from fact', () => {
    const r = applyBPGSafetyFilter('Je onrust voelt echt. Wat weet je zeker en wat vermoed je? Welke duidelijkheid zou helpen zonder controle?', 'PAR01');
    expect(r.safe).toBe(true);
  });

  it('RELATIONAL_HARM_PATTERN uses repair conditions', () => {
    const r = applyBPGSafetyFilter('Misschien bedoelde de ander het niet zo.', 'PAR01', { relationalHarmActive: true });
    expect(r.safe).toBe(false);
    expect(r.correctedText).toContain('herhaalde schade');
  });

  it('safety-first blocks connection', () => {
    const r = applyBPGSafetyFilter('Zoek verbinding met de ander.', 'PAR01', { safetyActive: true });
    expect(r.safe).toBe(false);
    expect(r.correctedText).toContain('veiligheid voor verbinding');
  });

  it('blocks diagnosis', () => {
    const r = applyBPGSafetyFilter('De ander is een narcist.', 'PAR01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('diagnosis');
  });

  it('blocks decision forcing', () => {
    const r = applyBPGSafetyFilter('Je moet weggaan uit deze situatie.', 'PAR01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('decision_forcing');
  });
});

// ═══ GASL01 Tests ═══
describe('BPG Safety Filter: GASL01', () => {
  it('blocks "de ander gaslight jou zeker"', () => {
    const r = applyBPGSafetyFilter('De ander gaslight jou zeker.', 'GASL01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('module_specific');
    expect(r.correctedText).toContain('ernstig als je aan je eigen waarneming');
  });

  it('blocks "de ander probeert je gek te maken"', () => {
    const r = applyBPGSafetyFilter('De ander probeert je gek te maken.', 'GASL01');
    expect(r.safe).toBe(false);
  });

  it('blocks "dit is psychisch misbruik zonder twijfel"', () => {
    const r = applyBPGSafetyFilter('Dit is psychisch misbruik zonder twijfel.', 'GASL01');
    expect(r.safe).toBe(false);
  });

  it('blocks "jouw gevoel is altijd de waarheid"', () => {
    const r = applyBPGSafetyFilter('Jouw gevoel is altijd de waarheid.', 'GASL01');
    expect(r.safe).toBe(false);
  });

  it('blocks minimizing ("dat is niet zo erg")', () => {
    const r = applyBPGSafetyFilter('Dat is niet zo erg, maak je niet druk.', 'GASL01');
    expect(r.safe).toBe(false);
  });

  it('blocks confirming other version ("misschien heeft hij/zij gelijk")', () => {
    const r = applyBPGSafetyFilter('Misschien heeft hij gelijk en zie je het verkeerd.', 'GASL01');
    expect(r.safe).toBe(false);
  });

  it('allows fact anchoring without labeling', () => {
    const r = applyBPGSafetyFilter('Het is ernstig als je aan je eigen waarneming begint te twijfelen. We hoeven geen intentie in te vullen. Wat is gezegd en wat werd ontkend?', 'GASL01');
    expect(r.safe).toBe(true);
  });

  it('RELATIONAL_HARM_PATTERN uses repair conditions', () => {
    const r = applyBPGSafetyFilter('Iedereen maakt fouten, kijk ook naar de kant van de ander.', 'GASL01', { relationalHarmActive: true });
    expect(r.safe).toBe(false);
    expect(r.correctedText).toContain('herhaalde schade');
  });

  it('safety-first blocks connection', () => {
    const r = applyBPGSafetyFilter('Houd de brug open naar de ander.', 'GASL01', { safetyActive: true });
    expect(r.safe).toBe(false);
    expect(r.correctedText).toContain('veiligheid voor verbinding');
  });

  it('blocks demonization across all', () => {
    const r = applyBPGSafetyFilter('De ander is het probleem.', 'GASL01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('demonization');
  });
});

// ═══ General Tests ═══
describe('BPG Safety Filter: General', () => {
  it('module-specific patterns only trigger for correct module', () => {
    // BEDR01 pattern should not trigger for GASL01
    const r = applyBPGSafetyFilter('Een bedrieger verandert niet.', 'GASL01');
    expect(r.safe).toBe(true); // GASL01 doesn't have this pattern
  });

  it('shared demonization blocks across all modules', () => {
    for (const mod of ['BEDR01', 'PAR01', 'GASL01'] as const) {
      const r = applyBPGSafetyFilter('De ander heeft jou kapotgemaakt.', mod);
      expect(r.safe).toBe(false);
      expect(r.categories).toContain('demonization');
    }
  });

  it('shared acquittal blocks across all modules', () => {
    for (const mod of ['BEDR01', 'PAR01', 'GASL01'] as const) {
      const r = applyBPGSafetyFilter('Jij bent volledig slachtoffer.', mod);
      expect(r.safe).toBe(false);
      expect(r.categories).toContain('acquittal');
    }
  });

  it('K05 override remains active (boundaries pass filter)', () => {
    const r = applyBPGSafetyFilter('Ik wil niet dat dit nog een keer gebeurt zonder dat we erover praten.', 'BEDR01');
    expect(r.safe).toBe(true);
  });

  it('safety-first is highest priority fallback', () => {
    const r = applyBPGSafetyFilter('Blijf beschikbaar. Een bedrieger verandert niet.', 'BEDR01', { safetyActive: true });
    expect(r.safe).toBe(false);
    expect(r.correctedText).toContain('veiligheid voor verbinding');
  });
});
