/**
 * CGT (Cognitive Behavioral Therapy) Engine — Type Contracts
 * Based on RECOFREE_CGT_THERAPY_ENGINE_CANON_V3_ULTIMATE Section 18
 *
 * Core architecture rule: Engine decides. Local LLM labels. API LLM formulates.
 * Safety rule: CBT never overrides safety, crisis, VSP, Eigen Regie, or deterministic routing.
 */

// ─── Distortion IDs (27 cognitive distortions) ──────────────────────────────

export type DistortionId =
  | 'ALL_OR_NOTHING'
  | 'CATASTROPHIZING'
  | 'MIND_READING'
  | 'FORTUNE_TELLING'
  | 'EMOTIONAL_REASONING'
  | 'OVERGENERALIZATION'
  | 'SHOULD_STATEMENTS'
  | 'LABELING'
  | 'PERSONALIZATION'
  | 'DISCOUNTING_POSITIVE'
  | 'MENTAL_FILTER'
  | 'MAGNIFICATION'
  | 'MINIMIZATION'
  | 'CONTROL_FALLACY'
  | 'FAIRNESS_FALLACY'
  | 'BLAME'
  | 'COMPARISON_TRAP'
  | 'NEGATIVE_PREDICTION'
  | 'SHAME_GENERALIZATION'
  | 'RELAPSE_FINALITY'
  | 'CERTAINTY_SEEKING'
  | 'RESPONSIBILITY_DISTORTION'
  | 'THREAT_OVERESTIMATION'
  | 'COPING_UNDERESTIMATION'
  | 'PERMANENCE_DISTORTION'
  | 'IDENTITY_FUSION'
  | 'MORAL_OVERGENERALIZATION';

export const ALL_DISTORTIONS: readonly DistortionId[] = [
  'ALL_OR_NOTHING',
  'CATASTROPHIZING',
  'MIND_READING',
  'FORTUNE_TELLING',
  'EMOTIONAL_REASONING',
  'OVERGENERALIZATION',
  'SHOULD_STATEMENTS',
  'LABELING',
  'PERSONALIZATION',
  'DISCOUNTING_POSITIVE',
  'MENTAL_FILTER',
  'MAGNIFICATION',
  'MINIMIZATION',
  'CONTROL_FALLACY',
  'FAIRNESS_FALLACY',
  'BLAME',
  'COMPARISON_TRAP',
  'NEGATIVE_PREDICTION',
  'SHAME_GENERALIZATION',
  'RELAPSE_FINALITY',
  'CERTAINTY_SEEKING',
  'RESPONSIBILITY_DISTORTION',
  'THREAT_OVERESTIMATION',
  'COPING_UNDERESTIMATION',
  'PERMANENCE_DISTORTION',
  'IDENTITY_FUSION',
  'MORAL_OVERGENERALIZATION',
] as const;

// ─── CBT Process IDs (13 therapeutic processes) ─────────────────────────────

export type CBTProcessId =
  | 'THOUGHT_IDENTIFICATION'
  | 'DISTORTION_DETECTION'
  | 'COGNITIVE_RESTRUCTURING'
  | 'BEHAVIORAL_EXPERIMENT'
  | 'MICRO_EXPOSURE'
  | 'RELAPSE_PATTERN_REVIEW'
  | 'BALANCED_THINKING'
  | 'COPING_PLAN'
  | 'CORE_BELIEF_EXPLORATION'
  | 'UNCERTAINTY_TOLERANCE'
  | 'RESPONSIBILITY_MAPPING'
  | 'SAFETY_BEHAVIOR_REDUCTION'
  | 'BEHAVIORAL_ACTIVATION';

export const ALL_CBT_PROCESSES: readonly CBTProcessId[] = [
  'THOUGHT_IDENTIFICATION',
  'DISTORTION_DETECTION',
  'COGNITIVE_RESTRUCTURING',
  'BEHAVIORAL_EXPERIMENT',
  'MICRO_EXPOSURE',
  'RELAPSE_PATTERN_REVIEW',
  'BALANCED_THINKING',
  'COPING_PLAN',
  'CORE_BELIEF_EXPLORATION',
  'UNCERTAINTY_TOLERANCE',
  'RESPONSIBILITY_MAPPING',
  'SAFETY_BEHAVIOR_REDUCTION',
  'BEHAVIORAL_ACTIVATION',
] as const;

// ─── CBT Signal IDs (16 detectable cognitive patterns) ──────────────────────

export type CBTSignalId =
  | 'BLACK_WHITE_THINKING'
  | 'CATASTROPHIZING'
  | 'FORTUNE_TELLING'
  | 'SELF_ATTACK'
  | 'RELAPSE_JUSTIFICATION'
  | 'CONTROL_THINKING'
  | 'RESCUE_THINKING'
  | 'HELPLESSNESS'
  | 'AVOIDANCE'
  | 'SHAME_SPIRAL'
  | 'PERFECTIONISM'
  | 'FEAR_LOOP'
  | 'CERTAINTY_SEEKING'
  | 'CORE_BELIEF_SIGNAL'
  | 'RESPONSIBILITY_DISTORTION_SIGNAL'
  | 'SAFETY_BEHAVIOR_SIGNAL';

export const ALL_CBT_SIGNALS: readonly CBTSignalId[] = [
  'BLACK_WHITE_THINKING',
  'CATASTROPHIZING',
  'FORTUNE_TELLING',
  'SELF_ATTACK',
  'RELAPSE_JUSTIFICATION',
  'CONTROL_THINKING',
  'RESCUE_THINKING',
  'HELPLESSNESS',
  'AVOIDANCE',
  'SHAME_SPIRAL',
  'PERFECTIONISM',
  'FEAR_LOOP',
  'CERTAINTY_SEEKING',
  'CORE_BELIEF_SIGNAL',
  'RESPONSIBILITY_DISTORTION_SIGNAL',
  'SAFETY_BEHAVIOR_SIGNAL',
] as const;

// ─── CBT Signal Source ──────────────────────────────────────────────────────

export type CBTSignalSource =
  | 'LOCAL_LLM'
  | 'DETERMINISTIC_MARKER'
  | 'BUFFER'
  | 'USER_DAT'
  | 'PROJECTION'
  | 'BACKPACK'
  | 'SCHEMA_MODE'
  | 'ACT'
  | 'VSP'
  | 'EIGEN_REGIE'
  | 'SESSION_END';

// ─── CBT Evidence ───────────────────────────────────────────────────────────

export type CBTEvidenceType =
  | 'TEXT_MARKER'
  | 'PATTERN'
  | 'BEHAVIOR_SIGNAL'
  | 'ZONE_SHIFT'
  | 'PROJECTION_ENTRY'
  | 'BACKPACK_LINK'
  | 'MODE_LINK'
  | 'ACT_LINK'
  | 'RELAPSE_LINK';

export type CBTEvidenceSourceLayer =
  | 'buffer'
  | 'user.dat'
  | 'projections.dat'
  | 'backpack'
  | 'current_input';

export interface CBTEvidence {
  evidenceType: CBTEvidenceType;
  value: string;
  timestamp: string;
  sourceLayer: CBTEvidenceSourceLayer;
}

// ─── CBT Intervention Hint ──────────────────────────────────────────────────

export type CBTInterventionHint =
  | 'THOUGHT_CHECK'
  | 'REFRAME'
  | 'BEHAVIORAL_TEST'
  | 'MICRO_STEP'
  | 'GROUND_FIRST'
  | 'RESPONSIBILITY_MAP'
  | 'URGE_LOOP_MAP'
  | 'UNCERTAINTY_TOLERANCE'
  | 'NO_CBT';

// ─── CBT Candidate ──────────────────────────────────────────────────────────

export interface CBTCandidate {
  processId: CBTProcessId;
  signalId: CBTSignalId;
  distortionIds: readonly DistortionId[];
  confidence: number;
  source: CBTSignalSource;
  evidence: readonly CBTEvidence[];
  allowedForPrompt: boolean;
  interventionHint: CBTInterventionHint;
}

// ─── CBT Decision (output of the router) ────────────────────────────────────

export interface CBTDecision {
  acceptedCBTCandidates: readonly CBTCandidate[];
  rejectedCBTCandidates: readonly CBTCandidate[];
  dominantProcess: CBTProcessId | null;
  dominantSignal: CBTSignalId | null;
  dominantDistortion: DistortionId | null;
  safeToUseCBT: boolean;
  reason: string;
  promptSummary: string;
}

// ─── CBT Engine Input ───────────────────────────────────────────────────────

export interface CBTEngineInput {
  userMessage: string;
  userType: 'elias' | 'kim';
  vspLevel: string;              // 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS'
  eigenRegieScore: number | null; // 0-100 for Kim, null for Elias
  crisisLevel: number;           // 0-3
  resolvedZone: string;          // 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'
  distressScore: number;
  activeMode: string | null;     // from schema-mode engine
  activeSchema: string | null;
  activeACTProcess: string | null; // from ACT engine
  activeProjections: readonly string[];
  stageOfChange: string;
  guidanceDepth: number;
}

// ─── CBT Engine Result ──────────────────────────────────────────────────────

export interface CBTEngineResult {
  decision: CBTDecision;
  promptBlock: string;           // compact injection for GPT
  activated: boolean;            // true if at least one candidate accepted
}

// ─── CBT Progress (persisted in user.dat) ───────────────────────────────────

export interface CBTProgress {
  recurringDistortions: DistortionId[];          // patterns seen repeatedly
  preferredTools: CBTProcessId[];                // processes that worked well
  successfulReframes: number;                    // times restructuring helped
  successfulExperiments: number;                 // behavioral experiments completed
  relapsePatternCount: number;                   // relapse cognition patterns identified
  safetyBehaviorsIdentified: string[];           // recurring safety behaviors
  avoidanceLoopsIdentified: string[];            // recurring avoidance loops
  lastCBTProcessUsed: CBTProcessId | null;
  lastCBTSessionDate: string | null;
}

export function createDefaultCBTProgress(): CBTProgress {
  return {
    recurringDistortions: [],
    preferredTools: [],
    successfulReframes: 0,
    successfulExperiments: 0,
    relapsePatternCount: 0,
    safetyBehaviorsIdentified: [],
    avoidanceLoopsIdentified: [],
    lastCBTProcessUsed: null,
    lastCBTSessionDate: null,
  };
}

// ─── Signal → Process routing map ───────────────────────────────────────────

export const CBT_SIGNAL_TO_PROCESS_MAP: Record<CBTSignalId, CBTProcessId> = {
  BLACK_WHITE_THINKING: 'DISTORTION_DETECTION',
  CATASTROPHIZING: 'COGNITIVE_RESTRUCTURING',
  FORTUNE_TELLING: 'BALANCED_THINKING',
  SELF_ATTACK: 'THOUGHT_IDENTIFICATION',
  RELAPSE_JUSTIFICATION: 'RELAPSE_PATTERN_REVIEW',
  CONTROL_THINKING: 'RESPONSIBILITY_MAPPING',
  RESCUE_THINKING: 'RESPONSIBILITY_MAPPING',
  HELPLESSNESS: 'COPING_PLAN',
  AVOIDANCE: 'MICRO_EXPOSURE',
  SHAME_SPIRAL: 'THOUGHT_IDENTIFICATION',
  PERFECTIONISM: 'BALANCED_THINKING',
  FEAR_LOOP: 'UNCERTAINTY_TOLERANCE',
  CERTAINTY_SEEKING: 'UNCERTAINTY_TOLERANCE',
  CORE_BELIEF_SIGNAL: 'CORE_BELIEF_EXPLORATION',
  RESPONSIBILITY_DISTORTION_SIGNAL: 'RESPONSIBILITY_MAPPING',
  SAFETY_BEHAVIOR_SIGNAL: 'SAFETY_BEHAVIOR_REDUCTION',
};

// ─── Signal → Intervention Hint map ─────────────────────────────────────────

export const CBT_SIGNAL_TO_HINT_MAP: Record<CBTSignalId, CBTInterventionHint> = {
  BLACK_WHITE_THINKING: 'REFRAME',
  CATASTROPHIZING: 'GROUND_FIRST',
  FORTUNE_TELLING: 'THOUGHT_CHECK',
  SELF_ATTACK: 'THOUGHT_CHECK',
  RELAPSE_JUSTIFICATION: 'URGE_LOOP_MAP',
  CONTROL_THINKING: 'RESPONSIBILITY_MAP',
  RESCUE_THINKING: 'RESPONSIBILITY_MAP',
  HELPLESSNESS: 'MICRO_STEP',
  AVOIDANCE: 'MICRO_STEP',
  SHAME_SPIRAL: 'GROUND_FIRST',
  PERFECTIONISM: 'REFRAME',
  FEAR_LOOP: 'UNCERTAINTY_TOLERANCE',
  CERTAINTY_SEEKING: 'UNCERTAINTY_TOLERANCE',
  CORE_BELIEF_SIGNAL: 'THOUGHT_CHECK',
  RESPONSIBILITY_DISTORTION_SIGNAL: 'RESPONSIBILITY_MAP',
  SAFETY_BEHAVIOR_SIGNAL: 'BEHAVIORAL_TEST',
};

// ─── Signal → Primary Distortion map ────────────────────────────────────────

export const CBT_SIGNAL_TO_DISTORTION_MAP: Record<CBTSignalId, DistortionId[]> = {
  BLACK_WHITE_THINKING: ['ALL_OR_NOTHING'],
  CATASTROPHIZING: ['CATASTROPHIZING', 'THREAT_OVERESTIMATION'],
  FORTUNE_TELLING: ['FORTUNE_TELLING', 'NEGATIVE_PREDICTION'],
  SELF_ATTACK: ['LABELING', 'SHAME_GENERALIZATION'],
  RELAPSE_JUSTIFICATION: ['MINIMIZATION', 'RELAPSE_FINALITY'],
  CONTROL_THINKING: ['CONTROL_FALLACY', 'CERTAINTY_SEEKING'],
  RESCUE_THINKING: ['RESPONSIBILITY_DISTORTION', 'PERSONALIZATION'],
  HELPLESSNESS: ['COPING_UNDERESTIMATION', 'PERMANENCE_DISTORTION'],
  AVOIDANCE: ['COPING_UNDERESTIMATION'],
  SHAME_SPIRAL: ['SHAME_GENERALIZATION', 'IDENTITY_FUSION'],
  PERFECTIONISM: ['SHOULD_STATEMENTS', 'ALL_OR_NOTHING'],
  FEAR_LOOP: ['THREAT_OVERESTIMATION', 'CATASTROPHIZING'],
  CERTAINTY_SEEKING: ['CERTAINTY_SEEKING', 'CONTROL_FALLACY'],
  CORE_BELIEF_SIGNAL: ['IDENTITY_FUSION', 'MORAL_OVERGENERALIZATION'],
  RESPONSIBILITY_DISTORTION_SIGNAL: ['RESPONSIBILITY_DISTORTION', 'PERSONALIZATION'],
  SAFETY_BEHAVIOR_SIGNAL: ['THREAT_OVERESTIMATION', 'CONTROL_FALLACY'],
};
