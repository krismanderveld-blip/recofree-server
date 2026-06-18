/**
 * AANP-K01 Prompt Builder
 */

import type { KimPatternPromptPayload, KimPatternMemoryUseDirective } from "@/src/types/kimPatternsSupport.types";
import type { AanpK01DetectionResult } from "./aanpK01.detector";

export function buildAanpK01PromptPayload(detection: AanpK01DetectionResult): KimPatternPromptPayload {
  const memoryDirective: KimPatternMemoryUseDirective = {
    directiveId: `aanp-k01-directive-${Date.now()}`,
    appliesToModuleId: "AANP-K01",
    hardDirective: true,
    requiredToUseOnEveryRelevantTurn: true,
    notKeywordGated: true,
    notLimitedToSessionStart: true,
    notLimitedToFirstTwoTurns: true,
    layersUsed: ["buffer", "state.dat", "user.dat", "logs.dat"],
    directiveText:
      "Use AANP-K01 adaptation/covering-up pattern data at every relevant Kim turn where the engine includes it, including turn 5+ and later sessions. Not keyword-gated. Not limited to greeting. Do not push Kim to disclose. Do not mention storage. Do not use Elias data.",
  };

  return {
    persona: "kim",
    moduleId: "AANP-K01",
    compactPrompt:
      "AANP-K01 active. Kim-only. Name adaptation/covering-up patterns without pushing to disclose. Explore what it costs Kim. No diagnosis, no labeling as 'dishonest' or 'enabler'. Use supplied Kim memory at every relevant turn, including turn 5+.",
    fullPrompt:
      "You are Kim inside RecoFree. AANP-K01 is active. The user is a caregiver who may be covering up, keeping up appearances, erasing themselves, or adapting excessively to their addicted loved one's behavior. Your role: NAME the pattern without pushing Kim to disclose everything. Explore what it costs Kim personally. Never say 'you are lying' or 'you are dishonest' or 'you are enabling'. Never push Kim to tell everyone the truth. Frame as: 'I hear that you are carrying a lot silently. What does that cost you?' Use only Kim-scoped memory supplied by the engine. Hard directive: use AANP-K01 memory at every relevant Kim turn, including turn 5+ and later sessions. This is not keyword-gated and not limited to first 1-2 messages. Do not mention storage. Do not use Elias data.",
    selectedInterventionType: detection.selectedInterventionType,
    memoryDirective,
    forbiddenOutput: [
      "je liegt",
      "je bent oneerlijk",
      "je houdt het probleem in stand",
      "je moet iedereen de waarheid vertellen",
      "je moet het op je werk melden",
      "je bent zwak",
      "je moet hem ontmaskeren",
      "codependent",
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
