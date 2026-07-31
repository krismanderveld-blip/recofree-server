/**
 * VERG01 — Self-Forgiveness After Relapse (Elias only)
 * ROUTER: Takes detection result and produces output contract
 */
import type { VERG01RuntimeInput, VERG01DetectionResult, VERG01ModuleOutput, VERG01StorageState } from './verg01-types';
import { buildVERG01PromptPayload } from './verg01-prompt';
import { buildVERG01StoragePatch } from './verg01-storage';

export function routeVERG01(
  input: VERG01RuntimeInput,
  detection: VERG01DetectionResult,
  _previousStorage?: VERG01StorageState,
): VERG01ModuleOutput {
  return {
    detection,
    promptPayload: buildVERG01PromptPayload(detection),
    storagePatch: buildVERG01StoragePatch(input, detection),
  };
}
