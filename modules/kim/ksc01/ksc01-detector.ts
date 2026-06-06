/**
 * KSC01 — Self-Compassion for Caregivers (Kim only)
 * DETECTOR: Deterministic marker-based activation detection
 */

import type {
  KSC01RuntimeInputs,
  KSC01DetectionResult,
  KSC01DetectedMarker,
  KSC01TriggerType,
  KSC01ResponseMode,
  KSC01ActivationStatus,
  KSC01ConfidenceLevel,
} from './ksc01-types';
import type { KimModuleRouteTarget } from '../kst01/kst01-types';

// ── Marker banks ──

const SHAME_PHRASES_EN = [
  'i feel selfish', 'i am a bad partner', 'i am a bad parent',
  'i should be stronger', 'what is wrong with me', 'i am not enough',
  'i am failing', 'i am weak', 'i am a terrible person',
];
const SHAME_PHRASES_NL = [
  'ik voel me egoistisch', 'ik ben een slechte partner', 'ik ben een slechte ouder',
  'ik zou sterker moeten zijn', 'wat is er mis met mij', 'ik ben niet genoeg',
  'ik faal', 'ik ben zwak', 'ik ben een verschrikkelijk persoon',
];

const RELAPSE_BLAME_EN = [
  'it is my fault they relapsed', 'i caused the relapse', 'if i had done more',
  'i failed to prevent', 'i should have seen it coming', 'relapse is my fault',
];
const RELAPSE_BLAME_NL = [
  'het is mijn schuld dat ze terugvielen', 'ik veroorzaakte de terugval',
  'als ik meer had gedaan', 'ik had het moeten voorkomen',
  'ik had het moeten zien aankomen', 'terugval is mijn schuld',
];

const BOUNDARY_GUILT_EN = [
  'feel guilty for saying no', 'guilty for setting a boundary',
  'feel cruel for having limits', 'selfish for choosing myself',
  'guilty for stepping back', 'bad person for having needs',
];
const BOUNDARY_GUILT_NL = [
  'schuldig omdat ik nee zei', 'schuldig voor het stellen van een grens',
  'hard omdat ik grenzen heb', 'egoistisch omdat ik voor mezelf kies',
  'schuldig voor afstand nemen', 'slecht persoon omdat ik behoeften heb',
];

const ANGER_SHAME_EN = [
  'i hate that i feel angry', 'ashamed of my anger', 'i should not be angry',
  'angry at them but feel guilty', 'i feel resentful and ashamed',
];
const ANGER_SHAME_NL = [
  'ik haat dat ik boos ben', 'schaam me voor mijn woede', 'ik zou niet boos moeten zijn',
  'boos maar voel me schuldig', 'ik voel wrok en schaamte',
];

const REST_GUILT_EN = [
  'feel guilty for resting', 'guilty for wanting peace', 'selfish for taking time',
  'feel bad when i relax', 'guilty for enjoying something',
];
const REST_GUILT_NL = [
  'schuldig voor rust', 'schuldig omdat ik rust wil', 'egoistisch voor tijd nemen',
  'voel me slecht als ik ontspan', 'schuldig als ik iets leuk vind',
];

const GOOD_CAREGIVER_MYTH_EN = [
  'a good partner would', 'a good parent would', 'i should handle this better',
  'others manage better', 'i am not doing enough',
];
const GOOD_CAREGIVER_MYTH_NL = [
  'een goede partner zou', 'een goede ouder zou', 'ik zou dit beter moeten aankunnen',
  'anderen doen het beter', 'ik doe niet genoeg',
];

export function detectKSC01(input: KSC01RuntimeInputs): KSC01DetectionResult {
  const markers: KSC01DetectedMarker[] = [];
  const text = `${input.latestUserMessage} ${(input.recentMessages || []).join(' ')}`.toLowerCase();

  if (input.userType !== 'kim') {
    return blocked('BLOCKED_WRONG_USER_TYPE', 'KSC01 is Kim-only and caregiver-only.');
  }

  if (input.crisisLevel >= 2 || input.k06SafetyGate === 'blocked') {
    return blocked('BLOCKED_BY_SAFETY', 'Safety gate blocks Self-Compassion module.');
  }

  const add = (id: string, trigger: KSC01TriggerType, matched: string, weight: number) => {
    markers.push({ markerId: id, triggerType: trigger, matchedText: matched, source: 'latest_message', weight });
  };

  for (const p of [...SHAME_PHRASES_EN, ...SHAME_PHRASES_NL]) {
    if (text.includes(p)) add('SHAME_TEXT', 'CAREGIVER_SHAME', p, 0.3);
  }
  for (const p of [...RELAPSE_BLAME_EN, ...RELAPSE_BLAME_NL]) {
    if (text.includes(p)) add('RELAPSE_BLAME_TEXT', 'RELAPSE_SELF_BLAME', p, 0.3);
  }
  for (const p of [...BOUNDARY_GUILT_EN, ...BOUNDARY_GUILT_NL]) {
    if (text.includes(p)) add('BOUNDARY_GUILT_TEXT', 'BOUNDARY_GUILT', p, 0.3);
  }
  for (const p of [...ANGER_SHAME_EN, ...ANGER_SHAME_NL]) {
    if (text.includes(p)) add('ANGER_SHAME_TEXT', 'ANGER_SHAME', p, 0.25);
  }
  for (const p of [...REST_GUILT_EN, ...REST_GUILT_NL]) {
    if (text.includes(p)) add('REST_GUILT_TEXT', 'REST_GUILT', p, 0.25);
  }
  for (const p of [...GOOD_CAREGIVER_MYTH_EN, ...GOOD_CAREGIVER_MYTH_NL]) {
    if (text.includes(p)) add('MYTH_TEXT', 'GOOD_CAREGIVER_MYTH', p, 0.25);
  }

  // Slider signals
  if ((input.caregiverShameLevel || 0) >= 6) {
    markers.push({ markerId: 'SHAME_SLIDER', triggerType: 'CAREGIVER_SHAME', source: 'slider', weight: 0.25 });
  }
  if ((input.guiltLevel || 0) >= 6) {
    markers.push({ markerId: 'GUILT_SLIDER', triggerType: 'BOUNDARY_GUILT', source: 'slider', weight: 0.2 });
  }
  if ((input.angerShameLevel || 0) >= 6) {
    markers.push({ markerId: 'ANGER_SHAME_SLIDER', triggerType: 'ANGER_SHAME', source: 'slider', weight: 0.2 });
  }
  if ((input.restGuiltLevel || 0) >= 6) {
    markers.push({ markerId: 'REST_GUILT_SLIDER', triggerType: 'REST_GUILT', source: 'slider', weight: 0.2 });
  }

  // Recent relapse of loved one
  if (input.recentRelapseOfLovedOne) {
    markers.push({ markerId: 'RECENT_RELAPSE', triggerType: 'RELAPSE_SELF_BLAME', source: 'backpack', weight: 0.2 });
  }

  // Routes from other modules
  if (input.routedFromKDL01) {
    markers.push({ markerId: 'KDL01_ROUTE', triggerType: 'CAREGIVER_SHAME', source: 'kdl01', weight: 0.3 });
  }
  if (input.routedFromKBR01) {
    markers.push({ markerId: 'KBR01_ROUTE', triggerType: 'BOUNDARY_GUILT', source: 'kbr01', weight: 0.3 });
  }
  if (input.routedFromKST01) {
    markers.push({ markerId: 'KST01_ROUTE', triggerType: 'CAREGIVER_SHAME', source: 'kst01', weight: 0.3 });
  }

  const confidenceScore = Math.min(1, markers.reduce((s, m) => s + m.weight, 0));
  const triggers = Array.from(new Set(markers.map(m => m.triggerType)));
  const confidenceLevel: KSC01ConfidenceLevel = confidenceScore >= 0.7 ? 'HIGH' : confidenceScore >= 0.4 ? 'MEDIUM' : 'LOW';
  const activationStatus: KSC01ActivationStatus = confidenceScore >= 0.55 ? 'ACTIVE' : 'NOT_ACTIVE';
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

function selectMode(triggers: KSC01TriggerType[], input: KSC01RuntimeInputs): KSC01ResponseMode {
  if (triggers.includes('RELAPSE_SELF_BLAME')) return 'RELAPSE_NOT_MY_FAILURE';
  if (triggers.includes('ANGER_SHAME')) return 'ANGER_PERMISSION';
  if (triggers.includes('REST_GUILT')) return 'REST_PERMISSION';
  if (triggers.includes('GOOD_CAREGIVER_MYTH')) return 'GOOD_CAREGIVER_MYTH_REPAIR';
  if (triggers.includes('BOUNDARY_GUILT') && (input.boundaryReadinessLevel || 0) >= 5) return 'COMPASSION_TO_BOUNDARY';
  if (triggers.includes('CAREGIVER_SHAME') && (input.selfLossLevel || 0) >= 6) return 'COMPASSION_TO_DETACHMENT';
  if (triggers.includes('BOUNDARY_GUILT')) return 'GUILT_REALITY_CHECK';
  if (triggers.includes('CAREGIVER_SHAME')) return 'SHAME_SOFTENING';
  return 'SHAME_SOFTENING';
}

function selectRoute(mode: KSC01ResponseMode, _triggers: KSC01TriggerType[], input: KSC01RuntimeInputs): KimModuleRouteTarget {
  if (mode === 'COMPASSION_TO_BOUNDARY') return 'KBR01_BOUNDARY_RESTORATION';
  if (mode === 'COMPASSION_TO_DETACHMENT') return 'KDL01_DETACHMENT_WITH_LOVE';
  if ((input.selfLossLevel || 0) >= 8) return 'KDL01_DETACHMENT_WITH_LOVE';
  return 'KSC01_SELF_COMPASSION_CAREGIVER';
}

function blocked(status: KSC01ActivationStatus, reason: string): KSC01DetectionResult {
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
