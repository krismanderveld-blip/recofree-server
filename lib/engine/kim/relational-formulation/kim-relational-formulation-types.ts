/**
 * Kim Relational Formulation Engine — Type Definitions
 * Schema version: kim_relational_formulation_v1
 *
 * These types define the structured context that the Kim Relational Formulation Engine
 * will produce client-side, to be injected into the GPT system prompt.
 *
 * NO RUNTIME INTEGRATION. Types only.
 */

// 1. KimFormulationMode
export type KimFormulationMode =
  | 'off'
  | 'low'
  | 'medium'
  | 'high'
  | 'safety_blocked'
  | 'insufficient_context';

// 2. KimRelationalSeverity
export type KimRelationalSeverity =
  | 'single_event'
  | 'repeated_pattern'
  | 'chronic_pattern'
  | 'escalating_pattern'
  | 'acute_safety'
  | 'unknown';

// 3. KimRelationalDomain
export type KimRelationalDomain =
  | 'trust'
  | 'honesty'
  | 'intimacy'
  | 'affection'
  | 'sexual_pressure'
  | 'addiction_recovery'
  | 'relationship_repair'
  | 'child_trust'
  | 'caregiving_load'
  | 'boundary_pressure'
  | 'self_loss'
  | 'grief'
  | 'shame'
  | 'anger'
  | 'control'
  | 'avoidance'
  | 'communication'
  | 'safety'
  | 'unknown';

// 4. KimResponsibilityOwner
export type KimResponsibilityOwner =
  | 'caregiver'
  | 'dependent_person'
  | 'both'
  | 'neither'
  | 'unknown';

// 5. KimFormulationLayerId
export type KimFormulationLayerId =
  | 'facts'
  | 'pattern_severity'
  | 'caregiver_impact'
  | 'dependent_hypotheses'
  | 'causal_chain'
  | 'feedback_loop'
  | 'behavior_functions'
  | 'role_shift'
  | 'domain_separation'
  | 'responsibility_map'
  | 'counter_hypotheses'
  | 'time_dynamics'
  | 'core_hypothesis'
  | 'safety_limits'
  | 'repair_conditions';

// 6. KimRelationalFact
export interface KimRelationalFact {
  id: string;
  text: string;
  source: 'user_message' | 'memory_context' | 'engine_signal';
  confidence: 'low' | 'medium' | 'high';
}

// 7. KimImpactStatement
export interface KimImpactStatement {
  id: string;
  domain: KimRelationalDomain;
  text: string;
  confidence: 'low' | 'medium' | 'high';
}

// 8. KimBehaviorFunction
export interface KimBehaviorFunction {
  id: string;
  behavior: string;
  possibleFunction: string;
  explanationNotExcuse: boolean;
  owner: KimResponsibilityOwner;
  confidence: 'low' | 'medium' | 'high';
}

// 9. KimResponsibilityMapItem
export interface KimResponsibilityMapItem {
  id: string;
  owner: KimResponsibilityOwner;
  responsibility: string;
  notResponsibleFor: string[];
  confidence: 'low' | 'medium' | 'high';
}

// 10. KimDomainSeparation
export interface KimDomainSeparation {
  id: string;
  domainA: KimRelationalDomain;
  domainB: KimRelationalDomain;
  distinction: string;
  mustMention: boolean;
}

// 11. KimRepairCondition
export interface KimRepairCondition {
  id: string;
  condition: string;
  owner: KimResponsibilityOwner;
  nonNegotiable: boolean;
  confidence: 'low' | 'medium' | 'high';
}

// 12. KimRelationalFormulationContext
export interface KimRelationalFormulationContext {
  schemaVersion: 'kim_relational_formulation_v1';
  persona: 'kim';
  mode: KimFormulationMode;
  severity: KimRelationalSeverity;
  activeDomains: KimRelationalDomain[];
  activeLayers: KimFormulationLayerId[];
  facts: KimRelationalFact[];
  caregiverImpacts: KimImpactStatement[];
  dependentHypotheses: KimImpactStatement[];
  causalChains: string[];
  feedbackLoops: string[];
  behaviorFunctions: KimBehaviorFunction[];
  roleShifts: string[];
  domainSeparations: KimDomainSeparation[];
  responsibilityMap: KimResponsibilityMapItem[];
  counterHypotheses: string[];
  timeDynamics: string[];
  coreHypothesis: string | null;
  safetyLimits: string[];
  repairConditions: KimRepairCondition[];
  mustMention: string[];
  mustAvoid: string[];
  maxQuestions: 0 | 1;
  endingStyle: 'directive' | 'reflective' | 'grounding' | 'boundary' | 'repair';
  confidence: 'low' | 'medium' | 'high';
  createdAtLocal: string;
}

// ── Semantic source classification ──
export type KimSemanticSource = 'nano' | 'local_llm' | 'deterministic' | 'none';
