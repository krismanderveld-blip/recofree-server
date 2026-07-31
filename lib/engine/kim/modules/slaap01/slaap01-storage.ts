/**
 * SLAAP01 Kim Storage Patch Builder
 * Writes only to personas/kim/user.dat.modules.SLAAP01
 * Never cross-persona.
 */

import type {
  SLAAP01KimRuntimeInput,
  SLAAP01KimDetectionResult,
  SLAAP01KimStoragePatch,
} from "./slaap01-types";

export function buildSLAAP01KimStoragePatch(
  input: SLAAP01KimRuntimeInput,
  result: SLAAP01KimDetectionResult
): Partial<SLAAP01KimStoragePatch> {
  if (result.activationStatus !== "ACTIVE") return {};

  return {
    persona: "kim",
    storagePath: "local://recofree/personas/kim/user.dat.modules.SLAAP01",
    lastActivatedModuleId: "SLAAP01",
    lastActivatedAt: input.timestampIso,
    sleepProblemDetected: input.sleepProblemDetected,
    nightVigilanceDetected: input.nightVigilanceDetected,
    sleepGuiltDetected: input.sleepGuiltDetected,
    fatigueBoundaryTriggerDetected: input.fatigueBoundaryTriggerDetected,
    selectedResponseMode: result.responseMode,
  };
}
