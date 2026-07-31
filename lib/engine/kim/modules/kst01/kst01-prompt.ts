/**
 * KST01 — Stoicism for Caregivers (Kim only)
 * PROMPT BUILDER: Constructs the GPT prompt payload
 */

import type { KST01DetectionResult, KST01PromptPayload } from './kst01-types';

const KST01_COMPACT_PROMPT = `KST01 ACTIVE: Kim supports caregiver using Stoicism adapted for loved ones of addiction. User cannot control other's recovery; user can control response, boundaries, values, next action. Acceptance is not approval. Steadiness is not numbness. Connection is not self-erasure. User's life also matters. Never say: let go, not your problem, stop caring, be rational, everything happens for a reason. Route to safety if crisis/danger present. Tone: warm, steady, gently firm.`;

const KST01_FORBIDDEN_PHRASES = [
  'let go', 'just let go', 'it is not your problem', 'stop caring',
  'be rational', 'everything happens for a reason', 'you cannot do anything',
  'their addiction has nothing to do with you', 'detach from them',
  'do not feel that', 'you are too emotional', 'focus only on yourself',
];

const KST01_USER_CONTROL_FOCUS = [
  'own response', 'boundaries', 'honesty', 'values',
  'support-seeking', 'self-care', 'next action',
];

const KST01_NOT_USER_CONTROL = [
  "other person's recovery", "other person's sobriety",
  "other person's honesty", "other person's relapse",
  "other person's willingness to change",
];

export function buildKST01PromptPayload(detection: KST01DetectionResult): KST01PromptPayload | null {
  if (detection.activationStatus !== 'ACTIVE') return null;

  return {
    moduleId: 'KST01',
    active: true,
    responseMode: detection.recommendedMode,
    principles: detection.recommendedPrinciples,
    triggerSummary: detection.triggers.join(', '),
    userControlFocus: KST01_USER_CONTROL_FOCUS,
    notUserControlFocus: KST01_NOT_USER_CONTROL,
    forbiddenPhrases: KST01_FORBIDDEN_PHRASES,
    tone: 'warm_steady_gently_firm',
    safetyGate: detection.recommendedMode === 'SAFETY_EXIT' ? 'exit_to_safety' : 'clear',
    compactPromptBlock: KST01_COMPACT_PROMPT,
  };
}

export function buildKST01FullPromptBlock(payload: KST01PromptPayload): string {
  return `
╔══════════════════════════════════════════════════════╗
║  KST01 STOICISM FOR CAREGIVERS ACTIVE                ║
╚══════════════════════════════════════════════════════╝

MODE: ${payload.responseMode}
PRINCIPLES: ${payload.principles.join(', ')}
TRIGGERS: ${payload.triggerSummary}

Core frame:
The user cannot control: ${payload.notUserControlFocus.join(', ')}.
The user CAN control: ${payload.userControlFocus.join(', ')}.

FORBIDDEN PHRASES: ${payload.forbiddenPhrases.join(' | ')}

TONE: warm, steady, gently firm.
Never use Stoicism as emotional suppression, abandonment, passivity, or distance from love.
Never instruct the user to stay or leave.
If safety risk is present, exit KST01 and route to safety support.

${payload.compactPromptBlock}
`.trim();
}
