/**
 * PAR01 Detector — Parentificatie Patroon Detectie
 *
 * Scans user messages for parentification markers:
 * role-reversal, responsibility overload, own needs suppression,
 * guilt when stepping back, identity-as-caretaker patterns.
 */

import type { PAR01DetectionInput, PAR01Detection, PAR01Marker } from './par01-types';

const MARKER_PATTERNS: Record<PAR01Marker, RegExp[]> = {
  'role-reversal': [
    /\b(take care of|look after|parent|mother|father)\b.*\b(him|her|them|partner)\b/i,
    /\b(i('m| am) (his|her) (mother|father|parent))\b/i,
    /\b(raising|raise)\b.*\b(adult|partner|husband|wife)\b/i,
    /\b(child|baby)\b.*\b(treat|behave|act)\b/i,
  ],
  'responsibility-overload': [
    /\b(if i don'?t|nobody else|all on me|my responsibility)\b/i,
    /\b(have to|must|need to)\b.*\b(everything|all|whole)\b/i,
    /\b(carry|carrying|shoulder)\b.*\b(weight|burden|load|everything)\b/i,
    /\b(hold.*together|keep.*going|manage.*alone)\b/i,
  ],
  'own-needs-suppressed': [
    /\b(my needs|what i (want|need)|about me)\b.*\b(don'?t matter|not important|secondary|last)\b/i,
    /\b(no time for (myself|me)|forget (myself|me)|put (myself|me) last)\b/i,
    /\b(selfish)\b.*\b(if i|to want|for wanting)\b/i,
    /\b(i (come|am) last|always (him|her|them) first)\b/i,
  ],
  'guilt-when-stepping-back': [
    /\b(guilty|guilt)\b.*\b(step back|say no|take time|rest|stop)\b/i,
    /\b(can'?t|cannot)\b.*\b(let go|step away|take a break)\b/i,
    /\b(feel bad|terrible)\b.*\b(not (helping|there|available))\b/i,
    /\b(abandon|abandoning)\b.*\b(if i (leave|stop|rest))\b/i,
  ],
  'identity-as-caretaker': [
    /\b(always been|that'?s who i am|my role)\b.*\b(care|help|fix|save)\b/i,
    /\b(i('m| am) the (one|person) who)\b.*\b(fix|help|care|hold)\b/i,
    /\b(without me|need me|depend on me)\b/i,
    /\b(fixer|caretaker|helper|rescuer)\b/i,
  ],
  'childhood-pattern': [
    /\b(as a (child|kid)|growing up|since i was (young|little|small))\b/i,
    /\b(always (been|done) this|my whole life)\b.*\b(care|responsible|help)\b/i,
    /\b(parent.*child|child.*parent)\b.*\b(role|switch|reverse)\b/i,
    /\b(had to grow up (fast|early|quick))\b/i,
  ],
  'exhaustion-denial': [
    /\b(tired|exhausted|burnt out|burned out)\b.*\b(but|still|have to|must)\b/i,
    /\b(can'?t stop|no choice|keep going)\b.*\b(tired|exhausted)\b/i,
    /\b(rest|break)\b.*\b(later|not now|can'?t afford)\b/i,
    /\b(running on empty|nothing left)\b.*\b(but|still)\b/i,
  ],
  'emotional-labor': [
    /\b(hold.*together|keep.*peace|manage.*emotions)\b/i,
    /\b(everyone'?s|their)\b.*\b(feelings|emotions|mood)\b.*\b(my (job|responsibility))\b/i,
    /\b(emotional.*labor|emotional.*work|carry.*emotions)\b/i,
    /\b(regulate|calm|soothe)\b.*\b(him|her|them|everyone)\b/i,
  ],
  'boundary-inability': [
    /\b(can'?t|cannot|unable)\b.*\b(say no|set (a )?boundar|refuse|decline)\b/i,
    /\b(no boundaries|no limits|always (say|said) yes)\b/i,
    /\b(people.?pleas|door.?mat|push.?over)\b/i,
    /\b(give.*give.*give|always giving|never (receive|get))\b/i,
  ],
};

const DETECTION_THRESHOLD = 0.35;
const STRONG_MARKER_WEIGHT = 0.25;
const WEAK_MARKER_WEIGHT = 0.15;
const HISTORY_BONUS = 0.05;

export function detectPAR01(input: PAR01DetectionInput): PAR01Detection {
  // Safety gates
  if (input.crisisLevel >= 2) {
    return { detected: false, confidence: 0, markers: [], phase: 'recognition', timestamp: new Date().toISOString() };
  }
  if (!input.k06Stabilized) {
    return { detected: false, confidence: 0, markers: [], phase: 'recognition', timestamp: new Date().toISOString() };
  }

  const detectedMarkers: PAR01Marker[] = [];
  let confidence = 0;

  // Scan current message
  const text = input.message.toLowerCase();
  for (const [marker, patterns] of Object.entries(MARKER_PATTERNS) as [PAR01Marker, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        if (!detectedMarkers.includes(marker)) {
          detectedMarkers.push(marker);
          // Strong markers get more weight
          const isStrong = ['role-reversal', 'childhood-pattern', 'identity-as-caretaker'].includes(marker);
          confidence += isStrong ? STRONG_MARKER_WEIGHT : WEAK_MARKER_WEIGHT;
        }
        break;
      }
    }
  }

  // Scan recent history for accumulation
  for (const histMsg of input.recentHistory) {
    const histText = histMsg.toLowerCase();
    for (const [marker, patterns] of Object.entries(MARKER_PATTERNS) as [PAR01Marker, RegExp[]][]) {
      if (detectedMarkers.includes(marker)) continue;
      for (const pattern of patterns) {
        if (pattern.test(histText)) {
          detectedMarkers.push(marker);
          confidence += HISTORY_BONUS;
          break;
        }
      }
    }
  }

  // Previous detection bonus (pattern accumulation)
  const prevCount = input.previousDetections.filter(d => d.detected).length;
  if (prevCount > 0) {
    confidence += Math.min(prevCount * 0.05, 0.15);
  }

  confidence = Math.min(confidence, 1.0);
  const detected = confidence >= DETECTION_THRESHOLD && detectedMarkers.length >= 2;

  // Determine phase based on history
  const phase = determinePhase(input.previousDetections, detectedMarkers);

  return {
    detected,
    confidence,
    markers: detectedMarkers,
    phase,
    timestamp: new Date().toISOString(),
  };
}

function determinePhase(
  previousDetections: PAR01Detection[],
  currentMarkers: PAR01Marker[]
): PAR01Detection['phase'] {
  const activeCount = previousDetections.filter(d => d.detected).length;

  if (activeCount === 0) return 'recognition';
  if (activeCount <= 2) {
    return currentMarkers.includes('childhood-pattern') ? 'origin-tracing' : 'recognition';
  }
  if (activeCount <= 4) return 'impact-naming';
  if (activeCount <= 6) return 'boundary-seed';
  return 'integration';
}
