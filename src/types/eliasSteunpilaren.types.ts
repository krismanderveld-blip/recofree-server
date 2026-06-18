/**
 * PAAL01 — Steunpilaren inventaris
 * Elias-only module types
 */

export type EliasSteunpilarenModuleId = "PAAL01";

export type RecoFreePersona = "elias" | "kim";

export type SteunpilarenActivationStatus =
  | "ACTIVE"
  | "NOT_ACTIVE"
  | "BLOCKED_BY_PERSONA"
  | "BLOCKED_BY_CRISIS"
  | "BLOCKED_BY_INTAKE"
  | "DEFER_TO_CRISIS";

export type SteunpilarenMemoryLayer =
  | "buffer"
  | "state.dat"
  | "user.dat"
  | "projections.dat"
  | "logs.dat";

export type SteunpilarenLanguage = "nl" | "en" | "fr" | "mixed" | "unknown";

export type SteunpilarenConfidenceBand =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "VERY_HIGH";

export type SteunpilaarCategory =
  | "person"
  | "routine"
  | "place"
  | "belief"
  | "activity"
  | "pet"
  | "other";

export type SteunpilarenTriggerContext =
  | "STABLE_REFLECTION"
  | "POST_DIFFICULTY_REMINDER"
  | "FIRST_USE_INTRODUCTION"
  | "PERIODIC_UPDATE_INVITATION";

export interface SteunpilarenRuntimeInput {
  persona: RecoFreePersona;
  intakeCompleted: boolean;
  userId: string;
  sessionId: string;
  turnId: string;
  turnIndex: number;
  timestampIso: string;
  latestUserMessage: string;
  recentMessages: string[];
  language: SteunpilarenLanguage;
  currentZone:
    | "GROEN"
    | "GEEL"
    | "ORANJE"
    | "ROOD"
    | "PAARS"
    | "UNKNOWN";
  crisisDetected: boolean;
  suicideSelfHarmDetected: boolean;
  acuteDangerDetected: boolean;
  relapseIntentDetected: boolean;
  severeIntoxicationDetected: boolean;
  medicalEmergencyDetected: boolean;
  existingEliasSteunpilarenHints: ExistingEliasSteunpilarenHints;
  sessionsSinceLastPaal01: number;
  balkmetafoorInitialized: boolean;
}

export interface ExistingEliasSteunpilarenHints {
  storedSteunpilaren: StoredSteunpilaar[];
  lastActivatedAt: string | null;
  moduleUsageCount: number;
  recentLogSafeSummaries: string[];
  balkmetafoorEntries: {
    draaglast: string[];
    draagkracht: string[];
  };
}

export interface StoredSteunpilaar {
  id: string;
  category: SteunpilaarCategory;
  label: string;
  description: string;
  addedAt: string;
  lastReferencedAt: string;
  sourceModuleId: "PAAL01";
}

export interface SteunpilarenDetectionResult {
  moduleId: "PAAL01";
  activationStatus: SteunpilarenActivationStatus;
  confidenceScore: number;
  confidenceBand: SteunpilarenConfidenceBand;
  triggerContext: SteunpilarenTriggerContext;
  matchedMarkers: string[];
  reason: string;
}

export interface SteunpilarenPromptPayload {
  persona: "elias";
  moduleId: "PAAL01";
  compactPrompt: string;
  fullPrompt: string;
  triggerContext: SteunpilarenTriggerContext;
  existingSteunpilaren: StoredSteunpilaar[];
  balkmetafoorInitialized: boolean;
  memoryDirective: SteunpilarenMemoryUseDirective;
  forbiddenOutput: string[];
  store: false;
  gptMayDiagnose: false;
  gptMayUseKimData: false;
  gptMayOverrideCrisis: false;
}

export interface SteunpilarenMemoryUseDirective {
  directiveId: string;
  appliesToModuleId: "PAAL01";
  hardDirective: true;
  useAtSessionGreeting: true;
  useAtEveryRelevantTurn: true;
  useAtTurnFivePlus: true;
  notKeywordGated: true;
  notLimitedToFirstTwoTurns: true;
  requiredLayersToRead: SteunpilarenMemoryLayer[];
  requiredLayersToWriteOnActivation: SteunpilarenMemoryLayer[];
  userFacingDisclosureAllowed: false;
  directiveText: string;
}

export interface SteunpilarenMemoryPatch {
  persona: "elias";
  moduleId: "PAAL01";
  activationTimestampIso: string;
  sessionId: string;
  turnId: string;
  writes: {
    buffer: SteunpilarenBufferPatch;
    stateDat: SteunpilarenStateDatPatch;
    userDat: SteunpilarenUserDatPatch;
    projectionsDat: SteunpilarenProjectionsDatPatch | null;
    logsDat: SteunpilarenLogsDatPatch;
  };
}

export interface SteunpilarenBufferPatch {
  activeModuleId: "PAAL01";
  activeTriggerContext: SteunpilarenTriggerContext;
  currentTurnDirective: string;
  expiresAtTurnEnd: boolean;
}

export interface SteunpilarenStateDatPatch {
  activeTherapeuticFrame: "steunpilaren_inventaris";
  activeModuleId: "PAAL01";
  currentZoneAtActivation:
    | "GROEN"
    | "GEEL"
    | "ORANJE"
    | "ROOD"
    | "PAARS"
    | "UNKNOWN";
  lastActivatedAt: string;
  lastActivationTurnId: string;
  crisisOverrideAtActivation: false;
}

export interface SteunpilarenUserDatPatch {
  moduleUsage: {
    moduleId: "PAAL01";
    incrementBy: 1;
    firstDetectedAt: string;
    lastUpdatedAt: string;
  };
  steunpilaren: StoredSteunpilaar[];
}

export interface SteunpilarenProjectionsDatPatch {
  upsertBeliefs: Array<{
    beliefId: string;
    label: string;
    normalizedLabel: string;
    sourceModuleId: "PAAL01";
    confidence: number;
    firstDetectedAt: string;
    lastUpdatedAt: string;
    mustFrameAsLearnedRule: true;
  }>;
  upsertHandles: Array<{
    handleId: string;
    label: string;
    instruction: string;
    sourceModuleId: "PAAL01";
    firstDetectedAt: string;
    lastUpdatedAt: string;
  }>;
}

export interface SteunpilarenLogsDatPatch {
  encryptedEventType: "therapeutic_module_activation";
  moduleId: "PAAL01";
  timestampIso: string;
  sessionId: string;
  turnId: string;
  safeSummary: string;
  matchedMarkers: string[];
  rawTextStored: false;
  storePolicy: "local_encrypted_only";
}
