/**
 * RNW01 — Rouw Naaste: Wie Ze Was (Kim only)
 * Validates ambiguous grief for who the loved one was before addiction.
 * K06 runs before this module. Crisis/safety override always.
 */

export type RNW01ActivationStatus =
  | "ACTIVE"
  | "NOT_ACTIVE"
  | "BLOCKED_BY_INTAKE"
  | "BLOCKED_BY_CRISIS"
  | "BLOCKED_BY_PERSONA"
  | "DEFERRED_TO_K06"
  | "DEFERRED_TO_SAFETY";

export type RNW01ResponseMode =
  | "MISSING_WHO_THEY_WERE_VALIDATION"
  | "AMBIGUOUS_GRIEF_NAMING"
  | "NO_FALSE_HOPE_STILL_TENDER"
  | "NO_FORCED_ACCEPTANCE"
  | "RELATIONSHIP_LOSS_VALIDATION"
  | "GRIEF_PERMISSION_WITHOUT_GUILT"
  | "FUTURE_LOSS_ACKNOWLEDGEMENT"
  | "K06_STABILIZATION_BRIDGE"
  | "SAFETY_EXIT";

export type RNW01RouteNext =
  | "RNW01"
  | "K06"
  | "KSC01"
  | "KDL01"
  | "VETR01"
  | "BEDR01"
  | "GASL01"
  | "CRISIS_PROTOCOL"
  | "SAFETY_PROTOCOL"
  | "NO_MODULE";

export interface RNW01RuntimeInput {
  intakeCompleted: boolean;
  persona: "kim";
  latestUserMessage: string;
  recentMessages: string[];
  language: "nl" | "en" | "mixed" | "unknown";
  detectedMarkers: string[];
  crisisProtocolStatus: "CLEAR" | "MONITOR" | "ACTIVE";
  K06StabilizationStatus: "NOT_RUN" | "STABILIZING" | "STABILIZED";
  missesOldPerson: boolean;
  griefForLivingPerson: boolean;
  ambiguousGriefMarker: boolean;
  falseHopeSeeking: boolean;
  acceptancePressure: boolean;
  relationshipAsItWasLost: boolean;
  guiltAboutGrieving: boolean;
  futureLoss: boolean;
  acuteFlooding: boolean;
  safetyRisk: number;
  timestampIso: string;
}

export interface RNW01DetectionResult {
  moduleId: "RNW01";
  activationStatus: RNW01ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: RNW01ResponseMode;
  routeNext: RNW01RouteNext;
  reason: string;
}

export interface RNW01PromptPayload {
  moduleId: "RNW01";
  persona: "kim";
  responseMode: RNW01ResponseMode;
  fullPrompt: string;
  compactPrompt: string;
  gptMayDiagnose: false;
  gptMayGiveFalseHope: false;
  gptMayForceAcceptance: false;
  gptMayForceGoodbye: false;
  gptMayAdviseSeparation: false;
  forbiddenOutput: string[];
}

export interface RNW01StoragePatch {
  persona: "kim";
  storagePath: "local://recofree/personas/kim/user.dat.modules.RNW01";
  lastActivatedModuleId: "RNW01";
  lastActivatedAt: string;
  responseMode: RNW01ResponseMode;
  missesOldPerson: boolean;
  griefForLivingPerson: boolean;
  ambiguousGriefMarker: boolean;
  guiltAboutGrieving: boolean;
  bridgeModuleSuggested?: "KSC01" | "KDL01" | "VETR01" | null;
}
