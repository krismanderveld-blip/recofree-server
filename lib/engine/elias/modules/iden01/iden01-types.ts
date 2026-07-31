/**
 * IDEN01 — Identity Rebuilding Outside Addiction (Elias only)
 * TYPE DEFINITIONS
 */

export type IDEN01ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'BLOCKED_BY_INTAKE'
  | 'BLOCKED_BY_CRISIS'
  | 'BLOCKED_BY_MEDICAL'
  | 'DEFERRED_TO_FALE01_OR_E01';

export type IDEN01ResponseMode =
  | 'IDENTITY_SEPARATION_FROM_ADDICTION'
  | 'IDENTITY_STABILIZATION'
  | 'VALUES_FRAGMENT_RECONSTRUCTION'
  | 'DEFER_TO_FALE01_OR_E01'
  | 'SAFETY_EXIT'
  | 'MEDICAL_SAFETY_EXIT';

export type IDEN01RouteNext =
  | 'IDEN01'
  | 'EKT01_VERHELDERING'
  | 'EKT01_SPIEGEL'
  | 'EKT01_CONTRACT'
  | 'FALE01'
  | 'E01'
  | 'CRISIS_PROTOCOL'
  | 'MEDICAL_SAFETY_PROTOCOL'
  | 'NO_MODULE';

export interface IDEN01RuntimeInput {
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
    addictionIdentityFusion: boolean;
    relapseIdentityCollapse: boolean;
    roleFusion: boolean;
    backpackAnchorsAvailable: boolean;
    valuesReadiness: number;
  };
}

export interface IDEN01DetectionResult {
  moduleId: 'IDEN01';
  activationStatus: IDEN01ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: IDEN01ResponseMode;
  routeNext: IDEN01RouteNext;
  reason: string;
}

export interface IDEN01PromptPayload {
  moduleId: 'IDEN01';
  persona: 'elias';
  responseMode: IDEN01ResponseMode;
  compactPrompt: string;
  fullPrompt: string;
  forbiddenOutput: string[];
  therapeuticMode: string;
  engineDecided: true;
  safetyOverride: boolean;
}

export interface IDEN01StoragePatch {
  lastActivatedModuleId: 'IDEN01';
  lastActivatedAt: string;
  confidenceScore: number;
  matchedMarkers: string[];
  selectedResponseMode: IDEN01ResponseMode;
  identityFusionDetected: boolean;
  relapseIdentityCollapse: boolean;
  roleFusion: boolean;
  backpackAnchorsUsed: boolean;
  valuesReadiness: number;
}

export interface IDEN01StorageState {
  activationCount: number;
  lastActivatedAt: string | null;
  lastResponseMode: IDEN01ResponseMode | null;
  identityFusionCount: number;
  valuesReconstructionCount: number;
}

export interface IDEN01ModuleOutput {
  detection: IDEN01DetectionResult;
  promptPayload: IDEN01PromptPayload | null;
  storagePatch: Partial<IDEN01StoragePatch>;
}

export function createDefaultIDEN01Storage(): IDEN01StorageState {
  return {
    activationCount: 0,
    lastActivatedAt: null,
    lastResponseMode: null,
    identityFusionCount: 0,
    valuesReconstructionCount: 0,
  };
}
