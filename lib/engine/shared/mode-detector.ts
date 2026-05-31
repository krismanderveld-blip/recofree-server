/**
 * Mode Detector — Deterministic Marker-Based Mode Detection
 * Based on RECOFREE_SCHEMA_MODE_ENGINE_CANON_V1 Sections 6, 7, 8, 11
 *
 * RULES:
 * - Hard markers raise candidate weights only, never decide alone
 * - Multi-signal alignment strengthens candidates
 * - Safety override: crisis pauses deep exploration
 * - Modes are candidates, not diagnoses
 * - Active modes live in session buffer only (never persisted as identity)
 */

import {
  ModeId,
  ModeCandidate,
  ModeDecision,
  ModeEvidence,
  ModeInterventionHint,
  SchemaModeDetectionInput,
  ELIAS_PRIMARY_MODES,
  KIM_PRIMARY_MODES,
} from './schema-mode-types';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Mode Marker Definitions
// ═══════════════════════════════════════════════════════════════════════════════

type ModeMarkerDef = {
  modeId: ModeId;
  textMarkers: string[];
  interventionHint: ModeInterventionHint;
  baseRiskWeight: number;
  /** Slider conditions that boost confidence (slider name → threshold direction) */
  sliderBoosts?: Array<{ slider: string; direction: 'above' | 'below'; threshold: number }>;
  /** Zone conditions that boost confidence */
  zoneBoosts?: string[];
};

const MODE_MARKERS: ModeMarkerDef[] = [
  // ── Child Modes ──
  {
    modeId: 'VULNERABLE_CHILD',
    textMarkers: [
      'i feel alone', 'i am scared', 'i feel small', 'nobody cares',
      'i need someone', 'i cannot do this', 'please don\'t leave',
      'i\'m so scared', 'i feel lost', 'i\'m all alone', 'help me',
      'i can\'t handle', 'i feel helpless', 'i\'m afraid',
    ],
    interventionHint: 'VALIDATE',
    baseRiskWeight: 0.5,
    sliderBoosts: [
      { slider: 'despondency', direction: 'above', threshold: 6 },
      { slider: 'emotionalBurden', direction: 'above', threshold: 6 },
    ],
    zoneBoosts: ['ORANGE', 'RED'],
  },
  {
    modeId: 'ANGRY_CHILD',
    textMarkers: [
      'this is unfair', 'i am sick of this', 'why does nobody listen',
      'i hate this', 'they never care', 'i am done with everyone',
      'nobody listens', 'i\'m so angry', 'it\'s not fair', 'i\'m furious',
      'screw this', 'i can\'t take this anymore',
    ],
    interventionHint: 'VALIDATE',
    baseRiskWeight: 0.4,
    sliderBoosts: [
      { slider: 'frustration', direction: 'above', threshold: 7 },
    ],
    zoneBoosts: ['ORANGE', 'RED'],
  },
  {
    modeId: 'IMPULSIVE_CHILD',
    textMarkers: [
      'i need it now', 'i don\'t care what happens', 'i will stop tomorrow',
      'just one more', 'i can\'t wait', 'i want it now', 'fuck it',
      'one more time', 'i\'ll deal with it later', 'just this once',
    ],
    interventionHint: 'RELAPSE_PREVENTION',
    baseRiskWeight: 0.7,
    sliderBoosts: [
      { slider: 'craving', direction: 'above', threshold: 6 },
    ],
    zoneBoosts: ['ORANGE', 'RED'],
  },
  {
    modeId: 'HAPPY_CHILD',
    textMarkers: [
      'i feel good', 'i\'m happy', 'this feels great', 'i\'m proud',
      'i did it', 'things are better', 'i feel free',
    ],
    interventionHint: 'NO_INTERVENTION',
    baseRiskWeight: 0.0,
  },

  // ── Coping Modes ──
  {
    modeId: 'DETACHED_PROTECTOR',
    textMarkers: [
      'whatever', 'doesn\'t matter', 'forget it', 'never mind',
      'i don\'t care', 'nothing matters', 'change the subject',
      'can we talk about something else', 'it\'s fine', 'not important',
      'who cares', 'leave it',
    ],
    interventionHint: 'GROUND',
    baseRiskWeight: 0.4,
    zoneBoosts: ['YELLOW', 'ORANGE'],
  },
  {
    modeId: 'AVOIDANT_PROTECTOR',
    textMarkers: [
      'later', 'not now', 'i don\'t want to think about it',
      'i just need distraction', 'let\'s not go there', 'skip this',
      'can we do something else', 'i\'m not ready', 'maybe another time',
      'i don\'t want to talk about it',
    ],
    interventionHint: 'NAME_PATTERN',
    baseRiskWeight: 0.3,
  },
  {
    modeId: 'COMPLIANT_SURRENDERER',
    textMarkers: [
      'whatever you want', 'it\'s fine', 'i\'ll do what you say',
      'i\'m sorry', 'you\'re right', 'i should just agree',
      'i don\'t want to cause problems', 'i\'ll just go along',
      'my opinion doesn\'t matter',
    ],
    interventionHint: 'BOUNDARY_SUPPORT',
    baseRiskWeight: 0.3,
  },
  {
    modeId: 'OVERCOMPENSATOR',
    textMarkers: [
      'i do not need anyone', 'i will show them', 'they\'re all wrong',
      'i\'m better than this', 'i don\'t need help', 'i\'ll prove them wrong',
      'they\'re pathetic', 'i\'m above this',
    ],
    interventionHint: 'NAME_PATTERN',
    baseRiskWeight: 0.4,
  },

  // ── Parent Modes ──
  {
    modeId: 'PUNITIVE_PARENT',
    textMarkers: [
      'i hate myself', 'i am worthless', 'i deserve this',
      'i should suffer', 'i ruin everything', 'i am disgusting',
      'i am weak', 'i\'m pathetic', 'i deserve to be punished',
      'i\'m a terrible person', 'i\'m garbage', 'i don\'t deserve',
    ],
    interventionHint: 'SELF_COMPASSION',
    baseRiskWeight: 0.8,
    sliderBoosts: [
      { slider: 'despondency', direction: 'above', threshold: 7 },
    ],
    zoneBoosts: ['RED', 'PURPLE'],
  },
  {
    modeId: 'DEMANDING_PARENT',
    textMarkers: [
      'i must', 'i should be able to', 'no excuses', 'not good enough',
      'i have to fix this now', 'i cannot fail', 'i need to be perfect',
      'there\'s no room for error', 'i should try harder',
      'i\'m not doing enough',
    ],
    interventionHint: 'DEFUSION',
    baseRiskWeight: 0.4,
  },

  // ── Healthy Modes ──
  {
    modeId: 'HEALTHY_ADULT',
    textMarkers: [
      'i can take one step', 'i need to slow down',
      'this is hard but i can choose', 'i want to try',
      'let me think about this', 'i can ask for help',
      'i made a mistake but i can learn', 'i\'m working on it',
    ],
    interventionHint: 'NO_INTERVENTION',
    baseRiskWeight: 0.0,
  },
  {
    modeId: 'CAREGIVER_SELF',
    textMarkers: [
      'i need to take care of myself', 'i deserve rest',
      'i can set a boundary', 'my needs matter too',
    ],
    interventionHint: 'NO_INTERVENTION',
    baseRiskWeight: 0.0,
  },
  {
    modeId: 'BOUNDARY_SELF',
    textMarkers: [
      'i can say no', 'this is my limit', 'i need space',
      'i\'m allowed to set boundaries', 'enough is enough',
    ],
    interventionHint: 'NO_INTERVENTION',
    baseRiskWeight: 0.0,
  },

  // ── Addiction-Specific Modes (Elias) ──
  {
    modeId: 'CRISIS_COLLAPSE',
    textMarkers: [
      'i can\'t go on', 'everything is falling apart', 'i give up',
      'there\'s no point', 'i want to disappear', 'end it all',
      'i can\'t take this', 'it\'s over',
    ],
    interventionHint: 'CRISIS_ESCALATION',
    baseRiskWeight: 1.0,
    zoneBoosts: ['RED', 'PURPLE'],
  },
  {
    modeId: 'RELAPSE_SEEKING',
    textMarkers: [
      'i want to use', 'i need a drink', 'i need to score',
      'i\'m going to use', 'i want to get high', 'i need something',
      'i\'m craving so bad', 'i can\'t resist',
    ],
    interventionHint: 'RELAPSE_PREVENTION',
    baseRiskWeight: 0.9,
    sliderBoosts: [
      { slider: 'craving', direction: 'above', threshold: 7 },
    ],
    zoneBoosts: ['RED'],
  },
  {
    modeId: 'RELAPSE_JUSTIFYING',
    textMarkers: [
      'just one time', 'i can handle it', 'it\'s not that bad',
      'everyone does it', 'i deserve a break', 'one won\'t hurt',
      'i\'ve earned it', 'it\'s under control', 'i can stop anytime',
    ],
    interventionHint: 'MOTIVATIONAL_INTERVIEWING',
    baseRiskWeight: 0.8,
    sliderBoosts: [
      { slider: 'craving', direction: 'above', threshold: 5 },
    ],
  },
  {
    modeId: 'SHAME_SPIRAL',
    textMarkers: [
      'i relapsed again', 'i\'m so ashamed', 'i can\'t believe i did it again',
      'everyone will judge me', 'i\'m a failure', 'i let everyone down',
      'i\'m disgusting', 'i can\'t face anyone', 'what\'s wrong with me',
    ],
    interventionHint: 'SELF_COMPASSION',
    baseRiskWeight: 0.7,
    sliderBoosts: [
      { slider: 'despondency', direction: 'above', threshold: 6 },
    ],
    zoneBoosts: ['ORANGE', 'RED'],
  },
  {
    modeId: 'RELATIONAL_PANIC',
    textMarkers: [
      'they\'re going to leave', 'i\'m losing them', 'they don\'t love me',
      'they\'re pulling away', 'i\'m going to be abandoned',
      'what if they leave', 'i can\'t lose them',
    ],
    interventionHint: 'STABILIZE',
    baseRiskWeight: 0.6,
    zoneBoosts: ['ORANGE', 'RED'],
  },

  // ── Kim-Specific Modes ──
  {
    modeId: 'RESCUE_MODE',
    textMarkers: [
      'i need to save them', 'if i stop they will collapse',
      'i have to fix it', 'i cannot let them fail',
      'i am responsible for their recovery', 'i have to help them',
      'they need me', 'without me they\'ll relapse',
    ],
    interventionHint: 'BOUNDARY_SUPPORT',
    baseRiskWeight: 0.5,
    sliderBoosts: [
      { slider: 'stress', direction: 'above', threshold: 6 },
    ],
  },
  {
    modeId: 'CONTROL_MODE',
    textMarkers: [
      'i need to know everything', 'i have to check',
      'i cannot trust them', 'i must prevent relapse',
      'i need proof', 'are they lying', 'i have to monitor',
      'i need to see their phone',
    ],
    interventionHint: 'BOUNDARY_SUPPORT',
    baseRiskWeight: 0.5,
    sliderBoosts: [
      { slider: 'stress', direction: 'above', threshold: 6 },
    ],
  },
  {
    modeId: 'EXHAUSTED_CAREGIVER',
    textMarkers: [
      'i cannot keep doing this', 'i am empty', 'i am exhausted',
      'i have nothing left', 'i am disappearing', 'i\'m burned out',
      'i can\'t do this anymore', 'i\'m losing myself',
    ],
    interventionHint: 'VALIDATE',
    baseRiskWeight: 0.6,
    sliderBoosts: [
      { slider: 'boundaryFatigue', direction: 'above', threshold: 7 },
      { slider: 'emotionalBurden', direction: 'above', threshold: 7 },
    ],
    zoneBoosts: ['ORANGE', 'RED'],
  },
  {
    modeId: 'MORAL_INJURY',
    textMarkers: [
      'i hate who i became', 'this is not me', 'i crossed a line',
      'i cannot forgive myself', 'i betrayed myself',
      'i became someone i don\'t want to be', 'i violated my values',
    ],
    interventionHint: 'SELF_COMPASSION',
    baseRiskWeight: 0.6,
    sliderBoosts: [
      { slider: 'despondency', direction: 'above', threshold: 6 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Detection Logic
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect mode candidates from deterministic text markers and context signals.
 * Returns raw candidates — validation/decision happens in the router.
 */
export function detectModeCandidates(input: SchemaModeDetectionInput): ModeCandidate[] {
  const messageLower = input.message.toLowerCase();
  const now = new Date().toISOString();
  const candidates: ModeCandidate[] = [];

  // Filter modes by user type
  const relevantModes = input.userType === 'elias' ? ELIAS_PRIMARY_MODES : KIM_PRIMARY_MODES;

  for (const markerDef of MODE_MARKERS) {
    // Skip modes not relevant for this user type (except shared modes)
    if (!relevantModes.includes(markerDef.modeId) && markerDef.modeId !== 'HAPPY_CHILD') {
      continue;
    }

    let confidence = 0;
    const evidence: ModeEvidence[] = [];

    // ── Text marker matching ──
    const matchedMarkers = markerDef.textMarkers.filter(marker =>
      messageLower.includes(marker)
    );

    if (matchedMarkers.length > 0) {
      // Base confidence from text markers (0.3 for 1, 0.5 for 2, 0.7 for 3+)
      confidence = Math.min(0.3 + (matchedMarkers.length - 1) * 0.2, 0.7);
      for (const marker of matchedMarkers) {
        evidence.push({
          evidenceType: 'TEXT_MARKER',
          value: marker,
          timestamp: now,
          sourceLayer: 'current_input',
        });
      }
    }

    // ── Slider boost ──
    if (markerDef.sliderBoosts) {
      for (const boost of markerDef.sliderBoosts) {
        const sliderValue = input.sliders[boost.slider];
        if (sliderValue !== undefined) {
          const triggered = boost.direction === 'above'
            ? sliderValue >= boost.threshold
            : sliderValue <= boost.threshold;
          if (triggered) {
            confidence += 0.15;
            evidence.push({
              evidenceType: 'SLIDER_SHIFT',
              value: `${boost.slider}=${sliderValue} (${boost.direction} ${boost.threshold})`,
              timestamp: now,
              sourceLayer: 'current_input',
            });
          }
        }
      }
    }

    // ── Zone boost ──
    if (markerDef.zoneBoosts && markerDef.zoneBoosts.includes(input.zoneColor)) {
      confidence += 0.1;
      evidence.push({
        evidenceType: 'ZONE_SHIFT',
        value: `zone=${input.zoneColor}`,
        timestamp: now,
        sourceLayer: 'buffer',
      });
    }

    // ── History pattern boost (from user.dat tendencies) ──
    const tendency = input.modeTendencies.find(t => t.modeId === markerDef.modeId);
    if (tendency && tendency.frequency >= 3) {
      confidence += 0.1;
      evidence.push({
        evidenceType: 'HISTORY_PATTERN',
        value: `frequency=${tendency.frequency}, lastSeen=${tendency.lastSeen}`,
        timestamp: now,
        sourceLayer: 'user.dat',
      });
    }

    // ── Projection boost (for modes linked to future fears) ──
    if (input.activeProjections.length > 0) {
      const projectionLinked = ['VULNERABLE_CHILD', 'RELATIONAL_PANIC', 'RELAPSE_SEEKING', 'CRISIS_COLLAPSE'];
      if (projectionLinked.includes(markerDef.modeId)) {
        const hasFearProjection = input.activeProjections.some(p =>
          p.category === 'fear' || p.category === 'relapse_window'
        );
        if (hasFearProjection) {
          confidence += 0.1;
          evidence.push({
            evidenceType: 'PROJECTION_ENTRY',
            value: 'fear/relapse projection active',
            timestamp: now,
            sourceLayer: 'projections.dat',
          });
        }
      }
    }

    // Only emit candidate if confidence > 0 (at least one signal)
    if (confidence > 0 && evidence.length > 0) {
      candidates.push({
        modeId: markerDef.modeId,
        confidence: Math.min(confidence, 1.0),
        source: 'DETERMINISTIC_MARKER',
        evidence,
        riskWeight: markerDef.baseRiskWeight,
        interventionHint: markerDef.interventionHint,
        allowedForPrompt: true, // Router may override this
      });
    }
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  return candidates;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Mode Validation / Decision
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate mode candidates and produce a ModeDecision.
 * Applies safety hierarchy, multi-signal rule, and user-type filtering.
 */
export function validateModes(
  candidates: ModeCandidate[],
  input: SchemaModeDetectionInput
): ModeDecision {
  if (candidates.length === 0) {
    return {
      acceptedModes: [],
      rejectedModes: [],
      dominantMode: null,
      modeConflict: false,
      reason: 'no_candidates_detected',
      promptSummary: '',
    };
  }

  const accepted: ModeCandidate[] = [];
  const rejected: ModeCandidate[] = [];

  // Minimum confidence threshold for acceptance
  const MIN_CONFIDENCE = 0.3;

  for (const candidate of candidates) {
    // Reject if below minimum confidence
    if (candidate.confidence < MIN_CONFIDENCE) {
      rejected.push({ ...candidate, allowedForPrompt: false });
      continue;
    }

    // Safety override: if crisis active, only accept safety-relevant modes
    if (input.isCrisis) {
      const crisisRelevant: ModeId[] = [
        'CRISIS_COLLAPSE', 'PUNITIVE_PARENT', 'SHAME_SPIRAL',
        'RELAPSE_SEEKING', 'VULNERABLE_CHILD',
      ];
      if (!crisisRelevant.includes(candidate.modeId)) {
        rejected.push({ ...candidate, allowedForPrompt: false });
        continue;
      }
    }

    // VSP RED/PURPLE: block deep exploration modes, keep safety modes
    if (input.zoneColor === 'RED' || input.zoneColor === 'PURPLE') {
      const unsafeToExplore: ModeId[] = [
        'OVERCOMPENSATOR', 'DEMANDING_PARENT', 'COMPLIANT_SURRENDERER',
      ];
      if (unsafeToExplore.includes(candidate.modeId)) {
        rejected.push({ ...candidate, allowedForPrompt: false });
        continue;
      }
    }

    accepted.push(candidate);
  }

  // Determine dominant mode (highest confidence among accepted)
  const dominantMode = accepted.length > 0 ? accepted[0].modeId : null;

  // Detect mode conflict (two high-confidence modes with different intervention hints)
  const modeConflict = accepted.length >= 2 &&
    accepted[0].confidence > 0.5 &&
    accepted[1].confidence > 0.5 &&
    accepted[0].interventionHint !== accepted[1].interventionHint;

  // Build reason
  let reason = 'no_dominant';
  if (dominantMode) {
    reason = `dominant=${dominantMode} (conf=${accepted[0].confidence.toFixed(2)})`;
    if (modeConflict) {
      reason += ` CONFLICT with ${accepted[1].modeId}`;
    }
  }

  return {
    acceptedModes: accepted,
    rejectedModes: rejected,
    dominantMode,
    modeConflict,
    reason,
    promptSummary: '', // Built by router
  };
}
