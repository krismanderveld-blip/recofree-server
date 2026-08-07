/**
 * PAAL-K01 / BEHE-K01 / AANP-K01 — Runtime Output Safety Filter
 *
 * Prevents Kim from reverting to old polarizing, demonizing, or decision-forcing
 * language when these modules are active.
 *
 * Shared rules + module-specific forbidden patterns + conditional rules.
 */

export type PBAModuleId = 'PAAL-K01' | 'BEHE-K01' | 'AANP-K01';

export interface PBASafetyFilterResult {
  safe: boolean;
  violations: string[];
  categories: string[];
  correctedText: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED PATTERNS (apply to all three modules)
// ═══════════════════════════════════════════════════════════════════════════════

// Demonization of the person with addiction
const SHARED_DEMONIZATION: RegExp[] = [
  /\bde\s+ander\s+is\s+het\s+probleem\b/i,
  /\bde\s+ander\s+manipuleert\s+(?:je|jou)\b/i,
  /\bde\s+ander\s+gebruikt\s+(?:je|jou)\b/i,
  /\bde\s+ander\s+maakt\s+(?:je|jou)\s+kapot\b/i,
];

// Absolute acquittal
const SHARED_ACQUITTAL: RegExp[] = [
  /\bjij\s+hebt\s+niets\s+verkeerd\s+gedaan\b/i,
  /\bjij\s+bent\s+(?:alleen|volledig)\s+slachtoffer\b/i,
  /\bdit\s+ligt\s+helemaal\s+niet\s+bij\s+jou\b/i,
];

// Forcing relationship decisions
const SHARED_DECISION_FORCING: RegExp[] = [
  /\bje\s+moet\s+weggaan\b/i,
  /\bje\s+moet\s+de\s+relatie\s+be[ëe]indigen\b/i,
  /\bje\s+moet\s+kiezen\b/i,
];

// Diagnosis
const SHARED_DIAGNOSIS: RegExp[] = [
  /\bcodependent\b/i,
  /\btrauma\s*bond\b/i,
  /\bje\s+hebt\s+(?:een\s+)?(?:depressie|angststoornis|ptss)\b/i,
];

// Safety connection forcing (only when safety active)
const SHARED_SAFETY_CONNECTION: RegExp[] = [
  /\bhoud\s+de\s+brug\s+open\b/i,
  /\bprobeer\s+toch\s+contact\s+te\s+houden\b/i,
  /\bblijf\s+beschikbaar\b/i,
  /\blaat\s+weten\s+dat\s+je\s+er\s+bent\b/i,
  /\bzoek\s+verbinding\b/i,
];

// Harm minimization (only when RELATIONAL_HARM_PATTERN active)
const SHARED_HARM_MINIMIZATION: RegExp[] = [
  /\bkijk\s+ook\s+naar\s+de\s+kant\s+van\s+de\s+ander\b/i,
  /\bprobeer\s+te\s+begrijpen\s+waarom\b/i,
  /\bmisschien\s+bedoelde\s+de\s+ander\s+het\s+niet\s+zo\b/i,
  /\biedereen\s+maakt\s+fouten\b/i,
  /\bliefde\s+vraagt\s+geduld\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════════
// PAAL-K01 SPECIFIC PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════
const PAAL_PATTERNS: RegExp[] = [
  /\bzoek\s+steun\s+zodat\s+je\s+de\s+ander\s+minder\s+nodig\s+hebt\b/i,
  /\bvervang\s+de\s+ander\s+door\s+andere\s+mensen\b/i,
  /\bje\s+moet\s+onafhankelijk\s+worden\s+van\s+de\s+ander\b/i,
  /\bje\s+moet\s+alleen\s+op\s+jezelf\s+rekenen\b/i,
  /\blaat\s+de\s+ander\s+los\b/i,
  /\bde\s+ander\s+kan\s+jouw\s+steun\s+niet\s+zijn\b/i,
  /\bricht\s+je\s+niet\s+meer\s+op\s+de\s+ander\b/i,
  /\bbouw\s+je\s+leven\s+zonder\s+de\s+ander\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════════
// BEHE-K01 SPECIFIC PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════
const BEHE_PATTERNS: RegExp[] = [
  /\bje\s+bent\s+controlerend\b/i,
  /\bcontrole\s+is\s+fout\b/i,
  /\bstop\s+met\s+controleren\b/i,
  /\blaat\s+de\s+ander\s+gewoon\s+los\b/i,
  /\bdat\s+is\s+niet\s+jouw\s+probleem\b/i,
  /\bje\s+moet\s+de\s+controle\s+loslaten\s+en\s+klaar\b/i,
  /\bde\s+ander\s+moet\s+jou\s+zekerheid\s+geven\b/i,
  /\bjij\s+moet\s+weten\s+wat\s+de\s+ander\s+doet\b/i,
  /\bcontroleren\s+is\s+logisch,?\s+blijf\s+dat\s+doen\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════════
// AANP-K01 SPECIFIC PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════
const AANP_PATTERNS: RegExp[] = [
  /\bstop\s+met\s+aanpassen\b/i,
  /\bje\s+laat\s+over\s+je\s+heen\s+lopen\b/i,
  /\bde\s+ander\s+gebruikt\s+jouw\s+aanpassing\b/i,
  /\bjij\s+moet\s+nu\s+voor\s+jezelf\s+kiezen\b/i,
  /\btrek\s+je\s+grens\s+en\s+klaar\b/i,
  /\bafstand\s+nemen\s+is\s+beter\b/i,
  /\bjij\s+wist\s+jezelf\s+volledig\s+uit\b/i,
  /\bje\s+moet\s+harder\s+worden\b/i,
  /\bje\s+moet\s+minder\s+rekening\s+houden\s+met\s+de\s+ander\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACKS
// ═══════════════════════════════════════════════════════════════════════════════
const MODULE_FALLBACKS: Record<PBAModuleId, string> = {
  'PAAL-K01': 'Meer steun zoeken betekent niet dat je de ander vervangt of afschrijft. Het kan juist helpen om minder alleen te dragen en rustiger in contact te blijven.',
  'BEHE-K01': 'Controle lijkt hier vooral een poging om veiligheid te voelen. De vraag is welke duidelijkheid of afspraak je nodig hebt zonder alles te moeten bewaken.',
  'AANP-K01': 'Aanpassen kan liefdevol zijn, maar niet als jij telkens verdwijnt. Je mag rekening houden met de ander én jezelf meenemen.',
};

const SAFETY_FALLBACK = 'Nu gaat veiligheid voor verbinding. Kies de veiligste stap en zoek steun.';
const HARM_FALLBACK = 'Bij herhaalde schade hoeft verbinding niet geforceerd te worden. Eerst zijn erkenning, verantwoordelijkheid, transparantie, tijd en herhaald veiliger gedrag nodig.';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FILTER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════
export function applyPBASafetyFilter(
  response: string,
  moduleId: PBAModuleId,
  options?: {
    relationalHarmActive?: boolean;
    safetyActive?: boolean;
  },
): PBASafetyFilterResult {
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

  // Module-specific always-on
  const modulePatterns = moduleId === 'PAAL-K01' ? PAAL_PATTERNS :
                         moduleId === 'BEHE-K01' ? BEHE_PATTERNS :
                         AANP_PATTERNS;
  check(modulePatterns, 'module_specific');

  // Conditional: safety connection forcing
  if (options?.safetyActive) {
    check(SHARED_SAFETY_CONNECTION, 'safety_connection');
  }

  // Conditional: harm minimization
  if (options?.relationalHarmActive) {
    check(SHARED_HARM_MINIMIZATION, 'harm_minimization');
  }

  if (violations.length === 0) {
    return { safe: true, violations, categories, correctedText: null };
  }

  // Determine fallback priority: safety > harm > module-specific
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
