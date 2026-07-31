/**
 * EN markers for GEVAAR-K01 and KIND-K01
 * Kim persona only
 */

// ============ GEVAAR-K01 MARKERS ============

export const EN_DRUNK_DRIVING_MARKERS: RegExp[] = [
  /\b(he|she)\s+is\s+driving\s+drunk\b/i,
  /\b(he|she)\s+wants?\s+to\s+drive\s+after\s+drinking\b/i,
  /\b(he|she)\s+left\s+with\s+the\s+car\s+and\s+(he|she)\s+(drank|was\s+drunk)\b/i,
  /\b(he|she)\s+is\s+driving\s+under\s+the\s+influence\b/i,
  /\b(he|she)\s+wants?\s+to\s+take\s+the\s+keys\b/i,
  /driving\s+(drunk|under\s+the\s+influence|while\s+(drunk|intoxicated))/i,
  /\b(he|she)\s+is\s+about\s+to\s+drive\b/i,
];

export const EN_AGGRESSION_MARKERS: RegExp[] = [
  /\b(he|she)\s+is\s+getting\s+aggressive\b/i,
  /\b(he|she)\s+is\s+threatening\s+me\b/i,
  /\b(he|she)\s+is\s+yelling\s+and\s+throwing\s+things\b/i,
  /\b(he|she)\s+(hit|pushed|kicked|punched)\s+me\b/i,
  /\bI\s+(do\s+not|don'?t)\s+feel\s+safe\s+at\s+home\b/i,
  /\bI\s+am\s+afraid\s+(he|she)\s+will\s+hurt\s+me\b/i,
  /\b(he|she)\s+is\s+violent\b/i,
  /\b(he|she)\s+is\s+aggressive\b/i,
  /\bit\s+is\s+escalating\b/i,
];

export const EN_DISAPPEARANCE_MARKERS: RegExp[] = [
  /\b(he|she)\s+disappeared\b/i,
  /\bI\s+(do\s+not|don'?t)\s+know\s+where\s+(he|she)\s+is\b/i,
  /\b(he|she)\s+is\s+not\s+answering\b/i,
  /\b(he|she)\s+is\s+missing\b/i,
  /\b(he|she)\s+left\s+and\s+(he|she)\s+was\s+(drunk|using)\b/i,
  /\b(he|she)\s+is\s+gone\s+and\b/i,
];

export const EN_MEDICAL_OVERDOSE_MARKERS: RegExp[] = [
  /\b(he|she)\s+is\s+not\s+responding\b/i,
  /\b(he|she)\s+is\s+breathing\s+strangely\b/i,
  /\b(he|she)\s+is\s+unconscious\b/i,
  /\b(he|she)\s+took\s+too\s+much\b/i,
  /\bI\s+think\s+(he|she)\s+overdosed\b/i,
  /\boverdose[d]?\b/i,
  /\bunconscious\b/i,
];

export const EN_SELF_HARM_THREAT_MARKERS: RegExp[] = [
  /\b(he|she)\s+is\s+threatening\s+to\s+hurt\s+(himself|herself)\b/i,
  /\b(he|she)\s+says?\s+(he|she)\s+(does\s+not|doesn'?t)\s+want\s+to\s+live\b/i,
  /\b(he|she)\s+wants?\s+to\s+(end\s+it|kill\s+(himself|herself)|die)\b/i,
  /\b(he|she)\s+is\s+suicidal\b/i,
  /\b(he|she)\s+threatened\s+suicide\b/i,
];

// ============ KIND-K01 MARKERS ============

export const EN_CHILD_WITNESSES_MARKERS: RegExp[] = [
  /\bthe\s+children\s+(see|notice)\s+it\b/i,
  /\bmy\s+(son|daughter)\s+sees?\s+it\b/i,
  /\bthe\s+children\s+hear(d)?\s+(everything|us\s+fighting)\b/i,
  /\b(he|she)\s+is\s+drunk\s+(in\s+front\s+of|around)\s+the\s+children\b/i,
  /\b(he|she)\s+uses?\s+around\s+the\s+children\b/i,
  /\bchildren\s+(see|witness|notice)\b/i,
];

export const EN_CHILD_FEAR_MARKERS: RegExp[] = [
  /\bmy\s+(son|daughter|child)\s+is\s+(scared|afraid|frightened)\b/i,
  /\bthe\s+children\s+are\s+(scared|afraid)\b/i,
  /\bmy\s+child\s+cries\s+when\s+(he|she)\s+drinks\b/i,
  /\bthe\s+children\s+hide\b/i,
  /\bthe\s+children\s+(do\s+not|don'?t)\s+want\s+to\s+go\s+home\b/i,
  /\b(son|daughter|child|children)\s+.{0,20}(scared|afraid|frightened)\b/i,
];

export const EN_CHILD_PARENTIFICATION_MARKERS: RegExp[] = [
  /\bmy\s+(son|daughter)\s+tries?\s+to\s+calm\s+(him|her)\s+down\b/i,
  /\bthe\s+children\s+take\s+care\s+of\s+(him|her)\b/i,
  /\bmy\s+child\s+watches?\s+(him|her)\b/i,
  /\bmy\s+child\s+has\s+to\s+tell\s+me\s+if\s+(he|she)\s+(drinks|uses)\b/i,
  /\bthe\s+children\s+ask\s+if\s+they\s+should\s+do\s+something\b/i,
  /\bchildren\s+.{0,15}(calm|monitor|watch|take\s+care)\b/i,
];

export const EN_CHILD_NEGLECT_MALTREATMENT_MARKERS: RegExp[] = [
  /\bthe\s+children\s+(do\s+not|don'?t)\s+get\s+food\b/i,
  /\bthe\s+children\s+are\s+left\s+alone\b/i,
  /\b(he|she)\s+leaves?\s+the\s+children\s+alone\s+while\s+(drinking|using)\b/i,
  /\bmy\s+child\s+is\s+not\s+safe\b/i,
  /\bthe\s+children\s+are\s+not\s+safe\b/i,
  /\b(he|she)\s+drives?\s+drunk\s+with\s+the\s+children\b/i,
  /\b(he|she)\s+yells?\s+at\s+the\s+children\b/i,
  /\b(he|she)\s+(hits?|slaps?|beats?)\s+the\s+children\b/i,
  /\bchildren\s+.{0,10}not\s+safe\b/i,
];

export const EN_CHILD_AGE_APPROPRIATE_MARKERS: RegExp[] = [
  /\bwhat\s+do\s+I\s+tell\s+the\s+children\b/i,
  /\bhow\s+do\s+I\s+explain\s+this\s+to\s+my\s+(son|daughter|child)\b/i,
  /\bshould\s+I\s+tell\s+the\s+children\s+the\s+truth\b/i,
  /\bI\s+want\s+to\s+protect\s+the\s+children\b/i,
  /\bI\s+(do\s+not|don'?t)\s+want\s+the\s+children\s+to\s+hate\s+(him|her)\b/i,
];
