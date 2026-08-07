/**
 * Combined Runtime Safety Filter for KST01, FIN01, ISO01
 *
 * Blocks relational replacement framing, parasitic labeling, isolation causation,
 * and shared forbidden patterns (demonization, acquittal, diagnosis, decision forcing).
 */

export type KFIModuleId = 'KST01' | 'FIN01' | 'ISO01';

export interface KFISafetyFilterResult {
  safe: boolean;
  violations: string[];
  categories: string[];
  correctedText: string | null;
}

// ═══ SHARED PATTERNS ═══
const DEMONIZATION: RegExp[] = [
  /\bde\s+ander\s+is\s+het\s+probleem\b/i,
  /\bde\s+ander\s+heeft\s+jou\s+kapotgemaakt\b/i,
  /\bde\s+ander\s+respecteert\s+jou\s+niet\b/i,
];
const ACQUITTAL: RegExp[] = [
  /\bjij\s+hebt\s+niets\s+verkeerd\s+gedaan\b/i,
  /\bjij\s+bent\s+(?:alleen|volledig)\s+slachtoffer\b/i,
];
const DIAGNOSIS: RegExp[] = [
  /\b(?:hij|zij|de\s+ander)\s+is\s+(?:een\s+)?(?:narcist|misbruiker)\b/i,
];
const DECISION_FORCING: RegExp[] = [
  /\bje\s+moet\s+weggaan\b/i,
  /\bje\s+moet\s+vertrekken\b/i,
  /\bmaak\s+een\s+keuze\b/i,
];
const SAFETY_CONNECTION: RegExp[] = [
  /\bhoud\s+de\s+brug\s+open\b/i,
  /\bblijf\s+beschikbaar\b/i,
  /\bzoek\s+verbinding\b/i,
];
const HARM_MINIMIZATION: RegExp[] = [
  /\bkijk\s+ook\s+naar\s+de\s+kant\s+van\s+de\s+ander\b/i,
  /\bmisschien\s+bedoelde\s+de\s+ander\s+het\s+niet\s+zo\b/i,
  /\biedereen\s+maakt\s+fouten\b/i,
];

// ═══ KST01-SPECIFIC ═══
const KST01_PATTERNS: RegExp[] = [
  /\bvervang\s+de\s+ander\s+(?:door|met)\s+steunfiguren\b/i,
  /\bzoek\s+steun\s+zodat\s+je\s+de\s+ander\s+minder\s+nodig\s+hebt\b/i,
  /\bmaak\s+jezelf\s+onafhankelijk\s+van\s+de\s+ander\b/i,
  /\blaat\s+de\s+ander\s+los\b/i,
  /\bbouw\s+je\s+leven\s+zonder\s+de\s+ander\b/i,
  /\bde\s+ander\s+kan\s+jouw\s+steun\s+niet\s+zijn\b/i,
  /\bricht\s+je\s+niet\s+meer\s+op\s+de\s+ander\b/i,
  /\bje\s+moet\s+alleen\s+op\s+jezelf\s+rekenen\b/i,
];

// ═══ FIN01-SPECIFIC ═══
const FIN01_PATTERNS: RegExp[] = [
  /\bde\s+ander\s+gebruikt\s+je\s+financieel\b/i,
  /\bde\s+ander\s+is\s+parasitair\b/i,
  /\bjij\s+betaalt\s+voor\s+(?:zijn|haar)\s+probleem\b/i,
  /\bstop\s+met\s+(?:alles\s+te\s+)?betalen\b/i,
  /\blaat\s+de\s+ander\s+(?:maar\s+)?vallen\b/i,
  /\bdit\s+is\s+niet\s+jouw\s+probleem\b/i,
  /\bje\s+moet\s+de\s+geldkraan\s+dichtdraaien\b/i,
  /\b(?:hij|zij)\s+profiteert\s+van\s+jou\b/i,
  /\bjij\s+sponsort\s+de\s+verslaving\b/i,
  /\bgeef\s+nooit\s+(?:nog|meer)\s+geld\b/i,
];

// ═══ ISO01-SPECIFIC ═══
const ISO01_PATTERNS: RegExp[] = [
  /\bde\s+relatie\s+is\s+de\s+oorzaak\s+van\s+je\s+isolatie\b/i,
  /\bzoek\s+mensen\s+buiten\s+de\s+relatie\s+in\s+plaats\s+van\s+de\s+ander\b/i,
  /\btrek\s+je\s+terug\b/i,
  /\blaat\s+de\s+ander\s+los\b/i,
  /\bje\s+moet\s+dit\s+buiten\s+de\s+relatie\s+zoeken\b/i,
  /\bde\s+ander\s+maakt\s+je\s+ge[ïi]soleerd\b/i,
  /\bje\s+bent\s+alleen\s+door\s+de\s+ander\b/i,
  /\bbouw\s+je\s+netwerk\s+zodat\s+je\s+weg\s+kan\b/i,
];

// ═══ FALLBACKS ═══
const FALLBACK_KST01 = 'Meer steun zoeken betekent niet dat je de ander vervangt of afschrijft. Het kan juist helpen om minder alleen te dragen en rustiger in contact te blijven.';
const FALLBACK_FIN01 = 'Financiële grenzen mogen helder zijn zonder hard of vernederend te worden. Je mag helpen zonder alles over te nemen, en afspraken maken die jouw veiligheid en eigen regie beschermen.';
const FALLBACK_ISO01 = 'Isolatie kan op meerdere lagen zitten: sociaal, emotioneel of binnen het contact zelf. Steun buiten de relatie kan helpen om minder alleen te dragen, zonder dat je de ander automatisch hoeft af te schrijven.';
const FALLBACK_HARM = 'Bij herhaalde schade komt verbinding pas na herstelvoorwaarden: erkenning, verantwoordelijkheid, transparantie, tijd, grenzen en herhaald veiliger gedrag.';
const FALLBACK_SAFETY = 'Nu gaat veiligheid voor verbinding. Kies de veiligste stap en zoek steun.';

// ═══ MAIN FILTER ═══
export function applyKFISafetyFilter(
  response: string,
  moduleId: KFIModuleId,
  options?: {
    relationalHarmActive?: boolean;
    safetyActive?: boolean;
  },
): KFISafetyFilterResult {
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
  check(DEMONIZATION, 'demonization');
  check(ACQUITTAL, 'acquittal');
  check(DIAGNOSIS, 'diagnosis');
  check(DECISION_FORCING, 'decision_forcing');

  // Module-specific
  if (moduleId === 'KST01') check(KST01_PATTERNS, 'module_specific');
  if (moduleId === 'FIN01') check(FIN01_PATTERNS, 'module_specific');
  if (moduleId === 'ISO01') check(ISO01_PATTERNS, 'module_specific');

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

  // Fallback priority: safety > harm > module-specific > generic
  let correctedText: string;
  if (categories.includes('safety_connection')) {
    correctedText = FALLBACK_SAFETY;
  } else if (categories.includes('harm_minimization')) {
    correctedText = FALLBACK_HARM;
  } else if (categories.includes('module_specific')) {
    if (moduleId === 'KST01') correctedText = FALLBACK_KST01;
    else if (moduleId === 'FIN01') correctedText = FALLBACK_FIN01;
    else correctedText = FALLBACK_ISO01;
  } else {
    // Generic shared violation
    if (moduleId === 'KST01') correctedText = FALLBACK_KST01;
    else if (moduleId === 'FIN01') correctedText = FALLBACK_FIN01;
    else correctedText = FALLBACK_ISO01;
  }

  return { safe: false, violations, categories, correctedText };
}
