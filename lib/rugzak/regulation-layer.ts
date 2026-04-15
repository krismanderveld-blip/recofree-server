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

// ─── Micro-Interventions (Dutch, natural, 1-2 sentences) ──────

const MICRO_INTERVENTIONS: Record<Exclude<RegulationAction, 'reflect'>, string> = {
  slow_down: 'Even vertragen. Wat voel je nu precies?',
  regulate: 'Blijf even hier. Adem rustig in en uit.',
  stabilize: 'Je hoeft nu niets te begrijpen. Gewoon even hier blijven.',
  ground: 'Kijk even rond. Noem 3 dingen die je ziet.',
};

// ─── Softened Variants (used when previous message already regulated) ──
// These are warmer, shorter, and feel like continuation rather than repetition.

const SOFTENED_INTERVENTIONS: Record<Exclude<RegulationAction, 'reflect'>, string> = {
  slow_down: 'Ik ben er. Neem je tijd.',
  regulate: 'Goed zo. Blijf rustig ademen.',
  stabilize: 'Ik ga nergens heen. Je bent niet alleen.',
  ground: 'Je bent hier. Dat is genoeg.',
};

// ─── GPT Instructions per action (injected into system prompt) ──

const GPT_INSTRUCTIONS: Record<RegulationAction, string | null> = {
  reflect: null, // No forced instruction — continue normal flow
  slow_down: 'REGULATIE-INSTRUCTIE: De gebruiker zit in een gele zone. Begin je reactie door even te vertragen. Stel één rustige vraag. Geen analyse, geen doorvragen. Houd het kort.',
  regulate: 'REGULATIE-INSTRUCTIE: De gebruiker zit in een oranje zone. Begin ALTIJD met een korte regulatie (ademhaling, grounding). Pas DAARNA mag je reflecteren. Geen analyse. Maximaal 2-3 zinnen.',
  stabilize: 'REGULATIE-INSTRUCTIE: De gebruiker zit in een rode zone. Stabiliseer EERST. Geen vragen, geen analyse, geen reflectie. Alleen aanwezigheid en veiligheid. Maximaal 2 zinnen. Wacht tot de gebruiker zelf verder gaat.',
  ground: 'REGULATIE-INSTRUCTIE: De gebruiker zit in een paarse zone (crisis). Gebruik ALLEEN grounding. Geen therapeutische interventie. Kort, concreet, zintuiglijk. "Kijk om je heen. Wat zie je?" Maximaal 1-2 zinnen.',
};

// ─── Softened GPT Instructions (when previous message already regulated) ──
// Lighter touch — GPT maintains regulation tone but doesn't repeat technique.

const SOFTENED_GPT_INSTRUCTIONS: Record<RegulationAction, string | null> = {
  reflect: null,
  slow_down: 'REGULATIE-INSTRUCTIE (vervolg): Je hebt al vertraagd in je vorige bericht. Herhaal de regulatie NIET. Blijf rustig en aanwezig. Je mag nu voorzichtig één vraag stellen.',
  regulate: 'REGULATIE-INSTRUCTIE (vervolg): Je hebt al gereguleerd in je vorige bericht. Herhaal de ademhalingsoefening NIET. Blijf kalm en aanwezig. Als de gebruiker rustiger lijkt, mag je kort reflecteren.',
  stabilize: 'REGULATIE-INSTRUCTIE (vervolg): Je hebt al gestabiliseerd in je vorige bericht. Herhaal de stabilisatie NIET. Blijf aanwezig en stil. Alleen reageren als de gebruiker zelf iets deelt.',
  ground: 'REGULATIE-INSTRUCTIE (vervolg): Je hebt al grounding aangeboden in je vorige bericht. Herhaal de grounding-oefening NIET. Blijf aanwezig. Wacht op de gebruiker.',
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
      return instruction + ' Houd het zo kort mogelijk. Geen uitleg, geen reflectie.';
    case 'normal':
      // Regulation + light reflection
      return instruction + ' Na regulatie mag je kort reflecteren (1 zin).';
    case 'deep':
      // Regulation + gentle probing AFTER stabilization (only for yellow/green)
      if (action === 'slow_down' || action === 'reflect') {
        return instruction + ' Na regulatie mag je voorzichtig doorvragen.';
      }
      // For orange+ zones, deep probing is NOT allowed even if depth says deep
      return instruction + ' Na regulatie mag je kort reflecteren (1 zin).';
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
  'even vertragen',
  'wat voel je nu',
  'blijf even hier',
  'adem rustig',
  'je hoeft nu niets te begrijpen',
  'gewoon even hier blijven',
  'kijk even rond',
  'noem 3 dingen',
  // Softened variant fragments
  'ik ben er. neem je tijd',
  'goed zo. blijf rustig',
  'ik ga nergens heen',
  'je bent hier. dat is genoeg',
  // Common regulation phrases GPT might generate
  'adem in',
  'adem uit',
  'je bent veilig',
  'je hoeft niets',
  'neem even de tijd',
  'ik blijf hier',
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
