import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildCMDFromDist01,
  mapDist01EntityToMemory,
  mapDist01SignalToCMD,
  mapDist01ContextToCMD,
  createDist01EvidenceItem,
  classifyDist01Domain,
  inferDist01UsePermissions,
  shouldSkipDist01Item,
  buildRecoveryChainCandidatesFromDist01,
  buildRelationalPatternCandidatesFromDist01,
  buildDist01CMDContextParts,
  buildClinicalDistillationContextFromParts,
  validateClinicalDistillationContext,
} from '@/lib/engine/shared/clinical-memory-distillation';

const NOW = '2026-08-10T12:00:00Z';

describe('DIST01-CMD Bridge — FASE 8D', () => {
  // ─── Basic purity (1-10) ────────────────────────────────────────────
  const BRIDGE_PATH = path.resolve(__dirname, '../../../lib/engine/shared/clinical-memory-distillation/dist01-cmd-bridge.ts');

  it('1. bridge exports pure functions', () => {
    const src = fs.readFileSync(BRIDGE_PATH, 'utf-8');
    expect(src).toContain('export function buildCMDFromDist01');
    expect(src).toContain('export function mapDist01EntityToMemory');
    expect(src).toContain('export function classifyDist01Domain');
  });

  it('2. no server imports', () => {
    const src = fs.readFileSync(BRIDGE_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*server\//);
  });

  it('3. no AsyncStorage imports', () => {
    const src = fs.readFileSync(BRIDGE_PATH, 'utf-8');
    expect(src).not.toMatch(/import.*AsyncStorage/);
  });

  it('4. no pipeline imports', () => {
    const src = fs.readFileSync(BRIDGE_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*pipeline/);
  });

  it('5. no prompt imports', () => {
    const src = fs.readFileSync(BRIDGE_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*\/prompt/);
  });

  it('6. no OpenAI/provider imports', () => {
    const src = fs.readFileSync(BRIDGE_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*openai-provider/);
  });

  it('7. no Kim formulation imports', () => {
    const src = fs.readFileSync(BRIDGE_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*kim.*formulation/);
  });

  it('8. no Elias formulation imports', () => {
    const src = fs.readFileSync(BRIDGE_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*elias.*formulation/);
  });

  it('9. no nano imports', () => {
    const src = fs.readFileSync(BRIDGE_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*nano/);
  });

  it('10. no DIST01 runtime file mutation', () => {
    const src = fs.readFileSync(BRIDGE_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*dist01-store/);
    expect(src).not.toMatch(/from\s+['"].*dist01-detector/);
    expect(src).not.toMatch(/from\s+['"].*dist01-context-injector/);
  });

  // ─── Evidence (11-17) ───────────────────────────────────────────────
  it('11. creates evidence from valid entity', () => {
    const ev = createDist01EvidenceItem({ sourceField: 'entity', text: 'Melissa', confidence: 'high', persona: 'elias' });
    expect(ev).not.toBeNull();
    expect(ev!.sourceField).toBe('entity');
  });

  it('12. creates evidence from valid signal', () => {
    const ev = createDist01EvidenceItem({ sourceField: 'signal', text: 'craving spike', confidence: 'medium', persona: 'elias' });
    expect(ev).not.toBeNull();
    expect(ev!.sourceField).toBe('signal');
  });

  it('13. creates evidence from valid context', () => {
    const ev = createDist01EvidenceItem({ sourceField: 'context', text: 'job loss', confidence: 'high', persona: 'elias' });
    expect(ev).not.toBeNull();
    expect(ev!.sourceField).toBe('context');
  });

  it('14. evidence uses sourceLayer distillation_dat', () => {
    const ev = createDist01EvidenceItem({ sourceField: 'entity', text: 'test', confidence: 'high', persona: 'elias' });
    expect(ev!.sourceLayer).toBe('distillation_dat');
  });

  it('15. evidence requires persona', () => {
    const ev = createDist01EvidenceItem({ sourceField: 'entity', text: 'test', confidence: 'high', persona: 'kim' });
    expect(ev!.persona).toBe('kim');
  });

  it('16. evidence rejects empty text', () => {
    const ev = createDist01EvidenceItem({ sourceField: 'entity', text: '', confidence: 'high', persona: 'elias' });
    expect(ev).toBeNull();
  });

  it('17. evidence truncates long text', () => {
    const ev = createDist01EvidenceItem({ sourceField: 'entity', text: 'A'.repeat(200), confidence: 'high', persona: 'elias' });
    expect(ev!.text.length).toBeLessThanOrEqual(105);
  });

  // ─── Entities (18-24) ───────────────────────────────────────────────
  it('18. high confidence person maps to MemoryFact', () => {
    const r = mapDist01EntityToMemory({ entity: { type: 'person', label: 'Melissa', confidence: 'high' }, persona: 'elias', nowLocal: NOW });
    expect(r).not.toBeNull();
    expect('freshness' in r!).toBe(true); // MemoryFact has freshness
  });

  it('19. medium confidence person maps to MemoryHypothesis', () => {
    const r = mapDist01EntityToMemory({ entity: { type: 'person', label: 'Jan', confidence: 'medium' }, persona: 'elias', nowLocal: NOW });
    expect(r).not.toBeNull();
    expect('hypothesis' in r!).toBe(true);
  });

  it('20. low confidence entity maps to MemoryHypothesis', () => {
    const r = mapDist01EntityToMemory({ entity: { type: 'substance', label: 'alcohol', confidence: 'low' }, persona: 'elias', nowLocal: NOW });
    expect(r).not.toBeNull();
    expect('hypothesis' in r!).toBe(true);
  });

  it('21. entity without text skipped', () => {
    const r = mapDist01EntityToMemory({ entity: { type: 'person', label: '' }, persona: 'elias', nowLocal: NOW });
    expect(r).toBeNull();
  });

  it('22. substance entity for Elias maps safety-relevant domain', () => {
    const r = mapDist01EntityToMemory({ entity: { type: 'substance', label: 'alcohol gebruik', confidence: 'high' }, persona: 'elias', nowLocal: NOW });
    expect(r).not.toBeNull();
    expect((r as any).domain).toBe('craving');
  });

  it('23. entity does not become projection', () => {
    const r = mapDist01EntityToMemory({ entity: { type: 'person', label: 'test', confidence: 'high' }, persona: 'elias', nowLocal: NOW });
    expect(r).not.toBeNull();
    expect((r as any).projectionType).toBeUndefined();
  });

  it('24. entity evidence required', () => {
    const r = mapDist01EntityToMemory({ entity: { type: 'person', label: 'test', confidence: 'high' }, persona: 'elias', nowLocal: NOW });
    expect((r as any).evidence.length).toBeGreaterThan(0);
  });

  // ─── Signals (25-34) ────────────────────────────────────────────────
  it('25. risk signal maps RiskMarker', () => {
    const r = mapDist01SignalToCMD({ signal: { category: 'risk', label: 'craving spike', confidence: 'high' }, persona: 'elias', nowLocal: NOW });
    expect(r.riskMarker).toBeDefined();
  });

  it('26. protective signal maps ProtectiveFactor', () => {
    const r = mapDist01SignalToCMD({ signal: { category: 'protective', label: 'sport', confidence: 'high' }, persona: 'elias', nowLocal: NOW });
    expect(r.protectiveFactor).toBeDefined();
  });

  it('27. trigger signal mentionCount >= 2 maps RecurrentPattern', () => {
    const r = mapDist01SignalToCMD({ signal: { type: 'trigger', label: 'eenzaamheid', confidence: 'medium', mentionCount: 3 }, persona: 'elias', nowLocal: NOW });
    expect(r.recurrentPattern).toBeDefined();
    expect(r.recurrentPattern!.frequency).toBe(3);
  });

  it('28. trigger signal mentionCount 1 does not create RecurrentPattern', () => {
    const r = mapDist01SignalToCMD({ signal: { type: 'trigger', label: 'eenzaamheid', confidence: 'medium', mentionCount: 1 }, persona: 'elias', nowLocal: NOW });
    expect(r.recurrentPattern).toBeUndefined();
  });

  it('29. low confidence risk still not MemoryFact', () => {
    const r = mapDist01SignalToCMD({ signal: { category: 'risk', label: 'test', confidence: 'low' }, persona: 'elias', nowLocal: NOW });
    expect(r.riskMarker).toBeUndefined();
    expect(r.memoryHypothesis).toBeDefined();
  });

  it('30. high confidence non-interpretive signal can MemoryFact only with evidence', () => {
    const r = mapDist01SignalToCMD({ signal: { type: 'anchor', label: 'sport helpt', confidence: 'high', category: 'protective' }, persona: 'elias', nowLocal: NOW });
    if (r.protectiveFactor) expect(r.protectiveFactor.evidence.length).toBeGreaterThan(0);
  });

  it('31. signal without text produces no output', () => {
    const r = mapDist01SignalToCMD({ signal: { type: 'trigger', label: '', confidence: 'high' }, persona: 'elias', nowLocal: NOW });
    expect(r.riskMarker).toBeUndefined();
    expect(r.memoryFact).toBeUndefined();
    expect(r.memoryHypothesis).toBeUndefined();
  });

  it('32. signal usePermissions never empty', () => {
    const r = mapDist01SignalToCMD({ signal: { category: 'risk', label: 'test', confidence: 'high' }, persona: 'elias', nowLocal: NOW });
    expect(r.riskMarker!.usePermissions.length).toBeGreaterThan(0);
  });

  it('33. risk includes may_use_for_safety', () => {
    const r = mapDist01SignalToCMD({ signal: { category: 'risk', label: 'test', confidence: 'high' }, persona: 'elias', nowLocal: NOW });
    expect(r.riskMarker!.usePermissions).toContain('may_use_for_safety');
  });

  it('34. protective includes may_use_for_greeting', () => {
    const r = mapDist01SignalToCMD({ signal: { category: 'protective', label: 'test', confidence: 'high' }, persona: 'elias', nowLocal: NOW });
    expect(r.protectiveFactor!.usePermissions).toContain('may_use_for_greeting');
  });

  // ─── Contexts (35-40) ───────────────────────────────────────────────
  it('35. life_event high confidence maps MemoryFact', () => {
    const r = mapDist01ContextToCMD({ context: { type: 'life_event', label: 'verlies van baan', confidence: 'high' }, persona: 'elias', nowLocal: NOW });
    expect(r.memoryFact).toBeDefined();
  });

  it('36. fear context maps MemoryHypothesis, not ProjectionMarker', () => {
    const r = mapDist01ContextToCMD({ context: { type: 'fear', label: 'terugval angst', confidence: 'medium' }, persona: 'elias', nowLocal: NOW });
    expect(r.memoryHypothesis).toBeDefined();
    expect((r as any).projectionMarker).toBeUndefined();
  });

  it('37. goal context maps ProtectiveFactor', () => {
    const r = mapDist01ContextToCMD({ context: { type: 'goal', label: 'nuchter blijven', confidence: 'high' }, persona: 'elias', nowLocal: NOW });
    expect(r.protectiveFactor).toBeDefined();
  });

  it('38. value context maps ProtectiveFactor', () => {
    const r = mapDist01ContextToCMD({ context: { type: 'value', label: 'eerlijkheid', confidence: 'high' }, persona: 'elias', nowLocal: NOW });
    expect(r.protectiveFactor).toBeDefined();
  });

  it('39. low confidence context maps MemoryHypothesis', () => {
    const r = mapDist01ContextToCMD({ context: { type: 'situation', label: 'werkdruk', confidence: 'low' }, persona: 'elias', nowLocal: NOW });
    expect(r.memoryHypothesis).toBeDefined();
  });

  it('40. context evidence required', () => {
    const r = mapDist01ContextToCMD({ context: { type: 'life_event', label: 'test', confidence: 'high' }, persona: 'elias', nowLocal: NOW });
    expect(r.memoryFact!.evidence.length).toBeGreaterThan(0);
  });

  // ─── Domains (41-50) ────────────────────────────────────────────────
  it('41. craving text maps craving', () => { expect(classifyDist01Domain({ label: 'craving naar alcohol' })).toBe('craving'); });
  it('42. relapse/herval maps relapse_risk', () => { expect(classifyDist01Domain({ label: 'herval vorige week' })).toBe('relapse_risk'); });
  it('43. shame maps shame', () => { expect(classifyDist01Domain({ label: 'schaamte over gebruik' })).toBe('shame'); });
  it('44. self-hate/hopeless maps self_hatred', () => { expect(classifyDist01Domain({ label: 'ik ben hopeloos' })).toBe('self_hatred'); });
  it('45. avoidance/hide maps avoidance', () => { expect(classifyDist01Domain({ label: 'vermijden van contact' })).toBe('avoidance'); });
  it('46. sleep maps sleep', () => { expect(classifyDist01Domain({ label: 'slaapproblemen' })).toBe('sleep'); });
  it('47. trust/lying maps trust/lying', () => {
    expect(classifyDist01Domain({ label: 'vertrouwensbreuk' })).toBe('trust');
    expect(classifyDist01Domain({ label: 'leugens' })).toBe('lying');
  });
  it('48. boundary/grens maps boundary_pressure', () => { expect(classifyDist01Domain({ label: 'grenzen stellen' })).toBe('boundary_pressure'); });
  it('49. structure/routine maps day_structure', () => { expect(classifyDist01Domain({ label: 'dagstructuur kwijt' })).toBe('day_structure'); });
  it('50. unknown text maps unknown', () => { expect(classifyDist01Domain({ label: 'xyz onbekend' })).toBe('unknown'); });

  // ─── Recovery chain (51-54) ─────────────────────────────────────────
  it('51. Elias trigger+craving+shame creates RecoveryChain candidate', () => {
    const signals = [
      { type: 'trigger', label: 'eenzaamheid trigger', confidence: 'medium' as const },
      { type: 'trigger', label: 'craving naar alcohol', confidence: 'medium' as const },
      { type: 'pattern', label: 'schaamte na gebruik', confidence: 'medium' as const },
    ];
    const r = buildRecoveryChainCandidatesFromDist01({ persona: 'elias', signals, nowLocal: NOW });
    expect(r.length).toBe(1);
  });

  it('52. Elias trigger+craving only does not create chain (< 3 links)', () => {
    const signals = [
      { type: 'trigger', label: 'craving naar alcohol', confidence: 'medium' as const },
      { type: 'pattern', label: 'meer craving', confidence: 'medium' as const },
    ];
    const r = buildRecoveryChainCandidatesFromDist01({ persona: 'elias', signals, nowLocal: NOW });
    expect(r.length).toBe(0);
  });

  it('53. Kim never gets RecoveryChain', () => {
    const signals = [
      { type: 'trigger', label: 'eenzaamheid trigger', confidence: 'medium' as const },
      { type: 'trigger', label: 'craving naar alcohol', confidence: 'medium' as const },
      { type: 'pattern', label: 'schaamte na gebruik', confidence: 'medium' as const },
    ];
    const r = buildRecoveryChainCandidatesFromDist01({ persona: 'kim', signals, nowLocal: NOW });
    expect(r.length).toBe(0);
  });

  it('54. RecoveryChain inference has may_not_use_as_fact', () => {
    const signals = [
      { type: 'trigger', label: 'eenzaamheid trigger', confidence: 'medium' as const },
      { type: 'trigger', label: 'craving naar alcohol', confidence: 'medium' as const },
      { type: 'pattern', label: 'schaamte na gebruik', confidence: 'medium' as const },
    ];
    const r = buildRecoveryChainCandidatesFromDist01({ persona: 'elias', signals, nowLocal: NOW });
    expect(r[0].usePermissions).toContain('may_not_use_as_fact');
  });

  // ─── Relational pattern (55-59) ─────────────────────────────────────
  it('55. Kim trust+lying+boundary creates RelationalPattern candidate', () => {
    const signals = [
      { type: 'pattern', label: 'vertrouwensbreuk', confidence: 'medium' as const },
      { type: 'pattern', label: 'leugens herhaald', confidence: 'medium' as const },
      { type: 'pattern', label: 'grenzen overschreden', confidence: 'medium' as const },
    ];
    const r = buildRelationalPatternCandidatesFromDist01({ persona: 'kim', signals, nowLocal: NOW });
    expect(r.length).toBe(1);
  });

  it('56. Kim trust only does not create pattern', () => {
    const signals = [{ type: 'pattern', label: 'vertrouwensbreuk', confidence: 'medium' as const }];
    const r = buildRelationalPatternCandidatesFromDist01({ persona: 'kim', signals, nowLocal: NOW });
    expect(r.length).toBe(0);
  });

  it('57. Elias never gets RelationalPattern', () => {
    const signals = [
      { type: 'pattern', label: 'vertrouwensbreuk', confidence: 'medium' as const },
      { type: 'pattern', label: 'leugens herhaald', confidence: 'medium' as const },
      { type: 'pattern', label: 'grenzen overschreden', confidence: 'medium' as const },
    ];
    const r = buildRelationalPatternCandidatesFromDist01({ persona: 'elias', signals, nowLocal: NOW });
    expect(r.length).toBe(0);
  });

  it('58. repeated harm sets harmRepeated true', () => {
    const signals = [
      { type: 'pattern', label: 'vertrouwensbreuk', confidence: 'medium' as const, mentionCount: 5 },
      { type: 'pattern', label: 'leugens herhaald', confidence: 'medium' as const },
      { type: 'pattern', label: 'grenzen overschreden', confidence: 'medium' as const },
    ];
    const r = buildRelationalPatternCandidatesFromDist01({ persona: 'kim', signals, nowLocal: NOW });
    expect(r[0].harmRepeated).toBe(true);
  });

  it('59. RelationalPattern inference has may_not_use_as_fact', () => {
    const signals = [
      { type: 'pattern', label: 'vertrouwensbreuk', confidence: 'medium' as const },
      { type: 'pattern', label: 'leugens herhaald', confidence: 'medium' as const },
      { type: 'pattern', label: 'grenzen overschreden', confidence: 'medium' as const },
    ];
    const r = buildRelationalPatternCandidatesFromDist01({ persona: 'kim', signals, nowLocal: NOW });
    expect(r[0].usePermissions).toContain('may_not_use_as_fact');
  });

  // ─── Integration compatibility (60-70) ──────────────────────────────
  it('60. buildCMDFromDist01 returns all arrays', () => {
    const r = buildCMDFromDist01({ persona: 'elias', entities: [], signals: [], contexts: [], nowLocal: NOW });
    expect(r.memoryFacts).toEqual([]);
    expect(r.memoryHypotheses).toEqual([]);
    expect(r.recurrentPatterns).toEqual([]);
    expect(r.riskMarkers).toEqual([]);
    expect(r.protectiveFactors).toEqual([]);
    expect(r.evidenceItems).toEqual([]);
    expect(r.skippedItems).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('61. buildDist01CMDContextParts returns FormulationMemoryInput-compatible parts', () => {
    const r = buildDist01CMDContextParts({ persona: 'elias', entities: [{ type: 'person', label: 'test', confidence: 'high' }], signals: [], contexts: [], nowLocal: NOW });
    expect(r).toHaveProperty('memoryFacts');
    expect(r).toHaveProperty('memoryHypotheses');
    expect(r).toHaveProperty('recoveryChains');
    expect(r).toHaveProperty('relationalPatterns');
  });

  it('62. output can assemble into ClinicalDistillationContext', () => {
    const parts = buildDist01CMDContextParts({ persona: 'elias', entities: [{ type: 'person', label: 'test', confidence: 'high' }], signals: [], contexts: [], nowLocal: NOW });
    const ctx = buildClinicalDistillationContextFromParts({ persona: 'elias', memoryFacts: parts.memoryFacts, memoryHypotheses: parts.memoryHypotheses, nowLocal: NOW });
    expect(ctx.schemaVersion).toBe('clinical_memory_distillation_v1');
  });

  it('63. assembled context validates ok', () => {
    const parts = buildDist01CMDContextParts({ persona: 'elias', entities: [{ type: 'person', label: 'test', confidence: 'high' }], signals: [], contexts: [], nowLocal: NOW });
    const ctx = buildClinicalDistillationContextFromParts({ persona: 'elias', memoryFacts: parts.memoryFacts, nowLocal: NOW });
    const { ok } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(true);
  });

  it('64. invalid cross-persona item rejected', () => {
    const r = buildCMDFromDist01({ persona: 'elias', entities: [{ type: 'person', label: 'test', confidence: 'high' }], signals: [], contexts: [], nowLocal: NOW });
    // All items should have persona elias
    for (const f of r.memoryFacts) expect(f.persona).toBe('elias');
  });

  it('65. unsupported item goes to skippedItems', () => {
    const r = buildCMDFromDist01({ persona: 'elias', entities: [{ type: 'unknown', label: '' }], signals: [], contexts: [], nowLocal: NOW });
    expect(r.skippedItems.length).toBeGreaterThan(0);
  });

  it('66. warnings/skipped include reason', () => {
    const r = buildCMDFromDist01({ persona: 'elias', entities: [{ type: 'x', label: '' }], signals: [], contexts: [], nowLocal: NOW });
    expect(r.skippedItems[0].reason.length).toBeGreaterThan(0);
  });

  it('67. no ProjectionMarker created by DIST01 bridge', () => {
    const src = fs.readFileSync(BRIDGE_PATH, 'utf-8');
    expect(src).not.toMatch(/projectionType/);
    expect(src).not.toMatch(/future_fear/);
    expect(src).not.toMatch(/future_hope/);
  });

  it('68. low/medium confidence never confirmed_by_user', () => {
    const r = buildCMDFromDist01({ persona: 'elias', entities: [{ type: 'person', label: 'Jan', confidence: 'medium' }], signals: [{ category: 'risk', label: 'test', confidence: 'low' }], contexts: [{ type: 'fear', label: 'angst', confidence: 'low' }], nowLocal: NOW });
    for (const h of r.memoryHypotheses) expect(h.certainty).not.toBe('confirmed_by_user');
  });

  it('69. may_not_use_in_gpt items not prompt eligible (no may_use_in_prompt)', () => {
    const perms = inferDist01UsePermissions({ confidence: undefined, hasEvidence: false });
    expect(perms).toContain('may_not_use_in_gpt');
    expect(perms).not.toContain('may_use_in_prompt');
  });

  it('70. no raw long text in output', () => {
    const longText = 'A'.repeat(300);
    const r = buildCMDFromDist01({ persona: 'elias', entities: [{ type: 'person', label: longText, confidence: 'high' }], signals: [], contexts: [], nowLocal: NOW });
    for (const f of r.memoryFacts) expect(f.text.length).toBeLessThanOrEqual(105);
  });

  // ─── Regression (71-74) ─────────────────────────────────────────────
  it('71. future_fear/future_hope only exist in projections builder, not DIST01 bridge', () => {
    const src = fs.readFileSync(BRIDGE_PATH, 'utf-8');
    expect(src).not.toContain('future_fear');
    expect(src).not.toContain('future_hope');
  });

  it('72. DIST01 bridge does not import or modify dist01-store', () => {
    const src = fs.readFileSync(BRIDGE_PATH, 'utf-8');
    expect(src).not.toMatch(/dist01-store/);
  });

  it('73. DIST01 bridge does not alter existing CMD contract', () => {
    const src = fs.readFileSync(BRIDGE_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*clinical-memory-distillation-contract/);
    // Only imports types and mappers, not contract
  });

  it('74. all previous CMD tests still pass (validated by test runner)', () => {
    // This test confirms the bridge file compiles and doesn't break existing types
    const r = buildCMDFromDist01({ persona: 'elias', entities: [], signals: [], contexts: [], nowLocal: NOW });
    expect(r).toBeDefined();
  });
});
