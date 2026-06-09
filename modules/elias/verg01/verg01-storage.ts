/**
 * VERG01 — Self-Forgiveness After Relapse (Elias only)
 * STORAGE: Builds storage patch and merges progress
 */
import type { VERG01RuntimeInput, VERG01DetectionResult, VERG01StoragePatch, VERG01StorageState } from './verg01-types';
import { createDefaultVERG01Storage } from './verg01-types';

export function buildVERG01StoragePatch(
  input: VERG01RuntimeInput,
  result: VERG01DetectionResult,
): Partial<VERG01StoragePatch> {
  if (result.activationStatus !== 'ACTIVE') return {};

  return {
    lastActivatedModuleId: 'VERG01',
    lastActivatedAt: input.timestampIso,
    confidenceScore: result.confidenceScore,
    matchedMarkers: result.matchedMarkers,
    selectedResponseMode: result.responseMode,
    forgivenessLanguageDetected: input.context.forgivenessLanguage,
    relapseLinkedGuilt: input.context.relapseLinkedGuilt,
    selfPunishmentLoop: input.context.selfPunishmentLoop,
    repairReadiness: input.context.repairReadiness,
    shameIntensity: input.context.shameIntensity,
    guiltIntensity: input.context.guiltIntensity,
  };
}

export function updateVERG01Progress(
  current: VERG01StorageState | undefined,
  patch: Partial<VERG01StoragePatch>,
): VERG01StorageState {
  const state = current ?? createDefaultVERG01Storage();
  if (!patch.lastActivatedAt) return state;

  return {
    ...state,
    activationCount: state.activationCount + 1,
    lastActivatedAt: patch.lastActivatedAt,
    lastResponseMode: patch.selectedResponseMode ?? state.lastResponseMode,
    selfPunishmentLoopCount: state.selfPunishmentLoopCount + (patch.selfPunishmentLoop ? 1 : 0),
    repairAttemptCount: state.repairAttemptCount + ((patch.repairReadiness ?? 0) >= 0.65 ? 1 : 0),
  };
}
