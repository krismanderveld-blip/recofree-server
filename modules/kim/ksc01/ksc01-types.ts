/**
 * KSC01 — Self-Compassion for Caregivers (Kim only)
 * TYPE DEFINITIONS
 */

import type { KimModuleRouteTarget } from '../kst01/kst01-types';

export type KSC01TriggerType =
  | 'CAREGIVER_SHAME'
  | 'RELAPSE_SELF_BLAME'
  | 'BOUNDARY_GUILT'
  | 'ANGER_SHAME'
  | 'REST_GUILT'
  | 'GOOD_CAREGIVER_MYTH'
  | 'COMPASSION_REQUEST'
  | 'NONE';

export type KSC01ResponseMode =
  | 'SHAME_SOFTENING'
  | 'GUILT_REALITY_CHECK'
  | 'RELAPSE_NOT_MY_FAILURE'
  | 'ANGER_PERMISSION'
  | 'REST_PERMISSION'
  | 'GOOD_CAREGIVER_MYTH_REPAIR'
  | 'COMPASSION_TO_BOUNDARY'
  | 'COMPASSION_TO_DETACHMENT'
  | 'SAFETY_EXIT';

export type KSC01ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'DEFERRED_TO_KBR01'
  | 'DEFERRED_TO_KDL01'
  | 'BLOCKED_BY_SAFETY'
  | 'BLOCKED_WRONG_USER_TYPE';

export type KSC01ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface KSC01DetectedMarker {
  markerId: string;
  triggerType: KSC01TriggerType;
  matchedText?: string;
  source: 'latest_message' | 'recent_messages' | 'journal' | 'slider' | 'backpack' | 'kdl01' | 'kbr01' | 'kst01' | 'k06';
  weight: number;
}

export interface KSC01DetectionResult {
  activationStatus: KSC01ActivationStatus;
  confidenceScore: number;
  confidenceLevel: KSC01ConfidenceLevel;
  triggers: KSC01TriggerType[];
  detectedMarkers: KSC01DetectedMarker[];
  recommendedMode: KSC01ResponseMode;
  routeNext: KimModuleRouteTarget;
  safetyReason?: string;
}

export interface KSC01RuntimeInputs {
  userType: 'elias' | 'kim';
  latestUserMessage: string;
  recentMessages?: string[];
  crisisLevel: number;
  k06SafetyGate: 'cleared' | 'partial_with_grounding' | 'blocked' | 'not_run';
  stabilizationStatus: 'stable' | 'partially_stable' | 'unstable' | 'unknown';
  caregiverShameLevel?: number;
  guiltLevel?: number;
  boundaryReadinessLevel?: number;
  selfLossLevel?: number;
  angerShameLevel?: number;
  restGuiltLevel?: number;
  recentRelapseOfLovedOne?: boolean;
  routedFromKDL01?: boolean;
  routedFromKBR01?: boolean;
  routedFromKST01?: boolean;
}

export interface KSC01PromptPayload {
  moduleId: 'KSC01';
  active: boolean;
  responseMode: KSC01ResponseMode;
  triggerSummary: string;
  coreFrame: 'grounded_accountable_self_compassion';
  forbiddenPhrases: string[];
  tone: 'warm_precise_grounded_shame_sensitive';
  routeNext: KimModuleRouteTarget;
  compactPromptBlock: string;
}

export interface KSC01StorageState {
  ksc01Activated: boolean;
  lastActivatedAt?: string;
  activationCount: number;
  dominantTrigger?: KSC01TriggerType;
  dominantMode?: KSC01ResponseMode;
  caregiverShameHistory: number[];
  guiltLevelHistory: number[];
  relapseSelfBlameCount: number;
  boundaryGuiltCount: number;
  safetyExitCount: number;
}

export interface KSC01OutputContract {
  detection: KSC01DetectionResult;
  promptPayload: KSC01PromptPayload | null;
  storagePatch: Partial<KSC01StorageState>;
  routeNext: KimModuleRouteTarget;
}

export function createDefaultKSC01Storage(): KSC01StorageState {
  return {
    ksc01Activated: false,
    activationCount: 0,
    caregiverShameHistory: [],
    guiltLevelHistory: [],
    relapseSelfBlameCount: 0,
    boundaryGuiltCount: 0,
    safetyExitCount: 0,
  };
}
