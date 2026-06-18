import type {
  RecoFreePersona,
  EliasPsychoEducationModuleId,
  EliasPsychoEducationMemoryHint,
} from "@/src/types/eliasPsychoEducation.types";

/**
 * Reads psycho-education memory hints from user.dat and projections.dat.
 * Returns relevant hints for the current turn based on detected markers.
 *
 * Rules:
 * - Return empty if persona != elias.
 * - Read WILSKRACHT01 hints when self-blame/willpower markers are present.
 * - Read AUTOPILOT01 hints when craving/trigger/autopilot markers are present.
 * - Return hints for every relevant turn — not limited to session-start or first 1-2 turns.
 * - Relevance is evaluated on each user message.
 */
export function readPsychoEducationMemoryHints(input: {
  persona: RecoFreePersona;
  userDat: unknown;
  projectionsDat: unknown;
  latestUserMessage: string;
  detectedMarkers: string[];
  currentModuleCandidates: EliasPsychoEducationModuleId[];
}): EliasPsychoEducationMemoryHint[] {
  if (input.persona !== "elias") return [];

  const hints: EliasPsychoEducationMemoryHint[] = [];
  const ud = input.userDat as Record<string, unknown> | null;
  const pd = input.projectionsDat as Record<string, unknown> | null;

  // Extract elias-scoped psychoEducationPatterns from user.dat
  const eliasData = (ud as any)?.elias ?? (ud as any);
  const patterns = eliasData?.psychoEducationPatterns as Record<string, EliasPsychoEducationMemoryHint[]> | undefined;

  if (!patterns) return [];

  // Determine which modules are relevant based on markers
  const willkrachtRelevant =
    input.currentModuleCandidates.includes("WILSKRACHT01") ||
    input.detectedMarkers.some((m) =>
      m.includes("self_blame") ||
      m.includes("willpower") ||
      m.includes("sterker") ||
      m.includes("zwak") ||
      m.includes("gefaald") ||
      m.includes("karakter")
    );

  const autopilotRelevant =
    input.currentModuleCandidates.includes("AUTOPILOT01") ||
    input.detectedMarkers.some((m) =>
      m.includes("autopilot") ||
      m.includes("craving") ||
      m.includes("trigger") ||
      m.includes("approach_bias") ||
      m.includes("attentional_bias") ||
      m.includes("conditioned")
    );

  // Read WILSKRACHT01 hints
  if (willkrachtRelevant && patterns.wilskracht) {
    for (const hint of patterns.wilskracht) {
      hints.push(hint);
    }
  }

  // Read AUTOPILOT01 hints
  if (autopilotRelevant && patterns.autopilot) {
    for (const hint of patterns.autopilot) {
      hints.push(hint);
    }
  }

  // Also read recovery handles from projections.dat if relevant
  const eliasProjections = (pd as any)?.elias ?? (pd as any);
  const recoveryHandles = eliasProjections?.recoveryHandles as Array<{ handleId: string; label: string; sourceModuleId: string }> | undefined;

  if (recoveryHandles) {
    for (const handle of recoveryHandles) {
      if (willkrachtRelevant && handle.sourceModuleId === "WILSKRACHT01") {
        hints.push({
          hintId: handle.handleId,
          moduleId: "WILSKRACHT01",
          label: handle.label,
          normalizedLabel: handle.handleId,
          relevance: "recovery_handle",
          firstDetectedAt: "",
          lastUpdatedAt: "",
          frequency: 1,
          lastUsedInGreetingAt: null,
          lastUsedInTurnAt: null,
        });
      }
      if (autopilotRelevant && handle.sourceModuleId === "AUTOPILOT01") {
        hints.push({
          hintId: handle.handleId,
          moduleId: "AUTOPILOT01",
          label: handle.label,
          normalizedLabel: handle.handleId,
          relevance: "recovery_handle",
          firstDetectedAt: "",
          lastUpdatedAt: "",
          frequency: 1,
          lastUsedInGreetingAt: null,
          lastUsedInTurnAt: null,
        });
      }
    }
  }

  return hints;
}
