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
      // NL markers
      'ik voel me kwetsbaar', 'ik heb iemand nodig', 'laat me niet alleen',
      'ik ben zo bang', 'ik voel me verloren', 'help me', 'ik kan het niet aan',
      'ik ben bang', 'ik voel me hulpeloos', 'ik sta er alleen voor',
      'niemand geeft om mij', 'ik voel me klein',
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
      // NL markers
      'dit is oneerlijk', 'waarom luistert niemand', 'ik haat dit',
      'ze geven nooit om mij', 'ik ben het zat', 'niemand luistert',
      'het is niet eerlijk', 'ik ben woedend', 'ik ben zo kwaad',
      'ik ben klaar met iedereen',
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
      // NL markers
      'ik wil het nu', 'het kan me niet schelen wat er gebeurt', 'ik stop morgen',
      'nog één keer', 'ik kan niet wachten', 'fuck het', 'ik regel het later',
      'nog eentje', 'alleen deze keer',
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
      // NL markers
      'ik voel me goed', 'ik ben blij', 'dit voelt geweldig', 'ik ben trots',
      'het gaat beter', 'ik voel me vrij', 'het is gelukt',
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
      // NL markers
      'maakt niet uit', 'laat maar', 'ik geef het op', 'het is prima',
      'het doet er niet toe', 'verander van onderwerp', 'wie kan het schelen',
      'boeit niet', 'maakt me niks uit', 'laat zitten',
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
      // NL markers
      'niet nu', 'ik wil er niet over nadenken',
      'ik heb afleiding nodig', 'laten we daar niet op ingaan',
      'ik ben er nog niet klaar voor', 'een andere keer', 'sla dit over',
      'ik wil er niet over praten',
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
      // NL markers
      'wat jij wilt', 'het is prima', 'ik doe wat je zegt', 'sorry',
      'je hebt gelijk', 'ik wil geen problemen', 'mijn mening doet er niet toe',
      'ik ga gewoon mee', 'het maakt niet uit wat ik vind',
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
      // NL markers
      'ik heb niemand nodig', 'ik zal het ze laten zien', 'ze hebben het mis',
      'ik ben beter dan dit', 'ik heb geen hulp nodig', 'ik bewijs het wel',
      'zij zijn zielig', 'ik sta erboven',
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
      // NL markers
      'ik haat mezelf', 'ik ben waardeloos', 'ik verdien dit',
      'ik moet lijden', 'ik verpest alles', 'ik ben walgelijk',
      'ik ben zwak', 'ik ben een slecht persoon', 'ik verdien straf',
      'ik ben zielig', 'ik deug niet',
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
      // NL markers
      'ik moet', 'ik zou dit moeten kunnen', 'geen excuses', 'niet goed genoeg',
      'ik moet dit nu oplossen', 'ik mag niet falen', 'ik moet perfect zijn',
      'geen ruimte voor fouten', 'ik moet harder proberen', 'ik doe niet genoeg',
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
      // NL markers
      'ik kan één stap zetten', 'ik moet vertragen', 'ik wil het proberen',
      'laat me erover nadenken', 'ik kan om hulp vragen', 'ik werk eraan',
      'dit is moeilijk maar ik kan kiezen', 'ik heb een fout gemaakt maar ik kan leren',
    ],
    interventionHint: 'NO_INTERVENTION',
    baseRiskWeight: 0.0,
  },
  {
    modeId: 'CAREGIVER_SELF',
    textMarkers: [
      'i need to take care of myself', 'i deserve rest',
      'i can set a boundary', 'my needs matter too',
      // NL markers
      'ik moet voor mezelf zorgen', 'ik verdien rust',
      'ik kan een grens stellen', 'mijn behoeften zijn ook belangrijk',
    ],
    interventionHint: 'NO_INTERVENTION',
    baseRiskWeight: 0.0,
  },
  {
    modeId: 'BOUNDARY_SELF',
    textMarkers: [
      'i can say no', 'this is my limit', 'i need space',
      'i\'m allowed to set boundaries', 'enough is enough',
      // NL markers
      'ik kan nee zeggen', 'dit is mijn grens', 'ik heb ruimte nodig',
      'genoeg is genoeg', 'ik mag grenzen stellen',
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
      // NL markers
      'ik kan niet meer', 'alles valt uit elkaar', 'ik geef het op',
      'het heeft geen zin', 'ik wil verdwijnen', 'het is voorbij',
      'maak er een einde aan', 'ik hou het niet meer vol',
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
      // NL markers
      'ik wil gebruiken', 'ik heb een drankje nodig', 'ik ga gebruiken',
      'ik wil high worden', 'ik heb iets nodig', 'ik verlang er zo naar',
      'ik moet scoren', 'ik kan niet weerstaan',
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
      // NL markers
      'maar één keer', 'ik kan het aan', 'het is niet zo erg',
      'iedereen doet het', 'ik verdien een pauze', 'één kan geen kwaad',
      'ik heb het verdiend', 'het is onder controle', 'ik kan altijd stoppen',
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
      // NL markers
      'ik ben teruggevallen', 'ik schaam me zo', 'ik kan het niet geloven',
      'iedereen zal me veroordelen', 'ik heb iedereen teleurgesteld',
      'wat is er mis met mij', 'ik kan niemand onder ogen komen',
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
      // NL markers
      'ze gaan weggaan', 'ik verlies ze', 'ze houden niet van me',
      'ze trekken zich terug', 'ik ga verlaten worden', 'ik kan ze niet verliezen',
      'wat als ze me verlaten',
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
      // NL markers
      'ik moet ze redden', 'als ik stop zullen ze instorten', 'ik moet het oplossen',
      'ik kan ze niet laten falen', 'ik ben verantwoordelijk voor hun herstel',
      'ze hebben me nodig', 'zonder mij vallen ze terug',
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
      // NL markers
      'ik moet alles weten', 'ik moet controleren', 'ik kan ze niet vertrouwen',
      'ik moet terugval voorkomen', 'ik heb bewijs nodig', 'ik moet hun telefoon zien',
      'liegen ze', 'ik moet in de gaten houden',
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
      // NL markers
      'ik kan dit niet blijven doen', 'ik ben leeg', 'ik ben uitgeput',
      'ik heb niets meer over', 'ik verdwijn', 'ik ben opgebrand',
      'ik verlies mezelf', 'ik kan niet meer',
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
      // NL markers
      'ik haat wie ik geworden ben', 'dit ben ik niet', 'ik heb een grens overschreden',
      'ik kan mezelf niet vergeven', 'ik heb mezelf verraden',
      'ik ben iemand geworden die ik niet wil zijn', 'ik heb mijn waarden geschonden',
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
