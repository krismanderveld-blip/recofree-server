/**
 * ROUW01 — Grief/Loss Through Addiction (Elias only)
 * STORAGE: Builds storage patch and merges progress
 */
import type { ROUW01RuntimeInput, ROUW01DetectionResult, ROUW01StoragePatch, ROUW01StorageState } from './rouw01-types';
import { createDefaultROUW01Storage } from './rouw01-types';

export function buildROUW01StoragePatch(
  input: ROUW01RuntimeInput,
  result: ROUW01DetectionResult,
): Partial<ROUW01StoragePatch> {
  if (result.activationStatus !== 'ACTIVE') return {};

  return {
    lastActivatedModuleId: 'ROUW01',
    lastActivatedAt: input.timestampIso,
    confidenceScore: result.confidenceScore,
    matchedMarkers: result.matchedMarkers,
    selectedResponseMode: result.responseMode,
    lossDomains: input.context.lossDomains,
    griefIntensity: input.context.griefIntensity,
    cravingLinkedToGrief: input.context.cravingLinkedToGrief,
  };
}

export function updateROUW01Progress(
  current: ROUW01StorageState | undefined,
  patch: Partial<ROUW01StoragePatch>,
): ROUW01StorageState {
  const state = current ?? createDefaultROUW01Storage();
  if (!patch.lastActivatedAt) return state;

  return {
    ...state,
    activationCount: state.activationCount + 1,
    lastActivatedAt: patch.lastActivatedAt,
    lastResponseMode: patch.selectedResponseMode ?? state.lastResponseMode,
    cravingLinkedGriefCount: state.cravingLinkedGriefCount + (patch.cravingLinkedToGrief ? 1 : 0),
    griefActionCount: state.griefActionCount + (patch.selectedResponseMode === 'ONE_GRIEF_CARRYING_ACTION' ? 1 : 0),
  };
}
