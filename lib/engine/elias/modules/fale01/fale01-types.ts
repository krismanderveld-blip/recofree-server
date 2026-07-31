/**
 * FALE01 — Two-Stage Failure Response After Relapse (Elias only)
 * TYPE DEFINITIONS
 */

export type FALE01ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'BLOCKED_BY_INTAKE'
  | 'BLOCKED_BY_CRISIS'
  | 'BLOCKED_BY_MEDICAL'
  | 'DEFERRED_TO_FALE01_OR_E01';

export type FALE01ResponseMode =
  | 'STAGE_1_IMMEDIATE_CONTAINMENT'
  | 'STAGE_1_SHAME_INTERRUPTION'
  | 'STAGE_2_PREVENTION_CONTRACT'
  | 'DEFER_TO_FALE01_OR_E01'
  | 'SAFETY_EXIT'
  | 'MEDICAL_SAFETY_EXIT';

export type FALE01RouteNext =
  | 'FALE01'
  | 'EKT01_VERHELDERING'
  | 'EKT01_SPIEGEL'
  | 'EKT01_CONTRACT'
  | 'E01'
  | 'CRISIS_PROTOCOL'
  | 'MEDICAL_SAFETY_PROTOCOL'
  | 'NO_MODULE';

export interface FALE01RuntimeInput {
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
    relapseConfirmed: boolean;
    stage: 'STAGE_1_CONTAINMENT' | 'STAGE_2_ANALYSIS';
    shameIntensity: number;
    continuationRisk: number;
    chainClarity: number;
    timeSinceRelapseHours: number | null;
  };
}

export interface FALE01DetectionResult {
  moduleId: 'FALE01';
  activationStatus: FALE01ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: FALE01ResponseMode;
  routeNext: FALE01RouteNext;
  reason: string;
}

export interface FALE01PromptPayload {
  moduleId: 'FALE01';
  persona: 'elias';
  responseMode: FALE01ResponseMode;
  compactPrompt: string;
  fullPrompt: string;
  forbiddenOutput: string[];
  therapeuticMode: string;
  engineDecided: true;
  safetyOverride: boolean;
}

export interface FALE01StoragePatch {
  lastActivatedModuleId: 'FALE01';
  lastActivatedAt: string;
  confidenceScore: number;
  matchedMarkers: string[];
  selectedResponseMode: FALE01ResponseMode;
  relapseConfirmed: boolean;
  selectedStage: string;
  shameIntensity: number;
  continuationRisk: number;
  chainAnalysisAllowed: boolean;
}

export interface FALE01StorageState {
  activationCount: number;
  lastActivatedAt: string | null;
  lastResponseMode: FALE01ResponseMode | null;
  relapseConfirmedCount: number;
  stage2ReachedCount: number;
}

export interface FALE01ModuleOutput {
  detection: FALE01DetectionResult;
  promptPayload: FALE01PromptPayload | null;
  storagePatch: Partial<FALE01StoragePatch>;
}

export function createDefaultFALE01Storage(): FALE01StorageState {
  return {
    activationCount: 0,
    lastActivatedAt: null,
    lastResponseMode: null,
    relapseConfirmedCount: 0,
    stage2ReachedCount: 0,
  };
}
