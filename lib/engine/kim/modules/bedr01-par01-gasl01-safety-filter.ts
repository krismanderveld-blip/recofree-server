/**
 * BEDR01 / PAR01 / GASL01 — Runtime Output Safety Filter
 *
 * Prevents Kim from reverting to demonizing, absolving, decision-forcing,
 * or label-based language when these high-risk modules are active.
 */

export type BPGModuleId = 'BEDR01' | 'PAR01' | 'GASL01';

export interface BPGSafetyFilterResult {
  safe: boolean;
  violations: string[];
  categories: string[];
  correctedText: string | null;
}

// ═══ SHARED PATTERNS ═══
const SHARED_DEMONIZATION: RegExp[] = [
  /\bde\s+ander\s+is\s+het\s+probleem\b/i,
  /\bde\s+ander\s+heeft\s+jou\s+kapotgemaakt\b/i,
  /\bde\s+ander\s+respecteert\s+jou\s+niet\b/i,
  /\bde\s+ander\s+manipuleert\s+(?:je|jou)\b/i,
  /\bde\s+ander\s+(?:is|was)\s+(?:een\s+)?(?:narcist|misbruiker|psychopaat)\b/i,
];

const SHARED_ACQUITTAL: RegExp[] = [
  /\bjij\s+hebt\s+niets\s+verkeerd\s+gedaan\b/i,
  /\bjij\s+bent\s+(?:alleen|volledig)\s+slachtoffer\b/i,
  /\bdit\s+ligt\s+helemaal\s+niet\s+bij\s+jou\b/i,
];

const SHARED_DECISION_FORCING: RegExp[] = [
  /\bje\s+moet\s+weggaan\b/i,
  /\bje\s+moet\s+(?:hem|haar|de\s+ander)\s+verlaten\b/i,
  /\bje\s+moet\s+de\s+relatie\s+be[ëe]indigen\b/i,
  /\bje\s+moet\s+afstand\s+nemen\b/i,
];

const SHARED_DIAGNOSIS: RegExp[] = [
  /\b(?:hij|zij|de\s+ander)\s+is\s+(?:een\s+)?narcist\b/i,
  /\b(?:hij|zij|de\s+ander)\s+is\s+(?:een\s+)?misbruiker\b/i,
  /\bpsychisch\s+misbruik\b/i,
  /\btrauma\s*bond\b/i,
];

const SHARED_SAFETY_CONNECTION: RegExp[] = [
  /\bhoud\s+de\s+brug\s+open\b/i,
  /\bprobeer\s+toch\s+contact\s+te\s+houden\b/i,
  /\bblijf\s+beschikbaar\b/i,
  /\bzoek\s+verbinding\b/i,
];

const SHARED_HARM_MINIMIZATION: RegExp[] = [
  /\bkijk\s+ook\s+naar\s+de\s+kant\s+van\s+de\s+ander\b/i,
  /\bmisschien\s+bedoelde\s+de\s+ander\s+het\s+niet\s+zo\b/i,
  /\biedereen\s+maakt\s+fouten\b/i,
  /\bhet\s+kwam\s+door\s+de\s+verslaving\b/i,
];

// ═══ BEDR01 SPECIFIC ═══
const BEDR01_PATTERNS: RegExp[] = [
  /\been\s+bedrieger\s+verandert\s+niet\b/i,
  /\bdit\s+toont\s+wie\s+de\s+ander\s+echt\s+is\b/i,
  /\bje\s+moet\s+(?:hem|haar)\s+nog\s+een\s+kans\s+geven\b/i,
  /\bje\s+moet\s+dit\s+vergeven\b/i,
  /\bneem\s+het\s+niet\s+persoonlijk\b/i,
  /\bje\s+moet\s+begrijpen\s+waarom\s+dit\s+gebeurde\b/i,
  /\bje\s+had\s+het\s+moeten\s+zien\b/i,
  /\bje\s+bent\s+na[ïi]ef\s+geweest\b/i,
];

// ═══ PAR01 SPECIFIC ═══
const PAR01_PATTERNS: RegExp[] = [
  /\bje\s+moet\s+dit\s+controleren\b/i,
  /\bcheck\s+(?:zijn|haar)\s+telefoon\b/i,
  /\bvolg\s+je\s+gevoel,?\s+het\s+klopt\s+vast\b/i,
  /\bde\s+ander\s+liegt\s+waarschijnlijk\b/i,
  /\bjij\s+moet\s+weten\s+wat\s+er\s+echt\s+gebeurt\b/i,
  /\bwantrouwen\s+betekent\s+dat\s+er\s+iets\s+mis\s+is\b/i,
  /\bje\s+bent\s+parano[ïi]de\b/i,
  /\bje\s+beeldt\s+je\s+dit\s+in\b/i,
];

// ═══ GASL01 SPECIFIC ═══
const GASL01_PATTERNS: RegExp[] = [
  /\bde\s+ander\s+gaslight\s+jou\s+zeker\b/i,
  /\bde\s+ander\s+probeert\s+je\s+gek\s+te\s+maken\b/i,
  /\bdit\s+is\s+psychisch\s+misbruik\s+zonder\s+twijfel\b/i,
  /\bje\s+moet\s+geen\s+gesprek\s+meer\s+aangaan\b/i,
  /\bjouw\s+gevoel\s+is\s+altijd\s+de\s+waarheid\b/i,
  /\bdat\s+is\s+niet\s+zo\s+erg\b/i,
  /\bje\s+overdrijft\b/i,
  /\bmisschien\s+heeft\s+(?:hij|zij)\s+gelijk\b/i,
  /\bje\s+bent\s+te\s+gevoelig\b/i,
];

// ═══ FALLBACKS ═══
const MODULE_FALLBACKS: Record<BPGModuleId, string> = {
  'BEDR01': 'Dit is echte schade. Je pijn hoeft niet kleiner gemaakt te worden. Begrip voor context mag de impact niet uitwissen. Er hoeft nu niets besloten te worden.',
  'PAR01': 'Je onrust voelt echt, maar dat maakt elke gedachte nog geen feit. Wat weet je zeker, wat vermoed je, en wat vult je angst in? Welke duidelijkheid zou helpen zonder controle?',
  'GASL01': 'Het is ernstig als je aan je eigen waarneming begint te twijfelen. We hoeven geen intentie in te vullen om jouw verwarring serieus te nemen. Wat is gezegd, wat gebeurde er, en wat werd daarna ontkend?',
};

const SAFETY_FALLBACK = 'Nu gaat veiligheid voor verbinding. Kies de veiligste stap en zoek steun.';
const HARM_FALLBACK = 'Bij herhaalde schade hoeft verbinding niet geforceerd te worden. Eerst zijn erkenning, verantwoordelijkheid, transparantie, tijd en herhaald veiliger gedrag nodig.';

// ═══ MAIN FILTER ═══
export function applyBPGSafetyFilter(
  response: string,
  moduleId: BPGModuleId,
  options?: {
    relationalHarmActive?: boolean;
    safetyActive?: boolean;
  },
): BPGSafetyFilterResult {
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

  // Shared always-on
  check(SHARED_DEMONIZATION, 'demonization');
  check(SHARED_ACQUITTAL, 'acquittal');
  check(SHARED_DECISION_FORCING, 'decision_forcing');
  check(SHARED_DIAGNOSIS, 'diagnosis');

  // Module-specific
  const modulePatterns = moduleId === 'BEDR01' ? BEDR01_PATTERNS :
                         moduleId === 'PAR01' ? PAR01_PATTERNS :
                         GASL01_PATTERNS;
  check(modulePatterns, 'module_specific');

  // Conditional
  if (options?.safetyActive) {
    check(SHARED_SAFETY_CONNECTION, 'safety_connection');
  }
  if (options?.relationalHarmActive) {
    check(SHARED_HARM_MINIMIZATION, 'harm_minimization');
  }

  if (violations.length === 0) {
    return { safe: true, violations, categories, correctedText: null };
  }

  let correctedText: string;
  if (categories.includes('safety_connection')) {
    correctedText = SAFETY_FALLBACK;
  } else if (categories.includes('harm_minimization')) {
    correctedText = HARM_FALLBACK;
  } else {
    correctedText = MODULE_FALLBACKS[moduleId];
  }

  return { safe: false, violations, categories, correctedText };
}

