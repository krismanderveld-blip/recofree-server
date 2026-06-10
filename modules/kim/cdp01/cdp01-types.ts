/**
 * CDP01 — Codependentie Detectie (Kim only)
 * Detects self-loss, relational fusion, rescue compulsion, and identity collapse
 * around partner with addiction. K06 runs before this module. Crisis/safety override always.
 */

export type CDP01ActivationStatus =
  | "ACTIVE"
  | "NOT_ACTIVE"
  | "BLOCKED_BY_INTAKE"
  | "BLOCKED_BY_CRISIS"
  | "BLOCKED_BY_PERSONA"
  | "DEFERRED_TO_K06"
  | "DEFERRED_TO_SAFETY";

export type CDP01ResponseMode =
  | "SELF_LOSS_PATTERN_MIRROR"
  | "IDENTITY_SEPARATION_GENTLE"
  | "EMOTIONAL_LINK_REFLECTION"
  | "LOVE_VS_OVERRESPONSIBILITY"
  | "SELF_CARE_GUILT_SOFTENING"
  | "CONTROL_AS_FEAR_RESPONSE"
  | "K06_STABILIZATION_BRIDGE"
  | "SAFETY_EXIT";

export type CDP01RouteNext =
  | "CDP01"
  | "K06"
  | "KBR01"
  | "KSC01"
  | "KDL01"
  | "CRISIS_PROTOCOL"
  | "SAFETY_PROTOCOL"
  | "NO_MODULE";

export interface CDP01RuntimeInput {
  intakeCompleted: boolean;
  persona: "kim";
  latestUserMessage: string;
  recentMessages: string[];
  language: "nl" | "en" | "mixed" | "unknown";
  detectedMarkers: string[];
  crisisProtocolStatus: "CLEAR" | "MONITOR" | "ACTIVE";
  K06StabilizationStatus: "NOT_RUN" | "STABILIZING" | "STABILIZED";
  selfLossPattern: boolean;
  relationalFusion: boolean;
  emotionalDependencyOnPartnerState: boolean;
  rescueCompulsion: boolean;
  overResponsibility: boolean;
  controlFromFear: boolean;
  selfCareGuilt: boolean;
  identityCollapseWithoutPartner: boolean;
  acuteOverload: boolean;
  safetyRisk: number;
  timestampIso: string;
}

export interface CDP01DetectionResult {
  moduleId: "CDP01";
  activationStatus: CDP01ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: CDP01ResponseMode;
  routeNext: CDP01RouteNext;
  reason: string;
}

export interface CDP01PromptPayload {
  moduleId: "CDP01";
  persona: "kim";
  responseMode: CDP01ResponseMode;
  fullPrompt: string;
  compactPrompt: string;
  gptMayDiagnose: false;
  gptMayUseEliasState: false;
  gptMayAdviseSeparation: false;
  gptMayForceChange: false;
  forbiddenOutput: string[];
}

export interface CDP01StoragePatch {
  persona: "kim";
  storagePath: "local://recofree/personas/kim/user.dat.modules.CDP01";
  lastActivatedModuleId: "CDP01";
  lastActivatedAt: string;
  responseMode: CDP01ResponseMode;
  selfLossPattern: boolean;
  relationalFusion: boolean;
  emotionalDependencyOnPartnerState: boolean;
  rescueCompulsion: boolean;
  selfCareGuilt: boolean;
  bridgeModuleSuggested?: "KBR01" | "KSC01" | "KDL01" | null;
}
