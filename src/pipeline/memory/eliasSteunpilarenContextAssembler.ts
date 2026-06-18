/**
 * Elias Steunpilaren Context Assembler
 * Evaluates PAAL01 memory relevance at every Elias turn and builds GPT directive.
 *
 * SPEC RULE: NOT keyword-gated. NOT limited to first 1-2 turns.
 * Applies at every relevant turn where user.dat contains PAAL01 data.
 * Relevance is determined by existence of stored data, not by message keywords.
 */

import type { RecoFreePersona } from "@/src/types/eliasSteunpilaren.types";

export interface SteunpilarenMemoryUseDirectiveContext {
  persona: "elias";
  activeModuleHints: ["PAAL01"];
  storedSteunpilaren: string[];
  balkmetafoorSummary: { draaglastCount: number; draagkrachtCount: number } | null;
  recentSafeSummaries: string[];
  hardDirectiveForGpt: string;
}

interface AssemblerInput {
  persona: RecoFreePersona;
  sessionId: string;
  turnId: string;
  turnIndex: number;
  latestUserMessage: string;
  stateDat: unknown;
  userDat: unknown;
  logsDat: unknown;
}

/**
 * Assembles PAAL01 memory context for GPT prompt injection.
 * Returns null only if persona is not Elias or no PAAL01 data exists.
 *
 * IMPORTANT: This is NOT keyword-gated. If the user has steunpilaren data,
 * this directive is included at EVERY Elias turn (including turn 5+, turn 20+, etc.)
 * so GPT can reference it naturally when relevant.
 */
export function assembleEliasSteunpilarenMemoryContext(
  input: AssemblerInput
): SteunpilarenMemoryUseDirectiveContext | null {
  // Persona guard — only Elias
  if (input.persona !== "elias") return null;

  // Extract steunpilaren from userDat
  const userDat = input.userDat as Record<string, unknown> | null;
  if (!userDat) return null;

  const moduleUsage = userDat.moduleUsage as Array<{ moduleId: string; count: number }> | undefined;
  const paal01Usage = moduleUsage?.find((m) => m.moduleId === "PAAL01");
  if (!paal01Usage || paal01Usage.count === 0) return null;

  // Get stored steunpilaren
  const storedPilaren = (userDat.steunpilaren as Array<{ label: string }> | undefined) ?? [];
  if (storedPilaren.length === 0) return null;

  const pilarenLabels = storedPilaren.map((p) => p.label);

  // Get balkmetafoor summary if available
  const balkmetafoor = userDat.balkmetafoor as {
    draaglast?: Array<unknown>;
    draagkracht?: Array<unknown>;
  } | undefined;
  const balkmetafoorSummary = balkmetafoor
    ? {
        draaglastCount: balkmetafoor.draaglast?.length ?? 0,
        draagkrachtCount: balkmetafoor.draagkracht?.length ?? 0,
      }
    : null;

  // Get recent log summaries
  const logsDat = input.logsDat as Array<{ safeSummary: string; moduleId: string }> | null;
  const recentSafeSummaries = (logsDat ?? [])
    .filter((l) => l.moduleId === "PAAL01")
    .slice(-3)
    .map((l) => l.safeSummary);

  // ─── NO KEYWORD GATING ─────────────────────────────────────
  // Per spec: if PAAL01 data exists in user.dat, the directive is ALWAYS included.
  // GPT decides whether to use it based on conversational relevance.
  // This is NOT limited to turn 1-2, NOT keyword-gated.

  const topPilaren = pilarenLabels.slice(0, 5).join(", ");
  const balkSummaryText = balkmetafoorSummary
    ? ` Balance bar: ${balkmetafoorSummary.draaglastCount} draaglast items, ${balkmetafoorSummary.draagkrachtCount} draagkracht items.`
    : "";

  const hardDirectiveForGpt = `[PAAL01 memory directive — hard, every turn] User has identified steunpilaren: ${topPilaren}.${balkSummaryText} Reference gently and naturally when relevant to the current conversation. Do not force. Do not mention storage, memory, or internal data. Do not limit to greeting only.`;

  return {
    persona: "elias",
    activeModuleHints: ["PAAL01"],
    storedSteunpilaren: pilarenLabels,
    balkmetafoorSummary,
    recentSafeSummaries,
    hardDirectiveForGpt,
  };
}
