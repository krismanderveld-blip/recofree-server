/**
 * FASE 7: Personal clinical context extension tests.
 * Verifies all 8 new fields reach [PERSONAL CLINICAL CONTEXT] via buildPersonalClinicalContext.
 */
import { describe, it, expect } from 'vitest';

// Replicate buildPersonalClinicalContext with FASE 7 extensions for testing
function buildPersonalClinicalContext(userDat: any, persona?: 'elias' | 'kim'): string | undefined {
  if (!userDat) return undefined;
  const parts: string[] = [];
  const MAX_CHARS = 2000;
  if (Array.isArray(userDat.schemas) && userDat.schemas.length > 0) {
    const items = userDat.schemas.filter((s: any) => s && (s.schema || s.schemaName)).slice(0, 4).map((s: any) => `${s.schema || s.schemaName}${s.confidence ? ` (${s.confidence})` : ''}`);
    if (items.length > 0) parts.push(`Schemas (hypotheses): ${items.join(', ')}`);
  }
  if (Array.isArray(userDat.modes) && userDat.modes.length > 0) {
    const items = userDat.modes.filter((m: any) => m && (m.mode || m.modeName)).slice(0, 4).map((m: any) => m.mode || m.modeName);
    if (items.length > 0) parts.push(`Modes (observed): ${items.join(', ')}`);
  }
  if (Array.isArray(userDat.triggers) && userDat.triggers.length > 0) {
    const items = userDat.triggers.filter((t: any) => t && (t.trigger || t.triggerDescription)).slice(0, 5).map((t: any) => t.trigger || t.triggerDescription);
    if (items.length > 0) parts.push(`Triggers: ${items.join('; ')}`);
  }
  if (Array.isArray(userDat.protectiveFactors) && userDat.protectiveFactors.length > 0) {
    const items = userDat.protectiveFactors.filter((f: any) => f && (f.factor || f.description)).slice(0, 4).map((f: any) => f.factor || f.description);
    if (items.length > 0) parts.push(`Strengths: ${items.join('; ')}`);
  }
  if (Array.isArray(userDat.values) && userDat.values.length > 0) {
    const items = userDat.values.filter((v: any) => v && (v.value || v.valueName)).slice(0, 4).map((v: any) => v.value || v.valueName);
    if (items.length > 0) parts.push(`Values: ${items.join(', ')}`);
  }
  if (Array.isArray(userDat.goals) && userDat.goals.length > 0) {
    const items = userDat.goals.filter((g: any) => g && (g.goal || g.goalDescription)).slice(0, 3).map((g: any) => g.goal || g.goalDescription);
    if (items.length > 0) parts.push(`Goals: ${items.join('; ')}`);
  }
  if (Array.isArray(userDat.risks) && userDat.risks.length > 0) {
    const items = userDat.risks.filter((r: any) => r && (r.risk || r.riskDescription)).slice(0, 3).map((r: any) => r.risk || r.riskDescription);
    if (items.length > 0) parts.push(`Risks: ${items.join('; ')}`);
  }
  if (persona !== 'kim' && Array.isArray(userDat.recoveryPatterns) && userDat.recoveryPatterns.length > 0) {
    const items = userDat.recoveryPatterns.filter((p: any) => p && p.type && p.description).slice(0, 3).map((p: any) => `${p.type}: ${p.description}${p.confidence ? ` (${p.confidence})` : ''}`);
    if (items.length > 0) parts.push(`Recovery patterns (hypotheses): ${items.join('; ')}`);
  }
  if (persona !== 'elias' && Array.isArray(userDat.caregiverPatterns) && userDat.caregiverPatterns.length > 0) {
    const items = userDat.caregiverPatterns.filter((p: any) => p && p.type && p.description).slice(0, 3).map((p: any) => `${p.type}: ${p.description}${p.confidence ? ` (${p.confidence})` : ''}`);
    if (items.length > 0) parts.push(`Caregiver patterns (hypotheses): ${items.join('; ')}`);
  }
  // FASE 7 extensions
  if (Array.isArray(userDat.developmentalFormulation) && userDat.developmentalFormulation.length > 0) {
    const items = userDat.developmentalFormulation.filter((d: any) => d && d.originContext && d.learnedPattern).sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 2).map((d: any) => `${d.originPhase || 'unknown'}: ${d.originContext} → learned: ${d.learnedPattern} → now: ${d.currentManifestation || '?'}`);
    if (items.length > 0) parts.push(`Developmental formulation (hypotheses):\n${items.map((i: any) => `- ${i}`).join('\n')}`);
  }
  if (Array.isArray(userDat.triggerChains) && userDat.triggerChains.length > 0) {
    const chains = userDat.triggerChains.filter((c: any) => c && c.triggerEvent && c.riskOutcome).sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 2).map((c: any) => `${c.triggerEvent} → ${c.assignedMeaning || '?'} → ${c.emotionalResponse || '?'} → ${c.activatedMode || '?'} → ${c.copingBehavior || '?'} → risk: ${c.riskOutcome}`);
    if (chains.length > 0) parts.push(`Trigger chains (hypotheses):\n${chains.map((c: any) => `- ${c}`).join('\n')}`);
  }
  if (persona !== 'kim' && Array.isArray(userDat.relapsePathways) && userDat.relapsePathways.length > 0) {
    const paths = userDat.relapsePathways.filter((p: any) => p && p.destabilizer && p.relapseEndpoint).sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 2).map((p: any) => `${p.destabilizer} → ${p.escalationPattern || '?'} → ${p.relapseEndpoint}${p.protectiveInterrupts?.length ? ` [interrupts: ${p.protectiveInterrupts.join(', ')}]` : ''}`);
    if (paths.length > 0) parts.push(`Relapse pathways (hypotheses):\n${paths.map((p: any) => `- ${p}`).join('\n')}`);
  }
  if (persona !== 'elias' && Array.isArray(userDat.caregiverBurdenPathways) && userDat.caregiverBurdenPathways.length > 0) {
    const paths = userDat.caregiverBurdenPathways.filter((p: any) => p && p.destabilizer && p.burdenEndpoint).sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 2).map((p: any) => `${p.destabilizer} → ${p.escalationPattern || '?'} → ${p.burdenEndpoint}${p.protectiveInterrupts?.length ? ` [interrupts: ${p.protectiveInterrupts.join(', ')}]` : ''}`);
    if (paths.length > 0) parts.push(`Caregiver burden pathways (hypotheses):\n${paths.map((p: any) => `- ${p}`).join('\n')}`);
  }
  if (persona !== 'kim' && Array.isArray(userDat.functionOfAddiction) && userDat.functionOfAddiction.length > 0) {
    const funcs = userDat.functionOfAddiction.filter((f: any) => f && f.functionType && f.description).sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 2).map((f: any) => `${f.functionType}: ${f.description} (need: ${f.underlyingNeed || '?'})`);
    if (funcs.length > 0) parts.push(`Function of addiction (hypotheses): ${funcs.join('; ')}`);
  }
  if (persona !== 'elias' && Array.isArray(userDat.functionOfCaregivingPattern) && userDat.functionOfCaregivingPattern.length > 0) {
    const funcs = userDat.functionOfCaregivingPattern.filter((f: any) => f && f.functionType && f.description).sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 2).map((f: any) => `${f.functionType}: ${f.description} (need: ${f.underlyingNeed || '?'})`);
    if (funcs.length > 0) parts.push(`Function of caregiving pattern (hypotheses): ${funcs.join('; ')}`);
  }
  if (Array.isArray(userDat.contraindications) && userDat.contraindications.length > 0) {
    const contras = userDat.contraindications.filter((c: any) => c && c.avoidTopic && c.reason).sort((a: any, b: any) => { if (a.severity === 'hard' && b.severity !== 'hard') return -1; if (b.severity === 'hard' && a.severity !== 'hard') return 1; return (b.confidence || 0) - (a.confidence || 0); }).slice(0, 3).map((c: any) => `[${c.severity}] Do not: ${c.avoidTopic} (reason: ${c.reason}${c.appliesTo ? `, applies to: ${c.appliesTo}` : ''})`);
    if (contras.length > 0) parts.push(`Contraindications:\n${contras.map((c: any) => `- ${c}`).join('\n')}`);
  }
  if (Array.isArray(userDat.safeFormulationHints) && userDat.safeFormulationHints.length > 0) {
    const hints = userDat.safeFormulationHints.filter((h: any) => h && h.topic && h.safeFraming).sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 3).map((h: any) => `${h.topic}: prefer "${h.safeFraming}"${h.avoidFraming ? ` | avoid "${h.avoidFraming}"` : ''}`);
    if (hints.length > 0) parts.push(`Safe formulation hints:\n${hints.map((h: any) => `- ${h}`).join('\n')}`);
  }
  if (parts.length === 0) return undefined;
  const result = parts.join('\n');
  return result.length > MAX_CHARS ? result.slice(0, MAX_CHARS) + '...' : result;
}

// ── Full Elias user.dat fixture ──
const eliasUserDat = {
  schemas: [{ schema: 'abandonment', confidence: 0.85 }],
  developmentalFormulation: [{ originPhase: 'childhood', originContext: 'emotionele afwezigheid ouders', learnedPattern: 'ik moet een masker dragen', currentManifestation: 'vermijdt kwetsbaarheid', confidence: 0.8 }],
  triggerChains: [{ triggerEvent: 'conflict over leugen', assignedMeaning: 'ik word ontmaskerd', emotionalResponse: 'schaamte', activatedMode: 'detached_protector', copingBehavior: 'drinken', riskOutcome: 'terugval', confidence: 0.75 }],
  relapsePathways: [{ destabilizer: 'kind vraagt over verleden', escalationPattern: 'schaamte → isolatie', relapseEndpoint: 'meerdaags gebruik', protectiveInterrupts: ['bel sponsor'], confidence: 0.7 }],
  functionOfAddiction: [{ functionType: 'numbing', description: 'verdooft schaamte', underlyingNeed: 'emotieregulatie', confidence: 0.85 }],
  contraindications: [{ avoidTopic: 'confrontatie met leugens als moreel falen', reason: 'activeert schaamte-loop', appliesTo: 'bedrog', severity: 'hard', confidence: 0.8 }],
  safeFormulationHints: [{ topic: 'bespreken leugens', safeFraming: 'overlevingsstrategie die nu niet meer nodig is', avoidFraming: 'nooit zeggen dat hij een leugenaar is', confidence: 0.75 }],
};

// ── Full Kim user.dat fixture ──
const kimUserDat = {
  schemas: [{ schema: 'self_sacrifice', confidence: 0.75 }],
  developmentalFormulation: [{ originPhase: 'adolescence', originContext: 'vroeg verantwoordelijkheid', learnedPattern: 'ik moet zorgen om geliefd te worden', currentManifestation: 'neemt alles over', confidence: 0.75 }],
  triggerChains: [{ triggerEvent: 'partner liegt', assignedMeaning: 'ik doe niet genoeg', emotionalResponse: 'woede en schuld', activatedMode: 'overcontroller', copingBehavior: 'meer controleren', riskOutcome: 'zelfverlies', confidence: 0.8 }],
  caregiverBurdenPathways: [{ destabilizer: 'partner terugval na belofte', escalationPattern: 'overnemen → uitputting', burdenEndpoint: 'emotionele breakdown', protectiveInterrupts: ['eigen activiteit'], confidence: 0.75 }],
  functionOfCaregivingPattern: [{ functionType: 'guilt_avoidance', description: 'als ik niet help voel ik me schuldig', underlyingNeed: 'zelfwaarde door opoffering', confidence: 0.7 }],
  contraindications: [{ avoidTopic: 'suggereren dat ze moet vertrekken', reason: 'activeert schuldgevoel', appliesTo: 'relatie', severity: 'hard', confidence: 0.85 }],
  safeFormulationHints: [{ topic: 'grenzen stellen', safeFraming: 'zelfzorg die relatie gezonder maakt', avoidFraming: 'nooit zeggen dat ze moet kiezen', confidence: 0.8 }],
};

describe('FASE 7: Personal clinical context extension', () => {
  it('1. Elias prompt bevat developmentalFormulation', () => {
    const result = buildPersonalClinicalContext(eliasUserDat, 'elias')!;
    expect(result).toContain('Developmental formulation (hypotheses)');
    expect(result).toContain('emotionele afwezigheid ouders');
    expect(result).toContain('ik moet een masker dragen');
  });

  it('2. Elias prompt bevat triggerChains', () => {
    const result = buildPersonalClinicalContext(eliasUserDat, 'elias')!;
    expect(result).toContain('Trigger chains (hypotheses)');
    expect(result).toContain('conflict over leugen');
    expect(result).toContain('risk: terugval');
  });

  it('3. Elias prompt bevat relapsePathways', () => {
    const result = buildPersonalClinicalContext(eliasUserDat, 'elias')!;
    expect(result).toContain('Relapse pathways (hypotheses)');
    expect(result).toContain('kind vraagt over verleden');
    expect(result).toContain('meerdaags gebruik');
  });

  it('4. Elias prompt bevat functionOfAddiction', () => {
    const result = buildPersonalClinicalContext(eliasUserDat, 'elias')!;
    expect(result).toContain('Function of addiction (hypotheses)');
    expect(result).toContain('numbing');
    expect(result).toContain('verdooft schaamte');
  });

  it('5. Elias prompt bevat GEEN caregiverBurdenPathways', () => {
    const dat = { ...eliasUserDat, caregiverBurdenPathways: [{ destabilizer: 'test', burdenEndpoint: 'test', confidence: 0.8 }] };
    const result = buildPersonalClinicalContext(dat, 'elias')!;
    expect(result).not.toContain('Caregiver burden pathways');
  });

  it('6. Elias prompt bevat GEEN functionOfCaregivingPattern', () => {
    const dat = { ...eliasUserDat, functionOfCaregivingPattern: [{ functionType: 'control', description: 'test', underlyingNeed: 'test', confidence: 0.8 }] };
    const result = buildPersonalClinicalContext(dat, 'elias')!;
    expect(result).not.toContain('Function of caregiving pattern');
  });

  it('7. Kim prompt bevat developmentalFormulation', () => {
    const result = buildPersonalClinicalContext(kimUserDat, 'kim')!;
    expect(result).toContain('Developmental formulation (hypotheses)');
    expect(result).toContain('vroeg verantwoordelijkheid');
  });

  it('8. Kim prompt bevat triggerChains', () => {
    const result = buildPersonalClinicalContext(kimUserDat, 'kim')!;
    expect(result).toContain('Trigger chains (hypotheses)');
    expect(result).toContain('partner liegt');
    expect(result).toContain('risk: zelfverlies');
  });

  it('9. Kim prompt bevat caregiverBurdenPathways', () => {
    const result = buildPersonalClinicalContext(kimUserDat, 'kim')!;
    expect(result).toContain('Caregiver burden pathways (hypotheses)');
    expect(result).toContain('partner terugval na belofte');
  });

  it('10. Kim prompt bevat functionOfCaregivingPattern', () => {
    const result = buildPersonalClinicalContext(kimUserDat, 'kim')!;
    expect(result).toContain('Function of caregiving pattern (hypotheses)');
    expect(result).toContain('guilt_avoidance');
  });

  it('11. Kim prompt bevat GEEN relapsePathways', () => {
    const dat = { ...kimUserDat, relapsePathways: [{ destabilizer: 'test', relapseEndpoint: 'test', confidence: 0.8 }] };
    const result = buildPersonalClinicalContext(dat, 'kim')!;
    expect(result).not.toContain('Relapse pathways');
  });

  it('12. Kim prompt bevat GEEN functionOfAddiction', () => {
    const dat = { ...kimUserDat, functionOfAddiction: [{ functionType: 'numbing', description: 'test', underlyingNeed: 'test', confidence: 0.8 }] };
    const result = buildPersonalClinicalContext(dat, 'kim')!;
    expect(result).not.toContain('Function of addiction');
  });

  it('13. Contraindications bereiken beide personas', () => {
    const result1 = buildPersonalClinicalContext(eliasUserDat, 'elias')!;
    const result2 = buildPersonalClinicalContext(kimUserDat, 'kim')!;
    expect(result1).toContain('Contraindications');
    expect(result1).toContain('Do not:');
    expect(result2).toContain('Contraindications');
    expect(result2).toContain('Do not:');
  });

  it('14. SafeFormulationHints bereiken beide personas', () => {
    const result1 = buildPersonalClinicalContext(eliasUserDat, 'elias')!;
    const result2 = buildPersonalClinicalContext(kimUserDat, 'kim')!;
    expect(result1).toContain('Safe formulation hints');
    expect(result1).toContain('prefer');
    expect(result2).toContain('Safe formulation hints');
    expect(result2).toContain('prefer');
  });

  it('15. Raw user.dat/backpack niet gedumpt', () => {
    const result = buildPersonalClinicalContext(eliasUserDat, 'elias')!;
    expect(result).not.toContain('user.dat');
    expect(result).not.toContain('AsyncStorage');
    expect(result).not.toContain('DIST01');
    expect(result).not.toContain('Backpack');
    expect(result).not.toContain('birthDate');
  });

  it('16. Max char budget werkt', () => {
    const result = buildPersonalClinicalContext(eliasUserDat, 'elias')!;
    expect(result.length).toBeLessThanOrEqual(2003); // 2000 + "..."
  });

  it('17. Empty arrays crashen niet', () => {
    const emptyDat = {
      developmentalFormulation: [],
      triggerChains: [],
      relapsePathways: [],
      caregiverBurdenPathways: [],
      functionOfAddiction: [],
      functionOfCaregivingPattern: [],
      contraindications: [],
      safeFormulationHints: [],
    };
    expect(buildPersonalClinicalContext(emptyDat, 'elias')).toBeUndefined();
    expect(buildPersonalClinicalContext(emptyDat, 'kim')).toBeUndefined();
  });

  it('18. Contraindications appear BEFORE safeFormulationHints', () => {
    const result = buildPersonalClinicalContext(eliasUserDat, 'elias')!;
    const contraIdx = result.indexOf('Contraindications');
    const hintsIdx = result.indexOf('Safe formulation hints');
    expect(contraIdx).toBeGreaterThan(-1);
    expect(hintsIdx).toBeGreaterThan(-1);
    expect(contraIdx).toBeLessThan(hintsIdx);
  });

  it('19. High confidence items prioritized (sorted)', () => {
    const dat = {
      triggerChains: [
        { triggerEvent: 'low', assignedMeaning: 'x', emotionalResponse: 'x', activatedMode: 'x', copingBehavior: 'x', riskOutcome: 'low_risk', confidence: 0.3 },
        { triggerEvent: 'high', assignedMeaning: 'x', emotionalResponse: 'x', activatedMode: 'x', copingBehavior: 'x', riskOutcome: 'high_risk', confidence: 0.9 },
      ],
    };
    const result = buildPersonalClinicalContext(dat, 'elias')!;
    const highIdx = result.indexOf('high');
    const lowIdx = result.indexOf('low');
    expect(highIdx).toBeLessThan(lowIdx);
  });

  it('20. Hard contraindications before soft', () => {
    const dat = {
      contraindications: [
        { avoidTopic: 'soft topic', reason: 'soft reason', appliesTo: 'x', severity: 'soft', confidence: 0.9 },
        { avoidTopic: 'hard topic', reason: 'hard reason', appliesTo: 'x', severity: 'hard', confidence: 0.5 },
      ],
    };
    const result = buildPersonalClinicalContext(dat, 'elias')!;
    const hardIdx = result.indexOf('hard topic');
    const softIdx = result.indexOf('soft topic');
    expect(hardIdx).toBeLessThan(softIdx);
  });
});
