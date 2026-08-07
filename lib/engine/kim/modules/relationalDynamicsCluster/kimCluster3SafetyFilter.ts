/**
 * Kim Cluster 3 — Output Safety Filter
 * Rejects unsafe output: control advice, detective behavior, diagnosis, legal advice, unauthorized numbers.
 */

import type {
  KimCluster3ModuleId,
  KimCluster3ResponseMode,
  FixedBelgianCrisisNumber,
  ALLOWED_CRISIS_NUMBERS,
} from './kimCluster3.types';

const ALLOWED_NUMBERS: string[] = ['1813', '1712', '112', '101'];

const FORBIDDEN_PATTERNS: RegExp[] = [
  /controleer (?:zijn|haar) telefoon/i,
  /(?:zijn|haar) telefoon controleren/i,
  /telefoon (?:controleren|checken|nakijken)/i,
  /volg (?:hem|haar)/i,
  /test (?:hem|haar)/i,
  /lok (?:hem|haar) in de val/i,
  /verzamel bewijs/i,
  /je moet (?:hem|haar) betrappen/i,
  /jij bent ego[ïi]stisch/i,
  /je mag niet boos zijn/i,
  /je moet je emoties parkeren/i,
  /je moet gewoon ontspannen/i,
  /er is niets aan de hand/i,
  /je overdrijft/i,
  /je bent getraumatiseerd/i,
  /(?:hij|zij) is (?:een )?pathologische leugenaar/i,
  /je moet (?:hem|haar) verlaten/i,
  /je moet vergeven/i,
  /juridisch gezien/i,
  /je hebt recht op/i,
  /dit is jouw verantwoordelijkheid/i,
  /jij moet (?:hem|haar) redden/i,
];

const PHONE_NUMBER_PATTERN = /\b(?:\+?\d[\d\s\-]{5,14}\d)\b/g;

const FALLBACK_MESSAGES: Record<KimCluster3ModuleId, string> = {
  'ROL-K01': 'Wat nu bovenkomt, mag bestaan zonder dat je er meteen schuld of een beslissing aan moet koppelen. Je hebt lang gedragen; het is logisch dat je eigen gevoel pas ruimte krijgt wanneer de zorgrol even wegvalt. We kunnen eerst benoemen wat van jou is.',
  'VETR02-K': 'De stilte kan onveilig voelen als je lang hebt moeten scannen op gevaar. We hoeven dat niet weg te redeneren; we maken eerst verschil tussen wat er nu concreet is en wat je alarm erbij invult. Eerst gronden, dan pas beslissen.',
  'LEUGEN-K01': 'Herhaald liegen doet iets met je vertrouwen en met je zenuwstelsel. Je hoeft geen detective te worden om grenzen te mogen hebben; we kunnen eerst scheiden wat je weet, wat je vermoedt, en wat jij nodig hebt om jezelf niet kwijt te raken.',
};

export function enforceKimCluster3OutputSafety(input: {
  moduleId: KimCluster3ModuleId;
  text: string;
  responseMode: KimCluster3ResponseMode;
  crisisNumbersToShow: FixedBelgianCrisisNumber[];
}): string {
  const { moduleId, text, crisisNumbersToShow } = input;

  // Check forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      return FALLBACK_MESSAGES[moduleId];
    }
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
      return FALLBACK_MESSAGES[moduleId];
    }
  }

  return text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RELATIONAL DYNAMICS SAFETY FILTER — 9 Forbidden Categories
// ═══════════════════════════════════════════════════════════════════════════════

export interface KimCluster3RelationalFilterResult {
  safe: boolean;
  violations: string[];
  categories: string[];
}

// Category 1: Demonizing the person with addiction
const DEMONIZATION_PATTERNS: RegExp[] = [
  /\bde\s+ander\s+manipuleert\s+(?:je|jou)\b/i,
  /\bde\s+ander\s+gebruikt\s+(?:je|jou)\b/i,
  /\bde\s+ander\s+maakt\s+(?:je|jou)\s+kapot\b/i,
  /\bde\s+ander\s+is\s+het\s+probleem\b/i,
  /\bde\s+ander\s+liegt\s+omdat\s+(?:die|hij|zij)\s+(?:je|jou)\s+niet\s+respecteert\b/i,
  /\bje\s+(?:kan|kunt)\s+de\s+ander\s+niet\s+vertrouwen,?\s+punt\b/i,
  /\bdit\s+(?:toont|bewijst)\s+wie\s+de\s+ander\s+(?:echt|werkelijk)\s+is\b/i,
  /\bde\s+ander\s+is\s+onbetrouwbaar\s+als\s+persoon\b/i,
];

// Category 2: Absolutely acquitting the caregiver
const ACQUITTAL_PATTERNS: RegExp[] = [
  /\bjij\s+hebt\s+niets\s+verkeerd\s+gedaan\b/i,
  /\bdit\s+ligt\s+helemaal\s+niet\s+bij\s+jou\b/i,
  /\bjij\s+bent\s+(?:alleen|volledig)\s+slachtoffer\b/i,
  /\bjij\s+hoeft\s+nergens\s+naar\s+te\s+kijken\b/i,
];

// Category 3: Forcing relationship decisions
const DECISION_FORCING_PATTERNS: RegExp[] = [
  /\bje\s+moet\s+weggaan\b/i,
  /\bje\s+moet\s+blijven\b/i,
  /\bje\s+moet\s+loslaten\b/i,
  /\bje\s+moet\s+afstand\s+nemen\b/i,
  /\bje\s+moet\s+de\s+relatie\s+be[ëe]indigen\b/i,
  /\bje\s+moet\s+(?:hem|haar)\s+nog\s+een\s+kans\s+geven\b/i,
];

// Category 4: Forcing trust repair
const TRUST_FORCING_PATTERNS: RegExp[] = [
  /\bje\s+moet\s+(?:leren\s+)?vergeven\b/i,
  /\bvertrouwen\s+moet\s+je\s+opnieuw\s+geven\b/i,
  /\bals\s+je\s+liefhebt\s+moet\s+je\s+opnieuw\s+openstaan\b/i,
  /\bzonder\s+vertrouwen\s+heeft\s+de\s+relatie\s+geen\s+zin\b/i,
  /\bje\s+moet\s+opnieuw\s+vertrouwen\b/i,
  /\bvertrouwen\s+komt\s+vanzelf\s+terug\b/i,
  /\bgeef\s+het\s+tijd\s+en\s+laat\s+het\s+los\b/i,
  /\bvertrouwen\s+is\s+kapot\b/i,
];

// Category 5: Excusing lies
const LIE_EXCUSING_PATTERNS: RegExp[] = [
  /\bliegen\s+komt\s+alleen\s+door\s+schaamte\b/i,
  /\bde\s+ander\s+bedoelde\s+het\s+(?:waarschijnlijk\s+)?niet\s+slecht\b/i,
  /\bje\s+moet\s+(?:de\s+reden\s+)?begrijpen\s+waarom\s+de\s+ander\s+loog\b/i,
  /\bhet\s+is\s+maar\s+een\s+leugen\b/i,
];

// Category 6: Demonizing lies
const LIE_DEMONIZING_PATTERNS: RegExp[] = [
  /\been\s+leugenaar\s+verandert\s+niet\b/i,
  /\bliegen\s+bewijst\s+dat\s+de\s+ander\s+niets\s+om\s+(?:je|jou)\s+geeft\b/i,
  /\bdit\s+toont\s+wie\s+de\s+ander\s+echt\s+is\b/i,
  /\bde\s+ander\s+is\s+onbetrouwbaar\s+als\s+persoon\b/i,
];

// Category 7: Role labels
const ROLE_LABEL_PATTERNS: RegExp[] = [
  /\bjij\s+bent\s+de\s+redder\b/i,
  /\bjij\s+bent\s+de\s+ouder(?:\s+geworden)?\b/i,
  /\bjij\s+bent\s+codependent\b/i,
  /\bjij\s+houdt\s+dit\s+in\s+stand\b/i,
  /\bjij\s+laat\s+dit\s+gebeuren\b/i,
  /\bjij\s+moet\s+stoppen\s+met\s+redden\b/i,
  /\blaat\s+de\s+ander\s+los\b/i,
];

// Category 8: Harm minimization (only when RELATIONAL_HARM_PATTERN active)
const HARM_MINIMIZATION_PATTERNS: RegExp[] = [
  /\bprobeer\s+ook\s+(?:zijn|haar)\s+kant\s+te\s+zien\b/i,
  /\bmisschien\s+was\s+het\s+niet\s+zo\s+bedoeld\b/i,
  /\biedereen\s+maakt\s+fouten\b/i,
  /\bkijk\s+ook\s+naar\s+wat\s+jij\s+hierin\s+doet\b/i,
];

// Category 9: Forcing connection at safety
const SAFETY_CONNECTION_FORCING_PATTERNS: RegExp[] = [
  /\bprobeer\s+toch\s+(?:rustig\s+)?contact\s+te\s+houden\b/i,
  /\bzoek\s+een\s+brug\b/i,
  /\bblijf\s+beschikbaar\b/i,
  /\blaat\s+weten\s+dat\s+je\s+er\s+bent\b/i,
];

// Module-specific patterns
const ROL_K01_SPECIFIC: RegExp[] = [
  /\bjij\s+bent\s+de\s+redder\b/i,
  /\bjij\s+bent\s+de\s+ouder\b/i,
  /\bjij\s+moet\s+stoppen\s+met\s+redden\b/i,
  /\bjij\s+houdt\s+dit\s+in\s+stand\b/i,
  /\blaat\s+de\s+ander\s+los\b/i,
];

const VETR02_K_SPECIFIC: RegExp[] = [
  /\bje\s+moet\s+opnieuw\s+vertrouwen\b/i,
  /\bje\s+moet\s+vergeven\b/i,
  /\bje\s+moet\s+afstand\s+nemen\b/i,
  /\bvertrouwen\s+is\s+kapot\b/i,
  /\bvertrouwen\s+komt\s+vanzelf\s+terug\b/i,
  /\bgeef\s+het\s+tijd\s+en\s+laat\s+het\s+los\b/i,
];

const LEUGEN_K01_SPECIFIC: RegExp[] = [
  /\bde\s+ander\s+liegt\s+omdat\s+(?:die|hij|zij)\s+(?:je|jou)\s+niet\s+respecteert\b/i,
  /\bliegen\s+komt\s+alleen\s+door\s+schaamte\b/i,
  /\bhet\s+is\s+maar\s+een\s+leugen\b/i,
  /\bje\s+moet\s+(?:de\s+reden\s+)?begrijpen\b/i,
  /\been\s+leugenaar\s+verandert\s+niet\b/i,
  /\bdit\s+bewijst\s+wie\s+de\s+ander\s+is\b/i,
];

/**
 * Apply the relational dynamics safety filter to Kim Cluster 3 output.
 * Checks 9 forbidden categories + module-specific patterns.
 * Returns safe=false if any violation is found.
 */
export function applyKimCluster3RelationalFilter(
  response: string,
  moduleId: KimCluster3ModuleId,
  options?: {
    relationalHarmActive?: boolean;
    safetyActive?: boolean;
  },
): KimCluster3RelationalFilterResult {
  const violations: string[] = [];
  const categories: string[] = [];

  // Category 1: Demonization (always blocked)
  for (const p of DEMONIZATION_PATTERNS) {
    if (p.test(response)) {
      violations.push(`demonization: ${p.source}`);
      if (!categories.includes('demonization')) categories.push('demonization');
    }
  }

  // Category 2: Absolute acquittal (always blocked)
  for (const p of ACQUITTAL_PATTERNS) {
    if (p.test(response)) {
      violations.push(`acquittal: ${p.source}`);
      if (!categories.includes('acquittal')) categories.push('acquittal');
    }
  }

  // Category 3: Forcing decisions (always blocked)
  for (const p of DECISION_FORCING_PATTERNS) {
    if (p.test(response)) {
      violations.push(`decision_forcing: ${p.source}`);
      if (!categories.includes('decision_forcing')) categories.push('decision_forcing');
    }
  }

  // Category 4: Forcing trust repair (always blocked)
  for (const p of TRUST_FORCING_PATTERNS) {
    if (p.test(response)) {
      violations.push(`trust_forcing: ${p.source}`);
      if (!categories.includes('trust_forcing')) categories.push('trust_forcing');
    }
  }

  // Category 5: Excusing lies (always blocked)
  for (const p of LIE_EXCUSING_PATTERNS) {
    if (p.test(response)) {
      violations.push(`lie_excusing: ${p.source}`);
      if (!categories.includes('lie_excusing')) categories.push('lie_excusing');
    }
  }

  // Category 6: Demonizing lies (always blocked)
  for (const p of LIE_DEMONIZING_PATTERNS) {
    if (p.test(response)) {
      violations.push(`lie_demonizing: ${p.source}`);
      if (!categories.includes('lie_demonizing')) categories.push('lie_demonizing');
    }
  }

  // Category 7: Role labels (always blocked)
  for (const p of ROLE_LABEL_PATTERNS) {
    if (p.test(response)) {
      violations.push(`role_label: ${p.source}`);
      if (!categories.includes('role_label')) categories.push('role_label');
    }
  }

  // Category 8: Harm minimization (only when RELATIONAL_HARM_PATTERN active)
  if (options?.relationalHarmActive) {
    for (const p of HARM_MINIMIZATION_PATTERNS) {
      if (p.test(response)) {
        violations.push(`harm_minimization: ${p.source}`);
        if (!categories.includes('harm_minimization')) categories.push('harm_minimization');
      }
    }
  }

  // Category 9: Forcing connection at safety (only when safety active)
  if (options?.safetyActive) {
    for (const p of SAFETY_CONNECTION_FORCING_PATTERNS) {
      if (p.test(response)) {
        violations.push(`safety_connection_forcing: ${p.source}`);
        if (!categories.includes('safety_connection_forcing')) categories.push('safety_connection_forcing');
      }
    }
  }

  // Module-specific patterns (always blocked)
  const modulePatterns = moduleId === 'ROL-K01' ? ROL_K01_SPECIFIC :
                         moduleId === 'VETR02-K' ? VETR02_K_SPECIFIC :
                         LEUGEN_K01_SPECIFIC;
  for (const p of modulePatterns) {
    if (p.test(response)) {
      violations.push(`module_specific_${moduleId}: ${p.source}`);
      if (!categories.includes('module_specific')) categories.push('module_specific');
    }
  }

  return {
    safe: violations.length === 0,
    violations,
    categories,
  };
}
