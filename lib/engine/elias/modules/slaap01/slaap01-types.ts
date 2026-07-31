/**
 * SLAAP01 — Sleep and Addiction Recovery (Elias)
 * Types and contracts per canon spec.
 * Focus: sleep as relapse prevention, night craving, fatigue trigger, withdrawal sleep.
 */

export type SLAAP01ActivationStatus =
  | "ACTIVE"
  | "NOT_ACTIVE"
  | "BLOCKED_BY_INTAKE"
  | "BLOCKED_BY_CRISIS"
  | "BLOCKED_BY_MEDICAL"
  | "BLOCKED_BY_PERSONA_SEPARATION"
  | "DEFERRED_TO_RELAPSE_OR_SAFETY";

export type SLAAP01EliasResponseMode =
  | "ELIAS_SLEEP_HYGIENE_NO_PRESSURE"
  | "ELIAS_NIGHT_CRAVING_DISTRESS_TOLERANCE"
  | "ELIAS_SLEEP_ANXIETY_ACCEPTANCE"
  | "ELIAS_FATIGUE_TRIGGER_RECOGNITION"
  | "ELIAS_WITHDRAWAL_SLEEP_MEDICAL_CAUTION"
  | "SAFETY_EXIT"
  | "MEDICAL_SAFETY_EXIT";

export type SLAAP01EliasRouteNext =
  | "SLAAP01"
  | "E01"
  | "FALE01"
  | "CRISIS_PROTOCOL"
  | "MEDICAL_SAFETY_PROTOCOL"
  | "NO_MODULE";

export interface SLAAP01EliasRuntimeInput {
  persona: "elias";
  intakeCompleted: boolean;
  latestUserMessage: string;
  recentMessages: string[];
  language: "nl" | "en" | "mixed" | "unknown";
  detectedMarkers: string[];
  crisisProtocolStatus: "CLEAR" | "MONITOR" | "ACTIVE";
  medicalRisk: number;
  safetyRisk: number;
  sleepProblemDetected: boolean;
  sleepAnxietyDetected: boolean;
  nightCravingDetected: boolean;
  cravingIntensity: number;
  fatigueRelapseTriggerDetected: boolean;
  withdrawalSleepConcern: boolean;
  withdrawalRisk: number;
  paarsZoneActive: boolean;
  relapseRecentlyOccurred: boolean;
  timestampIso: string;
}

export interface SLAAP01EliasDetectionResult {
  moduleId: "SLAAP01";
  persona: "elias";
  activationStatus: SLAAP01ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: SLAAP01EliasResponseMode;
  routeNext: SLAAP01EliasRouteNext;
  reason: string;
}

export interface SLAAP01EliasPromptPayload {
  moduleId: "SLAAP01";
  persona: "elias";
  responseMode: SLAAP01EliasResponseMode;
  fullPrompt: string;
  compactPrompt: string;
  gptMayDiagnose: false;
  gptMayGiveMedicationAdvice: false;
  gptMayAccessOtherPersonaState: false;
  forbiddenOutput: string[];
}

export interface SLAAP01EliasStoragePatch {
  persona: "elias";
  storagePath: "local://recofree/personas/elias/user.dat.modules.SLAAP01";
  lastActivatedModuleId: "SLAAP01";
  lastActivatedAt: string;
  sleepProblemDetected: boolean;
  nightCravingDetected: boolean;
  fatigueRelapseTriggerDetected: boolean;
  withdrawalSleepConcern: boolean;
  selectedResponseMode: SLAAP01EliasResponseMode;
}
