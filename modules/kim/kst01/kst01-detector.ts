/**
 * KST01 — Stoicism for Caregivers (Kim only)
 * DETECTOR: Deterministic marker-based activation detection
 */

import type {
  KST01RuntimeInputs,
  KST01DetectionResult,
  KST01DetectedMarker,
  KST01TriggerType,
  KST01Principle,
  KST01ResponseMode,
  KST01ActivationStatus,
  KST01ConfidenceLevel,
} from './kst01-types';

// ── Marker banks ──

const CONTROL_PHRASES = [
  'make them stop', 'how do i make', 'i can\'t control', 'i keep checking',
  'what is in my control', 'geen controle', 'blijven controleren', 'hoe zorg ik dat',
  'ik kan het niet stoppen', 'ik blijf checken', 'hoe maak ik dat',
];

const RESPONSIBILITY_PHRASES = [
  'i feel responsible', 'their relapse is my fault', 'if i stop trying',
  'ik voel me verantwoordelijk', 'mijn fout', 'als ik stop',
  'het is mijn schuld', 'ik had het moeten voorkomen',
];

const SELF_LOSS_PHRASES = [
  'losing myself', 'my life is on hold', 'everything is about them',
  'i am disappearing', 'ik raak mezelf kwijt', 'alles draait rond',
  'mijn leven staat stil', 'ik besta niet meer', 'wie ben ik nog',
];

const PHILOSOPHY_PHRASES = [
  'stoicism', 'stoic', 'marcus aurelius', 'philosophy',
  'stoicisme', 'filosofie', 'stoïcijns', 'epictetus', 'seneca',
];

const MEANING_PHRASES = [
  'what is the point', 'why does this keep happening', 'after the relapse',
  'relapsed again', 'wat is het punt', 'waarom blijft dit gebeuren',
  'weer hervallen', 'het heeft geen zin', 'waarvoor doe ik dit nog',
];

const BOUNDARY_LOVE_PHRASES = [
  'detach without giving up', 'boundary means abandonment',
  'distance equals lack of love', 'loslaten zonder opgeven',
  'grens voelt als verlaten', 'afstand is geen liefde',
  'hoe kan ik grenzen stellen en toch liefhebben',
];

const LIFE_ON_HOLD_PHRASES = [
  'waiting for them to change', 'my life is paused', 'postponing everything',
  'wachten tot het beter wordt', 'mijn leven staat op pauze',
  'ik leef niet meer', 'alles uitgesteld',
];

const EMOTIONAL_FUSION_PHRASES = [
  'dragged into every crisis', 'how to stay calm', 'calm means numbness',
  'meegesleurd', 'hoe blijf ik rustig', 'rustig zijn voelt koud',
  'ik voel alles wat zij voelt', 'hun pijn is mijn pijn',
];

export function detectKST01(input: KST01RuntimeInputs): KST01DetectionResult {
  const markers: KST01DetectedMarker[] = [];
  const text = `${input.latestUserMessage} ${(input.recentMessages || []).join(' ')}`.toLowerCase();

  // Gate: Kim-only
  if (input.userType !== 'kim') {
    return {
      activationStatus: 'BLOCKED_WRONG_USER_TYPE',
      confidenceScore: 0,
      confidenceLevel: 'LOW',
      triggers: ['NONE'],
      detectedMarkers: [],
      recommendedPrinciples: [],
      recommendedMode: 'SAFETY_EXIT',
      safetyReason: 'KST01 is Kim-only and caregiver-only.',
    };
  }

  // Gate: Safety
  if (input.crisisLevel >= 2 || input.k06SafetyGate === 'blocked') {
    return {
      activationStatus: 'BLOCKED_BY_SAFETY',
      confidenceScore: 0,
      confidenceLevel: 'LOW',
      triggers: ['NONE'],
      detectedMarkers: [],
      recommendedPrinciples: [],
      recommendedMode: 'SAFETY_EXIT',
      safetyReason: 'Crisis or safety gate requires non-stoic stabilization first.',
    };
  }

  const addMarker = (markerId: string, triggerType: KST01TriggerType, matchedText: string, weight: number) => {
    markers.push({ markerId, triggerType, matchedText, source: 'latest_message', weight });
  };

  // Text scanning
  for (const phrase of CONTROL_PHRASES) {
    if (text.includes(phrase)) addMarker('CONTROL_LOOP_TEXT', 'CONTROL_LOOP_CAREGIVER', phrase, 0.25);
  }
  for (const phrase of RESPONSIBILITY_PHRASES) {
    if (text.includes(phrase)) addMarker('OVER_RESPONSIBILITY_TEXT', 'OVER_RESPONSIBILITY', phrase, 0.25);
  }
  for (const phrase of SELF_LOSS_PHRASES) {
    if (text.includes(phrase)) addMarker('SELF_LOSS_TEXT', 'SELF_LOSS_THROUGH_CARE', phrase, 0.3);
  }
  for (const phrase of PHILOSOPHY_PHRASES) {
    if (text.includes(phrase)) addMarker('PHILOSOPHY_TEXT', 'PHILOSOPHY_REQUEST', phrase, 0.35);
  }
  for (const phrase of MEANING_PHRASES) {
    if (text.includes(phrase)) addMarker('MEANING_AFTER_RELAPSE_TEXT', 'MEANING_AFTER_RELAPSE', phrase, 0.25);
  }
  for (const phrase of BOUNDARY_LOVE_PHRASES) {
    if (text.includes(phrase)) addMarker('BOUNDARY_LOVE_TEXT', 'BOUNDARY_LOVE_CONFLICT', phrase, 0.3);
  }
  for (const phrase of LIFE_ON_HOLD_PHRASES) {
    if (text.includes(phrase)) addMarker('LIFE_ON_HOLD_TEXT', 'LIFE_ON_HOLD', phrase, 0.3);
  }
  for (const phrase of EMOTIONAL_FUSION_PHRASES) {
    if (text.includes(phrase)) addMarker('EMOTIONAL_FUSION_TEXT', 'EMOTIONAL_FUSION', phrase, 0.3);
  }

  // Slider signals
  if ((input.controlLoopLevel || 0) >= 7) {
    markers.push({ markerId: 'CONTROL_LOOP_SLIDER_HIGH', triggerType: 'CONTROL_LOOP_CAREGIVER', source: 'slider', weight: 0.25 });
  }
  if ((input.selfLossLevel || 0) >= 6) {
    markers.push({ markerId: 'SELF_LOSS_SLIDER_HIGH', triggerType: 'SELF_LOSS_THROUGH_CARE', source: 'slider', weight: 0.25 });
  }
  if ((input.emotionalOverloadLevel || 0) >= 7) {
    markers.push({ markerId: 'EMOTIONAL_OVERLOAD_SLIDER', triggerType: 'EMOTIONAL_FUSION', source: 'slider', weight: 0.2 });
  }

  // Explicit request
  if (input.explicitStoicismRequest) {
    markers.push({ markerId: 'EXPLICIT_STOICISM_REQUEST', triggerType: 'PHILOSOPHY_REQUEST', source: 'latest_message', weight: 0.45 });
  }

  // Recent relapse context
  if (input.recentRelapseOfLovedOne) {
    markers.push({ markerId: 'RECENT_RELAPSE_OF_LOVED_ONE', triggerType: 'MEANING_AFTER_RELAPSE', source: 'journal', weight: 0.2 });
  }

  // Score
  const confidenceScore = Math.min(1, markers.reduce((sum, m) => sum + m.weight, 0));
  const triggers = Array.from(new Set(markers.map(m => m.triggerType)));
  const confidenceLevel: KST01ConfidenceLevel = confidenceScore >= 0.7 ? 'HIGH' : confidenceScore >= 0.4 ? 'MEDIUM' : 'LOW';
  const activationStatus: KST01ActivationStatus = confidenceScore >= 0.55 ? 'ACTIVE' : 'NOT_ACTIVE';
  const recommendedMode = selectKST01Mode(triggers, input);
  const recommendedPrinciples = selectKST01Principles(triggers, recommendedMode);

  return {
    activationStatus,
    confidenceScore,
    confidenceLevel,
    triggers: triggers.length ? triggers : ['NONE'],
    detectedMarkers: markers,
    recommendedPrinciples,
    recommendedMode,
  };
}

export function selectKST01Mode(triggers: KST01TriggerType[], input: KST01RuntimeInputs): KST01ResponseMode {
  if (input.crisisLevel >= 2) return 'SAFETY_EXIT';
  if (triggers.includes('CONTROL_LOOP_CAREGIVER') || triggers.includes('OVER_RESPONSIBILITY')) return 'CONTROL_SEPARATOR';
  if (triggers.includes('SELF_LOSS_THROUGH_CARE')) return 'SELF_CONNECTION_RESTORE';
  if (triggers.includes('MEANING_AFTER_RELAPSE')) return 'MEANING_AFTER_RELAPSE';
  if (triggers.includes('PHILOSOPHY_REQUEST')) return 'CONTROL_SEPARATOR';
  if (triggers.includes('BOUNDARY_LOVE_CONFLICT')) return 'CONNECTED_NOT_CONSUMED';
  if (triggers.includes('LIFE_ON_HOLD')) return 'LIFE_IS_NOT_A_WAITING_ROOM';
  if (triggers.includes('EMOTIONAL_FUSION')) return 'STEADINESS_WITH_FEELING';
  return 'CONTROL_SEPARATOR';
}

export function selectKST01Principles(triggers: KST01TriggerType[], mode: KST01ResponseMode): KST01Principle[] {
  const principles = new Set<KST01Principle>();

  if (triggers.includes('CONTROL_LOOP_CAREGIVER') || triggers.includes('OVER_RESPONSIBILITY')) {
    principles.add('DICHOTOMY_OF_CONTROL');
  }
  if (triggers.includes('SELF_LOSS_THROUGH_CARE') || mode === 'LIFE_IS_NOT_A_WAITING_ROOM') {
    principles.add('MEMENTO_MORI');
    principles.add('SYMPATHEIA');
  }
  if (triggers.includes('MEANING_AFTER_RELAPSE')) {
    principles.add('AMOR_FATI');
    principles.add('DICHOTOMY_OF_CONTROL');
  }
  if (mode === 'STEADINESS_WITH_FEELING') {
    principles.add('APATHEIA');
  }
  if (mode === 'CONNECTED_NOT_CONSUMED') {
    principles.add('SYMPATHEIA');
    principles.add('DICHOTOMY_OF_CONTROL');
  }
  if (principles.size === 0) {
    principles.add('DICHOTOMY_OF_CONTROL');
  }

  return Array.from(principles);
}
