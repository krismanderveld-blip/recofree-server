/**
 * Clinical Memory Distillation — Type Definitions
 *
 * FASE 8B: Contract only. No runtime integration.
 * No pipeline, no prompt, no server, no memory storage changes.
 *
 * These types define the future Clinical Memory Distillation Layer
 * that will structure existing memory layers into formulation-ready input.
 *
 * RULES:
 * - Hypotheses may NEVER be treated as facts
 * - Projections (fears/hopes) are always hypothesis_not_fact
 * - Kim and Elias must remain strictly separated
 * - Engine decides, GPT formulates
 */

// ─── 1. ClinicalMemoryPersona ──────────────────────────────────────────────
export type ClinicalMemoryPersona = 'elias' | 'kim';

// ─── 2. ClinicalMemorySourceLayer ──────────────────────────────────────────
export type ClinicalMemorySourceLayer =
  | 'backpack'
  | 'vsp'
  | 'eigen_regie_plan'
  | 'user_dat'
  | 'state_dat'
  | 'context_dat'
  | 'logs_dat'
  | 'projections_dat'
  | 'buffer'
  | 'distillation_dat'
  | 'module_memory'
  | 'extracted_entities'
  | 'progress_tracker'
  | 'check_in_history'
  | 'day_structure'
  | 'sobriety'
  | 'relapse_plan'
  | 'diary'
  | 'greeting_summary'
  | 'formulation_context'
  | 'unknown';

// ─── 3. ClinicalMemoryDataClass ────────────────────────────────────────────
export type ClinicalMemoryDataClass =
  | 'raw_user_data'
  | 'user_authored_anchor'
  | 'engine_derived_signal'
  | 'temporary_session_state'
  | 'clinical_distillation'
  | 'ui_progress_data'
  | 'safety_relevant_data'
  | 'module_routing_data'
  | 'formulation_input_ready'
  | 'needs_distillation'
  | 'should_not_go_to_gpt'
  | 'user_initiated_only'
  | 'legacy_server_risk'
  | 'hypothesis_not_fact'
  | 'persona_separated'
  | 'persona_leakage_risk'
  | 'local_only'
  | 'server_sent'
  | 'gpt_sent';

// ─── 4. ClinicalMemoryCertainty ────────────────────────────────────────────
export type ClinicalMemoryCertainty =
  | 'confirmed_by_user'
  | 'high_confidence_inference'
  | 'medium_confidence_inference'
  | 'low_confidence_inference'
  | 'hypothesis'
  | 'projection'
  | 'unknown';

// ─── 5. ClinicalMemoryFreshness ────────────────────────────────────────────
export type ClinicalMemoryFreshness =
  | 'current_session'
  | 'today'
  | 'last_7_days'
  | 'last_30_days'
  | 'older_than_30_days'
  | 'stale'
  | 'unknown';

// ─── 6. ClinicalMemoryDomain ───────────────────────────────────────────────
export type ClinicalMemoryDomain =
  | 'craving'
  | 'relapse_risk'
  | 'post_relapse'
  | 'shame'
  | 'guilt'
  | 'self_hatred'
  | 'avoidance'
  | 'emotional_overload'
  | 'body_state'
  | 'sleep'
  | 'loneliness'
  | 'abandonment'
  | 'relationship_trigger'
  | 'honesty'
  | 'motivation'
  | 'agency'
  | 'support'
  | 'safety'
  | 'trust'
  | 'lying'
  | 'betrayal'
  | 'intimacy'
  | 'affection'
  | 'sexual_pressure'
  | 'caregiving_load'
  | 'boundary_pressure'
  | 'self_loss'
  | 'grief'
  | 'control'
  | 'communication'
  | 'child_trust'
  | 'day_structure'
  | 'sobriety'
  | 'relapse_plan'
  | 'vsp_zone'
  | 'eigen_regie'
  | 'protective_factor'
  | 'risk_marker'
  | 'unknown';

// ─── 7. ClinicalMemoryUsePermission ────────────────────────────────────────
export type ClinicalMemoryUsePermission =
  | 'may_use_in_formulation'
  | 'may_use_in_prompt'
  | 'may_use_for_routing'
  | 'may_use_for_safety'
  | 'may_use_for_greeting'
  | 'may_use_only_if_recent'
  | 'may_use_only_as_hypothesis'
  | 'may_not_use_in_gpt'
  | 'may_not_use_as_fact'
  | 'requires_user_confirmation'
  | 'unknown';

// ─── 8. MemoryEvidenceItem ─────────────────────────────────────────────────
export interface MemoryEvidenceItem {
  id: string;
  sourceLayer: ClinicalMemorySourceLayer;
  sourceField: string;
  text: string;
  timestampLocal?: string;
  confidence: 'low' | 'medium' | 'high';
  persona: ClinicalMemoryPersona;
  isUserAuthored: boolean;
}

// ─── 9. MemoryFact ─────────────────────────────────────────────────────────
export interface MemoryFact {
  id: string;
  persona: ClinicalMemoryPersona;
  domain: ClinicalMemoryDomain;
  text: string;
  sourceLayer: ClinicalMemorySourceLayer;
  certainty: ClinicalMemoryCertainty;
  freshness: ClinicalMemoryFreshness;
  evidence: MemoryEvidenceItem[];
  usePermissions: ClinicalMemoryUsePermission[];
  createdAtLocal: string;
  updatedAtLocal: string;
  expiresAtLocal?: string | null;
}

// ─── 10. MemoryHypothesis ──────────────────────────────────────────────────
export interface MemoryHypothesis {
  id: string;
  persona: ClinicalMemoryPersona;
  domain: ClinicalMemoryDomain;
  hypothesis: string;
  sourceLayer: ClinicalMemorySourceLayer;
  certainty: ClinicalMemoryCertainty;
  evidence: MemoryEvidenceItem[];
  usePermissions: ClinicalMemoryUsePermission[];
  needsUserConfirmation: boolean;
  createdAtLocal: string;
  updatedAtLocal: string;
  expiresAtLocal?: string | null;
}

// ─── 11. ProjectionMarker ──────────────────────────────────────────────────
/**
 * ProjectionMarker — CORRECTED per user instruction.
 *
 * projectionType is LIMITED to:
 * - future_fear (from projections.dat fears[])
 * - future_hope (from projections.dat hopes[])
 *
 * user_belief and recurring_interpretation belong under MemoryHypothesis, NOT here.
 *
 * Rules:
 * - future_fear is NOT a fact
 * - future_hope is NOT a fact
 * - Both must always remain hypothesis_not_fact
 * - Both may only be used as hypothesis
 * - Both may never be given to GPT as prediction or truth
 * - sourceLayer must always be 'projections_dat'
 */
export interface ProjectionMarker {
  id: string;
  persona: ClinicalMemoryPersona;
  projectionType: 'future_fear' | 'future_hope';
  text: string;
  sourceLayer: 'projections_dat';
  certainty: 'projection' | 'hypothesis';
  evidence: MemoryEvidenceItem[];
  usePermissions: ClinicalMemoryUsePermission[];
  decayApplied: boolean;
  userConfirmed: boolean;
  createdAtLocal: string;
  updatedAtLocal: string;
}

// ─── 12. RecurrentPattern ──────────────────────────────────────────────────
export interface RecurrentPattern {
  id: string;
  persona: ClinicalMemoryPersona;
  domain: ClinicalMemoryDomain;
  pattern: string;
  frequency: number;
  trend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  sourceLayers: ClinicalMemorySourceLayer[];
  evidence: MemoryEvidenceItem[];
  certainty: ClinicalMemoryCertainty;
  firstSeenLocal?: string;
  lastSeenLocal?: string;
  usePermissions: ClinicalMemoryUsePermission[];
}

// ─── 13. RecoveryChain ─────────────────────────────────────────────────────
export interface RecoveryChain {
  id: string;
  persona: 'elias';
  chain: string[];
  trigger?: string | null;
  bodyState?: string | null;
  emotion?: string | null;
  cravingMovement?: string | null;
  avoidanceOrUse?: string | null;
  shameAftermath?: string | null;
  recoveryAction?: string | null;
  evidence: MemoryEvidenceItem[];
  certainty: ClinicalMemoryCertainty;
  usePermissions: ClinicalMemoryUsePermission[];
}

// ─── 14. RelationalPattern ─────────────────────────────────────────────────
export interface RelationalPattern {
  id: string;
  persona: 'kim';
  pattern: string[];
  activeDomains: ClinicalMemoryDomain[];
  harmRepeated: boolean;
  boundaryPressure: boolean;
  repairPossibleConditions: string[];
  evidence: MemoryEvidenceItem[];
  certainty: ClinicalMemoryCertainty;
  usePermissions: ClinicalMemoryUsePermission[];
}

// ─── 15. BackpackAnchor ────────────────────────────────────────────────────
export interface BackpackAnchor {
  id: string;
  persona: ClinicalMemoryPersona;
  sectionTitle: string;
  anchorText: string;
  domain: ClinicalMemoryDomain;
  emotionalWeight: 'low' | 'medium' | 'high';
  sourceLayer: 'backpack';
  userAuthored: true;
  freshness: ClinicalMemoryFreshness;
  usePermissions: ClinicalMemoryUsePermission[];
}

// ─── 16. VSPAnchor ─────────────────────────────────────────────────────────
export interface VSPAnchor {
  id: string;
  persona: 'elias';
  zone: 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'unknown';
  signal: string;
  action?: string | null;
  sourceLayer: 'vsp';
  confidence: 'low' | 'medium' | 'high';
  usePermissions: ClinicalMemoryUsePermission[];
}

// ─── 17. ERPAnchor ─────────────────────────────────────────────────────────
export interface ERPAnchor {
  id: string;
  persona: 'kim';
  domain: ClinicalMemoryDomain;
  signal: string;
  boundaryOrAction?: string | null;
  sourceLayer: 'eigen_regie_plan';
  confidence: 'low' | 'medium' | 'high';
  usePermissions: ClinicalMemoryUsePermission[];
}

// ─── 18. RiskMarker ────────────────────────────────────────────────────────
export interface RiskMarker {
  id: string;
  persona: ClinicalMemoryPersona;
  domain: ClinicalMemoryDomain;
  risk: string;
  severity: 'low' | 'medium' | 'high' | 'acute';
  trend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  evidence: MemoryEvidenceItem[];
  usePermissions: ClinicalMemoryUsePermission[];
}

// ─── 19. ProtectiveFactor ──────────────────────────────────────────────────
export interface ProtectiveFactor {
  id: string;
  persona: ClinicalMemoryPersona;
  domain: ClinicalMemoryDomain;
  factor: string;
  strength: 'low' | 'medium' | 'high';
  evidence: MemoryEvidenceItem[];
  usePermissions: ClinicalMemoryUsePermission[];
}

// ─── 20. BufferSignal ──────────────────────────────────────────────────────
export interface BufferSignal {
  id: string;
  persona: ClinicalMemoryPersona;
  domain: ClinicalMemoryDomain;
  signal: string;
  sessionOnly: true;
  eligibleForLongTermDistillation: boolean;
  shouldPersistRaw: false;
  evidence: MemoryEvidenceItem[];
}

// ─── 21. ModuleUsageSignal ─────────────────────────────────────────────────
export interface ModuleUsageSignal {
  id: string;
  persona: ClinicalMemoryPersona;
  moduleId: string;
  frequency: number;
  repeatedInSession: boolean;
  effectiveness?: 'low' | 'medium' | 'high' | 'unknown';
  lastUsedLocal?: string;
  usePermissions: ClinicalMemoryUsePermission[];
}

// ─── 22. ProgressTrendSignal ───────────────────────────────────────────────
export interface ProgressTrendSignal {
  id: string;
  persona: ClinicalMemoryPersona;
  domain: ClinicalMemoryDomain;
  metric: 'craving' | 'stress' | 'mood' | 'focus' | 'frustration' | 'despondency' | 'boundary_fatigue' | 'self_care' | 'unknown';
  window: 'session' | 'seven_days' | 'thirty_days' | 'unknown';
  direction: 'improving' | 'worsening' | 'stable' | 'volatile' | 'unknown';
  clinicalInterpretation: string;
  certainty: ClinicalMemoryCertainty;
  usePermissions: ClinicalMemoryUsePermission[];
}

// ─── 23. DayStructureSignal ────────────────────────────────────────────────
export interface DayStructureSignal {
  id: string;
  persona: ClinicalMemoryPersona;
  pattern: 'structure_stable' | 'structure_declining' | 'structure_collapsed' | 'unknown';
  missedBlocks?: number;
  completionTrend?: 'improving' | 'worsening' | 'stable' | 'unknown';
  clinicalInterpretation: string;
  usePermissions: ClinicalMemoryUsePermission[];
}

// ─── 24. SobrietySignal ────────────────────────────────────────────────────
export interface SobrietySignal {
  id: string;
  persona: 'elias';
  soberDays?: number | null;
  relapseEvents?: number | null;
  recentRelapse: boolean;
  relapsePlanAvailable: boolean;
  clinicalInterpretation: string;
  usePermissions: ClinicalMemoryUsePermission[];
}

// ─── 25. RelapsePlanSignal ─────────────────────────────────────────────────
export interface RelapsePlanSignal {
  id: string;
  persona: 'elias';
  trigger?: string | null;
  plannedAction?: string | null;
  supportAction?: string | null;
  medicalSafetyNote?: string | null;
  sourceLayer: 'relapse_plan';
  usePermissions: ClinicalMemoryUsePermission[];
}

// ─── 26. FormulationMemoryInput ────────────────────────────────────────────
export interface FormulationMemoryInput {
  persona: ClinicalMemoryPersona;
  memoryFacts: MemoryFact[];
  memoryHypotheses: MemoryHypothesis[];
  recurrentPatterns: RecurrentPattern[];
  recoveryChains: RecoveryChain[];
  relationalPatterns: RelationalPattern[];
  backpackAnchors: BackpackAnchor[];
  vspAnchors: VSPAnchor[];
  erpAnchors: ERPAnchor[];
  riskMarkers: RiskMarker[];
  protectiveFactors: ProtectiveFactor[];
  projectionMarkers: ProjectionMarker[];
  bufferSignals: BufferSignal[];
  moduleUsageSignals: ModuleUsageSignal[];
  progressTrendSignals: ProgressTrendSignal[];
  dayStructureSignals: DayStructureSignal[];
  sobrietySignals: SobrietySignal[];
  relapsePlanSignals: RelapsePlanSignal[];
  maxPromptTokens: number;
}

// ─── 27. ClinicalDistillationContext ───────────────────────────────────────
export interface ClinicalDistillationContext {
  schemaVersion: 'clinical_memory_distillation_v1';
  persona: ClinicalMemoryPersona;
  sourceLayersUsed: ClinicalMemorySourceLayer[];
  dataClasses: ClinicalMemoryDataClass[];
  formulationInput: FormulationMemoryInput;
  shouldRefreshMidSession: boolean;
  createdAtLocal: string;
  updatedAtLocal: string;
  confidence: 'low' | 'medium' | 'high';
}

// ─── 28. KimMemoryBridge ───────────────────────────────────────────────────
export interface KimMemoryBridge {
  persona: 'kim';
  relationalPatterns: RelationalPattern[];
  erpAnchors: ERPAnchor[];
  backpackAnchors: BackpackAnchor[];
  riskMarkers: RiskMarker[];
  protectiveFactors: ProtectiveFactor[];
  projectionMarkers: ProjectionMarker[];
  formulationReadyFacts: MemoryFact[];
  formulationReadyHypotheses: MemoryHypothesis[];
}

// ─── 29. EliasMemoryBridge ─────────────────────────────────────────────────
export interface EliasMemoryBridge {
  persona: 'elias';
  recoveryChains: RecoveryChain[];
  vspAnchors: VSPAnchor[];
  sobrietySignals: SobrietySignal[];
  relapsePlanSignals: RelapsePlanSignal[];
  riskMarkers: RiskMarker[];
  protectiveFactors: ProtectiveFactor[];
  projectionMarkers: ProjectionMarker[];
  formulationReadyFacts: MemoryFact[];
  formulationReadyHypotheses: MemoryHypothesis[];
}
