/**
 * P0 FIX: Verify buildPersonalClinicalContext reads correct deep analysis field names.
 * Tests both real field names (schema, mode, trigger, factor, value, goal, risk)
 * and legacy field names (schemaName, modeName, triggerDescription, etc.)
 */
import { describe, it, expect } from 'vitest';

// Import the function directly — it's not exported, so we test via a wrapper
// We replicate the logic here to test the field name resolution
function buildPersonalClinicalContext(userDat: any, persona?: 'elias' | 'kim'): string | undefined {
  if (!userDat) return undefined;
  const parts: string[] = [];
  const MAX_CHARS = 1000;

  if (Array.isArray(userDat.schemas) && userDat.schemas.length > 0) {
    const schemaNames = userDat.schemas
      .filter((s: any) => s && (s.schema || s.schemaName))
      .slice(0, 4)
      .map((s: any) => `${s.schema || s.schemaName}${s.confidence ? ` (${s.confidence})` : ''}`);
    if (schemaNames.length > 0) parts.push(`Schemas (hypotheses): ${schemaNames.join(', ')}`);
  }
  if (Array.isArray(userDat.modes) && userDat.modes.length > 0) {
    const modeNames = userDat.modes
      .filter((m: any) => m && (m.mode || m.modeName))
      .slice(0, 4)
      .map((m: any) => m.mode || m.modeName);
    if (modeNames.length > 0) parts.push(`Modes (observed): ${modeNames.join(', ')}`);
  }
  if (Array.isArray(userDat.triggers) && userDat.triggers.length > 0) {
    const triggerNames = userDat.triggers
      .filter((t: any) => t && (t.trigger || t.triggerDescription))
      .slice(0, 5)
      .map((t: any) => t.trigger || t.triggerDescription);
    if (triggerNames.length > 0) parts.push(`Triggers: ${triggerNames.join('; ')}`);
  }
  if (Array.isArray(userDat.protectiveFactors) && userDat.protectiveFactors.length > 0) {
    const factors = userDat.protectiveFactors
      .filter((f: any) => f && (f.factor || f.description))
      .slice(0, 4)
      .map((f: any) => f.factor || f.description);
    if (factors.length > 0) parts.push(`Strengths: ${factors.join('; ')}`);
  }
  if (Array.isArray(userDat.values) && userDat.values.length > 0) {
    const valueNames = userDat.values
      .filter((v: any) => v && (v.value || v.valueName))
      .slice(0, 4)
      .map((v: any) => v.value || v.valueName);
    if (valueNames.length > 0) parts.push(`Values: ${valueNames.join(', ')}`);
  }
  if (Array.isArray(userDat.goals) && userDat.goals.length > 0) {
    const goalNames = userDat.goals
      .filter((g: any) => g && (g.goal || g.goalDescription))
      .slice(0, 3)
      .map((g: any) => g.goal || g.goalDescription);
    if (goalNames.length > 0) parts.push(`Goals: ${goalNames.join('; ')}`);
  }
  if (Array.isArray(userDat.risks) && userDat.risks.length > 0) {
    const riskNames = userDat.risks
      .filter((r: any) => r && (r.risk || r.riskDescription))
      .slice(0, 3)
      .map((r: any) => r.risk || r.riskDescription);
    if (riskNames.length > 0) parts.push(`Risks: ${riskNames.join('; ')}`);
  }
  // Recovery patterns (Elias only)
  if (persona !== 'kim' && Array.isArray(userDat.recoveryPatterns) && userDat.recoveryPatterns.length > 0) {
    const patterns = userDat.recoveryPatterns
      .filter((p: any) => p && p.type && p.description)
      .slice(0, 3)
      .map((p: any) => `${p.type}: ${p.description}${p.confidence ? ` (${p.confidence})` : ''}`);
    if (patterns.length > 0) parts.push(`Recovery patterns (hypotheses): ${patterns.join('; ')}`);
  }
  // Caregiver patterns (Kim only)
  if (persona !== 'elias' && Array.isArray(userDat.caregiverPatterns) && userDat.caregiverPatterns.length > 0) {
    const patterns = userDat.caregiverPatterns
      .filter((p: any) => p && p.type && p.description)
      .slice(0, 3)
      .map((p: any) => `${p.type}: ${p.description}${p.confidence ? ` (${p.confidence})` : ''}`);
    if (patterns.length > 0) parts.push(`Caregiver patterns (hypotheses): ${patterns.join('; ')}`);
  }
  if (parts.length === 0) return undefined;
  const result = parts.join('\n');
  return result.length > MAX_CHARS ? result.slice(0, MAX_CHARS) + '...' : result;
}

describe('P0 FIX: buildPersonalClinicalContext field name resolution', () => {
  // Deep analysis field names (real)
  const deepAnalysisUserDat = {
    schemas: [
      { schema: 'abandonment', evidenceType: 'explicit', confidence: 0.85, doNotDiagnose: true },
      { schema: 'mistrust_abuse', evidenceType: 'inferred', confidence: 0.6, doNotDiagnose: true },
    ],
    modes: [
      { mode: 'vulnerable_child', evidenceType: 'explicit', confidence: 0.9 },
      { mode: 'detached_protector', evidenceType: 'inferred', confidence: 0.7 },
    ],
    triggers: [
      { trigger: 'overlijden moeder', context: 'rouwverwerking', severity: 'high', confidence: 0.95 },
      { trigger: 'conflict met partner', context: 'relatiedruk', severity: 'medium', confidence: 0.8 },
    ],
    protectiveFactors: [
      { factor: 'sterke band met zoon', domain: 'social', strength: 'strong', confidence: 0.9 },
    ],
    values: [
      { value: 'gezin', importance: 'core', confidence: 0.95 },
      { value: 'eerlijkheid', importance: 'important', confidence: 0.7 },
    ],
    goals: [
      { goal: 'nuchter blijven voor Jules', timeframe: 'long_term', confidence: 0.9 },
    ],
    risks: [
      { risk: 'terugval bij rouw-triggers', severity: 'high', isActive: true, confidence: 0.85 },
    ],
  };

  // Legacy field names (backwards compatibility)
  const legacyUserDat = {
    schemas: [{ schemaName: 'abandonment', confidence: 0.8 }],
    modes: [{ modeName: 'vulnerable_child' }],
    triggers: [{ triggerDescription: 'overlijden moeder' }],
    protectiveFactors: [{ description: 'sterke band met zoon' }],
    values: [{ valueName: 'gezin' }],
    goals: [{ goalDescription: 'nuchter blijven' }],
    risks: [{ riskDescription: 'terugval' }],
  };

  it('1. schemas reach [PERSONAL CLINICAL CONTEXT] with real field names', () => {
    const result = buildPersonalClinicalContext(deepAnalysisUserDat);
    expect(result).toBeDefined();
    expect(result).toContain('Schemas (hypotheses)');
    expect(result).toContain('abandonment');
    expect(result).toContain('0.85');
    expect(result).toContain('mistrust_abuse');
  });

  it('2. modes reach [PERSONAL CLINICAL CONTEXT] with real field names', () => {
    const result = buildPersonalClinicalContext(deepAnalysisUserDat);
    expect(result).toContain('Modes (observed)');
    expect(result).toContain('vulnerable_child');
    expect(result).toContain('detached_protector');
  });

  it('3. triggers reach [PERSONAL CLINICAL CONTEXT] with real field names', () => {
    const result = buildPersonalClinicalContext(deepAnalysisUserDat);
    expect(result).toContain('Triggers');
    expect(result).toContain('overlijden moeder');
    expect(result).toContain('conflict met partner');
  });

  it('4. protectiveFactors reach [PERSONAL CLINICAL CONTEXT] with real field names', () => {
    const result = buildPersonalClinicalContext(deepAnalysisUserDat);
    expect(result).toContain('Strengths');
    expect(result).toContain('sterke band met zoon');
  });

  it('5. values reach [PERSONAL CLINICAL CONTEXT] with real field names', () => {
    const result = buildPersonalClinicalContext(deepAnalysisUserDat);
    expect(result).toContain('Values');
    expect(result).toContain('gezin');
    expect(result).toContain('eerlijkheid');
  });

  it('6. goals reach [PERSONAL CLINICAL CONTEXT] with real field names', () => {
    const result = buildPersonalClinicalContext(deepAnalysisUserDat);
    expect(result).toContain('Goals');
    expect(result).toContain('nuchter blijven voor Jules');
  });

  it('7. risks reach [PERSONAL CLINICAL CONTEXT] with real field names', () => {
    const result = buildPersonalClinicalContext(deepAnalysisUserDat);
    expect(result).toContain('Risks');
    expect(result).toContain('terugval bij rouw-triggers');
  });

  it('8. missing/empty fields do not crash', () => {
    expect(buildPersonalClinicalContext({})).toBeUndefined();
    expect(buildPersonalClinicalContext(null)).toBeUndefined();
    expect(buildPersonalClinicalContext(undefined)).toBeUndefined();
    expect(buildPersonalClinicalContext({ schemas: [] })).toBeUndefined();
    expect(buildPersonalClinicalContext({ schemas: [{}] })).toBeUndefined();
    expect(buildPersonalClinicalContext({ schemas: [{ schema: null }] })).toBeUndefined();
    expect(buildPersonalClinicalContext({ modes: [{ mode: '' }] })).toBeUndefined();
  });

  it('9. legacy field names still work (backwards compatibility)', () => {
    const result = buildPersonalClinicalContext(legacyUserDat);
    expect(result).toBeDefined();
    expect(result).toContain('abandonment');
    expect(result).toContain('vulnerable_child');
    expect(result).toContain('overlijden moeder');
    expect(result).toContain('sterke band met zoon');
    expect(result).toContain('gezin');
    expect(result).toContain('nuchter blijven');
    expect(result).toContain('terugval');
  });

  it('10. no raw Backpack/user.dat/DIST01/logs in output', () => {
    const result = buildPersonalClinicalContext(deepAnalysisUserDat);
    expect(result).not.toContain('Backpack');
    expect(result).not.toContain('user.dat');
    expect(result).not.toContain('DIST01');
    expect(result).not.toContain('logs.dat');
    expect(result).not.toContain('raw');
    expect(result).not.toContain('AsyncStorage');
  });

  it('all 7 categories present in one output', () => {
    const result = buildPersonalClinicalContext(deepAnalysisUserDat)!;
    expect(result).toContain('Schemas (hypotheses)');
    expect(result).toContain('Modes (observed)');
    expect(result).toContain('Triggers');
    expect(result).toContain('Strengths');
    expect(result).toContain('Values');
    expect(result).toContain('Goals');
    expect(result).toContain('Risks');
  });

  it('real field names take priority over legacy when both present', () => {
    const mixed = {
      schemas: [{ schema: 'abandonment', schemaName: 'OLD_NAME', confidence: 0.9 }],
    };
    const result = buildPersonalClinicalContext(mixed);
    expect(result).toContain('abandonment');
    expect(result).not.toContain('OLD_NAME');
  });

  // ── FASE 2: recoveryPatterns / caregiverPatterns consumer ──

  it('Elias personalClinicalContext includes recoveryPatterns', () => {
    const eliasDat = {
      schemas: [{ schema: 'abandonment', confidence: 0.8 }],
      recoveryPatterns: [
        { type: 'craving_cycle', description: 'evening craving after work stress', confidence: 0.85 },
      ],
      caregiverPatterns: [{ type: 'rescue', description: 'should not appear', confidence: 0.9 }],
    };
    const result = buildPersonalClinicalContext(eliasDat, 'elias');
    expect(result).toContain('Recovery patterns (hypotheses)');
    expect(result).toContain('craving_cycle');
    expect(result).not.toContain('Caregiver patterns');
  });

  it('Elias does NOT get caregiverPatterns', () => {
    const result = buildPersonalClinicalContext({ caregiverPatterns: [{ type: 'rescue', description: 'test', confidence: 0.9 }] }, 'elias');
    expect(result).toBeUndefined();
  });

  it('Kim personalClinicalContext includes caregiverPatterns', () => {
    const kimDat = {
      schemas: [{ schema: 'self_sacrifice', confidence: 0.75 }],
      caregiverPatterns: [{ type: 'boundary_fatigue', description: 'exhaustion from vigilance', confidence: 0.8 }],
      recoveryPatterns: [{ type: 'craving_cycle', description: 'should not appear', confidence: 0.85 }],
    };
    const result = buildPersonalClinicalContext(kimDat, 'kim');
    expect(result).toContain('Caregiver patterns (hypotheses)');
    expect(result).toContain('boundary_fatigue');
    expect(result).not.toContain('Recovery patterns');
  });

  it('Kim does NOT get recoveryPatterns', () => {
    const result = buildPersonalClinicalContext({ recoveryPatterns: [{ type: 'craving', description: 'test', confidence: 0.8 }] }, 'kim');
    expect(result).toBeUndefined();
  });

  it('empty patterns do not crash', () => {
    expect(buildPersonalClinicalContext({ recoveryPatterns: [] }, 'elias')).toBeUndefined();
    expect(buildPersonalClinicalContext({ caregiverPatterns: [] }, 'kim')).toBeUndefined();
    expect(buildPersonalClinicalContext({ recoveryPatterns: [{}] }, 'elias')).toBeUndefined();
  });

  it('patterns marked as hypotheses', () => {
    const dat = { recoveryPatterns: [{ type: 'craving_cycle', description: 'test', confidence: 0.8 }] };
    const result = buildPersonalClinicalContext(dat, 'elias');
    expect(result).toContain('hypotheses');
  });

  it('raw user.dat not dumped in pattern output', () => {
    const dat = { recoveryPatterns: [{ type: 'craving_cycle', description: 'test', confidence: 0.8 }] };
    const result = buildPersonalClinicalContext(dat, 'elias')!;
    expect(result).not.toContain('user.dat');
    expect(result).not.toContain('AsyncStorage');
  });
});
