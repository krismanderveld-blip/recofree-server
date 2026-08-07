/**
 * KSC01 — Runtime Output Safety Filter
 *
 * Prevents self-compassion from becoming relational avoidance:
 * blocks "laat het los", absolute acquittal, responsibility erasure,
 * and "just be kind" without accountability.
 */

export interface KSC01SafetyFilterResult {
  safe: boolean;
  violations: string[];
  categories: string[];
  correctedText: string | null;
}

// ═══ RELATIONAL AVOIDANCE ═══
const RELATIONAL_AVOIDANCE: RegExp[] = [
  /\blaat\s+het\s+los\b/i,
  /\bje\s+moet\s+loslaten\b/i,
  /\bkies\s+(?:nu\s+)?gewoon\s+voor\s+jezelf\b/i,
  /\bdit\s+ligt\s+niet\s+bij\s+jou\b/i,
  /\bje\s+hoeft\s+hier\s+niet\s+meer\s+over\s+na\s+te\s+denken\b/i,
  /\bwees\s+gewoon\s+lief\s+voor\s+jezelf\b/i,
];

// ═══ ABSOLUTE ACQUITTAL ═══
const ACQUITTAL: RegExp[] = [
  /\bjij\s+hebt\s+niets\s+verkeerd\s+gedaan\b/i,
  /\bjij\s+bent\s+(?:alleen|volledig)\s+slachtoffer\b/i,
  /\bstop\s+met\s+je\s+schuldig\s+(?:te\s+)?voelen\b/i,
  /\bde\s+ander\s+is\s+verantwoordelijk,?\s+jij\s+niet\b/i,
];

// ═══ DEMONIZATION ═══
const DEMONIZATION: RegExp[] = [
  /\bde\s+ander\s+is\s+het\s+probleem\b/i,
  /\bde\s+ander\s+heeft\s+jou\s+kapotgemaakt\b/i,
];

// ═══ DIAGNOSIS ═══
const DIAGNOSIS: RegExp[] = [
  /\b(?:hij|zij|de\s+ander)\s+is\s+(?:een\s+)?(?:narcist|misbruiker)\b/i,
];

// ═══ CONDITIONAL: SAFETY CONNECTION ═══
const SAFETY_CONNECTION: RegExp[] = [
  /\bhoud\s+de\s+brug\s+open\b/i,
  /\bblijf\s+beschikbaar\b/i,
  /\bzoek\s+verbinding\b/i,
];

// ═══ CONDITIONAL: HARM MINIMIZATION ═══
const HARM_MINIMIZATION: RegExp[] = [
  /\bkijk\s+ook\s+naar\s+de\s+kant\s+van\s+de\s+ander\b/i,
  /\bmisschien\s+bedoelde\s+de\s+ander\s+het\s+niet\s+zo\b/i,
  /\biedereen\s+maakt\s+fouten\b/i,
];

// ═══ FALLBACKS ═══
const FALLBACK_KSC01 = 'Zelfcompassie betekent niet dat je alles moet loslaten of niets meer hoeft te bekijken. Het betekent dat je mild genoeg blijft om eerlijk te kijken zonder jezelf af te breken.';
const FALLBACK_HARM = 'Bij herhaalde schade komt verbinding pas na herstelvoorwaarden: erkenning, verantwoordelijkheid, transparantie, tijd, grenzen en herhaald veiliger gedrag.';
const FALLBACK_SAFETY = 'Nu gaat veiligheid voor verbinding. Kies de veiligste stap en zoek steun.';

// ═══ MAIN FILTER ═══
export function applyKSC01SafetyFilter(
  response: string,
  options?: {
    relationalHarmActive?: boolean;
    safetyActive?: boolean;
  },
): KSC01SafetyFilterResult {
  const violations: string[] = [];
  const categories: string[] = [];

  const check = (patterns: RegExp[], category: string) => {
    for (const p of patterns) {
      if (p.test(response)) {
        violations.push(`${category}: ${p.source}`);
        if (!categories.includes(category)) categories.push(category);
      }
    }
  };

  // Always-on
  check(RELATIONAL_AVOIDANCE, 'relational_avoidance');
  check(ACQUITTAL, 'acquittal');
  check(DEMONIZATION, 'demonization');
  check(DIAGNOSIS, 'diagnosis');

  // Conditional
  if (options?.safetyActive) {
    check(SAFETY_CONNECTION, 'safety_connection');
  }
  if (options?.relationalHarmActive) {
    check(HARM_MINIMIZATION, 'harm_minimization');
  }

  if (violations.length === 0) {
    return { safe: true, violations, categories, correctedText: null };
  }

  // Fallback priority: safety > harm > module-specific
  let correctedText: string;
  if (categories.includes('safety_connection')) {
    correctedText = FALLBACK_SAFETY;
  } else if (categories.includes('harm_minimization')) {
    correctedText = FALLBACK_HARM;
  } else {
    correctedText = FALLBACK_KSC01;
  }

  return { safe: false, violations, categories, correctedText };
}
