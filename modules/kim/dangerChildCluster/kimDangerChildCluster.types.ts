/**
 * Kim Cluster 2: GEVAAR-K01 + KIND-K01
 * Dangerous situations & child safety in addiction context
 * Kim persona only — never Elias
 */

export type KimCluster2ModuleId = 'GEVAAR-K01' | 'KIND-K01';

export type KimDangerCategory =
  | 'DRUNK_DRIVING'
  | 'AGGRESSION'
  | 'DISAPPEARANCE'
  | 'OVERDOSE_OR_MEDICAL_DANGER'
  | 'SELF_HARM_THREAT_BY_LOVED_ONE'
  | 'WEAPON_OR_SEVERE_THREAT'
  | 'UNSAFE_HOME'
  | 'UNKNOWN_DANGER';

export type KimChildSafetyCategory =
  | 'CHILD_WITNESSES_USE'
  | 'CHILD_IS_AFRAID'
  | 'CHILD_EXPOSED_TO_AGGRESSION'
  | 'CHILD_NEGLECT'
  | 'CHILD_PARENTIFICATION'
  | 'CHILD_MALTREATMENT'
  | 'CHILD_IN_CAR_WITH_INTOXICATED_ADULT'
  | 'CHILD_MISSING_OR_UNSUPERVISED'
  | 'CHILD_LOYALTY_CONFLICT'
  | 'UNKNOWN_CHILD_SAFETY';

export type KimCluster2ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'BLOCKED_BY_PERSONA'
  | 'BLOCKED_BY_INTAKE'
  | 'ESCALATE_TO_CRISIS_NUMBERS'
  | 'DEFER_TO_CRISIS_K01'
  | 'DEFER_TO_HERV_K01'
  | 'DEFER_TO_NAHERV_K01'
  | 'DEFER_TO_K06';

export type KimCluster2ResponseMode =
  | 'SAFETY_FIRST'
  | 'GROUND_AND_PLAN'
  | 'BOUNDARY_AND_NON_RESCUE'
  | 'CALL_112_NOW'
  | 'CALL_101_POLICE'
  | 'CONTACT_1712'
  | 'CONTACT_0800_32_123'
  | 'PROTECT_CHILDREN_FIRST'
  | 'AGE_APPROPRIATE_CHILD_SUPPORT'
  | 'CHILD_MALTREATMENT_ROUTE'
  | 'DO_NOT_INTERVENE_PHYSICALLY'
  | 'DO_NOT_PARENTIFY_CHILD'
  | 'AFTERMATH_BRIDGE'
  | 'K06_STABILIZATION'
  | 'CRISIS_K01_BRIDGE';

export type FixedBelgianCrisisNumber = '0800 32 123' | '1712' | '112' | '101';

export interface KimCluster2RuntimeInput {
  persona: 'kim' | 'elias' | 'unknown';
  intakeCompleted: boolean;
  latestUserMessage: string;
  recentMessages: string[];
  language: 'nl' | 'en' | 'fr' | 'mixed' | 'unknown';
  detectedMarkers: string[];
  lovedOneUseContext: boolean;
  firstPersonUseContext: boolean;
  caregiverOverwhelmed: boolean;
  immediateDanger: boolean;
  childPresentOrAffected: boolean;
  aggressionDetected: boolean;
  drunkDrivingDetected: boolean;
  disappearanceDetected: boolean;
  overdoseOrMedicalDangerDetected: boolean;
  selfHarmThreatByLovedOneDetected: boolean;
  domesticViolenceOrAbuseDetected: boolean;
  policeRelevantButNot112: boolean;
  childMaltreatmentOrNeglectDetected: boolean;
  childParentificationRiskDetected: boolean;
  moduleCandidates: string[];
  timestampIso: string;
  sessionId: string;
  turnId: string;
}

export interface KimCluster2DetectionResult {
  moduleId: KimCluster2ModuleId;
  activationStatus: KimCluster2ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  dangerCategories?: KimDangerCategory[];
  childSafetyCategories?: KimChildSafetyCategory[];
  responseMode: KimCluster2ResponseMode;
  crisisNumbersToShow: FixedBelgianCrisisNumber[];
  routeNext: string;
  reason: string;
}

export interface KimCluster2PromptPayload {
  persona: 'kim';
  moduleId: KimCluster2ModuleId;
  responseMode: KimCluster2ResponseMode;
  matchedMarkers: string[];
  crisisNumbersToShow: FixedBelgianCrisisNumber[];
  fullPrompt: string;
  compactPrompt: string;
  store: false;
  gptMayDiagnose: false;
  gptMayGiveLegalAdvice: false;
  gptMayUseEliasMemory: false;
  gptMayTellKimToRescue: false;
  gptMayTellKimToPhysicallyIntervene: false;
  gptMayParentifyChildren: false;
  forbiddenOutput: string[];
}

export interface KimCluster2MemoryPatch {
  persona: 'kim';
  moduleId: KimCluster2ModuleId;
  storageTargets: Array<'user.dat' | 'projections.dat' | 'logs.dat'>;
  triggerPatterns?: KimCluster2TriggerPatternPatch[];
  projections?: KimCluster2ProjectionPatch[];
  logEntry: KimCluster2LogEntryPatch;
}

export interface KimCluster2TriggerPatternPatch {
  triggerId: string;
  label: string;
  normalizedLabel: string;
  category: KimDangerCategory | KimChildSafetyCategory;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  frequencyIncrement: 1;
  sourceModuleId: KimCluster2ModuleId;
}

export interface KimCluster2ProjectionPatch {
  projectionId: string;
  kind: 'fear' | 'concern';
  label: string;
  normalizedLabel: string;
  decayScoreInitial: number;
  sourceModuleId: KimCluster2ModuleId;
  firstDetectedAt: string;
  lastUpdatedAt: string;
}

export interface KimCluster2LogEntryPatch {
  logId: string;
  sessionId: string;
  turnId: string;
  timestampIso: string;
  moduleId: KimCluster2ModuleId;
  responseMode: KimCluster2ResponseMode;
  matchedMarkers: string[];
  crisisNumbersShown: FixedBelgianCrisisNumber[];
  storePolicy: 'local_kim_scoped_only';
  rawTextStored: false;
}
