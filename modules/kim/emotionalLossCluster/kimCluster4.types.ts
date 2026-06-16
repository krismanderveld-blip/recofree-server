/**
 * Kim Cluster 4 — Emotioneel Verlies
 * Modules: HOOP-K01, SCHAAM-K01, ROUW-K01, ISOL-K01
 *
 * Reflective modules for caregiver emotional loss, shame, grief, and isolation.
 * Always subordinate to acute clusters (CRISIS-K01, GEVAAR-K01, KIND-K01, HERV-K01).
 * HOOP-K01 includes a suicidality-split: situational hopelessness → reflective;
 * suicidal ideation in Kim → escalate to CRISIS-K01.
 */

// ─── Module IDs ───────────────────────────────────────────────────────────────

export type KimCluster4ModuleId = 'HOOP-K01' | 'SCHAAM-K01' | 'ROUW-K01' | 'ISOL-K01';

// ─── Activation Status ────────────────────────────────────────────────────────

export type KimCluster4ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'DEFERRED_TO_CRISIS_K01'
  | 'DEFERRED_TO_GEVAAR_K01'
  | 'DEFERRED_TO_KIND_K01'
  | 'DEFERRED_TO_HERV_K01'
  | 'DEFERRED_TO_NAHERV_K01'
  | 'BLOCKED_BY_PERSONA';

// ─── Response Modes ───────────────────────────────────────────────────────────

export type KimCluster4ResponseMode =
  // HOOP-K01
  | 'ENOUGH_IS_ENOUGH_REFLECTION'
  | 'LOSS_OF_HOPE_EXPLORATION'
  | 'SUICIDE_RISK_BRIDGE'
  // SCHAAM-K01
  | 'SHAME_AND_SECRECY'
  | 'GENTLE_RECONNECTION'
  // ROUW-K01
  | 'AMBIGUOUS_LOSS'
  | 'LOST_FUTURE_GRIEF'
  // ISOL-K01
  | 'SOCIAL_ISOLATION_BY_CAREGIVING'
  // Deferred/blocked
  | 'DEFERRED'
  | 'BLOCKED';

// ─── Themes ───────────────────────────────────────────────────────────────────

export type KimCluster4Theme =
  // HOOP-K01
  | 'question_enough_is_enough'
  | 'loss_of_hope_in_recovery'
  | 'loss_of_hope_in_relationship'
  | 'suicidal_hopelessness_in_kim'
  // SCHAAM-K01
  | 'shame_about_loved_one_addiction'
  | 'secrecy_and_withdrawal'
  | 'fear_of_judgment'
  | 'responsibility_confusion'
  // ROUW-K01
  | 'ambiguous_loss'
  | 'living_grief'
  | 'mourning_lost_future'
  // ISOL-K01
  | 'social_isolation'
  | 'loss_of_own_contacts'
  | 'caregiving_consumes_life';

// ─── Crisis Numbers ───────────────────────────────────────────────────────────

export type FixedBelgianCrisisNumber = '1813' | '1712' | '112' | '101';

export const ALLOWED_CRISIS_NUMBERS: readonly FixedBelgianCrisisNumber[] = [
  '1813',
  '1712',
  '112',
  '101',
] as const;

// ─── Route Next ───────────────────────────────────────────────────────────────

export type KimCluster4RouteNext =
  | 'HOOP-K01'
  | 'SCHAAM-K01'
  | 'ROUW-K01'
  | 'ISOL-K01'
  | 'CRISIS-K01'
  | 'GEVAAR-K01'
  | 'KIND-K01'
  | 'HERV-K01'
  | 'NAHERV-K01'
  | 'NO_MODULE';

// ─── Detection Result ─────────────────────────────────────────────────────────

export interface KimCluster4DetectionResult {
  moduleId: KimCluster4ModuleId;
  activationStatus: KimCluster4ActivationStatus;
  confidenceScore: number;
  matchedMarkers: string[];
  themes: KimCluster4Theme[];
  responseMode: KimCluster4ResponseMode;
  crisisNumbersToShow: FixedBelgianCrisisNumber[];
  routeNext: KimCluster4RouteNext;
  reason: string;
}

// ─── Runtime Input ────────────────────────────────────────────────────────────

export interface KimCluster4RuntimeInput {
  persona: 'elias' | 'kim';
  message: string;
  detectedMarkers: string[];

  // Acute cluster flags (from earlier pipeline stages)
  activeRelapseNow: boolean;
  immediateAftermathActive: boolean;
  dangerOrViolenceDetected: boolean;
  childPresentOrAffected: boolean;
  selfHarmOrSuicideDetectedInKim: boolean;
  immediateDanger: boolean;
  domesticViolenceOrAbuseDetected: boolean;
  aggressionDetected: boolean;

  // HOOP-K01 semantic flags
  hopeExhaustionDetected: boolean;
  enoughIsEnoughDetected: boolean;

  // SCHAAM-K01 semantic flags
  shameSecrecyDetected: boolean;
  socialWithdrawalDetected: boolean;

  // ROUW-K01 semantic flags
  ambiguousLossDetected: boolean;
  lostFutureGriefDetected: boolean;

  // ISOL-K01 semantic flags
  socialIsolationDetected: boolean;
  lossOfOwnContactsDetected: boolean;
}

// ─── Acute Override Result ─────────────────────────────────────────────────────

export interface KimCluster4AcuteOverrideResult {
  blocked: boolean;
  activationStatus: KimCluster4ActivationStatus;
  responseMode: KimCluster4ResponseMode;
  crisisNumbersToShow: FixedBelgianCrisisNumber[];
  routeNext: KimCluster4RouteNext;
  reason: string;
}

// ─── Memory Patch ─────────────────────────────────────────────────────────────

export interface KimCluster4MemoryPatch {
  persona: 'kim';
  moduleId: KimCluster4ModuleId;
  userDat: {
    triggerPatterns: string[];
    firstDetectedAt?: string;
    lastUpdatedAt: string;
    frequency: number;
    sourceModuleId: KimCluster4ModuleId;
  };
  projectionsDat: {
    category: string;
    key: string;
    value: string;
  }[];
  logsDat: {
    moduleId: KimCluster4ModuleId;
    themes: KimCluster4Theme[];
    responseMode: KimCluster4ResponseMode;
    timestamp: string;
    encrypted: true;
    rawText: false;
  };
}

// ─── Prompt Payload ───────────────────────────────────────────────────────────

export interface KimCluster4PromptPayload {
  moduleId: KimCluster4ModuleId;
  fullPrompt: string;
  compactPrompt: string;
  persona: 'kim';
  store: false;
  forbiddenOutputPatterns: string[];
  safetyContract: {
    noDiagnosis: true;
    noLegalAdvice: true;
    noEliasMemory: true;
    noForcedDecision: true;
    noRescueAdvice: true;
  };
}
