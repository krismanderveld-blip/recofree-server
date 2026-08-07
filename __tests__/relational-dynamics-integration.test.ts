import { describe, it, expect } from 'vitest';
import { buildKimCluster3Payload } from '@/lib/engine/kim/modules/relationalDynamicsCluster/kimCluster3Payloads';
import { detectRelationalSignals } from '@/lib/engine/kim/relational-stance-filter';
import { scanLayer1 } from '@/server/k05-cross-module-override';
import type { KimCluster3DetectionResult } from '@/lib/engine/kim/modules/relationalDynamicsCluster/kimCluster3.types';

function makeResult(moduleId: 'ROL-K01' | 'VETR02-K' | 'LEUGEN-K01'): KimCluster3DetectionResult {
  return {
    moduleId,
    activationStatus: 'ACTIVE',
    confidenceScore: 0.9,
    matchedMarkers: [],
    themes: [],
    responseMode: moduleId === 'ROL-K01' ? 'ROLE_DROP_EMOTION_WAVE' :
                  moduleId === 'VETR02-K' ? 'ABSENCE_HYPERVIGILANCE' :
                  'BETRAYAL_PAIN_VALIDATION',
    crisisNumbersToShow: [],
    routeNext: 'NO_MODULE',
    reason: 'test',
  } as unknown as KimCluster3DetectionResult;
}

describe('Test 1: Normal friction with boundary → K05 override', () => {
  it('Boundary without repair path is detected by K05 scanner', () => {
    const result = scanLayer1('Ik wil niet meer dat de ander mij belt na middernacht. Dit is mijn grens.');
    expect(result.boundaryDetected).toBe(true);
    expect(result.repairPathDetected).toBe(false);
  });

  it('Boundary WITH repair path passes K05 scanner', () => {
    const result = scanLayer1('Ik wil niet meer dat de ander mij belt na middernacht. Ik wil wel contact overdag wanneer er rust is.');
    expect(result.boundaryDetected).toBe(true);
    expect(result.repairPathDetected).toBe(true);
  });
});

describe('Test 2: Repeated trust damage → harm pattern', () => {
  it('LEUGEN-K01 prompt contains repair conditions for repeated_trust_damage', () => {
    const payload = buildKimCluster3Payload(makeResult('LEUGEN-K01'));
    expect(payload.fullPrompt).toContain('repeated_trust_damage');
    expect(payload.fullPrompt).toContain('repair conditions');
    expect(payload.fullPrompt).toContain('honesty, responsibility, consistency, time');
  });

  it('VETR02-K prompt contains harm awareness for repeated patterns', () => {
    const payload = buildKimCluster3Payload(makeResult('VETR02-K'));
    expect(payload.fullPrompt).toContain('RELATIONAL HARM AWARENESS');
    expect(payload.fullPrompt).toContain('Do NOT start with perspective-taking');
  });

  it('Relational stance filter detects repeated betrayal signal', () => {
    const signals = detectRelationalSignals('de ander heeft weer gelogen en ik vertrouw niets meer van wat er gezegd wordt');
    expect(signals.partnerJudgmentRisk || signals.repeatedBetrayalSignal).toBe(true);
  });
});

describe('Test 3: Shame avoidance lie', () => {
  it('LEUGEN-K01 prompt contains shame_avoidance_lie category', () => {
    const payload = buildKimCluster3Payload(makeResult('LEUGEN-K01'));
    expect(payload.fullPrompt).toContain('shame_avoidance_lie');
    expect(payload.fullPrompt).toContain('Perspective opening cautiously allowed AFTER impact validation');
  });
});

describe('Test 4: Coercive/dangerous lie → safety-first', () => {
  it('LEUGEN-K01 prompt contains coercive_or_dangerous_lie with safety-first', () => {
    const payload = buildKimCluster3Payload(makeResult('LEUGEN-K01'));
    expect(payload.fullPrompt).toContain('coercive_or_dangerous_lie');
    expect(payload.fullPrompt).toContain('Safety-first');
  });

  it('LEUGEN-K01 RELATIONAL CONNECTION CHECK mentions safety for coercive lies', () => {
    const payload = buildKimCluster3Payload(makeResult('LEUGEN-K01'));
    expect(payload.fullPrompt).toContain('coercive_or_dangerous_lie: safety first');
  });
});

describe('Test 5: Role confusion → no blame, connection preserved', () => {
  it('ROL-K01 does NOT frame as "you are the rescuer"', () => {
    const payload = buildKimCluster3Payload(makeResult('ROL-K01'));
    expect(payload.fullPrompt).not.toContain('jij bent de redder');
    expect(payload.fullPrompt).not.toContain('jij houdt dit in stand');
  });

  it('ROL-K01 validates emotions without shame', () => {
    const payload = buildKimCluster3Payload(makeResult('ROL-K01'));
    expect(payload.fullPrompt).toContain('these emotions are allowed without guilt');
  });

  it('ROL-K01 contains RELATIONAL CONNECTION CHECK', () => {
    const payload = buildKimCluster3Payload(makeResult('ROL-K01'));
    expect(payload.fullPrompt).toContain('RELATIONAL CONNECTION CHECK');
  });
});

describe('Test 6: Trust repair → repair conditions', () => {
  it('VETR02-K requires repair conditions before trust rebuilding', () => {
    const payload = buildKimCluster3Payload(makeResult('VETR02-K'));
    expect(payload.fullPrompt).toContain('Repair conditions may be needed before trust in silence can rebuild');
  });

  it('LEUGEN-K01 template includes acknowledgment, responsibility, transparency, consistency, time', () => {
    const payload = buildKimCluster3Payload(makeResult('LEUGEN-K01'));
    expect(payload.fullPrompt).toContain('acknowledgment, responsibility, transparency, consistency, time');
  });
});

describe('Test 7: Unknown intent → no attribution', () => {
  it('LEUGEN-K01 forbids intent attribution', () => {
    const payload = buildKimCluster3Payload(makeResult('LEUGEN-K01'));
    expect(payload.fullPrompt).toContain('GPT may NEVER independently fill in the intent behind lying');
    expect(payload.fullPrompt).toContain('unknown: Intent unclear. Do NOT fill in intent');
  });

  it('LEUGEN-K01 RELATIONAL CONNECTION CHECK mentions unknown', () => {
    const payload = buildKimCluster3Payload(makeResult('LEUGEN-K01'));
    expect(payload.fullPrompt).toContain('unknown: no intent attribution');
  });
});

describe('Test 8: K05 override corrects boundary without repair path', () => {
  it('K05 scanner detects "ik neem afstand" without repair path', () => {
    const result = scanLayer1('Ik neem afstand van dit contact. Ik kan dit niet meer.');
    expect(result.boundaryDetected).toBe(true);
    expect(result.repairPathDetected).toBe(false);
  });

  it('K05 scanner passes when repair path is present', () => {
    const result = scanLayer1('Ik neem afstand van dit contact. Ik wil wel praten wanneer er eerlijkheid en rust is.');
    expect(result.boundaryDetected).toBe(true);
    expect(result.repairPathDetected).toBe(true);
  });

  it('All three modules have RELATIONAL CONNECTION CHECK', () => {
    for (const mod of ['ROL-K01', 'VETR02-K', 'LEUGEN-K01'] as const) {
      const payload = buildKimCluster3Payload(makeResult(mod));
      expect(payload.fullPrompt).toContain('RELATIONAL CONNECTION CHECK');
    }
  });
});

describe('General: No names, no demonization, no diagnosis', () => {
  it('No fixed person names in any Cluster 3 prompt', () => {
    for (const mod of ['ROL-K01', 'VETR02-K', 'LEUGEN-K01'] as const) {
      const payload = buildKimCluster3Payload(makeResult(mod));
      expect(payload.fullPrompt).not.toMatch(/\b(Kris|Melissa|Jan|Piet|Marie|Lisa|Johan|Sophie)\b/);
    }
  });

  it('No diagnosis labels in any Cluster 3 prompt', () => {
    for (const mod of ['ROL-K01', 'VETR02-K', 'LEUGEN-K01'] as const) {
      const payload = buildKimCluster3Payload(makeResult(mod));
      expect(payload.fullPrompt).toContain('Do not diagnose');
    }
  });

  it('LEUGEN-K01 forbids "pathologische leugenaar"', () => {
    const payload = buildKimCluster3Payload(makeResult('LEUGEN-K01'));
    expect(payload.forbiddenOutput).toContain('hij is pathologische leugenaar');
    expect(payload.forbiddenOutput).toContain('zij is pathologische leugenaar');
  });
});
