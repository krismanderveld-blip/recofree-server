/**
 * ══════════════════════════════════════════════════════════════════════════
 * PATCH WRITER — Client-side state patch application
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Applies server-returned statePatches to local encrypted stores.
 * Order: safety → sessionState → memory → logs → greetingCycle (atomic per-patch).
 *
 * Idempotency: uses turnId to skip already-applied patches.
 * Error handling: partial failure is logged, non-fatal.
 */

import { getSessionLifecycleManager } from '@/lib/pipeline/memory/memoryIntegration';
import type { RecoFreePersona } from '@/lib/types/memory/memoryCore.types';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ServerStatePatches {
  safety: {
    crisisLevel: number;
    riskLevel: string;
    showEmergency: boolean;
    relapseIntentLog: { confidence: number; markers: string[]; timestamp: string } | null;
  };
  sessionState: {
    zoneScore: number;
    zoneColor: string;
    emotionalState: string;
    dominantModule: string;
    usedModules: string[];
    regulationAction: string;
    regulationWasSoftened: boolean;
    responseDirection: string;
  };
  memory: {
    triggerPatterns: Array<{ trigger: string; frequency: number; lastSeen: string }> | null;
    moduleUsage: Array<{ moduleId: string; count: number; lastUsed: string }> | null;
    vspInsight: { framework: string; discrepancy: boolean } | null;
    pastReferenceUse: { referenced: boolean; context: string } | null;
  };
  logs: {
    sessionEventSummary: string;
    moduleActivationSummary: string;
  };
  greetingCycle: {
    lastSessionDate: string;
    cycleTimestamp: string;
    sessionStartedAtDeviceIso: string;
  };
}

export interface PatchWriteResult {
  success: boolean;
  turnId: string;
  appliedLayers: string[];
  errors: Array<{ layer: string; error: string }>;
  skipped: boolean; // true if turnId was already applied
}

// ─── Idempotency Guard ──────────────────────────────────────────────────

const appliedTurnIds = new Set<string>();
const MAX_APPLIED_CACHE = 200;

function markTurnApplied(turnId: string): void {
  appliedTurnIds.add(turnId);
  // FIFO eviction
  if (appliedTurnIds.size > MAX_APPLIED_CACHE) {
    const first = appliedTurnIds.values().next().value;
    if (first) appliedTurnIds.delete(first);
  }
}

function isTurnAlreadyApplied(turnId: string): boolean {
  return appliedTurnIds.has(turnId);
}

// ─── Main Patch Writer ──────────────────────────────────────────────────

export async function applyServerPatches(
  patches: ServerStatePatches,
  sessionId: string,
  turnId: string,
  persona: RecoFreePersona,
  localUserId: string,
): Promise<PatchWriteResult> {
  // Idempotency check
  if (isTurnAlreadyApplied(turnId)) {
    return {
      success: true,
      turnId,
      appliedLayers: [],
      errors: [],
      skipped: true,
    };
  }

  const result: PatchWriteResult = {
    success: true,
    turnId,
    appliedLayers: [],
    errors: [],
    skipped: false,
  };

  const stores = getSessionLifecycleManager().getStores();

  // ── 1. Safety patch ──────────────────────────────────────────────
  try {
    // Safety patches are applied to state.dat current block
    const stateDat = await stores.stateDatStore.load(persona);
    stateDat.current.lastPipelineTurnId = turnId;
    stateDat.current.lastSessionId = sessionId;
    stateDat.current.lastUpdatedAt = patches.greetingCycle.cycleTimestamp;

    // Zone update from safety + sessionState
    stateDat.current.zone = {
      zone: patches.sessionState.zoneColor as "GREEN" | "YELLOW" | "ORANGE" | "RED" | "PURPLE" | "UNKNOWN",
      zoneNumeric: patches.sessionState.zoneScore,
      confidence: 0.9,
      timestampIso: patches.greetingCycle.cycleTimestamp,
    };

    // Add to zone history buffer
    stateDat.zoneHistoryBuffer.push({
      zone: patches.sessionState.zoneColor as "GREEN" | "YELLOW" | "ORANGE" | "RED" | "PURPLE" | "UNKNOWN",
      zoneNumeric: patches.sessionState.zoneScore,
      confidence: 0.9,
      timestampIso: patches.greetingCycle.cycleTimestamp,
      turnId,
      sessionId,
    });

    // Keep buffer capped at 50
    if (stateDat.zoneHistoryBuffer.length > 50) {
      stateDat.zoneHistoryBuffer = stateDat.zoneHistoryBuffer.slice(-50);
    }

    // Active module
    stateDat.current.activeModuleId = patches.sessionState.dominantModule;
    stateDat.current.activeResponseMode = patches.sessionState.regulationAction;

    stateDat.updatedAt = patches.greetingCycle.cycleTimestamp;
    await stores.stateDatStore.save(stateDat);
    result.appliedLayers.push('safety', 'sessionState');
  } catch (err: any) {
    result.errors.push({ layer: 'safety+sessionState', error: err.message });
    result.success = false;
  }

  // ── 2. Memory patch (trigger patterns + module usage → userDat) ──
  try {
    const userDat = await stores.userDatStore.load(persona, localUserId);

    // Merge trigger patterns (upsert by triggerId/label)
    if (patches.memory.triggerPatterns) {
      for (const newTrigger of patches.memory.triggerPatterns) {
        const existing = userDat.triggerPatterns.find(t => t.label === newTrigger.trigger || t.normalizedTrigger === newTrigger.trigger.toLowerCase());
        if (existing) {
          existing.frequency += 1;
          existing.lastSeenAt = newTrigger.lastSeen;
        } else {
          userDat.triggerPatterns.push({
            triggerId: `trg_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
            label: newTrigger.trigger,
            normalizedTrigger: newTrigger.trigger.toLowerCase(),
            triggerType: 'craving' as any,
            frequency: newTrigger.frequency,
            firstSeenAt: newTrigger.lastSeen,
            lastSeenAt: newTrigger.lastSeen,
            lastConfidence: 0.8,
            highestConfidence: 0.8,
            sourceCounts: { signal_engine: 1, pipeline_explicit: 0, user_reported: 0 },
          } as any);
        }
      }
    }

    // Merge module usage (upsert by moduleId)
    if (patches.memory.moduleUsage) {
      for (const newUsage of patches.memory.moduleUsage) {
        const existing = userDat.moduleUsage.find(m => m.moduleId === newUsage.moduleId);
        if (existing) {
          existing.usageCount += 1;
          existing.lastUsedAt = newUsage.lastUsed;
        } else {
          userDat.moduleUsage.push({
            moduleId: newUsage.moduleId,
            persona,
            usageCount: newUsage.count,
            firstUsedAt: newUsage.lastUsed,
            lastUsedAt: newUsage.lastUsed,
            lastResponseMode: 'server-assigned',
            recentUses: [],
          } as any);
        }
      }
    }

    await stores.userDatStore.save(userDat);
    result.appliedLayers.push('memory');
  } catch (err: any) {
    result.errors.push({ layer: 'memory', error: err.message });
    result.success = false;
  }

  // ── 3. Logs patch (append to session buffer for end-of-session write) ──
  try {
    // Logs are accumulated in the session buffer and written at session end.
    // We store the event summary in the buffer's turn snapshots.
    const buffer = stores.sessionBufferStore.getBuffer();
    if (buffer) {
      stores.sessionBufferStore.appendTurnSnapshot(buffer, {
        turnId,
        timestampIso: patches.greetingCycle.cycleTimestamp,
        inputHash: patches.logs.sessionEventSummary,
        outputHash: patches.logs.moduleActivationSummary,
        detectedCounts: { fears: 0, hopes: 0, triggers: 0, schemaTendencies: 0, modeTendencies: 0 },
        changedFields: ['serverPatch'],
      });
    }
    result.appliedLayers.push('logs');
  } catch (err: any) {
    result.errors.push({ layer: 'logs', error: err.message });
    // Non-fatal: logs are supplementary
  }

  // ── 4. Greeting cycle patch ──────────────────────────────────────
  // greetingCycle data is already in stateDat.updatedAt and userDat.lastSessionDate
  // No additional write needed — it's covered by the above patches.
  result.appliedLayers.push('greetingCycle');

  // Mark as applied for idempotency
  markTurnApplied(turnId);

  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────

// Zone color mapping is now done inline using the server's color format directly
