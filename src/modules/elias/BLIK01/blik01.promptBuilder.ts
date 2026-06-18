/**
 * BLIK01 - Blikseminslag Prompt Builder
 */
import type { EliasSelfAcceptancePromptPayload } from "../../../types/eliasSelfAcceptanceCluster.types";
import type { Blik01DetectionResult } from "./blik01.detector";

const COMPACT_PROMPT = "BLIK01 active. Elias-only. Sudden shock to a concrete support pillar. Do not diagnose, minimize, silver-line, or override crisis. If PAAL01 data is provided, use it gently; otherwise work from current text. Separate pillar loss from total self-collapse. store:false.";

const FULL_PROMPT = "You are Elias inside RecoFree. BLIK01 is active. The user is a person in recovery, not a caregiver. The engine detected a sudden shock or loss affecting a concrete support pillar. This is not general crisis detection; crisis has priority and was checked by the engine. Name the shock gently, do not minimize it, do not say everything happens for a reason, do not diagnose. Help the user separate one affected pillar from the whole self. If known PAAL01 pillars are supplied, use them only as user-owned context. Ask what still stands or what one stabilizing action is possible. If grief is dominant, bridge to ROUW01. If rebuilding supports is relevant after stabilization, bridge to PAAL01. store:false.";

const FORBIDDEN_OUTPUT = [
  "alles gebeurt met een reden",
  "bekijk het positief",
  "je hebt die pilaar niet nodig",
  "dit is trauma",
  "dit is een crisis",
  "alles is weg",
  "je gaat hervallen",
  "dit verklaart je gebruik",
  "het valt wel mee",
  "in PAAL01 staat",
  "Kim",
];

export function buildBlik01PromptPayload(
  detection: Blik01DetectionResult,
  sessionId: string,
  turnId: string
): EliasSelfAcceptancePromptPayload {
  return {
    persona: "elias",
    moduleId: "BLIK01",
    selectedInterventionType: detection.selectedInterventionType,
    compactPrompt: COMPACT_PROMPT,
    fullPrompt: FULL_PROMPT,
    memoryDirective: {
      directiveId: `blik01_directive_${sessionId}_${turnId}`,
      moduleId: "BLIK01",
      hardDirective: true,
      useAtEveryRelevantTurn: true,
      useAtTurnFivePlus: true,
      notKeywordGated: true,
      notLimitedToSessionStart: true,
      notLimitedToFirstTwoTurns: true,
      layersUsed: ["buffer", "state.dat", "user.dat", "logs.dat"],
      directiveText: "Use stored Elias-only context for BLIK01 if therapeutically relevant in this answer. Apply it gently without mentioning memory, storage, hidden inference or files. Do not diagnose. Do not override crisis protocol. Keep responsibility and compassion balanced.",
    },
    forbiddenOutput: FORBIDDEN_OUTPUT,
    store: false,
    gptMayDiagnose: false,
    gptMayUseKimData: false,
    gptMayOverrideCrisis: false,
  };
}
