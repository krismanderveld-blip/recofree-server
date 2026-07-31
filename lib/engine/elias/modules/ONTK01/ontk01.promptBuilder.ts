/**
 * ONTK01 - Ontkenningspatroon Prompt Builder
 */
import type { EliasSelfAcceptancePromptPayload } from "../../../../types/eliasSelfAcceptanceCluster.types";
import type { Ontk01DetectionResult } from "./ontk01.detector";

const COMPACT_PROMPT = "ONTK01 active. Elias-only. User minimizes/rationalizes own use. Mirror gently, do not accuse, do not diagnose denial, do not shame. Identify permission sentence and reconnect fact/consequence. store:false.";

const FULL_PROMPT = "You are Elias inside RecoFree. ONTK01 is active. The user is a person in addiction recovery. The engine detected language that may minimize, normalize, rationalize or bargain with the user's own substance use. Do not accuse. Do not say 'you are in denial'. Do not shame. Do not diagnose. Do not remove consequences. Gently mirror the sentence, slow it down, and invite factual honesty without self-attack. Help the user identify the permission sentence and reconnect to recovery values. Crisis and relapse-intent safety are handled by the engine. store:false.";

const FORBIDDEN_OUTPUT = [
  "je liegt tegen jezelf",
  "je bent in ontkenning",
  "je bent een leugenaar",
  "het heeft geen gevolgen",
  "diagnose",
  "Kim",
  "in state.dat staat",
];

export function buildOntk01PromptPayload(
  detection: Ontk01DetectionResult,
  sessionId: string,
  turnId: string
): EliasSelfAcceptancePromptPayload {
  return {
    persona: "elias",
    moduleId: "ONTK01",
    selectedInterventionType: detection.selectedInterventionType,
    compactPrompt: COMPACT_PROMPT,
    fullPrompt: FULL_PROMPT,
    memoryDirective: {
      directiveId: `ontk01_directive_${sessionId}_${turnId}`,
      moduleId: "ONTK01",
      hardDirective: true,
      useAtEveryRelevantTurn: true,
      useAtTurnFivePlus: true,
      notKeywordGated: true,
      notLimitedToSessionStart: true,
      notLimitedToFirstTwoTurns: true,
      layersUsed: ["buffer", "state.dat", "user.dat", "projections.dat", "logs.dat"],
      directiveText: "Use stored Elias-only context for ONTK01 if therapeutically relevant in this answer. Apply it gently without mentioning memory, storage, hidden inference or files. Do not diagnose. Do not override crisis protocol. Keep responsibility and compassion balanced.",
    },
    forbiddenOutput: FORBIDDEN_OUTPUT,
    store: false,
    gptMayDiagnose: false,
    gptMayUseKimData: false,
    gptMayOverrideCrisis: false,
  };
}
