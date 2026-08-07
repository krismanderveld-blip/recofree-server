/**
 * PAR01 — Light Runtime Safety Filter
 *
 * Prevents parentification detection from becoming:
 * - blame/guilt for the caregiver
 * - diagnostic labeling
 * - proof the relationship is unhealthy
 * - reason to take distance or write off the other
 */

export interface PAR01SafetyFilterResult {
  safe: boolean;
  violations: string[];
  categories: string[];
  correctedText: string | null;
}

// ═══ ROLE LABELING (parentification as identity) ═══
const ROLE_LABELING: RegExp[] = [
  /\bjij\s+bent\s+de\s+ouder\s+geworden\b/i,
  /\bjij\s+bent\s+de\s+redder\b/i,
  /\bjij\s+draagt\s+alles\b/i,
  /\bjij\s+houdt\s+dit\s+systeem\s+overeind\b/i,
  /\bjij\s+maakt\s+dit\s+mogelijk\b/i,
  /\bjij\s+bent\s+verantwoordelijk\s+geworden\s+voor\s+de\s+ander\b/i,
];

// ═══ DISTANCE PUSH ═══
const DISTANCE_PUSH: RegExp[] = [
  /\bjij\s+moet\s+stoppen\s+met\s+zorgen\b/i,
  /\bje\s+moet\s+loskomen\s+uit\s+deze\s+rol\b/i,
  /\blaat\s+de\s+ander\s+(?:zijn|haar)\s+verantwoordelijkheid\s+dragen\b/i,
];

// ═══ DIAGNOSIS ═══
const DIAGNOSIS: RegExp[] = [
  /\bdit\s+is\s+parentificatie\b/i,
  /\bdit\s+is\s+ongezond\b/i,
  /\b(?:hij|zij|de\s+ander)\s+is\s+(?:een\s+)?(?:narcist|misbruiker)\b/i,
];

// ═══ DEMONIZATION ═══
const DEMONIZATION: RegExp[] = [
  /\bde\s+ander\s+is\s+het\s+probleem\b/i,
  /\bde\s+ander\s+heeft\s+jou\s+kapotgemaakt\b/i,
  /\bde\s+ander\s+misbruikt\s+jou\b/i,
];

// ═══ ACQUITTAL ═══
const ACQUITTAL: RegExp[] = [
  /\bjij\s+hebt\s+niets\s+verkeerd\s+gedaan\b/i,
  /\bjij\s+bent\s+(?:alleen|volledig)\s+slachtoffer\b/i,
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
const FALLBACK_PAR01 = 'Het lijkt alsof je een rol draagt die te zwaar wordt. Dat zegt iets over hoeveel je probeert te zorgen, niet dat jij fout bent. De vraag is welke verantwoordelijkheid van jou is, en welke niet, zodat je betrokken kan blijven zonder jezelf kwijt te raken.';
const FALLBACK_HARM = 'Bij herhaalde schade hoeft verbinding niet geforceerd te worden. Eerst zijn erkenning, verantwoordelijkheid, transparantie, tijd, grenzen en herhaald veiliger gedrag nodig.';
const FALLBACK_SAFETY = 'Als er nu gevaar, dreiging of kindonveiligheid is, gaat veiligheid voor verbinding. Kies de veiligste stap en zoek steun.';

// ═══ MAIN FILTER ═══
export function applyPAR01SafetyFilter(
  response: string,
  options?: {
    relationalHarmActive?: boolean;
    safetyActive?: boolean;
  },
): PAR01SafetyFilterResult {
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
  check(ROLE_LABELING, 'role_labeling');
  check(DISTANCE_PUSH, 'distance_push');
  check(DIAGNOSIS, 'diagnosis');
  check(DEMONIZATION, 'demonization');
  check(ACQUITTAL, 'acquittal');

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
    correctedText = FALLBACK_PAR01;
  }

  return { safe: false, violations, categories, correctedText };
}
