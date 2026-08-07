/**
 * VETR01 — Runtime Output Safety Filter
 *
 * Prevents Kim from forcing forgiveness, forcing trust, accelerating repair,
 * normalizing cynical distance, demonizing, or absolving when VETR01 is active.
 *
 * 5 context-aware fallbacks based on violation category.
 */

export interface VETR01SafetyFilterResult {
  safe: boolean;
  violations: string[];
  categories: string[];
  correctedText: string | null;
}

// ═══ FORCED FORGIVENESS ═══
const FORCED_FORGIVENESS: RegExp[] = [
  /\bje\s+moet\s+(?:leren\s+)?vergeven\b/i,
  /\bje\s+moet\s+dit\s+vergeven\b/i,
  /\bvergeving\s+is\s+nodig\s+om\s+verder\s+te\s+(?:gaan|kunnen)\b/i,
  /\blaat\s+het\s+los\b/i,
  /\bje\s+moet\s+het\s+verleden\s+achter\s+je\s+laten\b/i,
];

// ═══ FORCED TRUST ═══
const FORCED_TRUST: RegExp[] = [
  /\bje\s+moet\s+opnieuw\s+vertrouwen\b/i,
  /\bals\s+je\s+liefhebt\s+moet\s+je\s+openstaan\b/i,
  /\bzonder\s+vertrouwen\s+heeft\s+dit\s+geen\s+zin\b/i,
  /\bvertrouwen\s+komt\s+vanzelf\s+terug\b/i,
  /\bgeef\s+het\s+tijd\s+en\s+laat\s+het\s+los\b/i,
];

// ═══ CYNICAL DISTANCE ═══
const CYNICAL_DISTANCE: RegExp[] = [
  /\bvertrouwen\s+is\s+kapot\b/i,
  /\bde\s+ander\s+heeft\s+je\s+vertrouwen\s+voorgoed\s+vernietigd\b/i,
  /\bje\s+moet\s+afstand\s+nemen\b/i,
  /\bdit\s+komt\s+nooit\s+meer\s+goed\b/i,
  /\bje\s+kunt\s+de\s+ander\s+nooit\s+meer\s+vertrouwen\b/i,
];

// ═══ SHARED: DEMONIZATION ═══
const DEMONIZATION: RegExp[] = [
  /\bde\s+ander\s+is\s+het\s+probleem\b/i,
  /\bde\s+ander\s+heeft\s+jou\s+kapotgemaakt\b/i,
  /\bde\s+ander\s+respecteert\s+jou\s+niet\b/i,
  /\bde\s+ander\s+manipuleert\s+(?:je|jou)\b/i,
];

// ═══ SHARED: ACQUITTAL ═══
const ACQUITTAL: RegExp[] = [
  /\bjij\s+hebt\s+niets\s+verkeerd\s+gedaan\b/i,
  /\bjij\s+bent\s+(?:alleen|volledig)\s+slachtoffer\b/i,
];

// ═══ SHARED: DIAGNOSIS ═══
const DIAGNOSIS: RegExp[] = [
  /\b(?:hij|zij|de\s+ander)\s+is\s+(?:een\s+)?(?:narcist|misbruiker)\b/i,
  /\btrauma\s*bond\b/i,
];

// ═══ CONDITIONAL: SAFETY CONNECTION ═══
const SAFETY_CONNECTION: RegExp[] = [
  /\bhoud\s+de\s+brug\s+open\b/i,
  /\bprobeer\s+toch\s+contact\s+te\s+houden\b/i,
  /\bblijf\s+beschikbaar\b/i,
  /\bzoek\s+verbinding\b/i,
];

// ═══ CONDITIONAL: HARM MINIMIZATION ═══
const HARM_MINIMIZATION: RegExp[] = [
  /\bkijk\s+ook\s+naar\s+de\s+kant\s+van\s+de\s+ander\b/i,
  /\bmisschien\s+bedoelde\s+de\s+ander\s+het\s+niet\s+zo\b/i,
  /\biedereen\s+maakt\s+fouten\b/i,
  /\bhet\s+kwam\s+door\s+de\s+verslaving\b/i,
];

// ═══ FALLBACKS ═══
const FALLBACK_FORCED_FORGIVENESS = 'Vergeving hoeft niet geforceerd te worden. Eerst moet duidelijk worden of erkenning, verantwoordelijkheid en veiliger herhaald gedrag aanwezig zijn.';
const FALLBACK_FORCED_TRUST = 'Vertrouwen hoeft niet beslist te worden. Het kan alleen groeien wanneer woorden en gedrag herhaald overeenkomen.';
const FALLBACK_CYNICAL_DISTANCE = 'Het hoeft nu geen keuze tussen afsluiten of doorgaan te zijn. De vraag is welke herstelvoorwaarden nodig zijn om contact ooit veiliger te maken.';
const FALLBACK_HARM = 'Bij herhaalde schade komt verbinding pas na herstelvoorwaarden: erkenning, verantwoordelijkheid, transparantie, tijd, grenzen en herhaald veiliger gedrag.';
const FALLBACK_SAFETY = 'Nu gaat veiligheid voor verbinding. Kies de veiligste stap en zoek steun.';

// ═══ MAIN FILTER ═══
export function applyVETR01SafetyFilter(
  response: string,
  options?: {
    relationalHarmActive?: boolean;
    safetyActive?: boolean;
  },
): VETR01SafetyFilterResult {
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
  check(FORCED_FORGIVENESS, 'forced_forgiveness');
  check(FORCED_TRUST, 'forced_trust');
  check(CYNICAL_DISTANCE, 'cynical_distance');
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

  // Fallback priority: safety > harm > forced_forgiveness > forced_trust > cynical_distance > generic
  let correctedText: string;
  if (categories.includes('safety_connection')) {
    correctedText = FALLBACK_SAFETY;
  } else if (categories.includes('harm_minimization')) {
    correctedText = FALLBACK_HARM;
  } else if (categories.includes('forced_forgiveness')) {
    correctedText = FALLBACK_FORCED_FORGIVENESS;
  } else if (categories.includes('forced_trust')) {
    correctedText = FALLBACK_FORCED_TRUST;
  } else if (categories.includes('cynical_distance')) {
    correctedText = FALLBACK_CYNICAL_DISTANCE;
  } else {
    correctedText = FALLBACK_FORCED_TRUST; // generic trust fallback
  }

  return { safe: false, violations, categories, correctedText };
}
