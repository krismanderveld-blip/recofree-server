/**
 * KBR01 — Boundary Restoration (Kim only)
 * STORAGE
 */

import type { KBR01DetectionResult, KBR01StorageState } from './kbr01-types';

export function buildKBR01StoragePatch(
  detection: KBR01DetectionResult,
  previousState?: KBR01StorageState,
): Partial<KBR01StorageState> {
  if (detection.activationStatus !== 'ACTIVE') return {};

  const prev = previousState || { kbr01Activated: false, activationCount: 0, boundaryReadinessHistory: [], boundaryCollapseCount: 0, scriptBuilderCount: 0, safetyExitCount: 0 };

  return {
    kbr01Activated: true,
    lastActivatedAt: new Date().toISOString(),
    activationCount: prev.activationCount + 1,
    dominantTrigger: detection.triggers.find(t => t !== 'NONE') || 'NONE',
    dominantMode: detection.recommendedMode,
    boundaryCollapseCount: detection.triggers.includes('BOUNDARY_COLLAPSE')
      ? prev.boundaryCollapseCount + 1
      : prev.boundaryCollapseCount,
    scriptBuilderCount: detection.recommendedMode === 'SCRIPT_BUILDER'
      ? prev.scriptBuilderCount + 1
      : prev.scriptBuilderCount,
    safetyExitCount: detection.recommendedMode === 'SAFETY_EXIT'
      ? prev.safetyExitCount + 1
      : prev.safetyExitCount,
  };
}

export function updateKBR01Progress(
  currentStorage: KBR01StorageState | undefined,
  patch: Partial<KBR01StorageState>,
): KBR01StorageState {
  const base: KBR01StorageState = currentStorage || {
    kbr01Activated: false,
    activationCount: 0,
    boundaryReadinessHistory: [],
    boundaryCollapseCount: 0,
    scriptBuilderCount: 0,
    safetyExitCount: 0,
  };
  return { ...base, ...patch };
}
