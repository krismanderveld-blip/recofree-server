/**
 * KST01 — Stoicism for Caregivers (Kim only)
 * TYPE DEFINITIONS
 */

export type KimModuleRouteTarget =
  | 'K06_CAREGIVER_CANON'
  | 'KST01_STOICISM_FOR_CAREGIVERS'
  | 'KDL01_DETACHMENT_WITH_LOVE'
  | 'KBR01_BOUNDARY_RESTORATION'
  | 'KSC01_SELF_COMPASSION_CAREGIVER'
  | 'K06_STABILIZATION'
  | 'K06_SAFETY'
  | 'NO_MODULE';

export type KST01RouteLabel =
  | 'CONNECTED_NOT_CONSUMED_TO_KDL01'
  | 'BOUNDARY_PLANNING_TO_KBR01'
  | 'CAREGIVER_SHAME_TO_KSC01'
  | 'SAFETY_EXIT_TO_K06'
  | 'CONTINUE_KIM_PIPELINE';

export type KST01Principle =
  | 'DICHOTOMY_OF_CONTROL'
  | 'AMOR_FATI'
  | 'SYMPATHEIA'
  | 'APATHEIA'
  | 'MEMENTO_MORI';

export type KST01TriggerType =
  | 'CONTROL_LOOP_CAREGIVER'
  | 'OVER_RESPONSIBILITY'
  | 'SELF_LOSS_THROUGH_CARE'
  | 'PHILOSOPHY_REQUEST'
  | 'MEANING_AFTER_RELAPSE'
  | 'BOUNDARY_LOVE_CONFLICT'
  | 'LIFE_ON_HOLD'
  | 'EMOTIONAL_FUSION'
  | 'NONE';

export type KST01ResponseMode =
  | 'CONTROL_SEPARATOR'
  | 'ACCEPTANCE_WITHOUT_APPROVAL'
  | 'SELF_CONNECTION_RESTORE'
  | 'STEADINESS_WITH_FEELING'
  | 'MEANING_AFTER_RELAPSE'
  | 'LIFE_IS_NOT_A_WAITING_ROOM'
  | 'CONNECTED_NOT_CONSUMED'
  | 'SAFETY_EXIT';

export type KST01ActivationStatus =
  | 'ACTIVE'
  | 'NOT_ACTIVE'
  | 'DEFERRED_TO_K06'
  | 'BLOCKED_BY_SAFETY'
  | 'BLOCKED_WRONG_USER_TYPE';

export type KST01ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface KST01DetectedMarker {
  markerId: string;
  triggerType: KST01TriggerType;
  matchedText?: string;
  source: 'latest_message' | 'recent_messages' | 'journal' | 'slider' | 'backpack' | 'intake';
  weight: number;
}

export interface KST01DetectionResult {
  activationStatus: KST01ActivationStatus;
  confidenceScore: number;
  confidenceLevel: KST01ConfidenceLevel;
  triggers: KST01TriggerType[];
  detectedMarkers: KST01DetectedMarker[];
  recommendedPrinciples: KST01Principle[];
  recommendedMode: KST01ResponseMode;
  safetyReason?: string;
}

export interface KST01RuntimeInputs {
  userType: 'elias' | 'kim';
  latestUserMessage: string;
  recentMessages?: string[];
  crisisLevel: number;
  k06SafetyGate: 'cleared' | 'partial_with_grounding' | 'blocked' | 'not_run';
  stabilizationStatus: 'stable' | 'partially_stable' | 'unstable' | 'unknown';
  caregiverFrustrationLevel?: number;
  emotionalOverloadLevel?: number;
  selfLossLevel?: number;
  controlLoopLevel?: number;
  boundaryReadinessLevel?: number;
  recentRelapseOfLovedOne?: boolean;
  explicitStoicismRequest?: boolean;
}

export interface KST01PromptPayload {
  moduleId: 'KST01';
  active: boolean;
  responseMode: KST01ResponseMode;
  principles: KST01Principle[];
  triggerSummary: string;
  userControlFocus: string[];
  notUserControlFocus: string[];
  forbiddenPhrases: string[];
  tone: 'warm_steady_gently_firm';
  safetyGate: 'clear' | 'exit_to_safety';
  compactPromptBlock: string;
}

export interface KST01StorageState {
  kst01Activated: boolean;
  lastActivatedAt?: string;
  activationCount: number;
  dominantTrigger?: KST01TriggerType;
  dominantPrinciple?: KST01Principle;
  controlLoopLevelHistory: number[];
  selfLossLevelHistory: number[];
  emotionalFusionLevelHistory: number[];
  mementoMoriUsedCount: number;
  safetyExitCount: number;
}

export interface KST01OutputContract {
  detection: KST01DetectionResult;
  promptPayload: KST01PromptPayload | null;
  storagePatch: Partial<KST01StorageState>;
  routeNext: KimModuleRouteTarget;
}

export function createDefaultKST01Storage(): KST01StorageState {
  return {
    kst01Activated: false,
    activationCount: 0,
    controlLoopLevelHistory: [],
    selfLossLevelHistory: [],
    emotionalFusionLevelHistory: [],
    mementoMoriUsedCount: 0,
    safetyExitCount: 0,
  };
}
