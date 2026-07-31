/**
 * VSP Insight System — Types
 *
 * This file defines all types for the VSP Insight System.
 * The VSP Insight layer sits ABOVE the immutable deterministic safety core.
 * It may READ safety core output but NEVER MUTATE it.
 *
 * store:false enforced on all GPT calls.
 * Silent discrepancy is never communicated to user.
 */

// ─── Enums & Literals ───────────────────────────────────────────────────────

export type RecoFreePersona = "elias" | "kim";

export type VspZone = "GROEN" | "GEEL" | "ORANJE" | "ROOD" | "PAARS";

export type VspInsightState =
  | "REAL_GREEN"
  | "RATIONAL_GREEN"
  | "OVERWHELMED_ORANGE_RED"
  | "UNKNOWN";

export type VspKimInsightState =
  | "REAL_GREEN_CAREGIVER"
  | "RATIONAL_GREEN_CAREGIVER"
  | "OVERWHELMED_CAREGIVER"
  | "UNKNOWN";

export type VspTherapeuticFramework =
  | "MI"
  | "MBT"
  | "DGT"
  | "SAFETY_CORE_ONLY";

export type VspDiscrepancyType =
  | "USER_REPORTED_GREEN_BUT_RATIONAL_GREEN_SIGNALS"
  | "USER_REPORTED_GREEN_BUT_OVERWHELM_SIGNALS"
  | "USER_REPORTED_LOW_BUT_CRAVING_LANGUAGE"
  | "USER_REPORTED_STABLE_BUT_AVOIDANT_LANGUAGE"
  | "NONE";

export type VspSignalSource =
  | "chat"
  | "mood_sliders"
  | "diary"
  | "gratitude"
  | "backpack"
  | "logs"
  | "wheel_of_change"
  | "vsp_self_report"
  | "soothing_feedback"
  | "intake";

export type VspSensoryChannel =
  | "sight"
  | "sound"
  | "touch"
  | "taste"
  | "smell"
  | "breath"
  | "movement"
  | "temperature"
  | "orientation";

// ─── Mood & Signals ─────────────────────────────────────────────────────────

export interface VspMoodSlidersSnapshot {
  selfReportedZone: VspZone;
  craving: number;
  frustration: number;
  despondency: number;
  focus: number;
  capturedAt: string;
}

export interface VspChatSignalSnapshot {
  rationalityMarkers: string[];
  emotionalConnectionMarkers: string[];
  avoidanceMarkers: string[];
  cravingMarkers: string[];
  overwhelmMarkers: string[];
  warmthMarkers: string[];
  embodiedEmotionMarkers: string[];
  selfCompassionMarkers: string[];
  relapseIntentMarkers: string[];
  safetyFlags: VspSafetyFlags;
}

export interface VspSafetyFlags {
  crisisDetected: boolean;
  suicideSelfHarmDetected: boolean;
  relapseIntentDetected: boolean;
  acuteDangerDetected: boolean;
  medicalEmergencyDetected: boolean;
  coreSafetyOverrideActive: boolean;
}

export interface VspLogsSignalSnapshot {
  latestCompressedSessionSummaryId: string | null;
  safePatternHints: VspObservedPatternHint[];
  recentPhaseTransitions: VspPhaseTransitionExample[];
  effectiveSoothingHistory: VspSoothingEffectRecord[];
}

export interface VspObservedPatternHint {
  patternId: string;
  label: string;
  source: VspSignalSource;
  confidence: number;
  firstDetectedAt: string;
  lastUpdatedAt: string;
}

export interface VspDiarySignalSnapshot {
  latestEntryId: string | null;
  latestCreatedAt: string | null;
  latestSafeAnchor: string | null;
  emotionalToneHint:
    | "connected"
    | "detached"
    | "overwhelmed"
    | "avoidant"
    | "unknown";
}

export interface VspGratitudeSignalSnapshot {
  latestEntryId: string | null;
  latestCreatedAt: string | null;
  latestSafeAnchor: string | null;
  connectionHint:
    | "people"
    | "body"
    | "place"
    | "small_moment"
    | "abstract"
    | "unknown";
}

export interface VspBackpackSignalSnapshot {
  latestUpdatedAt: string | null;
  latestSafeAnchor: string | null;
  recurringTriggers: VspObservedPatternHint[];
  recurringProtectiveFactors: VspObservedPatternHint[];
}

export interface WheelOfChangeSnapshot {
  currentStage:
    | "precontemplation"
    | "contemplation"
    | "preparation"
    | "action"
    | "maintenance"
    | "relapse"
    | "unknown";
  capturedAt: string | null;
}

// ─── Engine Input/Output ────────────────────────────────────────────────────

export interface VspInsightEngineInput {
  persona: RecoFreePersona;
  userId: string;
  sessionId: string;
  turnId: string;
  nowIso: string;
  mood: VspMoodSlidersSnapshot;
  chatSignals: VspChatSignalSnapshot;
  logsSignals: VspLogsSignalSnapshot;
  diarySignals: VspDiarySignalSnapshot;
  gratitudeSignals: VspGratitudeSignalSnapshot;
  backpackSignals: VspBackpackSignalSnapshot;
  wheelOfChange: WheelOfChangeSnapshot;
  existingProfile: VspInsightProfile | null;
  immutableCoreSnapshot: ImmutableSafetyCoreSnapshot;
}

export interface ImmutableSafetyCoreSnapshot {
  finalZone: VspZone;
  userReportedZone: VspZone;
  safetyOverrideActive: boolean;
  crisisDetected: boolean;
  relapseIntentDetected: boolean;
  modelRoutingDecision: "gpt-4o" | "gpt-4o-mini" | "none";
  activeSafetyModuleId: string | null;
  immutableCoreVersion: string;
}

export interface VspInsightEngineResult {
  persona: RecoFreePersona;
  insightState: VspInsightState;
  selectedFramework: VspTherapeuticFramework;
  silentDiscrepancy: VspSilentDiscrepancyResult;
  selectedPromptFrame: VspPromptFrame;
  soothingFlow?: VspDgtSoothingFlow;
  phaseTransitionCandidate?: VspPhaseTransitionCandidate | null;
  profilePatch: VspInsightProfilePatch | null;
  debug: VspInsightDebug;
}

export interface VspInsightDebug {
  stateReasons: string[];
  frameworkReasons: string[];
  discrepancyReasons: string[];
  immutableCoreReadOnlyVerified: boolean;
  outputSafetyRulesApplied: string[];
}

// ─── Prompt Frame ───────────────────────────────────────────────────────────

export interface VspPromptFrame {
  persona: RecoFreePersona;
  selectedFramework: VspTherapeuticFramework;
  userFacingInstruction: string;
  hiddenInstruction: string;
  forbiddenOutput: string[];
  store: false;
}

// ─── Silent Discrepancy ─────────────────────────────────────────────────────

export interface VspSilentDiscrepancyResult {
  discrepancyType: VspDiscrepancyType;
  shouldStore: boolean;
  shouldUseForFrameworkSelection: boolean;
  shouldCommunicateToUser: false;
  profileEvent: VspSilentDiscrepancyEvent | null;
  reasons: string[];
}

export interface VspSilentDiscrepancyEvent {
  eventId: string;
  timestampIso: string;
  userReportedZone: VspZone;
  inferredInsightState: VspInsightState;
  discrepancyType: VspDiscrepancyType;
  usedForFramework: VspTherapeuticFramework;
  communicatedToUser: false;
  sourceSignals: VspSignalSource[];
}

// ─── DGT Soothing ──────────────────────────────────────────────────────────

export interface VspSoothingOption {
  optionId: string;
  label: string;
  sensoryChannel: VspSensoryChannel;
  instruction: string;
  allowedZones: VspZone[];
  excludedIfCravingAtLeast?: number;
  excludedIfDissociation?: boolean;
  excludedIfDrivingRisk?: boolean;
  excludedIfSelfHarmRisk?: boolean;
  excludedIfMedicalRisk?: boolean;
  defaultRank: number;
}

export interface VspDgtSoothingFlow {
  selectedOptions: VspSoothingOption[];
  userFacingIntro: string;
  safetyFiltered: boolean;
}

export interface VspSoothingChoiceEvent {
  userId: string;
  sessionId: string;
  turnId: string;
  selectedOptionId: string;
  beforeState: VspInsightState;
  beforeZone: VspZone;
  beforeMood: VspMoodSlidersSnapshot;
  timestampIso: string;
}

export interface VspSoothingEffectRecord {
  choiceEvent: VspSoothingChoiceEvent;
  afterMood: VspMoodSlidersSnapshot | null;
  afterInsightState: VspInsightState | null;
  userFeedbackHelpful: boolean | null;
  effectScore: number;
  effectLabel: "helpful" | "inconclusive" | "ineffective";
  evaluatedAt: string;
}

// ─── Phase Transitions ──────────────────────────────────────────────────────

export interface VspPhaseTransitionCandidate {
  fromState: VspInsightState;
  toState: VspInsightState;
  fromZone: VspZone;
  toZone: VspZone;
  transitionAt: string;
  durationSeconds: number | null;
  possibleHelpfulActionId: string | null;
  sourceSignals: VspSignalSource[];
  confidence: number;
}

export interface VspPhaseTransitionExample {
  exampleId: string;
  fromState: VspInsightState;
  toState: VspInsightState;
  fromZone: VspZone;
  toZone: VspZone;
  transitionAt: string;
  durationSeconds: number | null;
  triggerContextSafeSummary: string;
  helpfulActionSafeSummary: string | null;
  soothingOptionId: string | null;
  userConfirmedHelpful: boolean | null;
  sourceSignals: VspSignalSource[];
}

// ─── Profile ────────────────────────────────────────────────────────────────

export interface VspInsightProfile {
  profileVersion: "vsp_insight_profile.v1";
  persona: RecoFreePersona;
  userId: string;
  createdAt: string;
  updatedAt: string;
  selfReportedEarlySigns: VspSelfReportedEarlySign[];
  observedEarlySigns: VspObservedEarlySign[];
  rationalGreenPattern: VspPatternModel;
  overwhelmPattern: VspPatternModel;
  realGreenPattern: VspPatternModel;
  soothingProfile: VspSoothingProfile;
  phaseTransitionExamples: VspPhaseTransitionExample[];
  wheelOfChangeHistory: WheelOfChangeSnapshot[];
  discrepancyHistory: VspSilentDiscrepancyEvent[];
  lastInsightState?: VspInsightState | null;
  lastUserReportedZone?: VspZone | null;
  lastMoodSnapshot?: VspMoodSlidersSnapshot | null;
  lastSoothingChoiceEvent?: VspSoothingChoiceEvent | null;
}

export interface VspSelfReportedEarlySign {
  signId: string;
  label: string;
  normalizedLabel: string;
  examples: string[];
  userReportedZoneAssociation: VspZone[];
  source: "intake" | "vsp_self_report" | "chat";
  firstDetectedAt: string;
  lastUpdatedAt: string;
}

export interface VspObservedEarlySign {
  signId: string;
  label: string;
  normalizedLabel: string;
  examples: string[];
  associatedInsightState: VspInsightState;
  associatedZone: VspZone | "silent_only";
  confidence: number;
  frequency: number;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  sourceSignals: VspSignalSource[];
}

export interface VspPatternModel {
  patternId: string;
  label: string;
  confidence: number;
  markers: string[];
  examples: string[];
  firstDetectedAt: string | null;
  lastUpdatedAt: string | null;
}

export interface VspSoothingProfile {
  genericOptionsUsed: VspSoothingEffectRecord[];
  personalizedEffectiveOptions: VspPersonalizedSoothingOption[];
  excludedOptions: VspExcludedSoothingOption[];
}

export interface VspPersonalizedSoothingOption {
  optionId: string;
  label: string;
  sensoryChannel: VspSensoryChannel;
  helpedTransitions: Array<{
    from: VspInsightState;
    to: VspInsightState;
    timestampIso: string;
  }>;
  averageEffectScore: number;
  timesChosen: number;
  timesHelpful: number;
  lastChosenAt: string | null;
}

export interface VspExcludedSoothingOption {
  optionId: string;
  reason:
    | "unsafe_for_craving"
    | "unsafe_for_zone"
    | "user_disliked"
    | "ineffective"
    | "triggering"
    | "not_available";
  firstDetectedAt: string;
  lastUpdatedAt: string;
}

// ─── Profile Patch ──────────────────────────────────────────────────────────

export interface VspInsightProfilePatch {
  profileVersion: "vsp_insight_profile.v1";
  persona: RecoFreePersona;
  updatedAt: string;
  upsertSelfReportedEarlySigns: VspSelfReportedEarlySign[];
  upsertObservedEarlySigns: VspObservedEarlySign[];
  upsertPhaseTransitionExamples: VspPhaseTransitionExample[];
  upsertDiscrepancyEvents: VspSilentDiscrepancyEvent[];
  updateSoothingProfile?: Partial<VspSoothingProfile>;
  lastInsightState?: VspInsightState;
  lastUserReportedZone?: VspZone;
  lastMoodSnapshot?: VspMoodSlidersSnapshot;
}

// ─── Type Aliases (used by router and adapters) ─────────────────────────────

/** Alias for VspTherapeuticFramework — used by router */
export type VspFrameworkSelection = VspTherapeuticFramework;

/** Router-internal prompt frame (simpler than full VspPromptFrame) */
export interface VspInsightPromptFrame {
  frameworkLabel: VspTherapeuticFramework;
  systemInstruction: string;
  silentDiscrepancyNote: string | null;
  neverSay: string[];
}

// ─── PDF Export ─────────────────────────────────────────────────────────────

export interface VspPdfExportInput {
  persona: RecoFreePersona;
  profile: VspInsightProfile;
  includeRawUserSelectedExamples: boolean;
  selectedExampleIds: string[];
  exportedAt: string;
  /** Optional: the user-filled VSP (backpack.vspSection) to include in the combined export */
  vspSection?: {
    zones: {
      green: { signals: string; whatHelps: string; anchorSentence: string };
      yellow: { signals: string; whatHelps: string; anchorSentence: string };
      orange: { signals: string; whatHelps: string; anchorSentence: string };
      red: { signals: string; whatHelps: string; anchorSentence: string };
      purple: { signals: string; whatHelps: string; anchorSentence: string };
    };
    triggers: { trigger: string; counterThought: string }[];
    recoveryRules: string[];
    mainAnchorSentence: string;
    lastUpdated: string | null;
  };
}

export interface VspPdfExportResult {
  fileUri: string;
  fileName: string;
  byteSize: number;
  exportedAt: string;
}
