/**
 * ROUW01 — Grief/Loss Through Addiction (Elias only)
 * TYPE DEFINITIONS
 */

export type ROUW01ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'BLOCKED_BY_INTAKE'
  | 'BLOCKED_BY_CRISIS'
  | 'BLOCKED_BY_MEDICAL'
  | 'DEFERRED_TO_FALE01_OR_E01';

export type ROUW01ResponseMode =
  | 'NAME_LOSS_WITHOUT_FIXING'
  | 'GRIEF_CONTAINMENT'
  | 'ONE_GRIEF_CARRYING_ACTION'
  | 'DEFER_TO_FALE01_OR_E01'
  | 'SAFETY_EXIT'
  | 'MEDICAL_SAFETY_EXIT';

export type ROUW01RouteNext =
  | 'ROUW01'
  | 'EKT01_VERHELDERING'
  | 'EKT01_SPIEGEL'
  | 'EKT01_CONTRACT'
  | 'FALE01'
  | 'E01'
  | 'CRISIS_PROTOCOL'
  | 'MEDICAL_SAFETY_PROTOCOL'
  | 'NO_MODULE';

export interface ROUW01RuntimeInput {
  intakeCompleted: boolean;
  persona: 'elias';
  latestUserMessage: string;
  recentMessages: string[];
  language: 'nl' | 'en' | 'mixed' | 'unknown';
  detectedMarkers: string[];
  crisisProtocolStatus: 'CLEAR' | 'MONITOR' | 'ACTIVE';
  medicalRisk: number;
  safetyRisk: number;
  acuteRelapseContainmentNeeded: boolean;
  regulationLevel: number;
  readinessForAction: number;
  primarySignal: string;
  confidenceSeeds: string[];
  timestampIso: string;
  context: {
    lossDomains: string[];
    griefIntensity: number;
    cravingLinkedToGrief: boolean;
    lostTimeMarker: boolean;
    identityLossMarker: boolean;
    relationshipLossMarker: boolean;
  };
}

export interface ROUW01DetectionResult {
  moduleId: 'ROUW01';
  activationStatus: ROUW01ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: ROUW01ResponseMode;
  routeNext: ROUW01RouteNext;
  reason: string;
}

export interface ROUW01PromptPayload {
  moduleId: 'ROUW01';
  persona: 'elias';
  responseMode: ROUW01ResponseMode;
  compactPrompt: string;
  fullPrompt: string;
  forbiddenOutput: string[];
  therapeuticMode: string;
  engineDecided: true;
  safetyOverride: boolean;
}

export interface ROUW01StoragePatch {
  lastActivatedModuleId: 'ROUW01';
  lastActivatedAt: string;
  confidenceScore: number;
  matchedMarkers: string[];
  selectedResponseMode: ROUW01ResponseMode;
  lossDomains: string[];
  griefIntensity: number;
  cravingLinkedToGrief: boolean;
  selectedGriefAction?: string;
}

export interface ROUW01StorageState {
  activationCount: number;
  lastActivatedAt: string | null;
  lastResponseMode: ROUW01ResponseMode | null;
  cravingLinkedGriefCount: number;
  griefActionCount: number;
}

export interface ROUW01ModuleOutput {
  detection: ROUW01DetectionResult;
  promptPayload: ROUW01PromptPayload | null;
  storagePatch: Partial<ROUW01StoragePatch>;
}

export function createDefaultROUW01Storage(): ROUW01StorageState {
  return {
    activationCount: 0,
    lastActivatedAt: null,
    lastResponseMode: null,
    cravingLinkedGriefCount: 0,
    griefActionCount: 0,
  };
}
