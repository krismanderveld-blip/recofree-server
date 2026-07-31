/**
 * VETR01 Storage Patch Builder
 * Persists trust repair state to Kim persona storage.
 */

import type { VETR01RuntimeInput, VETR01DetectionResult, VETR01StoragePatch } from "./vetr01-types";

export function buildVETR01StoragePatch(
  input: VETR01RuntimeInput,
  result: VETR01DetectionResult
): Partial<VETR01StoragePatch> {
  if (result.activationStatus !== "ACTIVE") return {};

  let bridgeModuleSuggested: VETR01StoragePatch["bridgeModuleSuggested"] = null;
  if (result.routeNext === "KBR01") bridgeModuleSuggested = "KBR01";
  else if (result.routeNext === "KDL01") bridgeModuleSuggested = "KDL01";
  else if (result.routeNext === "KSC01") bridgeModuleSuggested = "KSC01";

  return {
    persona: "kim",
    storagePath: "local://recofree/personas/kim/user.dat.modules.VETR01",
    lastActivatedModuleId: "VETR01",
    lastActivatedAt: input.timestampIso,
    responseMode: result.responseMode,
    trustRepairQuestion: input.trustRepairQuestion,
    forgivenessPressure: input.forgivenessPressure,
    boundaryNeedAfterBetrayal: input.boundaryNeedAfterBetrayal,
    timelinePressure: input.timelinePressure,
    bridgeModuleSuggested,
  };
}
