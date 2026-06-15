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
  /\bik\s+wil\s+(weer\s+|zo\s+graag\s+|echt\s+|gewoon\s+)?(gebruiken|drinken|roken|blowen|snuiven|spuiten)\b/i,
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

// ─── Kim-variant markers (loved ones reporting relapse intent of their person) ───

/**
 * Dutch Kim-variant markers.
 * Matches a naaste (loved one) reporting that their person wants to / is going to use.
 * Third-person: "hij wil weer drinken", "ze gaat gebruiken", "mijn partner wil weer drinken"
 */
const NL_KIM_MARKERS: RegExp[] = [
  /\b(hij|zij|ze|mijn\s+(?:partner|man|vrouw|zoon|dochter|broer|zus|vriend|vriendin))\s+wil\s+(weer\s+|zo\s+graag\s+|echt\s+)?(gebruiken|drinken|roken|blowen|snuiven|spuiten)\b/i,
  /\b(hij|zij|ze|mijn\s+(?:partner|man|vrouw|zoon|dochter|broer|zus|vriend|vriendin))\s+ga(?:at)?\s+(weer\s+)?(gebruiken|drinken|roken|blowen|snuiven|spuiten)\b/i,
  /\b(hij|zij|ze)\s+heeft\s+(weer\s+)?zin\s+(om\s+te\s+)?(gebruiken|drinken|roken)\b/i,
  /\b(hij|zij|ze)\s+kan\s+(het\s+)?niet\s+(laten|weerstaan)\b/i,
  /\b(hij|zij|ze)\s+zegt\s+dat\s+(hij|zij|ze)\s+wil\s+(gebruiken|drinken|roken)\b/i,
  /\b(hij|zij|ze)\s+dreigt\s+(te\s+)?(gebruiken|drinken|roken|terugvallen)\b/i,
];

/**
 * English Kim-variant markers.
 * Third-person: "he wants to drink again", "she's going to use"
 */
const EN_KIM_MARKERS: RegExp[] = [
  /\b(he|she|my\s+(?:partner|husband|wife|son|daughter|brother|sister|friend))\s+wants?\s+to\s+(use|drink|smoke|get high|relapse)\b/i,
  /\b(he|she|they|my\s+(?:partner|husband|wife|son|daughter|brother|sister|friend))\s+is\s+going\s+to\s+(use|drink|smoke|relapse)\b/i,
  /\b(he|she|they)('s|\s+are)\s+going\s+to\s+(use|drink|smoke|relapse)\b/i,
  /\b(he|she|they)\s+can'?t\s+resist\s+(the\s+)?(urge|craving|temptation)\b/i,
  /\b(he|she|they)\s+said\s+(he|she|they)\s+want(s)?\s+to\s+(use|drink|smoke)\b/i,
  /\b(he|she|they|my\s+(?:partner|husband|wife|son|daughter|brother|sister|friend))('s|\s+is|\s+are)\s+threatening\s+to\s+(use|drink|relapse)\b/i,
];

/**
 * French Kim-variant markers.
 * Third-person: "il veut reconsommer", "elle va boire"
 */
const FR_KIM_MARKERS: RegExp[] = [
  /\b(il|elle|mon\s+(?:partenaire|mari|femme|fils|fille|fr[eè]re|s[oœ]ur|ami|amie))\s+veut\s+(consommer|boire|fumer|rechuter)\b/i,
  /\b(il|elle)\s+va\s+(consommer|boire|fumer|rechuter)\b/i,
  /\b(il|elle)\s+ne\s+(peut|pourra)\s+pas\s+r[eé]sister\b/i,
  /\b(il|elle)\s+dit\s+qu'?(il|elle)\s+veut\s+(consommer|boire|fumer)\b/i,
];

// ─── All markers combined ────────────────────────────────────────

const ALL_MARKERS: RegExp[] = [...NL_MARKERS, ...EN_MARKERS, ...FR_MARKERS];
const ALL_KIM_MARKERS: RegExp[] = [...NL_KIM_MARKERS, ...EN_KIM_MARKERS, ...FR_KIM_MARKERS];

// ─── Public API ──────────────────────────────────────────────────

/**
 * Deterministic fallback detection for relapse intent (Elias — first person).
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

/**
 * Kim-variant: Deterministic fallback detection for loved ones reporting
 * that their person expresses relapse intent (third person).
 *
 * "Hij wil weer drinken", "She's going to use", "Il veut reconsommer"
 *
 * Returns confidence 0.65 (slightly lower than first-person — the intent
 * is reported, not directly expressed by the user themselves).
 */
export function detectKimRelapseIntentFallback(message: string): RelapseIntentResult {
  for (const pattern of ALL_KIM_MARKERS) {
    if (pattern.test(message)) {
      return { detected: true, confidence: 0.65 };
    }
  }

  return { detected: false, confidence: 0 };
}
