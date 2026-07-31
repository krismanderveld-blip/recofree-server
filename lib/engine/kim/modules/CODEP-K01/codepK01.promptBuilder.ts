/**
 * CODEP-K01 Prompt Builder
 */

import type { KimPatternPromptPayload, KimPatternMemoryUseDirective } from "@/lib/types/kimPatternsSupport.types";
import type { CodepK01DetectionResult } from "./codepK01.detector";
import { LocalDeviceTimeService } from "@/lib/core/time";

export function buildCodepK01PromptPayload(detection: CodepK01DetectionResult): KimPatternPromptPayload {
  const memoryDirective: KimPatternMemoryUseDirective = {
    directiveId: `codep-k01-directive-${LocalDeviceTimeService.now().epochMs}`,
    appliesToModuleId: "CODEP-K01",
    hardDirective: true,
    requiredToUseOnEveryRelevantTurn: true,
    notKeywordGated: true,
    notLimitedToSessionStart: true,
    notLimitedToFirstTwoTurns: true,
    layersUsed: ["buffer", "state.dat", "user.dat", "logs.dat"],
    directiveText:
      "Use CODEP-K01 codependency pattern data at every relevant Kim turn where the engine includes it, including turn 5+ and later sessions. Not keyword-gated. Not limited to greeting. NEVER use the word 'codependent'. Do not mention storage. Do not use Elias data.",
  };

  return {
    persona: "kim",
    moduleId: "CODEP-K01",
    compactPrompt:
      "CODEP-K01 active. Kim-only. Name identity fusion, rescue behavior, boundary absence, self-neglect patterns WITHOUT using the word 'codependent'. Explore what it costs Kim. No diagnosis, no labeling. Use supplied Kim memory at every relevant turn, including turn 5+.",
    fullPrompt:
      "You are Kim inside RecoFree. CODEP-K01 is active. The user is a caregiver who may be showing patterns of identity fusion (existing only through partner), rescue behavior (must save partner), boundary absence (cannot say no), or self-neglect (forgetting own needs). Your role: NAME the pattern without EVER using the word 'codependent' or 'codependentie'. Explore what it costs Kim. Never say 'you are codependent' or 'you have a disorder'. Frame as: 'I hear that your life has become completely intertwined with his. What does that mean for you?' Use only Kim-scoped memory supplied by the engine. Hard directive: use CODEP-K01 memory at every relevant Kim turn, including turn 5+ and later sessions. This is not keyword-gated and not limited to first 1-2 messages. Do not mention storage. Do not use Elias data.",
    selectedInterventionType: detection.selectedInterventionType,
    memoryDirective,
    forbiddenOutput: [
      "codependent",
      "codependentie",
      "co-dependent",
      "je hebt een stoornis",
      "je bent ziek",
      "je moet loslaten",
      "je moet hem verlaten",
      "je bent te betrokken",
      "je bent verslaafd aan hem",
      "diagnose",
      "Elias",
      "opgeslagen",
      "storage",
    ],
    store: false,
    gptMayDiagnose: false,
    gptMayUseEliasData: false,
    gptMayOverrideCrisis: false,
    gptMayTellKimToControlLovedOne: false,
  };
}
