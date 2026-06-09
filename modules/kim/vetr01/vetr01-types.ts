/**
 * VETR01 — Trust Repair After Betrayal (Kim only)
 * Supports caregiver in exploring trust repair without pressure.
 * K06 stabilization must precede. BEDR01 has priority at acute shock.
 */

export type VETR01ActivationStatus =
  | "ACTIVE"
  | "NOT_ACTIVE"
  | "BLOCKED_BY_INTAKE"
  | "BLOCKED_BY_CRISIS"
  | "BLOCKED_BY_PERSONA"
  | "DEFERRED_TO_K06"
  | "DEFERRED_TO_BEDR01"
  | "DEFERRED_TO_SAFETY";

export type VETR01ResponseMode =
  | "TRUST_REPAIR_WITHOUT_PRESSURE"
  | "FORGIVENESS_NOT_REQUIRED"
  | "MBT_REALITY_SEPARATION"
  | "BOUNDARY_BRIDGE_AFTER_BETRAYAL"
  | "NO_TIMELINE_PRESSURE"
  | "SAFETY_BOUNDARY_FIRST"
  | "LEGAL_BOUNDARY_RESPONSE"
  | "NO_GUILT_INNOCENCE_VERDICT"
  | "DEFER_TO_BEDR01_OR_K06"
  | "SAFETY_EXIT";

export type VETR01RouteNext =
  | "VETR01"
  | "BEDR01"
  | "K06"
  | "KBR01"
  | "KDL01"
  | "KSC01"
  | "GASL01"
  | "CRISIS_PROTOCOL"
  | "SAFETY_PROTOCOL"
  | "NO_MODULE";

export interface VETR01RuntimeInput {
  intakeCompleted: boolean;
  persona: "kim";
  latestUserMessage: string;
  recentMessages: string[];
  language: "nl" | "en" | "mixed" | "unknown";
  detectedMarkers: string[];
  crisisProtocolStatus: "CLEAR" | "MONITOR" | "ACTIVE";
  K06StabilizationStatus: "NOT_RUN" | "STABILIZING" | "STABILIZED";
  acuteShockDominant: boolean;
  trustRepairQuestion: boolean;
  forgivenessPressure: boolean;
  relationshipMeaningQuestion: boolean;
  boundaryNeedAfterBetrayal: boolean;
  timelinePressure: boolean;
  partnerMindReading: boolean;
  safetyRisk: number;
  legalAdviceRequest: boolean;
  guiltInnocenceRequest: boolean;
  timestampIso: string;
}

export interface VETR01DetectionResult {
  moduleId: "VETR01";
  activationStatus: VETR01ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: VETR01ResponseMode;
  routeNext: VETR01RouteNext;
  reason: string;
}

export interface VETR01PromptPayload {
  moduleId: "VETR01";
  persona: "kim";
  responseMode: VETR01ResponseMode;
  fullPrompt: string;
  compactPrompt: string;
  gptMayDiagnose: false;
  gptMayGiveLegalAdvice: false;
  gptMayDetermineGuilt: false;
  gptMayAdviseSeparation: false;
  gptMayForceReconciliation: false;
  gptMayForceForgiveness: false;
  forbiddenOutput: string[];
}

export interface VETR01StoragePatch {
  persona: "kim";
  storagePath: "local://recofree/personas/kim/user.dat.modules.VETR01";
  lastActivatedModuleId: "VETR01";
  lastActivatedAt: string;
  responseMode: VETR01ResponseMode;
  trustRepairQuestion: boolean;
  forgivenessPressure: boolean;
  boundaryNeedAfterBetrayal: boolean;
  timelinePressure: boolean;
  bridgeModuleSuggested?: "KBR01" | "KDL01" | "KSC01" | null;
}
