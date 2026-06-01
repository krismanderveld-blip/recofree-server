/**
 * ═══════════════════════════════════════════════════════════════════
 * MBT++ ENGINE — TYPE DEFINITIONS (Round 56)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Mentalization-Based Treatment (MBT++) for RecoFree.
 * Deterministic mentalizing state detection + response mode routing.
 * Supports both Elias (addiction) and Kim (loved one) personas.
 *
 * Canon: RECOFREE_MBT_PLUSPLUS_MANUS_READY_V1.txt
 * ═══════════════════════════════════════════════════════════════════
 */

// ─── Mentalizing States (M0-M7) ─────────────────────────────────

export type MentalizingStateId =
  | 'M0_STABLE_MENTALIZING'
  | 'M1_NARROWED_MENTALIZING'
  | 'M2_COLLAPSED_SELF'
  | 'M3_COLLAPSED_OTHER'
  | 'M4_PSYCHIC_EQUIVALENCE'
  | 'M5_PRETEND_MODE'
  | 'M6_TELEOLOGICAL'
  | 'M7_SHUTDOWN';

export const ALL_MENTALIZING_STATES: readonly MentalizingStateId[] = [
  'M0_STABLE_MENTALIZING',
  'M1_NARROWED_MENTALIZING',
  'M2_COLLAPSED_SELF',
  'M3_COLLAPSED_OTHER',
  'M4_PSYCHIC_EQUIVALENCE',
  'M5_PRETEND_MODE',
  'M6_TELEOLOGICAL',
  'M7_SHUTDOWN',
] as const;

// ─── Response Modes ──────────────────────────────────────────────

export type MBTResponseModeId =
  | 'REGULATE'
  | 'REFLECT'
  | 'CLARIFY'
  | 'BOUNDARY_FIRST'
  | 'VSP_ACTION'
  | 'RELAPSE_PREVENTION'
  | 'REPAIR'
  | 'CONTRACT'
  | 'CRISIS';

export const ALL_MBT_RESPONSE_MODES: readonly MBTResponseModeId[] = [
  'REGULATE',
  'REFLECT',
  'CLARIFY',
  'BOUNDARY_FIRST',
  'VSP_ACTION',
  'RELAPSE_PREVENTION',
  'REPAIR',
  'CONTRACT',
  'CRISIS',
] as const;

// ─── MBT Processes (therapeutic interventions) ───────────────────

export type MBTProcessId =
  | 'VALIDATE_LIVED_EXPERIENCE'
  | 'SLOW_DOWN_INTERPRETATION'
  | 'SEPARATE_FACT_INTERPRETATION'
  | 'HOLD_MULTIPLE_PERSPECTIVES'
  | 'AFFECT_REGULATION_FIRST'
  | 'RESTORE_MENTALIZING'
  | 'REPAIR_MISATTUNEMENT'
  | 'BOUNDARY_PROTECTION'
  | 'CRAVING_UNDER_ATTACHMENT'
  | 'SHAME_AFTER_RELAPSE'
  | 'ANGER_MASKING_HURT'
  | 'NUMBNESS_SHUTDOWN'
  | 'RELATIONAL_ESCALATION_PAUSE'
  | 'COMPASSION_VS_SELF_ERASURE'
  | 'FEAR_OF_MANIPULATION'
  | 'RESCUE_IMPULSE_REDIRECT';

export const ALL_MBT_PROCESSES: readonly MBTProcessId[] = [
  'VALIDATE_LIVED_EXPERIENCE',
  'SLOW_DOWN_INTERPRETATION',
  'SEPARATE_FACT_INTERPRETATION',
  'HOLD_MULTIPLE_PERSPECTIVES',
  'AFFECT_REGULATION_FIRST',
  'RESTORE_MENTALIZING',
  'REPAIR_MISATTUNEMENT',
  'BOUNDARY_PROTECTION',
  'CRAVING_UNDER_ATTACHMENT',
  'SHAME_AFTER_RELAPSE',
  'ANGER_MASKING_HURT',
  'NUMBNESS_SHUTDOWN',
  'RELATIONAL_ESCALATION_PAUSE',
  'COMPASSION_VS_SELF_ERASURE',
  'FEAR_OF_MANIPULATION',
  'RESCUE_IMPULSE_REDIRECT',
] as const;

// ─── MBT Signals (detection markers) ────────────────────────────

export type MBTSignalId =
  | 'CERTAINTY_ABOUT_OTHER'
  | 'RIGID_INTERPRETATION'
  | 'SHAME_FLOOD'
  | 'CRAVING_AFTER_REJECTION'
  | 'ANGER_COVERING_FEAR'
  | 'NUMBNESS_DISSOCIATION'
  | 'PANIC_CONFUSION'
  | 'BLACK_WHITE_THINKING'
  | 'HOSTILE_CERTAINTY'
  | 'SELF_BLAME_LOOP'
  | 'RELAPSE_SHAME'
  | 'BOUNDARY_VIOLATION_REPORT'
  | 'RESCUE_IMPULSE'
  | 'CARETAKER_EXHAUSTION'
  | 'CONFLICT_ESCALATION'
  | 'MANIPULATION_FEAR'
  | 'PRETEND_FINE'
  | 'TELEOLOGICAL_DEMAND';

export const ALL_MBT_SIGNALS: readonly MBTSignalId[] = [
  'CERTAINTY_ABOUT_OTHER',
  'RIGID_INTERPRETATION',
  'SHAME_FLOOD',
  'CRAVING_AFTER_REJECTION',
  'ANGER_COVERING_FEAR',
  'NUMBNESS_DISSOCIATION',
  'PANIC_CONFUSION',
  'BLACK_WHITE_THINKING',
  'HOSTILE_CERTAINTY',
  'SELF_BLAME_LOOP',
  'RELAPSE_SHAME',
  'BOUNDARY_VIOLATION_REPORT',
  'RESCUE_IMPULSE',
  'CARETAKER_EXHAUSTION',
  'CONFLICT_ESCALATION',
  'MANIPULATION_FEAR',
  'PRETEND_FINE',
  'TELEOLOGICAL_DEMAND',
] as const;

// ─── Signal → Process + State Mapping ────────────────────────────

export interface MBTSignalMapping {
  process: MBTProcessId;
  state: MentalizingStateId;
  responseMode: MBTResponseModeId;
  hint: string;
}

export const MBT_SIGNAL_MAP: Record<MBTSignalId, MBTSignalMapping> = {
  CERTAINTY_ABOUT_OTHER: {
    process: 'HOLD_MULTIPLE_PERSPECTIVES',
    state: 'M3_COLLAPSED_OTHER',
    responseMode: 'CLARIFY',
    hint: 'Reduce certainty about other person motives without defending them',
  },
  RIGID_INTERPRETATION: {
    process: 'SLOW_DOWN_INTERPRETATION',
    state: 'M1_NARROWED_MENTALIZING',
    responseMode: 'REFLECT',
    hint: 'Separate fact from interpretation, slow down',
  },
  SHAME_FLOOD: {
    process: 'AFFECT_REGULATION_FIRST',
    state: 'M2_COLLAPSED_SELF',
    responseMode: 'REGULATE',
    hint: 'Regulate shame before any analysis, prevent identity collapse',
  },
  CRAVING_AFTER_REJECTION: {
    process: 'CRAVING_UNDER_ATTACHMENT',
    state: 'M2_COLLAPSED_SELF',
    responseMode: 'VSP_ACTION',
    hint: 'Separate rejection feeling from proven abandonment, name craving as pain exit',
  },
  ANGER_COVERING_FEAR: {
    process: 'ANGER_MASKING_HURT',
    state: 'M3_COLLAPSED_OTHER',
    responseMode: 'REFLECT',
    hint: 'Validate anger as protective, ask what it is standing in front of',
  },
  NUMBNESS_DISSOCIATION: {
    process: 'NUMBNESS_SHUTDOWN',
    state: 'M7_SHUTDOWN',
    responseMode: 'REGULATE',
    hint: 'No deep analysis, body orientation, simple present question',
  },
  PANIC_CONFUSION: {
    process: 'AFFECT_REGULATION_FIRST',
    state: 'M2_COLLAPSED_SELF',
    responseMode: 'REGULATE',
    hint: 'Regulate first, name possible body state, one question max',
  },
  BLACK_WHITE_THINKING: {
    process: 'HOLD_MULTIPLE_PERSPECTIVES',
    state: 'M4_PSYCHIC_EQUIVALENCE',
    responseMode: 'CLARIFY',
    hint: 'Thoughts feel like facts, gently introduce alternative possibilities',
  },
  HOSTILE_CERTAINTY: {
    process: 'SEPARATE_FACT_INTERPRETATION',
    state: 'M3_COLLAPSED_OTHER',
    responseMode: 'BOUNDARY_FIRST',
    hint: 'Validate impact, reduce certainty, return to boundary and next safe action',
  },
  SELF_BLAME_LOOP: {
    process: 'VALIDATE_LIVED_EXPERIENCE',
    state: 'M2_COLLAPSED_SELF',
    responseMode: 'REGULATE',
    hint: 'Remove moral collapse, restore mentalizing, keep event specific',
  },
  RELAPSE_SHAME: {
    process: 'SHAME_AFTER_RELAPSE',
    state: 'M2_COLLAPSED_SELF',
    responseMode: 'REGULATE',
    hint: 'Remove moral collapse, prevent shame from causing second relapse',
  },
  BOUNDARY_VIOLATION_REPORT: {
    process: 'BOUNDARY_PROTECTION',
    state: 'M1_NARROWED_MENTALIZING',
    responseMode: 'BOUNDARY_FIRST',
    hint: 'Do not explore other person motives first, prioritize safety',
  },
  RESCUE_IMPULSE: {
    process: 'RESCUE_IMPULSE_REDIRECT',
    state: 'M5_PRETEND_MODE',
    responseMode: 'CLARIFY',
    hint: 'Separate care from rescue, protect self without guilt',
  },
  CARETAKER_EXHAUSTION: {
    process: 'COMPASSION_VS_SELF_ERASURE',
    state: 'M1_NARROWED_MENTALIZING',
    responseMode: 'BOUNDARY_FIRST',
    hint: 'Validate exhaustion, remove responsibility for recovery, define self-protection',
  },
  CONFLICT_ESCALATION: {
    process: 'RELATIONAL_ESCALATION_PAUSE',
    state: 'M4_PSYCHIC_EQUIVALENCE',
    responseMode: 'BOUNDARY_FIRST',
    hint: 'Pause, boundary-first, no repair while activated',
  },
  MANIPULATION_FEAR: {
    process: 'FEAR_OF_MANIPULATION',
    state: 'M3_COLLAPSED_OTHER',
    responseMode: 'CLARIFY',
    hint: 'Separate observation from interpretation, boundary regardless of motive',
  },
  PRETEND_FINE: {
    process: 'RESTORE_MENTALIZING',
    state: 'M5_PRETEND_MODE',
    responseMode: 'REFLECT',
    hint: 'Gently name disconnect between words and likely state',
  },
  TELEOLOGICAL_DEMAND: {
    process: 'SLOW_DOWN_INTERPRETATION',
    state: 'M6_TELEOLOGICAL',
    responseMode: 'CLARIFY',
    hint: 'Only actions count as proof of care — redirect to inner states',
  },
};

// ─── State → Severity Mapping ────────────────────────────────────

export const MBT_STATE_SEVERITY: Record<MentalizingStateId, number> = {
  M0_STABLE_MENTALIZING: 0,
  M1_NARROWED_MENTALIZING: 1,
  M2_COLLAPSED_SELF: 2,
  M3_COLLAPSED_OTHER: 2,
  M4_PSYCHIC_EQUIVALENCE: 3,
  M5_PRETEND_MODE: 2,
  M6_TELEOLOGICAL: 3,
  M7_SHUTDOWN: 4,
};

// ─── Routing Priority (Section 13) ──────────────────────────────

export const MBT_ROUTING_PRIORITY: readonly MBTResponseModeId[] = [
  'CRISIS',
  'BOUNDARY_FIRST',
  'RELAPSE_PREVENTION',
  'VSP_ACTION',
  'REGULATE',
  'REPAIR',
  'CLARIFY',
  'REFLECT',
  'CONTRACT',
] as const;

// ─── MBT Candidate (detection result) ───────────────────────────

export interface MBTCandidate {
  signal: MBTSignalId;
  confidence: number;
  detectedState: MentalizingStateId;
  suggestedProcess: MBTProcessId;
  suggestedResponseMode: MBTResponseModeId;
  hint: string;
}

// ─── MBT Decision (router output) ───────────────────────────────

export interface MBTDecision {
  acceptedMBTCandidates: MBTCandidate[];
  rejectedMBTCandidates: MBTCandidate[];
  dominantProcess: MBTProcessId | null;
  dominantSignal: MBTSignalId | null;
  detectedState: MentalizingStateId;
  responseMode: MBTResponseModeId;
  safeToUseMBT: boolean;
  reason: string;
  promptSummary: string;
}

// ─── MBT Engine Result (pipeline output) ─────────────────────────

export interface MBTEngineResult {
  decision: MBTDecision;
  promptBlock: string;
  activated: boolean;
}

// ─── MBT Progress (user.dat persistence) ─────────────────────────

export interface MBTProgress {
  dominantMentalizingPattern: MentalizingStateId | null;
  recurringCollapsePatterns: MBTSignalId[];
  successfulRepairs: number;
  successfulRegulations: number;
  boundaryProtectionsUsed: number;
  preferredResponseModes: MBTResponseModeId[];
  lastMBTProcessUsed: MBTProcessId | null;
  lastMBTSessionDate: string | null;
}

export function createDefaultMBTProgress(): MBTProgress {
  return {
    dominantMentalizingPattern: null,
    recurringCollapsePatterns: [],
    successfulRepairs: 0,
    successfulRegulations: 0,
    boundaryProtectionsUsed: 0,
    preferredResponseModes: [],
    lastMBTProcessUsed: null,
    lastMBTSessionDate: null,
  };
}

// ─── VSP → Response Mode Mapping ─────────────────────────────────

export const VSP_TO_MBT_RESPONSE: Record<string, MBTResponseModeId> = {
  GREEN: 'REFLECT',
  GROEN: 'REFLECT',
  LICHTGROEN: 'REFLECT',
  YELLOW: 'CLARIFY',
  GEEL: 'CLARIFY',
  ORANGE: 'REGULATE',
  ORANJE: 'REGULATE',
  RED: 'CRISIS',
  ROOD: 'CRISIS',
};

// ─── Mentalizing State → Max Depth Mapping ───────────────────────

export const MBT_STATE_MAX_DEPTH: Record<MentalizingStateId, number> = {
  M0_STABLE_MENTALIZING: 3,   // full reflective depth
  M1_NARROWED_MENTALIZING: 2, // moderate depth
  M2_COLLAPSED_SELF: 1,       // regulate only
  M3_COLLAPSED_OTHER: 1,      // boundary + clarify only
  M4_PSYCHIC_EQUIVALENCE: 1,  // gentle challenge only
  M5_PRETEND_MODE: 2,         // careful reflection
  M6_TELEOLOGICAL: 1,         // redirect only
  M7_SHUTDOWN: 0,             // body orientation only
};
