/**
 * DGT (Dialectical Behavior Therapy) Engine — Type Contracts
 * Based on RECOFREE_DGT_THERAPY_ENGINE_CANON_V4_HYBRID_MANUS_READY Section 21
 *
 * Core architecture rule: Engine decides. Local LLM labels. API LLM formulates.
 * Safety rule: DGT never overrides crisis logic, VSP, Eigen Regie, deterministic routing,
 * safety hierarchy or human emergency escalation.
 */

// ─── DGT Process IDs (16 therapeutic processes) ────────────────────────────

export type DGTProcessId =
  | 'VALIDATION'
  | 'DISTRESS_TOLERANCE'
  | 'EMOTION_REGULATION'
  | 'INTERPERSONAL_EFFECTIVENESS'
  | 'MINDFULNESS'
  | 'URGE_SURFING'
  | 'OPPOSITE_ACTION'
  | 'RADICAL_ACCEPTANCE'
  | 'CRISIS_STABILIZATION'
  | 'RELAPSE_INTERRUPTION'
  | 'ABANDONMENT_REGULATION'
  | 'SHUTDOWN_SUPPORT'
  | 'SHAME_SPIRAL_INTERRUPTION'
  | 'CHAIN_ANALYSIS'
  | 'SKILL_SELECTION'
  | 'BOUNDARY_EFFECTIVENESS';

export const ALL_DGT_PROCESSES: readonly DGTProcessId[] = [
  'VALIDATION',
  'DISTRESS_TOLERANCE',
  'EMOTION_REGULATION',
  'INTERPERSONAL_EFFECTIVENESS',
  'MINDFULNESS',
  'URGE_SURFING',
  'OPPOSITE_ACTION',
  'RADICAL_ACCEPTANCE',
  'CRISIS_STABILIZATION',
  'RELAPSE_INTERRUPTION',
  'ABANDONMENT_REGULATION',
  'SHUTDOWN_SUPPORT',
  'SHAME_SPIRAL_INTERRUPTION',
  'CHAIN_ANALYSIS',
  'SKILL_SELECTION',
  'BOUNDARY_EFFECTIVENESS',
] as const;

// ─── DGT Signal IDs (18 detectable emotional/behavioral signals) ───────────

export type DGTSignalId =
  | 'EMOTIONAL_FLOODING'
  | 'SHAME_SPIRAL'
  | 'IMPULSIVITY'
  | 'RELAPSE_URGE'
  | 'ABANDONMENT_PANIC'
  | 'CONTROL_BEHAVIOR'
  | 'RESCUE_OVERLOAD'
  | 'SELF_ATTACK'
  | 'RELATIONAL_ESCALATION'
  | 'PANIC'
  | 'SHUTDOWN'
  | 'EXHAUSTION'
  | 'ANGER_ESCALATION'
  | 'CHECKING_URGE'
  | 'BOUNDARY_COLLAPSE'
  | 'DISSOCIATION_LIKE_DISTANCE'
  | 'CRAVING_WAVE'
  | 'OVERWHELM';

export const ALL_DGT_SIGNALS: readonly DGTSignalId[] = [
  'EMOTIONAL_FLOODING',
  'SHAME_SPIRAL',
  'IMPULSIVITY',
  'RELAPSE_URGE',
  'ABANDONMENT_PANIC',
  'CONTROL_BEHAVIOR',
  'RESCUE_OVERLOAD',
  'SELF_ATTACK',
  'RELATIONAL_ESCALATION',
  'PANIC',
  'SHUTDOWN',
  'EXHAUSTION',
  'ANGER_ESCALATION',
  'CHECKING_URGE',
  'BOUNDARY_COLLAPSE',
  'DISSOCIATION_LIKE_DISTANCE',
  'CRAVING_WAVE',
  'OVERWHELM',
] as const;

// ─── DGT Skill IDs (21 DBT skills, hidden from user by default) ────────────

export type DGTSkillId =
  | 'STOP'
  | 'TIPP'
  | 'ACCEPTS'
  | 'IMPROVE'
  | 'SELF_SOOTHING'
  | 'PROS_CONS'
  | 'RADICAL_ACCEPTANCE'
  | 'TURNING_THE_MIND'
  | 'WILLINGNESS'
  | 'URGE_SURFING'
  | 'GROUNDING'
  | 'PLEASE'
  | 'CHECK_THE_FACTS'
  | 'OPPOSITE_ACTION'
  | 'PROBLEM_SOLVING'
  | 'BUILD_MASTERY'
  | 'ACCUMULATE_POSITIVES'
  | 'COPE_AHEAD'
  | 'DEAR_MAN'
  | 'GIVE'
  | 'FAST'
  | 'WISE_MIND';

export const ALL_DGT_SKILLS: readonly DGTSkillId[] = [
  'STOP',
  'TIPP',
  'ACCEPTS',
  'IMPROVE',
  'SELF_SOOTHING',
  'PROS_CONS',
  'RADICAL_ACCEPTANCE',
  'TURNING_THE_MIND',
  'WILLINGNESS',
  'URGE_SURFING',
  'GROUNDING',
  'PLEASE',
  'CHECK_THE_FACTS',
  'OPPOSITE_ACTION',
  'PROBLEM_SOLVING',
  'BUILD_MASTERY',
  'ACCUMULATE_POSITIVES',
  'COPE_AHEAD',
  'DEAR_MAN',
  'GIVE',
  'FAST',
  'WISE_MIND',
] as const;

// ─── Validation Level IDs (L1-L6, Section 8) ──────────────────────────────

export type ValidationLevelId =
  | 'L1_PRESENCE'
  | 'L2_ACCURATE_REFLECTION'
  | 'L3_EMOTION_REFLECTION'
  | 'L4_CONTEXT_VALIDATION'
  | 'L5_NORMALIZATION'
  | 'L6_RADICAL_GENUINENESS';

export const ALL_VALIDATION_LEVELS: readonly ValidationLevelId[] = [
  'L1_PRESENCE',
  'L2_ACCURATE_REFLECTION',
  'L3_EMOTION_REFLECTION',
  'L4_CONTEXT_VALIDATION',
  'L5_NORMALIZATION',
  'L6_RADICAL_GENUINENESS',
] as const;

// ─── Escalation Stage (Section 9) ─────────────────────────────────────────

export type EscalationStage =
  | 'CALM'
  | 'RISING'
  | 'FLOODING'
  | 'CRISIS'
  | 'SHUTDOWN';

export const ALL_ESCALATION_STAGES: readonly EscalationStage[] = [
  'CALM',
  'RISING',
  'FLOODING',
  'CRISIS',
  'SHUTDOWN',
] as const;

// ─── DGT Target Priority (Section 3) ──────────────────────────────────────

export type DGTTargetPriority =
  | 'IMMEDIATE_SAFETY'
  | 'CRISIS_OR_RELAPSE_DESTABILIZATION'
  | 'INTERACTION_INTERFERING_PATTERN'
  | 'QUALITY_OF_LIFE_PATTERN'
  | 'SKILL_BUILDING';

// ─── DGT Signal Source ─────────────────────────────────────────────────────

export type DGTSignalSource =
  | 'LOCAL_LLM'
  | 'DETERMINISTIC_MARKER'
  | 'BUFFER'
  | 'USER_DAT'
  | 'PROJECTION'
  | 'BACKPACK'
  | 'SCHEMA_MODE'
  | 'ACT'
  | 'CBT'
  | 'VSP'
  | 'EIGEN_REGIE'
  | 'SESSION_END';

// ─── DGT Evidence ──────────────────────────────────────────────────────────

export type DGTEvidenceType =
  | 'TEXT_MARKER'
  | 'PATTERN'
  | 'ZONE_SHIFT'
  | 'BEHAVIOR_SIGNAL'
  | 'RELAPSE_LINK'
  | 'PROJECTION_LINK'
  | 'BACKPACK_LINK'
  | 'BODY_SIGNAL'
  | 'URGE_SIGNAL';

export type DGTEvidenceSourceLayer =
  | 'buffer'
  | 'user.dat'
  | 'projections.dat'
  | 'backpack'
  | 'current_input';

export interface DGTEvidence {
  evidenceType: DGTEvidenceType;
  value: string;
  timestamp: string;
  sourceLayer: DGTEvidenceSourceLayer;
}

// ─── DGT Intervention Hint ─────────────────────────────────────────────────

export type DGTInterventionHint =
  | 'VALIDATE_FIRST'
  | 'GROUND'
  | 'STOP_SKILL'
  | 'TIPP_SKILL'
  | 'URGE_SURF'
  | 'BOUNDARY_SUPPORT'
  | 'OPPOSITE_ACTION'
  | 'RADICAL_ACCEPTANCE'
  | 'CHAIN_ANALYSIS'
  | 'NO_DGT';

// ─── EKT Phase (Section 4: DGT → EKT routing) ─────────────────────────────

export type EKTPhase =
  | 'EKT_CLARIFICATION'
  | 'EKT_MIRROR'
  | 'EKT_CONTRACT'
  | 'EKT_EXIT';

// ─── Kim State Risk (Section 17) ───────────────────────────────────────────

export type KimStateRisk =
  | 'RESCUE_FATIGUE'
  | 'CONTROL_LOOP'
  | 'CAREGIVER_GUILT'
  | 'BOUNDARY_EROSION'
  | 'HYPERVIGILANCE'
  | 'EXHAUSTED_CAREGIVER'
  | 'MORAL_INJURY'
  | 'RELATIONAL_FLOODING';

// ─── Abandonment Panic Subtype (Section 14) ────────────────────────────────

export type AbandonmentPanicSubtype =
  | 'DELAYED_REPLY_PANIC'
  | 'PERCEIVED_REJECTION'
  | 'SEPARATION_THREAT'
  | 'JEALOUSY_FEAR'
  | 'LOSS_PROJECTION'
  | 'REPAIR_URGENCY'
  | 'PROTEST_BEHAVIOR'
  | 'SHUTDOWN_AFTER_ATTACHMENT_THREAT';

// ─── Shame Spiral Stage (Section 15) ───────────────────────────────────────

export type ShameSpiralStage =
  | 'SHAME_TRIGGER'
  | 'SELF_ATTACK'
  | 'IDENTITY_COLLAPSE'
  | 'AVOIDANCE_OR_RELAPSE_URGE'
  | 'BEHAVIOR_RISK'
  | 'REPAIR_POSSIBILITY';

// ─── Relapse Risk Stage (Section 16) ───────────────────────────────────────

export type RelapseRiskStage =
  | 'EMOTIONAL_TRIGGER'
  | 'CRAVING_RISE'
  | 'JUSTIFICATION'
  | 'PREPARATION'
  | 'USE_OR_SLIP'
  | 'SHAME_AFTER'
  | 'REPAIR_WINDOW';

// ─── DGT Candidate ─────────────────────────────────────────────────────────

export interface DGTCandidate {
  processId: DGTProcessId;
  signalId: DGTSignalId;
  skillId: DGTSkillId | null;
  confidence: number;
  source: DGTSignalSource;
  evidence: readonly DGTEvidence[];
  validationLevel: ValidationLevelId;
  escalationStage: EscalationStage;
  allowedForPrompt: boolean;
  interventionHint: DGTInterventionHint;
}

// ─── DGT Decision (output of the router) ───────────────────────────────────

export interface DGTDecision {
  acceptedDGTCandidates: readonly DGTCandidate[];
  rejectedDGTCandidates: readonly DGTCandidate[];
  dominantProcess: DGTProcessId | null;
  dominantSignal: DGTSignalId | null;
  selectedSkill: DGTSkillId | null;
  validationLevel: ValidationLevelId;
  escalationStage: EscalationStage;
  safeToUseDGT: boolean;
  ektPhase: EKTPhase | null;
  reason: string;
  promptSummary: string;
}

// ─── DGT Engine Input ──────────────────────────────────────────────────────

export interface DGTEngineInput {
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
  activeCBTProcess: string | null; // from CBT/CGT engine
  activeProjections: readonly string[];
  stageOfChange: string;
  guidanceDepth: number;
}

// ─── DGT Engine Result ─────────────────────────────────────────────────────

export interface DGTEngineResult {
  decision: DGTDecision;
  promptBlock: string;           // compact injection for GPT
  activated: boolean;            // true if at least one candidate accepted
}

// ─── DGT Progress (persisted in user.dat) ──────────────────────────────────

export interface DGTProgress {
  successfulSkills: DGTSkillId[];           // skills that worked well
  groundingPreference: string[];            // preferred grounding methods
  triggerPatterns: string[];                // recurring trigger patterns
  relapseInterruptionPatterns: string[];    // patterns that interrupted relapse
  effectiveValidationDepth: ValidationLevelId | null; // deepest level that helped
  boundarySkillSuccess: string[];           // boundary skills that worked
  caregiverOverloadPatterns: string[];      // Kim-specific overload patterns
  lastDGTProcessUsed: DGTProcessId | null;
  lastDGTSessionDate: string | null;
}

export function createDefaultDGTProgress(): DGTProgress {
  return {
    successfulSkills: [],
    groundingPreference: [],
    triggerPatterns: [],
    relapseInterruptionPatterns: [],
    effectiveValidationDepth: null,
    boundarySkillSuccess: [],
    caregiverOverloadPatterns: [],
    lastDGTProcessUsed: null,
    lastDGTSessionDate: null,
  };
}

// ─── Signal → Process routing map ──────────────────────────────────────────

export const DGT_SIGNAL_TO_PROCESS_MAP: Record<DGTSignalId, DGTProcessId> = {
  EMOTIONAL_FLOODING: 'DISTRESS_TOLERANCE',
  SHAME_SPIRAL: 'SHAME_SPIRAL_INTERRUPTION',
  IMPULSIVITY: 'DISTRESS_TOLERANCE',
  RELAPSE_URGE: 'RELAPSE_INTERRUPTION',
  ABANDONMENT_PANIC: 'ABANDONMENT_REGULATION',
  CONTROL_BEHAVIOR: 'INTERPERSONAL_EFFECTIVENESS',
  RESCUE_OVERLOAD: 'BOUNDARY_EFFECTIVENESS',
  SELF_ATTACK: 'SHAME_SPIRAL_INTERRUPTION',
  RELATIONAL_ESCALATION: 'INTERPERSONAL_EFFECTIVENESS',
  PANIC: 'CRISIS_STABILIZATION',
  SHUTDOWN: 'SHUTDOWN_SUPPORT',
  EXHAUSTION: 'VALIDATION',
  ANGER_ESCALATION: 'DISTRESS_TOLERANCE',
  CHECKING_URGE: 'URGE_SURFING',
  BOUNDARY_COLLAPSE: 'BOUNDARY_EFFECTIVENESS',
  DISSOCIATION_LIKE_DISTANCE: 'SHUTDOWN_SUPPORT',
  CRAVING_WAVE: 'URGE_SURFING',
  OVERWHELM: 'DISTRESS_TOLERANCE',
};

// ─── Signal → Skill map ────────────────────────────────────────────────────

export const DGT_SIGNAL_TO_SKILL_MAP: Record<DGTSignalId, DGTSkillId> = {
  EMOTIONAL_FLOODING: 'TIPP',
  SHAME_SPIRAL: 'SELF_SOOTHING',
  IMPULSIVITY: 'STOP',
  RELAPSE_URGE: 'URGE_SURFING',
  ABANDONMENT_PANIC: 'STOP',
  CONTROL_BEHAVIOR: 'FAST',
  RESCUE_OVERLOAD: 'FAST',
  SELF_ATTACK: 'SELF_SOOTHING',
  RELATIONAL_ESCALATION: 'DEAR_MAN',
  PANIC: 'TIPP',
  SHUTDOWN: 'GROUNDING',
  EXHAUSTION: 'PLEASE',
  ANGER_ESCALATION: 'STOP',
  CHECKING_URGE: 'URGE_SURFING',
  BOUNDARY_COLLAPSE: 'DEAR_MAN',
  DISSOCIATION_LIKE_DISTANCE: 'GROUNDING',
  CRAVING_WAVE: 'URGE_SURFING',
  OVERWHELM: 'TIPP',
};

// ─── Signal → Intervention Hint map ────────────────────────────────────────

export const DGT_SIGNAL_TO_HINT_MAP: Record<DGTSignalId, DGTInterventionHint> = {
  EMOTIONAL_FLOODING: 'TIPP_SKILL',
  SHAME_SPIRAL: 'VALIDATE_FIRST',
  IMPULSIVITY: 'STOP_SKILL',
  RELAPSE_URGE: 'URGE_SURF',
  ABANDONMENT_PANIC: 'GROUND',
  CONTROL_BEHAVIOR: 'BOUNDARY_SUPPORT',
  RESCUE_OVERLOAD: 'BOUNDARY_SUPPORT',
  SELF_ATTACK: 'VALIDATE_FIRST',
  RELATIONAL_ESCALATION: 'BOUNDARY_SUPPORT',
  PANIC: 'TIPP_SKILL',
  SHUTDOWN: 'GROUND',
  EXHAUSTION: 'VALIDATE_FIRST',
  ANGER_ESCALATION: 'STOP_SKILL',
  CHECKING_URGE: 'URGE_SURF',
  BOUNDARY_COLLAPSE: 'BOUNDARY_SUPPORT',
  DISSOCIATION_LIKE_DISTANCE: 'GROUND',
  CRAVING_WAVE: 'URGE_SURF',
  OVERWHELM: 'TIPP_SKILL',
};

// ─── Validation Level routing by VSP/escalation (Section 8) ────────────────

export const VSP_TO_VALIDATION_LEVEL: Record<string, ValidationLevelId> = {
  PAARS: 'L1_PRESENCE',
  ROOD: 'L2_ACCURATE_REFLECTION',
  ORANJE: 'L3_EMOTION_REFLECTION',
  GEEL: 'L4_CONTEXT_VALIDATION',
  GROEN: 'L5_NORMALIZATION',
};

export const ESCALATION_TO_VALIDATION_LEVEL: Record<EscalationStage, ValidationLevelId> = {
  CRISIS: 'L1_PRESENCE',
  SHUTDOWN: 'L1_PRESENCE',
  FLOODING: 'L2_ACCURATE_REFLECTION',
  RISING: 'L3_EMOTION_REFLECTION',
  CALM: 'L5_NORMALIZATION',
};
