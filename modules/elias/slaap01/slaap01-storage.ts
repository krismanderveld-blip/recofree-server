/**
 * SLAAP01 Elias Storage Patch Builder
 * Writes only to personas/elias/user.dat.modules.SLAAP01
 * Never cross-persona.
 */

import type {
  SLAAP01EliasRuntimeInput,
  SLAAP01EliasDetectionResult,
  SLAAP01EliasStoragePatch,
} from "./slaap01-types";

export function buildSLAAP01EliasStoragePatch(
  input: SLAAP01EliasRuntimeInput,
  result: SLAAP01EliasDetectionResult
): Partial<SLAAP01EliasStoragePatch> {
  if (result.activationStatus !== "ACTIVE") return {};

  return {
    persona: "elias",
    storagePath: "local://recofree/personas/elias/user.dat.modules.SLAAP01",
    lastActivatedModuleId: "SLAAP01",
    lastActivatedAt: input.timestampIso,
    sleepProblemDetected: input.sleepProblemDetected,
    nightCravingDetected: input.nightCravingDetected,
    fatigueRelapseTriggerDetected: input.fatigueRelapseTriggerDetected,
    withdrawalSleepConcern: input.withdrawalSleepConcern,
    selectedResponseMode: result.responseMode,
  };
}
