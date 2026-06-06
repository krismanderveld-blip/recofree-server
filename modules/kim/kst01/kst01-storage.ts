/**
 * KST01 — Stoicism for Caregivers (Kim only)
 * STORAGE: Builds storage patches for user.dat persistence
 */

import type { KST01DetectionResult, KST01StorageState } from './kst01-types';

export function buildKST01StoragePatch(
  detection: KST01DetectionResult,
  previousState?: KST01StorageState,
): Partial<KST01StorageState> {
  if (detection.activationStatus !== 'ACTIVE') {
    return {};
  }

  const previousActivationCount = previousState?.activationCount || 0;
  const dominantTrigger = detection.triggers.find(t => t !== 'NONE') || 'NONE';
  const dominantPrinciple = detection.recommendedPrinciples[0];

  return {
    kst01Activated: true,
    lastActivatedAt: new Date().toISOString(),
    activationCount: previousActivationCount + 1,
    dominantTrigger,
    dominantPrinciple,
    mementoMoriUsedCount:
      dominantPrinciple === 'MEMENTO_MORI'
        ? (previousState?.mementoMoriUsedCount || 0) + 1
        : previousState?.mementoMoriUsedCount || 0,
    safetyExitCount:
      detection.recommendedMode === 'SAFETY_EXIT'
        ? (previousState?.safetyExitCount || 0) + 1
        : previousState?.safetyExitCount || 0,
  };
}

export function updateKST01Progress(
  currentStorage: KST01StorageState | undefined,
  patch: Partial<KST01StorageState>,
): KST01StorageState {
  const base: KST01StorageState = currentStorage || {
    kst01Activated: false,
    activationCount: 0,
    controlLoopLevelHistory: [],
    selfLossLevelHistory: [],
    emotionalFusionLevelHistory: [],
    mementoMoriUsedCount: 0,
    safetyExitCount: 0,
  };

  return { ...base, ...patch };
}
