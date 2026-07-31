/**
 * GASL01 Router — Routes detection result to prompt payload and storage patch.
 */

import type { GASL01DetectionResult, GASL01RuntimeInput } from "./gasl01-types";
import { buildGASL01PromptPayload } from "./gasl01-prompt";
import { buildGASL01StoragePatch } from "./gasl01-storage";

export interface GASL01RouterResult {
  detection: GASL01DetectionResult;
  promptPayload: ReturnType<typeof buildGASL01PromptPayload>;
  storagePatch: ReturnType<typeof buildGASL01StoragePatch>;
  routeNext: GASL01DetectionResult["routeNext"];
}

export function routeGASL01(
  input: GASL01RuntimeInput,
  detection: GASL01DetectionResult
): GASL01RouterResult {
  return {
    detection,
    promptPayload: buildGASL01PromptPayload(detection),
    storagePatch: buildGASL01StoragePatch(input, detection),
    routeNext: detection.routeNext,
  };
}
