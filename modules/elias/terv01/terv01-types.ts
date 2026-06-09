/**
 * TERV01 — Post-Purple Zone Relapse Chain Analysis (Elias only)
 * TYPE DEFINITIONS
 */

export type TERV01ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'BLOCKED_BY_INTAKE'
  | 'BLOCKED_DURING_PAARS'
  | 'BLOCKED_BY_CRISIS'
  | 'BLOCKED_BY_MEDICAL'
  | 'DEFERRED_STABILIZATION_REQUIRED';

export type TERV01ResponseMode =
  | 'POST_PAARS_STABILIZATION_CHECK'
  | 'CLINICAL_CHAIN_MAPPING'
  | 'TRIGGER_CLARIFICATION'
  | 'THOUGHT_BRIDGE_IDENTIFICATION'
  | 'EMOTION_BODY_MAPPING'
  | 'BEHAVIORAL_ACCESS_POINT'
  | 'PREVENTION_POINT_CONTRACT'
  | 'BLOCK_ANALYSIS_DURING_PAARS'
  | 'NOT_ELIGIBLE_NO_POST_PAARS_CONTEXT'
  | 'SAFETY_EXIT'
  | 'MEDICAL_SAFETY_EXIT';

export type TERV01RouteNext =
  | 'TERV01'
  | 'FALE01_STAGE_1'
  | 'E01'
  | 'EKT01_VERHELDERING'
  | 'MI02'
  | 'CRISIS_PROTOCOL'
  | 'MEDICAL_SAFETY_PROTOCOL'
  | 'NO_MODULE';

export interface TERV01ChainMap {
  trigger: string | null;
  triggerConfidence: number;
  thought: string | null;
  thoughtConfidence: number;
  feeling: string | null;
  feelingConfidence: number;
  bodySignal: string | null;
  bodySignalConfidence: number;
  behavior: string | null;
  behaviorConfidence: number;
  useEvent: string | null;
  useEventConfidence: number;
  firstInterruptionPoint: 'trigger' | 'thought' | 'feeling' | 'behavior' | 'access' | 'unknown';
}

export interface TERV01RuntimeInput {
  intakeCompleted: boolean;
  persona: 'elias';
  currentZone: 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS' | 'UNKNOWN';
  previousZone: 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS' | 'UNKNOWN';
  previousSessionEnded: boolean;
  previousSessionId: string | null;
  stabilizationCompleted: boolean;
  latestUserMessage: string;
  recentMessages: string[];
  language: 'nl' | 'en' | 'mixed' | 'unknown';
  detectedMarkers: string[];
  crisisProtocolStatus: 'CLEAR' | 'MONITOR' | 'ACTIVE';
  medicalRisk: number;
  safetyRisk: number;
  relapseConfirmed: boolean;
  relapseLikely: boolean;
  userRequestsAnalysis: boolean;
  userRegulationLevel: number;
  shameIntensity: number;
  chainDataCompleteness: number;
  triggerKnown: boolean;
  thoughtKnown: boolean;
  feelingKnown: boolean;
  behaviorKnown: boolean;
  usePointKnown: boolean;
  chainMapDraft?: Partial<TERV01ChainMap>;
  timestampIso: string;
}

export interface TERV01DetectionResult {
  moduleId: 'TERV01';
  activationStatus: TERV01ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: TERV01ResponseMode;
  routeNext: TERV01RouteNext;
  reason: string;
}

export interface TERV01PromptPayload {
  moduleId: 'TERV01';
  persona: 'elias';
  responseMode: TERV01ResponseMode;
  fullPrompt: string;
  compactPrompt: string;
  chainMapDraft: Partial<TERV01ChainMap>;
  clinicianReadable: true;
  gptMayDiagnose: false;
  gptMayActivateModule: false;
  gptMayAnalyzeDuringPaars: false;
  forbiddenOutput: string[];
}

export interface TERV01StoragePatch {
  lastActivatedModuleId: 'TERV01';
  lastActivatedAt: string;
  previousSessionId: string | null;
  relapseConfirmed: boolean;
  chainMap: Partial<TERV01ChainMap>;
  chainDataCompleteness: number;
  selectedResponseMode: TERV01ResponseMode;
  preventionPointSelected?: TERV01ChainMap['firstInterruptionPoint'];
  clinicianReadableSummaryCreated: boolean;
}
