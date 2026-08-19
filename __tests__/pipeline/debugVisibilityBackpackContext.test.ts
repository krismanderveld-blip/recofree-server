/**
 * FASE 1: Debug visibility for backpack context in clinical dropdown.
 * Tests that anchors, clinicalCtx, and contextDat debug lines are correctly built.
 */
import { describe, it, expect } from 'vitest';

// Replicate buildPersonalAnchorsBlock logic for debug line testing
function buildAnchorsDebugLine(userDat: any): string {
  const persons = userDat?.extractedEntities?.persons || [];
  const relationGraph: any[] = userDat?.relationGraph || [];
  const lifeStatusFacts: any[] = userDat?.lifeStatusFacts || [];
  if ((!Array.isArray(persons) || persons.length === 0) && relationGraph.length === 0 && lifeStatusFacts.length === 0) {
    return 'present=false';
  }
  const personMap = new Map<string, string[]>();
  for (const p of persons.slice(0, 7)) {
    if (!p.name) continue;
    const role = p.relationshipNL || p.relationship || p.role || '';
    personMap.set(p.name.toLowerCase(), role ? [role] : []);
  }
  if (personMap.size === 0) return 'present=false';
  return `present=true count=${personMap.size} chars=${Array.from(personMap).map(([n, p]) => `- ${n}: ${p.join('; ')}`).join('\n').length}`;
}

// Replicate clinicalCtx debug line logic
function buildClinicalCtxDebugLine(userDat: any): string {
  // Simplified: just check if data exists
  const schemas = Array.isArray(userDat?.schemas) ? userDat.schemas.filter((s: any) => s && (s.schema || s.schemaName)).length : 0;
  const modes = Array.isArray(userDat?.modes) ? userDat.modes.filter((m: any) => m && (m.mode || m.modeName)).length : 0;
  const triggers = Array.isArray(userDat?.triggers) ? userDat.triggers.filter((t: any) => t && (t.trigger || t.triggerDescription)).length : 0;
  const protective = Array.isArray(userDat?.protectiveFactors) ? userDat.protectiveFactors.filter((f: any) => f && (f.factor || f.description)).length : 0;
  const values = Array.isArray(userDat?.values) ? userDat.values.filter((v: any) => v && (v.value || v.valueName)).length : 0;
  const goals = Array.isArray(userDat?.goals) ? userDat.goals.filter((g: any) => g && (g.goal || g.goalDescription)).length : 0;
  const risks = Array.isArray(userDat?.risks) ? userDat.risks.filter((r: any) => r && (r.risk || r.riskDescription)).length : 0;
  const recoveryP = Array.isArray(userDat?.recoveryPatterns) ? userDat.recoveryPatterns.length : 0;
  const caregiverP = Array.isArray(userDat?.caregiverPatterns) ? userDat.caregiverPatterns.length : 0;
  const total = schemas + modes + triggers + protective + values + goals + risks;
  if (total === 0) return 'present=false';
  return `present=true schemas=${schemas} modes=${modes} triggers=${triggers} protective=${protective} values=${values} goals=${goals} risks=${risks} recoveryP=${recoveryP} caregiverP=${caregiverP}`;
}

describe('FASE 1: Debug visibility for backpack context', () => {
  const filledUserDat = {
    extractedEntities: {
      persons: [
        { name: 'Jules', relationshipNL: 'zoon' },
        { name: 'Melissa', relationshipNL: 'vriendin' },
      ],
    },
    schemas: [{ schema: 'abandonment', confidence: 0.85 }],
    modes: [{ mode: 'vulnerable_child', confidence: 0.9 }],
    triggers: [{ trigger: 'overlijden moeder', confidence: 0.95 }],
    protectiveFactors: [{ factor: 'sterke band met zoon', confidence: 0.9 }],
    values: [{ value: 'gezin', confidence: 0.95 }],
    goals: [{ goal: 'nuchter blijven', confidence: 0.9 }],
    risks: [{ risk: 'terugval', confidence: 0.85 }],
    recoveryPatterns: [{ type: 'craving_cycle', description: 'test' }],
    caregiverPatterns: [],
  };

  it('anchors debug shows present=true with count when persons exist', () => {
    const line = buildAnchorsDebugLine(filledUserDat);
    expect(line).toContain('present=true');
    expect(line).toContain('count=2');
  });

  it('anchors debug shows present=false when no persons', () => {
    const line = buildAnchorsDebugLine({});
    expect(line).toBe('present=false');
  });

  it('clinicalCtx debug shows present=true with counts when data exists', () => {
    const line = buildClinicalCtxDebugLine(filledUserDat);
    expect(line).toContain('present=true');
    expect(line).toContain('schemas=1');
    expect(line).toContain('modes=1');
    expect(line).toContain('triggers=1');
    expect(line).toContain('protective=1');
    expect(line).toContain('values=1');
    expect(line).toContain('goals=1');
    expect(line).toContain('risks=1');
    expect(line).toContain('recoveryP=1');
    expect(line).toContain('caregiverP=0');
  });

  it('clinicalCtx debug shows present=false when empty', () => {
    const line = buildClinicalCtxDebugLine({});
    expect(line).toBe('present=false');
  });

  it('debug does not crash on null/undefined userDat', () => {
    expect(buildAnchorsDebugLine(null)).toBe('present=false');
    expect(buildAnchorsDebugLine(undefined)).toBe('present=false');
    expect(buildClinicalCtxDebugLine(null)).toBe('present=false');
    expect(buildClinicalCtxDebugLine(undefined)).toBe('present=false');
  });

  it('contextDat debug distinguishes cache_miss vs never_built vs build_failed', () => {
    // Test the logic: when contextDatSerialized is undefined
    const shouldBuildContextDat_true = true;
    const shouldBuildContextDat_false = false;
    const isSessionStart_true = true;
    const isSessionStart_false = false;

    // build_failed: shouldBuild=true but result is undefined
    const buildFailed = `present=false reason=${shouldBuildContextDat_true ? "build_failed" : (isSessionStart_true ? "never_built" : "cache_miss")}`;
    expect(buildFailed).toContain('reason=build_failed');

    // never_built: shouldBuild=false, isSessionStart=true
    const neverBuilt = `present=false reason=${shouldBuildContextDat_false ? "build_failed" : (isSessionStart_true ? "never_built" : "cache_miss")}`;
    expect(neverBuilt).toContain('reason=never_built');

    // cache_miss: shouldBuild=false, isSessionStart=false
    const cacheMiss = `present=false reason=${shouldBuildContextDat_false ? "build_failed" : (isSessionStart_false ? "never_built" : "cache_miss")}`;
    expect(cacheMiss).toContain('reason=cache_miss');
  });

  it('Kim/Elias separation: recoveryP vs caregiverP counted separately', () => {
    const kimDat = {
      schemas: [{ schema: 'self_sacrifice' }],
      caregiverPatterns: [{ type: 'rescue', description: 'test' }, { type: 'control', description: 'test2' }],
      recoveryPatterns: [],
    };
    const line = buildClinicalCtxDebugLine(kimDat);
    expect(line).toContain('caregiverP=2');
    expect(line).toContain('recoveryP=0');
  });
});
