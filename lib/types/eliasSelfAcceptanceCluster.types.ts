/**
 * Shared TypeScript contracts for Elias Self-Acceptance Cluster
 * Modules: BLIK01, ONTK01, IKST01, COEX01
 */

export type RecoFreePersona = "elias" | "kim";

export type EliasSelfAcceptanceModuleId = "BLIK01" | "ONTK01" | "IKST01" | "COEX01";

export type EliasSelfAcceptanceActivationStatus =
  | "ACTIVE"
  | "NOT_ACTIVE"
  | "BLOCKED_BY_PERSONA"
  | "BLOCKED_BY_INTAKE"
  | "BLOCKED_BY_CRISIS"
  | "DEFER_TO_SAFETY"
  | "DEFER_TO_ROUW01"
  | "DEFER_TO_IDEN01"
  | "DEFER_TO_STO01"
  | "BRIDGE_TO_PAAL01"
  | "BRIDGE_TO_ROUW01"
  | "BRIDGE_TO_IDEN01"
  | "BRIDGE_TO_STO01";

export type EliasMemoryLayer = "buffer" | "state.dat" | "user.dat" | "projections.dat" | "logs.dat";

export type EliasClusterLanguage = "nl" | "en" | "fr" | "mixed" | "unknown";

export type EliasConfidenceBand = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

export interface SupportPillarReference {
  pillarId: string;
  label: string;
  type: "person" | "routine" | "place" | "belief" | "value" | "boundary" | "project" | "micro_anchor" | "unknown";
  active: boolean;
}

export interface EliasSelfAcceptanceMemoryHints {
  activeModuleIds: EliasSelfAcceptanceModuleId[];
  moduleUsageCount: Record<string, number>;
  knownPatterns: string[];
  knownBeliefs: string[];
  knownHandles: string[];
  recentSafeLogSummaries: string[];
  lastActivatedAt: Partial<Record<EliasSelfAcceptanceModuleId, string>>;
}

export interface EliasSelfAcceptanceRuntimeInput {
  persona: RecoFreePersona;
  intakeCompleted: boolean;
  userId: string;
  sessionId: string;
  turnId: string;
  turnIndex: number;
  timestampIso: string;
  latestUserMessage: string;
  recentMessages: string[];
  language: EliasClusterLanguage;
  currentZone: "GROEN" | "GEEL" | "ORANJE" | "ROOD" | "PAARS" | "UNKNOWN";
  stabilizedEnoughForReflection: boolean;
  crisisDetected: boolean;
  suicideSelfHarmDetected: boolean;
  acuteDangerDetected: boolean;
  relapseIntentDetected: boolean;
  severeIntoxicationDetected: boolean;
  medicalEmergencyDetected: boolean;
  activeGroundingNeeded: boolean;
  paal01Available: boolean;
  paal01KnownSupportPillars: SupportPillarReference[];
  existingEliasMemoryHints: EliasSelfAcceptanceMemoryHints;
}

export interface EliasSelfAcceptanceDetectionResult {
  moduleId: EliasSelfAcceptanceModuleId;
  activationStatus: EliasSelfAcceptanceActivationStatus;
  confidenceScore: number;
  confidenceBand: EliasConfidenceBand;
  matchedMarkers: string[];
  matchedMarkerGroups: string[];
  selectedInterventionType: string;
  recommendedBridgeModules: Array<"PAAL01" | "ROUW01" | "IDEN01" | "STO01">;
  reason: string;
}

export interface EliasSelfAcceptancePromptPayload {
  persona: "elias";
  moduleId: EliasSelfAcceptanceModuleId;
  selectedInterventionType: string;
  compactPrompt: string;
  fullPrompt: string;
  memoryDirective: EliasSelfAcceptanceMemoryUseDirective;
  forbiddenOutput: string[];
  store: false;
  gptMayDiagnose: false;
  gptMayUseKimData: false;
  gptMayOverrideCrisis: false;
}

export interface EliasSelfAcceptanceMemoryUseDirective {
  directiveId: string;
  moduleId: EliasSelfAcceptanceModuleId;
  hardDirective: true;
  useAtEveryRelevantTurn: true;
  useAtTurnFivePlus: true;
  notKeywordGated: true;
  notLimitedToSessionStart: true;
  notLimitedToFirstTwoTurns: true;
  layersUsed: EliasMemoryLayer[];
  directiveText: string;
}

export interface EliasSelfAcceptanceMemoryPatch {
  persona: "elias";
  moduleId: EliasSelfAcceptanceModuleId;
  activationTimestampIso: string;
  sessionId: string;
  turnId: string;
  writes: {
    buffer: ClusterBufferPatch;
    stateDat: ClusterStateDatPatch | null;
    userDat: ClusterUserDatPatch | null;
    projectionsDat: ClusterProjectionsDatPatch | null;
    logsDat: ClusterLogsDatPatch | null;
  };
  layerJustification: Record<string, string | undefined>;
}

export interface ClusterBufferPatch {
  activeModuleId: EliasSelfAcceptanceModuleId;
  activeInterventionType: string;
  currentTurnDirective: string;
  extractedCandidates: string[];
  expiresAtTurnEnd: boolean;
}

export interface ClusterStateDatPatch {
  activeTherapeuticFrame:
    | "support_pillar_shock"
    | "denial_pattern_reflection"
    | "ego_strength_recovery"
    | "existential_acceptance";
  activeModuleId: EliasSelfAcceptanceModuleId;
  currentZoneAtActivation: string;
  lastActivatedAt: string;
  lastActivationTurnId: string;
  stabilizedEnoughForReflection: boolean;
  bridgeCandidateModules: Array<"PAAL01" | "ROUW01" | "IDEN01" | "STO01">;
}

export interface ClusterUserDatPatch {
  moduleUsage: {
    moduleId: EliasSelfAcceptanceModuleId;
    incrementBy: 1;
    firstDetectedAt: string;
    lastUpdatedAt: string;
  };
  learnedPatterns: ClusterLearnedPatternPatch[];
}

export interface ClusterLearnedPatternPatch {
  patternId: string;
  patternType: string;
  label: string;
  normalizedLabel: string;
  confidence: number;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  sourceModuleId: EliasSelfAcceptanceModuleId;
  neverUseAsDiagnosis: true;
}

export interface ClusterProjectionsDatPatch {
  upsertBeliefs: ClusterBeliefPatch[];
  upsertHandles: ClusterHandlePatch[];
}

export interface ClusterBeliefPatch {
  beliefId: string;
  label: string;
  normalizedLabel: string;
  sourceModuleId: EliasSelfAcceptanceModuleId;
  confidence: number;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  mustFrameAsMutable: true;
}

export interface ClusterHandlePatch {
  handleId: string;
  label: string;
  instruction: string;
  sourceModuleId: EliasSelfAcceptanceModuleId;
  firstDetectedAt: string;
  lastUpdatedAt: string;
}

export interface ClusterLogsDatPatch {
  encryptedEventType: "therapeutic_module_activation";
  moduleId: EliasSelfAcceptanceModuleId;
  timestampIso: string;
  sessionId: string;
  turnId: string;
  safeSummary: string;
  rawTextStored: false;
  storePolicy: "local_encrypted_only";
}
