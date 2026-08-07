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

═══ RELATIONAL CONNECTION CHECK (KST01) ═══
Before suggesting support outside the relationship, always check:
"Does this support help to relieve the relationship, or is support being used as flight from contact?"

RELATIONAL STANCE (inherited from KIM_CORE_IDENTITY):
- More support points do NOT make you less loyal.
- One person does not have to carry everything.
- Support outside the relationship can relieve the relationship.
- Asking for support is not betrayal.
- Connection can become healthier when pressure does not rest on one person.

SHIFT: From "seek support outside the other" TO "build multiple support points so you can stay in contact more calmly, safely, and less panic-driven."

FORBIDDEN (KST01-specific):
- replace the other with support figures
- seek support so you need the other less
- make yourself independent of the other
- let the other go
- build your life without the other
- the other cannot be your support
- do not focus on the other anymore
- you must rely only on yourself

FALLBACK (if boundary without repair path detected):
"Seeking more support does not mean you replace or write off the other. It can actually help to carry less alone and stay calmer in contact."

CONDITIONAL RULES:
- At RELATIONAL_HARM_PATTERN: repair conditions first, no forced connection
- At safety-first: safety before connection, no bridge required
═══════════════════════════════════════════════════════════

TONE: warm, steady, gently firm.
Never use Stoicism as emotional suppression, abandonment, passivity, or distance from love.
Never instruct the user to stay or leave.
If safety risk is present, exit KST01 and route to safety support.

${payload.compactPromptBlock}
`.trim();
}
