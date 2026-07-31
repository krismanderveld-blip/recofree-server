export type EliasPsychoEducationModuleId =
  | "WILSKRACHT01"
  | "AUTOPILOT01";

export type RecoFreePersona = "elias" | "kim";

export type EliasPsychoEducationActivationStatus =
  | "ACTIVE"
  | "NOT_ACTIVE"
  | "BLOCKED_BY_PERSONA"
  | "BLOCKED_BY_CRISIS"
  | "BLOCKED_BY_INTAKE"
  | "DEFER_TO_RELAPSE_ANALYSIS"
  | "DEFER_TO_CRAVING_REGULATION"
  | "DEFER_TO_VSP_SAFETY";

export type EliasPsychoEducationResponseMode =
  | "SELF_BLAME_AFTER_RELAPSE"
  | "WILLPOWER_REFRAME"
  | "RIDER_HORSE_MODEL"
  | "LIBET_PAUSE_WINDOW"
  | "APPROACH_BIAS_EXPLANATION"
  | "ATTENTIONAL_BIAS_EXPLANATION"
  | "CONDITIONED_TRIGGER_EXPLANATION"
  | "CRAVING_AUTOPILOT_INTERRUPT"
  | "MEMORY_CONTINUITY_BRIDGE"
  | "SAFETY_DEFERRED";

export type EliasPsychoEducationMemoryTarget =
  | "user.dat"
  | "projections.dat"
  | "logs.dat";

export interface EliasPsychoEducationRuntimeInput {
  persona: RecoFreePersona;
  intakeCompleted: boolean;
  latestUserMessage: string;
  recentMessages: string[];
  language: "nl" | "en" | "mixed" | "unknown";
  detectedMarkers: string[];
  crisisProtocolActive: boolean;
  suicideSelfHarmDetected: boolean;
  acuteDangerDetected: boolean;
  severeIntoxicationDetected: boolean;
  relapseIntentDetected: boolean;
  cravingDetected: boolean;
  relapseRecentlyOccurred: boolean;
  selfBlameDetected: boolean;
  willpowerLanguageDetected: boolean;
  autopilotLanguageDetected: boolean;
  triggerExposureDetected: boolean;
  approachBiasLanguageDetected: boolean;
  attentionalBiasLanguageDetected: boolean;
  conditionedTriggerLanguageDetected: boolean;
  vspZone: "GROEN" | "GEEL" | "ORANJE" | "ROOD" | "PAARS" | "UNKNOWN";
  cravingSliderValue: number | null;
  timestampIso: string;
  sessionId: string;
  turnId: string;
  existingMemoryHints: EliasPsychoEducationMemoryHint[];
}

export interface EliasPsychoEducationDetectionResult {
  moduleId: EliasPsychoEducationModuleId;
  activationStatus: EliasPsychoEducationActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: EliasPsychoEducationResponseMode;
  routeNext:
    | "WILSKRACHT01"
    | "AUTOPILOT01"
    | "TERV01"
    | "DGT_CRAVING_REGULATION"
    | "VSP_SAFETY"
    | "CRISIS_PROTOCOL"
    | "NO_MODULE";
  memoryReadRequired: boolean;
  memoryWriteRequired: boolean;
  reason: string;
}

export interface EliasPsychoEducationPromptPayload {
  persona: "elias";
  moduleId: EliasPsychoEducationModuleId;
  responseMode: EliasPsychoEducationResponseMode;
  matchedMarkers: string[];
  compactPrompt: string;
  fullPrompt: string;
  memoryContinuityDirectives: EliasPsychoEducationMemoryDirective[];
  forbiddenOutput: string[];
  store: false;
  gptMayDiagnose: false;
  gptMayGiveMedicalAdvice: false;
  gptMayExcuseConsequences: false;
  gptMayIgnoreMemoryHints: false;
}

export interface EliasPsychoEducationMemoryHint {
  hintId: string;
  moduleId: EliasPsychoEducationModuleId;
  label: string;
  normalizedLabel: string;
  relevance:
    | "self_blame"
    | "willpower_belief"
    | "autopilot_craving"
    | "trigger_bias"
    | "conditioned_response"
    | "recovery_handle";
  firstDetectedAt: string;
  lastUpdatedAt: string;
  frequency: number;
  lastUsedInGreetingAt: string | null;
  lastUsedInTurnAt: string | null;
}

export interface EliasPsychoEducationMemoryDirective {
  directiveId: string;
  moduleId: EliasPsychoEducationModuleId;
  appliesTo:
    | "session_greeting"
    | "every_relevant_chat_turn"
    | "post_relapse_reflection"
    | "craving_context"
    | "vsp_insight_context";
  hardDirective: string;
  exampleUsage: string;
}

export interface EliasPsychoEducationMemoryPatch {
  persona: "elias";
  moduleId: EliasPsychoEducationModuleId;
  storageTargets: EliasPsychoEducationMemoryTarget[];
  userDatPatch: EliasPsychoEducationUserDatPatch;
  projectionsDatPatch: EliasPsychoEducationProjectionsDatPatch;
  logsDatPatch: EliasPsychoEducationLogsDatPatch;
}

export interface EliasPsychoEducationUserDatPatch {
  psychoEducationPatternsToUpsert: EliasPsychoEducationMemoryHint[];
  moduleUsageToIncrement: {
    moduleId: EliasPsychoEducationModuleId;
    lastActivatedAt: string;
    activationCountIncrement: 1;
  };
}

export interface EliasPsychoEducationProjectionsDatPatch {
  beliefsToUpsert: Array<{
    beliefId: string;
    label: string;
    normalizedLabel: string;
    category:
      | "willpower_shame_belief"
      | "autopilot_trigger_belief"
      | "loss_of_control_belief";
    sourceModuleId: EliasPsychoEducationModuleId;
    firstDetectedAt: string;
    lastUpdatedAt: string;
    decayScoreInitial: number;
  }>;
  recoveryHandlesToUpsert: Array<{
    handleId: string;
    label: string;
    normalizedLabel: string;
    sourceModuleId: EliasPsychoEducationModuleId;
    firstDetectedAt: string;
    lastUpdatedAt: string;
  }>;
}

export interface EliasPsychoEducationLogsDatPatch {
  logEvent: {
    logId: string;
    sessionId: string;
    turnId: string;
    timestampIso: string;
    moduleId: EliasPsychoEducationModuleId;
    responseMode: EliasPsychoEducationResponseMode;
    matchedMarkers: string[];
    memoryUseDirectiveWritten: true;
    rawTextStored: false;
    storePolicy: "local_elias_scoped_only";
  };
}
