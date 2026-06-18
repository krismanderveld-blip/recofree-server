/**
 * Kim Pattern Support Context Assembler
 *
 * Assembles memory context from all Kim pattern support layers for GPT prompt injection.
 * Hard directive: every relevant Kim turn, not keyword-gated, not limited to session start.
 */

import type {
  KimPatternSupportModuleId,
  KimPatternMemoryUseDirective,
  RecoFreePersona,
} from "@/src/types/kimPatternsSupport.types";

export interface KimPatternMemoryUseDirectiveContext {
  persona: "kim";
  activeModuleHints: KimPatternSupportModuleId[];
  relevantPatterns: string[];
  relevantBeliefs: string[];
  relevantHandles: string[];
  recentSafeSummaries: string[];
  hardDirectiveForGpt: string;
}

export interface KimPatternContextAssemblerInput {
  persona: RecoFreePersona;
  sessionId: string;
  turnId: string;
  turnIndex: number;
  latestUserMessage: string;
  stateDat: unknown;
  userDat: unknown;
  projectionsDat: unknown;
  logsDat: unknown;
}

export function assembleKimPatternSupportMemoryContext(
  input: KimPatternContextAssemblerInput
): KimPatternMemoryUseDirectiveContext | null {
  // Strict persona check — never assemble for Elias
  if (input.persona !== "kim") return null;

  const activeModuleHints: KimPatternSupportModuleId[] = [];
  const relevantPatterns: string[] = [];
  const relevantBeliefs: string[] = [];
  const relevantHandles: string[] = [];
  const recentSafeSummaries: string[] = [];

  // Extract from stateDat
  const state = input.stateDat as Record<string, unknown> | null;
  if (state) {
    const frame = state.activeKimReflectiveFrame as string | undefined;
    if (frame === "kim_support_pillars") activeModuleHints.push("PAAL-K01");
    if (frame === "caregiver_control_pattern") activeModuleHints.push("BEHE-K01");
    if (frame === "caregiver_adaptation_pattern") activeModuleHints.push("AANP-K01");
    if (frame === "caregiver_codependency_awareness") activeModuleHints.push("CODEP-K01");
  }

  // Extract from userDat
  const user = input.userDat as Record<string, unknown> | null;
  if (user) {
    const kimProfile = user.kimProfile as Record<string, unknown> | undefined;
    if (kimProfile) {
      const pillars = kimProfile.supportPillars as Array<{ label: string; active: boolean }> | undefined;
      if (pillars) {
        pillars.filter(p => p.active).forEach(p => relevantPatterns.push(`steunpilaar: ${p.label}`));
      }
      const patterns = kimProfile.learnedPatterns as Array<{ label: string; patternType: string }> | undefined;
      if (patterns) {
        patterns.forEach(p => relevantPatterns.push(`patroon (${p.patternType}): ${p.label}`));
      }
    }
  }

  // Extract from projectionsDat
  const projections = input.projectionsDat as Record<string, unknown> | null;
  if (projections) {
    const beliefs = projections.beliefs as Array<{ label: string; sourceModuleId: string }> | undefined;
    if (beliefs) {
      beliefs
        .filter(b => ["PAAL-K01", "BEHE-K01", "AANP-K01", "CODEP-K01"].includes(b.sourceModuleId))
        .forEach(b => relevantBeliefs.push(b.label));
    }
    const handles = projections.handles as Array<{ label: string; sourceModuleId: string }> | undefined;
    if (handles) {
      handles
        .filter(h => ["PAAL-K01", "BEHE-K01", "AANP-K01", "CODEP-K01"].includes(h.sourceModuleId))
        .forEach(h => relevantHandles.push(h.label));
    }
  }

  // Extract from logsDat
  const logs = input.logsDat as Record<string, unknown> | null;
  if (logs) {
    const events = logs.events as Array<{ safeSummary: string; moduleId: string }> | undefined;
    if (events) {
      events
        .filter(e => ["PAAL-K01", "BEHE-K01", "AANP-K01", "CODEP-K01"].includes(e.moduleId))
        .slice(-5)
        .forEach(e => recentSafeSummaries.push(e.safeSummary));
    }
  }

  // If no relevant data found, still return directive if turn >= 1
  const hasData =
    activeModuleHints.length > 0 ||
    relevantPatterns.length > 0 ||
    relevantBeliefs.length > 0 ||
    relevantHandles.length > 0 ||
    recentSafeSummaries.length > 0;

  if (!hasData) return null;

  return {
    persona: "kim",
    activeModuleHints,
    relevantPatterns,
    relevantBeliefs,
    relevantHandles,
    recentSafeSummaries,
    hardDirectiveForGpt:
      "Use Kim pattern support memory (PAAL-K01/BEHE-K01/AANP-K01/CODEP-K01) at every relevant Kim turn where the engine includes it. " +
      "This includes turn 5+ and later sessions. Not keyword-gated. Not limited to greeting. " +
      "Do not mention storage. Do not use Elias data. Kim data only.",
  };
}
