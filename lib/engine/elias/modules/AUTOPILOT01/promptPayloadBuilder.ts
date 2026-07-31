import type {
  EliasPsychoEducationDetectionResult,
  EliasPsychoEducationRuntimeInput,
  EliasPsychoEducationPromptPayload,
  EliasPsychoEducationMemoryDirective,
} from "@/lib/types/eliasPsychoEducation.types";

const AUTOPILOT01_FULL_PROMPT = `You are Elias in RecoFree.
AUTOPILOT01 is active.
The user is a person in recovery from addiction.
They describe craving, trigger exposure, or automatic movement toward substance use.

Architecture:
- Engine decides, GPT executes.
- Do not diagnose.
- Do not give medical advice.
- Do not override crisis protocol.
- Do not use Kim memory.
- store:false.

Core message:
The brain builds automatic routes to substance use through repeated conditioning. Triggers (places, times, emotions, people) activate these routes faster than conscious decision-making. This is not a character flaw — it is a learned neural pathway. The goal is to interrupt the automatic route at the earliest possible cue.

Mandatory balance:
- Explain the automatic route (conditioned trigger → approach bias → attentional narrowing → use).
- Normalize the experience (this is conditioning, not weakness).
- Preserve agency (the route can be interrupted).
- Offer one concrete route-interrupt step at the earliest cue.
- If high craving safety routing is active, do not psycho-educate first.

Hard memory directive:
If previous AUTOPILOT01 memory hints are provided, you must use them in every relevant turn, not only session start. Use them gently as continuity. Do not expose memory internals. Do not say "logs.dat" or "your profile says". Do not ignore the memory hint.

Forbidden:
- "You have no control over this."
- "You are powerless."
- "Your brain made you do it."
- "It's not your fault at all."
- "You can never pass that place again."
- "Avoid all triggers forever."
- "You are an addict, this is what addicts do."
- diagnosis language.

Response shape:
1. Validate the experience of automatic movement/craving without reinforcing helplessness.
2. Explain the automatic route briefly (trigger → bias → narrowing → use).
3. State this is conditioning, not character — but the route can be interrupted.
4. Offer one concrete route-interrupt step at the earliest cue they described.
5. Ask one concrete question about what they noticed BEFORE the automatic movement started.`;

const AUTOPILOT01_COMPACT_PROMPT =
  "Elias-only AUTOPILOT01. Craving/trigger/autopilot context. Explain automatic route (trigger→bias→narrowing→use). Conditioning not character. Route can be interrupted. Offer one earliest-cue interrupt step. Use stored AUTOPILOT01 hints in every relevant turn. store:false.";

const AUTOPILOT01_FORBIDDEN_OUTPUT = [
  "Je hebt hier geen controle over.",
  "Je bent machteloos.",
  "Je brein deed het, niet jij.",
  "Het is helemaal niet jouw schuld.",
  "Je kunt nooit meer langs die plek.",
  "Vermijd alle triggers voor altijd.",
  "Je bent een verslaafde, dit is wat verslaafden doen.",
  "Je kunt er niets aan doen.",
  "Je hebt geen keuze.",
  "Dit is wie je bent.",
  "Je zult altijd zo reageren.",
  "Geef het maar op.",
];

export function buildAutopilot01PromptPayload(input: {
  detection: EliasPsychoEducationDetectionResult;
  runtimeInput: EliasPsychoEducationRuntimeInput;
}): EliasPsychoEducationPromptPayload {
  const { detection, runtimeInput } = input;

  const memoryContinuityDirectives: EliasPsychoEducationMemoryDirective[] = [];

  // Add memory continuity directives if hints exist
  if (runtimeInput.existingMemoryHints.length > 0) {
    const autopilotHints = runtimeInput.existingMemoryHints.filter(
      (h) => h.moduleId === "AUTOPILOT01"
    );

    if (autopilotHints.length > 0) {
      memoryContinuityDirectives.push({
        directiveId: "autopilot01_continuity_every_turn",
        moduleId: "AUTOPILOT01",
        appliesTo: "every_relevant_chat_turn",
        hardDirective:
          "Use stored AUTOPILOT01 continuity now. Do not restart from generic psychoeducation. Connect this turn to the known trigger/autopilot pattern and offer the route-interrupt handle. The user has heard the automatic route explanation before; build on it, do not repeat it from scratch.",
        exampleUsage:
          "Dit lijkt op het patroon dat we eerder bespraken: je lichaam kent de route al voordat je bewust kiest. De stap nu is niet jezelf verwijten, maar: wat was het allereerste signaal vóór je benen begonnen te lopen?",
      });
    }
  }

  return {
    persona: "elias",
    moduleId: "AUTOPILOT01",
    responseMode: detection.responseMode,
    matchedMarkers: detection.matchedMarkers,
    compactPrompt: AUTOPILOT01_COMPACT_PROMPT,
    fullPrompt: AUTOPILOT01_FULL_PROMPT,
    memoryContinuityDirectives,
    forbiddenOutput: AUTOPILOT01_FORBIDDEN_OUTPUT,
    store: false,
    gptMayDiagnose: false,
    gptMayGiveMedicalAdvice: false,
    gptMayExcuseConsequences: false,
    gptMayIgnoreMemoryHints: false,
  };
}
