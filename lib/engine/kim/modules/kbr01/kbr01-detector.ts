/**
 * KBR01 — Boundary Restoration (Kim only)
 * DETECTOR: Deterministic marker-based activation detection
 */

import type {
  KBR01RuntimeInputs,
  KBR01DetectionResult,
  KBR01DetectedMarker,
  KBR01TriggerType,
  KBR01ResponseMode,
  KBR01ActivationStatus,
  KBR01ConfidenceLevel,
} from './kbr01-types';
import type { KimModuleRouteTarget } from '../kst01/kst01-types';

// ── Marker banks ──

const WORDING_PHRASES_EN = [
  'what do i say', 'how do i say', 'what words', 'give me a script',
  'how to tell them', 'what should i say', 'exact wording',
];
const WORDING_PHRASES_NL = [
  'wat moet ik zeggen', 'hoe zeg ik', 'welke woorden', 'geef me een script',
  'hoe vertel ik', 'wat zeg ik precies',
];

const PLANNING_PHRASES_EN = [
  'i need a boundary', 'set a boundary', 'create a boundary',
  'how to set limits', 'boundary plan', 'what boundary',
];
const PLANNING_PHRASES_NL = [
  'ik heb een grens nodig', 'grens stellen', 'grens maken',
  'hoe stel ik grenzen', 'grensplan', 'welke grens',
];

const CONSEQUENCE_PHRASES_EN = [
  'what consequence', 'what happens if they', 'follow through',
  'if they break', 'what do i do when', 'consequence for',
];
const CONSEQUENCE_PHRASES_NL = [
  'welk gevolg', 'wat als ze', 'doorzetten', 'als ze de grens overgaan',
  'wat doe ik wanneer', 'consequentie voor',
];

const COLLAPSE_PHRASES_EN = [
  'i gave in again', 'boundary collapsed', 'i could not hold it',
  'i said yes again', 'i caved', 'i failed to hold',
];
const COLLAPSE_PHRASES_NL = [
  'ik gaf weer toe', 'grens ingestort', 'ik kon het niet volhouden',
  'ik zei weer ja', 'ik bezweek', 'ik hield het niet vol',
];

const OVER_EXPLAINING_PHRASES_EN = [
  'keep explaining', 'they do not listen', 'i repeat myself',
  'explaining over and over', 'i justify', 'keep defending',
];
const OVER_EXPLAINING_PHRASES_NL = [
  'blijf uitleggen', 'ze luisteren niet', 'ik herhaal mezelf',
  'steeds opnieuw uitleggen', 'ik rechtvaardig', 'blijf verdedigen',
];

const PUNITIVE_PHRASES_EN = [
  'teach them a lesson', 'make them pay', 'punish them',
  'they deserve to suffer', 'revenge', 'ultimatum',
];
const PUNITIVE_PHRASES_NL = [
  'een lesje leren', 'laten boeten', 'straffen',
  'ze verdienen het', 'wraak', 'ultimatum',
];

const SAFETY_PHRASES_EN = [
  'he threatens', 'she threatens', 'violent', 'dangerous',
  'i am scared', 'not safe', 'he hit', 'she hit',
];
const SAFETY_PHRASES_NL = [
  'hij dreigt', 'zij dreigt', 'gewelddadig', 'gevaarlijk',
  'ik ben bang', 'niet veilig', 'hij sloeg', 'zij sloeg',
];

export function detectKBR01(input: KBR01RuntimeInputs): KBR01DetectionResult {
  const markers: KBR01DetectedMarker[] = [];
  const text = `${input.latestUserMessage} ${(input.recentMessages || []).join(' ')}`.toLowerCase();

  if (input.userType !== 'kim') {
    return blocked('BLOCKED_WRONG_USER_TYPE', 'KBR01 is Kim-only and caregiver-only.');
  }

  if (input.crisisLevel >= 2 || input.k06SafetyGate === 'blocked') {
    return blocked('BLOCKED_BY_SAFETY', 'Safety gate blocks Boundary Restoration.');
  }

  const add = (id: string, trigger: KBR01TriggerType, matched: string, weight: number) => {
    markers.push({ markerId: id, triggerType: trigger, matchedText: matched, source: 'latest_message', weight });
  };

  for (const p of [...WORDING_PHRASES_EN, ...WORDING_PHRASES_NL]) {
    if (text.includes(p)) add('WORDING_TEXT', 'BOUNDARY_WORDING_REQUEST', p, 0.35);
  }
  for (const p of [...PLANNING_PHRASES_EN, ...PLANNING_PHRASES_NL]) {
    if (text.includes(p)) add('PLANNING_TEXT', 'BOUNDARY_PLANNING_REQUEST', p, 0.3);
  }
  for (const p of [...CONSEQUENCE_PHRASES_EN, ...CONSEQUENCE_PHRASES_NL]) {
    if (text.includes(p)) add('CONSEQUENCE_TEXT', 'CONSEQUENCE_CLARITY', p, 0.25);
  }
  for (const p of [...COLLAPSE_PHRASES_EN, ...COLLAPSE_PHRASES_NL]) {
    if (text.includes(p)) add('COLLAPSE_TEXT', 'BOUNDARY_COLLAPSE', p, 0.3);
  }
  for (const p of [...OVER_EXPLAINING_PHRASES_EN, ...OVER_EXPLAINING_PHRASES_NL]) {
    if (text.includes(p)) add('OVER_EXPLAIN_TEXT', 'OVER_EXPLAINING_LOOP', p, 0.25);
  }
  for (const p of [...PUNITIVE_PHRASES_EN, ...PUNITIVE_PHRASES_NL]) {
    if (text.includes(p)) add('PUNITIVE_TEXT', 'PUNITIVE_INTENT', p, 0.3);
  }
  for (const p of [...SAFETY_PHRASES_EN, ...SAFETY_PHRASES_NL]) {
    if (text.includes(p)) add('SAFETY_TEXT', 'SAFETY_BOUNDARY', p, 0.35);
  }

  // Slider signals
  if ((input.boundaryReadinessLevel || 0) >= 6) {
    markers.push({ markerId: 'BOUNDARY_READINESS_SLIDER', triggerType: 'BOUNDARY_PLANNING_REQUEST', source: 'slider', weight: 0.2 });
  }

  // Route from KDL01 or KST01
  if (input.routedFromKDL01) {
    markers.push({ markerId: 'KDL01_ROUTE', triggerType: 'BOUNDARY_PLANNING_REQUEST', source: 'kdl01', weight: 0.35 });
  }
  if (input.routedFromKST01) {
    markers.push({ markerId: 'KST01_ROUTE', triggerType: 'BOUNDARY_PLANNING_REQUEST', source: 'kst01', weight: 0.3 });
  }

  // Explicit wording request
  if (input.exactWordingRequested) {
    markers.push({ markerId: 'EXPLICIT_WORDING', triggerType: 'BOUNDARY_WORDING_REQUEST', source: 'latest_message', weight: 0.4 });
  }

  // Safety boundary concern
  if (input.safetyBoundaryConcern) {
    markers.push({ markerId: 'SAFETY_CONCERN', triggerType: 'SAFETY_BOUNDARY', source: 'latest_message', weight: 0.35 });
  }

  const confidenceScore = Math.min(1, markers.reduce((s, m) => s + m.weight, 0));
  const triggers = Array.from(new Set(markers.map(m => m.triggerType)));
  const confidenceLevel: KBR01ConfidenceLevel = confidenceScore >= 0.7 ? 'HIGH' : confidenceScore >= 0.4 ? 'MEDIUM' : 'LOW';
  const activationStatus: KBR01ActivationStatus = confidenceScore >= 0.55 ? 'ACTIVE' : 'NOT_ACTIVE';
  const recommendedMode = selectMode(triggers, input);
  const routeNext = selectRoute(recommendedMode, triggers, input);

  return {
    activationStatus,
    confidenceScore,
    confidenceLevel,
    triggers: triggers.length ? triggers : ['NONE'],
    detectedMarkers: markers,
    recommendedMode,
    routeNext,
  };
}

function selectMode(triggers: KBR01TriggerType[], input: KBR01RuntimeInputs): KBR01ResponseMode {
  if (triggers.includes('SAFETY_BOUNDARY')) return 'SAFETY_BOUNDARY';
  if (triggers.includes('PUNITIVE_INTENT')) return 'PUNITIVE_REDIRECT';
  if (triggers.includes('BOUNDARY_WORDING_REQUEST') || input.exactWordingRequested) return 'SCRIPT_BUILDER';
  if (triggers.includes('BOUNDARY_COLLAPSE')) return 'FOLLOW_THROUGH_REPAIR';
  if (triggers.includes('OVER_EXPLAINING_LOOP')) return 'OVER_EXPLAINING_STOP';
  if (triggers.includes('CONSEQUENCE_CLARITY')) return 'CONSEQUENCE_CHECK';
  if (triggers.includes('BOUNDARY_PLANNING_REQUEST')) return 'BOUNDARY_CLARIFIER';
  return 'BOUNDARY_CLARIFIER';
}

function selectRoute(mode: KBR01ResponseMode, triggers: KBR01TriggerType[], input: KBR01RuntimeInputs): KimModuleRouteTarget {
  if (mode === 'SAFETY_BOUNDARY' && input.crisisLevel >= 1) return 'K06_SAFETY';
  if ((input.caregiverShameLevel || 0) >= 7 && triggers.includes('BOUNDARY_COLLAPSE')) return 'KSC01_SELF_COMPASSION_CAREGIVER';
  if ((input.selfLossLevel || 0) >= 7) return 'KDL01_DETACHMENT_WITH_LOVE';
  return 'KBR01_BOUNDARY_RESTORATION';
}

function blocked(status: KBR01ActivationStatus, reason: string): KBR01DetectionResult {
  return {
    activationStatus: status,
    confidenceScore: 0,
    confidenceLevel: 'LOW',
    triggers: ['NONE'],
    detectedMarkers: [],
    recommendedMode: 'SAFETY_EXIT',
    routeNext: status === 'BLOCKED_BY_SAFETY' ? 'K06_SAFETY' : 'NO_MODULE',
    safetyReason: reason,
  };
}
