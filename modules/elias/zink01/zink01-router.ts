/**
 * ZINK01 — Meaning/Purpose Module (Elias only)
 * ROUTER: Takes detection result and produces output contract
 */
import type { ZINK01RuntimeInput, ZINK01DetectionResult, ZINK01ModuleOutput, ZINK01StorageState } from './zink01-types';
import { buildZINK01PromptPayload } from './zink01-prompt';
import { buildZINK01StoragePatch } from './zink01-storage';

export function routeZINK01(
  input: ZINK01RuntimeInput,
  detection: ZINK01DetectionResult,
  _previousStorage?: ZINK01StorageState,
): ZINK01ModuleOutput {
  return {
    detection,
    promptPayload: buildZINK01PromptPayload(detection),
    storagePatch: buildZINK01StoragePatch(input, detection),
  };
}
