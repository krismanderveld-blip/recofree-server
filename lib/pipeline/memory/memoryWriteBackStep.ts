/**
 * Memory Write-Back Step — Orchestrates the full per-turn write-back.
 * Called after all pipeline detections are complete.
 * Produces debug log output.
 */
import type {
  PipelineDetectionBundle,
  MemoryWritePlan,
} from "@/lib/types/memory/memoryCore.types";
import type { UserDat } from "@/lib/types/memory/userDat.types";
import type { StateDat } from "@/lib/types/memory/stateDat.types";
import type { ProjectionsDat } from "@/lib/types/memory/projectionsDat.types";
import type { SessionBuffer } from "@/lib/types/memory/sessionBuffer.types";
import { buildMemoryWritePlan } from "./memoryWriteRouter";
import { applyMemoryWritePlan, type MemoryCommitResult, type MemoryStoresSnapshot } from "./memoryCommitService";

export interface MemoryWriteBackInput {
  detectionBundle: PipelineDetectionBundle;
  currentStores: MemoryStoresSnapshot;
}

export interface MemoryWriteBackOutput {
  plan: MemoryWritePlan;
  commitResult: MemoryCommitResult;
  updatedStores: MemoryStoresSnapshot;
  debugLog: string;
}

/**
 * Execute the full memory write-back step.
 * 1. Build write plan from detections
 * 2. Apply plan to stores
 * 3. Produce debug output
 */
export function executeMemoryWriteBack(input: MemoryWriteBackInput): MemoryWriteBackOutput {
  const { detectionBundle, currentStores } = input;

  // Step 1: Build plan
  const plan = buildMemoryWritePlan(detectionBundle);

  // Step 2: Apply plan
  const { stores: updatedStores, result: commitResult } = applyMemoryWritePlan(plan, currentStores);

  // Step 3: Build debug log
  const debugLog = buildDebugLog(plan, commitResult);

  return {
    plan,
    commitResult,
    updatedStores,
    debugLog,
  };
}

function buildDebugLog(plan: MemoryWritePlan, result: MemoryCommitResult): string {
  const lines: string[] = [];
  lines.push(`[MemoryWriteBack] planId=${plan.planId} turn=${plan.turnId}`);
  lines.push(`  patches: ${plan.patches.length} total, ${result.writtenPatches.length} written, ${result.skippedPatches.length} skipped`);

  if (result.changedFields.length > 0) {
    lines.push(`  gewijzigde velden: [${result.changedFields.join(", ")}]`);
  }

  if (result.errors.length > 0) {
    lines.push(`  ERRORS: ${result.errors.join("; ")}`);
  }

  // Detail per written patch
  for (const patch of plan.patches) {
    if (patch.shouldWrite) {
      lines.push(`    ✓ ${patch.patchId} → ${patch.layer}/${patch.path} (${patch.operation})`);
    }
  }

  return lines.join("\n");
}
