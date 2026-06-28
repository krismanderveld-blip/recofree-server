/**
 * FIN01 Detector — Financiële Afhankelijkheid/Controle Detectie
 *
 * Scans user messages for financial control/dependency markers:
 * financial control by partner, debt from addiction, money as peace-keeper,
 * economic entrapment, hidden spending, financial gaslighting.
 */

import type { FIN01DetectionInput, FIN01Detection, FIN01Marker } from './fin01-types';
import { LocalDeviceTimeService } from "@/lib/core/time";

const MARKER_PATTERNS: Record<FIN01Marker, RegExp[]> = {
  'financial-control': [
    /\b(control|controls|controlling)\b.*\b(money|finances|bank|account|spending)\b/i,
    /\b(allowance|permission)\b.*\b(spend|buy|purchase)\b/i,
    /\b(check|monitor|watch)\b.*\b(every|all)\b.*\b(purchase|expense|transaction)\b/i,
    /\b(no access|can'?t access|locked out)\b.*\b(money|account|bank|card)\b/i,
  ],
  'debt-from-addiction': [
    /\b(debt|debts|owe|owing)\b.*\b(addiction|drugs|gambling|drinking|using)\b/i,
    /\b(bills|rent|mortgage)\b.*\b(can'?t pay|behind|late|unpaid)\b/i,
    /\b(spent|blew|wasted|lost)\b.*\b(savings|money|rent money|bill money)\b/i,
    /\b(creditors|collectors|bailiff)\b/i,
  ],
  'money-as-peace': [
    /\b(give|gave|pay|paid)\b.*\b(money|cash)\b.*\b(peace|quiet|calm|stop|avoid)\b/i,
    /\b(easier|simpler)\b.*\b(just (give|pay)|hand over)\b/i,
    /\b(buy|bought)\b.*\b(peace|silence|calm)\b/i,
    /\b(if i (don'?t|refuse))\b.*\b(give|pay)\b.*\b(angry|violent|scene)\b/i,
  ],
  'economic-trapped': [
    /\b(can'?t leave|can'?t go|stuck|trapped)\b.*\b(money|afford|financial)\b/i,
    /\b(nowhere to go|can'?t afford)\b.*\b(own|alone|rent|live)\b/i,
    /\b(depend|dependent|rely)\b.*\b(financial|money|income)\b/i,
    /\b(no (own )?income|no (own )?money|no (own )?savings)\b/i,
  ],
  'hidden-spending': [
    /\b(hide|hides|hiding|hidden|secret)\b.*\b(spend|spending|purchase|money|expense)\b/i,
    /\b(discover|found|noticed)\b.*\b(missing|gone|spent|withdrawal)\b/i,
    /\b(lie|lies|lying|lied)\b.*\b(money|spending|where.*went)\b/i,
    /\b(money.*disappear|cash.*gone|account.*empty)\b/i,
  ],
  'financial-gaslighting': [
    /\b(exaggerat|overreact|dramatic)\b.*\b(money|financial|spending)\b/i,
    /\b(not that (bad|much)|you'?re imagining|it'?s fine)\b.*\b(money|debt|finance)\b/i,
    /\b(crazy|paranoid|controlling)\b.*\b(ask|want to know|check)\b.*\b(money|spend)\b/i,
    /\b(my money|i earned|none of your business)\b.*\b(spend|do what i want)\b/i,
  ],
  'sacrifice-savings': [
    /\b(savings|saved|retirement|pension|emergency fund)\b.*\b(gone|spent|used|emptied|drained)\b/i,
    /\b(gave|give|used)\b.*\b(my|our)\b.*\b(savings|nest egg|future)\b/i,
    /\b(nothing left|no savings|broke|bankrupt)\b.*\b(because|for|due to)\b/i,
    /\b(bail.*out|cover.*debts|pay.*off)\b.*\b(again|every time|always)\b/i,
  ],
  'work-overload': [
    /\b(extra (job|work|shift|hours))\b.*\b(pay|cover|make up|compensate)\b/i,
    /\b(two jobs|three jobs|overtime|double shift)\b.*\b(because|to pay|to cover)\b/i,
    /\b(work.*myself.*death|exhausted.*working|killing myself working)\b/i,
    /\b(sole (provider|breadwinner|earner))\b.*\b(while|because|and)\b/i,
  ],
  'shame-about-money': [
    /\b(ashamed|embarrassed|shame)\b.*\b(money|financial|debt|situation)\b/i,
    /\b(can'?t tell|hide|secret)\b.*\b(anyone|family|friends)\b.*\b(money|financial|debt)\b/i,
    /\b(people.*know|if.*knew)\b.*\b(money|debt|financial|broke)\b/i,
    /\b(pretend|act like)\b.*\b(fine|ok|normal)\b.*\b(money|financial)\b/i,
  ],
};

const DETECTION_THRESHOLD = 0.35;
const STRONG_MARKER_WEIGHT = 0.25;
const WEAK_MARKER_WEIGHT = 0.15;
const HISTORY_BONUS = 0.05;

export function detectFIN01(input: FIN01DetectionInput): FIN01Detection {
  // Safety gates
  if (input.crisisLevel >= 2) {
    return { detected: false, confidence: 0, markers: [], phase: 'awareness', timestamp: LocalDeviceTimeService.now().utcIso };
  }
  if (!input.k06Stabilized) {
    return { detected: false, confidence: 0, markers: [], phase: 'awareness', timestamp: LocalDeviceTimeService.now().utcIso };
  }

  const detectedMarkers: FIN01Marker[] = [];
  let confidence = 0;

  // Scan current message
  const text = input.message.toLowerCase();
  for (const [marker, patterns] of Object.entries(MARKER_PATTERNS) as [FIN01Marker, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        if (!detectedMarkers.includes(marker)) {
          detectedMarkers.push(marker);
          const isStrong = ['financial-control', 'economic-trapped', 'debt-from-addiction'].includes(marker);
          confidence += isStrong ? STRONG_MARKER_WEIGHT : WEAK_MARKER_WEIGHT;
        }
        break;
      }
    }
  }

  // Scan recent history for accumulation
  for (const histMsg of input.recentHistory) {
    const histText = histMsg.toLowerCase();
    for (const [marker, patterns] of Object.entries(MARKER_PATTERNS) as [FIN01Marker, RegExp[]][]) {
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

  // Previous detection bonus
  const prevCount = input.previousDetections.filter(d => d.detected).length;
  if (prevCount > 0) {
    confidence += Math.min(prevCount * 0.05, 0.15);
  }

  confidence = Math.min(confidence, 1.0);
  const detected = confidence >= DETECTION_THRESHOLD && detectedMarkers.length >= 2;

  const phase = determinePhase(input.previousDetections, detectedMarkers);

  return {
    detected,
    confidence,
    markers: detectedMarkers,
    phase,
    timestamp: LocalDeviceTimeService.now().utcIso,
  };
}

function determinePhase(
  previousDetections: FIN01Detection[],
  currentMarkers: FIN01Marker[]
): FIN01Detection['phase'] {
  const activeCount = previousDetections.filter(d => d.detected).length;

  if (activeCount === 0) return 'awareness';
  if (activeCount <= 2) return 'impact-mapping';
  if (activeCount <= 4) return 'agency-building';
  if (activeCount <= 6) {
    return currentMarkers.includes('economic-trapped') ? 'protection' : 'agency-building';
  }
  return 'autonomy';
}
