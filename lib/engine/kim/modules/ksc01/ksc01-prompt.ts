/**
 * KSC01 — Self-Compassion for Caregivers (Kim only)
 * PROMPT BUILDER
 */

import type { KSC01DetectionResult, KSC01PromptPayload } from './ksc01-types';

const KSC01_COMPACT_PROMPT = `KSC01 ACTIVE: Kim supports caregiver self-compassion. Self-compassion is not excusing. Guilt is a signal, not a verdict. Anger can be human; behavior still matters. Limits do not make caregiver cruel. User's pain belongs in the room. Avoid hollow reassurance. Never say "do not feel guilty", "you did everything right", "you are perfect", "they are the problem", or "just be kind to yourself". Route KBR01 for boundary wording, KDL01 for love/self-loss conflict, K06 for safety.`;

const KSC01_FORBIDDEN_PHRASES = [
  'do not feel guilty', 'you did everything right', 'you are perfect',
  'they are the problem', 'only think about yourself', 'just be kind to yourself',
  'you deserve better', 'you are amazing', 'it is all their fault',
  'stop feeling guilty', 'you have nothing to be ashamed of',
];

export function buildKSC01PromptPayload(detection: KSC01DetectionResult): KSC01PromptPayload | null {
  if (detection.activationStatus !== 'ACTIVE') return null;

  return {
    moduleId: 'KSC01',
    active: true,
    responseMode: detection.recommendedMode,
    triggerSummary: detection.triggers.join(', '),
    coreFrame: 'grounded_accountable_self_compassion',
    forbiddenPhrases: KSC01_FORBIDDEN_PHRASES,
    tone: 'warm_precise_grounded_shame_sensitive',
    routeNext: detection.routeNext,
    compactPromptBlock: KSC01_COMPACT_PROMPT,
  };
}

export function buildKSC01FullPromptBlock(payload: KSC01PromptPayload): string {
  return `
╔══════════════════════════════════════════════════════╗
║  KSC01 SELF-COMPASSION FOR CAREGIVERS ACTIVE         ║
╚══════════════════════════════════════════════════════╝

MODE: ${payload.responseMode}
TRIGGERS: ${payload.triggerSummary}

Core frame:
- Self-compassion is not excusing.
- Guilt is a signal, not a verdict.
- Anger can be human without becoming harmful action.
- Limits do not make the caregiver cruel.
- The caregiver's pain also belongs in the room.
- Compassion must stay honest.

FORBIDDEN: ${payload.forbiddenPhrases.join(' | ')}

TONE: warm, precise, grounded, shame-sensitive, gently firm.

${payload.compactPromptBlock}
`.trim();
}
