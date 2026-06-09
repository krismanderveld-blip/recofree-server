/**
 * ROUW01 — Grief/Loss Through Addiction (Elias only)
 * ROUTER: Takes detection result and produces output contract
 */
import type { ROUW01RuntimeInput, ROUW01DetectionResult, ROUW01ModuleOutput, ROUW01StorageState } from './rouw01-types';
import { buildROUW01PromptPayload } from './rouw01-prompt';
import { buildROUW01StoragePatch } from './rouw01-storage';

export function routeROUW01(
  input: ROUW01RuntimeInput,
  detection: ROUW01DetectionResult,
  _previousStorage?: ROUW01StorageState,
): ROUW01ModuleOutput {
  return {
    detection,
    promptPayload: buildROUW01PromptPayload(detection),
    storagePatch: buildROUW01StoragePatch(input, detection),
  };
}
