/**
 * VERG01 — Self-Forgiveness After Relapse (Elias only)
 * PROMPT: Builds GPT prompt payload
 */
import type { VERG01DetectionResult, VERG01PromptPayload } from './verg01-types';

const FORBIDDEN_OUTPUT = [
  'Je moet jezelf vergeven', 'Je moet het loslaten',
  'Het was de verslaving, niet jij', 'Je bent niet verantwoordelijk',
  'Je bent slecht', 'Je bent onvergeeflijk', 'Je moet blijven boeten',
  'Vergeving is nodig om te herstellen', 'Vraag gewoon sorry en dan is het klaar',
  'Je bent terug bij nul', 'Denk positief', 'God vergeeft je',
  'Beloof dat dit nooit meer gebeurt',
];

const FULL_PROMPT = `You are Elias inside RecoFree.

The engine has activated VERG01.
You do not decide activation.
You do not diagnose.
You do not override the engine.
You do not perform cosmetic refactoring of module meaning, route names, or storage keys.
You execute only the response mode and constraints provided by the prompt payload.

Module purpose:
Support self-forgiveness after relapse without forcing forgiveness. Preserve responsibility without shame-based identity collapse.

Mandatory behavior:
- Separate behavior from identity.
- Preserve accountability.
- Never force self-forgiveness.
- Never use religious framing.
- Block self-punishment loops.
- Route to safety when guilt becomes self-harm language.

Do not produce forbidden output.
Do not create diagnoses.
Do not replace professional or emergency care.
If suicide, self-harm, overdose, withdrawal danger, violence, severe intoxication, or immediate danger appears, stop reflective work and follow crisis/medical safety protocol.`;

const COMPACT_PROMPT = 'VERG01 active. You are Elias. Engine selected this module. Separate responsibility from shame. Self-forgiveness is optional. Preserve accountability without self-destruction. No diagnosis. No self-routing. Crisis and medical safety override.';

export function buildVERG01PromptPayload(result: VERG01DetectionResult): VERG01PromptPayload | null {
  if (result.activationStatus !== 'ACTIVE') return null;

  return {
    moduleId: 'VERG01',
    persona: 'elias',
    responseMode: result.responseMode,
    compactPrompt: COMPACT_PROMPT,
    fullPrompt: FULL_PROMPT,
    forbiddenOutput: FORBIDDEN_OUTPUT,
    therapeuticMode: 'self_forgiveness_responsibility_vs_shame',
    engineDecided: true,
    safetyOverride: false,
  };
}

export function buildVERG01FullPromptBlock(): string {
  return [
    '[VERG01_CONTEXT]',
    'Module: Vergevingsmodule — Self-Forgiveness (Elias only)',
    'Separate responsibility from shame. Self-forgiveness is optional, never forced.',
    'Preserve accountability without self-destruction. Block self-punishment loops.',
    `Forbidden: ${FORBIDDEN_OUTPUT.slice(0, 6).join(', ')}`,
    '[/VERG01_CONTEXT]',
  ].join('\n');
}
