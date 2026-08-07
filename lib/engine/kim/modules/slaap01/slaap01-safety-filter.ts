/**
 * SLAAP01 — Minimal Runtime Safety Filter
 *
 * Prevents sleep advice from becoming relational avoidance:
 * blocks distance-as-sleep, contact avoidance, other-as-cause framing.
 */

export interface SLAAP01SafetyFilterResult {
  safe: boolean;
  violations: string[];
  categories: string[];
  correctedText: string | null;
}

// ═══ RELATIONAL AVOIDANCE VIA SLEEP ═══
const SLEEP_AVOIDANCE: RegExp[] = [
  /\bneem\s+afstand\s+zodat\s+je\s+beter\s+slaapt\b/i,
  /\bvermijd\s+de\s+ander\s+voor\s+je\s+rust\b/i,
  /\bde\s+ander\s+is\s+de\s+oorzaak\s+van\s+je\s+slapeloosheid\b/i,
  /\blaat\s+het\s+los\s+en\s+slaap\b/i,
  /\bdenk\s+er\s+(?:gewoon\s+)?niet\s+meer\s+aan\b/i,
  /\bje\s+moet\s+dit\s+gesprek\s+vermijden\b/i,
  /\bje\s+hoeft\s+dit\s+nu\s+niet\s+(?:meer\s+)?te\s+voelen\b/i,
  /\bslaap\s+is\s+belangrijker\s+dan\s+(?:dit\s+)?contact\b/i,
];

// ═══ SHARED: DEMONIZATION ═══
const DEMONIZATION: RegExp[] = [
  /\bde\s+ander\s+is\s+het\s+probleem\b/i,
  /\bde\s+ander\s+heeft\s+jou\s+kapotgemaakt\b/i,
];

// ═══ SHARED: ACQUITTAL ═══
const ACQUITTAL: RegExp[] = [
  /\bjij\s+hebt\s+niets\s+verkeerd\s+gedaan\b/i,
  /\bjij\s+bent\s+(?:alleen|volledig)\s+slachtoffer\b/i,
];

// ═══ SHARED: DIAGNOSIS ═══
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
];

// ═══ FALLBACKS ═══
const FALLBACK_SLAAP01 = 'Rust nemen betekent niet dat je het contact afschrijft of de pijn wegduwt. Het betekent dat je je systeem eerst kalmeert, zodat je later helderder kan voelen, denken en eventueel spreken.';
const FALLBACK_HARM = 'Bij herhaalde schade komt verbinding pas na herstelvoorwaarden: erkenning, verantwoordelijkheid, transparantie, tijd, grenzen en herhaald veiliger gedrag.';
const FALLBACK_SAFETY = 'Als er nu gevaar, dreiging of onveiligheid is, gaat veiligheid voor slapen of verbinding. Zoek steun en kies de veiligste stap.';

// ═══ MAIN FILTER ═══
export function applySLAAP01SafetyFilter(
  response: string,
  options?: {
    relationalHarmActive?: boolean;
    safetyActive?: boolean;
  },
): SLAAP01SafetyFilterResult {
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
  check(SLEEP_AVOIDANCE, 'sleep_avoidance');
  check(DEMONIZATION, 'demonization');
  check(ACQUITTAL, 'acquittal');
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

  // Fallback priority: safety > harm > sleep_avoidance > generic
  let correctedText: string;
  if (categories.includes('safety_connection')) {
    correctedText = FALLBACK_SAFETY;
  } else if (categories.includes('harm_minimization')) {
    correctedText = FALLBACK_HARM;
  } else {
    correctedText = FALLBACK_SLAAP01;
  }

  return { safe: false, violations, categories, correctedText };
}
