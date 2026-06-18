/**
 * PAAL01 — Prompt payload builder
 * Builds the GPT prompt payload for steunpilaren interventions.
 */

import type {
  SteunpilarenDetectionResult,
  SteunpilarenRuntimeInput,
  SteunpilarenPromptPayload,
  SteunpilarenMemoryUseDirective,
} from "@/src/types/eliasSteunpilaren.types";

const FORBIDDEN_OUTPUT = [
  "je hebt geen steun",
  "je bent alleen",
  "zonder steunpilaren ga je terugvallen",
  "je netwerk is te klein",
  "je moet meer mensen hebben",
  "score",
  "punten",
  "level",
  "badge",
  "streak",
  "ik heb opgeslagen",
  "in user.dat staat",
  "Kim",
  "je moet dit invullen",
  "zonder dit werkt herstel niet",
];

const COMPACT_PROMPT =
  "PAAL01 active. Elias-only. Steunpilaren inventaris. Invite user to identify or reflect on personal support pillars (people, routines, places, beliefs). No diagnosis, no scoring, no gamification. Reference existing pilaren from memory if available. Introduce balkmetafoor on first use. Crisis override already checked by engine. Use stored PAAL01 memory at every relevant turn, including turn 5+.";

const FULL_PROMPT =
  "You are Elias inside RecoFree. PAAL01 is active. The user is a person in addiction recovery, not a caregiver. The engine has determined this is an appropriate moment to reflect on steunpilaren (support pillars). Your task is to gently invite the user to identify or reflect on what holds them up: people, routines, places, beliefs, activities. Do not diagnose. Do not pathologize absence of support. Do not score or gamify. Do not say the user is alone or broken. If the user names pillars, acknowledge them warmly. If the user says they have nothing, do not confirm that as truth — gently explore whether something small might count. If this is the first activation, introduce the concept of steunpilaren and the balkmetafoor (balance between what weighs and what supports). Reference existing stored pilaren from memory if available and relevant. Use a warm, inviting tone. Ask one open question. Hard memory directive: use stored PAAL01 data at every relevant Elias turn, including turn 5+ and later sessions, not only greeting or first two turns. Do not mention storage or memory mechanics.";

function buildMemoryDirective(
  runtimeInput: SteunpilarenRuntimeInput
): SteunpilarenMemoryUseDirective {
  const pilarenLabels = runtimeInput.existingEliasSteunpilarenHints.storedSteunpilaren
    .slice(0, 3)
    .map((p) => p.label)
    .join(", ");

  const directiveText = pilarenLabels
    ? `Use stored PAAL01 data at every relevant Elias turn, including turn 5+ and later sessions. User has identified steunpilaren: ${pilarenLabels}. Reference gently when relevant. Do not mention storage.`
    : "Use stored PAAL01 data at every relevant Elias turn, including turn 5+ and later sessions. This is not keyword-gated and not limited to session greeting or first 1-2 messages. When relevant, gently reference the user's identified steunpilaren. Never expose storage mechanics.";

  return {
    directiveId: `paal01_directive_${runtimeInput.turnId}`,
    appliesToModuleId: "PAAL01",
    hardDirective: true,
    useAtSessionGreeting: true,
    useAtEveryRelevantTurn: true,
    useAtTurnFivePlus: true,
    notKeywordGated: true,
    notLimitedToFirstTwoTurns: true,
    requiredLayersToRead: ["buffer", "state.dat", "user.dat", "logs.dat"],
    requiredLayersToWriteOnActivation: ["buffer", "state.dat", "user.dat", "logs.dat"],
    userFacingDisclosureAllowed: false,
    directiveText,
  };
}

export function buildPaal01PromptPayload(input: {
  detection: SteunpilarenDetectionResult;
  runtimeInput: SteunpilarenRuntimeInput;
}): SteunpilarenPromptPayload | null {
  const { detection, runtimeInput } = input;

  if (detection.activationStatus !== "ACTIVE") return null;
  if (runtimeInput.persona !== "elias") return null;

  return {
    persona: "elias",
    moduleId: "PAAL01",
    compactPrompt: COMPACT_PROMPT,
    fullPrompt: FULL_PROMPT,
    triggerContext: detection.triggerContext,
    existingSteunpilaren: runtimeInput.existingEliasSteunpilarenHints.storedSteunpilaren,
    balkmetafoorInitialized: runtimeInput.balkmetafoorInitialized,
    memoryDirective: buildMemoryDirective(runtimeInput),
    forbiddenOutput: FORBIDDEN_OUTPUT,
    store: false,
    gptMayDiagnose: false,
    gptMayUseKimData: false,
    gptMayOverrideCrisis: false,
  };
}
