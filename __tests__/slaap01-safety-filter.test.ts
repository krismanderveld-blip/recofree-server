import { describe, it, expect } from 'vitest';
import { applySLAAP01SafetyFilter } from '@/lib/engine/kim/modules/slaap01/slaap01-safety-filter';

describe('SLAAP01 Safety Filter', () => {
  it('1. allows relational sleep advice without distance', () => {
    const r = applySLAAP01SafetyFilter('Rust kan helpen om morgen helderder en veiliger te spreken.');
    expect(r.safe).toBe(true);
  });

  it('2. blocks "vermijd de ander voor je rust"', () => {
    const r = applySLAAP01SafetyFilter('Vermijd de ander voor je rust vanavond.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('sleep_avoidance');
    expect(r.correctedText).toContain('systeem eerst kalmeert');
  });

  it('3. blocks "laat het los en slaap"', () => {
    const r = applySLAAP01SafetyFilter('Laat het los en slaap er een nachtje over.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('sleep_avoidance');
  });

  it('4. normal friction keeps possibility of calmer contact later', () => {
    const r = applySLAAP01SafetyFilter('Je hoeft dit vannacht niet op te lossen. Morgen kan je rustiger kijken wat je wilt zeggen.');
    expect(r.safe).toBe(true);
  });

  it('5. RELATIONAL_HARM_PATTERN does not minimize damage', () => {
    const r = applySLAAP01SafetyFilter('Kijk ook naar de kant van de ander en slaap er een nachtje over.', { relationalHarmActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('harm_minimization');
    expect(r.correctedText).toContain('herhaalde schade');
  });

  it('6. safety-first overrides sleep advice', () => {
    const r = applySLAAP01SafetyFilter('Blijf beschikbaar en probeer te slapen.', { safetyActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('safety_connection');
    expect(r.correctedText).toContain('veiligheid voor slapen');
  });

  it('7. K05 override active when boundary without repair path', () => {
    const r = applySLAAP01SafetyFilter('Ik wil vannacht rust en morgen kijken of we hier rustiger over kunnen praten.');
    expect(r.safe).toBe(true);
  });

  it('8. no fixed person names in fallback', () => {
    const r = applySLAAP01SafetyFilter('Vermijd de ander voor je rust.');
    expect(r.correctedText).not.toMatch(/\b(Kris|Melissa|Jan|Piet)\b/);
  });

  it('9. no diagnosis', () => {
    const r = applySLAAP01SafetyFilter('De ander is een narcist die je wakker houdt.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('diagnosis');
  });

  it('10. blocks "denk er gewoon niet meer aan"', () => {
    const r = applySLAAP01SafetyFilter('Denk er gewoon niet meer aan en ga slapen.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('sleep_avoidance');
  });
});
