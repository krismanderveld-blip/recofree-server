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
