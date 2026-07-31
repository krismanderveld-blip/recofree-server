/**
 * IDEN01 — Identity Rebuilding Outside Addiction (Elias only)
 * ROUTER: Takes detection result and produces output contract
 */
import type { IDEN01RuntimeInput, IDEN01DetectionResult, IDEN01ModuleOutput, IDEN01StorageState } from './iden01-types';
import { buildIDEN01PromptPayload } from './iden01-prompt';
import { buildIDEN01StoragePatch } from './iden01-storage';

export function routeIDEN01(
  input: IDEN01RuntimeInput,
  detection: IDEN01DetectionResult,
  _previousStorage?: IDEN01StorageState,
): IDEN01ModuleOutput {
  return {
    detection,
    promptPayload: buildIDEN01PromptPayload(detection),
    storagePatch: buildIDEN01StoragePatch(input, detection),
  };
}
