import { describe, it, expect } from 'vitest';
import { applyCDP01SafetyFilter } from '@/lib/engine/kim/modules/CODEP-K01/cdp01SafetyFilter';

describe('CDP01 Safety Filter', () => {
  // 1. "codependent" blocked
  it('blocks "codependent" diagnostic label', () => {
    const r = applyCDP01SafetyFilter('Je gedrag is typisch codependent.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('diagnostic_label');
    expect(r.correctedText).toContain('aandacht zo sterk naar de ander');
  });

  // 2. "identity fusion" blocked
  it('blocks "identity fusion" diagnostic label', () => {
    const r = applyCDP01SafetyFilter('This looks like identity fusion with your partner.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('diagnostic_label');
  });

  // 3. "je bestaat alleen door de ander" blocked
  it('blocks existential self-loss language', () => {
    const r = applyCDP01SafetyFilter('Het lijkt alsof je bestaat alleen door de ander.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('self_loss');
    expect(r.correctedText).toContain('eigen ruimte kleiner');
  });

  // 4. "jij bent de redder" blocked
  it('blocks accusatory rescuer label', () => {
    const r = applyCDP01SafetyFilter('Jij bent de redder in deze situatie.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('rescuer');
    expect(r.correctedText).toContain('veel probeert te dragen');
  });

  // 5. "jij houdt dit in stand" blocked
  it('blocks "jij houdt dit in stand"', () => {
    const r = applyCDP01SafetyFilter('Door zo te blijven helpen, jij houdt dit in stand.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('rescuer');
  });

  // 6. "je moet loskomen" blocked
  it('blocks decision forcing "je moet loskomen"', () => {
    const r = applyCDP01SafetyFilter('Je moet loskomen van deze relatie.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('decision_forcing');
    expect(r.correctedText).toContain('welke grens jouw eigen regie beschermt');
  });

  // 7. "jij hebt niets verkeerd gedaan" blocked
  it('blocks absolute acquittal', () => {
    const r = applyCDP01SafetyFilter('Jij hebt niets verkeerd gedaan, dit is volledig de schuld van de ander.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('acquittal');
    expect(r.correctedText).toContain('niet verantwoordelijk voor het herstel');
  });

  // 8. "dit is geen liefde meer" blocked
  it('blocks making love suspect', () => {
    const r = applyCDP01SafetyFilter('Dit is geen liefde meer, dit is afhankelijkheid.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('love_suspect');
    expect(r.correctedText).toContain('liefhebt is niet fout');
  });

  // 9. "je bent controlerend" blocked
  it('blocks control demonization', () => {
    const r = applyCDP01SafetyFilter('Je bent controlerend en dat is destructief.');
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('control_demonize');
    expect(r.correctedText).toContain('poging om veiligheid te voelen');
  });

  // 10. safety-case forces no connection
  it('blocks connection forcing at safety', () => {
    const r = applyCDP01SafetyFilter('Blijf beschikbaar voor de ander.', { safetyActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('safety_connection');
    expect(r.correctedText).toContain('veiligheid voor verbinding');
  });

  // 11. RELATIONAL_HARM_PATTERN does not minimize
  it('blocks harm minimization when relational harm active', () => {
    const r = applyCDP01SafetyFilter('Probeer te begrijpen waarom de ander dit doet. Iedereen maakt fouten.', { relationalHarmActive: true });
    expect(r.safe).toBe(false);
    expect(r.categories).toContain('harm_minimization');
    expect(r.correctedText).toContain('herhaalde schade');
  });

  // 12. Normal friction preserves bridge/repair path (safe text passes)
  it('allows relational CDP01 text with bridge/repair path', () => {
    const r = applyCDP01SafetyFilter('Je aandacht gaat sterk naar de ander. Dat zegt iets over je liefde. Tegelijk mag je betrokken blijven zonder jezelf kwijt te raken. Wat is één keuze vandaag die van jou is?');
    expect(r.safe).toBe(true);
    expect(r.correctedText).toBeNull();
  });

  // 13. K05 override remains active (filter does not block boundaries)
  it('does not block boundary statements (K05 handles those)', () => {
    const r = applyCDP01SafetyFilter('Ik wil niet meer dat de ander mij belt na middernacht. Dit is mijn grens.');
    expect(r.safe).toBe(true);
  });

  // 14. No fixed person names in fallbacks
  it('fallback texts contain no fixed person names', () => {
    const r = applyCDP01SafetyFilter('Je bent codependent en jij houdt dit in stand.');
    expect(r.safe).toBe(false);
    expect(r.correctedText).not.toMatch(/\b(Kris|Melissa|Jan|Piet|Marie|Lisa)\b/);
  });

  // 15. No diagnosis in fallbacks
  it('fallback texts contain no diagnostic labels', () => {
    const r = applyCDP01SafetyFilter('Dit is identity fusion met trauma bond.');
    expect(r.safe).toBe(false);
    expect(r.correctedText).not.toMatch(/\b(codependent|identity fusion|trauma bond|symbiose)\b/i);
  });

  // 16. Harm minimization NOT blocked when harm flag is false
  it('allows perspective language when relational harm is NOT active', () => {
    const r = applyCDP01SafetyFilter('Probeer te begrijpen waarom de ander dit doet.', { relationalHarmActive: false });
    expect(r.safe).toBe(true);
  });
});
