/**
 * IKST01 - Ik-sterkte herstel Prompt Builder
 */
import type { EliasSelfAcceptancePromptPayload } from "../../../../types/eliasSelfAcceptanceCluster.types";
import type { Ikst01DetectionResult } from "./ikst01.detector";

const COMPACT_PROMPT = "IKST01 active. Elias-only. User acted impulsively or emotion-led. Separate feeling from command. Do not shame impulsivity. Do not diagnose personality. Feelings are information, not orders. Ego strength is buildable. store:false.";

const FULL_PROMPT = "You are Elias inside RecoFree. IKST01 is active. The user is a person in recovery. The engine detected impulsive or emotion-led action language. Do not shame impulsivity. Do not diagnose personality disorder. Do not say feelings are wrong. Help the user separate feeling from command: a feeling is information, not an order to act. Reality-test what is known vs. what is filled in. Ego strength is buildable, not a fixed trait. If relevant, bridge to IDEN01 (identity) or STO01 (distress tolerance). store:false.";

const FORBIDDEN_OUTPUT = [
  "je hebt geen ik-sterkte",
  "je bent impulsief",
  "je bent onvolwassen",
  "je moet je gevoel negeren",
  "gevoelens zijn fout",
  "dit is een persoonlijkheidsprobleem",
  "diagnose",
  "Kim",
];

export function buildIkst01PromptPayload(
  detection: Ikst01DetectionResult,
  sessionId: string,
  turnId: string
): EliasSelfAcceptancePromptPayload {
  return {
    persona: "elias",
    moduleId: "IKST01",
    selectedInterventionType: detection.selectedInterventionType,
    compactPrompt: COMPACT_PROMPT,
    fullPrompt: FULL_PROMPT,
    memoryDirective: {
      directiveId: `ikst01_directive_${sessionId}_${turnId}`,
      moduleId: "IKST01",
      hardDirective: true,
      useAtEveryRelevantTurn: true,
      useAtTurnFivePlus: true,
      notKeywordGated: true,
      notLimitedToSessionStart: true,
      notLimitedToFirstTwoTurns: true,
      layersUsed: ["buffer", "state.dat", "user.dat", "logs.dat"],
      directiveText: "Use stored Elias-only context for IKST01 if therapeutically relevant in this answer. Apply it gently without mentioning memory, storage, hidden inference or files. Do not diagnose. Do not override crisis protocol.",
    },
    forbiddenOutput: FORBIDDEN_OUTPUT,
    store: false,
    gptMayDiagnose: false,
    gptMayUseKimData: false,
    gptMayOverrideCrisis: false,
  };
}
