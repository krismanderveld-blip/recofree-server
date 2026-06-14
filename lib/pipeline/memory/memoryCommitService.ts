/**
 * Memory Commit Service — Applies a MemoryWritePlan to the actual stores.
 * Logs all writes for debug output.
 */
import type {
  MemoryWritePlan,
  MemoryWritePatch,
  RecoFreePersona,
} from "@/lib/types/memory/memoryCore.types";
import type { UserDat } from "@/lib/types/memory/userDat.types";
import type { StateDat } from "@/lib/types/memory/stateDat.types";
import type { ProjectionsDat } from "@/lib/types/memory/projectionsDat.types";
import type { SessionBuffer, BufferTurnSnapshot } from "@/lib/types/memory/sessionBuffer.types";
import { mergeTriggerPattern, mergeSchemaTendency, mergeModeTendency, mergeModuleUsage } from "@/lib/storage/memory/mergeUserDat";
import { mergeCurrentState, mergeMoodHistory, mergeZoneHistoryBuffer } from "@/lib/storage/memory/mergeStateDat";
import { mergeProjectionRecord } from "@/lib/storage/memory/mergeProjectionsDat";

export interface MemoryCommitResult {
  planId: string;
  writtenPatches: string[];
  skippedPatches: string[];
  changedFields: string[];
  errors: string[];
}

export interface MemoryStoresSnapshot {
  userDat: UserDat;
  stateDat: StateDat;
  projectionsDat: ProjectionsDat;
  sessionBuffer: SessionBuffer | null;
}

/**
 * Apply all shouldWrite=true patches from the plan to the in-memory store snapshots.
 * Returns mutated snapshots + commit result for debug logging.
 */
export function applyMemoryWritePlan(
  plan: MemoryWritePlan,
  stores: MemoryStoresSnapshot
): { stores: MemoryStoresSnapshot; result: MemoryCommitResult } {
  const result: MemoryCommitResult = {
    planId: plan.planId,
    writtenPatches: [],
    skippedPatches: [],
    changedFields: [],
    errors: [],
  };

  let { userDat, stateDat, projectionsDat, sessionBuffer } = stores;

  for (const patch of plan.patches) {
    if (!patch.shouldWrite) {
      result.skippedPatches.push(patch.patchId);
      continue;
    }

    try {
      switch (patch.layer) {
        case "user.dat":
          userDat = applyUserDatPatch(userDat, patch);
          break;
        case "state.dat":
          stateDat = applyStateDatPatch(stateDat, patch, plan.sessionId);
          break;
        case "projections.dat":
          projectionsDat = applyProjectionsDatPatch(projectionsDat, patch);
          break;
        case "buffer":
          // Buffer patches are handled externally by sessionBufferStore
          break;
        default:
          result.errors.push(`Unknown layer: ${patch.layer}`);
          continue;
      }
      result.writtenPatches.push(patch.patchId);
      result.changedFields.push(`${patch.layer.replace(".dat", "")}.${patch.path}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${patch.patchId}: ${msg}`);
    }
  }

  return {
    stores: { userDat, stateDat, projectionsDat, sessionBuffer },
    result,
  };
}

function applyUserDatPatch(userDat: UserDat, patch: MemoryWritePatch): UserDat {
  const payload = patch.payload;
  if (!payload) return userDat;

  switch (patch.path) {
    case "triggerPatterns":
      return mergeTriggerPattern(userDat, payload);
    case "schemaTendencies":
      return mergeSchemaTendency(userDat, payload);
    case "modeTendencies":
      return mergeModeTendency(userDat, payload);
    case "moduleUsage":
      return mergeModuleUsage(userDat, payload);
    default:
      return userDat;
  }
}

function applyStateDatPatch(stateDat: StateDat, patch: MemoryWritePatch, sessionId: string): StateDat {
  const payload = patch.payload;
  if (!payload) return stateDat;

  switch (patch.path) {
    case "current.zone":
      return mergeZoneHistoryBuffer(
        stateDat,
        { zone: payload.zone, zoneNumeric: payload.zoneNumeric, confidence: payload.confidence, sourceKind: payload.source || "pipeline" },
        payload.turnId,
        sessionId,
        payload.timestampIso
      );
    case "current.mood":
      return mergeMoodHistory(
        stateDat,
        payload,
        payload.turnId,
        sessionId,
        payload.timestampIso
      );
    case "current.activeModuleId":
      return mergeCurrentState(
        stateDat,
        {
          activeModuleId: payload.activeModuleId,
          activeResponseMode: payload.activeResponseMode,
          lastPipelineTurnId: payload.lastPipelineTurnId,
          lastSessionId: payload.lastSessionId,
        },
        payload.timestampIso || new Date().toISOString()
      );
    default:
      return stateDat;
  }
}

function applyProjectionsDatPatch(projDat: ProjectionsDat, patch: MemoryWritePatch): ProjectionsDat {
  const payload = patch.payload;
  if (!payload) return projDat;

  return mergeProjectionRecord(projDat, payload);
}
