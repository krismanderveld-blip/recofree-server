import { describe, it, expect } from 'vitest';
import { applyPAR01SafetyFilter } from '@/lib/engine/kim/modules/par01/par01-safety-filter';

describe('PAR01 Safety Filter', () => {
  it('1. blocks "jij bent de ouder geworden"', () => {
    const r = applyPAR01SafetyFilter('Jij bent de ouder geworden in deze relatie.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('role_labeling');
    expect(r.correctedText).toContain('rol draagt die te zwaar wordt');
  });

  it('2. blocks "jij bent de redder"', () => {
    const r = applyPAR01SafetyFilter('Jij bent de redder en dat kost je alles.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('role_labeling');
  });

  it('3. blocks "jij houdt dit systeem overeind"', () => {
    const r = applyPAR01SafetyFilter('Jij houdt dit systeem overeind terwijl niemand het ziet.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('role_labeling');
  });

  it('4. parentification reframed as too-heavy role, not label', () => {
    const r = applyPAR01SafetyFilter('Je lijkt een rol te dragen die te zwaar wordt. Dat zegt iets over hoeveel je probeert te zorgen.');
    expect(r.safe).toBe(true);
  });

  it('5. normal friction keeps bridge/repair path', () => {
    const r = applyPAR01SafetyFilter('Je mag betrokken blijven zonder hulpverlener of controleur te worden.');
    expect(r.safe).toBe(true);
  });

  it('6. RELATIONAL_HARM_PATTERN uses repair conditions', () => {
    const r = applyPAR01SafetyFilter('Kijk ook naar de kant van de ander, misschien bedoelde de ander het niet zo.', { relationalHarmActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('harm_minimization');
    expect(r.correctedText).toContain('herhaalde schade');
  });

  it('7. safety-first forces no connection', () => {
    const r = applyPAR01SafetyFilter('Houd de brug open naar de ander.', { safetyActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('safety_connection');
    expect(r.correctedText).toContain('veiligheid voor verbinding');
  });

  it('8. K05 override remains active (safe text passes through)', () => {
    const r = applyPAR01SafetyFilter('Zorgen mag, maar het hoeft niet allemaal van jou te worden.');
    expect(r.safe).toBe(true);
  });

  it('9. no fixed person names in fallback', () => {
    const r = applyPAR01SafetyFilter('Jij bent de ouder geworden.');
    expect(r.correctedText).not.toMatch(/\b(Kris|Melissa|Jan|Piet)\b/);
  });

  it('10. no diagnosis - blocks "dit is parentificatie"', () => {
    const r = applyPAR01SafetyFilter('Dit is parentificatie en dat is ongezond.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('diagnosis');
  });

  it('11. no demonization', () => {
    const r = applyPAR01SafetyFilter('De ander is het probleem in dit systeem.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('demonization');
  });

  it('12. no absolute acquittal', () => {
    const r = applyPAR01SafetyFilter('Jij hebt niets verkeerd gedaan, dit is niet jouw schuld.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('acquittal');
  });

  it('13. blocks distance push "je moet loskomen uit deze rol"', () => {
    const r = applyPAR01SafetyFilter('Je moet loskomen uit deze rol.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('distance_push');
  });
});
