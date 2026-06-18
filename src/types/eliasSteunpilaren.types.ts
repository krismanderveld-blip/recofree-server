/**
 * PAAL01 — Steunpilaren inventaris
 * Elias-only module types — aligned with PAAL01 spec V1
 */

export type EliasSteunpilarenModuleId = "PAAL01";

export type RecoFreePersona = "elias" | "kim";

export type SteunpilarenActivationStatus =
  | "ACTIVE"
  | "NOT_ACTIVE"
  | "BLOCKED_BY_PERSONA"
  | "BLOCKED_BY_CRISIS"
  | "BLOCKED_BY_INTAKE"
  | "DEFER_TO_SAFETY"
  | "DEFER_TO_GROUNDING"
  | "OFFER_AS_FOLLOWUP";

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
  | "value"
  | "body_care"
  | "therapy_support"
  | "project"
  | "boundary"
  | "micro_anchor"
  | "meaning"
  | "activity"
  | "pet"
  | "unknown";

export type SteunpilarenTriggerContext =
  | "STABLE_REFLECTION"
  | "POST_DIFFICULTY_REMINDER"
  | "FIRST_USE_INTRODUCTION"
  | "PERIODIC_UPDATE_INVITATION";

export type Paal01InterventionType =
  | "INTRODUCE_SUPPORT_PILLARS"
  | "INVENTORY_PEOPLE_ROUTINES_PLACES_BELIEFS"
  | "REMEMBER_EXISTING_PILLARS"
  | "POST_DIFFICULT_MOMENT_RECONNECT"
  | "BALANCE_BAR_INTRODUCTION"
  | "QUALITATIVE_DRAAGLAST_DRAAGKRACHT_REFLECTION"
  | "ADD_ONE_SMALL_PILLAR"
  | "BRIDGE_TO_PROFILE_FEATURE";

export type BalanceItemSource =
  | "manual_profile_entry"
  | "paal01_chat"
  | "diary"
  | "gratitude"
  | "backpack"
  | "vsp"
  | "greeting"
  | "logs.dat_safe_summary";

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
  stabilizedEnoughForReflection: boolean;
  crisisDetected: boolean;
  suicideSelfHarmDetected: boolean;
  acuteDangerDetected: boolean;
  relapseIntentDetected: boolean;
  severeIntoxicationDetected: boolean;
  medicalEmergencyDetected: boolean;
  activeGroundingNeeded: boolean;
  existingPillarsCount: number;
  existingBalanceItemsCount: number;
  profileFeatureFirstUse: boolean;
  hasRecentDifficultMomentResolved: boolean;
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
  selectedInterventionType: Paal01InterventionType;
  shouldIntroduceBalanceFeature: boolean;
  shouldWriteBalanceItemSuggestion: boolean;
  matchedMarkers: string[];
  reason: string;
}

export interface SteunpilarenPromptPayload {
  persona: "elias";
  moduleId: "PAAL01";
  selectedInterventionType: Paal01InterventionType;
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
  gptMayScoreUser: false;
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

export interface Paal01MemoryLayerJustification {
  buffer: "mandatory_current_turn_context";
  stateDat?: string;
  userDat?: string;
  projectionsDat?: string;
  logsDat?: string;
}

export interface SteunpilarenMemoryPatch {
  persona: "elias";
  moduleId: "PAAL01";
  activationTimestampIso: string;
  sessionId: string;
  turnId: string;
  writes: {
    buffer: SteunpilarenBufferPatch;
    stateDat: SteunpilarenStateDatPatch | null;
    userDat: SteunpilarenUserDatPatch;
    projectionsDat: SteunpilarenProjectionsDatPatch | null;
    logsDat: SteunpilarenLogsDatPatch;
  };
  layerJustification: Paal01MemoryLayerJustification;
}

export interface SteunpilarenBufferPatch {
  activeModuleId: "PAAL01";
  activeInterventionType: Paal01InterventionType;
  activeTriggerContext: SteunpilarenTriggerContext;
  currentTurnDirective: string;
  candidatePillars: Paal01CandidatePillar[];
  candidateBalanceItems: BalanceBarCandidateItem[];
  expiresAtTurnEnd: boolean;
}

export interface Paal01CandidatePillar {
  label: string;
  type: SteunpilaarCategory;
  source: BalanceItemSource;
  confidence: number;
}

export interface BalanceBarCandidateItem {
  side: "draaglast" | "draagkracht";
  label: string;
  normalizedLabel: string;
  tags: string[];
  source: BalanceItemSource;
  confidence: number;
  requiresUserConfirmation: true;
}

export interface SteunpilarenStateDatPatch {
  activeReflectiveFeature: "support_pillars" | "balance_bar";
  activeModuleId: "PAAL01";
  currentZoneAtActivation:
    | "GROEN"
    | "GEEL"
    | "ORANJE"
    | "ROOD"
    | "PAARS"
    | "UNKNOWN";
  lastActivatedAt: string;
  stabilizedEnoughForReflection: boolean;
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
