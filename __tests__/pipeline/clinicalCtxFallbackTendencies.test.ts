/**
 * FIX 1 TESTS: buildPersonalClinicalContext fallback on schemaTendencies/modeTendencies
 * when canonical schemas/modes/triggers are empty.
 */
import { describe, it, expect } from 'vitest';

// Replicate buildPersonalClinicalContext logic for testing
function buildPersonalClinicalContext(userDat: any, persona?: 'elias' | 'kim'): string | undefined {
  if (!userDat) return undefined;
  const parts: string[] = [];
  const MAX_CHARS = 2000;

  const hasCanonicalSchemas = Array.isArray(userDat.schemas) && userDat.schemas.length > 0;
  const hasCanonicalModes = Array.isArray(userDat.modes) && userDat.modes.length > 0;
  const hasCanonicalTriggers = Array.isArray(userDat.triggers) && userDat.triggers.length > 0;
  const canonicalEmpty = !hasCanonicalSchemas && !hasCanonicalModes && !hasCanonicalTriggers;
  const hasSchemaTendencies = Array.isArray(userDat.schemaTendencies) && userDat.schemaTendencies.length > 0;
  const hasModeTendencies = Array.isArray(userDat.modeTendencies) && userDat.modeTendencies.length > 0;
  const useFallback = canonicalEmpty && (hasSchemaTendencies || hasModeTendencies);

  if (hasCanonicalSchemas) {
    const schemaNames = userDat.schemas
      .filter((s: any) => s && (s.schema || s.schemaName))
      .slice(0, 4)
      .map((s: any) => `${s.schema || s.schemaName}${s.confidence ? ` (${s.confidence})` : ''}`);
    if (schemaNames.length > 0) parts.push(`Schemas (hypotheses): ${schemaNames.join(', ')}`);
  } else if (useFallback && hasSchemaTendencies) {
    const tendencyNames = userDat.schemaTendencies
      .filter((s: any) => s && (s.schemaId || s.schema))
      .slice(0, 4)
      .map((s: any) => {
        const name = s.schemaId || s.schema;
        const freq = s.frequency ? ` (freq:${s.frequency})` : '';
        return `${name}${freq}`;
      });
    if (tendencyNames.length > 0) parts.push(`Schemas (tendency-based hypotheses): ${tendencyNames.join(', ')}`);
  }

  if (hasCanonicalModes) {
    const modeNames = userDat.modes
      .filter((m: any) => m && (m.mode || m.modeName))
      .slice(0, 4)
      .map((m: any) => m.mode || m.modeName);
    if (modeNames.length > 0) parts.push(`Modes (observed): ${modeNames.join(', ')}`);
  } else if (useFallback && hasModeTendencies) {
    const tendencyNames = userDat.modeTendencies
      .filter((m: any) => m && (m.modeId || m.mode))
      .slice(0, 4)
      .map((m: any) => {
        const name = m.modeId || m.mode;
        const freq = m.frequency ? ` (freq:${m.frequency})` : '';
        return `${name}${freq}`;
      });
    if (tendencyNames.length > 0) parts.push(`Modes (tendency-based): ${tendencyNames.join(', ')}`);
  }

  if (Array.isArray(userDat.triggers) && userDat.triggers.length > 0) {
    const triggerNames = userDat.triggers
      .filter((t: any) => t && (t.trigger || t.triggerDescription))
      .slice(0, 5)
      .map((t: any) => t.trigger || t.triggerDescription);
    if (triggerNames.length > 0) parts.push(`Triggers: ${triggerNames.join('; ')}`);
  }

  if (persona === 'elias' && Array.isArray(userDat.recoveryPatterns) && userDat.recoveryPatterns.length > 0) {
    parts.push(`Recovery patterns (hypotheses): ${userDat.recoveryPatterns.slice(0, 3).map((p: any) => p.description || p.type).join('; ')}`);
  }
  if (persona === 'kim' && Array.isArray(userDat.caregiverPatterns) && userDat.caregiverPatterns.length > 0) {
    parts.push(`Caregiver patterns (hypotheses): ${userDat.caregiverPatterns.slice(0, 3).map((p: any) => p.description || p.type).join('; ')}`);
  }

  if (parts.length === 0) return undefined;
  return parts.join('\n').slice(0, MAX_CHARS);
}

describe('FIX 1: ClinicalCtx fallback on schemaTendencies/modeTendencies', () => {
  it('1. canonical empty + schemaTendencies present → returns context (not undefined)', () => {
    const ud = {
      schemas: [],
      modes: [],
      triggers: [],
      schemaTendencies: [{ schemaId: 'abandonment', frequency: 3 }],
      modeTendencies: [{ modeId: 'vulnerable_child', frequency: 2 }],
    };
    const result = buildPersonalClinicalContext(ud, 'elias');
    expect(result).toBeDefined();
    expect(result).toContain('tendency-based');
  });

  it('2. canonical empty + schemaTendencies → output contains schema names', () => {
    const ud = {
      schemas: [],
      modes: [],
      triggers: [],
      schemaTendencies: [{ schemaId: 'abandonment', frequency: 3 }, { schemaId: 'mistrust_abuse', frequency: 2 }],
      modeTendencies: [],
    };
    const result = buildPersonalClinicalContext(ud, 'elias');
    expect(result).toContain('abandonment');
    expect(result).toContain('mistrust_abuse');
  });

  it('3. canonical empty + modeTendencies → output contains mode names', () => {
    const ud = {
      schemas: [],
      modes: [],
      triggers: [],
      schemaTendencies: [],
      modeTendencies: [{ modeId: 'vulnerable_child', frequency: 2 }, { modeId: 'detached_protector', frequency: 1 }],
    };
    const result = buildPersonalClinicalContext(ud, 'elias');
    expect(result).toContain('vulnerable_child');
    expect(result).toContain('detached_protector');
  });

  it('4. canonical present → canonical wins, no fallback used', () => {
    const ud = {
      schemas: [{ schema: 'abandonment', confidence: 0.85 }],
      modes: [{ mode: 'vulnerable_child' }],
      triggers: [],
      schemaTendencies: [{ schemaId: 'different_schema', frequency: 5 }],
      modeTendencies: [{ modeId: 'different_mode', frequency: 5 }],
    };
    const result = buildPersonalClinicalContext(ud, 'elias');
    expect(result).toContain('abandonment');
    expect(result).toContain('vulnerable_child');
    expect(result).not.toContain('tendency-based');
    expect(result).not.toContain('different_schema');
  });

  it('5. both empty → returns undefined', () => {
    const ud = {
      schemas: [],
      modes: [],
      triggers: [],
      schemaTendencies: [],
      modeTendencies: [],
    };
    const result = buildPersonalClinicalContext(ud, 'elias');
    expect(result).toBeUndefined();
  });

  it('6. no userDat → returns undefined', () => {
    expect(buildPersonalClinicalContext(null)).toBeUndefined();
    expect(buildPersonalClinicalContext(undefined)).toBeUndefined();
  });

  it('7. fallback does not dump raw data', () => {
    const ud = {
      schemas: [],
      modes: [],
      triggers: [],
      schemaTendencies: [{ schemaId: 'abandonment', frequency: 3, evidence: 'some private evidence text' }],
      modeTendencies: [{ modeId: 'vulnerable_child', frequency: 2 }],
      extractedEntities: { persons: [{ name: 'Secret Person' }] },
      chatHistory: [{ content: 'private chat' }],
    };
    const result = buildPersonalClinicalContext(ud, 'elias');
    expect(result).not.toContain('Secret Person');
    expect(result).not.toContain('private chat');
    expect(result).not.toContain('some private evidence text');
  });

  it('8. Kim persona separation: Elias recoveryPatterns not shown for Kim', () => {
    const ud = {
      schemas: [],
      modes: [],
      triggers: [],
      schemaTendencies: [{ schemaId: 'abandonment', frequency: 3 }],
      modeTendencies: [],
      recoveryPatterns: [{ type: 'relapse_trigger', description: 'alcohol bij stress' }],
      caregiverPatterns: [{ type: 'rescue', description: 'altijd redden' }],
    };
    const kimResult = buildPersonalClinicalContext(ud, 'kim');
    expect(kimResult).not.toContain('Recovery patterns');
    expect(kimResult).toContain('Caregiver patterns');

    const eliasResult = buildPersonalClinicalContext(ud, 'elias');
    expect(eliasResult).toContain('Recovery patterns');
    expect(eliasResult).not.toContain('Caregiver patterns');
  });

  it('9. fallback output contains "tendency-based" marker for debug detection', () => {
    const ud = {
      schemas: [],
      modes: [],
      triggers: [],
      schemaTendencies: [{ schemaId: 'abandonment', frequency: 3 }],
      modeTendencies: [{ modeId: 'vulnerable_child', frequency: 2 }],
    };
    const result = buildPersonalClinicalContext(ud, 'elias');
    expect(result).toContain('tendency-based');
  });

  it('10. frequency is shown in fallback output', () => {
    const ud = {
      schemas: [],
      modes: [],
      triggers: [],
      schemaTendencies: [{ schemaId: 'abandonment', frequency: 5 }],
      modeTendencies: [],
    };
    const result = buildPersonalClinicalContext(ud, 'elias');
    expect(result).toContain('freq:5');
  });
});
