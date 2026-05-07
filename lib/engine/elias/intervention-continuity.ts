/**
 * Intervention Continuity Layer — Zone-Linked Therapeutic Memory
 *
 * Gives Elias memory of his own interventions, linked to zone evolution.
 * Enables consistent therapeutic line instead of reactive per-message responses.
 *
 * ARCHITECTURE:
 *   - InterventionState is session-scoped (resets per session)
 *   - Each intervention is linked to the resolvedZone where it started
 *   - Per turn: compare current resolvedZone with linkedZone
 *     - Zone shifted → re-evaluate intervention (new goal, new linkedZone)
 *     - Zone unchanged → continue building on same therapeutic line
 *   - Zone evolution trail tracks full session history for effectiveness measurement
 *
 * COUPLING:
 *   - MUST be coupled to resolvedZone (from vsp-resolution.ts)
 *   - NOT standalone — depends on zone state evolution
 *   - effectivenessScore is measured by zone transitions relative to expectedShift
 *
 * FUTURE HOOK:
 *   - getSessionSummary() returns intervention summary as a pure function (read-only)
 *   - NOT connected to user.dat or any durable persistence until database migration is complete
 *   - Current storage (AsyncStorage) = local within-device memory only
 *
 * RULES:
 *   - No GPT calls — purely local state tracking
 *   - No modification of resolvedZone — read-only consumer
 *   - No inference — only tracks what actually happened
 *   - Session-scoped — resets at session start
 *   - Zone evolution trail: max 5 entries sent to GPT (MAX_TRAIL_LENGTH)
 *
 * BLOCKED — Kim Continuity Layer:
 *   - A Kim equivalent of this layer is NOT implemented.
 *   - REASON: Eigen Regie is not yet mandatory at chat start.
 *   - A continuity layer on non-guaranteed input is unstable.
 *   - This item is blocked until Eigen Regie is enforced as a pre-chat requirement.
 *   - DO NOT build Kim continuity until that precondition is met.
 */

import type { FinalZoneLabel, ResolvedEliasZone } from './vsp-resolution';
import type { RegulationAction } from '../../rugzak/regulation-layer';

// ─── Intervention Types ──────────────────────────────────────

/**
 * Types of therapeutic interventions Elias can apply.
 * Maps to regulation actions + higher-level therapeutic strategies.
 */
export type InterventionType =
  | 'grounding'       // PAARS/ROOD: sensory anchoring, breathing
  | 'stabilization'   // ROOD: presence, safety, no analysis
  | 'regulation'      // ORANJE: breathing, body awareness
  | 'deceleration'    // GEEL: slow down, one question at a time
  | 'reflection'      // GROEN: open exploration, gentle probing
  | 'confrontation'   // GROEN (deep): challenge patterns, schema work
  | 'none';           // No active intervention

/**
 * Map regulation action to intervention type.
 * Used POST-GPT to classify what Elias just did.
 */
export function regulationToInterventionType(action: RegulationAction): InterventionType {
  switch (action) {
    case 'ground': return 'grounding';
    case 'stabilize': return 'stabilization';
    case 'regulate': return 'regulation';
    case 'slow_down': return 'deceleration';
    case 'reflect': return 'reflection';
    default: return 'none';
  }
}

// ─── User Response Patterns ──────────────────────────────────

/**
 * How the user responded to the previous intervention.
 * Detected from the user's next message relative to what Elias offered.
 */
export type UserResponsePattern =
  | 'engaged'     // User follows the intervention (answers question, does exercise)
  | 'deflected'   // User changes subject or avoids
  | 'escalated'   // User's distress increased despite intervention
  | 'ignored'     // User sends unrelated content
  | 'unknown';    // First turn or cannot determine

// ─── Zone Shift ──────────────────────────────────────────────

/**
 * Describes a zone transition (or lack thereof).
 */
export interface ZoneShift {
  /** Previous zone label (from linkedZone) */
  readonly from: FinalZoneLabel;
  /** Current zone label */
  readonly to: FinalZoneLabel;
  /** Direction: improved (lower severity), worsened (higher severity), stable */
  readonly direction: 'improved' | 'worsened' | 'stable';
  /** Severity delta (negative = improved, positive = worsened, 0 = stable) */
  readonly delta: number;
}

// ─── Zone Evolution Entry ────────────────────────────────────

/**
 * Single entry in the zone evolution trail.
 * Tracks the full session zone history for effectiveness measurement.
 */
export interface ZoneEvolutionEntry {
  readonly turnIndex: number;
  readonly zoneLabel: FinalZoneLabel;
  readonly severity: number;
  readonly interventionType: InterventionType;
  readonly userResponse: UserResponsePattern;
  readonly timestamp: string;
}

// ─── Intervention State ──────────────────────────────────────

/**
 * The core state object tracking Elias's current therapeutic line.
 * Linked to zone evolution — not standalone.
 */
export interface InterventionState {
  /** What type of intervention is currently active */
  readonly lastInterventionType: InterventionType;
  /** The therapeutic goal of the current intervention line */
  readonly interventionGoal: string;
  /** The resolvedZone where this intervention line started */
  readonly linkedZone: FinalZoneLabel;
  /** The severity of the linkedZone (1-5) */
  readonly linkedSeverity: number;
  /** Expected zone shift (e.g., ORANJE → GEEL) */
  readonly expectedShift: { from: FinalZoneLabel; to: FinalZoneLabel };
  /** Effectiveness score (0-100). Based on actual zone transitions vs expected. */
  readonly effectivenessScore: number;
  /** Number of consecutive turns this intervention line has been active */
  readonly turnsActive: number;
  /** Last detected user response pattern */
  readonly lastUserResponse: UserResponsePattern;
  /** Full zone evolution trail for the session */
  readonly zoneEvolution: ZoneEvolutionEntry[];
  /** Whether the intervention was re-evaluated this turn (zone shifted) */
  readonly wasReEvaluated: boolean;
}

// ─── Intervention Goals (deterministic mapping) ──────────────

/**
 * Deterministic goal per intervention type.
 * No inference, no GPT — fixed therapeutic intent.
 */
const INTERVENTION_GOALS: Readonly<Record<InterventionType, string>> = Object.freeze({
  grounding: 'Bring user back to present moment through sensory anchoring',
  stabilization: 'Establish safety and presence before any processing',
  regulation: 'Reduce physiological arousal through breathing/body awareness',
  deceleration: 'Slow cognitive pace to prevent overwhelm',
  reflection: 'Facilitate open exploration of thoughts and feelings',
  confrontation: 'Challenge established patterns with care and timing',
  none: 'No active therapeutic goal',
});

/**
 * Expected zone shift per intervention type.
 * What we expect to happen if the intervention is effective.
 */
const EXPECTED_SHIFTS: Readonly<Record<InterventionType, number>> = Object.freeze({
  grounding: -2,       // PAARS→ORANJE or ROOD→GEEL (2 levels down)
  stabilization: -1,   // ROOD→ORANJE (1 level down)
  regulation: -1,      // ORANJE→GEEL (1 level down)
  deceleration: -1,    // GEEL→GROEN (1 level down)
  reflection: 0,       // GROEN→GROEN (maintain)
  confrontation: 0,    // GROEN→GROEN (maintain, may temporarily increase)
  none: 0,
});

// ─── Severity Mapping ────────────────────────────────────────

const ZONE_SEVERITY: Readonly<Record<FinalZoneLabel, number>> = Object.freeze({
  GROEN: 1,
  GEEL: 2,
  ORANJE: 3,
  ROOD: 4,
  PAARS: 5,
});

function getExpectedTargetZone(fromZone: FinalZoneLabel, interventionType: InterventionType): FinalZoneLabel {
  const fromSeverity = ZONE_SEVERITY[fromZone];
  const shift = EXPECTED_SHIFTS[interventionType];
  const targetSeverity = Math.max(1, Math.min(5, fromSeverity + shift));
  const labels: FinalZoneLabel[] = ['GROEN', 'GEEL', 'ORANJE', 'ROOD', 'PAARS'];
  return labels[targetSeverity - 1];
}

// ─── Session State (module-scoped) ───────────────────────────

let currentInterventionState: InterventionState | null = null;

/**
 * Reset intervention state. Call at session start.
 */
export function resetInterventionState(): void {
  currentInterventionState = null;
}

/**
 * Get current intervention state (read-only).
 * Returns null if no intervention has been tracked yet this session.
 */
export function getInterventionState(): InterventionState | null {
  return currentInterventionState;
}

// ─── Zone Shift Detection ────────────────────────────────────

/**
 * Compare current resolvedZone with linkedZone to detect shift.
 * Returns null if no previous intervention exists.
 */
export function detectZoneShift(
  currentZoneLabel: FinalZoneLabel,
  linkedZone: FinalZoneLabel,
): ZoneShift {
  const currentSeverity = ZONE_SEVERITY[currentZoneLabel];
  const linkedSeverity = ZONE_SEVERITY[linkedZone];
  const delta = currentSeverity - linkedSeverity;

  let direction: ZoneShift['direction'];
  if (delta < 0) direction = 'improved';
  else if (delta > 0) direction = 'worsened';
  else direction = 'stable';

  return Object.freeze({ from: linkedZone, to: currentZoneLabel, direction, delta });
}

// ─── User Response Detection ─────────────────────────────────

/**
 * Detect user response pattern from their message relative to the active intervention.
 *
 * EXACT DETECTION RULES (no AI interpretation, no defaults):
 *
 * ESCALATED:
 *   Condition: zone severity increased (zoneShift.direction === 'worsened')
 *   Rationale: objective measurement — sliders/VSP moved to higher severity
 *
 * IGNORED:
 *   Condition: message length < 5 characters AND not an acknowledgment token
 *   Acknowledgment tokens: 'ok', 'yes', 'yeah', 'hmm', 'no', 'yep', 'nope', 'sure'
 *   Rationale: sub-5-char non-ack = no meaningful engagement with intervention content
 *
 * DEFLECTED:
 *   Condition: message contains one or more explicit deflection markers (exact substring match)
 *   Markers are topic-change phrases, not emotional expressions
 *   Rationale: user explicitly signals they want to move away from current intervention
 *
 * ENGAGED:
 *   Condition: message length >= 20 characters AND no deflection markers AND zone did not worsen
 *   Rationale: substantive response without avoidance signals = engagement
 *
 * UNKNOWN:
 *   Condition: no active intervention OR none of the above conditions are met
 *   This is the fallback — NOT 'engaged'. System does not assume engagement.
 */

/** Crisis keywords — short messages containing these are escalation signals, not 'ignored' */
const CRISIS_KEYWORDS: ReadonlyArray<string> = Object.freeze([
  'help', 'red', 'emergency', 'sos', 'please', 'crisis', 'stop',
]);

/** Exact acknowledgment tokens (case-insensitive, must match full message after trim) */
const ACKNOWLEDGMENT_TOKENS: ReadonlyArray<string> = Object.freeze([
  'ok', 'yes', 'yeah', 'hmm', 'no', 'yep', 'nope', 'sure',
  'ok.', 'yes.', 'yeah.', 'hmm.', 'no.', 'yep.', 'nope.', 'sure.',
]);

/** Exact deflection markers (case-insensitive substring match) */
const DEFLECTION_MARKERS: ReadonlyArray<string> = Object.freeze([
  'but actually',
  'never mind',
  'forget it',
  'something else',
  'anyway',
  'whatever',
  "doesn't matter",
  'never mind',
  'can we talk about something else',
  'change the subject',
  'different topic',
  'move on',
  'let it go',
  'not important',
]);

/** Minimum message length to qualify as 'engaged' (substantive response) */
const ENGAGED_MIN_LENGTH = 20;

/** Maximum message length to qualify as 'ignored' (non-ack short message) */
const IGNORED_MAX_LENGTH = 4;

export function detectUserResponse(
  userMessage: string,
  zoneShift: ZoneShift | null,
  activeIntervention: InterventionType,
): UserResponsePattern {
  // Rule 0: No active intervention → unknown (cannot classify response to nothing)
  if (activeIntervention === 'none') return 'unknown';

  // Rule 1: ESCALATED — zone severity increased (objective measurement)
  if (zoneShift && zoneShift.direction === 'worsened') return 'escalated';

  const msg = userMessage.toLowerCase().trim();

  // Rule 2: ESCALATED — message IS a crisis keyword (exact match or very short message containing one)
  if (CRISIS_KEYWORDS.some(k => msg === k || msg === k + '!' || msg === k + '.')) return 'escalated';
  // Also check for crisis keywords in short messages (up to 10 chars) to catch e.g. "help me"
  if (msg.length <= 10 && CRISIS_KEYWORDS.some(k => msg.includes(k))) return 'escalated';

  // Rule 2b: IGNORED — very short message that is not an acknowledgment
  if (msg.length <= IGNORED_MAX_LENGTH) {
    if (ACKNOWLEDGMENT_TOKENS.includes(msg)) return 'engaged';
    return 'ignored';
  }

  // Rule 3: DEFLECTED — contains explicit deflection marker
  if (DEFLECTION_MARKERS.some(marker => msg.includes(marker))) return 'deflected';

  // Rule 4: ENGAGED — substantive response (>= 20 chars) without deflection or escalation
  if (msg.length >= ENGAGED_MIN_LENGTH) return 'engaged';

  // Rule 5: UNKNOWN — message is 6-19 chars, no deflection, no escalation
  // System does not assume engagement for ambiguous short messages
  return 'unknown';
}

// ─── Effectiveness Scoring ───────────────────────────────────

/**
 * Compute effectiveness score (0-100) based on zone evolution.
 *
 * Formula:
 * - Each turn where zone improved: +20
 * - Each turn where zone stayed stable (and expected to improve): +5
 * - Each turn where zone worsened: -15
 * - Each turn with 'engaged' response: +5
 * - Each turn with 'escalated' response: -10
 * - Clamped to 0-100
 */
export function computeEffectiveness(evolution: ZoneEvolutionEntry[]): number {
  if (evolution.length === 0) return 50; // neutral start

  let score = 50; // start neutral

  for (let i = 1; i < evolution.length; i++) {
    const prev = evolution[i - 1];
    const curr = evolution[i];
    const severityDelta = curr.severity - prev.severity;

    if (severityDelta < 0) score += 20;       // improved
    else if (severityDelta === 0) score += 5;  // stable
    else score -= 15;                          // worsened

    if (curr.userResponse === 'engaged') score += 5;
    else if (curr.userResponse === 'escalated') score -= 10;
    else if (curr.userResponse === 'deflected') score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

// ─── PRE-GPT: Evaluate Zone Shift ───────────────────────────

/**
 * PRE-GPT evaluation. Called BEFORE GPT with the current resolvedZone.
 *
 * Compares current resolvedZone with linkedZone:
 * - Zone shifted → re-evaluate intervention (new goal, new linkedZone)
 * - Zone unchanged → continue building on same therapeutic line
 *
 * Returns the current InterventionState for injection into GPT context.
 * Returns null on first turn (no previous intervention to compare against).
 */
export function evaluateInterventionContinuity(
  currentResolvedZone: ResolvedEliasZone,
  userMessage: string,
): InterventionState | null {
  // If blocked or no zone label, cannot evaluate
  if (currentResolvedZone.isBlocked || !currentResolvedZone.finalZoneLabel) {
    return null;
  }

  const currentZoneLabel = currentResolvedZone.finalZoneLabel;
  const currentSeverity = currentResolvedZone.finalSeverity!;

  // First turn: no previous state to compare against
  if (currentInterventionState === null) {
    return null;
  }

  // Detect zone shift relative to linkedZone
  const zoneShift = detectZoneShift(currentZoneLabel, currentInterventionState.linkedZone);

  // Detect user response to previous intervention
  const userResponse = detectUserResponse(
    userMessage,
    zoneShift,
    currentInterventionState.lastInterventionType,
  );

  // Add to zone evolution trail
  const newEvolutionEntry: ZoneEvolutionEntry = {
    turnIndex: currentInterventionState.zoneEvolution.length,
    zoneLabel: currentZoneLabel,
    severity: currentSeverity,
    interventionType: currentInterventionState.lastInterventionType,
    userResponse,
    timestamp: new Date().toISOString(),
  };
  const updatedEvolution = [...currentInterventionState.zoneEvolution, newEvolutionEntry];

  // Compute effectiveness based on full evolution
  const effectivenessScore = computeEffectiveness(updatedEvolution);

  // DECISION: zone shifted → re-evaluate, zone stable → continue
  if (zoneShift.direction !== 'stable') {
    // Zone shifted — re-evaluate intervention
    // New intervention type will be determined POST-GPT based on what Elias actually does
    // For now, update linkedZone to current zone
    currentInterventionState = Object.freeze({
      lastInterventionType: currentInterventionState.lastInterventionType,
      interventionGoal: currentInterventionState.interventionGoal,
      linkedZone: currentZoneLabel,
      linkedSeverity: currentSeverity,
      expectedShift: {
        from: currentZoneLabel,
        to: getExpectedTargetZone(currentZoneLabel, currentInterventionState.lastInterventionType),
      },
      effectivenessScore,
      turnsActive: currentInterventionState.turnsActive + 1,
      lastUserResponse: userResponse,
      zoneEvolution: updatedEvolution,
      wasReEvaluated: true,
    });
  } else {
    // Zone stable — continue same therapeutic line
    currentInterventionState = Object.freeze({
      ...currentInterventionState,
      effectivenessScore,
      turnsActive: currentInterventionState.turnsActive + 1,
      lastUserResponse: userResponse,
      zoneEvolution: updatedEvolution,
      wasReEvaluated: false,
    });
  }

  return currentInterventionState;
}

// ─── POST-GPT: Update Intervention State ─────────────────────

/**
 * POST-GPT update. Called AFTER GPT response with the regulation action that was applied.
 *
 * Records what Elias actually did this turn, updating the intervention state
 * so the next turn can compare against it.
 */
export function updateInterventionAfterResponse(
  currentResolvedZone: ResolvedEliasZone,
  regulationAction: RegulationAction,
): void {
  if (currentResolvedZone.isBlocked || !currentResolvedZone.finalZoneLabel) {
    return;
  }

  const currentZoneLabel = currentResolvedZone.finalZoneLabel;
  const currentSeverity = currentResolvedZone.finalSeverity!;
  const interventionType = regulationToInterventionType(regulationAction);

  if (currentInterventionState === null) {
    // First intervention of the session — initialize state
    const initialEntry: ZoneEvolutionEntry = {
      turnIndex: 0,
      zoneLabel: currentZoneLabel,
      severity: currentSeverity,
      interventionType,
      userResponse: 'unknown',
      timestamp: new Date().toISOString(),
    };

    currentInterventionState = Object.freeze({
      lastInterventionType: interventionType,
      interventionGoal: INTERVENTION_GOALS[interventionType],
      linkedZone: currentZoneLabel,
      linkedSeverity: currentSeverity,
      expectedShift: {
        from: currentZoneLabel,
        to: getExpectedTargetZone(currentZoneLabel, interventionType),
      },
      effectivenessScore: 50, // neutral start
      turnsActive: 1,
      lastUserResponse: 'unknown' as UserResponsePattern,
      zoneEvolution: [initialEntry],
      wasReEvaluated: false,
    });
  } else {
    // Update existing state with what Elias actually did
    currentInterventionState = Object.freeze({
      ...currentInterventionState,
      lastInterventionType: interventionType,
      interventionGoal: INTERVENTION_GOALS[interventionType],
    });
  }
}

// ─── Session Summary (future hook for persistence) ───────────

/**
 * Get intervention summary as a pure function.
 * Returns a read-only snapshot of the current session's intervention data.
 *
 * NOT connected to user.dat or any persistence layer.
 * Storage contract: local within-device memory only (AsyncStorage).
 * Do NOT use for durable learning until database migration is complete.
 */
export interface InterventionSessionSummary {
  readonly totalTurns: number;
  readonly interventionTypes: InterventionType[];
  readonly startZone: FinalZoneLabel | null;
  readonly endZone: FinalZoneLabel | null;
  readonly overallEffectiveness: number;
  readonly dominantUserResponse: UserResponsePattern;
  readonly zoneImproved: boolean;
}

export function getSessionSummary(): InterventionSessionSummary | null {
  if (!currentInterventionState || currentInterventionState.zoneEvolution.length === 0) {
    return null;
  }

  const evolution = currentInterventionState.zoneEvolution;
  const startZone = evolution[0].zoneLabel;
  const endZone = evolution[evolution.length - 1].zoneLabel;

  // Count dominant response pattern
  const responseCounts: Record<UserResponsePattern, number> = {
    engaged: 0, deflected: 0, escalated: 0, ignored: 0, unknown: 0,
  };
  for (const entry of evolution) {
    responseCounts[entry.userResponse]++;
  }
  const dominantUserResponse = (Object.entries(responseCounts) as [UserResponsePattern, number][])
    .sort((a, b) => b[1] - a[1])[0][0];

  // Collect unique intervention types used
  const interventionTypes = [...new Set(evolution.map(e => e.interventionType))];

  return Object.freeze({
    totalTurns: evolution.length,
    interventionTypes,
    startZone,
    endZone,
    overallEffectiveness: currentInterventionState.effectivenessScore,
    dominantUserResponse,
    zoneImproved: ZONE_SEVERITY[endZone] < ZONE_SEVERITY[startZone],
  });
}

// ─// ─── GPT Context Builder ─────────────────────────────────

/**
 * RULE: Maximum zone evolution trail entries sent to GPT.
 * Only the last MAX_TRAIL_LENGTH entries are included in the prompt.
 * Older entries are NOT sent. This is a hard limit, not a suggestion.
 *
 * Rationale: GPT context window efficiency + prevent stale history from
 * influencing current therapeutic decisions.
 */
export const MAX_TRAIL_LENGTH = 5;

/**
 * Build the intervention continuity context string for GPT injection.
 * Concise, structured, actionable for GPT.
 *
 * RULE: Zone evolution trail is capped at MAX_TRAIL_LENGTH (5) entries.
 * Only the most recent entries are included. Older entries are discarded
 * from the prompt (they remain in memory for effectiveness calculation
 * but are NOT sent to GPT).
 *
 * Returns null if no intervention state exists yet.
 */
export function buildInterventionContext(state: InterventionState): string {
  const lines: string[] = [
    'INTERVENTION CONTINUITY:',
    `- Active intervention: ${state.lastInterventionType}`,
    `- Therapeutic goal: ${state.interventionGoal}`,
    `- Linked zone: ${state.linkedZone} (severity ${state.linkedSeverity})`,
    `- Expected shift: ${state.expectedShift.from} → ${state.expectedShift.to}`,
    `- Effectiveness: ${state.effectivenessScore}/100`,
    `- Turns active: ${state.turnsActive}`,
    `- Last user response: ${state.lastUserResponse}`,
  ];

  if (state.wasReEvaluated) {
    lines.push('- ⚠️ Zone has shifted — re-evaluate your approach');
  } else {
    lines.push('- ✓ Zone stable — continue building on the same line');
  }

  // Effectiveness-based instruction
  if (state.effectivenessScore >= 70) {
    lines.push('- Instruction: Current approach is working. Continue on the same line.');
  } else if (state.effectivenessScore >= 40) {
    lines.push('- Instruction: Moderately effective. Vary slightly within the same strategy.');
  } else {
    lines.push('- Instruction: Low effectiveness. Consider a different approach within the zone.');
  }

  // User response instruction
  if (state.lastUserResponse === 'deflected') {
    lines.push('- Note: User is deflecting. Do not force, but gently bring back.');
  } else if (state.lastUserResponse === 'escalated') {
    lines.push('- Note: Escalation despite intervention. Lower intensity, more presence.');
  } else if (state.lastUserResponse === 'ignored') {
    lines.push('- Note: User is not responding to intervention. Follow the user, not your plan.');
  }

  // Zone evolution trail — HARD LIMIT: only last 5 entries sent to GPT
  const trail = state.zoneEvolution.slice(-MAX_TRAIL_LENGTH);
  if (trail.length > 0) {
    lines.push('- Zone evolution (last ' + trail.length + '):');
    for (const entry of trail) {
      lines.push(`  [${entry.turnIndex}] ${entry.zoneLabel} (sev ${entry.severity}) | ${entry.interventionType} | response: ${entry.userResponse}`);
    }
  }

  return lines.join('\n');
}
