/**
 * CDP01 Router — Routes detection result to prompt payload and storage patch.
 */

import type { CDP01DetectionResult, CDP01RuntimeInput } from "./cdp01-types";
import { buildCDP01PromptPayload } from "./cdp01-prompt";
import { buildCDP01StoragePatch } from "./cdp01-storage";

export interface CDP01RouterResult {
  detection: CDP01DetectionResult;
  promptPayload: ReturnType<typeof buildCDP01PromptPayload>;
  storagePatch: ReturnType<typeof buildCDP01StoragePatch>;
  routeNext: CDP01DetectionResult["routeNext"];
}

export function routeCDP01(
  input: CDP01RuntimeInput,
  detection: CDP01DetectionResult
): CDP01RouterResult {
  return {
    detection,
    promptPayload: buildCDP01PromptPayload(detection),
    storagePatch: buildCDP01StoragePatch(input, detection),
    routeNext: detection.routeNext,
  };
}
