/**
 * KDL01 — Detachment with Love (Kim only)
 * TYPE DEFINITIONS
 */

import type { KimModuleRouteTarget } from '../kst01/kst01-types';

export type KDL01TriggerType =
  | 'BOUNDARY_LOVE_CONFLICT'
  | 'SELF_LOSS_THROUGH_LOVE'
  | 'RESCUE_FUSION'
  | 'CONSEQUENCE_GUILT'
  | 'DETACHMENT_REQUEST'
  | 'ABANDONMENT_FEAR'
  | 'RELATIONAL_EXHAUSTION'
  | 'NONE';

export type KDL01ResponseMode =
  | 'LOVE_WITHOUT_SELF_ERASURE'
  | 'DETACHMENT_NOT_ABANDONMENT'
  | 'CONSEQUENCE_WITHOUT_CRUELTY'
  | 'RESCUE_LOOP_INTERRUPT'
  | 'BOUNDARY_BRIDGE'
  | 'GUILT_SOFTENING'
  | 'SAFETY_EXIT';

export type KDL01ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'DEFERRED_TO_KBR01'
  | 'DEFERRED_TO_KSC01'
  | 'BLOCKED_BY_SAFETY'
  | 'BLOCKED_WRONG_USER_TYPE';

export type KDL01ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface KDL01DetectedMarker {
  markerId: string;
  triggerType: KDL01TriggerType;
  matchedText?: string;
  source: 'latest_message' | 'recent_messages' | 'journal' | 'slider' | 'backpack' | 'kst01' | 'k06';
  weight: number;
}

export interface KDL01DetectionResult {
  activationStatus: KDL01ActivationStatus;
  confidenceScore: number;
  confidenceLevel: KDL01ConfidenceLevel;
  triggers: KDL01TriggerType[];
  detectedMarkers: KDL01DetectedMarker[];
  recommendedMode: KDL01ResponseMode;
  routeNext: KimModuleRouteTarget;
  safetyReason?: string;
}

export interface KDL01RuntimeInputs {
  userType: 'elias' | 'kim';
  latestUserMessage: string;
  recentMessages?: string[];
  crisisLevel: number;
  k06SafetyGate: 'cleared' | 'partial_with_grounding' | 'blocked' | 'not_run';
  stabilizationStatus: 'stable' | 'partially_stable' | 'unstable' | 'unknown';
  selfLossLevel?: number;
  rescueLoopLevel?: number;
  boundaryReadinessLevel?: number;
  caregiverShameLevel?: number;
  explicitDetachmentRequest?: boolean;
  routedFromKST01?: boolean;
}

export interface KDL01PromptPayload {
  moduleId: 'KDL01';
  active: boolean;
  responseMode: KDL01ResponseMode;
  triggerSummary: string;
  coreFrame: 'love_without_self_erasure';
  forbiddenPhrases: string[];
  tone: 'warm_steady_grounded_gently_firm';
  routeNext: KimModuleRouteTarget;
  compactPromptBlock: string;
}

export interface KDL01StorageState {
  kdl01Activated: boolean;
  lastActivatedAt?: string;
  activationCount: number;
  dominantTrigger?: KDL01TriggerType;
  dominantMode?: KDL01ResponseMode;
  selfLossLevelHistory: number[];
  rescueLoopLevelHistory: number[];
  boundaryLoveConflictCount: number;
  safetyExitCount: number;
}

export interface KDL01OutputContract {
  detection: KDL01DetectionResult;
  promptPayload: KDL01PromptPayload | null;
  storagePatch: Partial<KDL01StorageState>;
  routeNext: KimModuleRouteTarget;
}

export function createDefaultKDL01Storage(): KDL01StorageState {
  return {
    kdl01Activated: false,
    activationCount: 0,
    selfLossLevelHistory: [],
    rescueLoopLevelHistory: [],
    boundaryLoveConflictCount: 0,
    safetyExitCount: 0,
  };
}
