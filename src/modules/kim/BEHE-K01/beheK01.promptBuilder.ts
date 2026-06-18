/**
 * BEHE-K01 Prompt Builder
 */

import type { KimPatternPromptPayload, KimPatternMemoryUseDirective } from "@/src/types/kimPatternsSupport.types";
import type { BeheK01DetectionResult } from "./beheK01.detector";

export function buildBeheK01PromptPayload(detection: BeheK01DetectionResult): KimPatternPromptPayload {
  const memoryDirective: KimPatternMemoryUseDirective = {
    directiveId: `behe-k01-directive-${Date.now()}`,
    appliesToModuleId: "BEHE-K01",
    hardDirective: true,
    requiredToUseOnEveryRelevantTurn: true,
    notKeywordGated: true,
    notLimitedToSessionStart: true,
    notLimitedToFirstTwoTurns: true,
    layersUsed: ["buffer", "state.dat", "user.dat", "logs.dat"],
    directiveText:
      "Use BEHE-K01 caregiver control pattern data at every relevant Kim turn where the engine includes it, including turn 5+ and later sessions. Not keyword-gated. Not limited to greeting. Do not mention storage. Do not use Elias data. Do not blame. Do not diagnose.",
  };

  return {
    persona: "kim",
    moduleId: "BEHE-K01",
    compactPrompt:
      "BEHE-K01 active. Kim-only. Name caregiver control patterns without blaming. Explore what control costs Kim. No diagnosis, no labeling as 'toxic' or 'manipulative'. Use supplied Kim memory at every relevant turn, including turn 5+.",
    fullPrompt:
      "You are Kim inside RecoFree. BEHE-K01 is active. The user is a caregiver who may be engaging in control behaviors (checking, monitoring, threatening, ultimatums) toward their addicted loved one. Your role: NAME the pattern without blaming. Explore what it costs Kim. Acknowledge the exhaustion. Never say 'you are controlling' or 'you are toxic'. Never advise to 'check his phone' or 'threaten harder'. Frame as: 'I hear that you are doing a lot to try to keep things safe. What does that cost you?' Use only Kim-scoped memory supplied by the engine. Hard directive: use BEHE-K01 memory at every relevant Kim turn, including turn 5+ and later sessions. This is not keyword-gated and not limited to first 1-2 messages. Do not mention storage. Do not use Elias data.",
    selectedInterventionType: detection.selectedInterventionType,
    memoryDirective,
    forbiddenOutput: [
      "jij bent controlerend",
      "jij bent manipulatief",
      "jij bent toxic",
      "je bent de politie",
      "check zijn telefoon",
      "controleer zijn telefoon",
      "dreig harder",
      "stel strengere ultimatums",
      "als je echt grenzen had",
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
