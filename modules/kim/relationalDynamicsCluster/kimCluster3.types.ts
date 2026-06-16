/**
 * Kim Cluster 3 — Relational Dynamics (ROL-K01, VETR02-K, LEUGEN-K01)
 * Reflective modules for caregiver relational patterns.
 * Kim only. Never Elias. Never reads/writes Elias memory.
 */

export type KimCluster3ModuleId =
  | 'ROL-K01'
  | 'VETR02-K'
  | 'LEUGEN-K01';

export type KimCluster3ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'BLOCKED_BY_PERSONA'
  | 'BLOCKED_BY_INTAKE'
  | 'DEFER_TO_CRISIS_K01'
  | 'DEFER_TO_GEVAAR_K01'
  | 'DEFER_TO_KIND_K01'
  | 'DEFER_TO_HERV_K01'
  | 'DEFER_TO_NAHERV_K01'
  | 'DEFER_TO_K06'
  | 'ESCALATE_TO_CRISIS_NUMBERS';

export type KimCluster3ResponseMode =
  | 'CAREGIVER_ROLE_DROP_EMOTIONS'
  | 'PERMISSION_TO_FEEL_WITHOUT_GUILT'
  | 'IDENTITY_BEYOND_CARE_ROLE'
  | 'EXHAUSTION_ANGER_GRIEF_EMPTYNESS'
  | 'ABSENCE_TRIGGERED_HYPERVIGILANCE'
  | 'GROUNDING_THEN_NOW'
  | 'SILENCE_FEELS_UNSAFE'
  | 'BETRAYAL_PAIN_AND_CLARITY'
  | 'BOUNDARIES_WITHOUT_DETECTIVE_ROLE'
  | 'UNCERTAINTY_WITHOUT_SELF_ERASURE'
  | 'K06_STABILIZATION'
  | 'CRISIS_BRIDGE'
  | 'DANGER_BRIDGE'
  | 'CHILD_SAFETY_BRIDGE'
  | 'ACTIVE_RELAPSE_BRIDGE';

export type KimCluster3Theme =
  | 'suppressed_emotions_after_care_role'
  | 'caregiver_identity_after_role_drop'
  | 'triggered_reexperience_absence_admission'
  | 'hypervigilance_when_partner_absent'
  | 'chronic_lying_betrayal_clarity'
  | 'detective_role_risk'
  | 'boundary_repair'
  | 'self_compassion_needed';

export type FixedBelgianCrisisNumber =
  | '1813'
  | '1712'
  | '112'
  | '101';

export const ALLOWED_CRISIS_NUMBERS: FixedBelgianCrisisNumber[] = [
  '1813',
  '1712',
  '112',
  '101',
];

export interface KimCluster3RuntimeInput {
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
  activeRelapseNow: boolean;
  postRelapseAftermath: boolean;
  aggressionDetected: boolean;
  domesticViolenceOrAbuseDetected: boolean;
  selfHarmOrSuicideDetected: boolean;
  medicalEmergencyDetected: boolean;
  disappearanceAcuteDangerDetected: boolean;
  careRoleDroppedOrPaused: boolean;
  lovedOneStableOrAdmitted: boolean;
  suppressedEmotionWaveDetected: boolean;
  partnerAbsentOrInAdmission: boolean;
  hypervigilanceDetected: boolean;
  reexperienceDetected: boolean;
  chronicLyingDetected: boolean;
  detectiveRoleDetected: boolean;
  betrayalPainDetected: boolean;
  timestampIso: string;
  sessionId: string;
  turnId: string;
}

export interface KimCluster3DetectionResult {
  moduleId: KimCluster3ModuleId;
  activationStatus: KimCluster3ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  themes: KimCluster3Theme[];
  responseMode: KimCluster3ResponseMode;
  crisisNumbersToShow: FixedBelgianCrisisNumber[];
  routeNext:
    | 'ROL-K01'
    | 'VETR02-K'
    | 'LEUGEN-K01'
    | 'CRISIS-K01'
    | 'GEVAAR-K01'
    | 'KIND-K01'
    | 'HERV-K01'
    | 'NAHERV-K01'
    | 'K06'
    | 'KDL01'
    | 'KBR01'
    | 'KSC01'
    | 'KST01'
    | 'P2'
    | 'P3'
    | 'P4'
    | 'P5'
    | 'NO_MODULE';
  reason: string;
}

export interface KimCluster3PromptPayload {
  persona: 'kim';
  moduleId: KimCluster3ModuleId;
  responseMode: KimCluster3ResponseMode;
  matchedMarkers: string[];
  themes: KimCluster3Theme[];
  crisisNumbersToShow: FixedBelgianCrisisNumber[];
  fullPrompt: string;
  compactPrompt: string;
  store: false;
  gptMayDiagnose: false;
  gptMayGiveLegalAdvice: false;
  gptMayUseEliasMemory: false;
  gptMayTellKimToControl: false;
  gptMayTellKimToRescue: false;
  gptMayTellKimToDetectiveInvestigate: false;
  gptMayPressureForgivenessOrSeparation: false;
  forbiddenOutput: string[];
}

export interface KimCluster3MemoryPatch {
  persona: 'kim';
  moduleId: KimCluster3ModuleId;
  storageTargets: Array<'user.dat' | 'projections.dat' | 'logs.dat'>;
  triggerPatterns?: KimCluster3TriggerPatternPatch[];
  projections?: KimCluster3ProjectionPatch[];
  logEntry: KimCluster3LogEntryPatch;
}

export interface KimCluster3TriggerPatternPatch {
  triggerId: string;
  label: string;
  normalizedLabel: string;
  theme: KimCluster3Theme;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  frequencyIncrement: 1;
  sourceModuleId: KimCluster3ModuleId;
}

export interface KimCluster3ProjectionPatch {
  projectionId: string;
  kind: 'fear' | 'concern' | 'identity_need' | 'boundary_need';
  label: string;
  normalizedLabel: string;
  decayScoreInitial: number;
  sourceModuleId: KimCluster3ModuleId;
  firstDetectedAt: string;
  lastUpdatedAt: string;
}

export interface KimCluster3LogEntryPatch {
  logId: string;
  sessionId: string;
  turnId: string;
  timestampIso: string;
  moduleId: KimCluster3ModuleId;
  responseMode: KimCluster3ResponseMode;
  matchedMarkers: string[];
  themes: KimCluster3Theme[];
  crisisNumbersShown: FixedBelgianCrisisNumber[];
  storePolicy: 'local_kim_scoped_only';
  rawTextStored: false;
}
