/**
 * Memory Core Types — Global contracts for the RecoFree memory write routing system.
 * Engine beslist, GPT voert uit.
 */

export type RecoFreePersona = "elias" | "kim";

export type MemoryLayerName =
  | "user.dat"
  | "state.dat"
  | "projections.dat"
  | "buffer"
  | "logs.dat";

export type MemorySource =
  | "SignalEngine_6c"
  | "MoodExtraction_6d"
  | "VSPZone_6e"
  | "SchemaMode_6f"
  | "ActiveModuleSelector_12"
  | "ResponseModeRouter_13"
  | "SessionSummaryLLM"
  | "LogsExtractionRouter"
  | "PsychoEducation_PE"
  | "Steunpilaren_PAAL01"
  | "SelfAcceptance_BLIK01"
  | "SelfAcceptance_ONTK01"
  | "SelfAcceptance_IKST01"
  | "SelfAcceptance_COEX01";

export type MemoryPatchOperation =
  | "UPSERT"
  | "APPEND"
  | "INCREMENT"
  | "REPLACE_CURRENT"
  | "DECAY_REFRESH_UPSERT"
  | "MOVING_AVERAGE_UPSERT"
  | "ENCRYPTED_APPEND"
  | "NOOP";

export interface PipelineTurnContext {
  turnId: string;
  sessionId: string;
  localUserId: string;
  persona: RecoFreePersona;
  timestampIso: string;
  appVersion: string;
  pipelineVersion: string;
  inputHash: string;
  language: "nl" | "en" | "fr" | "es" | "pl" | "mixed" | "unknown";
}

export interface DetectedFear {
  label: string;
  normalizedLabel: string;
  category:
    | "abandonment"
    | "relapse"
    | "failure"
    | "rejection"
    | "loss"
    | "conflict"
    | "shame"
    | "health"
    | "future"
    | "unknown";
  confidence: number;
  sourceKind: "explicit_user_text" | "pattern_inference" | "session_summary";
  evidenceHash?: string;
}

export interface DetectedHope {
  label: string;
  normalizedLabel: string;
  category:
    | "recovery"
    | "connection"
    | "stability"
    | "trust"
    | "self_respect"
    | "family"
    | "future"
    | "unknown";
  confidence: number;
  sourceKind: "explicit_user_text" | "pattern_inference" | "session_summary";
  evidenceHash?: string;
}

export interface DetectedTrigger {
  label: string;
  normalizedTrigger: string;
  triggerType:
    | "external_event"
    | "relationship"
    | "emotion"
    | "body_state"
    | "time_of_day"
    | "place"
    | "person"
    | "thought"
    | "substance_access"
    | "memory"
    | "unknown";
  confidence: number;
  sourceKind: "explicit_user_text" | "pattern_inference" | "session_summary";
  evidenceHash?: string;
}

export interface DetectedSchemaTendency {
  schemaId: string;
  schemaName: string;
  confidence: number;
  sourceKind: "schema_mode_engine" | "session_summary";
  evidenceHash?: string;
}

export interface DetectedModeTendency {
  modeId: string;
  modeName: string;
  confidence: number;
  sourceKind: "schema_mode_engine" | "session_summary";
  evidenceHash?: string;
}

export interface MoodStateExtraction {
  craving?: number;
  frustration?: number;
  despondency?: number;
  focus?: number;
  stress?: number;
  boundaryFatigue?: number;
  emotionalBurden?: number;
  selfCare?: number;
  sourceKind: "slider_ui" | "pipeline_explicit_text" | "not_detected";
  confidence: number;
}

export interface ZoneDecision {
  zone: "GREEN" | "YELLOW" | "ORANGE" | "RED" | "PURPLE" | "UNKNOWN";
  zoneNumeric?: number;
  confidence: number;
  sourceKind: "VSPZone_6e" | "ResponseModeRouter_13";
}

export interface ActiveModuleDecision {
  moduleId: string;
  persona: RecoFreePersona;
  responseMode: string;
  confidence: number;
}

export interface PipelineDetectionBundle {
  context: PipelineTurnContext;
  fears: DetectedFear[];
  hopes: DetectedHope[];
  triggers: DetectedTrigger[];
  schemaTendencies: DetectedSchemaTendency[];
  modeTendencies: DetectedModeTendency[];
  moodState: MoodStateExtraction | null;
  zoneDecision: ZoneDecision | null;
  activeModule: ActiveModuleDecision | null;
  psychoEducationActivation: PsychoEducationActivation | null;
  paal01Activation: Paal01Activation | null;
  selfAcceptanceActivation: SelfAcceptanceActivation | null;
}

export interface Paal01Activation {
  moduleId: 'PAAL01';
  triggerContext: string;
  confidence: number;
  matchedMarkers: string[];
}

export interface SelfAcceptanceActivation {
  moduleId: 'BLIK01' | 'ONTK01' | 'IKST01' | 'COEX01';
  confidence: number;
  matchedMarkers: string[];
  interventionType: string;
  patternType?: string;
}

export interface PsychoEducationActivation {
  moduleId: 'WILSKRACHT01' | 'AUTOPILOT01';
  detectedMarkers: string[];
  activationConfidence: number;
  responseMode: 'FULL_PSYCHOEDUCATION' | 'REINFORCEMENT' | 'CONTINUITY_ONLY';
  crisisOverride: boolean;
  memoryHints: {
    previousActivations: number;
    lastDiscussedConcepts: string[];
  } | null;
}

export interface MemoryWritePatch {
  patchId: string;
  layer: MemoryLayerName;
  operation: MemoryPatchOperation;
  path: string;
  source: MemorySource;
  payload: unknown;
  shouldWrite: boolean;
  reason: string;
}

export interface MemoryWritePlan {
  planId: string;
  turnId: string;
  sessionId: string;
  persona: RecoFreePersona;
  createdAt: string;
  patches: MemoryWritePatch[];
}

export interface MemoryCommitResult {
  planId: string;
  turnId: string;
  sessionId: string;
  persona: RecoFreePersona;
  committedAt: string;
  changedFields: string[];
  skippedFields: Array<{ path: string; reason: string }>;
  errors: Array<{ path: string; message: string }>;
}

export interface MemoryDebugOutput {
  turnId: string;
  sessionId: string;
  detectedCounts: {
    fears: number;
    hopes: number;
    triggers: number;
    schemaTendencies: number;
    modeTendencies: number;
  };
  generatedPatchCount: number;
  writablePatchCount: number;
  changedFields: string[];
  skippedFields: Array<{ path: string; reason: string }>;
  errors: Array<{ path: string; message: string }>;
  conversationHistoryStrategy: "FULL_HISTORY_DISABLED" | "LEGACY_FULL_HISTORY";
  contextSource: "LOGS_DAT_SUMMARIES" | "BUFFER_ONLY" | "LEGACY_HISTORY";
}

/** Write confidence thresholds */
export const WRITE_THRESHOLDS = {
  /** Per-turn fear/hope write threshold */
  FEAR_PER_TURN: 0.60,
  HOPE_PER_TURN: 0.60,
  /** Per-turn trigger write threshold (any confidence triggers a frequency upsert) */
  TRIGGER_PER_TURN: 0.50,
  /** Per-turn schema/mode write threshold */
  SCHEMA_PER_TURN: 0.35,
  MODE_PER_TURN: 0.35,
  /** Mood state write threshold */
  MOOD_CONFIDENCE: 0.75,
  /** Session-end extraction thresholds (higher because compressed/less precise) */
  FEAR_SESSION_END: 0.70,
  HOPE_SESSION_END: 0.70,
  TRIGGER_SESSION_END: 0.72,
  SCHEMA_SESSION_END: 0.75,
  MODE_SESSION_END: 0.75,
} as const;
