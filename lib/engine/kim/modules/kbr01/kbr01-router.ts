/**
 * KBR01 — Boundary Restoration (Kim only)
 * ROUTER
 */

import type { KBR01DetectionResult, KBR01OutputContract, KBR01StorageState } from './kbr01-types';
import { buildKBR01PromptPayload } from './kbr01-prompt';
import { buildKBR01StoragePatch } from './kbr01-storage';

export function routeKBR01(
  detection: KBR01DetectionResult,
  previousStorage?: KBR01StorageState,
): KBR01OutputContract {
  const promptPayload = buildKBR01PromptPayload(detection);
  const storagePatch = buildKBR01StoragePatch(detection, previousStorage);

  return {
    detection,
    promptPayload,
    storagePatch,
    routeNext: detection.routeNext,
  };
}
