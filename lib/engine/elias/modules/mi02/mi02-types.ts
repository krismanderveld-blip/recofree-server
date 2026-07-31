/**
 * MI02 — Motivational Interviewing Verdieping (Elias only)
 * Deep ambivalence OARS module. Builds on MI01, does not replace it.
 * TYPE DEFINITIONS
 */

export type MI02ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'BLOCKED_BY_INTAKE'
  | 'BLOCKED_BY_CRISIS'
  | 'BLOCKED_BY_MEDICAL'
  | 'DEFERRED_TO_RELAPSE_CONTAINMENT';

export type MI02ResponseMode =
  | 'DOUBLE_SIDED_REFLECTION'
  | 'OPEN_AMBIVALENCE_EXPLORATION'
  | 'AFFIRM_AUTONOMY'
  | 'SUSTAIN_TALK_REFLECTION'
  | 'CHANGE_TALK_EVOCATION'
  | 'AMBIVALENCE_SUMMARY'
  | 'READINESS_RULER'
  | 'DEFER_TO_FALE01_OR_E01'
  | 'SAFETY_EXIT'
  | 'MEDICAL_SAFETY_EXIT';

export type MI02OarsTechnique =
  | 'OPEN_QUESTION'
  | 'AFFIRMATION'
  | 'REFLECTION'
  | 'SUMMARY'
  | 'COMBINED';

export type MI02RouteNext =
  | 'MI02'
  | 'MI01'
  | 'AGC01'
  | 'FALE01'
  | 'E01'
  | 'ACT'
  | 'CRISIS_PROTOCOL'
  | 'MEDICAL_SAFETY_PROTOCOL'
  | 'NO_MODULE';

export interface MI02RuntimeInput {
  intakeCompleted: boolean;
  persona: 'elias';
  latestUserMessage: string;
  recentMessages: string[];
  language: 'nl' | 'en' | 'mixed' | 'unknown';
  detectedMarkers: string[];
  crisisProtocolStatus: 'CLEAR' | 'MONITOR' | 'ACTIVE';
  medicalRisk: number;
  safetyRisk: number;
  paarsZoneActive: boolean;
  cravingIntensity: number;
  userRegulationLevel: number;
  directAmbivalenceMarker: boolean;
  changeTalkPresent: boolean;
  sustainTalkPresent: boolean;
  adviceResistance: boolean;
  externalMotivationDominant: boolean;
  readinessScoreAvailable: boolean;
  readinessScore?: number;
  sessionMixedSignalsCount: number;
  mi01PreviouslyActive: boolean;
  timestampIso: string;
}

export interface MI02DetectionResult {
  moduleId: 'MI02';
  activationStatus: MI02ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: MI02ResponseMode;
  oarsTechnique: MI02OarsTechnique;
  routeNext: MI02RouteNext;
  reason: string;
}

export interface MI02PromptPayload {
  moduleId: 'MI02';
  persona: 'elias';
  responseMode: MI02ResponseMode;
  oarsTechnique: MI02OarsTechnique;
  fullPrompt: string;
  compactPrompt: string;
  gptMayDiagnose: false;
  gptMayPersuade: false;
  gptMayDecideForUser: false;
  forbiddenOutput: string[];
}

export interface MI02StoragePatch {
  lastActivatedModuleId: 'MI02';
  lastActivatedAt: string;
  responseMode: MI02ResponseMode;
  oarsTechnique: MI02OarsTechnique;
  changeTalkPresent: boolean;
  sustainTalkPresent: boolean;
  directAmbivalenceMarker: boolean;
  readinessScore?: number;
  externalMotivationDominant: boolean;
}
