/**
 * Session Init Context Builder — Builds context for GPT from memory layers.
 * Used at session start to provide cross-session continuity.
 */
import type { UserDat } from "@/lib/types/memory/userDat.types";
import type { StateDat } from "@/lib/types/memory/stateDat.types";
import type { ProjectionsDat } from "@/lib/types/memory/projectionsDat.types";
import type { LogsDatPlaintext, SessionLogSummary } from "@/lib/types/memory/logsDat.types";
import { estimateTokens } from "@/lib/utils/tokens/estimateTokens";

export interface SessionInitContext {
  contextBlock: string;
  tokenEstimate: number;
  sourceLayers: string[];
}

const MAX_CONTEXT_TOKENS = 800;

/**
 * Build session init context from all memory layers.
 * Prioritizes: last session summary > active projections > trigger patterns > schema/mode tendencies.
 */
export function buildSessionInitContext(
  userDat: UserDat,
  stateDat: StateDat,
  projDat: ProjectionsDat,
  logsDat: LogsDatPlaintext | null
): SessionInitContext {
  const blocks: { text: string; priority: number; source: string }[] = [];

  // 1. Last session summary (highest priority)
  if (logsDat && logsDat.sessions.length > 0) {
    const lastSession = logsDat.sessions[logsDat.sessions.length - 1];
    const summaryBlock = buildLastSessionBlock(lastSession);
    if (summaryBlock) {
      blocks.push({ text: summaryBlock, priority: 1, source: "logs.dat" });
    }
  }

  // 2. Active projections (fears/hopes with score > 0.3)
  const projBlock = buildProjectionsBlock(projDat);
  if (projBlock) {
    blocks.push({ text: projBlock, priority: 2, source: "projections.dat" });
  }

  // 3. Top trigger patterns (frequency >= 2)
  const triggerBlock = buildTriggerBlock(userDat);
  if (triggerBlock) {
    blocks.push({ text: triggerBlock, priority: 3, source: "user.dat" });
  }

  // 4. Schema/mode tendencies (observationCount >= 2)
  const tendencyBlock = buildTendencyBlock(userDat);
  if (tendencyBlock) {
    blocks.push({ text: tendencyBlock, priority: 4, source: "user.dat" });
  }

  // 5. Current state snapshot
  const stateBlock = buildStateBlock(stateDat);
  if (stateBlock) {
    blocks.push({ text: stateBlock, priority: 5, source: "state.dat" });
  }

  // Assemble within token budget
  blocks.sort((a, b) => a.priority - b.priority);
  let totalTokens = 0;
  const includedBlocks: string[] = [];
  const sourceLayers: string[] = [];

  for (const block of blocks) {
    const blockTokens = estimateTokens(block.text);
    if (totalTokens + blockTokens > MAX_CONTEXT_TOKENS) break;
    includedBlocks.push(block.text);
    totalTokens += blockTokens;
    if (!sourceLayers.includes(block.source)) {
      sourceLayers.push(block.source);
    }
  }

  const contextBlock = includedBlocks.length > 0
    ? `[SESSIE CONTEXT — uit lokaal geheugen]\n${includedBlocks.join("\n\n")}`
    : "";

  return {
    contextBlock,
    tokenEstimate: totalTokens,
    sourceLayers,
  };
}

function buildLastSessionBlock(session: SessionLogSummary): string | null {
  const parts: string[] = [];
  parts.push(`Vorige sessie (${session.turnCount ?? '?'} beurten):`);

  if (session.dominantThemes && session.dominantThemes.length > 0) {
    parts.push(`- Thema's: ${session.dominantThemes.join(", ")}`);
  }
  if (session.emotionalArc) {
    parts.push(`- Emotioneel verloop: ${session.emotionalArc}`);
  }
  if (session.unresolvedTensions && session.unresolvedTensions.length > 0) {
    parts.push(`- Onopgelost: ${session.unresolvedTensions.join(", ")}`);
  }
  if (session.suggestedFollowUp && session.suggestedFollowUp.length > 0) {
    parts.push(`- Vervolg: ${session.suggestedFollowUp}`);
  }

  return parts.length > 1 ? parts.join("\n") : null;
}

function buildProjectionsBlock(projDat: ProjectionsDat): string | null {
  const activeFears = projDat.fears
    .filter((f) => f.currentScore > 0.3)
    .sort((a, b) => b.currentScore - a.currentScore)
    .slice(0, 3);

  const activeHopes = projDat.hopes
    .filter((h) => h.currentScore > 0.3)
    .sort((a, b) => b.currentScore - a.currentScore)
    .slice(0, 3);

  if (activeFears.length === 0 && activeHopes.length === 0) return null;

  const parts: string[] = ["Actieve projecties:"];
  if (activeFears.length > 0) {
    parts.push(`- Angsten: ${activeFears.map((f) => `${f.label} (${f.currentScore})`).join(", ")}`);
  }
  if (activeHopes.length > 0) {
    parts.push(`- Hoop: ${activeHopes.map((h) => `${h.label} (${h.currentScore})`).join(", ")}`);
  }
  return parts.join("\n");
}

function buildTriggerBlock(userDat: UserDat): string | null {
  const topTriggers = userDat.triggerPatterns
    .filter((t) => t.frequency >= 2)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);

  if (topTriggers.length === 0) return null;

  return `Bekende triggers: ${topTriggers.map((t) => `${t.label} (${t.frequency}x)`).join(", ")}`;
}

function buildTendencyBlock(userDat: UserDat): string | null {
  const topSchemas = userDat.schemaTendencies
    .filter((s) => s.observationCount >= 2)
    .sort((a, b) => b.confidenceAverage - a.confidenceAverage)
    .slice(0, 3);

  const topModes = userDat.modeTendencies
    .filter((m) => m.observationCount >= 2)
    .sort((a, b) => b.confidenceAverage - a.confidenceAverage)
    .slice(0, 3);

  if (topSchemas.length === 0 && topModes.length === 0) return null;

  const parts: string[] = [];
  if (topSchemas.length > 0) {
    parts.push(`Schema-tendensen: ${topSchemas.map((s) => `${s.schemaName} (avg ${s.confidenceAverage})`).join(", ")}`);
  }
  if (topModes.length > 0) {
    parts.push(`Modus-tendensen: ${topModes.map((m) => `${m.modeName} (avg ${m.confidenceAverage})`).join(", ")}`);
  }
  return parts.join("\n");
}

function buildStateBlock(stateDat: StateDat): string | null {
  const zone = stateDat.current.zone;
  if (!zone) return null;
  return `Laatste zone: ${zone.zone} (confidence ${zone.confidence})`;
}
