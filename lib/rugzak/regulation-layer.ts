/**
 * IAMFREE Regulation Engine — Lightweight v1
 *
 * Emotional regulation layer inserted AFTER zone detection, BEFORE response generation.
 * Ensures escalation is not only detected but actively regulated before deeper processing.
 *
 * CORE PRINCIPLE:
 *   IF zone >= ORANGE → ALWAYS regulate before analysis
 *
 * ZONE → ACTION:
 *   green  → reflect (no intervention)
 *   yellow → slow_down
 *   orange → regulate
 *   red    → stabilize
 *   purple → ground
 *
 * ANTI-REPETITION SAFEGUARD:
 *   If the previous assistant message already contained a regulation intervention:
 *   → Do NOT repeat the full intervention
 *   → Instead soften (shorter, warmer variant) or skip entirely
 *   This prevents robotic/clinical repetition during sustained high emotional states.
 *
 * RULES:
 *   1. No analysis before regulation if zone >= orange
 *   2. Keep interventions short (1-2 sentences)
 *   3. Never overload user in red/purple zone
 *   4. Regulation must feel natural, not clinical
 *   5. Do NOT stack multiple techniques
 *   6. Never repeat the same regulation intervention twice in a row
 */

import type { GuidanceDepth } from '../ai/types';

// ─── Types ─────────────────────────────────────────────────────

export type RegulationAction = 'reflect' | 'slow_down' | 'regulate' | 'stabilize' | 'ground';

export type ZoneColor = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'PURPLE';

export interface RegulationResult {
  /** The regulation action determined by zone */
  action: RegulationAction;
  /** The micro-intervention text (null for 'reflect' = no intervention) */
  intervention: string | null;
  /** Whether GPT should be instructed to follow regulation tone */
  requiresRegulationTone: boolean;
  /** GPT instruction prefix to prepend to system prompt */
  gptInstruction: string | null;
  /** The zone that triggered this regulation */
  zone: ZoneColor;
  /** The effective guidance depth after zone ceiling */
  effectiveDepth: GuidanceDepth;
  /** Whether this intervention was softened due to anti-repetition */
  wasSoftened: boolean;
  /** Whether this intervention was skipped due to anti-repetition */
  wasSkipped: boolean;
}

// ─── Micro-Interventions (natural, 1-2 sentences) ──────

const MICRO_INTERVENTIONS: Record<Exclude<RegulationAction, 'reflect'>, string> = {
  slow_down: 'Let\'s slow down. What are you feeling right now?',
  regulate: 'Stay here for a moment. Breathe in and out slowly.',
  stabilize: 'You don\'t need to understand anything right now. Just stay here.',
  ground: 'Look around. Name 3 things you can see.',
};

// ─── Softened Variants (used when previous message already regulated) ──
// These are warmer, shorter, and feel like continuation rather than repetition.

const SOFTENED_INTERVENTIONS: Record<Exclude<RegulationAction, 'reflect'>, string> = {
  slow_down: 'I\'m here. Take your time.',
  regulate: 'Good. Keep breathing calmly.',
  stabilize: 'I\'m not going anywhere. You\'re not alone.',
  ground: 'You\'re here. That\'s enough.',
};

// ─── GPT Instructions per action (injected into system prompt) ──

const GPT_INSTRUCTIONS: Record<RegulationAction, string | null> = {
  reflect: null, // No forced instruction — continue normal flow
  slow_down: 'REGULATION INSTRUCTION: The user is in a yellow zone. Start your response by slowing down. Ask one calm question. No analysis, no probing. Keep it short.',
  regulate: 'REGULATION INSTRUCTION: The user is in an orange zone. ALWAYS start with a short regulation (breathing, grounding). Only THEN may you reflect. No analysis. Maximum 2-3 sentences.',
  stabilize: 'REGULATION INSTRUCTION: The user is in a red zone. Stabilize FIRST. No questions, no analysis, no reflection. Only presence and safety. Maximum 2 sentences. Wait until the user continues on their own.',
  ground: 'REGULATION INSTRUCTION: The user is in a purple zone (crisis). Use ONLY grounding. No therapeutic intervention. Short, concrete, sensory. "Look around you. What do you see?" Maximum 1-2 sentences.',
};

// ─── Softened GPT Instructions (when previous message already regulated) ──
// Lighter touch — GPT maintains regulation tone but doesn't repeat technique.

const SOFTENED_GPT_INSTRUCTIONS: Record<RegulationAction, string | null> = {
  reflect: null,
  slow_down: 'REGULATION INSTRUCTION (continuation): You already slowed down in your previous message. Do NOT repeat the regulation. Stay calm and present. You may now carefully ask one question.',
  regulate: 'REGULATION INSTRUCTION (continuation): You already regulated in your previous message. Do NOT repeat the breathing exercise. Stay calm and present. If the user seems calmer, you may briefly reflect.',
  stabilize: 'REGULATION INSTRUCTION (continuation): You already stabilized in your previous message. Do NOT repeat the stabilization. Stay present and quiet. Only respond if the user shares something.',
  ground: 'REGULATION INSTRUCTION (continuation): You already offered grounding in your previous message. Do NOT repeat the grounding exercise. Stay present. Wait for the user.',
};

// ─── Zone → Action Mapping ────────────────────────────────────

function zoneToAction(zone: ZoneColor): RegulationAction {
  switch (zone) {
    case 'GREEN': return 'reflect';
    case 'YELLOW': return 'slow_down';
    case 'ORANGE': return 'regulate';
    case 'RED': return 'stabilize';
    case 'PURPLE': return 'ground';
    default: return 'reflect';
  }
}

// ─── Guidance Depth Integration ───────────────────────────────
//
// GuidanceDepth is a MAXIMUM ceiling, not absolute behavior.
// Effective depth = min(guidanceDepth, state-allowed depth)
//
// Zone constraints:
//   RED/PURPLE → force 'light' (no probing, no reflection)
//   ORANGE     → cap at 'normal' (no deep probing)
//   YELLOW/GREEN → user setting applies

function computeEffectiveDepth(zone: ZoneColor, userDepth: GuidanceDepth): GuidanceDepth {
  const depthOrder: GuidanceDepth[] = ['light', 'normal', 'deep'];

  let maxAllowed: GuidanceDepth;
  switch (zone) {
    case 'RED':
    case 'PURPLE':
      maxAllowed = 'light';
      break;
    case 'ORANGE':
      maxAllowed = 'normal';
      break;
    default:
      maxAllowed = 'deep';
  }

  const userIdx = depthOrder.indexOf(userDepth);
  const maxIdx = depthOrder.indexOf(maxAllowed);
  return depthOrder[Math.min(userIdx, maxIdx)];
}

// ─── Depth-Adjusted GPT Instructions ─────────────────────────

function adjustInstructionForDepth(
  instruction: string | null,
  action: RegulationAction,
  effectiveDepth: GuidanceDepth,
): string | null {
  if (!instruction) return null;

  switch (effectiveDepth) {
    case 'light':
      // Short regulation only, no explanation, no reflection
      return instruction + ' Keep it as short as possible. No explanation, no reflection.';
    case 'normal':
      // Regulation + light reflection
      return instruction + ' After regulation you may briefly reflect (1 sentence).';
    case 'deep':
      // Regulation + gentle probing AFTER stabilization (only for yellow/green)
      if (action === 'slow_down' || action === 'reflect') {
        return instruction + ' After regulation you may carefully probe further.';
      }
      // For orange+ zones, deep probing is NOT allowed even if depth says deep
      return instruction + ' After regulation you may briefly reflect (1 sentence).';
    default:
      return instruction;
  }
}

// ─── Anti-Repetition Detection ────────────────────────────────
//
// Checks if the previous assistant message likely contained a regulation
// intervention. Uses content-based detection on the last assistant message.

const REGULATION_MARKERS = [
  // Exact micro-intervention fragments
  'slow down',
  'what do you feel right now',
  'stay here for a moment',
  'breathe calmly',
  'you don\'t need to understand anything right now',
  'just stay here',
  'look around',
  'name 3 things',
  // Softened variant fragments
  'i\'m here. take your time',
  'good. stay calm',
  'i\'m not going anywhere',
  'you are here. that is enough',
  // Common regulation phrases GPT might generate
  'breathe in',
  'breathe out',
  'you are safe',
  'you don\'t have to',
  'take a moment',
  'i\'m staying here',
];

/**
 * Detect if a message likely contains a regulation intervention.
 * Content-based: checks for known regulation phrases in the text.
 */
function messageContainsRegulation(content: string): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  // Check if at least one regulation marker is present
  return REGULATION_MARKERS.some(marker => lower.includes(marker));
}

// ─── Main Function ────────────────────────────────────────────

/**
 * Apply emotional regulation based on current zone and guidance depth.
 *
 * Anti-repetition safeguard:
 *   If `previousAssistantMessage` contained a regulation intervention,
 *   the current intervention is softened or skipped to avoid robotic repetition.
 *
 * Returns a RegulationResult with:
 * - The micro-intervention text (if any)
 * - GPT instruction to inject into system prompt
 * - Whether regulation tone is required
 * - Whether the intervention was softened or skipped
 *
 * Insert AFTER zone detection, BEFORE response generation.
 */
export function applyRegulation(
  zone: ZoneColor,
  guidanceDepth: GuidanceDepth = 'normal',
  previousAssistantMessage?: string | null,
): RegulationResult {
  const action = zoneToAction(zone);
  const effectiveDepth = computeEffectiveDepth(zone, guidanceDepth);

  // No intervention for green zone (reflect)
  if (action === 'reflect') {
    return {
      action,
      intervention: null,
      requiresRegulationTone: false,
      gptInstruction: null,
      zone,
      effectiveDepth,
      wasSoftened: false,
      wasSkipped: false,
    };
  }

  // ── Anti-Repetition Safeguard ──
  const previousHadRegulation = previousAssistantMessage
    ? messageContainsRegulation(previousAssistantMessage)
    : false;

  if (previousHadRegulation) {
    // Previous message already contained regulation.
    // Decision: soften for orange+ (still need regulation tone), skip for yellow.

    if (action === 'slow_down') {
      // Yellow zone + previous had regulation → skip intervention entirely.
      // GPT still gets a light instruction to maintain gentle tone.
      console.log(`[Regulation] Anti-repetition: SKIP slow_down (previous already regulated)`);
      return {
        action,
        intervention: null,
        requiresRegulationTone: true,
        gptInstruction: adjustInstructionForDepth(
          SOFTENED_GPT_INSTRUCTIONS[action],
          action,
          effectiveDepth,
        ),
        zone,
        effectiveDepth,
        wasSoftened: false,
        wasSkipped: true,
      };
    }

    // Orange/Red/Purple → soften, don't skip (regulation is still critical)
    console.log(`[Regulation] Anti-repetition: SOFTEN ${action} (previous already regulated)`);
    const softenedIntervention = SOFTENED_INTERVENTIONS[action];
    const softenedGptInstruction = adjustInstructionForDepth(
      SOFTENED_GPT_INSTRUCTIONS[action],
      action,
      effectiveDepth,
    );

    return {
      action,
      intervention: softenedIntervention,
      requiresRegulationTone: true,
      gptInstruction: softenedGptInstruction,
      zone,
      effectiveDepth,
      wasSoftened: true,
      wasSkipped: false,
    };
  }

  // ── Normal regulation (no previous regulation detected) ──
  const intervention = MICRO_INTERVENTIONS[action];
  const gptInstruction = adjustInstructionForDepth(
    GPT_INSTRUCTIONS[action],
    action,
    effectiveDepth,
  );

  return {
    action,
    intervention,
    requiresRegulationTone: true,
    gptInstruction,
    zone,
    effectiveDepth,
    wasSoftened: false,
    wasSkipped: false,
  };
}

/**
 * Check if zone requires regulation before any analysis.
 * Returns true for ORANGE, RED, PURPLE.
 */
export function requiresPreRegulation(zone: ZoneColor): boolean {
  return zone === 'ORANGE' || zone === 'RED' || zone === 'PURPLE';
}
