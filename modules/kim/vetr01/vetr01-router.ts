/**
 * VETR01 Router — Routes detection result to prompt payload and storage patch.
 */

import type { VETR01DetectionResult, VETR01RuntimeInput } from "./vetr01-types";
import { buildVETR01PromptPayload } from "./vetr01-prompt";
import { buildVETR01StoragePatch } from "./vetr01-storage";

export interface VETR01RouterResult {
  detection: VETR01DetectionResult;
  promptPayload: ReturnType<typeof buildVETR01PromptPayload>;
  storagePatch: ReturnType<typeof buildVETR01StoragePatch>;
  routeNext: VETR01DetectionResult["routeNext"];
}

export function routeVETR01(
  input: VETR01RuntimeInput,
  detection: VETR01DetectionResult
): VETR01RouterResult {
  return {
    detection,
    promptPayload: buildVETR01PromptPayload(detection),
    storagePatch: buildVETR01StoragePatch(input, detection),
    routeNext: detection.routeNext,
  };
}
