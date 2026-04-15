/**
 * RegulationDecayEngine — Patch F
 *
 * Controlled score reduction to prevent escalation-only behavior.
 * The engine must not only escalate — it must also regulate.
 *
 * THREE DECAY TYPES:
 * 1. TIME DECAY: -2 to -5 per cycle if no strong trigger
 * 2. RESPONSE DECAY: -5 to -15 if user intensity clearly drops
 * 3. OVERSHOOT CORRECTION: up to -20 if user shifts sharply from high to calm
 *
 * RULES:
 * - Decay affects ShortTermMemoryBuffer live zone only
 * - Decay must NOT erase user.dat pattern weights directly
 * - Decay changes immediate state, not long-term profile
 */

import type { BufferState, ZoneColor } from './short-term-memory-buffer';
import { scoreToZone } from './short-term-memory-buffer';

// ─── Decay Result ────────────────────────────────────────────

export interface DecayResult {
  /** New zone score after decay */
  newZoneScore: number;
  /** New zone color after decay */
  newZoneColor: ZoneColor;
  /** Total decay applied */
  decayApplied: number;
  /** Which decay types were active */
  activeDecayTypes: ('time' | 'response' | 'overshoot')[];
  /** Reason string for debugging */
  reason: string;
}

// ─── Time Decay ──────────────────────────────────────────────

/**
 * TIME DECAY: If no strong trigger appears, reduce by 2–5 per cycle.
 * A "cycle" is each message exchange.
 */
function computeTimeDecay(buffer: BufferState): number {
  // No trigger guess in current message → apply time decay
  if (!buffer.currentTriggerGuess && buffer.currentIntent === 'neutral') {
    // Stronger decay in GREEN/YELLOW (natural settling)
    if (buffer.currentZoneScore <= 40) return -2;
    // Moderate decay in ORANGE
    if (buffer.currentZoneScore <= 60) return -3;
    // Lighter decay in RED (don't drop too fast from high distress)
    return -4;
  }

  // Weak trigger or non-crisis intent → light decay
  if (buffer.currentIntent !== 'crisis' && buffer.currentIntent !== 'venting') {
    return -2;
  }

  return 0; // No time decay during active crisis/venting
}

// ─── Response Decay ──────────────────────────────────────────

/**
 * RESPONSE DECAY: If user intensity clearly drops, reduce by 5–15.
 * Detected by comparing current zone score with previous.
 */
function computeResponseDecay(buffer: BufferState): number {
  const drop = buffer.previousZoneScore - buffer.currentZoneScore;

  // User is already calming down naturally
  if (buffer.intensityTrajectory === 'falling') {
    if (drop >= 20) return -10; // Strong calming
    if (drop >= 10) return -7;  // Moderate calming
    return -5;                   // Light calming
  }

  // Stable but lower than previous
  if (buffer.intensityTrajectory === 'stable' && drop >= 10) {
    return -5;
  }

  return 0;
}

// ─── Overshoot Correction ────────────────────────────────────

/**
 * OVERSHOOT CORRECTION: If user shifts sharply from high intensity to calm,
 * reduce up to -20. This prevents the engine from staying in RED/PURPLE
 * when the user has clearly moved on.
 */
function computeOvershootCorrection(buffer: BufferState): number {
  const drop = buffer.previousZoneScore - buffer.currentZoneScore;

  // Sharp shift: was in RED/PURPLE, now clearly calmer
  if (buffer.previousZoneScore >= 60 && buffer.currentZoneScore <= 35 && drop >= 25) {
    return -20;
  }

  // Moderate shift: was in ORANGE+, now in YELLOW or below
  if (buffer.previousZoneScore >= 50 && buffer.currentZoneScore <= 30 && drop >= 20) {
    return -15;
  }

  return 0;
}

// ─── Main Decay Function ─────────────────────────────────────

/**
 * Apply regulation decay to the buffer's zone score.
 *
 * Called AFTER the buffer is updated with the new message,
 * but BEFORE the GPT payload is built.
 *
 * This ensures the engine can de-escalate, not only escalate.
 *
 * @param buffer - The current ShortTermMemoryBuffer state
 * @returns DecayResult with the adjusted zone score
 */
export function applyDecay(buffer: BufferState): DecayResult {
  const activeTypes: ('time' | 'response' | 'overshoot')[] = [];
  const reasons: string[] = [];
  let totalDecay = 0;

  // Skip decay on first message (nothing to compare)
  if (buffer.messageCount <= 1) {
    return {
      newZoneScore: buffer.currentZoneScore,
      newZoneColor: buffer.currentZoneColor,
      decayApplied: 0,
      activeDecayTypes: [],
      reason: 'First message — no decay applied',
    };
  }

  // Skip decay during crisis
  if (buffer.currentIntent === 'crisis' || buffer.currentZoneColor === 'PURPLE') {
    return {
      newZoneScore: buffer.currentZoneScore,
      newZoneColor: buffer.currentZoneColor,
      decayApplied: 0,
      activeDecayTypes: [],
      reason: 'Crisis active — decay suspended',
    };
  }

  // 1. Time decay
  const timeDecay = computeTimeDecay(buffer);
  if (timeDecay < 0) {
    totalDecay += timeDecay;
    activeTypes.push('time');
    reasons.push(`time decay: ${timeDecay}`);
  }

  // 2. Response decay
  const responseDecay = computeResponseDecay(buffer);
  if (responseDecay < 0) {
    totalDecay += responseDecay;
    activeTypes.push('response');
    reasons.push(`response decay: ${responseDecay}`);
  }

  // 3. Overshoot correction
  const overshootDecay = computeOvershootCorrection(buffer);
  if (overshootDecay < 0) {
    totalDecay += overshootDecay;
    activeTypes.push('overshoot');
    reasons.push(`overshoot correction: ${overshootDecay}`);
  }

  // Apply decay (floor at 0)
  const newScore = Math.max(0, buffer.currentZoneScore + totalDecay);

  return {
    newZoneScore: newScore,
    newZoneColor: scoreToZone(newScore),
    decayApplied: totalDecay,
    activeDecayTypes: activeTypes,
    reason: reasons.length > 0 ? reasons.join('; ') : 'No decay conditions met',
  };
}

/**
 * Apply decay result to the buffer, returning a new buffer with adjusted scores.
 */
export function applyDecayToBuffer(buffer: BufferState, decay: DecayResult): BufferState {
  if (decay.decayApplied === 0) return buffer;

  return {
    ...buffer,
    currentZoneScore: decay.newZoneScore,
    currentZoneColor: decay.newZoneColor,
  };
}
