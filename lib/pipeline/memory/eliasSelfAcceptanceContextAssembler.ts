/**
 * Self-Acceptance Cluster Context Assembler
 * Evaluates memory layers every relevant Elias turn (not keyword-gated, not turn-limited).
 */
import type {
  RecoFreePersona,
  EliasSelfAcceptanceModuleId,
  EliasSelfAcceptanceMemoryUseDirective,
  EliasMemoryLayer,
} from "../../types/eliasSelfAcceptanceCluster.types";

interface AssemblerInput {
  persona: RecoFreePersona;
  sessionId: string;
  turnId: string;
  turnIndex: number;
  latestUserMessage: string;
  buffer: unknown;
  stateDat: unknown;
  userDat: unknown;
  projectionsDat: unknown;
  logsDat: unknown;
}

export function assembleEliasSelfAcceptanceMemoryContext(
  input: AssemblerInput
): EliasSelfAcceptanceMemoryUseDirective | null {
  // Rule: only for Elias persona
  if (input.persona !== "elias") return null;

  const layersUsed: EliasMemoryLayer[] = ["buffer"];
  let activeModuleId: EliasSelfAcceptanceModuleId | null = null;

  // Check buffer for active module
  const buf = input.buffer as Record<string, unknown> | null;
  if (buf && typeof buf === "object" && "activeModuleId" in buf) {
    const mid = buf.activeModuleId as string;
    if (["BLIK01", "ONTK01", "IKST01", "COEX01"].includes(mid)) {
      activeModuleId = mid as EliasSelfAcceptanceModuleId;
    }
  }

  // Check state.dat for active therapeutic frame
  const state = input.stateDat as Record<string, unknown> | null;
  if (state && typeof state === "object" && "activeModuleId" in state) {
    const mid = state.activeModuleId as string;
    if (["BLIK01", "ONTK01", "IKST01", "COEX01"].includes(mid)) {
      activeModuleId = activeModuleId || (mid as EliasSelfAcceptanceModuleId);
      layersUsed.push("state.dat");
    }
  }

  // Check user.dat for learned patterns
  const user = input.userDat as Record<string, unknown> | null;
  if (user && typeof user === "object" && "learnedPatterns" in user) {
    const patterns = user.learnedPatterns as Array<{ sourceModuleId?: string }>;
    if (patterns?.some((p) => ["BLIK01", "ONTK01", "IKST01", "COEX01"].includes(p.sourceModuleId || ""))) {
      layersUsed.push("user.dat");
    }
  }

  // Check projections.dat for beliefs/handles
  const proj = input.projectionsDat as Record<string, unknown> | null;
  if (proj && typeof proj === "object") {
    const beliefs = (proj.beliefs || proj.upsertBeliefs) as Array<{ sourceModuleId?: string }> | undefined;
    const handles = (proj.handles || proj.upsertHandles) as Array<{ sourceModuleId?: string }> | undefined;
    const hasClusterData =
      beliefs?.some((b) => ["BLIK01", "ONTK01", "IKST01", "COEX01"].includes(b.sourceModuleId || "")) ||
      handles?.some((h) => ["BLIK01", "ONTK01", "IKST01", "COEX01"].includes(h.sourceModuleId || ""));
    if (hasClusterData) {
      layersUsed.push("projections.dat");
    }
  }

  // Check logs.dat for recent activations
  const logs = input.logsDat as Record<string, unknown> | null;
  if (logs && typeof logs === "object" && "recentSafeLogSummaries" in logs) {
    const summaries = logs.recentSafeLogSummaries as string[];
    if (summaries?.some((s) => /BLIK01|ONTK01|IKST01|COEX01/.test(s))) {
      layersUsed.push("logs.dat");
    }
  }

  // If no module context found, return null
  if (!activeModuleId && layersUsed.length <= 1) return null;

  // Default to BLIK01 if we have layer data but no explicit active module
  const moduleId = activeModuleId || "BLIK01";

  return {
    directiveId: `selfAcceptance_${moduleId}_${input.sessionId}_${input.turnId}`,
    moduleId,
    hardDirective: true,
    useAtEveryRelevantTurn: true,
    useAtTurnFivePlus: true,
    notKeywordGated: true,
    notLimitedToSessionStart: true,
    notLimitedToFirstTwoTurns: true,
    layersUsed: [...new Set(layersUsed)],
    directiveText: `Use stored Elias-only context for ${moduleId} if therapeutically relevant in this answer. Apply it gently without mentioning memory, storage, hidden inference or files. Do not diagnose. Do not override crisis protocol. Keep responsibility and compassion balanced.`,
  };
}
