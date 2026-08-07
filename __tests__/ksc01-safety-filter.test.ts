import { describe, it, expect } from 'vitest';
import { applyKSC01SafetyFilter } from '@/lib/engine/kim/modules/ksc01/ksc01-safety-filter';

describe('KSC01 Safety Filter', () => {
  it('1. blocks "laat het los" when relationally closing', () => {
    const r = applyKSC01SafetyFilter('Laat het los en kies voor jezelf.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('relational_avoidance');
    expect(r.correctedText).toContain('mild genoeg blijft om eerlijk te kijken');
  });

  it('2. blocks "jij hebt niets verkeerd gedaan" as absolute acquittal', () => {
    const r = applyKSC01SafetyFilter('Jij hebt niets verkeerd gedaan, dit is niet jouw schuld.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('acquittal');
  });

  it('3. blocks "kies gewoon voor jezelf"', () => {
    const r = applyKSC01SafetyFilter('Kies nu gewoon voor jezelf en laat de rest los.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('relational_avoidance');
  });

  it('4. self-compassion retains soft responsibility', () => {
    const r = applyKSC01SafetyFilter('Je mag mild zijn voor jezelf. Dat betekent niet dat je niets hoeft te bekijken, maar wel dat je het zonder zelfbestraffing kunt doen.');
    expect(r.safe).toBe(true);
  });

  it('5. normal friction keeps bridge/repair path if boundary arises', () => {
    const r = applyKSC01SafetyFilter('Zelfcompassie kan helpen om rustiger en eerlijker in contact te blijven.');
    expect(r.safe).toBe(true);
  });

  it('6. RELATIONAL_HARM_PATTERN is not minimized', () => {
    const r = applyKSC01SafetyFilter('Kijk ook naar de kant van de ander, misschien bedoelde de ander het niet zo.', { relationalHarmActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('harm_minimization');
    expect(r.correctedText).toContain('herhaalde schade');
  });

  it('7. safety-first forces no connection', () => {
    const r = applyKSC01SafetyFilter('Houd de brug open naar de ander.', { safetyActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('safety_connection');
    expect(r.correctedText).toContain('veiligheid voor verbinding');
  });

  it('8. no fixed person names in fallback', () => {
    const r = applyKSC01SafetyFilter('Laat het los.');
    expect(r.correctedText).not.toMatch(/\b(Kris|Melissa|Jan|Piet)\b/);
  });

  it('9. no diagnosis', () => {
    const r = applyKSC01SafetyFilter('De ander is een narcist die je schuld geeft.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('diagnosis');
  });

  it('10. blocks "stop met je schuldig voelen"', () => {
    const r = applyKSC01SafetyFilter('Stop met je schuldig voelen, dit is niet jouw verantwoordelijkheid.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('acquittal');
  });
});
