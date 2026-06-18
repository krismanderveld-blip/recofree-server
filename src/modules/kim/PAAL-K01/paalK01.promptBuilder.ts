/**
 * PAAL-K01 Prompt Builder
 */

import type { KimPatternPromptPayload, KimPatternMemoryUseDirective } from "@/src/types/kimPatternsSupport.types";
import type { PaalK01DetectionResult } from "./paalK01.detector";

export function buildPaalK01PromptPayload(detection: PaalK01DetectionResult): KimPatternPromptPayload {
  const memoryDirective: KimPatternMemoryUseDirective = {
    directiveId: `paal-k01-directive-${Date.now()}`,
    appliesToModuleId: "PAAL-K01",
    hardDirective: true,
    requiredToUseOnEveryRelevantTurn: true,
    notKeywordGated: true,
    notLimitedToSessionStart: true,
    notLimitedToFirstTwoTurns: true,
    layersUsed: ["buffer", "state.dat", "user.dat", "logs.dat"],
    directiveText:
      "Use PAAL-K01 Kim-only support pillar/balance data at every relevant Kim turn where the engine includes it, including turn 5+ and later sessions. Not keyword-gated. Not limited to greeting. Do not mention storage. Do not use Elias data.",
  };

  return {
    persona: "kim",
    moduleId: "PAAL-K01",
    compactPrompt:
      "PAAL-K01 active. Kim-only. Inventory Kim's own support pillars and/or Kim-scoped balance feature. Not about helping the addicted partner. No score, no diagnosis, no gamification. Use supplied Kim memory at every relevant turn, including turn 5+.",
    fullPrompt:
      "You are Kim inside RecoFree. PAAL-K01 is active. The user is a caregiver/naaste, not the person in recovery. Focus on the caregiver's own support pillars: people, routines, places, values, beliefs, boundaries, body care, therapy support, micro-anchors and meaning. Do not redirect this toward supporting the addicted loved one. Do not score. Do not diagnose. Do not gamify. Do not compare. If balance feature is introduced, explain it as qualitative Kim profile content with two sides: draaglast and draagkracht. Use only Kim-scoped memory supplied by the engine. Hard directive: use PAAL-K01 memory at every relevant Kim turn, including turn 5+ and later sessions. This is not keyword-gated and not limited to first 1-2 messages. Do not mention storage.",
    selectedInterventionType: detection.selectedInterventionType,
    memoryDirective,
    forbiddenOutput: [
      "je hebt te weinig steun",
      "je draagkracht is te laag",
      "je scoort slecht",
      "je moet sterker zijn",
      "dit helpt hem beter herstellen",
      "als jij genoeg steun hebt drinkt hij minder",
      "je moet blijven",
      "je moet weggaan",
      "diagnose",
      "codependent",
      "Elias",
      "in user.dat staat",
      "storage",
      "opgeslagen",
    ],
    store: false,
    gptMayDiagnose: false,
    gptMayUseEliasData: false,
    gptMayOverrideCrisis: false,
    gptMayTellKimToControlLovedOne: false,
  };
}
