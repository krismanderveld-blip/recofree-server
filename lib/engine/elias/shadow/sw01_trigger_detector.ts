/**
 * SW01 Shadow Work — Trigger Detector
 *
 * Detects shadow signals from user input based on verbal markers (EN + NL),
 * behavioural markers, and confidence scoring.
 *
 * CANON: shadowwork.txt sections 7, 18
 * Confidence scoring:
 *   1 verbal marker = 0.4
 *   2+ verbal markers = 0.7
 *   verbal + behavioural = 0.85
 *   relapse loop active = 0.95
 */

import type { ShadowSignal, ShadowSource, RelapseRisk } from './sw01_shadow_types';
import { LocalDeviceTimeService } from "@/lib/core/time";

// ─── Verbal Markers (English) ────────────────────────────────────────────────

const VERBAL_MARKERS_EN: string[] = [
  'i hate that part of me',
  'i am broken',
  'i am disgusting',
  'i cannot forgive myself',
  'i do not know why i do this',
  'i always ruin everything',
  'i was doing so well',
  'fuck it',
  'it does not matter anymore',
  'i need to escape',
  'i cannot feel this',
  'i do not care',
  'i care too much',
  'they made me feel small',
  'i just wanted to feel something',
  'i just wanted to disappear',
  'i am not like that',
  'that is not me',
  'i do not need anyone',
  'i need them now',
  'nobody knows the real me',
  'i keep secrets',
  'i am a bad person',
];

// ─── Verbal Markers (Dutch) ─────────────────────────────────────────────────

const VERBAL_MARKERS_NL: string[] = [
  'ik haat dat deel van mezelf',
  'ik ben kapot',
  'ik walg van mezelf',
  'ik kan mezelf niet vergeven',
  'ik weet niet waarom ik dit doe',
  'ik maak alles kapot',
  'het maakt toch niet meer uit',
  'fuck it',
  'ik moet weg',
  'ik kan dit niet voelen',
  'het boeit me niet',
  'het raakt me te hard',
  'zij deden mij klein voelen',
  'ik wilde gewoon iets voelen',
  'ik wilde gewoon verdwijnen',
  'zo ben ik niet',
  'dat ben ik niet',
  'ik heb niemand nodig',
  'ik heb die persoon nu nodig',
];

// ─── Behavioural Markers ─────────────────────────────────────────────────────

const BEHAVIOURAL_MARKERS: string[] = [
  'sudden minimization',
  'sudden intellectualization',
  'repeated humor at serious moments',
  'moral self-attack',
  'secrecy',
  'changing subject when shame appears',
  'over-explaining',
  'blaming others with unusual intensity',
  'taking too much blame',
  'craving after relational trigger',
  'craving after criticism',
  'craving after sexual shame',
  'craving after boredom or emptiness',
  'replacing main addiction with digital compulsion',
];

// ─── Emotional Layer Mapping ─────────────────────────────────────────────────

interface EmotionalMapping {
  markers: string[];
  emotional_layer: string;
  suspected_shadow: string;
}

const EMOTIONAL_MAPPINGS: EmotionalMapping[] = [
  {
    markers: ['i am disgusting', 'ik walg van mezelf', 'i am a bad person', 'i keep secrets', 'nobody knows the real me'],
    emotional_layer: 'shame',
    suspected_shadow: 'defectiveness / hidden self',
  },
  {
    markers: ['i need them now', 'ik heb die persoon nu nodig', 'they made me feel small', 'zij deden mij klein voelen'],
    emotional_layer: 'abandonment',
    suspected_shadow: 'needy part / orphan part',
  },
  {
    markers: ['fuck it', 'it does not matter anymore', 'het maakt toch niet meer uit'],
    emotional_layer: 'rage / control-loss',
    suspected_shadow: 'rebel / destroyer',
  },
  {
    markers: ['i always ruin everything', 'ik maak alles kapot', 'i was doing so well'],
    emotional_layer: 'self-attack',
    suspected_shadow: 'inner critic / punishment loop',
  },
  {
    markers: ['i cannot feel this', 'ik kan dit niet voelen', 'i just wanted to disappear', 'ik wilde gewoon verdwijnen', 'i need to escape', 'ik moet weg'],
    emotional_layer: 'avoidance / numbness',
    suspected_shadow: 'avoidant self / existential void',
  },
  {
    markers: ['i hate that part of me', 'ik haat dat deel van mezelf', 'i am not like that', 'zo ben ik niet', 'that is not me', 'dat ben ik niet'],
    emotional_layer: 'self-rejection',
    suspected_shadow: 'disowned part / split identity',
  },
  {
    markers: ['i do not need anyone', 'ik heb niemand nodig'],
    emotional_layer: 'detachment',
    suspected_shadow: 'avoidant self / fear of dependence',
  },
  {
    markers: ['i just wanted to feel something', 'ik wilde gewoon iets voelen', 'i care too much', 'het raakt me te hard'],
    emotional_layer: 'emptiness / intensity seeking',
    suspected_shadow: 'existential void / hunger for aliveness',
  },
  {
    markers: ['i cannot forgive myself', 'ik kan mezelf niet vergeven', 'i do not know why i do this', 'ik weet niet waarom ik dit doe'],
    emotional_layer: 'guilt / confusion',
    suspected_shadow: 'shame protector / unconscious pattern',
  },
];

// ─── Detection Functions ─────────────────────────────────────────────────────

export interface DetectionResult {
  verbalMatches: string[];
  behaviouralMatches: string[];
  confidence: number;
  emotionalLayer: string;
  suspectedShadow: string;
}

/**
 * Detect shadow signals from user text input.
 * Returns detection result with matched markers and confidence score.
 */
export function detectShadowSignals(
  userText: string,
  source: ShadowSource,
  relapseLoopActive: boolean = false,
  behaviouralFlags: string[] = []
): DetectionResult {
  const normalizedText = userText.toLowerCase().trim();

  // Match verbal markers (EN + NL)
  const allVerbalMarkers = [...VERBAL_MARKERS_EN, ...VERBAL_MARKERS_NL];
  const verbalMatches = allVerbalMarkers.filter(marker =>
    normalizedText.includes(marker)
  );

  // Match behavioural markers from flags
  const behaviouralMatches = behaviouralFlags.filter(flag =>
    BEHAVIOURAL_MARKERS.some(bm => bm === flag || flag.includes(bm))
  );

  // Calculate confidence
  let confidence = 0;
  if (relapseLoopActive) {
    confidence = 0.95;
  } else if (verbalMatches.length > 0 && behaviouralMatches.length > 0) {
    confidence = 0.85;
  } else if (verbalMatches.length >= 2) {
    confidence = 0.7;
  } else if (verbalMatches.length === 1) {
    confidence = 0.4;
  } else if (behaviouralMatches.length > 0) {
    confidence = 0.35;
  }

  // Determine emotional layer
  let emotionalLayer = 'unidentified';
  let suspectedShadow = 'unidentified';

  for (const mapping of EMOTIONAL_MAPPINGS) {
    const matchFound = mapping.markers.some(m => normalizedText.includes(m));
    if (matchFound) {
      emotionalLayer = mapping.emotional_layer;
      suspectedShadow = mapping.suspected_shadow;
      break;
    }
  }

  return {
    verbalMatches,
    behaviouralMatches,
    confidence,
    emotionalLayer,
    suspectedShadow,
  };
}

/**
 * Build a ShadowSignal from detection result.
 */
export function buildShadowSignal(
  detection: DetectionResult,
  source: ShadowSource,
  zuchtValue: number
): ShadowSignal | null {
  if (detection.confidence < 0.4) return null;

  const relapseRisk: RelapseRisk =
    zuchtValue >= 8 ? 'active' :
    zuchtValue >= 6 ? 'high' :
    zuchtValue >= 4 ? 'medium' : 'low';

  const primaryMarker = detection.verbalMatches[0] || detection.behaviouralMatches[0] || 'pattern_detected';

  return {
    id: `sw01_${LocalDeviceTimeService.now().epochMs}_${Math.random().toString(36).slice(2, 8)}`,
    source,
    marker: primaryMarker,
    confidence: detection.confidence,
    emotional_layer: detection.emotionalLayer,
    suspected_shadow: detection.suspectedShadow,
    relapse_risk: relapseRisk,
  };
}

/**
 * Quick check: does the user text contain any shadow markers?
 * Used for fast gating before full detection.
 */
export function hasShadowMarkers(userText: string): boolean {
  const normalizedText = userText.toLowerCase().trim();
  const allMarkers = [...VERBAL_MARKERS_EN, ...VERBAL_MARKERS_NL];
  return allMarkers.some(marker => normalizedText.includes(marker));
}
