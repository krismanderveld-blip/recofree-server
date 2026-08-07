/**
 * Cluster 4 Relational Stance Tests
 * ROUW-K01, SCHAAM-K01, HOOP-K01, ISOL-K01
 * 8 tests per module + general tests = 36+ tests
 */
import { describe, it, expect } from 'vitest';
import { buildKimCluster4Payload } from '@/lib/engine/kim/modules/emotionalLossCluster/kimCluster4Payloads';
import type { KimCluster4DetectionResult } from '@/lib/engine/kim/modules/emotionalLossCluster/kimCluster4.types';

// Helper to build a detection result for testing
function makeResult(moduleId: 'HOOP-K01' | 'SCHAAM-K01' | 'ROUW-K01' | 'ISOL-K01'): KimCluster4DetectionResult {
  return {
    moduleId,
    activationStatus: 'ACTIVE',
    confidenceScore: 0.9,
    matchedMarkers: [],
    themes: [],
    responseMode: moduleId === 'HOOP-K01' ? 'ENOUGH_IS_ENOUGH_REFLECTION' : 'SHAME_VALIDATION' as any,
    crisisNumbersToShow: [],
    routeNext: 'NO_MODULE',
    reason: 'test',
  };
}

// ─── ROUW-K01 Tests ─────────────────────────────────────────────

describe('ROUW-K01 — Relational Stance', () => {
  const payload = buildKimCluster4Payload(makeResult('ROUW-K01'));

  it('1. Prompt validates grief for who someone used to be', () => {
    expect(payload.fullPrompt).toContain('grief for who someone used to be');
  });

  it('2. Prompt validates grief for how the relationship used to feel', () => {
    expect(payload.fullPrompt).toContain('grief for how the relationship used to feel');
  });

  it('3. Prompt validates grief for hoped-for future', () => {
    expect(payload.fullPrompt).toContain('grief for the future the user had hoped for');
  });

  it('4. Prompt states grief may exist alongside love', () => {
    expect(payload.fullPrompt).toContain('Grief may exist alongside love');
  });

  it('5. Prompt contains connection question for normal friction', () => {
    expect(payload.fullPrompt).toContain('Are there moments where you still recognize the person you miss');
  });

  it('6. Prompt contains repair conditions for RELATIONAL_HARM_PATTERN', () => {
    expect(payload.fullPrompt).toContain('RELATIONAL_HARM_PATTERN: acknowledge repeated damage');
  });

  it('7. Prompt contains safety rule', () => {
    expect(payload.fullPrompt).toContain('safety first, do not force connection');
  });

  it('8. Forbidden list contains "die persoon bestaat niet meer"', () => {
    expect(payload.forbiddenOutputPatterns).toContain('die persoon bestaat niet meer');
  });

  it('8b. Forbidden list contains "verslaving heeft de echte persoon vervangen"', () => {
    expect(payload.forbiddenOutputPatterns).toContain('verslaving heeft de echte persoon vervangen');
  });

  it('8c. Forbidden list contains "je moet afscheid nemen"', () => {
    expect(payload.forbiddenOutputPatterns).toContain('je moet afscheid nemen');
  });

  it('8d. Prompt contains RELATIONAL CONNECTION CHECK', () => {
    expect(payload.fullPrompt).toContain('RELATIONAL CONNECTION CHECK');
  });
});

// ─── SCHAAM-K01 Tests ───────────────────────────────────────────

describe('SCHAAM-K01 — Relational Stance', () => {
  const payload = buildKimCluster4Payload(makeResult('SCHAAM-K01'));

  it('1. Prompt differentiates shame about other\'s behavior', () => {
    expect(payload.fullPrompt).toContain("shame about the other's behavior");
  });

  it('2. Prompt differentiates shame about own behavior', () => {
    expect(payload.fullPrompt).toContain('shame about own behavior');
  });

  it('3. Prompt differentiates shame about staying', () => {
    expect(payload.fullPrompt).toContain('shame about staying');
  });

  it('4. Prompt differentiates shame about setting boundaries', () => {
    expect(payload.fullPrompt).toContain('shame about setting boundaries');
  });

  it('5. Prompt contains own-contribution question instruction', () => {
    expect(payload.fullPrompt).toContain('gentle own-contribution question');
  });

  it('6. Prompt contains RELATIONAL_HARM_PATTERN instruction', () => {
    expect(payload.fullPrompt).toContain('RELATIONAL_HARM_PATTERN: take shame seriously as signal');
  });

  it('7. Prompt contains safety rule', () => {
    expect(payload.fullPrompt).toContain('safety first, do not force connection');
  });

  it('8. Forbidden list contains "jij hebt niets verkeerd gedaan"', () => {
    expect(payload.forbiddenOutputPatterns).toContain('jij hebt niets verkeerd gedaan');
  });

  it('8b. Forbidden list contains "je moet alleen aan jezelf denken"', () => {
    expect(payload.forbiddenOutputPatterns).toContain('je moet alleen aan jezelf denken');
  });

  it('8c. Prompt contains RELATIONAL CONNECTION CHECK', () => {
    expect(payload.fullPrompt).toContain('RELATIONAL CONNECTION CHECK');
  });
});

// ─── HOOP-K01 Tests ─────────────────────────────────────────────

describe('HOOP-K01 — Relational Stance', () => {
  const payload = buildKimCluster4Payload(makeResult('HOOP-K01'));

  it('1. Prompt differentiates hope for recovery', () => {
    expect(payload.fullPrompt).toContain('Hope for full recovery is different from hope for honesty');
  });

  it('2. Prompt differentiates hope for honesty', () => {
    expect(payload.fullPrompt).toContain('honesty, safe contact, own peace');
  });

  it('3. Prompt differentiates hope for safe contact', () => {
    expect(payload.fullPrompt).toContain('safe contact');
  });

  it('4. Prompt differentiates hope for own peace', () => {
    expect(payload.fullPrompt).toContain('own peace');
  });

  it('5. Prompt contains connection question for normal friction', () => {
    expect(payload.fullPrompt).toContain('What would you want to change in the contact');
  });

  it('6. Prompt contains repair conditions for RELATIONAL_HARM_PATTERN', () => {
    expect(payload.fullPrompt).toContain('RELATIONAL_HARM_PATTERN: link hope to repair conditions');
  });

  it('7. Prompt contains safety rule', () => {
    expect(payload.fullPrompt).toContain('safety first, do not force connection or hope');
  });

  it('8. Forbidden list contains "hoop heeft geen zin meer"', () => {
    expect(payload.forbiddenOutputPatterns).toContain('hoop heeft geen zin meer');
  });

  it('8b. Forbidden list contains "misschien verandert het nooit"', () => {
    expect(payload.forbiddenOutputPatterns).toContain('misschien verandert het nooit');
  });

  it('8c. Prompt contains RELATIONAL CONNECTION CHECK', () => {
    expect(payload.fullPrompt).toContain('RELATIONAL CONNECTION CHECK');
  });
});

// ─── ISOL-K01 Tests ─────────────────────────────────────────────

describe('ISOL-K01 — Relational Stance', () => {
  const payload = buildKimCluster4Payload(makeResult('ISOL-K01'));

  it('1. Prompt differentiates social isolation', () => {
    expect(payload.fullPrompt).toContain('social isolation');
  });

  it('2. Prompt differentiates relational isolation', () => {
    expect(payload.fullPrompt).toContain('relational isolation');
  });

  it('3. Prompt differentiates emotional isolation', () => {
    expect(payload.fullPrompt).toContain('emotional isolation');
  });

  it('4. Prompt differentiates shame-isolation', () => {
    expect(payload.fullPrompt).toContain('shame-isolation');
  });

  it('5. Prompt contains reconnection within relationship instruction', () => {
    expect(payload.fullPrompt).toContain('reconnection within the contact is possible');
  });

  it('6. Prompt states broadening support relieves relationship', () => {
    expect(payload.fullPrompt).toContain('Broadening support relieves the relationship');
  });

  it('7. Prompt contains RELATIONAL_HARM_PATTERN instruction', () => {
    expect(payload.fullPrompt).toContain('RELATIONAL_HARM_PATTERN: acknowledge isolation as protection');
  });

  it('8. Forbidden list contains "de relatie is de oorzaak van je isolatie"', () => {
    expect(payload.forbiddenOutputPatterns).toContain('de relatie is de oorzaak van je isolatie');
  });

  it('8b. Forbidden list contains "zoek steun zodat je de ander minder nodig hebt"', () => {
    expect(payload.forbiddenOutputPatterns).toContain('zoek steun zodat je de ander minder nodig hebt');
  });

  it('8c. Prompt contains RELATIONAL CONNECTION CHECK', () => {
    expect(payload.fullPrompt).toContain('RELATIONAL CONNECTION CHECK');
  });
});

// ─── General Tests ──────────────────────────────────────────────

describe('Cluster 4 — General Relational Stance', () => {
  const modules: Array<'HOOP-K01' | 'SCHAAM-K01' | 'ROUW-K01' | 'ISOL-K01'> = ['HOOP-K01', 'SCHAAM-K01', 'ROUW-K01', 'ISOL-K01'];

  it('No fixed person names in any prompt', () => {
    for (const mod of modules) {
      const payload = buildKimCluster4Payload(makeResult(mod));
      expect(payload.fullPrompt).not.toMatch(/\b(Kris|Melissa|Jan|Piet|Marie|Lisa|Johan|Sophie)\b/);
    }
  });

  it('No demonization language in any prompt', () => {
    for (const mod of modules) {
      const payload = buildKimCluster4Payload(makeResult(mod));
      expect(payload.fullPrompt).toContain('Do not demonize the person with addiction');
    }
  });

  it('No direct relationship decision in any prompt', () => {
    for (const mod of modules) {
      const payload = buildKimCluster4Payload(makeResult(mod));
      expect(payload.fullPrompt).not.toContain('you should leave');
      expect(payload.fullPrompt).not.toContain('you should stay');
    }
  });

  it('Shared forbidden list contains "de ander is het probleem"', () => {
    for (const mod of modules) {
      const payload = buildKimCluster4Payload(makeResult(mod));
      expect(payload.forbiddenOutputPatterns).toContain('de ander is het probleem');
    }
  });

  it('Shared forbidden list contains "jij bent volledig slachtoffer"', () => {
    for (const mod of modules) {
      const payload = buildKimCluster4Payload(makeResult(mod));
      expect(payload.forbiddenOutputPatterns).toContain('jij bent volledig slachtoffer');
    }
  });

  it('All modules have RELATIONAL CONNECTION CHECK', () => {
    for (const mod of modules) {
      const payload = buildKimCluster4Payload(makeResult(mod));
      expect(payload.fullPrompt).toContain('RELATIONAL CONNECTION CHECK');
    }
  });

  it('Safety contract preserved for all modules', () => {
    for (const mod of modules) {
      const payload = buildKimCluster4Payload(makeResult(mod));
      expect(payload.safetyContract.noDiagnosis).toBe(true);
      expect(payload.safetyContract.noLegalAdvice).toBe(true);
      expect(payload.safetyContract.noEliasMemory).toBe(true);
      expect(payload.safetyContract.noForcedDecision).toBe(true);
    }
  });

  it('Suicide risk bridge prompt unchanged', () => {
    const result: KimCluster4DetectionResult = {
      moduleId: 'HOOP-K01',
      activationStatus: 'ACTIVE',
      confidenceScore: 0.95,
      matchedMarkers: [],
      themes: [],
      responseMode: 'SUICIDE_RISK_BRIDGE',
      crisisNumbersToShow: ['1813', '112'],
      routeNext: 'CRISIS-K01',
      reason: 'suicidal ideation detected',
    };
    const payload = buildKimCluster4Payload(result);
    expect(payload.fullPrompt).toContain('CRISIS-K01 is being activated');
    expect(payload.fullPrompt).toContain('1813');
    expect(payload.fullPrompt).toContain('112');
  });
});
