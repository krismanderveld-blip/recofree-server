/**
 * BEDR01 — Betrayal Discovery Response (Kim only)
 * Acute shock response when caregiver discovers betrayal by addicted partner.
 * K06 runs before this module. Crisis/safety override always.
 */

export type BEDR01ActivationStatus =
  | "ACTIVE"
  | "NOT_ACTIVE"
  | "BLOCKED_BY_INTAKE"
  | "BLOCKED_BY_CRISIS"
  | "BLOCKED_BY_PERSONA"
  | "DEFERRED_TO_SAFETY"
  | "DEFERRED_TO_K06";

export type BEDR01ResponseMode =
  | "ACUTE_SHOCK_CONTAINMENT"
  | "BODY_REGULATION_FIRST"
  | "REALITY_ANCHOR"
  | "NO_DECISION_PRESSURE"
  | "SAFETY_PLANNING"
  | "CHILDREN_SAFETY_CHECK"
  | "K06_STABILIZATION_BRIDGE"
  | "LEGAL_BOUNDARY_RESPONSE"
  | "NO_GUILT_INNOCENCE_VERDICT"
  | "SAFETY_EXIT";

export type BEDR01RouteNext =
  | "BEDR01"
  | "K06"
  | "KBR01"
  | "VETR01"
  | "GASL01"
  | "CRISIS_PROTOCOL"
  | "SAFETY_PROTOCOL"
  | "NO_MODULE";

export interface BEDR01RuntimeInput {
  intakeCompleted: boolean;
  persona: "kim";
  latestUserMessage: string;
  recentMessages: string[];
  language: "nl" | "en" | "mixed" | "unknown";
  detectedMarkers: string[];
  crisisProtocolStatus: "CLEAR" | "MONITOR" | "ACTIVE";
  K06StabilizationStatus: "NOT_RUN" | "STABILIZING" | "STABILIZED";
  acuteShockDominant: boolean;
  discoveryJustHappened: boolean;
  bodyDysregulation: boolean;
  decisionPressure: boolean;
  childrenInvolved: boolean;
  safetyRisk: number;
  legalAdviceRequest: boolean;
  guiltInnocenceRequest: boolean;
  timestampIso: string;
}

export interface BEDR01DetectionResult {
  moduleId: "BEDR01";
  activationStatus: BEDR01ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: BEDR01ResponseMode;
  routeNext: BEDR01RouteNext;
  reason: string;
}

export interface BEDR01PromptPayload {
  moduleId: "BEDR01";
  persona: "kim";
  responseMode: BEDR01ResponseMode;
  fullPrompt: string;
  compactPrompt: string;
  gptMayDiagnose: false;
  gptMayGiveLegalAdvice: false;
  gptMayDetermineGuilt: false;
  gptMayAdviseSeparation: false;
  gptMayForceReconciliation: false;
  gptMayPressureDecision: false;
  forbiddenOutput: string[];
}

export interface BEDR01StoragePatch {
  persona: "kim";
  storagePath: "local://recofree/personas/kim/user.dat.modules.BEDR01";
  lastActivatedModuleId: "BEDR01";
  lastActivatedAt: string;
  responseMode: BEDR01ResponseMode;
  acuteShockDominant: boolean;
  discoveryJustHappened: boolean;
  bodyDysregulation: boolean;
  childrenInvolved: boolean;
  safetyRedirectUsed: boolean;
}
