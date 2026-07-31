/**
 * Shared TypeScript contracts for Kim Pattern Support modules:
 * PAAL-K01, BEHE-K01, AANP-K01, CODEP-K01
 *
 * Kim-only. Elias may never activate or read these modules.
 */

export type KimPatternSupportModuleId =
  | "PAAL-K01"
  | "BEHE-K01"
  | "AANP-K01"
  | "CODEP-K01";

export type RecoFreePersona = "elias" | "kim";

export type KimPatternActivationStatus =
  | "ACTIVE"
  | "NOT_ACTIVE"
  | "BLOCKED_BY_PERSONA"
  | "BLOCKED_BY_INTAKE"
  | "BLOCKED_BY_CRISIS"
  | "DEFER_TO_CRISIS_K01"
  | "DEFER_TO_GEVAAR_K01"
  | "DEFER_TO_KIND_K01"
  | "DEFER_TO_HERV_K01"
  | "DEFER_TO_HOOP_K01"
  | "DEFER_TO_SCHAAM_K01"
  | "DEFER_TO_ISOL_K01"
  | "DEFER_TO_K06"
  | "OFFER_AS_FOLLOWUP";

export type KimPatternLanguage = "nl" | "en" | "fr" | "mixed" | "unknown";

export type KimConfidenceBand =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "VERY_HIGH";

export type KimMemoryLayer =
  | "buffer"
  | "state.dat"
  | "user.dat"
  | "projections.dat"
  | "logs.dat";

export interface KimPatternRuntimeInput {
  persona: RecoFreePersona;
  intakeCompleted: boolean;
  userId: string;
  sessionId: string;
  turnId: string;
  turnIndex: number;
  timestampIso: string;
  latestUserMessage: string;
  recentMessages: string[];
  language: KimPatternLanguage;
  currentKimZone:
    | "GROEN"
    | "GEEL"
    | "ORANJE"
    | "ROOD"
    | "PAARS"
    | "UNKNOWN";
  stabilizedEnoughForReflection: boolean;
  crisisDetected: boolean;
  selfHarmOrSuicideDetected: boolean;
  acuteDangerDetected: boolean;
  domesticViolenceOrAbuseDetected: boolean;
  childDangerDetected: boolean;
  activeRelapseCrisisDetected: boolean;
  caregiverOverwhelmed: boolean;
  existingKimMemoryHints: KimPatternMemoryHints;
}

export interface KimPatternMemoryHints {
  knownSupportPillars: string[];
  knownBalanceDraaglast: string[];
  knownBalanceDraagkracht: string[];
  activeControlPatternIds: string[];
  activeAdaptationPatternIds: string[];
  activeCodepPatternIds: string[];
  activeProjections: string[];
  recentSafeLogSummaries: string[];
  moduleUsageCount: Record<KimPatternSupportModuleId, number>;
}

export interface KimPatternDetectionResult {
  moduleId: KimPatternSupportModuleId;
  activationStatus: KimPatternActivationStatus;
  confidenceScore: number;
  confidenceBand: KimConfidenceBand;
  matchedMarkers: string[];
  matchedMarkerGroups: string[];
  selectedInterventionType: string;
  reason: string;
}

export interface KimPatternPromptPayload {
  persona: "kim";
  moduleId: KimPatternSupportModuleId;
  compactPrompt: string;
  fullPrompt: string;
  selectedInterventionType: string;
  memoryDirective: KimPatternMemoryUseDirective;
  forbiddenOutput: string[];
  store: false;
  gptMayDiagnose: false;
  gptMayUseEliasData: false;
  gptMayOverrideCrisis: false;
  gptMayTellKimToControlLovedOne: false;
}

export interface KimPatternMemoryUseDirective {
  directiveId: string;
  appliesToModuleId: KimPatternSupportModuleId;
  hardDirective: true;
  requiredToUseOnEveryRelevantTurn: true;
  notKeywordGated: true;
  notLimitedToSessionStart: true;
  notLimitedToFirstTwoTurns: true;
  layersUsed: KimMemoryLayer[];
  directiveText: string;
}

export interface KimPatternMemoryPatch {
  persona: "kim";
  moduleId: KimPatternSupportModuleId;
  activationTimestampIso: string;
  sessionId: string;
  turnId: string;
  writes: {
    buffer: KimPatternBufferPatch;
    stateDat?: KimPatternStateDatPatch;
    userDat?: KimPatternUserDatPatch;
    projectionsDat?: KimPatternProjectionsDatPatch;
    logsDat?: KimPatternLogsDatPatch;
  };
  layerJustification: KimPatternMemoryLayerJustification;
}

export interface KimPatternMemoryLayerJustification {
  buffer: "mandatory_current_turn_context";
  stateDat?: string;
  userDat?: string;
  projectionsDat?: string;
  logsDat?: string;
}

export interface KimPatternBufferPatch {
  activeModuleId: KimPatternSupportModuleId;
  activeInterventionType: string;
  currentTurnDirective: string;
  extractedCandidatePatterns: KimPatternCandidate[];
  expiresAtTurnEnd: boolean;
}

export interface KimPatternStateDatPatch {
  activeKimReflectiveFrame:
    | "kim_support_pillars"
    | "caregiver_control_pattern"
    | "caregiver_adaptation_pattern"
    | "caregiver_codependency_awareness";
  activeModuleId: KimPatternSupportModuleId;
  currentKimZoneAtActivation:
    | "GROEN"
    | "GEEL"
    | "ORANJE"
    | "ROOD"
    | "PAARS"
    | "UNKNOWN";
  lastActivatedAt: string;
  stabilizedEnoughForReflection: boolean;
}

export interface KimPatternUserDatPatch {
  moduleUsage: {
    moduleId: KimPatternSupportModuleId;
    incrementBy: 1;
    firstDetectedAt: string;
    lastUpdatedAt: string;
  };
  upsertKimSupportPillars?: KimSupportPillar[];
  upsertKimBalanceItems?: KimBalanceBarItem[];
  upsertLearnedKimPatterns?: KimLearnedPattern[];
}

export interface KimPatternProjectionsDatPatch {
  upsertBeliefs: KimBeliefPatch[];
  upsertHandles: KimHandlePatch[];
}

export interface KimPatternLogsDatPatch {
  encryptedEventType:
    | "kim_therapeutic_module_activation"
    | "kim_profile_balance_update";
  moduleId: KimPatternSupportModuleId;
  timestampIso: string;
  sessionId: string;
  turnId: string;
  safeSummary: string;
  rawTextStored: false;
  storePolicy: "local_kim_encrypted_only";
}

export interface KimPatternCandidate {
  label: string;
  normalizedLabel: string;
  patternType:
    | "support_pillar"
    | "draaglast"
    | "draagkracht"
    | "control_pattern"
    | "adaptation_pattern"
    | "codependency_pattern";
  confidence: number;
  requiresUserConfirmation: boolean;
}

export interface KimSupportPillar {
  pillarId: string;
  label: string;
  normalizedLabel: string;
  type:
    | "person"
    | "routine"
    | "place"
    | "belief"
    | "value"
    | "body_care"
    | "therapy_support"
    | "boundary"
    | "micro_anchor"
    | "meaning"
    | "unknown";
  userConfirmed: boolean;
  source: "paal-k01_chat" | "manual_profile_entry" | "diary" | "logs.dat_safe_summary";
  firstDetectedAt: string;
  lastUpdatedAt: string;
  active: boolean;
}

export interface KimBalanceBarItem {
  itemId: string;
  side: "draaglast" | "draagkracht";
  label: string;
  normalizedLabel: string;
  optionalNote: string | null;
  tags: string[];
  source: "manual_profile_entry" | "paal-k01_chat" | "diary" | "logs.dat_safe_summary";
  userConfirmed: boolean;
  status: "active" | "inactive" | "archived";
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface KimLearnedPattern {
  patternId: string;
  patternType:
    | "caregiver_control"
    | "checking"
    | "threatening"
    | "ultimatum_loop"
    | "covering_up"
    | "self_erasure"
    | "keeping_up_appearances"
    | "identity_fused_with_partner_recovery"
    | "needs_dependent_on_partner_state"
    | "identity_fusion"
    | "rescue_behavior"
    | "boundary_absence"
    | "self_neglect";
  label: string;
  normalizedLabel: string;
  confidence: number;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  sourceModuleId: KimPatternSupportModuleId;
  neverUseAsDiagnosis: true;
}

export interface KimBeliefPatch {
  beliefId: string;
  label: string;
  normalizedLabel: string;
  sourceModuleId: KimPatternSupportModuleId;
  confidence: number;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  mustFrameAsPatternNotDiagnosis: true;
}

export interface KimHandlePatch {
  handleId: string;
  label: string;
  instruction: string;
  sourceModuleId: KimPatternSupportModuleId;
  firstDetectedAt: string;
  lastUpdatedAt: string;
}
