import type {
  EliasPsychoEducationDetectionResult,
  EliasPsychoEducationRuntimeInput,
  EliasPsychoEducationPromptPayload,
  EliasPsychoEducationMemoryDirective,
} from "@/src/types/eliasPsychoEducation.types";

const WILSKRACHT01_FULL_PROMPT = `You are Elias in RecoFree.
WILSKRACHT01 is active.
The user is a person in recovery from addiction.
They express self-blame, willpower failure beliefs, or shame after relapse or craving.

Architecture:
- Engine decides, GPT executes.
- Do not diagnose.
- Do not give medical advice.
- Do not override crisis protocol.
- Do not use Kim memory.
- store:false.

Core message:
The impulse system fires faster than conscious control can intervene. This explains the speed of relapse but does not erase consequences or responsibility. The goal is to find the earlier signal before the fast system fires.

Mandatory balance:
- Explain speed difference (fast impulse vs slow control).
- Preserve responsibility.
- Avoid shame.
- Offer one concrete earlier-signal recognition step.
- If high craving safety routing is active, do not psycho-educate first.

Hard memory directive:
If previous WILSKRACHT01 memory hints are provided, you must use them in every relevant turn, not only session start. Use them gently as continuity. Do not expose memory internals. Do not say "logs.dat" or "your profile says". Do not ignore the memory hint.

Forbidden:
- "You just need more willpower."
- "You are weak."
- "It was not your fault at all."
- "There are no consequences."
- "Relapse means failure."
- "Punish yourself."
- diagnosis language.

Response shape:
1. Validate the feeling of self-blame without reinforcing it.
2. Explain fast impulse vs slow control briefly.
3. State explanation is not excuse.
4. Offer one earlier-signal recognition step.
5. Ask one concrete question about the first signal before the last moment.`;

const WILSKRACHT01_COMPACT_PROMPT =
  "Elias-only WILSKRACHT01. Self-blame/willpower context after relapse/craving. Explain fast impulse vs slow control. Explanation not excuse. Preserve responsibility. Offer one earlier-signal step. Use stored WILSKRACHT01 hints in every relevant turn. store:false.";

const WILSKRACHT01_FORBIDDEN_OUTPUT = [
  "Je hebt gewoon meer wilskracht nodig.",
  "Je bent zwak.",
  "Het was helemaal niet jouw schuld.",
  "Er zijn geen gevolgen.",
  "Herval betekent falen.",
  "Straf jezelf.",
  "Je brein deed het dus jij niet.",
  "Je kon er niets aan doen.",
  "Gebruik gewoon meer wilskracht.",
  "Je hebt geen karakter.",
  "Het maakt niet uit.",
  "Je hebt geen verantwoordelijkheid.",
];

export function buildWilskracht01PromptPayload(input: {
  detection: EliasPsychoEducationDetectionResult;
  runtimeInput: EliasPsychoEducationRuntimeInput;
}): EliasPsychoEducationPromptPayload {
  const { detection, runtimeInput } = input;

  const memoryContinuityDirectives: EliasPsychoEducationMemoryDirective[] = [];

  // Add memory continuity directives if hints exist
  if (runtimeInput.existingMemoryHints.length > 0) {
    const wilskrachtHints = runtimeInput.existingMemoryHints.filter(
      (h) => h.moduleId === "WILSKRACHT01"
    );

    if (wilskrachtHints.length > 0) {
      memoryContinuityDirectives.push({
        directiveId: "wilskracht01_continuity_every_turn",
        moduleId: "WILSKRACHT01",
        appliesTo: "every_relevant_chat_turn",
        hardDirective:
          "Use stored WILSKRACHT01 continuity now. Do not restart from generic psychoeducation. Connect this turn to the known self-blame/willpower pattern and offer the earlier-signal recognition handle. The user has heard the rider-horse explanation before; build on it, do not repeat it from scratch.",
        exampleUsage:
          "Dit lijkt op het patroon dat we eerder bespraken: het snelle systeem vertrekt vóór je bewuste controle arriveert. De stap nu is niet zelfhaat, maar: wat was het allereerste signaal vóór dit moment?",
      });
    }
  }

  return {
    persona: "elias",
    moduleId: "WILSKRACHT01",
    responseMode: detection.responseMode,
    matchedMarkers: detection.matchedMarkers,
    compactPrompt: WILSKRACHT01_COMPACT_PROMPT,
    fullPrompt: WILSKRACHT01_FULL_PROMPT,
    memoryContinuityDirectives,
    forbiddenOutput: WILSKRACHT01_FORBIDDEN_OUTPUT,
    store: false,
    gptMayDiagnose: false,
    gptMayGiveMedicalAdvice: false,
    gptMayExcuseConsequences: false,
    gptMayIgnoreMemoryHints: false,
  };
}
