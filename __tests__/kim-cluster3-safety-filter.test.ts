import { describe, it, expect } from 'vitest';
import { applyKimCluster3RelationalFilter } from '@/lib/engine/kim/modules/relationalDynamicsCluster/kimCluster3SafetyFilter';

// ─── ROL-K01 Tests (5) ──────────────────────────────────────────────────────
describe('Cluster 3 Safety Filter: ROL-K01', () => {
  it('blocks "jij bent de redder" label', () => {
    const result = applyKimCluster3RelationalFilter(
      'Ik zie dat jij bent de redder in deze relatie geworden.',
      'ROL-K01',
    );
    expect(result.safe).toBe(false);
    expect(result.categories).toContain('role_label');
  });

  it('blocks "jij bent de ouder" label', () => {
    const result = applyKimCluster3RelationalFilter(
      'Het lijkt erop dat jij bent de ouder geworden in jullie relatie.',
      'ROL-K01',
    );
    expect(result.safe).toBe(false);
    expect(result.categories).toContain('role_label');
  });

  it('blocks "jij houdt dit in stand"', () => {
    const result = applyKimCluster3RelationalFilter(
      'Door zo te blijven zorgen, jij houdt dit in stand.',
      'ROL-K01',
    );
    expect(result.safe).toBe(false);
    expect(result.categories).toContain('role_label');
  });

  it('allows relational role reflection without labels', () => {
    const result = applyKimCluster3RelationalFilter(
      'Je lijkt een rol te dragen die te zwaar wordt. Liefde kan ongemerkt overgaan in dragen of bewaken. Welke rol is van jou en welke niet?',
      'ROL-K01',
    );
    expect(result.safe).toBe(true);
  });

  it('blocks connection forcing at safety', () => {
    const result = applyKimCluster3RelationalFilter(
      'Probeer toch rustig contact te houden met de ander.',
      'ROL-K01',
      { safetyActive: true },
    );
    expect(result.safe).toBe(false);
    expect(result.categories).toContain('safety_connection_forcing');
  });
});

// ─── VETR02-K Tests (5) ─────────────────────────────────────────────────────
describe('Cluster 3 Safety Filter: VETR02-K', () => {
  it('blocks "je moet vergeven"', () => {
    const result = applyKimCluster3RelationalFilter(
      'Op een gegeven moment je moet vergeven om verder te kunnen.',
      'VETR02-K',
    );
    expect(result.safe).toBe(false);
    expect(result.categories).toContain('trust_forcing');
  });

  it('blocks "je moet opnieuw vertrouwen"', () => {
    const result = applyKimCluster3RelationalFilter(
      'Je moet opnieuw vertrouwen geven aan de ander.',
      'VETR02-K',
    );
    expect(result.safe).toBe(false);
    expect(result.categories).toContain('module_specific');
  });

  it('blocks harm minimization when relational harm active', () => {
    const result = applyKimCluster3RelationalFilter(
      'Probeer ook zijn kant te zien, misschien bedoelde hij het niet zo.',
      'VETR02-K',
      { relationalHarmActive: true },
    );
    expect(result.safe).toBe(false);
    expect(result.categories).toContain('harm_minimization');
  });

  it('allows repair conditions framing', () => {
    const result = applyKimCluster3RelationalFilter(
      'Vertrouwen vraagt erkenning, verantwoordelijkheid, transparantie, herhaling, tijd en grenzen. Verbinding kan pas veiliger worden wanneer herstelvoorwaarden zichtbaar worden.',
      'VETR02-K',
    );
    expect(result.safe).toBe(true);
  });

  it('blocks connection forcing at safety', () => {
    const result = applyKimCluster3RelationalFilter(
      'Blijf beschikbaar voor de ander, ook al voelt het onveilig.',
      'VETR02-K',
      { safetyActive: true },
    );
    expect(result.safe).toBe(false);
    expect(result.categories).toContain('safety_connection_forcing');
  });
});

// ─── LEUGEN-K01 Tests (5) ───────────────────────────────────────────────────
describe('Cluster 3 Safety Filter: LEUGEN-K01', () => {
  it('blocks lie excusing ("het is maar een leugen")', () => {
    const result = applyKimCluster3RelationalFilter(
      'Het is maar een leugen, maak je niet zo druk.',
      'LEUGEN-K01',
    );
    expect(result.safe).toBe(false);
    expect(result.categories).toContain('lie_excusing');
  });

  it('blocks lie demonizing ("een leugenaar verandert niet")', () => {
    const result = applyKimCluster3RelationalFilter(
      'Helaas, een leugenaar verandert niet. Dit is wie de ander is.',
      'LEUGEN-K01',
    );
    expect(result.safe).toBe(false);
    expect(result.categories).toContain('lie_demonizing');
  });

  it('blocks intent attribution ("de ander liegt omdat die jou niet respecteert")', () => {
    const result = applyKimCluster3RelationalFilter(
      'De ander liegt omdat die jou niet respecteert als partner.',
      'LEUGEN-K01',
    );
    expect(result.safe).toBe(false);
    expect(result.categories).toContain('module_specific');
  });

  it('allows impact-first framing for shame lie', () => {
    const result = applyKimCluster3RelationalFilter(
      'De impact van deze leugen op jou is reëel, ongeacht de reden erachter. Wat doet dit met je gevoel van veiligheid in het contact?',
      'LEUGEN-K01',
    );
    expect(result.safe).toBe(true);
  });

  it('blocks demonization even without harm/safety flags', () => {
    const result = applyKimCluster3RelationalFilter(
      'De ander is het probleem hier, niet jij.',
      'LEUGEN-K01',
    );
    expect(result.safe).toBe(false);
    expect(result.categories).toContain('demonization');
  });
});

// ─── General Tests (8) ──────────────────────────────────────────────────────
describe('Cluster 3 Safety Filter: General', () => {
  it('filter runs for ROL-K01', () => {
    const result = applyKimCluster3RelationalFilter('Veilige tekst.', 'ROL-K01');
    expect(result).toHaveProperty('safe');
    expect(result).toHaveProperty('violations');
    expect(result).toHaveProperty('categories');
  });

  it('filter runs for VETR02-K', () => {
    const result = applyKimCluster3RelationalFilter('Veilige tekst.', 'VETR02-K');
    expect(result.safe).toBe(true);
  });

  it('filter runs for LEUGEN-K01', () => {
    const result = applyKimCluster3RelationalFilter('Veilige tekst.', 'LEUGEN-K01');
    expect(result.safe).toBe(true);
  });

  it('K05 override remains active (filter does not interfere with boundary detection)', () => {
    // A boundary without repair path should pass the safety filter (K05 handles that separately)
    const result = applyKimCluster3RelationalFilter(
      'Ik wil niet meer dat de ander mij belt na middernacht. Dit is mijn grens.',
      'ROL-K01',
    );
    expect(result.safe).toBe(true); // Safety filter doesn't block boundaries
  });

  it('RELATIONAL_HARM_PATTERN is not minimized', () => {
    const result = applyKimCluster3RelationalFilter(
      'Misschien was het niet zo bedoeld. Iedereen maakt fouten.',
      'VETR02-K',
      { relationalHarmActive: true },
    );
    expect(result.safe).toBe(false);
    expect(result.categories).toContain('harm_minimization');
  });

  it('safety-first is not overridden by connection forcing', () => {
    const result = applyKimCluster3RelationalFilter(
      'Laat weten dat je er bent voor de ander.',
      'LEUGEN-K01',
      { safetyActive: true },
    );
    expect(result.safe).toBe(false);
    expect(result.categories).toContain('safety_connection_forcing');
  });

  it('no fixed person names in fallback responses', () => {
    // Test that the filter result doesn't contain names (the fallbacks are in ai-chat.ts)
    const result = applyKimCluster3RelationalFilter(
      'Jij bent de redder en je houdt dit in stand.',
      'ROL-K01',
    );
    expect(result.safe).toBe(false);
    // The violations array should not contain person names
    const violationText = result.violations.join(' ');
    expect(violationText).not.toMatch(/\b(Kris|Melissa|Jan|Piet|Marie)\b/);
  });

  it('blocks absolute acquittal across all modules', () => {
    for (const mod of ['ROL-K01', 'VETR02-K', 'LEUGEN-K01'] as const) {
      const result = applyKimCluster3RelationalFilter(
        'Jij hebt niets verkeerd gedaan. Dit ligt helemaal niet bij jou.',
        mod,
      );
      expect(result.safe).toBe(false);
      expect(result.categories).toContain('acquittal');
    }
  });
});
