/**
 * BEDR01 Storage Patch Builder
 * Persists betrayal discovery state to Kim persona storage.
 */

import type { BEDR01RuntimeInput, BEDR01DetectionResult, BEDR01StoragePatch } from "./bedr01-types";

export function buildBEDR01StoragePatch(
  input: BEDR01RuntimeInput,
  result: BEDR01DetectionResult
): Partial<BEDR01StoragePatch> {
  if (result.activationStatus !== "ACTIVE") return {};

  return {
    persona: "kim",
    storagePath: "local://recofree/personas/kim/user.dat.modules.BEDR01",
    lastActivatedModuleId: "BEDR01",
    lastActivatedAt: input.timestampIso,
    responseMode: result.responseMode,
    acuteShockDominant: input.acuteShockDominant,
    discoveryJustHappened: input.discoveryJustHappened,
    bodyDysregulation: input.bodyDysregulation,
    childrenInvolved: input.childrenInvolved,
    safetyRedirectUsed: result.routeNext === "SAFETY_PROTOCOL",
  };
}
