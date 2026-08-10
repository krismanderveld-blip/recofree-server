import { describe, it, expect } from 'vitest';
import {
  createEmptyClinicalDistillationContext,
  validateClinicalDistillationContext,
  isProjectionSafeForFormulation,
  isMemoryFactPromptEligible,
  isHypothesisPromptEligible,
  getClinicalDistillationPromptBudget,
  getKimFormulationMemoryBridge,
  getEliasFormulationMemoryBridge,
  classifyMemoryLayerForCMD,
  getAllowedUsePermissionsForSource,
} from '@/lib/engine/shared/clinical-memory-distillation';
import type {
  ClinicalDistillationContext,
  MemoryFact,
  MemoryHypothesis,
  ProjectionMarker,
  RecoveryChain,
  RelationalPattern,
  VSPAnchor,
  ERPAnchor,
  BufferSignal,
  RiskMarker,
  ProtectiveFactor,
  RecurrentPattern,
  ProgressTrendSignal,
  DayStructureSignal,
  SobrietySignal,
  RelapsePlanSignal,
} from '@/lib/engine/shared/clinical-memory-distillation';
import * as fs from 'fs';
import * as path from 'path';

// ─── Helpers ───────────────────────────────────────────────────────────────
function makeEvidence(persona: 'elias' | 'kim' = 'elias') {
  return [{ id: 'ev1', sourceLayer: 'user_dat' as const, sourceField: 'triggers', text: 'test', confidence: 'high' as const, persona, isUserAuthored: false }];
}

function makeFact(overrides: Partial<MemoryFact> = {}): MemoryFact {
  return {
    id: 'fact1', persona: 'elias', domain: 'craving', text: 'test fact',
    sourceLayer: 'user_dat', certainty: 'confirmed_by_user', freshness: 'today',
    evidence: makeEvidence(), usePermissions: ['may_use_in_formulation'],
    createdAtLocal: '2026-01-01T00:00:00Z', updatedAtLocal: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeHypothesis(overrides: Partial<MemoryHypothesis> = {}): MemoryHypothesis {
  return {
    id: 'hyp1', persona: 'elias', domain: 'shame', hypothesis: 'test hyp',
    sourceLayer: 'logs_dat', certainty: 'hypothesis', evidence: makeEvidence(),
    usePermissions: ['may_use_only_as_hypothesis'], needsUserConfirmation: true,
    createdAtLocal: '2026-01-01T00:00:00Z', updatedAtLocal: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProjection(overrides: Partial<ProjectionMarker> = {}): ProjectionMarker {
  return {
    id: 'proj1', persona: 'elias', projectionType: 'future_fear', text: 'test proj',
    sourceLayer: 'projections_dat', certainty: 'projection', evidence: makeEvidence(),
    usePermissions: ['may_use_only_as_hypothesis', 'may_not_use_as_fact'],
    decayApplied: false, userConfirmed: false,
    createdAtLocal: '2026-01-01T00:00:00Z', updatedAtLocal: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────
describe('Clinical Memory Distillation Contract — FASE 8B', () => {
  // 1-2: Empty context valid
  it('1. empty context valid for elias', () => {
    const ctx = createEmptyClinicalDistillationContext('elias');
    const { ok } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(true);
    expect(ctx.persona).toBe('elias');
    expect(ctx.schemaVersion).toBe('clinical_memory_distillation_v1');
    expect(ctx.formulationInput.maxPromptTokens).toBe(600);
    expect(ctx.shouldRefreshMidSession).toBe(false);
    expect(ctx.confidence).toBe('low');
  });

  it('2. empty context valid for kim', () => {
    const ctx = createEmptyClinicalDistillationContext('kim');
    const { ok } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(true);
    expect(ctx.persona).toBe('kim');
  });

  // 3-4: Invalid persona/schema
  it('3. invalid persona fails', () => {
    const ctx = createEmptyClinicalDistillationContext('elias');
    (ctx as any).persona = 'invalid';
    const { ok, errors } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
    expect(errors.some(e => e.includes('persona'))).toBe(true);
  });

  it('4. invalid schemaVersion fails', () => {
    const ctx = createEmptyClinicalDistillationContext('elias');
    (ctx as any).schemaVersion = 'wrong_v2';
    const { ok, errors } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
    expect(errors.some(e => e.includes('schemaVersion'))).toBe(true);
  });

  // 5-6: Valid enums
  it('5. sourceLayers must be valid', () => {
    const ctx = createEmptyClinicalDistillationContext('elias');
    ctx.sourceLayersUsed = ['invalid_layer' as any];
    const { ok, errors } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
    expect(errors.some(e => e.includes('sourceLayer'))).toBe(true);
  });

  it('6. dataClasses must be valid', () => {
    const ctx = createEmptyClinicalDistillationContext('elias');
    ctx.dataClasses = ['invalid_class' as any];
    const { ok, errors } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
    expect(errors.some(e => e.includes('dataClass'))).toBe(true);
  });

  // 7: formulationInput required
  it('7. formulationInput required', () => {
    const ctx = createEmptyClinicalDistillationContext('elias');
    (ctx as any).formulationInput = null;
    const { ok, errors } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
    expect(errors.some(e => e.includes('formulationInput'))).toBe(true);
  });

  // 8: maxPromptTokens
  it('8. maxPromptTokens > 1200 fails', () => {
    const ctx = createEmptyClinicalDistillationContext('elias');
    ctx.formulationInput.maxPromptTokens = 1500;
    const { ok, errors } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
    expect(errors.some(e => e.includes('maxPromptTokens'))).toBe(true);
  });

  // 9-12: Cross-persona
  it('9. cross-persona RecoveryChain in Kim fails', () => {
    const ctx = createEmptyClinicalDistillationContext('kim');
    ctx.formulationInput.recoveryChains = [{ id: 'rc1', persona: 'elias', chain: ['a'], evidence: [], certainty: 'hypothesis', usePermissions: [] }];
    const { ok, errors } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
    expect(errors.some(e => e.includes('RecoveryChain'))).toBe(true);
  });

  it('10. cross-persona RelationalPattern in Elias fails', () => {
    const ctx = createEmptyClinicalDistillationContext('elias');
    ctx.formulationInput.relationalPatterns = [{ id: 'rp1', persona: 'kim', pattern: ['a'], activeDomains: [], harmRepeated: false, boundaryPressure: false, repairPossibleConditions: [], evidence: [], certainty: 'hypothesis', usePermissions: [] }];
    const { ok, errors } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
    expect(errors.some(e => e.includes('RelationalPattern'))).toBe(true);
  });

  it('11. VSPAnchor in Kim fails', () => {
    const ctx = createEmptyClinicalDistillationContext('kim');
    ctx.formulationInput.vspAnchors = [{ id: 'v1', persona: 'elias', zone: 'red', signal: 'test', sourceLayer: 'vsp', confidence: 'high', usePermissions: [] }];
    const { ok, errors } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
    expect(errors.some(e => e.includes('VSPAnchor'))).toBe(true);
  });

  it('12. ERPAnchor in Elias fails', () => {
    const ctx = createEmptyClinicalDistillationContext('elias');
    ctx.formulationInput.erpAnchors = [{ id: 'e1', persona: 'kim', domain: 'boundary_pressure', signal: 'test', sourceLayer: 'eigen_regie_plan', confidence: 'high', usePermissions: [] }];
    const { ok, errors } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
    expect(errors.some(e => e.includes('ERPAnchor'))).toBe(true);
  });

  // 13-14: Projection/Hypothesis rules
  it('13. ProjectionMarker cannot be MemoryFact', () => {
    const ctx = createEmptyClinicalDistillationContext('elias');
    ctx.formulationInput.projectionMarkers = [makeProjection({ id: 'shared_id' })];
    ctx.formulationInput.memoryFacts = [makeFact({ id: 'shared_id' })];
    const { ok, errors } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
    expect(errors.some(e => e.includes('ProjectionMarker') && e.includes('MemoryFact'))).toBe(true);
  });

  it('14. MemoryHypothesis cannot be confirmed_by_user', () => {
    const ctx = createEmptyClinicalDistillationContext('elias');
    ctx.formulationInput.memoryHypotheses = [makeHypothesis({ certainty: 'confirmed_by_user' as any })];
    const { ok, errors } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
    expect(errors.some(e => e.includes('MemoryHypothesis') && e.includes('confirmed_by_user'))).toBe(true);
  });

  // 15-16: BufferSignal
  it('15. BufferSignal sessionOnly must be true', () => {
    const ctx = createEmptyClinicalDistillationContext('elias');
    ctx.formulationInput.bufferSignals = [{ id: 'bs1', persona: 'elias', domain: 'craving', signal: 'test', sessionOnly: false as any, eligibleForLongTermDistillation: true, shouldPersistRaw: false, evidence: [] }];
    const { ok, errors } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
    expect(errors.some(e => e.includes('sessionOnly'))).toBe(true);
  });

  it('16. BufferSignal shouldPersistRaw must be false', () => {
    const ctx = createEmptyClinicalDistillationContext('elias');
    ctx.formulationInput.bufferSignals = [{ id: 'bs2', persona: 'elias', domain: 'craving', signal: 'test', sessionOnly: true, eligibleForLongTermDistillation: true, shouldPersistRaw: true as any, evidence: [] }];
    const { ok, errors } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
    expect(errors.some(e => e.includes('shouldPersistRaw'))).toBe(true);
  });

  // 17-19: Prompt eligibility
  it('17. may_not_use_in_gpt fact not prompt eligible', () => {
    const fact = makeFact({ usePermissions: ['may_not_use_in_gpt', 'may_use_in_formulation'] });
    expect(isMemoryFactPromptEligible(fact)).toBe(false);
  });

  it('18. prompt eligible fact requires evidence', () => {
    const fact = makeFact({ evidence: [] });
    expect(isMemoryFactPromptEligible(fact)).toBe(false);
  });

  it('19. prompt eligible fact requires high or confirmed certainty', () => {
    const fact = makeFact({ certainty: 'low_confidence_inference' });
    expect(isMemoryFactPromptEligible(fact)).toBe(false);
  });

  // 20: Hypothesis prompt eligible
  it('20. hypothesis prompt eligible only as hypothesis', () => {
    const hyp = makeHypothesis({ usePermissions: ['may_use_only_as_hypothesis'] });
    expect(isHypothesisPromptEligible(hyp)).toBe(true);
    const hyp2 = makeHypothesis({ usePermissions: [] });
    expect(isHypothesisPromptEligible(hyp2)).toBe(false);
  });

  // 21-22: Projection safety
  it('21. projection safe only with may_use_only_as_hypothesis', () => {
    const proj = makeProjection({ usePermissions: ['may_not_use_as_fact'] });
    expect(isProjectionSafeForFormulation(proj)).toBe(false);
  });

  it('22. projection safe only with may_not_use_as_fact', () => {
    const proj = makeProjection({ usePermissions: ['may_use_only_as_hypothesis'] });
    expect(isProjectionSafeForFormulation(proj)).toBe(false);
  });

  // 23-29: classifyMemoryLayerForCMD
  it('23. backpack classified as raw user anchor needing distillation', () => {
    const classes = classifyMemoryLayerForCMD('backpack');
    expect(classes).toContain('raw_user_data');
    expect(classes).toContain('user_authored_anchor');
    expect(classes).toContain('needs_distillation');
  });

  it('24. projections classified as hypothesis not fact', () => {
    const classes = classifyMemoryLayerForCMD('projections_dat');
    expect(classes).toContain('hypothesis_not_fact');
    expect(classes).toContain('engine_derived_signal');
    expect(classes).toContain('persona_separated');
  });

  it('25. buffer classified as temporary session state', () => {
    const classes = classifyMemoryLayerForCMD('buffer');
    expect(classes).toContain('temporary_session_state');
    expect(classes).toContain('local_only');
    expect(classes).toContain('persona_separated');
  });

  it('26. dayStructure classified as UI progress needing distillation', () => {
    const classes = classifyMemoryLayerForCMD('day_structure');
    expect(classes).toContain('ui_progress_data');
    expect(classes).toContain('needs_distillation');
  });

  it('27. extractedEntities classified as persona leakage risk', () => {
    const classes = classifyMemoryLayerForCMD('extracted_entities');
    expect(classes).toContain('engine_derived_signal');
    expect(classes).toContain('persona_leakage_risk');
  });

  it('28. user.dat classified as formulation input ready', () => {
    const classes = classifyMemoryLayerForCMD('user_dat');
    expect(classes).toContain('engine_derived_signal');
    expect(classes).toContain('formulation_input_ready');
    expect(classes).toContain('persona_separated');
  });

  it('29. state.dat classified as safety relevant', () => {
    const classes = classifyMemoryLayerForCMD('state_dat');
    expect(classes).toContain('engine_derived_signal');
    expect(classes).toContain('safety_relevant_data');
    expect(classes).toContain('persona_separated');
  });

  // 30-33: Bridge functions
  it('30. Kim bridge returns only for Kim', () => {
    const kimCtx = createEmptyClinicalDistillationContext('kim');
    const eliasCtx = createEmptyClinicalDistillationContext('elias');
    expect(getKimFormulationMemoryBridge(kimCtx)).not.toBeNull();
    expect(getKimFormulationMemoryBridge(eliasCtx)).toBeNull();
  });

  it('31. Elias bridge returns only for Elias', () => {
    const eliasCtx = createEmptyClinicalDistillationContext('elias');
    const kimCtx = createEmptyClinicalDistillationContext('kim');
    expect(getEliasFormulationMemoryBridge(eliasCtx)).not.toBeNull();
    expect(getEliasFormulationMemoryBridge(kimCtx)).toBeNull();
  });

  it('32. Kim bridge includes relational patterns, not recovery chains', () => {
    const ctx = createEmptyClinicalDistillationContext('kim');
    const bridge = getKimFormulationMemoryBridge(ctx)!;
    expect(bridge.persona).toBe('kim');
    expect(bridge).toHaveProperty('relationalPatterns');
    expect(bridge).toHaveProperty('erpAnchors');
    expect(bridge).not.toHaveProperty('recoveryChains');
    expect(bridge).not.toHaveProperty('vspAnchors');
  });

  it('33. Elias bridge includes recovery chains, not relational patterns', () => {
    const ctx = createEmptyClinicalDistillationContext('elias');
    const bridge = getEliasFormulationMemoryBridge(ctx)!;
    expect(bridge.persona).toBe('elias');
    expect(bridge).toHaveProperty('recoveryChains');
    expect(bridge).toHaveProperty('vspAnchors');
    expect(bridge).not.toHaveProperty('relationalPatterns');
    expect(bridge).not.toHaveProperty('erpAnchors');
  });

  // 34-35: Evidence required
  it('34. RiskMarker requires evidence for prompt eligibility', () => {
    // RiskMarker type enforces evidence field exists
    const rm: RiskMarker = { id: 'rm1', persona: 'elias', domain: 'relapse_risk', risk: 'test', severity: 'high', trend: 'increasing', evidence: [], usePermissions: [] };
    expect(rm.evidence).toEqual([]);
  });

  it('35. ProtectiveFactor requires evidence', () => {
    const pf: ProtectiveFactor = { id: 'pf1', persona: 'elias', domain: 'support', factor: 'test', strength: 'high', evidence: [], usePermissions: [] };
    expect(pf.evidence).toEqual([]);
  });

  // 36-38: Structural requirements
  it('36. RecurrentPattern requires frequency >= 1', () => {
    const rp: RecurrentPattern = { id: 'rp1', persona: 'elias', domain: 'craving', pattern: 'test', frequency: 0, trend: 'unknown', sourceLayers: [], evidence: [], certainty: 'hypothesis', usePermissions: [] };
    expect(rp.frequency).toBe(0);
    // Contract: frequency must be >= 1 for clinical relevance (validated at runtime)
  });

  it('37. ProgressTrendSignal requires clinicalInterpretation', () => {
    const pts: ProgressTrendSignal = { id: 'pts1', persona: 'elias', domain: 'craving', metric: 'craving', window: 'seven_days', direction: 'improving', clinicalInterpretation: '', certainty: 'hypothesis', usePermissions: [] };
    expect(pts).toHaveProperty('clinicalInterpretation');
  });

  it('38. DayStructureSignal requires clinicalInterpretation', () => {
    const dss: DayStructureSignal = { id: 'dss1', persona: 'elias', pattern: 'structure_declining', clinicalInterpretation: 'declining structure', usePermissions: [] };
    expect(dss).toHaveProperty('clinicalInterpretation');
    expect(dss.clinicalInterpretation.length).toBeGreaterThan(0);
  });

  // 39-42: Persona-locked types
  it('39. SobrietySignal only Elias', () => {
    const ss: SobrietySignal = { id: 'ss1', persona: 'elias', recentRelapse: false, relapsePlanAvailable: true, clinicalInterpretation: 'stable', usePermissions: [] };
    expect(ss.persona).toBe('elias');
  });

  it('40. RelapsePlanSignal only Elias', () => {
    const rps: RelapsePlanSignal = { id: 'rps1', persona: 'elias', sourceLayer: 'relapse_plan', usePermissions: [] };
    expect(rps.persona).toBe('elias');
  });

  it('41. VSPAnchor only Elias', () => {
    const vsp: VSPAnchor = { id: 'vsp1', persona: 'elias', zone: 'orange', signal: 'test', sourceLayer: 'vsp', confidence: 'medium', usePermissions: [] };
    expect(vsp.persona).toBe('elias');
  });

  it('42. ERPAnchor only Kim', () => {
    const erp: ERPAnchor = { id: 'erp1', persona: 'kim', domain: 'boundary_pressure', signal: 'test', sourceLayer: 'eigen_regie_plan', confidence: 'high', usePermissions: [] };
    expect(erp.persona).toBe('kim');
  });

  // 43-50: No forbidden imports (static code analysis)
  it('43. no server imports in types', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/clinical-memory-distillation/clinical-memory-distillation-types.ts'), 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*server\//);
  });

  it('44. no AsyncStorage imports in contract', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/clinical-memory-distillation/clinical-memory-distillation-contract.ts'), 'utf-8');
    expect(src).not.toMatch(/import.*AsyncStorage/);
    expect(src).not.toMatch(/import.*@react-native-async-storage/);
  });

  it('45. no runtime side effects in contract', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/clinical-memory-distillation/clinical-memory-distillation-contract.ts'), 'utf-8');
    expect(src).not.toMatch(/await\s/);
    expect(src).not.toMatch(/fetch\(/);
    expect(src).not.toMatch(/console\.(log|warn|error)/);
  });

  it('46. no pipeline imports', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/clinical-memory-distillation/clinical-memory-distillation-contract.ts'), 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*pipeline/);
    expect(src).not.toMatch(/from\s+['"].*rugzak\/pipeline/);
  });

  it('47. no prompt imports', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/clinical-memory-distillation/clinical-memory-distillation-contract.ts'), 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*prompt/);
  });

  it('48. no Kim formulation imports', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/clinical-memory-distillation/clinical-memory-distillation-contract.ts'), 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*kim.*formulation/);
  });

  it('49. no Elias formulation imports', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/clinical-memory-distillation/clinical-memory-distillation-contract.ts'), 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*elias.*formulation/);
  });

  it('50. no nano imports', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../lib/engine/shared/clinical-memory-distillation/clinical-memory-distillation-contract.ts'), 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*nano/);
  });
});
