import { describe, it, expect } from 'vitest';
import { applyVETR01SafetyFilter } from '@/lib/engine/kim/modules/vetr01/vetr01-safety-filter';

describe('VETR01 Safety Filter', () => {
  it('1. blocks "je moet vergeven"', () => {
    const r = applyVETR01SafetyFilter('Je moet leren vergeven om verder te gaan.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('forced_forgiveness');
    expect(r.correctedText).toContain('Vergeving hoeft niet geforceerd');
  });

  it('2. blocks "je moet opnieuw vertrouwen"', () => {
    const r = applyVETR01SafetyFilter('Je moet opnieuw vertrouwen geven.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('forced_trust');
    expect(r.correctedText).toContain('woorden en gedrag herhaald overeenkomen');
  });

  it('3. blocks "vertrouwen is kapot"', () => {
    const r = applyVETR01SafetyFilter('Vertrouwen is kapot na wat er gebeurd is.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('cynical_distance');
    expect(r.correctedText).toContain('herstelvoorwaarden');
  });

  it('4. blocks "als je liefhebt moet je openstaan"', () => {
    const r = applyVETR01SafetyFilter('Als je liefhebt moet je openstaan voor de ander.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('forced_trust');
  });

  it('5. allows repair conditions framing', () => {
    const r = applyVETR01SafetyFilter('Vertrouwen groeit pas wanneer woorden en gedrag herhaald overeenkomen. Grenzen kunnen vertrouwen beschermen terwijl het opnieuw wordt opgebouwd.');
    expect(r.safe).toBe(true);
  });

  it('6. repeated trust damage uses repair conditions (RELATIONAL_HARM_PATTERN)', () => {
    const r = applyVETR01SafetyFilter('Kijk ook naar de kant van de ander, misschien bedoelde de ander het niet zo.', { relationalHarmActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('harm_minimization');
    expect(r.correctedText).toContain('herhaalde schade');
  });

  it('7. safety-case forces no connection', () => {
    const r = applyVETR01SafetyFilter('Houd de brug open naar de ander.', { safetyActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('safety_connection');
    expect(r.correctedText).toContain('veiligheid voor verbinding');
  });

  it('8. K05 override remains active (boundaries pass filter)', () => {
    const r = applyVETR01SafetyFilter('Ik wil duidelijkheid over wat er verandert voordat ik opnieuw vertrouw.');
    expect(r.safe).toBe(true);
  });

  it('9. no fixed person names in fallback', () => {
    const r = applyVETR01SafetyFilter('Je moet vergeven.');
    expect(r.correctedText).not.toMatch(/\b(Kris|Melissa|Jan|Piet)\b/);
  });

  it('10. no diagnosis', () => {
    const r = applyVETR01SafetyFilter('De ander is een narcist die je vertrouwen vernietigt.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('diagnosis');
  });

  it('11. no demonization', () => {
    const r = applyVETR01SafetyFilter('De ander heeft jou kapotgemaakt.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('demonization');
  });

  it('12. no absolute acquittal', () => {
    const r = applyVETR01SafetyFilter('Jij hebt niets verkeerd gedaan in dit alles.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('acquittal');
  });

  it('13. blocks "geef het tijd en laat het los"', () => {
    const r = applyVETR01SafetyFilter('Geef het tijd en laat het los.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('forced_trust');
  });
});
