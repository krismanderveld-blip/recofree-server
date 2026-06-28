/**
 * KDL01 — Detachment with Love (Kim only)
 * STORAGE: Builds storage patches for user.dat persistence
 */

import type { KDL01DetectionResult, KDL01StorageState } from './kdl01-types';
import { LocalDeviceTimeService } from "@/lib/core/time";

export function buildKDL01StoragePatch(
  detection: KDL01DetectionResult,
  previousState?: KDL01StorageState,
): Partial<KDL01StorageState> {
  if (detection.activationStatus !== 'ACTIVE') return {};

  const prev = previousState || { kdl01Activated: false, activationCount: 0, selfLossLevelHistory: [], rescueLoopLevelHistory: [], boundaryLoveConflictCount: 0, safetyExitCount: 0 };

  return {
    kdl01Activated: true,
    lastActivatedAt: LocalDeviceTimeService.now().utcIso,
    activationCount: prev.activationCount + 1,
    dominantTrigger: detection.triggers.find(t => t !== 'NONE') || 'NONE',
    dominantMode: detection.recommendedMode,
    boundaryLoveConflictCount: detection.triggers.includes('BOUNDARY_LOVE_CONFLICT')
      ? prev.boundaryLoveConflictCount + 1
      : prev.boundaryLoveConflictCount,
    safetyExitCount: detection.recommendedMode === 'SAFETY_EXIT'
      ? prev.safetyExitCount + 1
      : prev.safetyExitCount,
  };
}

export function updateKDL01Progress(
  currentStorage: KDL01StorageState | undefined,
  patch: Partial<KDL01StorageState>,
): KDL01StorageState {
  const base: KDL01StorageState = currentStorage || {
    kdl01Activated: false,
    activationCount: 0,
    selfLossLevelHistory: [],
    rescueLoopLevelHistory: [],
    boundaryLoveConflictCount: 0,
    safetyExitCount: 0,
  };
  return { ...base, ...patch };
}
