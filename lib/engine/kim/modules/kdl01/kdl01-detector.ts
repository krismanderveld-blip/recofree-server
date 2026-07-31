/**
 * KDL01 — Detachment with Love (Kim only)
 * DETECTOR: Deterministic marker-based activation detection
 */

import type {
  KDL01RuntimeInputs,
  KDL01DetectionResult,
  KDL01DetectedMarker,
  KDL01TriggerType,
  KDL01ResponseMode,
  KDL01ActivationStatus,
  KDL01ConfidenceLevel,
} from './kdl01-types';
import type { KimModuleRouteTarget } from '../kst01/kst01-types';

// ── Marker banks ──

const DETACHMENT_PHRASES_EN = [
  'detach but i still love', 'let go without abandoning', 'how do i detach',
  'i need to detach', 'detach without giving up', 'how to let go with love',
];
const DETACHMENT_PHRASES_NL = [
  'loslaten maar ik hou', 'los zonder iemand te laten vallen', 'hoe laat ik los',
  'ik wil loslaten', 'loslaten zonder opgeven',
];

const SELF_LOSS_PHRASES_EN = [
  'losing myself', 'i am disappearing', 'this is destroying me',
  'i cannot keep living like this', 'everything is about them',
];
const SELF_LOSS_PHRASES_NL = [
  'ik raak mezelf kwijt', 'dit maakt mij kapot', 'ik kan zo niet blijven leven',
  'alles draait rond', 'ik besta niet meer',
];

const RESCUE_PHRASES_EN = [
  'keep saving', 'cleaning up the mess', 'if i stop helping',
  'everything depends on me', 'i keep fixing', 'always on alert',
];
const RESCUE_PHRASES_NL = [
  'blijf redden', 'ruim altijd de rommel op', 'als ik stop met helpen',
  'alles hangt van mij af', 'ik sta altijd aan',
];

const CONSEQUENCE_PHRASES_EN = [
  'feel cruel', 'cruel when i set a boundary', 'allow consequences',
  'feel selfish for choosing myself', 'feel guilty for stepping back',
];
const CONSEQUENCE_PHRASES_NL = [
  'voel me hard', 'grens stel', 'gevolgen toelaten',
  'voel me egoistisch', 'schuldig als ik afstand neem',
];

const ABANDONMENT_PHRASES_EN = [
  'stepping back means abandonment', 'leaving them alone',
  'they will fall apart without me', 'i do not want to abandon',
];
const ABANDONMENT_PHRASES_NL = [
  'afstand nemen is verlaten', 'alleen laten', 'zonder mij storten ze in',
  'ik wil niet laten vallen',
];

const EXHAUSTION_PHRASES_EN = [
  'i cannot breathe', 'i am exhausted', 'i have nothing left',
  'how much longer', 'i am breaking',
];
const EXHAUSTION_PHRASES_NL = [
  'ik krijg geen adem', 'ik ben uitgeput', 'ik heb niets meer over',
  'hoe lang nog', 'ik breek',
];

export function detectKDL01(input: KDL01RuntimeInputs): KDL01DetectionResult {
  const markers: KDL01DetectedMarker[] = [];
  const text = `${input.latestUserMessage} ${(input.recentMessages || []).join(' ')}`.toLowerCase();

  if (input.userType !== 'kim') {
    return blocked('BLOCKED_WRONG_USER_TYPE', 'KDL01 is Kim-only and caregiver-only.');
  }

  if (input.crisisLevel >= 2 || input.k06SafetyGate === 'blocked') {
    return blocked('BLOCKED_BY_SAFETY', 'Safety gate blocks Detachment with Love.');
  }

  const add = (id: string, trigger: KDL01TriggerType, matched: string, weight: number) => {
    markers.push({ markerId: id, triggerType: trigger, matchedText: matched, source: 'latest_message', weight });
  };

  for (const p of [...DETACHMENT_PHRASES_EN, ...DETACHMENT_PHRASES_NL]) {
    if (text.includes(p)) add('DETACHMENT_TEXT', 'DETACHMENT_REQUEST', p, 0.3);
  }
  for (const p of [...SELF_LOSS_PHRASES_EN, ...SELF_LOSS_PHRASES_NL]) {
    if (text.includes(p)) add('SELF_LOSS_TEXT', 'SELF_LOSS_THROUGH_LOVE', p, 0.3);
  }
  for (const p of [...RESCUE_PHRASES_EN, ...RESCUE_PHRASES_NL]) {
    if (text.includes(p)) add('RESCUE_TEXT', 'RESCUE_FUSION', p, 0.25);
  }
  for (const p of [...CONSEQUENCE_PHRASES_EN, ...CONSEQUENCE_PHRASES_NL]) {
    if (text.includes(p)) add('CONSEQUENCE_TEXT', 'CONSEQUENCE_GUILT', p, 0.25);
  }
  for (const p of [...ABANDONMENT_PHRASES_EN, ...ABANDONMENT_PHRASES_NL]) {
    if (text.includes(p)) add('ABANDONMENT_TEXT', 'ABANDONMENT_FEAR', p, 0.25);
  }
  for (const p of [...EXHAUSTION_PHRASES_EN, ...EXHAUSTION_PHRASES_NL]) {
    if (text.includes(p)) add('EXHAUSTION_TEXT', 'RELATIONAL_EXHAUSTION', p, 0.2);
  }

  // Slider signals
  if ((input.selfLossLevel || 0) >= 7) {
    markers.push({ markerId: 'SELF_LOSS_SLIDER', triggerType: 'SELF_LOSS_THROUGH_LOVE', source: 'slider', weight: 0.25 });
  }
  if ((input.rescueLoopLevel || 0) >= 6) {
    markers.push({ markerId: 'RESCUE_LOOP_SLIDER', triggerType: 'RESCUE_FUSION', source: 'slider', weight: 0.2 });
  }

  // KST01 route
  if (input.routedFromKST01) {
    markers.push({ markerId: 'KST01_ROUTE', triggerType: 'BOUNDARY_LOVE_CONFLICT', source: 'kst01', weight: 0.4 });
  }

  // Explicit request
  if (input.explicitDetachmentRequest) {
    markers.push({ markerId: 'EXPLICIT_DETACHMENT', triggerType: 'DETACHMENT_REQUEST', source: 'latest_message', weight: 0.4 });
  }

  const confidenceScore = Math.min(1, markers.reduce((s, m) => s + m.weight, 0));
  const triggers = Array.from(new Set(markers.map(m => m.triggerType)));
  const confidenceLevel: KDL01ConfidenceLevel = confidenceScore >= 0.7 ? 'HIGH' : confidenceScore >= 0.4 ? 'MEDIUM' : 'LOW';
  const activationStatus: KDL01ActivationStatus = confidenceScore >= 0.55 ? 'ACTIVE' : 'NOT_ACTIVE';
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

function selectMode(triggers: KDL01TriggerType[], input: KDL01RuntimeInputs): KDL01ResponseMode {
  if (input.crisisLevel >= 2) return 'SAFETY_EXIT';
  if (triggers.includes('SELF_LOSS_THROUGH_LOVE')) return 'LOVE_WITHOUT_SELF_ERASURE';
  if (triggers.includes('DETACHMENT_REQUEST') || triggers.includes('ABANDONMENT_FEAR')) return 'DETACHMENT_NOT_ABANDONMENT';
  if (triggers.includes('CONSEQUENCE_GUILT')) return 'CONSEQUENCE_WITHOUT_CRUELTY';
  if (triggers.includes('RESCUE_FUSION')) return 'RESCUE_LOOP_INTERRUPT';
  if (triggers.includes('BOUNDARY_LOVE_CONFLICT') && (input.boundaryReadinessLevel || 0) >= 5) return 'BOUNDARY_BRIDGE';
  if ((input.caregiverShameLevel || 0) >= 6) return 'GUILT_SOFTENING';
  return 'LOVE_WITHOUT_SELF_ERASURE';
}

function selectRoute(mode: KDL01ResponseMode, triggers: KDL01TriggerType[], input: KDL01RuntimeInputs): KimModuleRouteTarget {
  if (mode === 'SAFETY_EXIT') return 'K06_SAFETY';
  if (mode === 'BOUNDARY_BRIDGE') return 'KBR01_BOUNDARY_RESTORATION';
  if (mode === 'GUILT_SOFTENING' && (input.caregiverShameLevel || 0) >= 7) return 'KSC01_SELF_COMPASSION_CAREGIVER';
  return 'KDL01_DETACHMENT_WITH_LOVE';
}

function blocked(status: KDL01ActivationStatus, reason: string): KDL01DetectionResult {
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
