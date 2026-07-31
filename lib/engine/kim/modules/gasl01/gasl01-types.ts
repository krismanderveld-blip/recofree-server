/**
 * GASL01 — Gaslighting Recognition & Fact Anchoring (Kim only)
 * Helps caregiver recognize gaslighting patterns and anchor to reality.
 * K06 gate: only fact anchoring if K06 incomplete.
 * BEDR01 priority at acute shock.
 */

export type GASL01ActivationStatus =
  | "ACTIVE"
  | "NOT_ACTIVE"
  | "BLOCKED_BY_INTAKE"
  | "BLOCKED_BY_CRISIS"
  | "BLOCKED_BY_PERSONA"
  | "DEFERRED_TO_SAFETY"
  | "DEFERRED_TO_BEDR01"
  | "LIMITED_FACT_ANCHORING_ONLY";

export type GASL01ResponseMode =
  | "FACT_ANCHORING"
  | "PATTERN_RECOGNITION"
  | "REALITY_VALIDATION"
  | "DARVO_RECOGNITION"
  | "SELF_DOUBT_NORMALIZATION"
  | "BOUNDARY_BRIDGE"
  | "INFORMATION_ASYMMETRY"
  | "CHILDREN_TRIANGULATION"
  | "SAFETY_BOUNDARY_FIRST"
  | "LEGAL_BOUNDARY_RESPONSE"
  | "SAFETY_EXIT";

export type GASL01RouteNext =
  | "GASL01"
  | "BEDR01"
  | "VETR01"
  | "K06"
  | "KBR01"
  | "KDL01"
  | "KSC01"
  | "CRISIS_PROTOCOL"
  | "SAFETY_PROTOCOL"
  | "NO_MODULE";

export interface GASL01RuntimeInput {
  intakeCompleted: boolean;
  persona: "kim";
  latestUserMessage: string;
  recentMessages: string[];
  language: "nl" | "en" | "mixed" | "unknown";
  detectedMarkers: string[];
  crisisProtocolStatus: "CLEAR" | "MONITOR" | "ACTIVE";
  K06StabilizationStatus: "NOT_RUN" | "STABILIZING" | "STABILIZED";
  acuteShockDominant: boolean;
  selfDoubtDominant: boolean;
  realityQuestionDominant: boolean;
  darvoPatternDetected: boolean;
  informationAsymmetry: boolean;
  childrenTriangulation: boolean;
  partnerBlamesCaregiver: boolean;
  safetyRisk: number;
  legalAdviceRequest: boolean;
  timestampIso: string;
}

export interface GASL01DetectionResult {
  moduleId: "GASL01";
  activationStatus: GASL01ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: GASL01ResponseMode;
  routeNext: GASL01RouteNext;
  reason: string;
}

export interface GASL01PromptPayload {
  moduleId: "GASL01";
  persona: "kim";
  responseMode: GASL01ResponseMode;
  fullPrompt: string;
  compactPrompt: string;
  gptMayDiagnose: false;
  gptMayLabelPartnerAsAbuser: false;
  gptMayGiveLegalAdvice: false;
  gptMayAdviseSeparation: false;
  gptMayMinimizeExperience: false;
  forbiddenOutput: string[];
}

export interface GASL01StoragePatch {
  persona: "kim";
  storagePath: "local://recofree/personas/kim/user.dat.modules.GASL01";
  lastActivatedModuleId: "GASL01";
  lastActivatedAt: string;
  responseMode: GASL01ResponseMode;
  selfDoubtDominant: boolean;
  darvoPatternDetected: boolean;
  informationAsymmetry: boolean;
  childrenTriangulation: boolean;
  factAnchoringOnlyMode: boolean;
}
