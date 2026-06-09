/**
 * GASL01 Storage Patch Builder
 * Persists gaslighting recognition state to Kim persona storage.
 */

import type { GASL01RuntimeInput, GASL01DetectionResult, GASL01StoragePatch } from "./gasl01-types";

export function buildGASL01StoragePatch(
  input: GASL01RuntimeInput,
  result: GASL01DetectionResult
): Partial<GASL01StoragePatch> {
  if (result.activationStatus !== "ACTIVE" && result.activationStatus !== "LIMITED_FACT_ANCHORING_ONLY") return {};

  return {
    persona: "kim",
    storagePath: "local://recofree/personas/kim/user.dat.modules.GASL01",
    lastActivatedModuleId: "GASL01",
    lastActivatedAt: input.timestampIso,
    responseMode: result.responseMode,
    selfDoubtDominant: input.selfDoubtDominant,
    darvoPatternDetected: input.darvoPatternDetected,
    informationAsymmetry: input.informationAsymmetry,
    childrenTriangulation: input.childrenTriangulation,
    factAnchoringOnlyMode: result.activationStatus === "LIMITED_FACT_ANCHORING_ONLY",
  };
}
