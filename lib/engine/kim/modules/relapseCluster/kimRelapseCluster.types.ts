/**
 * Kim Relapse Cluster Types
 * Modules: HERV-K01, NAHERV-K01, CRISIS-K01
 * 
 * CORRECTED CRISIS NUMBERS — aligned with app-wide crisis footer:
 * - 1813 (Zelfmoordlijn, 24/7 gratis anoniem)
 * - 1712 (huiselijk geweld, misbruik, kindermishandeling)
 * - 112 (noodgevallen / levensbedreigend / ambulance)
 * - 101 (dringende politiehulp)
 */

export type KimRelapseClusterModuleId =
  | 'HERV-K01'
  | 'NAHERV-K01'
  | 'CRISIS-K01';

export type KimRelapseClusterPersona = 'kim';

export type KimRelapseClusterLanguage =
  | 'nl'
  | 'en'
  | 'fr'
  | 'mixed'
  | 'unknown';

export type KimRelapseEventPhase =
  | 'ACTIVE_RELAPSE_NOW'
  | 'POST_RELAPSE_AFTERSHOCK'
  | 'ACUTE_UNCERTAINTY_OR_DANGER'
  | 'NOT_RELAPSE_RELATED';

export type KimRelapseSubstanceContext =
  | 'alcohol'
  | 'drugs'
  | 'medication_misuse'
  | 'gambling'
  | 'unknown_addiction_context';

export type KimCaregiverState =
  | 'regulated'
  | 'distressed'
  | 'overwhelmed'
  | 'panicked'
  | 'numb'
  | 'angry'
  | 'unsafe'
  | 'unknown';

export type KimSafetyRiskLevel =
  | 'NONE'
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'IMMEDIATE';

/**
 * Crisis escalation routes — CORRECTED per app-wide crisis footer.
 * Suicide support = CALL_1813.
 * Added CALL_101 for urgent police help.
 */
export type KimCrisisEscalationRoute =
  | 'NONE'
  | 'K06_STABILISATION'
  | 'CRISIS_K01'
  | 'CALL_112'
  | 'CALL_101'
  | 'CALL_1813'
  | 'CONTACT_1712'
  | 'CONTACT_LOCAL_DOCTOR_OR_ON_CALL_DOCTOR'
  | 'CONTACT_PROFESSIONAL_SUPPORT';

export type KimRelapseMarkerType =
  | 'active_use'
  | 'imminent_use'
  | 'post_relapse'
  | 'caregiver_overwhelm'
  | 'disappearance'
  | 'acute_danger'
  | 'violence'
  | 'suicide_self_harm'
  | 'medical_emergency'
  | 'boundary_rescue_pressure'
  | 'aftercare_conversation'
  | 'unknown';

export interface KimRelapseClusterDetectedMarker {
  markerId: string;
  moduleCandidate: KimRelapseClusterModuleId;
  phrase: string;
  language: KimRelapseClusterLanguage;
  confidence: number;
  markerType: KimRelapseMarkerType;
}

export interface KimRelapseClusterRuntimeInput {
  persona: KimRelapseClusterPersona | string;
  language: KimRelapseClusterLanguage;
  userMessage: string;
  normalizedMessage: string;
  timestampIso: string;
  sessionId: string;
  turnId: string;
  storePolicy: 'store:false';
  detectedMarkers: KimRelapseClusterDetectedMarker[];
  caregiverState: KimCaregiverState;
  safetyRiskLevel: KimSafetyRiskLevel;
  vspZone?: 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS' | 'UNKNOWN';
  explicitAcuteDanger: boolean;
  explicitSelfHarmRiskLovedOne: boolean;
  explicitSelfHarmRiskCaregiver: boolean;
  explicitViolenceRisk: boolean;
  explicitMedicalEmergency: boolean;
  explicitDisappearance: boolean;
  explicitImpairedDrivingRisk: boolean;
  explicitChildSafetyRisk: boolean;
  relationshipToLovedOne?:
    | 'partner'
    | 'parent'
    | 'child'
    | 'sibling'
    | 'friend'
    | 'other'
    | 'unknown';
}

export type KimRelapseClusterRouteNext =
  | 'CRISIS-K01'
  | 'HERV-K01'
  | 'NAHERV-K01'
  | 'K06'
  | 'KDL01'
  | 'KBR01'
  | 'KSC01'
  | 'KST01'
  | 'NO_MODULE';

export interface KimRelapseClusterDetectionResult {
  selectedModuleId: KimRelapseClusterModuleId | null;
  phase: KimRelapseEventPhase;
  confidence: number;
  safetyRiskLevel: KimSafetyRiskLevel;
  crisisEscalationRoute: KimCrisisEscalationRoute;
  matchedMarkers: KimRelapseClusterDetectedMarker[];
  routeNext: KimRelapseClusterRouteNext;
  reason: string;
}

export interface KimRelapseClusterPromptPayload {
  moduleId: KimRelapseClusterModuleId;
  persona: 'kim';
  storePolicy: 'store:false';
  language: KimRelapseClusterLanguage;
  therapeuticTone: string;
  crisisEscalationRoute: KimCrisisEscalationRoute;
  responseRules: string[];
  forbiddenOutput: string[];
  belgianCrisisNumbers: BelgianCrisisNumbers;
  gptInstruction: string;
}

/**
 * Belgian crisis numbers — CORRECTED.
 * Uses 1813 as the single suicide prevention number (matches app footer).
 * NO 1813.
 */
export interface BelgianCrisisNumbers {
  emergency112: '112';
  urgentPolice101: '101';
  suicideLine1813: '1813';
  violenceAbuse1712: '1712';
}

export const BELGIAN_CRISIS_NUMBERS: BelgianCrisisNumbers = {
  emergency112: '112',
  urgentPolice101: '101',
  suicideLine1813: '1813',
  violenceAbuse1712: '1712',
};

export interface KimRelapseClusterMemoryPatch {
  persona: 'kim';
  moduleId: KimRelapseClusterModuleId;
  storePolicy: 'local_only';
  userDatPatch?: {
    triggerPatterns?: KimTriggerPatternPatch[];
    moduleUsage?: KimModuleUsagePatch;
  };
  projectionsDatPatch?: {
    fears?: KimProjectionFearPatch[];
    hopes?: KimProjectionHopePatch[];
  };
  stateDatPatch?: {
    caregiverState?: KimCaregiverState;
    lastRelapseRelatedModule?: KimRelapseClusterModuleId;
    safetyRiskLevel?: KimSafetyRiskLevel;
  };
  logsDatPatch?: {
    eventType: 'KIM_RELAPSE_CLUSTER_EVENT';
    selectedModuleId: KimRelapseClusterModuleId;
    phase: KimRelapseEventPhase;
    safetyRiskLevel: KimSafetyRiskLevel;
    crisisEscalationRoute: KimCrisisEscalationRoute;
    timestampIso: string;
  };
}

export interface KimTriggerPatternPatch {
  normalizedTrigger: string;
  label: string;
  triggerType:
    | 'loved_one_active_use'
    | 'loved_one_imminent_use'
    | 'loved_one_disappearance'
    | 'post_relapse_conversation'
    | 'caregiver_rescue_pressure'
    | 'caregiver_overwhelm'
    | 'safety_threat';
  incrementFrequency: true;
  lastSeenAt: string;
}

export interface KimProjectionFearPatch {
  normalizedLabel: string;
  label: string;
  category:
    | 'fear_loved_one_relapse'
    | 'fear_loved_one_death_or_overdose'
    | 'fear_loved_one_disappears'
    | 'fear_of_conflict'
    | 'fear_of_setting_boundaries'
    | 'fear_of_abandoning_loved_one'
    | 'fear_for_own_safety';
  decayScoreInput: number;
  lastReinforcedAt: string;
}

export interface KimProjectionHopePatch {
  normalizedLabel: string;
  label: string;
  category:
    | 'hope_loved_one_returns_safe'
    | 'hope_for_calm_conversation'
    | 'hope_for_boundary_clarity'
    | 'hope_for_own_regulation';
  decayScoreInput: number;
  lastReinforcedAt: string;
}

export interface KimModuleUsagePatch {
  moduleId: KimRelapseClusterModuleId;
  incrementUsage: true;
  lastUsedAt: string;
}
