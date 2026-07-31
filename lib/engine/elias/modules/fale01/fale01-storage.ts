/**
 * FALE01 — Two-Stage Failure Response After Relapse (Elias only)
 * STORAGE: Builds storage patch and merges progress
 */
import type { FALE01RuntimeInput, FALE01DetectionResult, FALE01StoragePatch, FALE01StorageState } from './fale01-types';
import { createDefaultFALE01Storage } from './fale01-types';

export function buildFALE01StoragePatch(
  input: FALE01RuntimeInput,
  result: FALE01DetectionResult,
): Partial<FALE01StoragePatch> {
  if (result.activationStatus !== 'ACTIVE') return {};

  return {
    lastActivatedModuleId: 'FALE01',
    lastActivatedAt: input.timestampIso,
    confidenceScore: result.confidenceScore,
    matchedMarkers: result.matchedMarkers,
    selectedResponseMode: result.responseMode,
    relapseConfirmed: input.context.relapseConfirmed,
    selectedStage: input.context.stage,
    shameIntensity: input.context.shameIntensity,
    continuationRisk: input.context.continuationRisk,
    chainAnalysisAllowed: input.context.stage === 'STAGE_2_ANALYSIS',
  };
}

export function updateFALE01Progress(
  current: FALE01StorageState | undefined,
  patch: Partial<FALE01StoragePatch>,
): FALE01StorageState {
  const state = current ?? createDefaultFALE01Storage();
  if (!patch.lastActivatedAt) return state;

  return {
    ...state,
    activationCount: state.activationCount + 1,
    lastActivatedAt: patch.lastActivatedAt,
    lastResponseMode: patch.selectedResponseMode ?? state.lastResponseMode,
    relapseConfirmedCount: state.relapseConfirmedCount + (patch.relapseConfirmed ? 1 : 0),
    stage2ReachedCount: state.stage2ReachedCount + (patch.chainAnalysisAllowed ? 1 : 0),
  };
}
