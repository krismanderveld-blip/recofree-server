/**
 * RNW01 Storage Patch Builder
 * Persists ambiguous grief state to Kim persona storage.
 */

import type { RNW01RuntimeInput, RNW01DetectionResult, RNW01StoragePatch } from "./rnw01-types";

export function buildRNW01StoragePatch(
  input: RNW01RuntimeInput,
  result: RNW01DetectionResult
): Partial<RNW01StoragePatch> {
  if (result.activationStatus !== "ACTIVE") return {};

  let bridgeModuleSuggested: RNW01StoragePatch["bridgeModuleSuggested"] = null;
  if (result.routeNext === "KSC01") bridgeModuleSuggested = "KSC01";
  else if (result.routeNext === "KDL01") bridgeModuleSuggested = "KDL01";
  else if (result.routeNext === "VETR01") bridgeModuleSuggested = "VETR01";

  return {
    persona: "kim",
    storagePath: "local://recofree/personas/kim/user.dat.modules.RNW01",
    lastActivatedModuleId: "RNW01",
    lastActivatedAt: input.timestampIso,
    responseMode: result.responseMode,
    missesOldPerson: input.missesOldPerson,
    griefForLivingPerson: input.griefForLivingPerson,
    ambiguousGriefMarker: input.ambiguousGriefMarker,
    guiltAboutGrieving: input.guiltAboutGrieving,
    bridgeModuleSuggested,
  };
}
