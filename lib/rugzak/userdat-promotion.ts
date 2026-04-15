/**
 * UserDat Promotion Rules — Patch H
 *
 * Controls what moves from ShortTermMemoryBuffer to user.dat.
 * Prevents noise — not every thought becomes memory.
 *
 * PROMOTION RULES:
 * A signal may move from buffer to user.dat only if:
 * - repeated 3+ times in one session, OR
 * - repeated across 2+ sessions, OR
 * - directly changes module priority, OR
 * - is crisis-relevant, OR
 * - is tied to a high-confidence relational pattern
 *
 * MAX UPDATE RULE: Max 5 meaningful user.dat updates per session.
 *
 * DO NOT store:
 * - every emotional shift
 * - temporary fluctuations
 * - single-occurrence signals
 *
 * DO store:
 * - repeated trigger activations
 * - stable trend changes
 * - reinforced relational patterns
 * - confirmed dominant core wound shifts
 * - repeated intervention outcomes
 */

import type { BufferState, TemporaryRepeat } from './short-term-memory-buffer';
import type { TriggerPattern, UserDat } from '../ai/types';

// ─── Types ────────────────────────────────────────────────────

export interface PromotionCandidate {
  /** The signal/trigger to promote */
  signal: string;
  /** Why it qualifies for promotion */
  reason: 'session_repeat_3' | 'cross_session' | 'module_change' | 'crisis' | 'relational_pattern';
  /** Confidence 0–1 */
  confidence: number;
  /** Suggested weight increase on 0–50 scale (Patch G) */
  weightDelta: number;
}

export interface PromotionResult {
  /** Candidates that passed the promotion rules */
  promotedItems: PromotionCandidate[];
  /** Candidates that were rejected */
  rejectedItems: PromotionCandidate[];
  /** How many updates were applied (max 5) */
  updatesApplied: number;
  /** Whether the max update limit was hit */
  maxReached: boolean;
}

// ─── Constants ────────────────────────────────────────────────

const MAX_UPDATES_PER_SESSION = 5;
const MIN_SESSION_REPEATS = 3;
const MIN_CROSS_SESSION_OCCURRENCES = 2;

// ─── Promotion Logic ─────────────────────────────────────────

/**
 * Evaluate which buffer signals qualify for promotion to user.dat.
 *
 * Called at session end (not during session).
 *
 * @param buffer - The session's ShortTermMemoryBuffer
 * @param existingTriggers - Current trigger patterns in user.dat
 * @param wasCrisis - Whether crisis was detected in this session
 * @param dominantModuleChanged - Whether the dominant module changed during session
 * @param relationalPatternConfidence - Confidence of detected relational pattern (0–1)
 */
export function evaluatePromotions(
  buffer: BufferState,
  existingTriggers: TriggerPattern[],
  wasCrisis: boolean,
  dominantModuleChanged: boolean,
  relationalPatternConfidence: number
): PromotionResult {
  const candidates: PromotionCandidate[] = [];

  // ── Rule 1: Session repeats (3+ times in one session) ──
  for (const repeat of buffer.temporaryRepeats) {
    if (repeat.count >= MIN_SESSION_REPEATS) {
      candidates.push({
        signal: repeat.signal,
        reason: 'session_repeat_3',
        confidence: Math.min(repeat.count / 5, 1.0),
        weightDelta: Math.min(repeat.count * 3, 15), // +3 per repeat, max +15
      });
    }
  }

  // ── Rule 2: Cross-session patterns ──
  // Check if buffer signals match existing user.dat triggers
  for (const repeat of buffer.temporaryRepeats) {
    const existing = existingTriggers.find((t) =>
      t.trigger.toLowerCase() === repeat.signal.toLowerCase()
    );
    if (existing && existing.count >= MIN_CROSS_SESSION_OCCURRENCES) {
      // Already in user.dat and repeated again → reinforce
      const alreadyCandidate = candidates.find((c) => c.signal === repeat.signal);
      if (alreadyCandidate) {
        // Upgrade existing candidate
        alreadyCandidate.confidence = Math.min(alreadyCandidate.confidence + 0.2, 1.0);
        alreadyCandidate.weightDelta = Math.min(alreadyCandidate.weightDelta + 5, 20);
      } else {
        candidates.push({
          signal: repeat.signal,
          reason: 'cross_session',
          confidence: 0.7,
          weightDelta: 10,
        });
      }
    }
  }

  // ── Rule 3: Module priority change ──
  if (dominantModuleChanged && buffer.currentTriggerGuess) {
    const alreadyCandidate = candidates.find((c) => c.signal === buffer.currentTriggerGuess);
    if (!alreadyCandidate) {
      candidates.push({
        signal: buffer.currentTriggerGuess,
        reason: 'module_change',
        confidence: 0.6,
        weightDelta: 10,
      });
    }
  }

  // ── Rule 4: Crisis-relevant ──
  if (wasCrisis && buffer.currentTriggerGuess) {
    const alreadyCandidate = candidates.find((c) => c.signal === buffer.currentTriggerGuess);
    if (alreadyCandidate) {
      alreadyCandidate.confidence = 1.0;
      alreadyCandidate.weightDelta = Math.min(alreadyCandidate.weightDelta + 10, 25);
    } else {
      candidates.push({
        signal: buffer.currentTriggerGuess,
        reason: 'crisis',
        confidence: 1.0,
        weightDelta: 20,
      });
    }
  }

  // ── Rule 5: High-confidence relational pattern ──
  if (relationalPatternConfidence >= 0.7 && buffer.currentRelationshipAnchor) {
    const signal = `relational:${buffer.currentRelationshipAnchor}`;
    const alreadyCandidate = candidates.find((c) => c.signal === signal);
    if (!alreadyCandidate) {
      candidates.push({
        signal,
        reason: 'relational_pattern',
        confidence: relationalPatternConfidence,
        weightDelta: 10,
      });
    }
  }

  // ── Apply MAX UPDATE RULE: max 5 per session ──
  // Sort by confidence (highest first), then by weightDelta
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.weightDelta - a.weightDelta;
  });

  const promoted = candidates.slice(0, MAX_UPDATES_PER_SESSION);
  const rejected = candidates.slice(MAX_UPDATES_PER_SESSION);

  return {
    promotedItems: promoted,
    rejectedItems: rejected,
    updatesApplied: promoted.length,
    maxReached: candidates.length > MAX_UPDATES_PER_SESSION,
  };
}

/**
 * Apply promoted items to user.dat trigger patterns.
 * Returns a new trigger patterns array with updated weights.
 *
 * Trigger weights use 0–50 internal scale (Patch G).
 */
export function applyPromotions(
  existingTriggers: TriggerPattern[],
  promotions: PromotionCandidate[]
): TriggerPattern[] {
  const updated = [...existingTriggers];

  for (const promo of promotions) {
    // Skip relational patterns (handled separately)
    if (promo.signal.startsWith('relational:')) continue;

    const existing = updated.find((t) =>
      t.trigger.toLowerCase() === promo.signal.toLowerCase()
    );

    if (existing) {
      // Reinforce existing trigger
      existing.count += 1;
      // Weight is on 0–50 scale (Patch G migration)
      const currentWeight = existing.weight ?? 0;
      const migratedWeight = currentWeight <= 5 ? currentWeight * 10 : currentWeight;
      existing.weight = Math.min(migratedWeight + promo.weightDelta, 50);
    } else {
      // New trigger
      updated.push({
        trigger: promo.signal,
        count: 1,
        weight: Math.min(promo.weightDelta, 50),
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      });
    }
  }

  return updated;
}
