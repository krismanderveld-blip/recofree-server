/**
 * CDP01 Storage Patch Builder
 * Persists codependency pattern state to Kim persona storage.
 */

import type { CDP01RuntimeInput, CDP01DetectionResult, CDP01StoragePatch } from "./cdp01-types";

export function buildCDP01StoragePatch(
  input: CDP01RuntimeInput,
  result: CDP01DetectionResult
): Partial<CDP01StoragePatch> {
  if (result.activationStatus !== "ACTIVE") return {};

  let bridgeModuleSuggested: CDP01StoragePatch["bridgeModuleSuggested"] = null;
  if (result.routeNext === "KBR01") bridgeModuleSuggested = "KBR01";
  else if (result.routeNext === "KSC01") bridgeModuleSuggested = "KSC01";
  else if (result.routeNext === "KDL01") bridgeModuleSuggested = "KDL01";

  return {
    persona: "kim",
    storagePath: "local://recofree/personas/kim/user.dat.modules.CDP01",
    lastActivatedModuleId: "CDP01",
    lastActivatedAt: input.timestampIso,
    responseMode: result.responseMode,
    selfLossPattern: input.selfLossPattern,
    relationalFusion: input.relationalFusion,
    emotionalDependencyOnPartnerState: input.emotionalDependencyOnPartnerState,
    rescueCompulsion: input.rescueCompulsion,
    selfCareGuilt: input.selfCareGuilt,
    bridgeModuleSuggested,
  };
}
