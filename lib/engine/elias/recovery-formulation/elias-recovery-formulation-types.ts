/**
 * Elias Recovery Formulation Engine — Types
 * Pure type definitions. No runtime logic. No imports from server, pipeline, Kim, or nano.
 */

// ── 1. EliasFormulationMode ──
export type EliasFormulationMode =
  | 'off'
  | 'low'
  | 'medium'
  | 'high'
  | 'safety_blocked'
  | 'insufficient_context'
  | 'acute_recovery_risk';

// ── 2. EliasRecoverySeverity ──
export type EliasRecoverySeverity =
  | 'stable_reflection'
  | 'early_signal'
  | 'active_craving'
  | 'relapse_risk'
  | 'post_relapse'
  | 'escalating_risk'
  | 'acute_safety'
  | 'unknown';

// ── 3. EliasRecoveryDomain ──
export type EliasRecoveryDomain =
  | 'craving'
  | 'relapse_prevention'
  | 'post_relapse_repair'
  | 'shame'
  | 'guilt'
  | 'self_hatred'
  | 'avoidance'
  | 'emotional_overload'
  | 'control_loss'
  | 'loneliness'
  | 'boredom'
  | 'grief'
  | 'abandonment_fear'
  | 'relationship_trigger'
  | 'honesty'
  | 'responsibility'
  | 'agency'
  | 'motivation'
  | 'stage_of_change'
  | 'self_compassion'
  | 'body_state'
  | 'sleep'
  | 'support_activation'
  | 'safety'
  | 'unknown';

// ── 4. EliasResponsibilityOwner ──
export type EliasResponsibilityOwner =
  | 'user'
  | 'support_person'
  | 'clinician'
  | 'system'
  | 'unknown';

// ── 5. EliasFormulationLayerId ──
export type EliasFormulationLayerId =
  | 'facts'
  | 'recovery_severity'
  | 'trigger_chain'
  | 'craving_function'
  | 'emotional_state'
  | 'avoidance_loop'
  | 'shame_loop'
  | 'responsibility_map'
  | 'agency_map'
  | 'stage_of_change'
  | 'support_plan'
  | 'relapse_prevention_step'
  | 'post_relapse_repair'
  | 'body_state'
  | 'time_dynamics'
  | 'core_hypothesis'
  | 'safety_limits';

// ── 6. EliasRecoveryFact ──
export interface EliasRecoveryFact {
  id: string;
  text: string;
  source: 'user_message' | 'memory_context' | 'engine_signal';
  confidence: 'low' | 'medium' | 'high';
}

// ── 7. EliasTriggerChainItem ──
export interface EliasTriggerChainItem {
  id: string;
  trigger: string;
  internalResponse: string;
  riskMovement: string;
  confidence: 'low' | 'medium' | 'high';
}

// ── 8. EliasCravingFunction ──
export interface EliasCravingFunction {
  id: string;
  cravingOrUse: string;
  possibleFunction: string;
  explanationNotExcuse: boolean;
  confidence: 'low' | 'medium' | 'high';
}

// ── 9. EliasResponsibilityMapItem ──
export interface EliasResponsibilityMapItem {
  id: string;
  owner: EliasResponsibilityOwner;
  responsibility: string;
  notResponsibleFor: string[];
  confidence: 'low' | 'medium' | 'high';
}

// ── 10. EliasAgencyMapItem ──
export interface EliasAgencyMapItem {
  id: string;
  possibleAction: string;
  timeWindow: 'now' | 'today' | 'next_24h' | 'this_week' | 'unknown';
  effortLevel: 'low' | 'medium' | 'high';
  confidence: 'low' | 'medium' | 'high';
}

// ── 11. EliasStageOfChangeSignal ──
export interface EliasStageOfChangeSignal {
  stage: 'precontemplation' | 'contemplation' | 'preparation' | 'action' | 'maintenance' | 'relapse' | 'unknown';
  evidence: string;
  confidence: 'low' | 'medium' | 'high';
}

// ── 12. EliasSupportPlanItem ──
export interface EliasSupportPlanItem {
  id: string;
  action: string;
  target: 'self' | 'trusted_person' | 'clinician' | 'emergency' | 'unknown';
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  confidence: 'low' | 'medium' | 'high';
}

// ── 13. EliasRelapsePreventionStep ──
export interface EliasRelapsePreventionStep {
  id: string;
  step: string;
  purpose: string;
  urgency: 'low' | 'medium' | 'high';
  confidence: 'low' | 'medium' | 'high';
}

// ── 14. EliasRecoveryFormulationContext ──
export interface EliasRecoveryFormulationContext {
  schemaVersion: 'elias_recovery_formulation_v1';
  persona: 'elias';
  mode: EliasFormulationMode;
  severity: EliasRecoverySeverity;
  activeDomains: EliasRecoveryDomain[];
  activeLayers: EliasFormulationLayerId[];
  facts: EliasRecoveryFact[];
  triggerChain: EliasTriggerChainItem[];
  cravingFunctions: EliasCravingFunction[];
  emotionalStates: string[];
  avoidanceLoops: string[];
  shameLoops: string[];
  responsibilityMap: EliasResponsibilityMapItem[];
  agencyMap: EliasAgencyMapItem[];
  stageOfChange: EliasStageOfChangeSignal | null;
  supportPlan: EliasSupportPlanItem[];
  relapsePreventionSteps: EliasRelapsePreventionStep[];
  postRelapseRepair: string[];
  bodyStateSignals: string[];
  timeDynamics: string[];
  coreHypothesis: string | null;
  safetyLimits: string[];
  mustMention: string[];
  mustAvoid: string[];
  maxQuestions: 0 | 1;
  endingStyle: 'grounding' | 'directive' | 'reflective' | 'activation' | 'repair' | 'safety';
  confidence: 'low' | 'medium' | 'high';
  createdAtLocal: string;
}
