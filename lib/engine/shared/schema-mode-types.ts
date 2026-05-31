/**
 * Schema Mode Engine — Type Contracts
 * Based on RECOFREE_SCHEMA_MODE_ENGINE_CANON_V1 Section 9
 *
 * HYBRID persistence model:
 * - Tendencies/patterns persist in user.dat
 * - Active mode state lives in buffer/session only (never persisted as identity)
 *
 * NON-DIAGNOSTIC RULE:
 * - All labels are candidate lenses, not diagnoses
 * - Need-first language in all prompt output
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Canonical Enums
// ═══════════════════════════════════════════════════════════════════════════════

export const SCHEMA_IDS = [
  'ABANDONMENT_INSTABILITY',
  'MISTRUST_ABUSE',
  'EMOTIONAL_DEPRIVATION',
  'DEFECTIVENESS_SHAME',
  'SOCIAL_ISOLATION',
  'DEPENDENCE_INCOMPETENCE',
  'VULNERABILITY_TO_HARM',
  'ENMESHMENT_UNDEVELOPED_SELF',
  'FAILURE',
  'ENTITLEMENT_GRANDIOSITY',
  'INSUFFICIENT_SELF_CONTROL',
  'SUBJUGATION',
  'SELF_SACRIFICE',
  'APPROVAL_SEEKING',
  'NEGATIVITY_PESSIMISM',
  'EMOTIONAL_INHIBITION',
  'UNRELENTING_STANDARDS',
  'PUNITIVENESS',
] as const;

export type SchemaId = typeof SCHEMA_IDS[number];

export const SCHEMA_DOMAINS = [
  'DISCONNECTION_REJECTION',
  'IMPAIRED_AUTONOMY_PERFORMANCE',
  'IMPAIRED_LIMITS',
  'OTHER_DIRECTEDNESS',
  'OVERVIGILANCE_INHIBITION',
] as const;

export type SchemaDomain = typeof SCHEMA_DOMAINS[number];

export const MODE_IDS = [
  'VULNERABLE_CHILD',
  'ANGRY_CHILD',
  'IMPULSIVE_CHILD',
  'HAPPY_CHILD',
  'DETACHED_PROTECTOR',
  'AVOIDANT_PROTECTOR',
  'COMPLIANT_SURRENDERER',
  'OVERCOMPENSATOR',
  'PUNITIVE_PARENT',
  'DEMANDING_PARENT',
  'HEALTHY_ADULT',
  'CAREGIVER_SELF',
  'BOUNDARY_SELF',
  'CRISIS_COLLAPSE',
  'RELAPSE_SEEKING',
  'RELAPSE_JUSTIFYING',
  'SHAME_SPIRAL',
  'RELATIONAL_PANIC',
  'RESCUE_MODE',
  'CONTROL_MODE',
  'EXHAUSTED_CAREGIVER',
  'MORAL_INJURY',
] as const;

export type ModeId = typeof MODE_IDS[number];

export const COPING_STYLES = [
  'SURRENDER',
  'AVOIDANCE',
  'OVERCOMPENSATION',
] as const;

export type CopingStyle = typeof COPING_STYLES[number];

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Schema → Domain Mapping
// ═══════════════════════════════════════════════════════════════════════════════

export const SCHEMA_DOMAIN_MAP: Record<SchemaId, SchemaDomain> = {
  ABANDONMENT_INSTABILITY: 'DISCONNECTION_REJECTION',
  MISTRUST_ABUSE: 'DISCONNECTION_REJECTION',
  EMOTIONAL_DEPRIVATION: 'DISCONNECTION_REJECTION',
  DEFECTIVENESS_SHAME: 'DISCONNECTION_REJECTION',
  SOCIAL_ISOLATION: 'DISCONNECTION_REJECTION',
  DEPENDENCE_INCOMPETENCE: 'IMPAIRED_AUTONOMY_PERFORMANCE',
  VULNERABILITY_TO_HARM: 'IMPAIRED_AUTONOMY_PERFORMANCE',
  ENMESHMENT_UNDEVELOPED_SELF: 'IMPAIRED_AUTONOMY_PERFORMANCE',
  FAILURE: 'IMPAIRED_AUTONOMY_PERFORMANCE',
  ENTITLEMENT_GRANDIOSITY: 'IMPAIRED_LIMITS',
  INSUFFICIENT_SELF_CONTROL: 'IMPAIRED_LIMITS',
  SUBJUGATION: 'OTHER_DIRECTEDNESS',
  SELF_SACRIFICE: 'OTHER_DIRECTEDNESS',
  APPROVAL_SEEKING: 'OTHER_DIRECTEDNESS',
  NEGATIVITY_PESSIMISM: 'OVERVIGILANCE_INHIBITION',
  EMOTIONAL_INHIBITION: 'OVERVIGILANCE_INHIBITION',
  UNRELENTING_STANDARDS: 'OVERVIGILANCE_INHIBITION',
  PUNITIVENESS: 'OVERVIGILANCE_INHIBITION',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Mode → User Type Mapping
// ═══════════════════════════════════════════════════════════════════════════════

/** Modes primarily relevant for Elias (addiction recovery) */
export const ELIAS_PRIMARY_MODES: ReadonlyArray<ModeId> = [
  'VULNERABLE_CHILD',
  'ANGRY_CHILD',
  'IMPULSIVE_CHILD',
  'DETACHED_PROTECTOR',
  'AVOIDANT_PROTECTOR',
  'PUNITIVE_PARENT',
  'DEMANDING_PARENT',
  'HEALTHY_ADULT',
  'RELAPSE_SEEKING',
  'RELAPSE_JUSTIFYING',
  'SHAME_SPIRAL',
  'CRISIS_COLLAPSE',
  'RELATIONAL_PANIC',
  'MORAL_INJURY',
];

/** Modes primarily relevant for Kim (loved one / caregiver) */
export const KIM_PRIMARY_MODES: ReadonlyArray<ModeId> = [
  'VULNERABLE_CHILD',
  'ANGRY_CHILD',
  'COMPLIANT_SURRENDERER',
  'RESCUE_MODE',
  'CONTROL_MODE',
  'EXHAUSTED_CAREGIVER',
  'PUNITIVE_PARENT',
  'DEMANDING_PARENT',
  'BOUNDARY_SELF',
  'CAREGIVER_SELF',
  'MORAL_INJURY',
];

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Type Contracts (Section 9)
// ═══════════════════════════════════════════════════════════════════════════════

export type ModeSignalSource =
  | 'LOCAL_LLM'
  | 'DETERMINISTIC_MARKER'
  | 'VSP'
  | 'EIGEN_REGIE'
  | 'BUFFER'
  | 'USER_DAT'
  | 'PROJECTION'
  | 'BACKPACK'
  | 'SESSION_END';

export type ModeEvidenceType =
  | 'TEXT_MARKER'
  | 'SLIDER_SHIFT'
  | 'ZONE_SHIFT'
  | 'PROJECTION_ENTRY'
  | 'HISTORY_PATTERN'
  | 'BEHAVIORAL_SIGNAL';

export type SourceLayer =
  | 'user.dat'
  | 'buffer'
  | 'projections.dat'
  | 'backpack'
  | 'current_input';

export type ModeEvidence = {
  evidenceType: ModeEvidenceType;
  value: string;
  timestamp: string;
  sourceLayer: SourceLayer;
};

export type ModeInterventionHint =
  | 'VALIDATE'
  | 'STABILIZE'
  | 'GROUND'
  | 'NAME_PATTERN'
  | 'NEED_TRANSLATION'
  | 'BOUNDARY_SUPPORT'
  | 'DEFUSION'
  | 'SELF_COMPASSION'
  | 'CRISIS_ESCALATION'
  | 'RELAPSE_PREVENTION'
  | 'MOTIVATIONAL_INTERVIEWING'
  | 'NO_INTERVENTION';

export type ModeCandidate = {
  modeId: ModeId;
  confidence: number; // 0.0 - 1.0
  source: ModeSignalSource;
  evidence: ReadonlyArray<ModeEvidence>;
  riskWeight: number; // 0.0 - 1.0
  interventionHint: ModeInterventionHint;
  allowedForPrompt: boolean;
};

export type ModeDecision = {
  acceptedModes: ReadonlyArray<ModeCandidate>;
  rejectedModes: ReadonlyArray<ModeCandidate>;
  dominantMode: ModeId | null;
  modeConflict: boolean;
  reason: string;
  promptSummary: string;
};

export type SchemaEvidenceType =
  | 'REPEATED_PATTERN'
  | 'CURRENT_LANGUAGE'
  | 'BACKPACK_LINK'
  | 'RELATIONAL_TRIGGER'
  | 'PROJECTION_LINK'
  | 'VSP_LINK'
  | 'EIGEN_REGIE_LINK';

export type SchemaEvidence = {
  evidenceType: SchemaEvidenceType;
  value: string;
  timestamp: string;
  sourceLayer: SourceLayer;
};

export type SchemaActivationState =
  | 'DORMANT'
  | 'POSSIBLE'
  | 'ACTIVE'
  | 'HIGHLY_ACTIVE'
  | 'UNSAFE_TO_EXPLORE';

export type SchemaCandidate = {
  schemaId: SchemaId;
  domain: SchemaDomain;
  confidence: number; // 0.0 - 1.0
  evidence: ReadonlyArray<SchemaEvidence>;
  activationState: SchemaActivationState;
  copingStyle: CopingStyle | null;
  allowedForPrompt: boolean;
};

export type SchemaDecision = {
  acceptedSchemas: ReadonlyArray<SchemaCandidate>;
  rejectedSchemas: ReadonlyArray<SchemaCandidate>;
  dominantSchema: SchemaId | null;
  dominantDomain: SchemaDomain | null;
  safeToExplore: boolean;
  promptSummary: string;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Detection Input Context
// ═══════════════════════════════════════════════════════════════════════════════

export type SchemaModeDetectionInput = {
  /** Current user message (English, post-translation) */
  message: string;
  /** User type for mode filtering */
  userType: 'elias' | 'kim';
  /** Current zone color (GREEN/YELLOW/ORANGE/RED/PURPLE) */
  zoneColor: string;
  /** Current VSP level if available */
  vspLevel: string | null;
  /** Key mood sliders (0-10) */
  sliders: Record<string, number>;
  /** Active projection entries if available */
  activeProjections: Array<{ category: string; content: string; strength: number }>;
  /** Mode tendencies from user.dat (historical patterns) */
  modeTendencies: Array<{ modeId: string; frequency: number; lastSeen: string }>;
  /** Schema tendencies from user.dat (historical patterns) */
  schemaTendencies: Array<{ schemaId: string; frequency: number; lastSeen: string }>;
  /** Whether crisis is active */
  isCrisis: boolean;
  /** Session message count (for repetition detection) */
  messageCount: number;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Combined Engine Result
// ═══════════════════════════════════════════════════════════════════════════════

export type SchemaModeEngineResult = {
  modeDecision: ModeDecision;
  schemaDecision: SchemaDecision;
  /** Compact prompt injection string (empty if nothing safe to inject) */
  promptInjection: string;
  /** Whether any mode/schema was activated this turn */
  activated: boolean;
  /** Modes activated this session (for within-session tracking) */
  sessionActivatedModes: ModeId[];
  /** Schemas activated this session (for within-session tracking) */
  sessionActivatedSchemas: SchemaId[];
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Persistence Types (user.dat additions)
// ═══════════════════════════════════════════════════════════════════════════════

export type ModeTendency = {
  modeId: ModeId;
  frequency: number;
  lastSeen: string;
  effectiveInterventions: string[];
};

export type SchemaTendency = {
  schemaId: SchemaId;
  domain: SchemaDomain;
  frequency: number;
  lastSeen: string;
  copingStyle: CopingStyle | null;
};

export type SchemaModeUserDatFields = {
  modeTendencies: ModeTendency[];
  schemaTendencies: SchemaTendency[];
};
