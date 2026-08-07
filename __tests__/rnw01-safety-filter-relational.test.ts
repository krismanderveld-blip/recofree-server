/**
 * RNW01 Relational Stance + Safety Filter Tests
 * Tests the rewritten RNW01 prompt and the updated safety filter
 */
import { describe, it, expect } from 'vitest';
import { buildRNW01PromptPayload } from '@/lib/engine/kim/modules/rnw01/rnw01-prompt';
import { applyKimCluster4SafetyFilter } from '@/lib/engine/kim/modules/emotionalLossCluster/kimCluster4SafetyFilter';
import type { RNW01DetectionResult } from '@/lib/engine/kim/modules/rnw01/rnw01-types';

function makeActiveResult(): RNW01DetectionResult {
  return {
    activationStatus: 'ACTIVE',
    confidenceScore: 0.9,
    matchedMarkers: ['grief_for_who_they_were'],
    themes: ['ambiguous_grief'],
    responseMode: 'AMBIGUOUS_GRIEF_VALIDATION',
    routeNext: 'NO_MODULE',
    reason: 'test',
  } as RNW01DetectionResult;
}

// ─── RNW01 Prompt Tests ─────────────────────────────────────────

describe('RNW01 — Relational Stance Prompt', () => {
  const payload = buildRNW01PromptPayload(makeActiveResult())!;

  it('Prompt states grief may exist alongside love', () => {
    expect(payload.fullPrompt).toContain('Grief may exist alongside love');
  });

  it('Prompt states person is still present', () => {
    expect(payload.fullPrompt).toContain('The person with addiction is still present');
  });

  it('Prompt contains grief differentiation', () => {
    expect(payload.fullPrompt).toContain('grief for who someone used to be');
    expect(payload.fullPrompt).toContain('grief for how the relationship used to feel');
    expect(payload.fullPrompt).toContain('grief for the future the user had hoped for');
  });

  it('Prompt contains connection question for normal friction', () => {
    expect(payload.fullPrompt).toContain('Are there moments where you still recognize the person you miss');
  });

  it('Prompt contains RELATIONAL_HARM_PATTERN instructions', () => {
    expect(payload.fullPrompt).toContain('RELATIONAL_HARM_PATTERN: acknowledge repeated damage');
  });

  it('Prompt contains safety rule', () => {
    expect(payload.fullPrompt).toContain('safety first, do not force connection');
  });

  it('Prompt contains RELATIONAL CONNECTION CHECK', () => {
    expect(payload.fullPrompt).toContain('RELATIONAL CONNECTION CHECK');
  });

  it('Prompt forbids demonization', () => {
    expect(payload.fullPrompt).toContain('Do not imply the person with addiction no longer exists');
    expect(payload.fullPrompt).toContain('Do not demonize the person with addiction');
  });

  it('Prompt forbids fixed person names', () => {
    expect(payload.fullPrompt).toContain('Do not use fixed person names');
    expect(payload.fullPrompt).not.toMatch(/\b(Kris|Melissa|Jan|Piet|Marie|Lisa)\b/);
  });

  it('Forbidden output contains demonization phrases', () => {
    expect(payload.forbiddenOutput).toContain('die persoon bestaat niet meer');
    expect(payload.forbiddenOutput).toContain('de oude versie komt niet terug');
    expect(payload.forbiddenOutput).toContain('verslaving heeft de echte persoon vervangen');
    expect(payload.forbiddenOutput).toContain('je moet afscheid nemen');
  });

  it('Forbidden output contains polarization phrases', () => {
    expect(payload.forbiddenOutput).toContain('de ander is het probleem');
    expect(payload.forbiddenOutput).toContain('jij bent volledig slachtoffer');
  });

  it('Allowed language present in prompt', () => {
    expect(payload.fullPrompt).toContain('rouw kan naast liefde bestaan');
    expect(payload.fullPrompt).toContain('iemand kan veranderd zijn zonder volledig verdwenen te zijn');
  });
});

// ─── Safety Filter Tests — Forbidden Output Blocking ────────────

describe('Safety Filter — New Forbidden Items Blocking', () => {
  // ROUW violations
  it('Blocks "die persoon bestaat niet meer"', () => {
    const result = applyKimCluster4SafetyFilter('Ik denk dat die persoon bestaat niet meer voor jou.', 'ROUW-K01');
    expect(result.safe).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('Blocks "de oude versie komt niet terug"', () => {
    const result = applyKimCluster4SafetyFilter('Helaas, de oude versie komt niet terug.', 'ROUW-K01');
    expect(result.safe).toBe(false);
  });

  it('Blocks "verslaving heeft de echte persoon vervangen"', () => {
    const result = applyKimCluster4SafetyFilter('Soms voelt het alsof verslaving heeft de echte persoon vervangen.', 'ROUW-K01');
    expect(result.safe).toBe(false);
  });

  it('Blocks "je moet afscheid nemen"', () => {
    const result = applyKimCluster4SafetyFilter('Misschien is het tijd dat je moet afscheid nemen.', 'ROUW-K01');
    expect(result.safe).toBe(false);
  });

  it('Blocks "misschien moet je verder zonder hen"', () => {
    const result = applyKimCluster4SafetyFilter('Misschien moet je verder zonder hen.', 'ROUW-K01');
    expect(result.safe).toBe(false);
  });

  // SCHAAM violations
  it('Blocks "jij hebt niets verkeerd gedaan"', () => {
    const result = applyKimCluster4SafetyFilter('Jij hebt niets verkeerd gedaan, dit is niet jouw schuld.', 'SCHAAM-K01');
    expect(result.safe).toBe(false);
  });

  it('Blocks "je moet alleen aan jezelf denken"', () => {
    const result = applyKimCluster4SafetyFilter('Je moet alleen aan jezelf denken nu.', 'SCHAAM-K01');
    expect(result.safe).toBe(false);
  });

  // HOOP violations
  it('Blocks "blijf hopen"', () => {
    const result = applyKimCluster4SafetyFilter('Je moet gewoon blijf hopen dat het beter wordt.', 'HOOP-K01');
    expect(result.safe).toBe(false);
  });

  it('Blocks "geef de hoop op"', () => {
    const result = applyKimCluster4SafetyFilter('Misschien is het beter om de hoop op te geven. Geef de hoop op.', 'HOOP-K01');
    expect(result.safe).toBe(false);
  });

  it('Blocks "misschien verandert het nooit"', () => {
    const result = applyKimCluster4SafetyFilter('Misschien verandert het nooit en moet je dat accepteren.', 'HOOP-K01');
    expect(result.safe).toBe(false);
  });

  // ISOL violations
  it('Blocks "zoek steun zodat je de ander minder nodig hebt"', () => {
    const result = applyKimCluster4SafetyFilter('Zoek steun zodat je de ander minder nodig hebt.', 'ISOL-K01');
    expect(result.safe).toBe(false);
  });

  it('Blocks "de relatie is de oorzaak van je isolatie"', () => {
    const result = applyKimCluster4SafetyFilter('De relatie is de oorzaak van je isolatie.', 'ISOL-K01');
    expect(result.safe).toBe(false);
  });

  it('Blocks "laat de ander los"', () => {
    const result = applyKimCluster4SafetyFilter('Misschien moet je laat de ander los en ga verder.', 'ISOL-K01');
    expect(result.safe).toBe(false);
  });

  // Shared violations
  it('Blocks "de ander is het probleem" across all modules', () => {
    for (const mod of ['HOOP-K01', 'SCHAAM-K01', 'ROUW-K01', 'ISOL-K01'] as const) {
      const result = applyKimCluster4SafetyFilter('Eigenlijk is de ander is het probleem hier.', mod);
      expect(result.safe).toBe(false);
    }
  });

  it('Blocks "jij bent volledig slachtoffer" across all modules', () => {
    for (const mod of ['HOOP-K01', 'SCHAAM-K01', 'ROUW-K01', 'ISOL-K01'] as const) {
      const result = applyKimCluster4SafetyFilter('Jij bent volledig slachtoffer in deze situatie.', mod);
      expect(result.safe).toBe(false);
    }
  });

  // Safe output passes
  it('Allows safe relational output', () => {
    const safeOutput = 'Ik hoor dat je iets mist van hoe het vroeger voelde. Rouw kan naast liefde bestaan. Zijn er momenten waarop je nog iets herkent van de persoon die je mist?';
    const result = applyKimCluster4SafetyFilter(safeOutput, 'ROUW-K01');
    expect(result.safe).toBe(true);
  });

  it('Allows safe SCHAAM output with own-contribution question', () => {
    const safeOutput = 'Schaamte is geen vonnis. Je bent niet verantwoordelijk voor het gedrag van de ander, maar je mag wel kijken naar jouw reactie. Wat zou je eigenlijk willen zeggen?';
    const result = applyKimCluster4SafetyFilter(safeOutput, 'SCHAAM-K01');
    expect(result.safe).toBe(true);
  });

  it('Allows safe HOOP output with differentiation', () => {
    const safeOutput = 'Misschien is niet alle hoop hetzelfde. Hoop mag kleiner en concreter worden. Wat zou jij willen dat er concreet verandert?';
    const result = applyKimCluster4SafetyFilter(safeOutput, 'HOOP-K01');
    expect(result.safe).toBe(true);
  });

  it('Allows safe ISOL output with reconnection within relationship', () => {
    const safeOutput = 'Steun buiten de relatie kan de relatie ontlasten. Misschien sta je niet alleen sociaal alleen, maar ook emotioneel in het contact. Een kleine veilige verbinding kan genoeg zijn.';
    const result = applyKimCluster4SafetyFilter(safeOutput, 'ISOL-K01');
    expect(result.safe).toBe(true);
  });
});
