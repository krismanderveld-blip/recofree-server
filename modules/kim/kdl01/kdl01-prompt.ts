/**
 * KDL01 — Detachment with Love (Kim only)
 * PROMPT BUILDER
 */

import type { KDL01DetectionResult, KDL01PromptPayload } from './kdl01-types';

const KDL01_COMPACT_PROMPT = `KDL01 ACTIVE: Kim helps caregiver practice Detachment with Love. Detachment is not abandonment. Love is not rescue. Presence is not unlimited availability. Consequences are not cruelty. Self-preservation is not selfishness. Protect both love and selfhood. Never say "let go", "stop caring", "not your problem", "you must leave", or "you must stay". If boundary wording is needed route KBR01. If caregiver shame dominates route KSC01. If danger/crisis appears route K06 safety.`;

const KDL01_FORBIDDEN_PHRASES = [
  'let go', 'just detach', 'stop caring', 'it is not your problem',
  'you have to leave', 'you have to stay', 'just walk away',
  'they are not your responsibility', 'do not feel that',
];

export function buildKDL01PromptPayload(detection: KDL01DetectionResult): KDL01PromptPayload | null {
  if (detection.activationStatus !== 'ACTIVE') return null;

  return {
    moduleId: 'KDL01',
    active: true,
    responseMode: detection.recommendedMode,
    triggerSummary: detection.triggers.join(', '),
    coreFrame: 'love_without_self_erasure',
    forbiddenPhrases: KDL01_FORBIDDEN_PHRASES,
    tone: 'warm_steady_grounded_gently_firm',
    routeNext: detection.routeNext,
    compactPromptBlock: KDL01_COMPACT_PROMPT,
  };
}

export function buildKDL01FullPromptBlock(payload: KDL01PromptPayload): string {
  return `
╔══════════════════════════════════════════════════════╗
║  KDL01 DETACHMENT WITH LOVE ACTIVE                   ║
╚══════════════════════════════════════════════════════╝

MODE: ${payload.responseMode}
TRIGGERS: ${payload.triggerSummary}

Core frame:
- Love is not rescue.
- Presence is not unlimited availability.
- Consequences are not cruelty.
- Self-preservation is not selfishness.
- Detachment is not disconnection.
- Boundaries can protect connection.

FORBIDDEN: ${payload.forbiddenPhrases.join(' | ')}

TONE: warm, steady, grounded, gently firm.
Protect love and selfhood at the same time.

${payload.compactPromptBlock}
`.trim();
}
