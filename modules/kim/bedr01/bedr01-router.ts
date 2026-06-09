/**
 * BEDR01 Router — Routes detection result to prompt payload and storage patch.
 */

import type { BEDR01DetectionResult, BEDR01RuntimeInput } from "./bedr01-types";
import { buildBEDR01PromptPayload } from "./bedr01-prompt";
import { buildBEDR01StoragePatch } from "./bedr01-storage";

export interface BEDR01RouterResult {
  detection: BEDR01DetectionResult;
  promptPayload: ReturnType<typeof buildBEDR01PromptPayload>;
  storagePatch: ReturnType<typeof buildBEDR01StoragePatch>;
  routeNext: BEDR01DetectionResult["routeNext"];
}

export function routeBEDR01(
  input: BEDR01RuntimeInput,
  detection: BEDR01DetectionResult
): BEDR01RouterResult {
  return {
    detection,
    promptPayload: buildBEDR01PromptPayload(detection),
    storagePatch: buildBEDR01StoragePatch(input, detection),
    routeNext: detection.routeNext,
  };
}
