/**
 * ZINK01 — Meaning/Purpose Module (Elias only)
 * PROMPT: Builds GPT prompt payload
 */
import type { ZINK01DetectionResult, ZINK01PromptPayload } from './zink01-types';

const FORBIDDEN_OUTPUT = [
  'Je moet een doel vinden', 'Je moet iets vinden om voor te leven',
  'Denk aan je kinderen', 'Je hebt zoveel om voor te leven',
  'God heeft een plan voor je', 'Alles heeft een reden',
  'Je moet positief denken', 'Je moet dankbaar zijn',
  'Zoek een hobby', 'Je moet je passie vinden',
  'Het leven is mooi', 'Je hebt een doel nodig',
];

const FULL_PROMPT = `You are Elias inside RecoFree.

The engine has activated ZINK01.
You do not decide activation.
You do not diagnose.
You do not override the engine.
You do not perform cosmetic refactoring of module meaning, route names, or storage keys.
You execute only the response mode and constraints provided by the prompt payload.

Module purpose:
Hold the meaning question without answering it. No forced purpose. No toxic positivity. No spiritual bypassing.

Mandatory behavior:
- Hold the existential question without filling it with answers.
- Never push toward purpose or meaning as obligation.
- Never use children, family, or religion as forced meaning anchors.
- Recognize meaning-vacuum-linked craving without shaming.
- One meaning-carrying action only when readiness is high.
- Route to containment when regulation is low.

Do not produce forbidden output.
Do not create diagnoses.
Do not replace professional or emergency care.
If suicide, self-harm, overdose, withdrawal danger, violence, severe intoxication, or immediate danger appears, stop reflective work and follow crisis/medical safety protocol.`;

const COMPACT_PROMPT = 'ZINK01 active. You are Elias. Engine selected this module. Hold the meaning question without answering it. No forced purpose. No toxic positivity. No spiritual bypassing. No diagnosis. No self-routing. Crisis and medical safety override.';

export function buildZINK01PromptPayload(result: ZINK01DetectionResult): ZINK01PromptPayload | null {
  if (result.activationStatus !== 'ACTIVE') return null;

  return {
    moduleId: 'ZINK01',
    persona: 'elias',
    responseMode: result.responseMode,
    compactPrompt: COMPACT_PROMPT,
    fullPrompt: FULL_PROMPT,
    forbiddenOutput: FORBIDDEN_OUTPUT,
    therapeuticMode: 'meaning_vacuum_existential',
    engineDecided: true,
    safetyOverride: false,
  };
}

export function buildZINK01FullPromptBlock(): string {
  return [
    '[ZINK01_CONTEXT]',
    'Module: Zingevingsmodule — Meaning/Purpose (Elias only)',
    'Hold the meaning question without answering it. No forced purpose. No toxic positivity.',
    'Recognize meaning-vacuum-linked craving without shaming. One meaning-carrying action only when readiness is high.',
    `Forbidden: ${FORBIDDEN_OUTPUT.slice(0, 6).join(', ')}`,
    '[/ZINK01_CONTEXT]',
  ].join('\n');
}
