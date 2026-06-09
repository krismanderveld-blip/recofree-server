/**
 * VERG01 — Self-Forgiveness After Relapse (Elias only)
 * TYPE DEFINITIONS
 */

export type VERG01ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'BLOCKED_BY_INTAKE'
  | 'BLOCKED_BY_CRISIS'
  | 'BLOCKED_BY_MEDICAL'
  | 'DEFERRED_TO_FALE01_OR_E01';

export type VERG01ResponseMode =
  | 'RESPONSIBILITY_WITHOUT_IDENTITY_COLLAPSE'
  | 'SHAME_CONTAINMENT_AFTER_RELAPSE'
  | 'REPAIR_READINESS_CHECK'
  | 'SELF_FORGIVENESS_OPTION_NOT_REQUIREMENT'
  | 'DEFER_TO_FALE01_OR_E01'
  | 'SAFETY_EXIT'
  | 'MEDICAL_SAFETY_EXIT';

export type VERG01RouteNext =
  | 'VERG01'
  | 'EKT01_VERHELDERING'
  | 'EKT01_SPIEGEL'
  | 'EKT01_CONTRACT'
  | 'FALE01'
  | 'E01'
  | 'CRISIS_PROTOCOL'
  | 'MEDICAL_SAFETY_PROTOCOL'
  | 'NO_MODULE';

export interface VERG01RuntimeInput {
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
    forgivenessLanguage: boolean;
    relapseLinkedGuilt: boolean;
    selfPunishmentLoop: boolean;
    repairReadiness: number;
    shameIntensity: number;
    guiltIntensity: number;
  };
}

export interface VERG01DetectionResult {
  moduleId: 'VERG01';
  activationStatus: VERG01ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: VERG01ResponseMode;
  routeNext: VERG01RouteNext;
  reason: string;
}

export interface VERG01PromptPayload {
  moduleId: 'VERG01';
  persona: 'elias';
  responseMode: VERG01ResponseMode;
  compactPrompt: string;
  fullPrompt: string;
  forbiddenOutput: string[];
  therapeuticMode: string;
  engineDecided: true;
  safetyOverride: boolean;
}

export interface VERG01StoragePatch {
  lastActivatedModuleId: 'VERG01';
  lastActivatedAt: string;
  confidenceScore: number;
  matchedMarkers: string[];
  selectedResponseMode: VERG01ResponseMode;
  forgivenessLanguageDetected: boolean;
  relapseLinkedGuilt: boolean;
  selfPunishmentLoop: boolean;
  repairReadiness: number;
  shameIntensity: number;
  guiltIntensity: number;
}

export interface VERG01StorageState {
  activationCount: number;
  lastActivatedAt: string | null;
  lastResponseMode: VERG01ResponseMode | null;
  selfPunishmentLoopCount: number;
  repairAttemptCount: number;
}

export interface VERG01ModuleOutput {
  detection: VERG01DetectionResult;
  promptPayload: VERG01PromptPayload | null;
  storagePatch: Partial<VERG01StoragePatch>;
}

export function createDefaultVERG01Storage(): VERG01StorageState {
  return {
    activationCount: 0,
    lastActivatedAt: null,
    lastResponseMode: null,
    selfPunishmentLoopCount: 0,
    repairAttemptCount: 0,
  };
}
