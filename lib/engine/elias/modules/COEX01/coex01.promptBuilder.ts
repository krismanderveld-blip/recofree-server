/**
 * COEX01 - Co-existentie verantwoordelijkheid Prompt Builder
 */
import type { EliasSelfAcceptancePromptPayload } from "../../../../types/eliasSelfAcceptanceCluster.types";
import type { Coex01DetectionResult } from "./coex01.detector";

const COMPACT_PROMPT = "COEX01 active. Elias-only. User shows blame/responsibility confusion. Separate fault from responsibility. Validate injustice without removing agency. Do not add total blame or total absolution. One next step, not all steps. store:false.";

const FULL_PROMPT = "You are Elias inside RecoFree. COEX01 is active. The user is a person in addiction recovery. The engine detected blame/responsibility confusion: external blame, total self-blame, or a mix. Do not say 'stop playing victim'. Do not say 'everything is your fault'. Do not remove all responsibility. Do not add all blame. Validate what was genuinely unfair. Separate fault (past) from responsibility (next step). Help the user identify one concrete next step they can own without owning everything. Acceptance is not approval. Responsibility is not fault. If family context is dominant, bridge to GEZIN01. If role context is dominant, bridge to ROL01. store:false.";

const FORBIDDEN_OUTPUT = [
  "stop met slachtoffer spelen",
  "alles is jouw schuld",
  "het is allemaal jouw schuld",
  "je hebt geen verantwoordelijkheid",
  "door hen mag je drinken",
  "aanvaarden is goedkeuren",
  "verantwoordelijkheid betekent schuld",
  "je bent cynisch",
  "diagnose",
  "Kim",
];

export function buildCoex01PromptPayload(
  detection: Coex01DetectionResult,
  sessionId: string,
  turnId: string
): EliasSelfAcceptancePromptPayload {
  return {
    persona: "elias",
    moduleId: "COEX01",
    selectedInterventionType: detection.selectedInterventionType,
    compactPrompt: COMPACT_PROMPT,
    fullPrompt: FULL_PROMPT,
    memoryDirective: {
      directiveId: `coex01_directive_${sessionId}_${turnId}`,
      moduleId: "COEX01",
      hardDirective: true,
      useAtEveryRelevantTurn: true,
      useAtTurnFivePlus: true,
      notKeywordGated: true,
      notLimitedToSessionStart: true,
      notLimitedToFirstTwoTurns: true,
      layersUsed: ["buffer", "state.dat", "user.dat", "projections.dat", "logs.dat"],
      directiveText: "Use stored Elias-only context for COEX01 if therapeutically relevant in this answer. Apply it gently without mentioning memory, storage, hidden inference or files. Do not diagnose. Do not override crisis protocol. Keep responsibility and compassion balanced.",
    },
    forbiddenOutput: FORBIDDEN_OUTPUT,
    store: false,
    gptMayDiagnose: false,
    gptMayUseKimData: false,
    gptMayOverrideCrisis: false,
  };
}
