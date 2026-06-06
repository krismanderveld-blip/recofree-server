/**
 * KSC01 — Self-Compassion for Caregivers (Kim only)
 * STORAGE
 */

import type { KSC01DetectionResult, KSC01StorageState } from './ksc01-types';

export function buildKSC01StoragePatch(
  detection: KSC01DetectionResult,
  previousState?: KSC01StorageState,
): Partial<KSC01StorageState> {
  if (detection.activationStatus !== 'ACTIVE') return {};

  const prev = previousState || { ksc01Activated: false, activationCount: 0, caregiverShameHistory: [], guiltLevelHistory: [], relapseSelfBlameCount: 0, boundaryGuiltCount: 0, safetyExitCount: 0 };

  return {
    ksc01Activated: true,
    lastActivatedAt: new Date().toISOString(),
    activationCount: prev.activationCount + 1,
    dominantTrigger: detection.triggers.find(t => t !== 'NONE') || 'NONE',
    dominantMode: detection.recommendedMode,
    relapseSelfBlameCount: detection.triggers.includes('RELAPSE_SELF_BLAME')
      ? prev.relapseSelfBlameCount + 1
      : prev.relapseSelfBlameCount,
    boundaryGuiltCount: detection.triggers.includes('BOUNDARY_GUILT')
      ? prev.boundaryGuiltCount + 1
      : prev.boundaryGuiltCount,
    safetyExitCount: detection.recommendedMode === 'SAFETY_EXIT'
      ? prev.safetyExitCount + 1
      : prev.safetyExitCount,
  };
}

export function updateKSC01Progress(
  currentStorage: KSC01StorageState | undefined,
  patch: Partial<KSC01StorageState>,
): KSC01StorageState {
  const base: KSC01StorageState = currentStorage || {
    ksc01Activated: false,
    activationCount: 0,
    caregiverShameHistory: [],
    guiltLevelHistory: [],
    relapseSelfBlameCount: 0,
    boundaryGuiltCount: 0,
    safetyExitCount: 0,
  };
  return { ...base, ...patch };
}
