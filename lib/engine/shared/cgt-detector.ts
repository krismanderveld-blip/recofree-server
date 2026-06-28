/**
 * CGT Detector — Deterministic Marker Detection
 * Based on RECOFREE_CGT_THERAPY_ENGINE_CANON_V3_ULTIMATE Section 19
 *
 * Detects CBT-relevant signals (cognitive distortions, thinking patterns) from user text
 * using deterministic marker matching. No LLM involved.
 */

import type { CBTSignalId, CBTEvidence } from './cgt-types';
import { LocalDeviceTimeService } from "@/lib/core/time";

// ─── Marker definitions per signal (Section 19) ─────────────────────────────

const MARKERS: Record<CBTSignalId, readonly string[]> = {
  BLACK_WHITE_THINKING: [
    'always',
    'never',
    'everything',
    'nothing',
    'ruined',
    'total failure',
    'completely',
    'all gone',
  ],
  CATASTROPHIZING: [
    'disaster',
    'collapse',
    'destroyed',
    'cannot survive',
    'worst case',
    'everything collapses',
    'worst possible',
    'this destroys everything',
  ],
  FORTUNE_TELLING: [
    'i will fail',
    'it will never',
    'never going to',
    'will happen',
    'i know it will',
    'it will only get worse',
    'i will lose',
  ],
  SELF_ATTACK: [
    'worthless',
    'disgusting',
    'weak',
    'pathetic',
    'broken',
    'useless',
    'i am garbage',
    'i am trash',
  ],
  RELAPSE_JUSTIFICATION: [
    'just once',
    'tomorrow i stop',
    'i deserve it',
    'i can handle it',
    'it does not matter',
    'one more time',
    'just this once',
  ],
  CONTROL_THINKING: [
    'must check',
    'need proof',
    'have to know',
    'cannot trust unless',
    'i need to control',
    'i have to monitor',
    'i must keep track',
  ],
  RESCUE_THINKING: [
    'must save',
    'responsible for their recovery',
    'if i stop they collapse',
    'i have to fix them',
    'without me they',
    'i must protect them',
    'it is my fault if',
  ],
  HELPLESSNESS: [
    'cannot',
    'impossible',
    'hopeless',
    'no point',
    'there is no way',
    'i give up',
    'nothing works',
  ],
  AVOIDANCE: [
    'i don\'t want to think about',
    'i can\'t deal with',
    'i avoid',
    'i push it away',
    'i can\'t face',
    'make it go away',
    'i don\'t want to feel',
  ],
  SHAME_SPIRAL: [
    'i am bad',
    'i am a bad person',
    'i ruin everything',
    'everyone is better',
    'i am the worst',
    'i am disgusting',
    'one behavior proves',
  ],
  PERFECTIONISM: [
    'must fix everything',
    'cannot fail',
    'no excuses',
    'not good enough',
    'i have to be perfect',
    'i should be better',
    'i must do more',
  ],
  FEAR_LOOP: [
    'what if',
    'i am afraid that',
    'i fear',
    'something bad will',
    'danger',
    'threat',
    'i am scared that',
  ],
  CERTAINTY_SEEKING: [
    'need certainty',
    'need to know',
    'cannot tolerate not knowing',
    'i need to be sure',
    'i must know for sure',
    'i cannot handle uncertainty',
  ],
  CORE_BELIEF_SIGNAL: [
    'i am not lovable',
    'i am powerless',
    'i am defective',
    'i am unworthy',
    'i do not deserve',
    'i will always be alone',
    'no one could love me',
  ],
  RESPONSIBILITY_DISTORTION_SIGNAL: [
    'all my fault',
    'i caused everything',
    'because of me',
    'i am responsible for',
    'their relapse is my fault',
    'if i had done more',
    'i should have prevented',
  ],
  SAFETY_BEHAVIOR_SIGNAL: [
    'i have to check',
    'i need reassurance',
    'i must make sure',
    'i keep checking',
    'i track',
    'i monitor',
    'i overexplain',
  ],
};

// ─── Detection result ───────────────────────────────────────────────────────

export interface CBTDetectionResult {
  signalId: CBTSignalId;
  confidence: number;
  matchedMarkers: string[];
  evidence: CBTEvidence[];
}

// ─── Detector function ──────────────────────────────────────────────────────

/**
 * Detects CBT-relevant signals from user text using deterministic marker matching.
 * Returns all detected signals sorted by confidence (highest first).
 * Confidence is based on number of markers matched and signal specificity.
 */
export function detectCBTSignals(userMessage: string): CBTDetectionResult[] {
  const lower = userMessage.toLowerCase();
  const results: CBTDetectionResult[] = [];
  const now = LocalDeviceTimeService.now().utcIso;

  for (const [signalId, markers] of Object.entries(MARKERS) as [CBTSignalId, readonly string[]][]) {
    const matchedMarkers: string[] = [];

    for (const marker of markers) {
      if (lower.includes(marker)) {
        matchedMarkers.push(marker);
      }
    }

    if (matchedMarkers.length > 0) {
      // Confidence: base 0.35 for 1 match, +0.15 per additional, capped at 0.95
      // High-priority signals get a +0.1 boost (Section 6: relapse risk, shame)
      const highPrioritySignals: CBTSignalId[] = [
        'RELAPSE_JUSTIFICATION',
        'SHAME_SPIRAL',
        'SELF_ATTACK',
        'CATASTROPHIZING',
        'CORE_BELIEF_SIGNAL',
      ];
      const priorityBoost = highPrioritySignals.includes(signalId) ? 0.1 : 0;
      const confidence = Math.min(
        0.95,
        0.35 + (matchedMarkers.length - 1) * 0.15 + priorityBoost
      );

      const evidence: CBTEvidence[] = matchedMarkers.map((m) => ({
        evidenceType: 'TEXT_MARKER' as const,
        value: m,
        timestamp: now,
        sourceLayer: 'current_input' as const,
      }));

      results.push({
        signalId,
        confidence,
        matchedMarkers,
        evidence,
      });
    }
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);

  return results;
}

/**
 * Quick check: does the message contain any CBT-relevant markers?
 */
export function hasCBTSignals(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  for (const markers of Object.values(MARKERS)) {
    for (const marker of markers) {
      if (lower.includes(marker)) return true;
    }
  }
  return false;
}
