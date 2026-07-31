/**
 * RNW01 Router — Routes detection result to prompt payload and storage patch.
 */

import type { RNW01DetectionResult, RNW01RuntimeInput } from "./rnw01-types";
import { buildRNW01PromptPayload } from "./rnw01-prompt";
import { buildRNW01StoragePatch } from "./rnw01-storage";

export interface RNW01RouterResult {
  detection: RNW01DetectionResult;
  promptPayload: ReturnType<typeof buildRNW01PromptPayload>;
  storagePatch: ReturnType<typeof buildRNW01StoragePatch>;
  routeNext: RNW01DetectionResult["routeNext"];
}

export function routeRNW01(
  input: RNW01RuntimeInput,
  detection: RNW01DetectionResult
): RNW01RouterResult {
  return {
    detection,
    promptPayload: buildRNW01PromptPayload(detection),
    storagePatch: buildRNW01StoragePatch(input, detection),
    routeNext: detection.routeNext,
  };
}
