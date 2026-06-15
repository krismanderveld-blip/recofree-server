/**
 * STOA-K — Output Safety Filter
 * Rejects output containing:
 * - Emotional suppression language
 * - Relationship pressure (push stay/leave)
 * - Boundary undermining
 * - Control advice about the loved one
 * - Diagnosis / legal advice
 * - Unauthorized crisis numbers (only 0800 32 123, 1712, 112, 101 allowed)
 *
 * Returns safe fallback text when violations detected.
 */

const ALLOWED_NUMBERS: string[] = ['0800 32 123', '1712', '112', '101'];

// ─── Forbidden Patterns ──────────────────────────────────────────────────────

const EMOTIONAL_SUPPRESSION_PATTERNS: RegExp[] = [
  /je moet je gevoelens onderdrukken/i,
  /onderdruk je gevoelens/i,
  /laat het je niet raken/i,
  /het moet je niets kunnen schelen/i,
  /gewoon accepteren/i,
  /alles gebeurt met een reden/i,
  /dit is jouw lot/i,
  /als je echt stoicijns bent/i,
  /je moet je emoties wegduwen/i,
  /voel niets/i,
  /je mag niet voelen/i,
  /gevoelens zijn zwakte/i,
  /je bent te emotioneel/i,
  /wees niet zo gevoelig/i,
  /stop met voelen/i,
];

const RELATIONSHIP_PRESSURE_PATTERNS: RegExp[] = [
  /je moet blijven/i,
  /je moet weggaan/i,
  /je moet vertrekken/i,
  /je moet bij (?:hem|haar) blijven/i,
  /je moet (?:hem|haar) verlaten/i,
  /als je echt van (?:hem|haar) houdt/i,
  /als je echt houdt van/i,
];

const BOUNDARY_UNDERMINING_PATTERNS: RegExp[] = [
  /je moet geen grenzen stellen/i,
  /aanvaard geweld/i,
  /verdraag misbruik/i,
  /laat (?:hem|haar) gewoon doen/i,
  /je moet het accepteren/i,
  /je hebt geen recht op grenzen/i,
  /grenzen zijn ego[ïi]stisch/i,
];

const CONTROL_ADVICE_PATTERNS: RegExp[] = [
  /controleer (?:hem|haar)/i,
  /red (?:hem|haar)/i,
  /je moet (?:hem|haar) redden/i,
  /je moet (?:hem|haar) genezen/i,
  /neem (?:zijn|haar) herstel over/i,
  /dwing (?:hem|haar)/i,
  /stuur (?:zijn|haar) keuzes/i,
];

const DIAGNOSIS_LEGAL_PATTERNS: RegExp[] = [
  /jij bent codependent/i,
  /jij bent afhankelijk/i,
  /(?:je hebt|u heeft) (?:een )?(?:stoornis|aandoening|diagnose)/i,
  /diagnose/i,
  /juridisch gezien/i,
  /je hebt recht op/i,
  /wettelijk gezien/i,
  /raadpleeg een advocaat/i,
];

const ALL_FORBIDDEN_PATTERNS: RegExp[] = [
  ...EMOTIONAL_SUPPRESSION_PATTERNS,
  ...RELATIONSHIP_PRESSURE_PATTERNS,
  ...BOUNDARY_UNDERMINING_PATTERNS,
  ...CONTROL_ADVICE_PATTERNS,
  ...DIAGNOSIS_LEGAL_PATTERNS,
];

// ─── Phone Number Detection ──────────────────────────────────────────────────

const PHONE_NUMBER_PATTERN = /\b(?:\+?\d[\d\s\-]{2,14}\d)\b/g;

// ─── Fallback Text ───────────────────────────────────────────────────────────

const STOA_K_FALLBACK = 'Dat je controle zoekt, is begrijpelijk als je lang naast onvoorspelbaarheid hebt gestaan. Alleen zijn keuzes en herstel liggen niet volledig in jouw handen; jouw grens, veiligheid, toon en waarden wel. Welke kleine handeling past vandaag bij wie jij wil zijn, zonder dat je zijn of haar herstel probeert over te nemen?';

// ─── Safety Filter ───────────────────────────────────────────────────────────

export interface KimStoaKSafetyFilterResult {
  safe: boolean;
  output: string;
  violations: string[];
}

export function enforceKimStoaKOutputSafety(text: string): KimStoaKSafetyFilterResult {
  const violations: string[] = [];

  // Check forbidden patterns
  for (const pattern of ALL_FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(pattern.source);
    }
  }

  if (violations.length > 0) {
    return {
      safe: false,
      output: STOA_K_FALLBACK,
      violations,
    };
  }

  // Check unauthorized phone numbers
  const foundNumbers = text.match(PHONE_NUMBER_PATTERN) || [];
  for (const num of foundNumbers) {
    const normalized = num.replace(/[\s\-]/g, '');
    const isAllowed = ALLOWED_NUMBERS.some(allowed => {
      const normalizedAllowed = allowed.replace(/[\s\-]/g, '');
      return normalized === normalizedAllowed || normalized.endsWith(normalizedAllowed);
    });
    if (!isAllowed) {
      violations.push(`unauthorized_number:${num}`);
    }
  }

  if (violations.length > 0) {
    return {
      safe: false,
      output: STOA_K_FALLBACK,
      violations,
    };
  }

  return {
    safe: true,
    output: text,
    violations: [],
  };
}
