/**
 * Relapse Intent Fallback — Deterministic marker-based detection
 *
 * Used ONLY when the GptSignalEngine fails or times out.
 * Provides a language-aware safety net for relapse-intent detection.
 *
 * Covers: NL, EN, FR
 *
 * This is NOT a replacement for the semantic GptSignalEngine detection.
 * It catches only explicit, unambiguous relapse-intent phrases.
 *
 * If a marker matches → returns { detected: true, confidence: 0.7 }
 * If no match → returns { detected: false, confidence: 0 }
 */

import type { RelapseIntentResult } from './signal-engine';

// ─── Marker Patterns ─────────────────────────────────────────────

/**
 * Dutch relapse-intent markers.
 * Matches explicit desire/plan/urge to use substances.
 */
const NL_MARKERS: RegExp[] = [
  /\b(ik\s+)?wil\s+(weer\s+|zo\s+graag\s+|echt\s+|gewoon\s+)?(gebruiken|drinken|roken|blowen|snuiven|spuiten)\b/i,
  /\bwil\s+ik\s+(zo\s+graag\s+|echt\s+|gewoon\s+|weer\s+)?(gebruiken|drinken|roken|blowen|snuiven|spuiten)\b/i,
  /\b(ik\s+)?ga\s+(weer\s+)?(gebruiken|drinken|roken|blowen|snuiven|spuiten)\b/i,
  /\bzin\s+(om\s+te\s+)?(gebruiken|drinken|roken)\b/i,
  /\bdrang\s+(om\s+te\s+)?(gebruiken|drinken|roken)\b/i,
  /\bik\s+verlang\s+(er\s+)?(zo\s+)?naar\b/i,
  /\bik\s+moet\s+(iets\s+)?(gebruiken|drinken|roken|nemen)\b/i,
  /\bik\s+kan\s+(het\s+)?niet\s+(laten|weerstaan)\b/i,
];

/**
 * English relapse-intent markers.
 * Matches explicit desire/plan/urge to use substances.
 */
const EN_MARKERS: RegExp[] = [
  /\b(i\s+)?want\s+to\s+(use|drink|smoke|get high|get drunk|take something)\b/i,
  /\b(i('m|\s+am)\s+)?going\s+to\s+(use|drink|smoke|get high)\b/i,
  /\burge\s+to\s+(use|drink|smoke|relapse)\b/i,
  /\bi\s+need\s+(a\s+)?(drink|hit|fix|dose)\b/i,
  /\bi\s+can'?t\s+resist\s+(the\s+)?(urge|craving|temptation)\b/i,
  /\bi('m|\s+am)\s+going\s+to\s+relapse\b/i,
];

/**
 * French relapse-intent markers.
 * Matches explicit desire/plan/urge to use substances.
 */
const FR_MARKERS: RegExp[] = [
  /\b(j'ai\s+)?envie\s+de\s+(consommer|boire|fumer|prendre)\b/i,
  /\bje\s+vais\s+(consommer|boire|fumer|rechuter)\b/i,
  /\bje\s+veux\s+(consommer|boire|fumer|prendre)\b/i,
  /\bbesoin\s+de\s+(consommer|boire|fumer|prendre)\b/i,
  /\bje\s+ne\s+(peux|pourrai)\s+pas\s+r[eé]sister\b/i,
];

// ─── All markers combined ────────────────────────────────────────

const ALL_MARKERS: RegExp[] = [...NL_MARKERS, ...EN_MARKERS, ...FR_MARKERS];

// ─── Public API ──────────────────────────────────────────────────

/**
 * Deterministic fallback detection for relapse intent.
 *
 * Used ONLY when GptSignalEngine.detectRelapseIntent() fails (timeout/error).
 * Returns confidence 0.7 on match (high enough to trigger ORANJE escalation
 * at the ≥0.6 threshold, but lower than a confident GPT detection).
 */
export function detectRelapseIntentFallback(message: string): RelapseIntentResult {
  for (const pattern of ALL_MARKERS) {
    if (pattern.test(message)) {
      return { detected: true, confidence: 0.7 };
    }
  }

  return { detected: false, confidence: 0 };
}
