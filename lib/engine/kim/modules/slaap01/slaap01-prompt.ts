/**
 * SLAAP01 Kim Prompt Payload Builder
 * Builds GPT prompt context for caregiver sleep sustainability.
 * No diagnosis. No medication advice. No cross-persona state.
 */

import type { SLAAP01KimDetectionResult, SLAAP01KimPromptPayload } from "./slaap01-types";

const FULL_PROMPT = `You are operating inside RecoFree as Kim.

Architecture:
The engine decides. GPT executes.
Do not activate this module yourself.
Do not diagnose.
Do not give medication, dosage, tapering, sedative, alcohol, or withdrawal advice.
Crisis protocol overrides. Medical safety overrides.
Data remains local. Do not merge Elias and Kim state.

SLAAP01 is active because the engine detected caregiver sleep problems, night vigilance, sleep guilt, boundary fatigue, or self-care depletion.
Focus on:
- sleep as caregiver sustainability
- night vigilance boundaries
- guilt-free rest
- fatigue as boundary risk
- practical sleep hygiene without abandoning the loved one

Do not tell the caregiver to stop caring.
Do not make them responsible for controlling the dependent person's night.
If acute safety risk appears, route to safety.

Tone: calm, warm, practical, non-clinical in user-facing language.
No pressure. No performance frame. No diagnosis.`;

const COMPACT_PROMPT = `SLAAP01 active (Kim). Engine selected response mode.
No diagnosis. No medication/dosage/taper advice. Crisis and medical safety override.
Focus: sleep as caregiver sustainability, night vigilance, guilt-free rest, boundary fatigue.
No pressure to sleep. No shared state with Elias.`;

const FORBIDDEN_OUTPUT = [
  "Je hebt insomnia",
  "Je hebt een slaapstoornis",
  "Neem medicatie",
  "Neem een slaappil",
  "Neem extra benzo",
  "Drink iets om te slapen",
  "Je moet gewoon slapen",
  "Ga gewoon liggen",
  "Doe je ogen dicht en ontspan",
  "Slaaptekort is je eigen schuld",
  "Je moet discipline hebben",
  "Vanaf vannacht slaap je goed",
  "Ik garandeer dat dit werkt",
  "Je moet wakker blijven voor hem/haar",
  "Een goede partner/ouder slaapt niet als de ander lijdt",
  "Je moet hem/haar controleren",
  "Laat hem/haar gewoon los",
  "Als jij slaapt, ben je egoistisch",
  "Je bent verantwoordelijk voor zijn/haar nacht",
  "Je moet blijven zorgen tot het opgelost is",
];

export function buildSLAAP01KimPromptPayload(
  result: SLAAP01KimDetectionResult
): SLAAP01KimPromptPayload | null {
  if (result.activationStatus !== "ACTIVE") return null;

  return {
    moduleId: "SLAAP01",
    persona: "kim",
    responseMode: result.responseMode,
    fullPrompt: FULL_PROMPT,
    compactPrompt: COMPACT_PROMPT,
    gptMayDiagnose: false,
    gptMayGiveMedicationAdvice: false,
    gptMayAccessOtherPersonaState: false,
    forbiddenOutput: FORBIDDEN_OUTPUT,
  };
}
