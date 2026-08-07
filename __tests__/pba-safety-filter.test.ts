import { describe, it, expect } from 'vitest';
import { applyPBASafetyFilter } from '@/lib/engine/kim/modules/paal-behe-aanp-safety-filter';

// ═══ PAAL-K01 Tests (7) ═══════════════════════════════════════════════════════
describe('PBA Safety Filter: PAAL-K01', () => {
  it('1. blocks "vervang de ander door andere mensen"', () => {
    const r = applyPBASafetyFilter('Vervang de ander door andere mensen die je wél steunen.', 'PAAL-K01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('module_specific');
    expect(r.correctedText).toContain('vervangt of afschrijft');
  });

  it('2. blocks "je moet onafhankelijk worden van de ander"', () => {
    const r = applyPBASafetyFilter('Je moet onafhankelijk worden van de ander.', 'PAAL-K01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('module_specific');
  });

  it('3. blocks "laat de ander los"', () => {
    const r = applyPBASafetyFilter('Laat de ander los en focus op jezelf.', 'PAAL-K01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('module_specific');
  });

  it('4. allows support broadening framed as relief, not replacement', () => {
    const r = applyPBASafetyFilter('Meer steunpunten maken je niet minder loyaal. Extra steun kan helpen om rustiger in contact te blijven.');
    expect(r.safe).toBe(true);
  });

  it('5. normal friction preserves bridge/repair path', () => {
    const r = applyPBASafetyFilter('Je mag de ander belangrijk blijven vinden én je steun verbreden. Dat ontlast de relatie.', 'PAAL-K01');
    expect(r.safe).toBe(true);
  });

  it('6. safety-case forces no connection', () => {
    const r = applyPBASafetyFilter('Blijf beschikbaar voor de ander.', 'PAAL-K01', { safetyActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('safety_connection');
    expect(r.correctedText).toContain('veiligheid voor verbinding');
  });

  it('7. RELATIONAL_HARM_PATTERN uses repair conditions', () => {
    const r = applyPBASafetyFilter('Probeer te begrijpen waarom de ander dit doet.', 'PAAL-K01', { relationalHarmActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('harm_minimization');
    expect(r.correctedText).toContain('herhaalde schade');
  });
});

// ═══ BEHE-K01 Tests (7) ═══════════════════════════════════════════════════════
describe('PBA Safety Filter: BEHE-K01', () => {
  it('1. blocks "je bent controlerend"', () => {
    const r = applyPBASafetyFilter('Je bent controlerend en dat schaadt de relatie.', 'BEHE-K01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('module_specific');
    expect(r.correctedText).toContain('poging om veiligheid te voelen');
  });

  it('2. blocks "controle is fout"', () => {
    const r = applyPBASafetyFilter('Controle is fout en je moet ermee stoppen.', 'BEHE-K01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('module_specific');
  });

  it('3. blocks "stop met controleren"', () => {
    const r = applyPBASafetyFilter('Stop met controleren, het helpt niet.', 'BEHE-K01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('module_specific');
  });

  it('4. reframes control as safety attempt', () => {
    const r = applyPBASafetyFilter('Controle lijkt hier een poging om veiligheid te voelen. De vraag is welke duidelijkheid je nodig hebt.', 'BEHE-K01');
    expect(r.safe).toBe(true);
  });

  it('5. does not confirm control as solution', () => {
    const r = applyPBASafetyFilter('Controleren is logisch, blijf dat doen.', 'BEHE-K01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('module_specific');
  });

  it('6. safety-case forces no connection', () => {
    const r = applyPBASafetyFilter('Houd de brug open naar de ander.', 'BEHE-K01', { safetyActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('safety_connection');
    expect(r.correctedText).toContain('veiligheid voor verbinding');
  });

  it('7. RELATIONAL_HARM_PATTERN uses repair conditions', () => {
    const r = applyPBASafetyFilter('Iedereen maakt fouten, kijk ook naar de kant van de ander.', 'BEHE-K01', { relationalHarmActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('harm_minimization');
    expect(r.correctedText).toContain('herhaalde schade');
  });
});

// ═══ AANP-K01 Tests (7) ═══════════════════════════════════════════════════════
describe('PBA Safety Filter: AANP-K01', () => {
  it('1. blocks "stop met aanpassen"', () => {
    const r = applyPBASafetyFilter('Stop met aanpassen, het is genoeg geweest.', 'AANP-K01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('module_specific');
    expect(r.correctedText).toContain('liefdevol zijn');
  });

  it('2. blocks "je laat over je heen lopen"', () => {
    const r = applyPBASafetyFilter('Je laat over je heen lopen door steeds mee te gaan.', 'AANP-K01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('module_specific');
  });

  it('3. blocks "de ander gebruikt jouw aanpassing"', () => {
    const r = applyPBASafetyFilter('De ander gebruikt jouw aanpassing om zijn zin te krijgen.', 'AANP-K01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('module_specific');
  });

  it('4. reframes adjustment as possibly loving but harmful at self-loss', () => {
    const r = applyPBASafetyFilter('Aanpassen kan liefdevol zijn. Maar waar wordt meebewegen zelfverlies? Je hoeft niet hard te worden om eerlijk te zijn.', 'AANP-K01');
    expect(r.safe).toBe(true);
  });

  it('5. normal friction gets honest I-statement + bridge', () => {
    const r = applyPBASafetyFilter('Je mag rekening houden met de ander én jezelf meenemen. Een kleine eerlijke zin kan meer verbinding geven.', 'AANP-K01');
    expect(r.safe).toBe(true);
  });

  it('6. safety-case forces no connection', () => {
    const r = applyPBASafetyFilter('Zoek verbinding met de ander.', 'AANP-K01', { safetyActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('safety_connection');
    expect(r.correctedText).toContain('veiligheid voor verbinding');
  });

  it('7. RELATIONAL_HARM_PATTERN uses repair conditions', () => {
    const r = applyPBASafetyFilter('Liefde vraagt geduld, misschien bedoelde de ander het niet zo.', 'AANP-K01', { relationalHarmActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('harm_minimization');
    expect(r.correctedText).toContain('herhaalde schade');
  });
});

// ═══ General Tests (9) ═══════════════════════════════════════════════════════
describe('PBA Safety Filter: General', () => {
  it('1. filter runs only for correct modules', () => {
    // PAAL pattern should not trigger for BEHE
    const r = applyPBASafetyFilter('Laat de ander los.', 'BEHE-K01');
    // 'laat de ander los' is PAAL-specific, not BEHE
    expect(r.safe).toBe(true); // BEHE doesn't have this pattern
  });

  it('2. no fixed person names in fallbacks', () => {
    const r = applyPBASafetyFilter('Je moet onafhankelijk worden van de ander.', 'PAAL-K01');
    expect(r.correctedText).not.toMatch(/\b(Kris|Melissa|Jan|Piet|Marie|Lisa)\b/);
  });

  it('3. blocks demonization across all modules', () => {
    for (const mod of ['PAAL-K01', 'BEHE-K01', 'AANP-K01'] as const) {
      const r = applyPBASafetyFilter('De ander is het probleem hier.', mod);
      expect(r.safe).toBe(false);
      expect(r.categories).toContain('demonization');
    }
  });

  it('4. blocks diagnosis across all modules', () => {
    for (const mod of ['PAAL-K01', 'BEHE-K01', 'AANP-K01'] as const) {
      const r = applyPBASafetyFilter('Dit lijkt op een trauma bond.', mod);
      expect(r.safe).toBe(false);
      expect(r.categories).toContain('diagnosis');
    }
  });

  it('5. blocks direct relationship decision forcing', () => {
    const r = applyPBASafetyFilter('Je moet weggaan uit deze relatie.', 'PAAL-K01');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('decision_forcing');
  });

  it('6. K05 override remains active (boundaries pass filter)', () => {
    const r = applyPBASafetyFilter('Ik wil niet meer dat de ander mij belt na middernacht.', 'BEHE-K01');
    expect(r.safe).toBe(true);
  });

  it('7. safety-first is highest priority', () => {
    // Safety fallback takes precedence over module fallback
    const r = applyPBASafetyFilter('Blijf beschikbaar voor de ander. Laat de ander los.', 'PAAL-K01', { safetyActive: true });
    expect(r.safe).toBe(false);
    expect(r.correctedText).toContain('veiligheid voor verbinding');
  });

  it('8. RELATIONAL_HARM_PATTERN is not minimized', () => {
    const r = applyPBASafetyFilter('Misschien bedoelde de ander het niet zo.', 'AANP-K01', { relationalHarmActive: true });
    expect(r.safe).toBe(false);
    expect(r.correctedText).toContain('herhaalde schade');
  });

  it('9. acquittal blocked across all modules', () => {
    for (const mod of ['PAAL-K01', 'BEHE-K01', 'AANP-K01'] as const) {
      const r = applyPBASafetyFilter('Jij hebt niets verkeerd gedaan.', mod);
      expect(r.safe).toBe(false);
      expect(r.categories).toContain('acquittal');
    }
  });
});
