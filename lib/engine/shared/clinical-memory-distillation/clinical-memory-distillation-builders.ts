/**
 * Clinical Memory Distillation — Pure Builders
 *
 * FASE 8C: Pure builder functions that map existing RecoFree memory layers
 * to the CMD contract types. No runtime integration.
 * No AsyncStorage, no server, no pipeline, no prompt, no side effects.
 */
import type {
  ClinicalMemoryPersona,
  ClinicalMemorySourceLayer,
  ClinicalMemoryDomain,
  ClinicalMemoryUsePermission,
  ProjectionMarker,
  BackpackAnchor,
  VSPAnchor,
  ERPAnchor,
  ProgressTrendSignal,
  DayStructureSignal,
  SobrietySignal,
  RelapsePlanSignal,
  ModuleUsageSignal,
  RecurrentPattern,
  RiskMarker,
  ProtectiveFactor,
  MemoryHypothesis,
  MemoryFact,
  MemoryEvidenceItem,
  BufferSignal,
  ClinicalDistillationContext,
  FormulationMemoryInput,
} from './clinical-memory-distillation-types';
import {
  validateClinicalDistillationContext,
  classifyMemoryLayerForCMD,
} from './clinical-memory-distillation-contract';
import {
  mapConfidenceToClinicalMemoryCertainty,
  mapTimestampToFreshness,
  mapZoneToVSPZone,
  mapTrend,
  truncateAnchorText,
} from './clinical-memory-distillation-mappers';

// ─── Input Types (minimal compatible, not importing existing files) ─────────

export interface ProjectionInput {
  projectionId?: string;
  label: string;
  kind: 'fear' | 'hope';
  currentScore?: number;
  baseConfidence?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  decayHalfLifeDays?: number;
  userConfirmed?: boolean;
}

export interface BackpackSectionInput {
  title: string;
  content: string;
}

export interface VSPSignalInput {
  zone: string;
  signal: string;
  action?: string | null;
  confidence?: 'low' | 'medium' | 'high';
}

export interface ERPFieldInput {
  domain: string;
  signal: string;
  boundaryOrAction?: string | null;
  confidence?: 'low' | 'medium' | 'high';
}

export interface MoodHistoryInput {
  craving?: number;
  stress?: number;
  frustration?: number;
  despondency?: number;
  focus?: number;
  boundaryFatigue?: number;
  emotionalBurden?: number;
  selfCare?: number;
  timestampIso: string;
}

export interface ModuleUsageInput {
  moduleId: string;
  frequency: number;
  lastUsedLocal?: string;
  repeatedInSession?: boolean;
}

export interface TriggerPatternInput {
  triggerId?: string;
  label: string;
  frequency: number;
  lastConfidence?: number;
  highestConfidence?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export interface SchemaTendencyInput {
  schemaId?: string;
  schemaName: string;
  observationCount: number;
  confidenceAverage?: number;
  confidencePeak?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export interface ModeTendencyInput {
  modeId?: string;
  modeName: string;
  observationCount: number;
  confidenceAverage?: number;
  confidencePeak?: number;
}

export interface CaregiverPatternInput {
  type: string;
  description: string;
  confidence?: number;
  sourceSectionId?: string;
}

export interface DistillationSignalInput {
  id?: string;
  signalType: string;
  label: string;
  confidence: 'low' | 'medium' | 'high';
  firstSeenAt?: string;
  lastSeenAt?: string;
  mentionCount?: number;
  isUserAuthored?: boolean;
}

export interface DayStructureCompletionInput {
  totalBlocks: number;
  completedBlocks: number;
  missedBlocks: number;
  lastCompletedAt?: string;
}

export interface RelapsePlanInput {
  trigger?: string | null;
  plannedAction?: string | null;
  supportAction?: string | null;
  medicalSafetyNote?: string | null;
}

// ─── 1. buildProjectionMarkersFromProjectionsDat ───────────────────────────
export function buildProjectionMarkersFromProjectionsDat(input: {
  persona: ClinicalMemoryPersona;
  fears: ProjectionInput[];
  hopes: ProjectionInput[];
  nowLocal: string;
}): ProjectionMarker[] {
  const { persona, fears, hopes, nowLocal } = input;
  const markers: ProjectionMarker[] = [];

  for (const fear of fears) {
    markers.push({
      id: fear.projectionId || `proj_fear_${fear.label.slice(0, 20).replace(/\s/g, '_')}`,
      persona,
      projectionType: 'future_fear',
      text: fear.label,
      sourceLayer: 'projections_dat',
      certainty: 'projection',
      evidence: [{
        id: `ev_${fear.projectionId || fear.label.slice(0, 10)}`,
        sourceLayer: 'projections_dat',
        sourceField: 'fears',
        text: fear.label,
        timestampLocal: fear.lastSeenAt,
        confidence: (fear.baseConfidence ?? 0) >= 0.7 ? 'high' : (fear.baseConfidence ?? 0) >= 0.4 ? 'medium' : 'low',
        persona,
        isUserAuthored: false,
      }],
      usePermissions: ['may_use_only_as_hypothesis', 'may_not_use_as_fact', 'may_use_in_formulation'],
      decayApplied: fear.currentScore !== undefined && fear.currentScore < (fear.baseConfidence ?? 1),
      userConfirmed: fear.userConfirmed === true,
      createdAtLocal: fear.firstSeenAt || nowLocal,
      updatedAtLocal: fear.lastSeenAt || nowLocal,
    });
  }

  for (const hope of hopes) {
    markers.push({
      id: hope.projectionId || `proj_hope_${hope.label.slice(0, 20).replace(/\s/g, '_')}`,
      persona,
      projectionType: 'future_hope',
      text: hope.label,
      sourceLayer: 'projections_dat',
      certainty: 'projection',
      evidence: [{
        id: `ev_${hope.projectionId || hope.label.slice(0, 10)}`,
        sourceLayer: 'projections_dat',
        sourceField: 'hopes',
        text: hope.label,
        timestampLocal: hope.lastSeenAt,
        confidence: (hope.baseConfidence ?? 0) >= 0.7 ? 'high' : (hope.baseConfidence ?? 0) >= 0.4 ? 'medium' : 'low',
        persona,
        isUserAuthored: false,
      }],
      usePermissions: ['may_use_only_as_hypothesis', 'may_not_use_as_fact', 'may_use_in_formulation'],
      decayApplied: hope.currentScore !== undefined && hope.currentScore < (hope.baseConfidence ?? 1),
      userConfirmed: hope.userConfirmed === true,
      createdAtLocal: hope.firstSeenAt || nowLocal,
      updatedAtLocal: hope.lastSeenAt || nowLocal,
    });
  }

  return markers;
}

// ─── 2. buildBackpackAnchorsFromBackpack ───────────────────────────────────
const MAX_ANCHOR_LENGTH = 120;

export function buildBackpackAnchorsFromBackpack(input: {
  persona: ClinicalMemoryPersona;
  sections: BackpackSectionInput[];
  nowLocal: string;
}): BackpackAnchor[] {
  const { persona, sections, nowLocal } = input;
  const anchors: BackpackAnchor[] = [];

  for (const section of sections) {
    if (!section.content || section.content.trim().length < 10) continue;
    const text = truncateAnchorText(section.content, MAX_ANCHOR_LENGTH);
    if (!text) continue;
    anchors.push({
      id: `bp_${section.title.slice(0, 20).replace(/\s/g, '_')}_${persona}`,
      persona,
      sectionTitle: section.title,
      anchorText: text,
      domain: 'unknown',
      emotionalWeight: 'medium',
      sourceLayer: 'backpack',
      userAuthored: true,
      freshness: 'unknown',
      usePermissions: ['may_use_in_formulation'],
    });
  }

  return anchors;
}

// ─── 3. buildVSPAnchorsFromVspProfile ─────────────────────────────────────
export function buildVSPAnchorsFromVspProfile(input: {
  persona: ClinicalMemoryPersona;
  signals: VSPSignalInput[];
}): VSPAnchor[] {
  if (input.persona !== 'elias') return [];

  return input.signals.map((s, i) => ({
    id: `vsp_${i}_${s.zone.slice(0, 5)}`,
    persona: 'elias' as const,
    zone: mapZoneToVSPZone(s.zone),
    signal: s.signal,
    action: s.action ?? null,
    sourceLayer: 'vsp' as const,
    confidence: s.confidence || 'medium',
    usePermissions: ['may_use_in_formulation', 'may_use_for_safety', 'may_use_for_routing'] as ClinicalMemoryUsePermission[],
  }));
}

// ─── 4. buildERPAnchorsFromEigenRegiePlan ─────────────────────────────────
export function buildERPAnchorsFromEigenRegiePlan(input: {
  persona: ClinicalMemoryPersona;
  fields: ERPFieldInput[];
}): ERPAnchor[] {
  if (input.persona !== 'kim') return [];

  return input.fields.map((f, i) => ({
    id: `erp_${i}_${f.domain.slice(0, 10)}`,
    persona: 'kim' as const,
    domain: (f.domain || 'unknown') as ClinicalMemoryDomain,
    signal: f.signal,
    boundaryOrAction: f.boundaryOrAction ?? null,
    sourceLayer: 'eigen_regie_plan' as const,
    confidence: f.confidence || 'medium',
    usePermissions: ['may_use_in_formulation', 'may_use_for_safety', 'may_use_for_greeting'] as ClinicalMemoryUsePermission[],
  }));
}

// ─── 5. buildProgressTrendSignalsFromStateDat ─────────────────────────────
export function buildProgressTrendSignalsFromStateDat(input: {
  persona: ClinicalMemoryPersona;
  moodHistory: MoodHistoryInput[];
  currentZone?: string;
  nowLocal: string;
}): ProgressTrendSignal[] {
  const { persona, moodHistory, currentZone, nowLocal } = input;
  const signals: ProgressTrendSignal[] = [];
  if (moodHistory.length < 3) return signals;

  // Extract craving trend (Elias)
  const cravingValues = moodHistory.filter(m => m.craving !== undefined).map(m => m.craving!);
  if (cravingValues.length >= 3) {
    const direction = mapTrend(cravingValues);
    const isHighRisk = currentZone && ['red', 'rood', 'purple', 'paars'].includes(currentZone.toLowerCase());
    const perms: ClinicalMemoryUsePermission[] = ['may_use_in_formulation', 'may_use_only_if_recent'];
    if (isHighRisk || (cravingValues[cravingValues.length - 1] ?? 0) >= 7) perms.push('may_use_for_safety');
    signals.push({
      id: `trend_craving_${persona}`,
      persona,
      domain: 'craving',
      metric: 'craving',
      window: cravingValues.length >= 7 ? 'seven_days' : 'session',
      direction,
      clinicalInterpretation: `Craving trend ${direction} over ${cravingValues.length} measurements`,
      certainty: mapConfidenceToClinicalMemoryCertainty(cravingValues.length >= 5 ? 'medium' : 'low'),
      usePermissions: perms,
    });
  }

  // Extract stress trend
  const stressValues = moodHistory.filter(m => m.stress !== undefined).map(m => m.stress!);
  if (stressValues.length >= 3) {
    const direction = mapTrend(stressValues);
    signals.push({
      id: `trend_stress_${persona}`,
      persona,
      domain: 'emotional_overload',
      metric: 'stress',
      window: stressValues.length >= 7 ? 'seven_days' : 'session',
      direction,
      clinicalInterpretation: `Stress trend ${direction} over ${stressValues.length} measurements`,
      certainty: mapConfidenceToClinicalMemoryCertainty(stressValues.length >= 5 ? 'medium' : 'low'),
      usePermissions: ['may_use_in_formulation', 'may_use_only_if_recent'],
    });
  }

  return signals;
}

// ─── 6. buildDayStructureSignals ──────────────────────────────────────────
export function buildDayStructureSignals(input: {
  persona: ClinicalMemoryPersona;
  completion?: DayStructureCompletionInput | null;
  nowLocal: string;
}): DayStructureSignal[] {
  const { persona, completion } = input;
  if (!completion) return [];

  const { totalBlocks, completedBlocks, missedBlocks } = completion;
  if (totalBlocks === 0) return [];

  const completionRate = completedBlocks / totalBlocks;
  let pattern: 'structure_stable' | 'structure_declining' | 'structure_collapsed' | 'unknown';
  let interpretation: string;

  if (completionRate >= 0.7) {
    pattern = 'structure_stable';
    interpretation = 'Day structure is maintained with good adherence';
  } else if (completionRate >= 0.3) {
    pattern = 'structure_declining';
    interpretation = 'Day structure is declining — possible early warning signal';
  } else {
    pattern = 'structure_collapsed';
    interpretation = 'Day structure has collapsed — significant early warning signal for destabilization';
  }

  return [{
    id: `daystructure_${persona}`,
    persona,
    pattern,
    missedBlocks,
    completionTrend: completionRate >= 0.7 ? 'stable' : completionRate >= 0.3 ? 'worsening' : 'worsening',
    clinicalInterpretation: interpretation,
    usePermissions: ['may_use_in_formulation', 'may_use_only_if_recent'],
  }];
}

// ─── 7. buildSobrietySignals ──────────────────────────────────────────────
export function buildSobrietySignals(input: {
  persona: ClinicalMemoryPersona;
  soberDays?: number | null;
  relapseEvents?: number | null;
  recentRelapse: boolean;
  relapsePlanAvailable: boolean;
}): SobrietySignal[] {
  if (input.persona !== 'elias') return [];

  let interpretation: string;
  if (input.recentRelapse) {
    interpretation = 'Recent relapse detected — recovery support and safety monitoring active';
  } else if ((input.soberDays ?? 0) > 30) {
    interpretation = `${input.soberDays} days sober — sustained recovery period`;
  } else if ((input.soberDays ?? 0) > 0) {
    interpretation = `${input.soberDays} days sober — early recovery phase`;
  } else {
    interpretation = 'Sobriety status unclear or not tracked';
  }

  return [{
    id: `sobriety_${input.persona}`,
    persona: 'elias',
    soberDays: input.soberDays ?? null,
    relapseEvents: input.relapseEvents ?? null,
    recentRelapse: input.recentRelapse,
    relapsePlanAvailable: input.relapsePlanAvailable,
    clinicalInterpretation: interpretation,
    usePermissions: ['may_use_in_formulation', 'may_use_for_safety', 'may_use_for_greeting'],
  }];
}

// ─── 8. buildRelapsePlanSignals ───────────────────────────────────────────
export function buildRelapsePlanSignals(input: {
  persona: ClinicalMemoryPersona;
  plans: RelapsePlanInput[];
}): RelapsePlanSignal[] {
  if (input.persona !== 'elias') return [];

  return input.plans.filter(p => p.trigger || p.plannedAction || p.supportAction).map((p, i) => ({
    id: `relapse_plan_${i}`,
    persona: 'elias' as const,
    trigger: p.trigger ?? null,
    plannedAction: p.plannedAction ?? null,
    supportAction: p.supportAction ?? null,
    medicalSafetyNote: p.medicalSafetyNote ?? null,
    sourceLayer: 'relapse_plan' as const,
    usePermissions: ['may_use_in_formulation', 'may_use_for_safety', 'may_use_for_routing'] as ClinicalMemoryUsePermission[],
  }));
}

// ─── 9. buildModuleUsageSignalsFromUserDat ────────────────────────────────
export function buildModuleUsageSignalsFromUserDat(input: {
  persona: ClinicalMemoryPersona;
  moduleUsage: ModuleUsageInput[];
}): ModuleUsageSignal[] {
  return input.moduleUsage
    .filter(m => m.moduleId && m.frequency >= 1)
    .map(m => ({
      id: `module_${m.moduleId}_${input.persona}`,
      persona: input.persona,
      moduleId: m.moduleId,
      frequency: m.frequency,
      repeatedInSession: m.repeatedInSession ?? false,
      effectiveness: 'unknown' as const,
      lastUsedLocal: m.lastUsedLocal,
      usePermissions: ['may_use_in_formulation', 'may_use_for_routing'] as ClinicalMemoryUsePermission[],
    }));
}

// ─── 10. buildRecurrentPatternsFromUserDat ────────────────────────────────
export function buildRecurrentPatternsFromUserDat(input: {
  persona: ClinicalMemoryPersona;
  triggerPatterns: TriggerPatternInput[];
  schemaTendencies: SchemaTendencyInput[];
  modeTendencies: ModeTendencyInput[];
  caregiverPatterns?: CaregiverPatternInput[];
}): RecurrentPattern[] {
  const { persona, triggerPatterns, schemaTendencies, modeTendencies, caregiverPatterns = [] } = input;
  const patterns: RecurrentPattern[] = [];

  for (const t of triggerPatterns) {
    if (t.frequency < 1) continue;
    const conf = (t.highestConfidence ?? t.lastConfidence ?? 0) >= 0.7 ? 'high' : (t.highestConfidence ?? t.lastConfidence ?? 0) >= 0.4 ? 'medium' : 'low';
    patterns.push({
      id: t.triggerId || `trigger_${t.label.slice(0, 15).replace(/\s/g, '_')}`,
      persona,
      domain: 'unknown',
      pattern: t.label,
      frequency: t.frequency,
      trend: 'unknown',
      sourceLayers: ['user_dat'],
      evidence: [{
        id: `ev_trigger_${t.label.slice(0, 10)}`,
        sourceLayer: 'user_dat',
        sourceField: 'triggerPatterns',
        text: t.label,
        timestampLocal: t.lastSeenAt,
        confidence: conf,
        persona,
        isUserAuthored: false,
      }],
      certainty: mapConfidenceToClinicalMemoryCertainty(conf),
      firstSeenLocal: t.firstSeenAt,
      lastSeenLocal: t.lastSeenAt,
      usePermissions: ['may_use_in_formulation', 'may_use_only_as_hypothesis', 'may_not_use_as_fact'],
    });
  }

  for (const s of schemaTendencies) {
    if (s.observationCount < 1) continue;
    const conf = (s.confidencePeak ?? s.confidenceAverage ?? 0) >= 0.7 ? 'high' : 'medium';
    patterns.push({
      id: s.schemaId || `schema_${s.schemaName.slice(0, 15).replace(/\s/g, '_')}`,
      persona,
      domain: 'unknown',
      pattern: s.schemaName,
      frequency: s.observationCount,
      trend: 'unknown',
      sourceLayers: ['user_dat'],
      evidence: [{
        id: `ev_schema_${s.schemaName.slice(0, 10)}`,
        sourceLayer: 'user_dat',
        sourceField: 'schemaTendencies',
        text: s.schemaName,
        timestampLocal: s.lastSeenAt,
        confidence: conf,
        persona,
        isUserAuthored: false,
      }],
      certainty: mapConfidenceToClinicalMemoryCertainty(conf),
      firstSeenLocal: s.firstSeenAt,
      lastSeenLocal: s.lastSeenAt,
      usePermissions: ['may_use_in_formulation', 'may_use_only_as_hypothesis', 'may_not_use_as_fact'],
    });
  }

  for (const m of modeTendencies) {
    if (m.observationCount < 1) continue;
    patterns.push({
      id: m.modeId || `mode_${m.modeName.slice(0, 15).replace(/\s/g, '_')}`,
      persona,
      domain: 'unknown',
      pattern: m.modeName,
      frequency: m.observationCount,
      trend: 'unknown',
      sourceLayers: ['user_dat'],
      evidence: [{
        id: `ev_mode_${m.modeName.slice(0, 10)}`,
        sourceLayer: 'user_dat',
        sourceField: 'modeTendencies',
        text: m.modeName,
        confidence: (m.confidencePeak ?? m.confidenceAverage ?? 0) >= 0.7 ? 'high' : 'medium',
        persona,
        isUserAuthored: false,
      }],
      certainty: mapConfidenceToClinicalMemoryCertainty((m.confidencePeak ?? 0) >= 0.7 ? 'high' : 'medium'),
      usePermissions: ['may_use_in_formulation', 'may_use_only_as_hypothesis', 'may_not_use_as_fact'],
    });
  }

  if (persona === 'kim') {
    for (const pattern of caregiverPatterns) {
      if (!pattern?.description?.trim()) continue;
      const confidence = (pattern.confidence ?? 0) >= 0.7 ? 'high' : 'medium';
      patterns.push({
        id: `caregiver_${pattern.type}_${pattern.sourceSectionId ?? 'local'}`,
        persona,
        domain: 'relationship_trigger',
        pattern: pattern.description,
        frequency: 1,
        trend: 'unknown',
        sourceLayers: ['user_dat'],
        evidence: [{
          id: `ev_caregiver_${pattern.type}`,
          sourceLayer: 'user_dat',
          sourceField: 'caregiverPatterns',
          text: pattern.description,
          confidence,
          persona,
          isUserAuthored: false,
        }],
        certainty: mapConfidenceToClinicalMemoryCertainty(confidence),
        usePermissions: ['may_use_in_formulation', 'may_use_only_as_hypothesis', 'may_not_use_as_fact'],
      });
    }
  }

  return patterns;
}

// ─── 11. buildRiskAndProtectiveMarkersFromDistillationInput ───────────────
export function buildRiskAndProtectiveMarkersFromDistillationInput(input: {
  persona: ClinicalMemoryPersona;
  signals: DistillationSignalInput[];
  nowLocal: string;
}): { riskMarkers: RiskMarker[]; protectiveFactors: ProtectiveFactor[]; memoryHypotheses: MemoryHypothesis[] } {
  const { persona, signals, nowLocal } = input;
  const riskMarkers: RiskMarker[] = [];
  const protectiveFactors: ProtectiveFactor[] = [];
  const memoryHypotheses: MemoryHypothesis[] = [];

  for (const s of signals) {
    const evidence: MemoryEvidenceItem[] = [{
      id: `ev_dist_${s.id || s.label.slice(0, 10)}`,
      sourceLayer: 'distillation_dat',
      sourceField: s.signalType,
      text: s.label,
      timestampLocal: s.lastSeenAt,
      confidence: s.confidence,
      persona,
      isUserAuthored: s.isUserAuthored ?? false,
    }];

    if (s.signalType === 'risk_pattern_detected') {
      if (s.confidence === 'high') {
        riskMarkers.push({
          id: s.id || `risk_${s.label.slice(0, 15)}`,
          persona,
          domain: 'risk_marker',
          risk: s.label,
          severity: (s.mentionCount ?? 1) >= 5 ? 'high' : (s.mentionCount ?? 1) >= 2 ? 'medium' : 'low',
          trend: 'unknown',
          evidence,
          usePermissions: ['may_use_in_formulation', 'may_use_for_safety'],
        });
      } else {
        memoryHypotheses.push({
          id: s.id || `hyp_risk_${s.label.slice(0, 15)}`,
          persona,
          domain: 'risk_marker',
          hypothesis: s.label,
          sourceLayer: 'distillation_dat',
          certainty: mapConfidenceToClinicalMemoryCertainty(s.confidence),
          evidence,
          usePermissions: ['may_use_only_as_hypothesis', 'may_not_use_as_fact', 'may_use_in_formulation'],
          needsUserConfirmation: true,
          createdAtLocal: s.firstSeenAt || nowLocal,
          updatedAtLocal: s.lastSeenAt || nowLocal,
        });
      }
    } else if (s.signalType === 'protective_pattern_detected') {
      if (s.confidence === 'high') {
        protectiveFactors.push({
          id: s.id || `prot_${s.label.slice(0, 15)}`,
          persona,
          domain: 'protective_factor',
          factor: s.label,
          strength: (s.mentionCount ?? 1) >= 5 ? 'high' : (s.mentionCount ?? 1) >= 2 ? 'medium' : 'low',
          evidence,
          usePermissions: ['may_use_in_formulation'],
        });
      } else {
        memoryHypotheses.push({
          id: s.id || `hyp_prot_${s.label.slice(0, 15)}`,
          persona,
          domain: 'protective_factor',
          hypothesis: s.label,
          sourceLayer: 'distillation_dat',
          certainty: mapConfidenceToClinicalMemoryCertainty(s.confidence),
          evidence,
          usePermissions: ['may_use_only_as_hypothesis', 'may_not_use_as_fact', 'may_use_in_formulation'],
          needsUserConfirmation: true,
          createdAtLocal: s.firstSeenAt || nowLocal,
          updatedAtLocal: s.lastSeenAt || nowLocal,
        });
      }
    }
  }

  return { riskMarkers, protectiveFactors, memoryHypotheses };
}

// ─── 12. buildClinicalDistillationContextFromParts ────────────────────────
export function buildClinicalDistillationContextFromParts(input: {
  persona: ClinicalMemoryPersona;
  projectionMarkers?: ProjectionMarker[];
  backpackAnchors?: BackpackAnchor[];
  vspAnchors?: VSPAnchor[];
  erpAnchors?: ERPAnchor[];
  recurrentPatterns?: RecurrentPattern[];
  riskMarkers?: RiskMarker[];
  protectiveFactors?: ProtectiveFactor[];
  bufferSignals?: BufferSignal[];
  moduleUsageSignals?: ModuleUsageSignal[];
  progressTrendSignals?: ProgressTrendSignal[];
  dayStructureSignals?: DayStructureSignal[];
  sobrietySignals?: SobrietySignal[];
  relapsePlanSignals?: RelapsePlanSignal[];
  memoryFacts?: MemoryFact[];
  memoryHypotheses?: MemoryHypothesis[];
  nowLocal: string;
  maxPromptTokens?: number;
}): ClinicalDistillationContext {
  const { persona, nowLocal } = input;
  const maxTokens = Math.min(Math.max(input.maxPromptTokens ?? 600, 1), 1200);

  // Collect all source layers used
  const sourceLayers = new Set<ClinicalMemorySourceLayer>();
  if ((input.projectionMarkers?.length ?? 0) > 0) sourceLayers.add('projections_dat');
  if ((input.backpackAnchors?.length ?? 0) > 0) sourceLayers.add('backpack');
  if ((input.vspAnchors?.length ?? 0) > 0) sourceLayers.add('vsp');
  if ((input.erpAnchors?.length ?? 0) > 0) sourceLayers.add('eigen_regie_plan');
  if ((input.recurrentPatterns?.length ?? 0) > 0) sourceLayers.add('user_dat');
  if ((input.riskMarkers?.length ?? 0) > 0) sourceLayers.add('distillation_dat');
  if ((input.protectiveFactors?.length ?? 0) > 0) sourceLayers.add('distillation_dat');
  if ((input.bufferSignals?.length ?? 0) > 0) sourceLayers.add('buffer');
  if ((input.moduleUsageSignals?.length ?? 0) > 0) sourceLayers.add('module_memory');
  if ((input.progressTrendSignals?.length ?? 0) > 0) sourceLayers.add('state_dat');
  if ((input.dayStructureSignals?.length ?? 0) > 0) sourceLayers.add('day_structure');
  if ((input.sobrietySignals?.length ?? 0) > 0) sourceLayers.add('sobriety');
  if ((input.relapsePlanSignals?.length ?? 0) > 0) sourceLayers.add('relapse_plan');

  // Derive data classes
  const dataClassSet = new Set<string>();
  for (const layer of sourceLayers) {
    for (const dc of classifyMemoryLayerForCMD(layer)) {
      dataClassSet.add(dc);
    }
  }

  // Determine shouldRefreshMidSession
  const hasAcuteRisk = (input.riskMarkers ?? []).some(r => r.severity === 'acute');
  const hasCollapsedStructure = (input.dayStructureSignals ?? []).some(d => d.pattern === 'structure_collapsed');
  const hasRecentRelapse = (input.sobrietySignals ?? []).some(s => s.recentRelapse);
  const hasHighRiskBuffer = (input.bufferSignals ?? []).some(b => b.domain === 'safety' || b.domain === 'relapse_risk');
  const shouldRefresh = hasAcuteRisk || hasCollapsedStructure || hasRecentRelapse || hasHighRiskBuffer;

  const formulationInput: FormulationMemoryInput = {
    persona,
    memoryFacts: input.memoryFacts ?? [],
    memoryHypotheses: input.memoryHypotheses ?? [],
    recurrentPatterns: input.recurrentPatterns ?? [],
    recoveryChains: [],
    relationalPatterns: [],
    backpackAnchors: input.backpackAnchors ?? [],
    vspAnchors: input.vspAnchors ?? [],
    erpAnchors: input.erpAnchors ?? [],
    riskMarkers: input.riskMarkers ?? [],
    protectiveFactors: input.protectiveFactors ?? [],
    projectionMarkers: input.projectionMarkers ?? [],
    bufferSignals: input.bufferSignals ?? [],
    moduleUsageSignals: input.moduleUsageSignals ?? [],
    progressTrendSignals: input.progressTrendSignals ?? [],
    dayStructureSignals: input.dayStructureSignals ?? [],
    sobrietySignals: input.sobrietySignals ?? [],
    relapsePlanSignals: input.relapsePlanSignals ?? [],
    maxPromptTokens: maxTokens,
  };

  const context: ClinicalDistillationContext = {
    schemaVersion: 'clinical_memory_distillation_v1',
    persona,
    sourceLayersUsed: [...sourceLayers],
    dataClasses: [...dataClassSet] as any[],
    formulationInput,
    shouldRefreshMidSession: shouldRefresh,
    createdAtLocal: nowLocal,
    updatedAtLocal: nowLocal,
    confidence: sourceLayers.size >= 4 ? 'high' : sourceLayers.size >= 2 ? 'medium' : 'low',
  };

  return context;
}
