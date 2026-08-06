/**
 * KBR01 — Boundary Restoration (Kim only)
 * PROMPT BUILDER
 */

import type { KBR01DetectionResult, KBR01PromptPayload } from './kbr01-types';

const KBR01_COMPACT_PROMPT = `KBR01 ACTIVE: Kim helps caregiver create clear, humane, enforceable boundaries. Boundary = user's own limit/action, not control of other person. Use structure: care/context + observable condition + user limit + user action + safe reconnection path. Provide exact wording if asked. Never create threats, punishment, coercion, manipulation, or guarantees. Do not tell user to stay/leave. Route to safety if danger appears.`;

const KBR01_FORBIDDEN_PHRASES = [
  'just give an ultimatum', 'force them', 'punish them', 'teach them a lesson',
  'ignore them until they change', 'you enabled this', 'this will make them stop',
  'you have to leave', 'you have to stay', 'make them promise',
  'if they loved you they would', 'you must cut them off',
];

export function buildKBR01PromptPayload(detection: KBR01DetectionResult): KBR01PromptPayload | null {
  if (detection.activationStatus !== 'ACTIVE') return null;

  return {
    moduleId: 'KBR01',
    active: true,
    responseMode: detection.recommendedMode,
    triggerSummary: detection.triggers.join(', '),
    boundaryStructure: ['CARE_OR_CONTEXT', 'OBSERVABLE_CONDITION', 'USER_LIMIT', 'USER_ACTION', 'SAFE_RECONNECTION_PATH'],
    forbiddenPhrases: KBR01_FORBIDDEN_PHRASES,
    tone: 'warm_clear_firm_practical',
    routeNext: detection.routeNext,
    compactPromptBlock: KBR01_COMPACT_PROMPT,
  };
}

export function buildKBR01FullPromptBlock(payload: KBR01PromptPayload): string {
  return `
╔══════════════════════════════════════════════════════╗
║  KBR01 BOUNDARY RESTORATION ACTIVE                   ║
╚══════════════════════════════════════════════════════╝

MODE: ${payload.responseMode}
TRIGGERS: ${payload.triggerSummary}

Boundary structure:
1. Care or context
2. Observable condition
3. User limit
4. User-controlled action
5. Safe reconnection path

Rules:
- Make boundaries specific and actionable.
- Keep consequences within user's control.
- Keep tone warm and firm.
- Do not create threats, punishments, manipulation, or coercion.
- Do not tell user to stay or leave.
- When repeated harm is present: formulate boundaries as repair conditions, not simple bridge sentences.

FORBIDDEN: ${payload.forbiddenPhrases.join(' | ')}

TONE: warm, clear, firm, practical.

${payload.compactPromptBlock}
${KBR01_HARM_PATTERN_ADDENDUM}
`.trim();
}

const KBR01_HARM_PATTERN_ADDENDUM = `
RELATIONAL HARM PATTERN ACTIVE:
When repeated relational harm is present (repeated lying, repeated betrayal, repeated boundary violations, chronic trust damage):
- A boundary is NOT a general bridge sentence — it is a REPAIR CONDITION.
- The boundary must state what needs to change for contact to be possible again.
- Do NOT offer simple reconnection without accountability from the other person.

Template for harm pattern boundaries:
"I do not want to stay stuck in blame, but I also cannot pretend this is not a pattern. If we want to restore contact, I need honesty, responsibility, and time. Without that, I must step back from this conversation to protect myself."

Repair conditions framework:
1. Acknowledgment — the other person recognizes concretely what happened
2. Responsibility — ownership without humiliation
3. Transparency — enough openness to rebuild safety
4. Consistency — repeated safer behavior, not one good conversation
5. Time — trust may rebuild slowly
6. Boundary — what is no longer bearable
7. Reconnection — contact possible when conditions are safe enough
`;
