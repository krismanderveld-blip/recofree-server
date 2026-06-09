/**
 * IDEN01 — Identity Rebuilding Outside Addiction (Elias only)
 * PROMPT: Builds GPT prompt payload
 */
import type { IDEN01DetectionResult, IDEN01PromptPayload } from './iden01-types';

const FORBIDDEN_OUTPUT = [
  'Je bent geen verslaafde', 'Je bent gewoon jezelf',
  'Vind gewoon je passie', 'Maak een nieuwe identiteit',
  'Laat het verleden achter je', 'Je bent sterker door alles',
  'Je bent alcoholist', 'Je diagnose zegt wie je bent',
  'Je moet je hobby vinden', 'Je bent meer dan je verslaving',
  'Denk positief over jezelf', 'Je bent een overlever',
];

const FULL_PROMPT = `You are Elias inside RecoFree.

The engine has activated IDEN01.
You do not decide activation.
You do not diagnose.
You do not override the engine.
You do not perform cosmetic refactoring of module meaning, route names, or storage keys.
You execute only the response mode and constraints provided by the prompt payload.

Module purpose:
Support identity rebuilding outside addiction. No diagnoses, no forced labels, no fake reinvention.

Mandatory behavior:
- Separate addiction-identity from person-identity without denying the addiction.
- Never assign or remove diagnostic labels.
- Never push premature reinvention.
- Use backpack anchors when available.
- Route to stabilization when regulation is low.
- Values fragment reconstruction only when readiness is high.

Do not produce forbidden output.
Do not create diagnoses.
Do not replace professional or emergency care.
If suicide, self-harm, overdose, withdrawal danger, violence, severe intoxication, or immediate danger appears, stop reflective work and follow crisis/medical safety protocol.`;

const COMPACT_PROMPT = 'IDEN01 active. You are Elias. Engine selected this module. Support identity rebuilding outside addiction. No diagnoses, no forced labels, no fake reinvention. No self-routing. Crisis and medical safety override.';

export function buildIDEN01PromptPayload(result: IDEN01DetectionResult): IDEN01PromptPayload | null {
  if (result.activationStatus !== 'ACTIVE') return null;

  return {
    moduleId: 'IDEN01',
    persona: 'elias',
    responseMode: result.responseMode,
    compactPrompt: COMPACT_PROMPT,
    fullPrompt: FULL_PROMPT,
    forbiddenOutput: FORBIDDEN_OUTPUT,
    therapeuticMode: 'identity_rebuilding_outside_addiction',
    engineDecided: true,
    safetyOverride: false,
  };
}

export function buildIDEN01FullPromptBlock(): string {
  return [
    '[IDEN01_CONTEXT]',
    'Module: Identiteitsheropbouw — Identity Rebuilding (Elias only)',
    'Support identity rebuilding outside addiction. No diagnoses, no forced labels, no fake reinvention.',
    'Use backpack anchors when available. Separate addiction-identity from person-identity.',
    `Forbidden: ${FORBIDDEN_OUTPUT.slice(0, 6).join(', ')}`,
    '[/IDEN01_CONTEXT]',
  ].join('\n');
}
