/**
 * DIST01 Test Result Analyzer Types
 * FASE 9E: Classification only — no runtime, no writeback, no mutation
 */

export type Dist01FailureCategory =
  | 'hypothesis_promoted_to_fact'
  | 'interpretation_treated_as_fact'
  | 'mindreading'
  | 'rescue_role_advice'
  | 'responsibility_misattribution'
  | 'medical_certainty_overclaim'
  | 'stale_memory_overweighted'
  | 'contradiction_ignored'
  | 'persona_leakage'
  | 'raw_memory_risk'
  | 'safety_underweighted'
  | 'false_positive_pattern'
  | 'false_negative_pattern'
  | 'confidence_too_high'
  | 'confidence_too_low'
  | 'unsupported_recovery_claim'
  | 'unsupported_relational_claim'
  | 'shame_identity_reinforced'
  | 'craving_story_followed'
  | 'user_emotion_not_validated';

export type Dist01RecommendedAction =
  | 'do_not_store'
  | 'store_as_hypothesis_only'
  | 'lower_confidence'
  | 'raise_confidence_threshold'
  | 'mark_contradiction'
  | 'require_user_confirmation'
  | 'apply_decay'
  | 'suppress_from_gpt'
  | 'promote_after_repetition'
  | 'add_persona_filter'
  | 'add_safety_priority'
  | 'add_medical_uncertainty_label'
  | 'add_responsibility_boundary_label'
  | 'add_mindreading_guard'
  | 'add_rescue_role_guard'
  | 'add_shame_identity_guard'
  | 'add_craving_permission_guard'
  | 'no_dist01_change_needed';

export type Dist01TargetLayer =
  | 'dist01_entities'
  | 'dist01_signals'
  | 'dist01_contexts'
  | 'cmd_contract'
  | 'cmd_selector'
  | 'epistemic_engine'
  | 'kim_adapter'
  | 'elias_adapter'
  | 'model_routing'
  | 'safety_engine'
  | 'none';

export interface Dist01QualityScenarioInput {
  scenarioId: string;
  persona: 'elias' | 'kim';
  userInputSummary: string;
  expectedBehavior: string[];
  observedBehavior: string[];
  modelUsed?: string | null;
  score?: number | null;
  pass: boolean;
  tags?: string[];
}

export interface Dist01TestResultAnalysis {
  scenarioId: string;
  persona: 'elias' | 'kim';
  pass: boolean;
  failureCategories: Dist01FailureCategory[];
  recommendedActions: Dist01RecommendedAction[];
  targetLayers: Dist01TargetLayer[];
  affectedDomains: string[];
  shouldModifyDetection: boolean;
  shouldModifyPromotion: boolean;
  shouldModifyDecay: boolean;
  shouldModifyContradiction: boolean;
  shouldModifyPromptUsePermission: boolean;
  shouldModifyPersonaFilter: boolean;
  shouldModifySafetyPriority: boolean;
  notes: string[];
  warnings: string[];
}

export type Dist01BatchRecommendedNextPhase =
  | 'confidence_promotion'
  | 'contradiction_resolution'
  | 'decay_stale_cleanup'
  | 'persona_filter_patch'
  | 'safety_priority_patch'
  | 'no_dist01_change_needed';

export interface Dist01BatchQualityAnalysis {
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  recurrentFailureCategories: Dist01FailureCategory[];
  recommendedNextPhase: Dist01BatchRecommendedNextPhase;
  analyses: Dist01TestResultAnalysis[];
}
