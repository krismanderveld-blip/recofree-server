/**
 * SLAAP01 — Sleep and Caregiver Sustainability (Kim)
 * Types and contracts per canon spec.
 * Focus: sleep as caregiver sustainability, night vigilance, guilt-free rest, boundary fatigue.
 */

export type SLAAP01KimActivationStatus =
  | "ACTIVE"
  | "NOT_ACTIVE"
  | "BLOCKED_BY_INTAKE"
  | "BLOCKED_BY_CRISIS"
  | "BLOCKED_BY_MEDICAL"
  | "BLOCKED_BY_PERSONA_SEPARATION";

export type SLAAP01KimResponseMode =
  | "KIM_SLEEP_HYGIENE_WITHOUT_GUILT"
  | "KIM_NIGHT_VIGILANCE_BOUNDARY"
  | "KIM_SLEEP_GUILT_DECOUPLING"
  | "KIM_FATIGUE_BOUNDARY_TRIGGER"
  | "KIM_CAREGIVER_SAFETY_DISTINCTION"
  | "SAFETY_EXIT"
  | "MEDICAL_SAFETY_EXIT";

export type SLAAP01KimRouteNext =
  | "SLAAP01"
  | "KBR01"
  | "KSC01"
  | "KDL01"
  | "CRISIS_PROTOCOL"
  | "MEDICAL_SAFETY_PROTOCOL"
  | "SAFETY_PROTOCOL"
  | "NO_MODULE";

export interface SLAAP01KimRuntimeInput {
  persona: "kim";
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
  nightVigilanceDetected: boolean;
  sleepGuiltDetected: boolean;
  fatigueBoundaryTriggerDetected: boolean;
  boundaryFatigueIntensity: number;
  caregiverStressIntensity: number;
  acuteHouseholdSafetyRisk: boolean;
  timestampIso: string;
}

export interface SLAAP01KimDetectionResult {
  moduleId: "SLAAP01";
  persona: "kim";
  activationStatus: SLAAP01KimActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: SLAAP01KimResponseMode;
  routeNext: SLAAP01KimRouteNext;
  reason: string;
}

export interface SLAAP01KimPromptPayload {
  moduleId: "SLAAP01";
  persona: "kim";
  responseMode: SLAAP01KimResponseMode;
  fullPrompt: string;
  compactPrompt: string;
  gptMayDiagnose: false;
  gptMayGiveMedicationAdvice: false;
  gptMayAccessOtherPersonaState: false;
  forbiddenOutput: string[];
}

export interface SLAAP01KimStoragePatch {
  persona: "kim";
  storagePath: "local://recofree/personas/kim/user.dat.modules.SLAAP01";
  lastActivatedModuleId: "SLAAP01";
  lastActivatedAt: string;
  sleepProblemDetected: boolean;
  nightVigilanceDetected: boolean;
  sleepGuiltDetected: boolean;
  fatigueBoundaryTriggerDetected: boolean;
  selectedResponseMode: SLAAP01KimResponseMode;
}
