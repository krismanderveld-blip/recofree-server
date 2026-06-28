/**
 * DGT Detector — Deterministic Marker Detection
 * Based on RECOFREE_DGT_THERAPY_ENGINE_CANON_V4_HYBRID_MANUS_READY Sections 10-16
 *
 * Detects DGT-relevant signals (emotional flooding, shame spiral, relapse urge,
 * abandonment panic, etc.) from user text using deterministic marker matching.
 * No LLM involved.
 */

import type { DGTSignalId, DGTEvidence } from './dbt-types';
import { LocalDeviceTimeService } from "@/lib/core/time";

// ─── Marker definitions per signal ─────────────────────────────────────────

const MARKERS: Record<DGTSignalId, readonly string[]> = {
  EMOTIONAL_FLOODING: [
    'overwhelmed',
    'cannot think',
    'too much',
    'drowning',
    'flooding',
    'cannot breathe',
    'everything at once',
    'falling apart',
    'cannot handle',
    'losing it',
  ],
  SHAME_SPIRAL: [
    'worthless',
    'disgusting',
    'weak',
    'ruined everything',
    'i deserve this',
    'recovery is over',
    'hiding',
    'i am bad',
    'i am the worst',
    'everyone is better',
  ],
  IMPULSIVITY: [
    'just do it',
    'cannot wait',
    'need it now',
    'going to send',
    'going to text',
    'going to call',
    'about to',
    'i am going to',
    'right now',
    'cannot stop myself',
  ],
  RELAPSE_URGE: [
    'want to drink',
    'want to use',
    'craving',
    'one more time',
    'just once',
    'need a drink',
    'need to use',
    'relapse',
    'slip',
    'i deserve it',
    'tomorrow i stop',
  ],
  ABANDONMENT_PANIC: [
    'they will leave',
    'never see them again',
    'they are leaving',
    'abandoned',
    'left alone',
    'no one cares',
    'they forgot me',
    'silence means',
    'not replying',
    'why no answer',
  ],
  CONTROL_BEHAVIOR: [
    'must check',
    'need to know',
    'have to monitor',
    'cannot trust',
    'need proof',
    'checking',
    'tracking',
    'i need to control',
    'if i do not check',
  ],
  RESCUE_OVERLOAD: [
    'if i stop they collapse',
    'responsible for their recovery',
    'cannot stop helping',
    'must save',
    'without me they',
    'i have to fix them',
    'they need me',
    'i cannot rest',
  ],
  SELF_ATTACK: [
    'i am pathetic',
    'i am garbage',
    'i am trash',
    'i am broken',
    'i am useless',
    'i hate myself',
    'i am a failure',
    'i ruin everything',
    'i am disgusting',
  ],
  RELATIONAL_ESCALATION: [
    'going to confront',
    'need to tell them',
    'cannot keep quiet',
    'going to explode',
    'they need to hear',
    'i will show them',
    'this ends now',
    'i am done with them',
  ],
  PANIC: [
    'panic',
    'heart racing',
    'cannot breathe',
    'dying',
    'something terrible',
    'attack',
    'shaking',
    'hyperventilating',
    'chest tight',
  ],
  SHUTDOWN: [
    'numb',
    'empty',
    'nothing matters',
    'cannot feel',
    'shut down',
    'frozen',
    'blank',
    'disconnected',
    'not here',
    'gone',
  ],
  EXHAUSTION: [
    'exhausted',
    'cannot anymore',
    'drained',
    'burned out',
    'no energy',
    'too tired',
    'done',
    'depleted',
    'running on empty',
  ],
  ANGER_ESCALATION: [
    'furious',
    'rage',
    'want to hit',
    'want to break',
    'explode',
    'boiling',
    'seething',
    'want to scream',
    'hate',
  ],
  CHECKING_URGE: [
    'need to check',
    'have to look',
    'must see',
    'checking their',
    'looking at their',
    'phone',
    'location',
    'online status',
    'last seen',
  ],
  BOUNDARY_COLLAPSE: [
    'said yes again',
    'cannot say no',
    'let them',
    'gave in',
    'crossed my boundary',
    'i let it happen',
    'did not stand up',
    'i allowed',
  ],
  DISSOCIATION_LIKE_DISTANCE: [
    'not real',
    'watching myself',
    'outside my body',
    'far away',
    'dreamlike',
    'foggy',
    'detached',
    'autopilot',
    'unreal',
  ],
  CRAVING_WAVE: [
    'craving',
    'urge',
    'want it',
    'need it',
    'body wants',
    'mouth watering',
    'thinking about using',
    'thinking about drinking',
    'the pull',
  ],
  OVERWHELM: [
    'too much',
    'cannot cope',
    'everything is',
    'piling up',
    'no way out',
    'suffocating',
    'trapped',
    'stuck',
    'cannot manage',
  ],
};

// ─── Detection result ──────────────────────────────────────────────────────

export interface DGTDetectionResult {
  signalId: DGTSignalId;
  confidence: number;
  matchedMarkers: string[];
  evidence: DGTEvidence[];
}

// ─── High-priority signals (Section 3: crisis/relapse/destabilization) ─────

const HIGH_PRIORITY_SIGNALS: DGTSignalId[] = [
  'EMOTIONAL_FLOODING',
  'SHAME_SPIRAL',
  'RELAPSE_URGE',
  'ABANDONMENT_PANIC',
  'PANIC',
  'SHUTDOWN',
  'SELF_ATTACK',
  'CRAVING_WAVE',
];

// ─── Detector function ─────────────────────────────────────────────────────

/**
 * Detects DGT-relevant signals from user text using deterministic marker matching.
 * Returns all detected signals sorted by confidence (highest first).
 * Confidence scoring per Section 22:
 *   single marker = 0.20 base
 *   multiple markers = 0.40
 *   high-priority signal boost = +0.15
 */
export function detectDGTSignals(userMessage: string): DGTDetectionResult[] {
  const lower = userMessage.toLowerCase();
  const results: DGTDetectionResult[] = [];
  const now = LocalDeviceTimeService.now().utcIso;

  for (const [signalId, markers] of Object.entries(MARKERS) as [DGTSignalId, readonly string[]][]) {
    const matchedMarkers: string[] = [];

    for (const marker of markers) {
      if (lower.includes(marker)) {
        matchedMarkers.push(marker);
      }
    }

    if (matchedMarkers.length > 0) {
      // Confidence scoring (Section 22):
      // single marker = 0.20
      // multiple markers = 0.40
      // +0.10 per additional marker beyond 2
      // high-priority boost = +0.15
      // capped at 0.95
      const priorityBoost = HIGH_PRIORITY_SIGNALS.includes(signalId) ? 0.15 : 0;
      let baseConfidence: number;
      if (matchedMarkers.length === 1) {
        baseConfidence = 0.20;
      } else {
        baseConfidence = 0.40 + (matchedMarkers.length - 2) * 0.10;
      }
      const confidence = Math.min(0.95, baseConfidence + priorityBoost);

      const evidence: DGTEvidence[] = matchedMarkers.map((m) => ({
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
 * Quick check: does the message contain any DGT-relevant markers?
 */
export function hasDGTSignals(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  for (const markers of Object.values(MARKERS)) {
    for (const marker of markers) {
      if (lower.includes(marker)) return true;
    }
  }
  return false;
}
