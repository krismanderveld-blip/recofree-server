/**
 * Elias Steunpilaren Context Assembler
 * Evaluates PAAL01 memory relevance at every Elias turn and builds GPT directive.
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
 * Returns null if not relevant or persona is not Elias.
 */
export function assembleEliasSteunpilarenMemoryContext(
  input: AssemblerInput
): SteunpilarenMemoryUseDirectiveContext | null {
  // Persona guard
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

  // Check relevance: is the current message related to support/strength/difficulty?
  const lower = input.latestUserMessage.toLowerCase();
  const relevanceKeywords = [
    "steun", "steunpilaar", "pilaar", "kracht", "help", "overeind",
    "alleen", "niemand", "support", "strength", "pillar",
    "routine", "wandel", "netwerk", "volhoud",
    // Also relevant when user expresses difficulty (reminder context)
    "moeilijk", "zwaar", "niet meer", "opgeven", "difficult", "hard",
  ];
  const isRelevant = relevanceKeywords.some((kw) => lower.includes(kw)) || input.turnIndex <= 2;

  if (!isRelevant) return null;

  const topPilaren = pilarenLabels.slice(0, 3).join(", ");
  const hardDirectiveForGpt = `Elias-only context: user has identified steunpilaren including ${topPilaren}. Use gently if relevant to current message. Do not mention memory, storage, or internal data. Reference naturally when it helps.`;

  return {
    persona: "elias",
    activeModuleHints: ["PAAL01"],
    storedSteunpilaren: pilarenLabels,
    balkmetafoorSummary,
    recentSafeSummaries,
    hardDirectiveForGpt,
  };
}
