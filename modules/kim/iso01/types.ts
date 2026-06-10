/**
 * ISO01 — Isolatie en Sociale Terugtrekking (Kim only)
 * TypeScript data contracts per spec.
 */

export type ISO01ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'BLOCKED_BY_INTAKE'
  | 'BLOCKED_BY_CRISIS'
  | 'BLOCKED_BY_PERSONA'
  | 'DEFERRED_TO_K06'
  | 'DEFERRED_TO_SAFETY';

export type ISO01ResponseMode =
  | 'SOCIAL_WITHDRAWAL_MIRROR'
  | 'PROTECTIVE_WITHDRAWAL_VALIDATION'
  | 'SHAME_SAFE_SILENCE_VALIDATION'
  | 'BURDEN_FEAR_SOFTENING'
  | 'EXHAUSTION_BASED_WITHDRAWAL'
  | 'BOUNDARIED_SHARING_OPTION'
  | 'MICRO_CONNECTION_ON_OWN_TEMPO'
  | 'ISOLATION_WITHOUT_PRESSURE'
  | 'K06_STABILIZATION_BRIDGE'
  | 'SAFETY_EXIT';

export interface ISO01RuntimeInput {
  intakeCompleted: boolean;
  persona: 'kim';
  latestUserMessage: string;
  recentMessages: string[];
  language: 'nl' | 'en' | 'mixed' | 'unknown';
  detectedMarkers: string[];
  crisisProtocolStatus: 'CLEAR' | 'MONITOR' | 'ACTIVE';
  K06StabilizationStatus: 'NOT_RUN' | 'STABILIZING' | 'STABILIZED';
  socialWithdrawal: boolean;
  shameAboutTalking: boolean;
  burdenFear: boolean;
  protectiveIsolation: boolean;
  exhaustionIsolation: boolean;
  noSocialContact: boolean;
  privacyNeed: boolean;
  fearOfJudgment: boolean;
  adviceFatigue: boolean;
  painfulLoneliness: boolean;
  wantsConnectionButScared: boolean;
  acuteOverload: boolean;
  safetyRisk: number;
  timestampIso: string;
}

export interface ISO01DetectionResult {
  moduleId: 'ISO01';
  activationStatus: ISO01ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  responseMode: ISO01ResponseMode;
  routeNext:
    | 'ISO01'
    | 'K06'
    | 'KSC01'
    | 'KBR01'
    | 'KDL01'
    | 'CDP01'
    | 'RNW01'
    | 'CRISIS_PROTOCOL'
    | 'SAFETY_PROTOCOL'
    | 'NO_MODULE';
  reason: string;
}

export interface ISO01PromptPayload {
  moduleId: 'ISO01';
  persona: 'kim';
  responseMode: ISO01ResponseMode;
  fullPrompt: string;
  compactPrompt: string;
  gptMayDiagnose: false;
  gptMayUseEliasState: false;
  gptMayPressureSocialReintegration: false;
  gptMayAdviseExposure: false;
  gptMayContactOthers: false;
  forbiddenOutput: string[];
}

export interface ISO01StoragePatch {
  persona: 'kim';
  storagePath: 'local://recofree/personas/kim/user.dat.modules.ISO01';
  lastActivatedModuleId: 'ISO01';
  lastActivatedAt: string;
  responseMode: ISO01ResponseMode;
  socialWithdrawal: boolean;
  shameAboutTalking: boolean;
  burdenFear: boolean;
  protectiveIsolation: boolean;
  exhaustionIsolation: boolean;
  painfulLoneliness: boolean;
  bridgeModuleSuggested?: 'KSC01' | 'KBR01' | 'KDL01' | 'CDP01' | 'RNW01' | null;
}
