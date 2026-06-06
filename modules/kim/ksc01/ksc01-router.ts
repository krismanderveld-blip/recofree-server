/**
 * KSC01 — Self-Compassion for Caregivers (Kim only)
 * ROUTER
 */

import type { KSC01DetectionResult, KSC01OutputContract, KSC01StorageState } from './ksc01-types';
import { buildKSC01PromptPayload } from './ksc01-prompt';
import { buildKSC01StoragePatch } from './ksc01-storage';

export function routeKSC01(
  detection: KSC01DetectionResult,
  previousStorage?: KSC01StorageState,
): KSC01OutputContract {
  const promptPayload = buildKSC01PromptPayload(detection);
  const storagePatch = buildKSC01StoragePatch(detection, previousStorage);

  return {
    detection,
    promptPayload,
    storagePatch,
    routeNext: detection.routeNext,
  };
}
