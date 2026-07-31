/**
 * KBR01 — Boundary Restoration (Kim only)
 * TYPE DEFINITIONS
 */

import type { KimModuleRouteTarget } from '../kst01/kst01-types';

export type KBR01TriggerType =
  | 'BOUNDARY_WORDING_REQUEST'
  | 'BOUNDARY_PLANNING_REQUEST'
  | 'CONSEQUENCE_CLARITY'
  | 'BOUNDARY_COLLAPSE'
  | 'OVER_EXPLAINING_LOOP'
  | 'SAFETY_BOUNDARY'
  | 'PUNITIVE_INTENT'
  | 'NONE';

export type KBR01ResponseMode =
  | 'SCRIPT_BUILDER'
  | 'BOUNDARY_CLARIFIER'
  | 'CONSEQUENCE_CHECK'
  | 'OVER_EXPLAINING_STOP'
  | 'FOLLOW_THROUGH_REPAIR'
  | 'SAFETY_BOUNDARY'
  | 'PUNITIVE_REDIRECT'
  | 'SAFETY_EXIT';

export type KBR01ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'DEFERRED_TO_KDL01'
  | 'DEFERRED_TO_KSC01'
  | 'BLOCKED_BY_SAFETY'
  | 'BLOCKED_WRONG_USER_TYPE';

export type KBR01ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface KBR01DetectedMarker {
  markerId: string;
  triggerType: KBR01TriggerType;
  matchedText?: string;
  source: 'latest_message' | 'recent_messages' | 'journal' | 'slider' | 'backpack' | 'kdl01' | 'kst01' | 'k06';
  weight: number;
}

export interface KBR01DetectionResult {
  activationStatus: KBR01ActivationStatus;
  confidenceScore: number;
  confidenceLevel: KBR01ConfidenceLevel;
  triggers: KBR01TriggerType[];
  detectedMarkers: KBR01DetectedMarker[];
  recommendedMode: KBR01ResponseMode;
  routeNext: KimModuleRouteTarget;
  safetyReason?: string;
}

export interface KBR01RuntimeInputs {
  userType: 'elias' | 'kim';
  latestUserMessage: string;
  recentMessages?: string[];
  crisisLevel: number;
  k06SafetyGate: 'cleared' | 'partial_with_grounding' | 'blocked' | 'not_run';
  stabilizationStatus: 'stable' | 'partially_stable' | 'unstable' | 'unknown';
  boundaryReadinessLevel?: number;
  caregiverShameLevel?: number;
  selfLossLevel?: number;
  exactWordingRequested?: boolean;
  routedFromKDL01?: boolean;
  routedFromKST01?: boolean;
  safetyBoundaryConcern?: boolean;
}

export interface KBR01PromptPayload {
  moduleId: 'KBR01';
  active: boolean;
  responseMode: KBR01ResponseMode;
  triggerSummary: string;
  boundaryStructure: ['CARE_OR_CONTEXT', 'OBSERVABLE_CONDITION', 'USER_LIMIT', 'USER_ACTION', 'SAFE_RECONNECTION_PATH'];
  forbiddenPhrases: string[];
  tone: 'warm_clear_firm_practical';
  routeNext: KimModuleRouteTarget;
  compactPromptBlock: string;
}

export interface KBR01StorageState {
  kbr01Activated: boolean;
  lastActivatedAt?: string;
  activationCount: number;
  dominantTrigger?: KBR01TriggerType;
  dominantMode?: KBR01ResponseMode;
  boundaryReadinessHistory: number[];
  boundaryCollapseCount: number;
  scriptBuilderCount: number;
  safetyExitCount: number;
}

export interface KBR01OutputContract {
  detection: KBR01DetectionResult;
  promptPayload: KBR01PromptPayload | null;
  storagePatch: Partial<KBR01StorageState>;
  routeNext: KimModuleRouteTarget;
}

export function createDefaultKBR01Storage(): KBR01StorageState {
  return {
    kbr01Activated: false,
    activationCount: 0,
    boundaryReadinessHistory: [],
    boundaryCollapseCount: 0,
    scriptBuilderCount: 0,
    safetyExitCount: 0,
  };
}
