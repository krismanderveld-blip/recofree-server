/**
 * CDP01 — Runtime Output Safety Filter
 *
 * Prevents Kim from reverting to old diagnostic, polarizing, or labeling language
 * when CDP01 (self-loss / overidentification / rescuing / control / pleasing) is active.
 *
 * 9 forbidden categories with smart fallback replacement per category.
 */

export interface CDP01SafetyFilterResult {
  safe: boolean;
  violations: string[];
  categories: string[];
  correctedText: string | null; // null if safe, replacement text if not
}

// ─── Category 1: Diagnostic labels ───────────────────────────────────────────
const DIAGNOSTIC_LABEL_PATTERNS: RegExp[] = [
  /\bcodependent\b/i,
  /\bcodependency\b/i,
  /\bcodependentie\b/i,
  /\bidentity\s+fusion\b/i,
  /\bboundary\s+absence\b/i,
  /\bongezond\s+gehecht\b/i,
  /\bafhankelijk\s+als\s+identiteit\b/i,
  /\bsymbiose\b/i,
  /\btrauma\s*bond\b/i,
];

// ─── Category 2: Existential self-loss language ──────────────────────────────
const SELF_LOSS_PATTERNS: RegExp[] = [
  /\bje\s+bestaat\s+alleen\s+door\s+de\s+ander\b/i,
  /\bje\s+leeft\s+alleen\s+via\s+de\s+ander\b/i,
  /\bzonder\s+de\s+ander\s+ben\s+je\s+niemand\b/i,
  /\bjouw\s+identiteit\s+hangt\s+volledig\s+aan\s+de\s+ander\b/i,
  /\bje\s+hebt\s+geen\s+eigen\s+leven\s+meer\b/i,
];

// ─── Category 3: Accusatory rescuer language ─────────────────────────────────
const RESCUER_PATTERNS: RegExp[] = [
  /\bjij\s+bent\s+de\s+redder\b/i,
  /\bjij\s+houdt\s+dit\s+in\s+stand\b/i,
  /\bjij\s+laat\s+dit\s+gebeuren\b/i,
  /\bjij\s+maakt\s+het\s+mogelijk\b/i,
  /\bjij\s+laat\s+je\s+gebruiken\b/i,
  /\bjij\s+bent\s+medeverantwoordelijk\b/i,
];

// ─── Category 4: Forcing relationship decisions ──────────────────────────────
const DECISION_PATTERNS: RegExp[] = [
  /\bje\s+moet\s+loskomen\b/i,
  /\bje\s+moet\s+afstand\s+nemen\b/i,
  /\bje\s+moet\s+de\s+ander\s+loslaten\b/i,
  /\bje\s+moet\s+voor\s+jezelf\s+kiezen\s+en\s+weg\b/i,
  /\bje\s+moet\s+stoppen\s+met\s+zorgen\b/i,
  /\bje\s+moet\s+de\s+relatie\s+be[ëe]indigen\b/i,
];

// ─── Category 5: Absolute acquittal ─────────────────────────────────────────
const ACQUITTAL_PATTERNS: RegExp[] = [
  /\bjij\s+hebt\s+niets\s+verkeerd\s+gedaan\b/i,
  /\bdit\s+ligt\s+volledig\s+bij\s+de\s+ander\b/i,
  /\bjij\s+hoeft\s+nergens\s+naar\s+te\s+kijken\b/i,
  /\bjij\s+bent\s+alleen\s+slachtoffer\b/i,
  /\balles\s+wat\s+jij\s+doet\s+komt\s+door\s+de\s+ander\b/i,
];

// ─── Category 6: Making love suspect ────────────────────────────────────────
const LOVE_SUSPECT_PATTERNS: RegExp[] = [
  /\bdit\s+is\s+geen\s+liefde\s+meer\b/i,
  /\bdit\s+is\s+alleen\s+afhankelijkheid\b/i,
  /\bjouw\s+liefde\s+houdt\s+het\s+probleem\s+in\s+stand\b/i,
  /\bje\s+verwart\s+liefde\s+met\s+controle\b/i,
  /\bje\s+liefde\s+is\s+ongezond\b/i,
];

// ─── Category 7: Demonizing control ─────────────────────────────────────────
const CONTROL_DEMONIZE_PATTERNS: RegExp[] = [
  /\bje\s+bent\s+controlerend\b/i,
  /\bcontrole\s+is\s+fout\b/i,
  /\bstop\s+met\s+controleren\b/i,
  /\bje\s+moet\s+de\s+controle\s+loslaten\s+en\s+klaar\b/i,
  /\bdat\s+is\s+niet\s+jouw\s+probleem\b/i,
];

// ─── Category 8: Forcing connection at safety ────────────────────────────────
const SAFETY_CONNECTION_PATTERNS: RegExp[] = [
  /\bhoud\s+de\s+brug\s+open\b/i,
  /\bprobeer\s+toch\s+contact\s+te\s+houden\b/i,
  /\bblijf\s+beschikbaar\b/i,
  /\blaat\s+weten\s+dat\s+je\s+er\s+bent\b/i,
  /\bzoek\s+verbinding\b/i,
];

// ─── Category 9: Harm minimization at RELATIONAL_HARM_PATTERN ────────────────
const HARM_MINIMIZATION_PATTERNS: RegExp[] = [
  /\bkijk\s+ook\s+naar\s+de\s+kant\s+van\s+de\s+ander\b/i,
  /\bprobeer\s+te\s+begrijpen\s+waarom\b/i,
  /\bmisschien\s+bedoelde\s+de\s+ander\s+het\s+niet\s+zo\b/i,
  /\biedereen\s+maakt\s+fouten\b/i,
  /\bliefde\s+vraagt\s+geduld\b/i,
];

// ─── Fallback messages per category ──────────────────────────────────────────
const FALLBACKS: Record<string, string> = {
  diagnostic_label: 'Het lijkt erop dat je aandacht zo sterk naar de ander gaat dat jouw eigen ruimte kleiner wordt.',
  self_loss: 'Het lijkt erop dat je aandacht zo sterk naar de ander gaat dat jouw eigen ruimte kleiner wordt.',
  rescuer: 'Het lijkt alsof je veel probeert te dragen. Dat zegt iets over je zorg, maar het hoeft niet allemaal van jou te worden.',
  decision_forcing: 'De vraag is niet meteen of je moet blijven of weggaan, maar welke grens jouw eigen regie beschermt zonder jezelf of de ander te veroordelen.',
  acquittal: 'Je bent niet verantwoordelijk voor het herstel of gedrag van de ander. Tegelijk mag je mild kijken naar jouw eigen reactie en wat jij anders nodig hebt.',
  love_suspect: 'Dat je liefhebt is niet fout. De vraag is of er nog genoeg ruimte blijft voor jou binnen die liefde.',
  control_demonize: 'Controle lijkt hier eerder een poging om veiligheid te voelen. De vraag is welke duidelijkheid je nodig hebt zonder alles te moeten bewaken.',
  safety_connection: 'Nu gaat veiligheid voor verbinding. Zoek steun en kies de veiligste stap.',
  harm_minimization: 'Bij herhaalde schade hoeft verbinding niet geforceerd te worden. Eerst zijn erkenning, verantwoordelijkheid, transparantie, tijd en herhaald veiliger gedrag nodig.',
};

/**
 * Apply the CDP01 safety filter to Kim's output.
 * Returns the first matching category's fallback as correctedText.
 */
export function applyCDP01SafetyFilter(
  response: string,
  options?: {
    relationalHarmActive?: boolean;
    safetyActive?: boolean;
  },
): CDP01SafetyFilterResult {
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

  // Always-on categories
  check(DIAGNOSTIC_LABEL_PATTERNS, 'diagnostic_label');
  check(SELF_LOSS_PATTERNS, 'self_loss');
  check(RESCUER_PATTERNS, 'rescuer');
  check(DECISION_PATTERNS, 'decision_forcing');
  check(ACQUITTAL_PATTERNS, 'acquittal');
  check(LOVE_SUSPECT_PATTERNS, 'love_suspect');
  check(CONTROL_DEMONIZE_PATTERNS, 'control_demonize');

  // Conditional categories
  if (options?.safetyActive) {
    check(SAFETY_CONNECTION_PATTERNS, 'safety_connection');
  }
  if (options?.relationalHarmActive) {
    check(HARM_MINIMIZATION_PATTERNS, 'harm_minimization');
  }

  if (violations.length === 0) {
    return { safe: true, violations, categories, correctedText: null };
  }

  // Use the first detected category's fallback
  const primaryCategory = categories[0];
  const correctedText = FALLBACKS[primaryCategory] ?? FALLBACKS['diagnostic_label'];

  return { safe: false, violations, categories, correctedText };
}
