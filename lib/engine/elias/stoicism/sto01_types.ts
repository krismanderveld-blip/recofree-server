/**
 * STO01 Stoicism Integration Module — Elias Only
 * Data contracts and type definitions
 *
 * MODULE_ID: STO01
 * PIPELINE POSITION: 5e4 (after SW01)
 * PERSONA: Elias only — never active for Kim
 */

// ─── Core Types ─────────────────────────────────────────────────────────────

export type STO01ModuleId = "STO01";

export type STO01PipelinePosition = "5e4";

export type STO01Principle =
  | "dichotomy_of_control"
  | "amor_fati"
  | "memento_mori"
  | "apatheia"
  | "sympatheia";

export type STO01InterventionType =
  | "STO01_IT01_CONTROL_SORTING"
  | "STO01_IT02_REALITY_ACCEPTANCE"
  | "STO01_IT03_RELAPSE_MEANING_REFRAME"
  | "STO01_IT04_MORTALITY_ORIENTATION"
  | "STO01_IT05_CONNECTED_RESPONSIBILITY";

export type STO01ActivationStrength =
  | "low"
  | "medium"
  | "high";

export type STO01FallbackModule =
  | "CRISIS_PROTOCOL"
  | "MEDICAL_SAFETY"
  | "DBT_DISTRESS_TOLERANCE"
  | "ACT_ACCEPTANCE"
  | "MBT_MENTALIZATION"
  | "SW01"
  | "GENERAL_RESPONSE_SYNTHESIS";

// ─── Input Interfaces ───────────────────────────────────────────────────────

export interface STO01TriggerMarkers {
  ruminationOutsideControl: boolean;
  externalCauseFixation: boolean;
  relapseMeaningSearch: boolean;
  explicitStoicismRequest: boolean;
  explicitPhilosophyRequest: boolean;
}

export interface STO01SafetyFlags {
  activeSuicidalIntent: boolean;
  passiveDeathWish: boolean;
  selfHarmIntent: boolean;
  acuteMedicalRisk: boolean;
  overdoseOrPoisoningRisk: boolean;
  severeIntoxication: boolean;
  acuteWithdrawalRisk: boolean;
  deliriumOrSeizureRisk: boolean;
  dissociationHeavy: boolean;
}

export interface STO01RecoveryContext {
  userRole: "person_in_recovery" | "caregiver" | "unknown";
  addictionType?: string[];
  recentRelapse: boolean;
  relapseTimeframe?:
    | "same_day"
    | "last_24_hours"
    | "last_7_days"
    | "older"
    | "unknown";
  cravingLevel?: number;
  moodLevel?: number;
  shameLevel?: number;
  externalConflictPresent: boolean;
  caregiverImpactPresent: boolean;
}

export interface STO01ShadowWorkContext {
  sw01Executed: boolean;
  projectionDetected: boolean;
  avoidanceDetected: boolean;
  intellectualizationDetected: boolean;
  shameCoreActivated: boolean;
  shadowWorkRecommendedButNotPrimary: boolean;
}

export interface STO01Input {
  moduleId: STO01ModuleId;
  pipelinePosition: STO01PipelinePosition;
  userInput: string;
  language: string;
  triggerMarkers: STO01TriggerMarkers;
  safety: STO01SafetyFlags;
  recoveryContext: STO01RecoveryContext;
  shadowWorkContext: STO01ShadowWorkContext;
}

// ─── Output Interfaces ──────────────────────────────────────────────────────

export interface STO01RoutingDecision {
  activate: boolean;
  reason?: string;
  primaryPrinciple?: STO01Principle;
  secondaryPrinciple?: STO01Principle;
  interventionType?: STO01InterventionType;
  activationStrength?: STO01ActivationStrength;
  fallbackModule?: STO01FallbackModule;
}

export interface STO01GeneratedInstruction {
  moduleId: STO01ModuleId;
  active: boolean;
  selectedPrinciples: STO01Principle[];
  selectedIntervention: STO01InterventionType | null;
  gptPromptBlock: string;
  forbiddenOutputs: string[];
  requiredResponsePattern: string[];
  safetyOverride: boolean;
  fallbackModule?: STO01FallbackModule;
}

export interface STO01Output {
  routingDecision: STO01RoutingDecision;
  generatedInstruction: STO01GeneratedInstruction;
  pipelineContinue: boolean;
  nextPipelineStep: "GENERAL_RESPONSE_SYNTHESIS" | STO01FallbackModule;
}

// ─── Session State ──────────────────────────────────────────────────────────

export interface STO01SessionState {
  active: boolean;
  activationsThisSession: number;
  principlesUsed: STO01Principle[];
  interventionsUsed: STO01InterventionType[];
  lastActivationStrength: STO01ActivationStrength | null;
  peakActivationStrength: STO01ActivationStrength | null;
}

// ─── Progress (persisted in user.dat) ───────────────────────────────────────

export interface STO01Progress {
  sessionsWithStoicism: number;
  principlesUsedAllTime: STO01Principle[];
  interventionsUsedAllTime: STO01InterventionType[];
  totalActivations: number;
  lastPrincipleUsed: STO01Principle | null;
  lastInterventionUsed: STO01InterventionType | null;
}

export function createDefaultSTO01Progress(): STO01Progress {
  return {
    sessionsWithStoicism: 0,
    principlesUsedAllTime: [],
    interventionsUsedAllTime: [],
    totalActivations: 0,
    lastPrincipleUsed: null,
    lastInterventionUsed: null,
  };
}
