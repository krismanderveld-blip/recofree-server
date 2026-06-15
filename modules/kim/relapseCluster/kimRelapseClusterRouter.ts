/**
 * Kim Relapse Cluster Router
 * Orchestrates detection → escalation gate → memory patch → prompt payload selection.
 * Priority: CRISIS-K01 > HERV-K01 > NAHERV-K01
 */
import type {
  KimRelapseClusterRuntimeInput,
  KimRelapseClusterDetectionResult,
  KimRelapseClusterMemoryPatch,
  KimRelapseClusterPromptPayload,
  KimRelapseClusterLanguage,
  KimCaregiverState,
  KimSafetyRiskLevel,
} from './kimRelapseCluster.types';
import { detectKimRelapseClusterModule, scanMarkers } from './kimRelapseClusterDetector';
import { buildKimRelapseClusterMemoryPatch } from './kimRelapseClusterMemoryPatch';
import { buildHervK01Payload } from './HERV-K01/hervK01Payload';
import { buildNahervK01Payload } from './NAHERV-K01/nahervK01Payload';
import { buildCrisisK01Payload } from './CRISIS-K01/crisisK01Payload';

export interface KimRelapseClusterRouterOutput {
  detection: KimRelapseClusterDetectionResult;
  memoryPatch: KimRelapseClusterMemoryPatch | null;
  promptPayload: KimRelapseClusterPromptPayload | null;
  shouldActivate: boolean;
}

/**
 * Build a normalized runtime input from raw pipeline data.
 */
export function buildRuntimeInput(params: {
  persona: string;
  language: KimRelapseClusterLanguage;
  userMessage: string;
  sessionId: string;
  turnId: string;
  caregiverState?: KimCaregiverState;
  safetyRiskLevel?: KimSafetyRiskLevel;
  vspZone?: string;
  explicitFlags?: Partial<Pick<KimRelapseClusterRuntimeInput,
    | 'explicitAcuteDanger'
    | 'explicitSelfHarmRiskLovedOne'
    | 'explicitSelfHarmRiskCaregiver'
    | 'explicitViolenceRisk'
    | 'explicitMedicalEmergency'
    | 'explicitDisappearance'
    | 'explicitImpairedDrivingRisk'
    | 'explicitChildSafetyRisk'
  >>;
  relationshipToLovedOne?: KimRelapseClusterRuntimeInput['relationshipToLovedOne'];
}): KimRelapseClusterRuntimeInput {
  const normalizedMessage = params.userMessage.toLowerCase().trim();
  const detectedMarkers = scanMarkers(normalizedMessage);

  return {
    persona: params.persona,
    language: params.language,
    userMessage: params.userMessage,
    normalizedMessage,
    timestampIso: new Date().toISOString(),
    sessionId: params.sessionId,
    turnId: params.turnId,
    storePolicy: 'store:false',
    detectedMarkers,
    caregiverState: params.caregiverState ?? 'unknown',
    safetyRiskLevel: params.safetyRiskLevel ?? 'NONE',
    vspZone: (params.vspZone as KimRelapseClusterRuntimeInput['vspZone']) ?? 'UNKNOWN',
    explicitAcuteDanger: params.explicitFlags?.explicitAcuteDanger ?? false,
    explicitSelfHarmRiskLovedOne: params.explicitFlags?.explicitSelfHarmRiskLovedOne ?? false,
    explicitSelfHarmRiskCaregiver: params.explicitFlags?.explicitSelfHarmRiskCaregiver ?? false,
    explicitViolenceRisk: params.explicitFlags?.explicitViolenceRisk ?? false,
    explicitMedicalEmergency: params.explicitFlags?.explicitMedicalEmergency ?? false,
    explicitDisappearance: params.explicitFlags?.explicitDisappearance ?? false,
    explicitImpairedDrivingRisk: params.explicitFlags?.explicitImpairedDrivingRisk ?? false,
    explicitChildSafetyRisk: params.explicitFlags?.explicitChildSafetyRisk ?? false,
    relationshipToLovedOne: params.relationshipToLovedOne,
  };
}

/**
 * Main router entry point.
 */
export function routeKimRelapseCluster(
  input: KimRelapseClusterRuntimeInput
): KimRelapseClusterRouterOutput {
  const detection = detectKimRelapseClusterModule(input);

  if (!detection.selectedModuleId) {
    return {
      detection,
      memoryPatch: null,
      promptPayload: null,
      shouldActivate: false,
    };
  }

  const memoryPatch = buildKimRelapseClusterMemoryPatch(detection, input.timestampIso);
  if (memoryPatch?.stateDatPatch) {
    memoryPatch.stateDatPatch.caregiverState = input.caregiverState;
  }

  let promptPayload: KimRelapseClusterPromptPayload | null = null;
  switch (detection.selectedModuleId) {
    case 'HERV-K01':
      promptPayload = buildHervK01Payload(detection, input);
      break;
    case 'NAHERV-K01':
      promptPayload = buildNahervK01Payload(detection, input);
      break;
    case 'CRISIS-K01':
      promptPayload = buildCrisisK01Payload(detection, input);
      break;
  }

  return {
    detection,
    memoryPatch,
    promptPayload,
    shouldActivate: true,
  };
}
