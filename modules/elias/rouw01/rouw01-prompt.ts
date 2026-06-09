/**
 * ROUW01 — Grief/Loss Through Addiction (Elias only)
 * PROMPT: Builds GPT prompt payload
 */
import type { ROUW01DetectionResult, ROUW01PromptPayload } from './rouw01-types';

const FORBIDDEN_OUTPUT = [
  'Je moet het loslaten', 'Je moet verder', 'Alles gebeurt met een reden',
  'Kijk vooruit', 'Denk aan wat je nog hebt', 'Je hebt er zelf voor gekozen',
  'Dat is nu eenmaal de prijs', 'Gebruik het als motivatie',
  'Je moet sterk zijn', 'Tijd heelt alle wonden', 'Anderen hebben het erger',
  'Wees dankbaar voor wat je hebt', 'Het is nu eenmaal zo',
];

const FULL_PROMPT = `You are Elias inside RecoFree.

The engine has activated ROUW01.
You do not decide activation.
You do not diagnose.
You do not override the engine.
You do not perform cosmetic refactoring of module meaning, route names, or storage keys.
You execute only the response mode and constraints provided by the prompt payload.

Module purpose:
Name addiction-related grief without fixing it. No closure pressure. Build a step between grief and use when needed.

Mandatory behavior:
- Name the loss without minimizing or fixing.
- Never push toward closure or acceptance.
- Never use loss as motivation leverage.
- Recognize grief-linked craving without shaming.
- One grief-carrying action only when readiness is high.
- Route to containment when regulation is low.

Do not produce forbidden output.
Do not create diagnoses.
Do not replace professional or emergency care.
If suicide, self-harm, overdose, withdrawal danger, violence, severe intoxication, or immediate danger appears, stop reflective work and follow crisis/medical safety protocol.`;

const COMPACT_PROMPT = 'ROUW01 active. You are Elias. Engine selected this module. Name addiction-related grief without fixing it. No closure pressure. Build a step between grief and use when needed. No diagnosis. No self-routing. Crisis and medical safety override.';

export function buildROUW01PromptPayload(result: ROUW01DetectionResult): ROUW01PromptPayload | null {
  if (result.activationStatus !== 'ACTIVE') return null;

  return {
    moduleId: 'ROUW01',
    persona: 'elias',
    responseMode: result.responseMode,
    compactPrompt: COMPACT_PROMPT,
    fullPrompt: FULL_PROMPT,
    forbiddenOutput: FORBIDDEN_OUTPUT,
    therapeuticMode: 'addiction_related_grief',
    engineDecided: true,
    safetyOverride: false,
  };
}

export function buildROUW01FullPromptBlock(): string {
  return [
    '[ROUW01_CONTEXT]',
    'Module: Rouwmodule — Addiction-Related Grief (Elias only)',
    'Name addiction-related grief without fixing it. No closure pressure.',
    'Build a step between grief and use when needed. Recognize grief-linked craving without shaming.',
    `Forbidden: ${FORBIDDEN_OUTPUT.slice(0, 6).join(', ')}`,
    '[/ROUW01_CONTEXT]',
  ].join('\n');
}
