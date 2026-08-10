import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  mapConfidenceToClinicalMemoryCertainty,
  mapTimestampToFreshness,
  mapZoneToVSPZone,
  mapTrend,
  truncateAnchorText,
  buildProjectionMarkersFromProjectionsDat,
  buildBackpackAnchorsFromBackpack,
  buildVSPAnchorsFromVspProfile,
  buildERPAnchorsFromEigenRegiePlan,
  buildProgressTrendSignalsFromStateDat,
  buildDayStructureSignals,
  buildSobrietySignals,
  buildRelapsePlanSignals,
  buildModuleUsageSignalsFromUserDat,
  buildRecurrentPatternsFromUserDat,
  buildRiskAndProtectiveMarkersFromDistillationInput,
  buildClinicalDistillationContextFromParts,
  validateClinicalDistillationContext,
} from '@/lib/engine/shared/clinical-memory-distillation';

const NOW = '2026-08-10T12:00:00Z';

describe('Clinical Memory Distillation Builders — FASE 8C', () => {
  // ─── Projection tests (1-7) ──────────────────────────────────────────
  it('1. fear maps to future_fear', () => {
    const r = buildProjectionMarkersFromProjectionsDat({ persona: 'elias', fears: [{ label: 'terugval', kind: 'fear' }], hopes: [], nowLocal: NOW });
    expect(r[0].projectionType).toBe('future_fear');
  });

  it('2. hope maps to future_hope', () => {
    const r = buildProjectionMarkersFromProjectionsDat({ persona: 'elias', fears: [], hopes: [{ label: 'herstel', kind: 'hope' }], nowLocal: NOW });
    expect(r[0].projectionType).toBe('future_hope');
  });

  it('3. projection never becomes MemoryFact', () => {
    const r = buildProjectionMarkersFromProjectionsDat({ persona: 'elias', fears: [{ label: 'x', kind: 'fear' }], hopes: [], nowLocal: NOW });
    expect(r[0].certainty).not.toBe('confirmed_by_user');
    expect(r[0].certainty).not.toBe('high_confidence_inference');
  });

  it('4. projection requires may_use_only_as_hypothesis', () => {
    const r = buildProjectionMarkersFromProjectionsDat({ persona: 'kim', fears: [{ label: 'x', kind: 'fear' }], hopes: [], nowLocal: NOW });
    expect(r[0].usePermissions).toContain('may_use_only_as_hypothesis');
  });

  it('5. projection requires may_not_use_as_fact', () => {
    const r = buildProjectionMarkersFromProjectionsDat({ persona: 'kim', fears: [{ label: 'x', kind: 'fear' }], hopes: [], nowLocal: NOW });
    expect(r[0].usePermissions).toContain('may_not_use_as_fact');
  });

  it('6. projection userConfirmed defaults false', () => {
    const r = buildProjectionMarkersFromProjectionsDat({ persona: 'elias', fears: [{ label: 'x', kind: 'fear' }], hopes: [], nowLocal: NOW });
    expect(r[0].userConfirmed).toBe(false);
  });

  it('7. projection sourceLayer projections_dat', () => {
    const r = buildProjectionMarkersFromProjectionsDat({ persona: 'elias', fears: [{ label: 'x', kind: 'fear' }], hopes: [], nowLocal: NOW });
    expect(r[0].sourceLayer).toBe('projections_dat');
  });

  // ─── Backpack tests (8-13) ───────────────────────────────────────────
  it('8. backpack creates BackpackAnchor', () => {
    const r = buildBackpackAnchorsFromBackpack({ persona: 'elias', sections: [{ title: 'Levensverhaal', content: 'Ik ben opgegroeid in een klein dorp met veel problemen thuis.' }], nowLocal: NOW });
    expect(r.length).toBe(1);
    expect(r[0].sectionTitle).toBe('Levensverhaal');
  });

  it('9. backpack does not dump full long content', () => {
    const longContent = 'A'.repeat(500);
    const r = buildBackpackAnchorsFromBackpack({ persona: 'elias', sections: [{ title: 'Test', content: longContent }], nowLocal: NOW });
    expect(r[0].anchorText.length).toBeLessThanOrEqual(125); // 120 + "..."
  });

  it('10. backpack sourceLayer backpack', () => {
    const r = buildBackpackAnchorsFromBackpack({ persona: 'kim', sections: [{ title: 'T', content: 'Meaningful content here for testing.' }], nowLocal: NOW });
    expect(r[0].sourceLayer).toBe('backpack');
  });

  it('11. backpack userAuthored true', () => {
    const r = buildBackpackAnchorsFromBackpack({ persona: 'kim', sections: [{ title: 'T', content: 'Some user written text here.' }], nowLocal: NOW });
    expect(r[0].userAuthored).toBe(true);
  });

  it('12. backpack prompt permission only if distilled', () => {
    const r = buildBackpackAnchorsFromBackpack({ persona: 'elias', sections: [{ title: 'T', content: 'Content for testing purposes here.' }], nowLocal: NOW });
    expect(r[0].usePermissions).toContain('may_use_in_formulation');
    expect(r[0].usePermissions).not.toContain('may_use_in_prompt');
  });

  it('13. backpack empty sections returns empty', () => {
    const r = buildBackpackAnchorsFromBackpack({ persona: 'elias', sections: [], nowLocal: NOW });
    expect(r).toEqual([]);
  });

  // ─── VSP tests (14-18) ──────────────────────────────────────────────
  it('14. VSP only Elias', () => {
    const r = buildVSPAnchorsFromVspProfile({ persona: 'elias', signals: [{ zone: 'rood', signal: 'test' }] });
    expect(r.length).toBe(1);
  });

  it('15. VSP Kim returns empty', () => {
    const r = buildVSPAnchorsFromVspProfile({ persona: 'kim', signals: [{ zone: 'rood', signal: 'test' }] });
    expect(r).toEqual([]);
  });

  it('16. VSP zone groen maps green', () => {
    const r = buildVSPAnchorsFromVspProfile({ persona: 'elias', signals: [{ zone: 'groen', signal: 'stabiel' }] });
    expect(r[0].zone).toBe('green');
  });

  it('17. VSP zone paars maps purple', () => {
    const r = buildVSPAnchorsFromVspProfile({ persona: 'elias', signals: [{ zone: 'paars', signal: 'crisis' }] });
    expect(r[0].zone).toBe('purple');
  });

  it('18. VSP usePermissions include safety', () => {
    const r = buildVSPAnchorsFromVspProfile({ persona: 'elias', signals: [{ zone: 'red', signal: 'x' }] });
    expect(r[0].usePermissions).toContain('may_use_for_safety');
  });

  // ─── ERP tests (19-22) ──────────────────────────────────────────────
  it('19. ERP only Kim', () => {
    const r = buildERPAnchorsFromEigenRegiePlan({ persona: 'kim', fields: [{ domain: 'boundary_pressure', signal: 'test' }] });
    expect(r.length).toBe(1);
  });

  it('20. ERP Elias returns empty', () => {
    const r = buildERPAnchorsFromEigenRegiePlan({ persona: 'elias', fields: [{ domain: 'boundary_pressure', signal: 'test' }] });
    expect(r).toEqual([]);
  });

  it('21. ERP sourceLayer eigen_regie_plan', () => {
    const r = buildERPAnchorsFromEigenRegiePlan({ persona: 'kim', fields: [{ domain: 'boundary_pressure', signal: 'test' }] });
    expect(r[0].sourceLayer).toBe('eigen_regie_plan');
  });

  it('22. ERP usePermissions include formulation', () => {
    const r = buildERPAnchorsFromEigenRegiePlan({ persona: 'kim', fields: [{ domain: 'boundary_pressure', signal: 'test' }] });
    expect(r[0].usePermissions).toContain('may_use_in_formulation');
  });

  // ─── State/progress tests (23-28) ───────────────────────────────────
  it('23. state mood trend worsening creates ProgressTrendSignal', () => {
    const history = [{ craving: 3, timestampIso: '2026-08-03T10:00:00Z' }, { craving: 5, timestampIso: '2026-08-05T10:00:00Z' }, { craving: 7, timestampIso: '2026-08-07T10:00:00Z' }, { craving: 8, timestampIso: '2026-08-09T10:00:00Z' }];
    const r = buildProgressTrendSignalsFromStateDat({ persona: 'elias', moodHistory: history, nowLocal: NOW });
    expect(r.some(s => s.direction === 'worsening')).toBe(true);
  });

  it('24. stable trend maps stable', () => {
    const history = [{ craving: 5, timestampIso: '2026-08-03T10:00:00Z' }, { craving: 5, timestampIso: '2026-08-05T10:00:00Z' }, { craving: 5, timestampIso: '2026-08-07T10:00:00Z' }, { craving: 5, timestampIso: '2026-08-09T10:00:00Z' }];
    const r = buildProgressTrendSignalsFromStateDat({ persona: 'elias', moodHistory: history, nowLocal: NOW });
    expect(r.some(s => s.direction === 'stable')).toBe(true);
  });

  it('25. volatile trend maps volatile', () => {
    const history = [{ craving: 2, timestampIso: '1' }, { craving: 9, timestampIso: '2' }, { craving: 1, timestampIso: '3' }, { craving: 8, timestampIso: '4' }, { craving: 2, timestampIso: '5' }];
    const r = buildProgressTrendSignalsFromStateDat({ persona: 'elias', moodHistory: history, nowLocal: NOW });
    expect(r.some(s => s.direction === 'volatile')).toBe(true);
  });

  it('26. insufficient data maps unknown (no signals)', () => {
    const r = buildProgressTrendSignalsFromStateDat({ persona: 'elias', moodHistory: [{ craving: 5, timestampIso: '1' }], nowLocal: NOW });
    expect(r.length).toBe(0);
  });

  it('27. RED/PURPLE safety permission included', () => {
    const history = [{ craving: 8, timestampIso: '1' }, { craving: 9, timestampIso: '2' }, { craving: 9, timestampIso: '3' }];
    const r = buildProgressTrendSignalsFromStateDat({ persona: 'elias', moodHistory: history, currentZone: 'rood', nowLocal: NOW });
    expect(r.some(s => s.usePermissions.includes('may_use_for_safety'))).toBe(true);
  });

  it('28. clinicalInterpretation required', () => {
    const history = [{ craving: 3, timestampIso: '1' }, { craving: 4, timestampIso: '2' }, { craving: 5, timestampIso: '3' }];
    const r = buildProgressTrendSignalsFromStateDat({ persona: 'elias', moodHistory: history, nowLocal: NOW });
    expect(r[0].clinicalInterpretation.length).toBeGreaterThan(0);
  });

  // ─── DayStructure tests (29-33) ─────────────────────────────────────
  it('29. missed blocks creates structure_declining', () => {
    const r = buildDayStructureSignals({ persona: 'elias', completion: { totalBlocks: 10, completedBlocks: 5, missedBlocks: 5 }, nowLocal: NOW });
    expect(r[0].pattern).toBe('structure_declining');
  });

  it('30. many missed blocks creates structure_collapsed', () => {
    const r = buildDayStructureSignals({ persona: 'elias', completion: { totalBlocks: 10, completedBlocks: 1, missedBlocks: 9 }, nowLocal: NOW });
    expect(r[0].pattern).toBe('structure_collapsed');
  });

  it('31. stable completion creates structure_stable', () => {
    const r = buildDayStructureSignals({ persona: 'elias', completion: { totalBlocks: 10, completedBlocks: 8, missedBlocks: 2 }, nowLocal: NOW });
    expect(r[0].pattern).toBe('structure_stable');
  });

  it('32. clinicalInterpretation required', () => {
    const r = buildDayStructureSignals({ persona: 'elias', completion: { totalBlocks: 10, completedBlocks: 5, missedBlocks: 5 }, nowLocal: NOW });
    expect(r[0].clinicalInterpretation.length).toBeGreaterThan(0);
  });

  it('33. no raw schedule dumped', () => {
    const r = buildDayStructureSignals({ persona: 'elias', completion: { totalBlocks: 10, completedBlocks: 5, missedBlocks: 5 }, nowLocal: NOW });
    expect(JSON.stringify(r)).not.toContain('totalBlocks');
  });

  // ─── Sobriety/relapse tests (34-39) ─────────────────────────────────
  it('34. sobriety only Elias', () => {
    const r = buildSobrietySignals({ persona: 'elias', soberDays: 30, recentRelapse: false, relapsePlanAvailable: true });
    expect(r.length).toBe(1);
  });

  it('35. Kim sobriety returns empty', () => {
    const r = buildSobrietySignals({ persona: 'kim', soberDays: 30, recentRelapse: false, relapsePlanAvailable: true });
    expect(r).toEqual([]);
  });

  it('36. recent relapse sets recentRelapse true', () => {
    const r = buildSobrietySignals({ persona: 'elias', recentRelapse: true, relapsePlanAvailable: false });
    expect(r[0].recentRelapse).toBe(true);
  });

  it('37. relapsePlanAvailable mapped', () => {
    const r = buildSobrietySignals({ persona: 'elias', recentRelapse: false, relapsePlanAvailable: true });
    expect(r[0].relapsePlanAvailable).toBe(true);
  });

  it('38. relapse plan maps trigger/action/support', () => {
    const r = buildRelapsePlanSignals({ persona: 'elias', plans: [{ trigger: 'stress', plannedAction: 'bel therapeut', supportAction: 'partner' }] });
    expect(r[0].trigger).toBe('stress');
    expect(r[0].plannedAction).toBe('bel therapeut');
    expect(r[0].supportAction).toBe('partner');
  });

  it('39. relapse plan includes safety permission', () => {
    const r = buildRelapsePlanSignals({ persona: 'elias', plans: [{ trigger: 'x', plannedAction: 'y' }] });
    expect(r[0].usePermissions).toContain('may_use_for_safety');
  });

  // ─── Module/user.dat tests (40-45) ──────────────────────────────────
  it('40. module usage maps ModuleUsageSignal', () => {
    const r = buildModuleUsageSignalsFromUserDat({ persona: 'elias', moduleUsage: [{ moduleId: 'E01', frequency: 5 }] });
    expect(r[0].moduleId).toBe('E01');
    expect(r[0].frequency).toBe(5);
  });

  it('41. missing moduleId skipped', () => {
    const r = buildModuleUsageSignalsFromUserDat({ persona: 'elias', moduleUsage: [{ moduleId: '', frequency: 5 }] });
    expect(r.length).toBe(0);
  });

  it('42. triggerPattern maps RecurrentPattern', () => {
    const r = buildRecurrentPatternsFromUserDat({ persona: 'elias', triggerPatterns: [{ label: 'eenzaamheid', frequency: 3 }], schemaTendencies: [], modeTendencies: [] });
    expect(r[0].pattern).toBe('eenzaamheid');
    expect(r[0].frequency).toBe(3);
  });

  it('43. schema tendency maps as hypothesis not fact', () => {
    const r = buildRecurrentPatternsFromUserDat({ persona: 'elias', triggerPatterns: [], schemaTendencies: [{ schemaName: 'verlating', observationCount: 2, confidenceAverage: 0.5 }], modeTendencies: [] });
    expect(r[0].usePermissions).toContain('may_use_only_as_hypothesis');
    expect(r[0].usePermissions).toContain('may_not_use_as_fact');
  });

  it('44. frequency below 1 rejected', () => {
    const r = buildRecurrentPatternsFromUserDat({ persona: 'elias', triggerPatterns: [{ label: 'x', frequency: 0 }], schemaTendencies: [], modeTendencies: [] });
    expect(r.length).toBe(0);
  });

  it('45. sourceLayer user_dat included', () => {
    const r = buildRecurrentPatternsFromUserDat({ persona: 'elias', triggerPatterns: [{ label: 'x', frequency: 2 }], schemaTendencies: [], modeTendencies: [] });
    expect(r[0].sourceLayers).toContain('user_dat');
  });

  // ─── DIST01-like tests (46-51) ──────────────────────────────────────
  it('46. risk signal maps RiskMarker', () => {
    const r = buildRiskAndProtectiveMarkersFromDistillationInput({ persona: 'elias', signals: [{ signalType: 'risk_pattern_detected', label: 'craving spike', confidence: 'high' }], nowLocal: NOW });
    expect(r.riskMarkers.length).toBe(1);
  });

  it('47. protective signal maps ProtectiveFactor', () => {
    const r = buildRiskAndProtectiveMarkersFromDistillationInput({ persona: 'elias', signals: [{ signalType: 'protective_pattern_detected', label: 'sport', confidence: 'high' }], nowLocal: NOW });
    expect(r.protectiveFactors.length).toBe(1);
  });

  it('48. low confidence maps MemoryHypothesis', () => {
    const r = buildRiskAndProtectiveMarkersFromDistillationInput({ persona: 'elias', signals: [{ signalType: 'risk_pattern_detected', label: 'test', confidence: 'low' }], nowLocal: NOW });
    expect(r.memoryHypotheses.length).toBe(1);
    expect(r.riskMarkers.length).toBe(0);
  });

  it('49. high confidence with evidence maps safely', () => {
    const r = buildRiskAndProtectiveMarkersFromDistillationInput({ persona: 'elias', signals: [{ signalType: 'risk_pattern_detected', label: 'test', confidence: 'high' }], nowLocal: NOW });
    expect(r.riskMarkers[0].evidence.length).toBeGreaterThan(0);
  });

  it('50. evidence required for RiskMarker', () => {
    const r = buildRiskAndProtectiveMarkersFromDistillationInput({ persona: 'elias', signals: [{ signalType: 'risk_pattern_detected', label: 'x', confidence: 'high' }], nowLocal: NOW });
    expect(r.riskMarkers[0].evidence.length).toBeGreaterThan(0);
  });

  it('51. evidence required for ProtectiveFactor', () => {
    const r = buildRiskAndProtectiveMarkersFromDistillationInput({ persona: 'elias', signals: [{ signalType: 'protective_pattern_detected', label: 'x', confidence: 'high' }], nowLocal: NOW });
    expect(r.protectiveFactors[0].evidence.length).toBeGreaterThan(0);
  });

  // ─── Context assembly tests (52-63) ─────────────────────────────────
  it('52. empty parts create valid ClinicalDistillationContext', () => {
    const ctx = buildClinicalDistillationContextFromParts({ persona: 'elias', nowLocal: NOW });
    const { ok } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(true);
  });

  it('53. mixed safe parts validate ok', () => {
    const projections = buildProjectionMarkersFromProjectionsDat({ persona: 'elias', fears: [{ label: 'terugval', kind: 'fear' }], hopes: [], nowLocal: NOW });
    const ctx = buildClinicalDistillationContextFromParts({ persona: 'elias', projectionMarkers: projections, nowLocal: NOW });
    const { ok } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(true);
  });

  it('54. Kim context rejects Elias-only signals', () => {
    const vsp = buildVSPAnchorsFromVspProfile({ persona: 'elias', signals: [{ zone: 'red', signal: 'x' }] });
    const ctx = buildClinicalDistillationContextFromParts({ persona: 'kim', vspAnchors: vsp, nowLocal: NOW });
    const { ok } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
  });

  it('55. Elias context rejects Kim-only signals', () => {
    const erp = buildERPAnchorsFromEigenRegiePlan({ persona: 'kim', fields: [{ domain: 'boundary_pressure', signal: 'x' }] });
    const ctx = buildClinicalDistillationContextFromParts({ persona: 'elias', erpAnchors: erp, nowLocal: NOW });
    const { ok } = validateClinicalDistillationContext(ctx);
    expect(ok).toBe(false);
  });

  it('56. sourceLayersUsed derived correctly', () => {
    const projections = buildProjectionMarkersFromProjectionsDat({ persona: 'elias', fears: [{ label: 'x', kind: 'fear' }], hopes: [], nowLocal: NOW });
    const ctx = buildClinicalDistillationContextFromParts({ persona: 'elias', projectionMarkers: projections, nowLocal: NOW });
    expect(ctx.sourceLayersUsed).toContain('projections_dat');
  });

  it('57. dataClasses derived correctly', () => {
    const projections = buildProjectionMarkersFromProjectionsDat({ persona: 'elias', fears: [{ label: 'x', kind: 'fear' }], hopes: [], nowLocal: NOW });
    const ctx = buildClinicalDistillationContextFromParts({ persona: 'elias', projectionMarkers: projections, nowLocal: NOW });
    expect(ctx.dataClasses).toContain('hypothesis_not_fact');
  });

  it('58. maxPromptTokens defaults 600', () => {
    const ctx = buildClinicalDistillationContextFromParts({ persona: 'elias', nowLocal: NOW });
    expect(ctx.formulationInput.maxPromptTokens).toBe(600);
  });

  it('59. maxPromptTokens hard capped at 1200', () => {
    const ctx = buildClinicalDistillationContextFromParts({ persona: 'elias', nowLocal: NOW, maxPromptTokens: 5000 });
    expect(ctx.formulationInput.maxPromptTokens).toBeLessThanOrEqual(1200);
  });

  it('60. shouldRefreshMidSession true for acute risk', () => {
    const ctx = buildClinicalDistillationContextFromParts({ persona: 'elias', riskMarkers: [{ id: 'r1', persona: 'elias', domain: 'relapse_risk', risk: 'acute', severity: 'acute', trend: 'increasing', evidence: [{ id: 'e', sourceLayer: 'distillation_dat', sourceField: 'x', text: 'x', confidence: 'high', persona: 'elias', isUserAuthored: false }], usePermissions: [] }], nowLocal: NOW });
    expect(ctx.shouldRefreshMidSession).toBe(true);
  });

  it('61. shouldRefreshMidSession true for structure_collapsed', () => {
    const ctx = buildClinicalDistillationContextFromParts({ persona: 'elias', dayStructureSignals: [{ id: 'd1', persona: 'elias', pattern: 'structure_collapsed', clinicalInterpretation: 'collapsed', usePermissions: [] }], nowLocal: NOW });
    expect(ctx.shouldRefreshMidSession).toBe(true);
  });

  it('62. shouldRefreshMidSession true for recentRelapse', () => {
    const sobriety = buildSobrietySignals({ persona: 'elias', recentRelapse: true, relapsePlanAvailable: false });
    const ctx = buildClinicalDistillationContextFromParts({ persona: 'elias', sobrietySignals: sobriety, nowLocal: NOW });
    expect(ctx.shouldRefreshMidSession).toBe(true);
  });

  it('63. shouldRefreshMidSession false for stable low-risk context', () => {
    const ctx = buildClinicalDistillationContextFromParts({ persona: 'elias', nowLocal: NOW });
    expect(ctx.shouldRefreshMidSession).toBe(false);
  });

  // ─── Import purity tests (64-71) ───────────────────────────────────
  const BUILDERS_PATH = path.resolve(__dirname, '../../../lib/engine/shared/clinical-memory-distillation/clinical-memory-distillation-builders.ts');
  const MAPPERS_PATH = path.resolve(__dirname, '../../../lib/engine/shared/clinical-memory-distillation/clinical-memory-distillation-mappers.ts');

  it('64. no server imports', () => {
    const src = fs.readFileSync(BUILDERS_PATH, 'utf-8') + fs.readFileSync(MAPPERS_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*server\//);
  });

  it('65. no AsyncStorage imports', () => {
    const src = fs.readFileSync(BUILDERS_PATH, 'utf-8') + fs.readFileSync(MAPPERS_PATH, 'utf-8');
    expect(src).not.toMatch(/import.*AsyncStorage/);
    expect(src).not.toMatch(/import.*@react-native-async-storage/);
  });

  it('66. no pipeline imports', () => {
    const src = fs.readFileSync(BUILDERS_PATH, 'utf-8') + fs.readFileSync(MAPPERS_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*pipeline/);
    expect(src).not.toMatch(/from\s+['"].*rugzak\/pipeline/);
  });

  it('67. no prompt imports', () => {
    const src = fs.readFileSync(BUILDERS_PATH, 'utf-8') + fs.readFileSync(MAPPERS_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*\/prompt/);
  });

  it('68. no openai-provider imports', () => {
    const src = fs.readFileSync(BUILDERS_PATH, 'utf-8') + fs.readFileSync(MAPPERS_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*openai-provider/);
  });

  it('69. no Kim formulation imports', () => {
    const src = fs.readFileSync(BUILDERS_PATH, 'utf-8') + fs.readFileSync(MAPPERS_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*kim.*formulation/);
  });

  it('70. no Elias formulation imports', () => {
    const src = fs.readFileSync(BUILDERS_PATH, 'utf-8') + fs.readFileSync(MAPPERS_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*elias.*formulation/);
  });

  it('71. no nano imports', () => {
    const src = fs.readFileSync(BUILDERS_PATH, 'utf-8') + fs.readFileSync(MAPPERS_PATH, 'utf-8');
    expect(src).not.toMatch(/from\s+['"].*nano/);
  });
});
