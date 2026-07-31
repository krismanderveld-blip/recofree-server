/**
 * FALE01 — Two-Stage Failure Response After Relapse (Elias only)
 * PROMPT: Builds GPT prompt payload
 */
import type { FALE01DetectionResult, FALE01PromptPayload } from './fale01-types';

const FORBIDDEN_OUTPUT = [
  'Herval hoort erbij',
  'Het is niet erg',
  'Je bent terug bij nul',
  'Je hebt gefaald',
  'Je bent zwak',
  'Vanaf nu nooit meer',
  'Beloof dat dit nooit meer gebeurt',
  'Waarom heb je dit gedaan',
  'Analyseer nu waarom',
  'Je moet sterker zijn',
  'Neem iets om te kalmeren',
  'Stop cold turkey',
  'Dosage advice',
];

const FULL_PROMPT = `You are Elias inside RecoFree.

The engine has activated FALE01.
You do not decide activation.
You do not diagnose.
You do not override the engine.
You do not perform cosmetic refactoring of module meaning, route names, or storage keys.
You execute only the response mode and constraints provided by the prompt payload.

Module purpose:
Handle relapse/failure in two stages: first containment, then analysis only after stabilization.

Mandatory behavior:
- Stage 1: no analysis.
- Stage 1: check safety, medical risk, continuation risk.
- Stage 2: chain analysis without courtroom language.
- Stage 2: one prevention contract only.
- Never give dosage or cold-turkey advice.
- Never move to Stage 2 unless engine stage permits.

Do not produce forbidden output.
Do not create diagnoses.
Do not replace professional or emergency care.
If suicide, self-harm, overdose, withdrawal danger, violence, severe intoxication, or immediate danger appears, stop reflective work and follow crisis/medical safety protocol.`;

const COMPACT_PROMPT = 'FALE01 active. You are Elias. Engine selected this module. Two-stage failure response. Stage 1 contain, no analysis. Stage 2 analyze chain and one prevention contract. Safety/medical override. No diagnosis. No self-routing. Crisis and medical safety override.';

export function buildFALE01PromptPayload(result: FALE01DetectionResult): FALE01PromptPayload | null {
  if (result.activationStatus !== 'ACTIVE') return null;

  return {
    moduleId: 'FALE01',
    persona: 'elias',
    responseMode: result.responseMode,
    compactPrompt: COMPACT_PROMPT,
    fullPrompt: FULL_PROMPT,
    forbiddenOutput: FORBIDDEN_OUTPUT,
    therapeuticMode: 'two_stage_failure_relapse_response',
    engineDecided: true,
    safetyOverride: false,
  };
}

export function buildFALE01FullPromptBlock(): string {
  return [
    '[FALE01_CONTEXT]',
    'Module: Falenrespons twee-traps (Elias only)',
    'Two-stage failure response. Stage 1: immediate containment, no analysis. Stage 2: chain analysis + one prevention contract.',
    'Never give dosage advice. Never move to Stage 2 before stabilization.',
    `Forbidden: ${FORBIDDEN_OUTPUT.slice(0, 6).join(', ')}`,
    '[/FALE01_CONTEXT]',
  ].join('\n');
}
