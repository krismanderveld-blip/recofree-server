/**
 * KDL01 — Detachment with Love (Kim only)
 * ROUTER: Determines output contract from detection result
 */

import type { KDL01DetectionResult, KDL01OutputContract, KDL01StorageState } from './kdl01-types';
import { buildKDL01PromptPayload } from './kdl01-prompt';
import { buildKDL01StoragePatch } from './kdl01-storage';

export function routeKDL01(
  detection: KDL01DetectionResult,
  previousStorage?: KDL01StorageState,
): KDL01OutputContract {
  const promptPayload = buildKDL01PromptPayload(detection);
  const storagePatch = buildKDL01StoragePatch(detection, previousStorage);

  return {
    detection,
    promptPayload,
    storagePatch,
    routeNext: detection.routeNext,
  };
}
