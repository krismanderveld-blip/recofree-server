/**
 * ACT Therapy Engine — Type Contracts
 * Based on RECOFREE_ACT_THERAPY_ENGINE_CANON_V2_A_PLUS_B Section 14
 *
 * Core architecture rule: Engine decides. Local LLM labels. API LLM formulates.
 */

// ─── ACT Process IDs (the six core ACT processes) ────────────────────────────

export type ACTProcessId =
  | 'ACCEPTANCE'
  | 'COGNITIVE_DEFUSION'
  | 'PRESENT_MOMENT_AWARENESS'
  | 'SELF_AS_CONTEXT'
  | 'VALUES'
  | 'COMMITTED_ACTION';

export const ALL_ACT_PROCESSES: readonly ACTProcessId[] = [
  'ACCEPTANCE',
  'COGNITIVE_DEFUSION',
  'PRESENT_MOMENT_AWARENESS',
  'SELF_AS_CONTEXT',
  'VALUES',
  'COMMITTED_ACTION',
] as const;

// ─── ACT Signal IDs (detectable fusion/avoidance patterns) ───────────────────

export type ACTSignalId =
  | 'THOUGHT_FUSION'
  | 'SHAME_FUSION'
  | 'FUTURE_FUSION'
  | 'RELAPSE_JUSTIFICATION'
  | 'CRAVING_URGE'
  | 'CONTROL_FUSION'
  | 'RESCUE_FUSION'
  | 'AVOIDANCE'
  | 'VALUES_DISCONNECTION'
  | 'PERFECTIONISTIC_PRESSURE'
  | 'HOPELESS_PREDICTION'
  | 'IDENTITY_FUSION'
  | 'EMOTIONAL_AVOIDANCE'
  | 'ACTION_PARALYSIS';

export const ALL_ACT_SIGNALS: readonly ACTSignalId[] = [
  'THOUGHT_FUSION',
  'SHAME_FUSION',
  'FUTURE_FUSION',
  'RELAPSE_JUSTIFICATION',
  'CRAVING_URGE',
  'CONTROL_FUSION',
  'RESCUE_FUSION',
  'AVOIDANCE',
  'VALUES_DISCONNECTION',
  'PERFECTIONISTIC_PRESSURE',
  'HOPELESS_PREDICTION',
  'IDENTITY_FUSION',
  'EMOTIONAL_AVOIDANCE',
  'ACTION_PARALYSIS',
] as const;

// ─── ACT Signal Source ───────────────────────────────────────────────────────

export type ACTSignalSource =
  | 'LOCAL_LLM'
  | 'DETERMINISTIC_MARKER'
  | 'VSP'
  | 'EIGEN_REGIE'
  | 'BUFFER'
  | 'USER_DAT'
  | 'PROJECTION'
  | 'BACKPACK'
  | 'SCHEMA_MODE'
  | 'SESSION_END';

// ─── ACT Evidence ────────────────────────────────────────────────────────────

export type ACTEvidenceType =
  | 'TEXT_MARKER'
  | 'ZONE_SHIFT'
  | 'PROJECTION_ENTRY'
  | 'HISTORY_PATTERN'
  | 'BEHAVIORAL_SIGNAL'
  | 'VALUE_REFERENCE'
  | 'URGE_SIGNAL';

export type ACTEvidenceSourceLayer =
  | 'user.dat'
  | 'buffer'
  | 'projections.dat'
  | 'backpack'
  | 'current_input';

export interface ACTEvidence {
  evidenceType: ACTEvidenceType;
  value: string;
  timestamp: string;
  sourceLayer: ACTEvidenceSourceLayer;
}

// ─── ACT Intervention Hint ───────────────────────────────────────────────────

export type ACTInterventionHint =
  | 'DEFUSE'
  | 'ACCEPT'
  | 'GROUND'
  | 'VALUES_CLARIFY'
  | 'COMMITTED_ACTION'
  | 'URGE_SURF'
  | 'SELF_AS_CONTEXT'
  | 'NO_ACT_INTERVENTION';

// ─── ACT Candidate ───────────────────────────────────────────────────────────

export interface ACTCandidate {
  processId: ACTProcessId;
  signalId: ACTSignalId;
  confidence: number;
  source: ACTSignalSource;
  evidence: readonly ACTEvidence[];
  allowedForPrompt: boolean;
  interventionHint: ACTInterventionHint;
}

// ─── ACT Decision (output of the router) ─────────────────────────────────────

export interface ACTDecision {
  acceptedACTCandidates: readonly ACTCandidate[];
  rejectedACTCandidates: readonly ACTCandidate[];
  dominantProcess: ACTProcessId | null;
  dominantSignal: ACTSignalId | null;
  safeToUseACT: boolean;
  reason: string;
  promptSummary: string;
}

// ─── ACT Engine Input ────────────────────────────────────────────────────────

export interface ACTEngineInput {
  userMessage: string;
  userType: 'elias' | 'kim';
  vspLevel: string;           // 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS'
  eigenRegieScore: number | null; // 0-100 for Kim, null for Elias
  crisisLevel: number;        // 0-3
  resolvedZone: string;       // 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'
  distressScore: number;
  activeMode: string | null;  // from schema-mode engine
  activeSchema: string | null;
  candidateSignals: readonly { category: string; strength: number }[];
  activeProjections: readonly string[];
  stageOfChange: string;
  guidanceDepth: number;
}

// ─── ACT Engine Result ───────────────────────────────────────────────────────

export interface ACTEngineResult {
  decision: ACTDecision;
  promptBlock: string;        // compact injection for GPT
  activated: boolean;         // true if at least one candidate accepted
}

// ─── ACT Progress (persisted in user.dat) ────────────────────────────────────

export interface ACTProgress {
  userValues: string[];                    // user-identified values
  preferredTools: ACTProcessId[];          // processes that worked well
  repeatedFusionPatterns: ACTSignalId[];   // recurring fusion types
  successfulDefusionCount: number;         // times defusion helped
  successfulGroundingCount: number;        // times grounding helped
  successfulUrgeSurfingCount: number;      // times urge surfing helped
  valuesBasedActionsCompleted: number;     // committed actions taken
  lastACTProcessUsed: ACTProcessId | null;
  lastACTSessionDate: string | null;
}

export function createDefaultACTProgress(): ACTProgress {
  return {
    userValues: [],
    preferredTools: [],
    repeatedFusionPatterns: [],
    successfulDefusionCount: 0,
    successfulGroundingCount: 0,
    successfulUrgeSurfingCount: 0,
    valuesBasedActionsCompleted: 0,
    lastACTProcessUsed: null,
    lastACTSessionDate: null,
  };
}

// ─── Signal → Process routing map ────────────────────────────────────────────

export const SIGNAL_TO_PROCESS_MAP: Record<ACTSignalId, ACTProcessId> = {
  THOUGHT_FUSION: 'COGNITIVE_DEFUSION',
  SHAME_FUSION: 'COGNITIVE_DEFUSION',
  FUTURE_FUSION: 'COGNITIVE_DEFUSION',
  RELAPSE_JUSTIFICATION: 'COGNITIVE_DEFUSION',
  CRAVING_URGE: 'ACCEPTANCE',
  CONTROL_FUSION: 'COGNITIVE_DEFUSION',
  RESCUE_FUSION: 'COGNITIVE_DEFUSION',
  AVOIDANCE: 'ACCEPTANCE',
  VALUES_DISCONNECTION: 'VALUES',
  PERFECTIONISTIC_PRESSURE: 'SELF_AS_CONTEXT',
  HOPELESS_PREDICTION: 'COGNITIVE_DEFUSION',
  IDENTITY_FUSION: 'SELF_AS_CONTEXT',
  EMOTIONAL_AVOIDANCE: 'ACCEPTANCE',
  ACTION_PARALYSIS: 'COMMITTED_ACTION',
};

// ─── Signal → Intervention Hint map ──────────────────────────────────────────

export const SIGNAL_TO_HINT_MAP: Record<ACTSignalId, ACTInterventionHint> = {
  THOUGHT_FUSION: 'DEFUSE',
  SHAME_FUSION: 'DEFUSE',
  FUTURE_FUSION: 'DEFUSE',
  RELAPSE_JUSTIFICATION: 'DEFUSE',
  CRAVING_URGE: 'URGE_SURF',
  CONTROL_FUSION: 'DEFUSE',
  RESCUE_FUSION: 'VALUES_CLARIFY',
  AVOIDANCE: 'ACCEPT',
  VALUES_DISCONNECTION: 'VALUES_CLARIFY',
  PERFECTIONISTIC_PRESSURE: 'SELF_AS_CONTEXT',
  HOPELESS_PREDICTION: 'DEFUSE',
  IDENTITY_FUSION: 'SELF_AS_CONTEXT',
  EMOTIONAL_AVOIDANCE: 'ACCEPT',
  ACTION_PARALYSIS: 'COMMITTED_ACTION',
};
