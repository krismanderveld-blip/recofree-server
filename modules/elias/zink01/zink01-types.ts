/**
 * ZINK01 — Meaning/Purpose Module (Elias only)
 * TYPE DEFINITIONS
 */

export type ZINK01ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'BLOCKED_BY_INTAKE'
  | 'BLOCKED_BY_CRISIS'
  | 'BLOCKED_BY_MEDICAL'
  | 'DEFERRED_TO_FALE01_OR_E01';

export type ZINK01ResponseMode =
  | 'MEANING_QUESTION_WITHOUT_ANSWER'
  | 'MEANING_CONTAINMENT'
  | 'ONE_MEANING_CARRYING_ACTION'
  | 'DEFER_TO_FALE01_OR_E01'
  | 'SAFETY_EXIT'
  | 'MEDICAL_SAFETY_EXIT';

export type ZINK01RouteNext =
  | 'ZINK01'
  | 'EKT01_VERHELDERING'
  | 'EKT01_SPIEGEL'
  | 'EKT01_CONTRACT'
  | 'FALE01'
  | 'E01'
  | 'CRISIS_PROTOCOL'
  | 'MEDICAL_SAFETY_PROTOCOL'
  | 'NO_MODULE';

export interface ZINK01RuntimeInput {
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
    meaningVacuum: boolean;
    existentialDread: boolean;
    purposeAfterRecovery: boolean;
    spiritualLanguage: boolean;
    nihilismDetected: boolean;
  };
}

export interface ZINK01DetectionResult {
  moduleId: 'ZINK01';
  activationStatus: ZINK01ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: ZINK01ResponseMode;
  routeNext: ZINK01RouteNext;
  reason: string;
}

export interface ZINK01PromptPayload {
  moduleId: 'ZINK01';
  persona: 'elias';
  responseMode: ZINK01ResponseMode;
  compactPrompt: string;
  fullPrompt: string;
  forbiddenOutput: string[];
  therapeuticMode: string;
  engineDecided: true;
  safetyOverride: boolean;
}

export interface ZINK01StoragePatch {
  lastActivatedModuleId: 'ZINK01';
  lastActivatedAt: string;
  confidenceScore: number;
  matchedMarkers: string[];
  selectedResponseMode: ZINK01ResponseMode;
  meaningVacuum: boolean;
  existentialDread: boolean;
  purposeAfterRecovery: boolean;
  nihilismDetected: boolean;
}

export interface ZINK01StorageState {
  activationCount: number;
  lastActivatedAt: string | null;
  lastResponseMode: ZINK01ResponseMode | null;
  meaningVacuumCount: number;
  meaningActionCount: number;
}

export interface ZINK01ModuleOutput {
  detection: ZINK01DetectionResult;
  promptPayload: ZINK01PromptPayload | null;
  storagePatch: Partial<ZINK01StoragePatch>;
}

export function createDefaultZINK01Storage(): ZINK01StorageState {
  return {
    activationCount: 0,
    lastActivatedAt: null,
    lastResponseMode: null,
    meaningVacuumCount: 0,
    meaningActionCount: 0,
  };
}
