/**
 * IDEN01 — Identity Rebuilding Outside Addiction (Elias only)
 * STORAGE: Builds storage patch and merges progress
 */
import type { IDEN01RuntimeInput, IDEN01DetectionResult, IDEN01StoragePatch, IDEN01StorageState } from './iden01-types';
import { createDefaultIDEN01Storage } from './iden01-types';

export function buildIDEN01StoragePatch(
  input: IDEN01RuntimeInput,
  result: IDEN01DetectionResult,
): Partial<IDEN01StoragePatch> {
  if (result.activationStatus !== 'ACTIVE') return {};

  return {
    lastActivatedModuleId: 'IDEN01',
    lastActivatedAt: input.timestampIso,
    confidenceScore: result.confidenceScore,
    matchedMarkers: result.matchedMarkers,
    selectedResponseMode: result.responseMode,
    identityFusionDetected: input.context.addictionIdentityFusion,
    relapseIdentityCollapse: input.context.relapseIdentityCollapse,
    roleFusion: input.context.roleFusion,
    backpackAnchorsUsed: input.context.backpackAnchorsAvailable,
    valuesReadiness: input.context.valuesReadiness,
  };
}

export function updateIDEN01Progress(
  current: IDEN01StorageState | undefined,
  patch: Partial<IDEN01StoragePatch>,
): IDEN01StorageState {
  const state = current ?? createDefaultIDEN01Storage();
  if (!patch.lastActivatedAt) return state;

  return {
    ...state,
    activationCount: state.activationCount + 1,
    lastActivatedAt: patch.lastActivatedAt,
    lastResponseMode: patch.selectedResponseMode ?? state.lastResponseMode,
    identityFusionCount: state.identityFusionCount + (patch.identityFusionDetected ? 1 : 0),
    valuesReconstructionCount: state.valuesReconstructionCount + (patch.selectedResponseMode === 'VALUES_FRAGMENT_RECONSTRUCTION' ? 1 : 0),
  };
}
