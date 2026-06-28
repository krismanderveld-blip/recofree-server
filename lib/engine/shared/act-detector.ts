/**
 * ACT Detector — Deterministic Marker Detection
 * Based on RECOFREE_ACT_THERAPY_ENGINE_CANON_V2_A_PLUS_B Section 15
 *
 * Detects ACT-relevant signals (fusion, avoidance, disconnection) from user text
 * using deterministic marker matching. No LLM involved.
 */

import type { ACTSignalId, ACTEvidence } from './act-types';
import { LocalDeviceTimeService } from "@/lib/core/time";

// ─── Marker definitions per signal ───────────────────────────────────────────

const MARKERS: Record<ACTSignalId, readonly string[]> = {
  THOUGHT_FUSION: [
    'i am',
    'this means',
    'it proves',
    'i know for sure',
    'there is no other way',
    'that means i',
    'this shows that',
  ],
  SHAME_FUSION: [
    'i am broken',
    'i am worthless',
    'i am disgusting',
    'i ruin everything',
    'i am weak',
    'i am pathetic',
    'i am a failure',
    'i am garbage',
    'i am trash',
    'i am nothing',
  ],
  FUTURE_FUSION: [
    'i will never',
    'it will always',
    'nothing will change',
    'i will lose',
    'it will fail',
    'what if',
    'i will always be',
    'things will never',
    'it will only get worse',
  ],
  RELAPSE_JUSTIFICATION: [
    'just once',
    'i deserve it',
    'i can handle it',
    'tomorrow i stop',
    'it does not matter',
    'i need it now',
    'one more time',
    'i earned it',
    'just this once',
    'it won\'t hurt',
  ],
  CRAVING_URGE: [
    'i need',
    'i want to use',
    'i crave',
    'i can\'t resist',
    'the urge',
    'i have to drink',
    'i have to use',
    'my body wants',
    'i feel the pull',
  ],
  CONTROL_FUSION: [
    'i have to check',
    'i need proof',
    'i must know',
    'if i stop watching',
    'i need to control',
    'i have to monitor',
    'i must keep track',
    'i need certainty',
  ],
  RESCUE_FUSION: [
    'i have to save',
    'i am responsible',
    'if i stop they will collapse',
    'i cannot let them fail',
    'it is my fault if',
    'i must protect them',
    'without me they',
    'i have to fix them',
  ],
  AVOIDANCE: [
    'i don\'t want to think about',
    'i can\'t deal with',
    'i just want it to stop',
    'i don\'t want to feel',
    'make it go away',
    'i can\'t face',
    'i avoid',
    'i push it away',
  ],
  VALUES_DISCONNECTION: [
    'nothing matters',
    'i do not care anymore',
    'there is no point',
    'why bother',
    'what\'s the point',
    'nothing means anything',
    'i don\'t care',
    'it doesn\'t matter',
  ],
  PERFECTIONISTIC_PRESSURE: [
    'i must fix everything',
    'i cannot fail',
    'no excuses',
    'not good enough',
    'i have to be perfect',
    'i should be better',
    'i must do more',
    'i can\'t make mistakes',
  ],
  HOPELESS_PREDICTION: [
    'it will never get better',
    'there is no hope',
    'i am doomed',
    'nothing works',
    'i give up',
    'it is hopeless',
    'there is no way out',
    'i will never recover',
  ],
  IDENTITY_FUSION: [
    'i am an addict',
    'i am the problem',
    'i am nothing without',
    'i am only',
    'that is who i am',
    'i will always be this',
    'i am defined by',
    'this is all i am',
  ],
  EMOTIONAL_AVOIDANCE: [
    'i don\'t feel anything',
    'i am numb',
    'i shut down',
    'i block it out',
    'i don\'t let myself feel',
    'feelings are dangerous',
    'i can\'t afford to feel',
  ],
  ACTION_PARALYSIS: [
    'i cannot move',
    'i do not know what to do',
    'everything is too much',
    'i am stuck',
    'i am frozen',
    'i can\'t decide',
    'i don\'t know where to start',
    'i am paralyzed',
  ],
};

// ─── Detection result ────────────────────────────────────────────────────────

export interface ACTDetectionResult {
  signalId: ACTSignalId;
  confidence: number;
  matchedMarkers: string[];
  evidence: ACTEvidence[];
}

// ─── Detector function ───────────────────────────────────────────────────────

/**
 * Detects ACT-relevant signals from user text using deterministic marker matching.
 * Returns all detected signals sorted by confidence (highest first).
 * Confidence is based on number of markers matched and their specificity.
 */
export function detectACTSignals(userMessage: string): ACTDetectionResult[] {
  const lower = userMessage.toLowerCase();
  const results: ACTDetectionResult[] = [];
  const now = LocalDeviceTimeService.now().utcIso;

  for (const [signalId, markers] of Object.entries(MARKERS) as [ACTSignalId, readonly string[]][]) {
    const matchedMarkers: string[] = [];

    for (const marker of markers) {
      if (lower.includes(marker)) {
        matchedMarkers.push(marker);
      }
    }

    if (matchedMarkers.length > 0) {
      // Confidence: base 0.4 for 1 match, +0.15 per additional, capped at 0.95
      // Specific signals (SHAME_FUSION, RELAPSE_JUSTIFICATION) get a +0.1 boost
      const specificSignals: ACTSignalId[] = [
        'SHAME_FUSION',
        'RELAPSE_JUSTIFICATION',
        'CRAVING_URGE',
        'HOPELESS_PREDICTION',
        'RESCUE_FUSION',
      ];
      const specificBoost = specificSignals.includes(signalId) ? 0.1 : 0;
      const confidence = Math.min(
        0.95,
        0.4 + (matchedMarkers.length - 1) * 0.15 + specificBoost
      );

      const evidence: ACTEvidence[] = matchedMarkers.map((m) => ({
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
 * Quick check: does the message contain any ACT-relevant markers?
 */
export function hasACTSignals(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  for (const markers of Object.values(MARKERS)) {
    for (const marker of markers) {
      if (lower.includes(marker)) return true;
    }
  }
  return false;
}
