/**
 * Crisis Resources — Belgian helplines with NL/EN language support.
 * Numbers are always Belgian. Only text changes with language.
 */

export type CrisisLanguage = 'nl' | 'en';

export interface CrisisResource {
  name: string;
  number: string;
  description: string;
}

export interface CrisisContent {
  title: string;
  intro: string;
  dismissText: string;
  callButtonText: string;
  smsButtonText: string;
  callConfirmTitle: string;
  callConfirmMessage: string;
  confirmButton: string;
  cancelButton: string;
  resources: CrisisResource[];
}

const RESOURCES_NL: CrisisResource[] = [
  {
    name: 'Zelfmoordlijn',
    number: '1813',
    description: 'Bel 1813, 24/7 gratis anoniem',
  },
  {
    name: 'Centrum Geestelijke Gezondheidszorg',
    number: '107',
    description: 'Bel 107, 24/7 gratis voor iedereen',
  },
  {
    name: 'Noodnummer',
    number: '112',
    description: 'Bel 112, bij onmiddellijk gevaar',
  },
  {
    name: 'Huiselijk geweld',
    number: '1712',
    description: 'Bel 1712, gratis en anoniem',
  },
];

const RESOURCES_EN: CrisisResource[] = [
  {
    name: 'Suicide Prevention Line',
    number: '1813',
    description: 'Call 1813, 24/7 free anonymous',
  },
  {
    name: 'Mental Health Centre',
    number: '107',
    description: 'Call 107, 24/7 free for everyone',
  },
  {
    name: 'Emergency',
    number: '112',
    description: 'Call 112, immediate danger',
  },
  {
    name: 'Domestic Violence',
    number: '1712',
    description: 'Call 1712, free and anonymous',
  },
];

const CONTENT_NL: CrisisContent = {
  title: 'Je staat er niet alleen voor',
  intro: 'Het klinkt alsof je het nu heel zwaar hebt. Neem contact op met één van deze hulplijnen — ze zijn er voor jou, dag en nacht.',
  dismissText: 'Het gaat nu even',
  callButtonText: 'Bel 1813',
  smsButtonText: 'Chat via zelfmoord1813.be',
  callConfirmTitle: 'Wil je 1813 bellen?',
  callConfirmMessage: 'Je wordt doorverbonden met de Zelfmoordlijn (24/7, gratis, anoniem).',
  confirmButton: 'Bevestig',
  cancelButton: 'Annuleer',
  resources: RESOURCES_NL,
};

const CONTENT_EN: CrisisContent = {
  title: "You're not alone",
  intro: "It sounds like you're going through something really difficult. Please reach out to one of these helplines — they're here for you, day and night.",
  dismissText: "I'm okay for now",
  callButtonText: 'Call 1813',
  smsButtonText: 'Chat via zelfmoord1813.be',
  callConfirmTitle: 'Do you want to call 1813?',
  callConfirmMessage: 'You will be connected to the Suicide Prevention Line (24/7, free, anonymous).',
  confirmButton: 'Confirm',
  cancelButton: 'Cancel',
  resources: RESOURCES_EN,
};

/**
 * Common Dutch words/patterns for language detection.
 * We check the last user message for these markers.
 */
const DUTCH_MARKERS = [
  // Common words
  'ik', 'het', 'een', 'dat', 'niet', 'van', 'maar', 'met', 'ook', 'nog',
  'wel', 'ben', 'heb', 'kan', 'wil', 'moet', 'zou', 'als', 'naar', 'voor',
  'wat', 'wie', 'hoe', 'waar', 'wanneer', 'waarom', 'omdat', 'dus', 'toch',
  // Pronouns
  'mij', 'jij', 'zij', 'hij', 'wij', 'jullie', 'hun', 'haar',
  // Verbs
  'hebben', 'zijn', 'worden', 'gaan', 'komen', 'doen', 'zeggen', 'denken', 'voelen',
  // Crisis-related
  'hulp', 'pijn', 'alleen', 'bang', 'moe', 'dood', 'zelfmoord', 'einde',
  // Addiction-related
  'terugval', 'craving', 'gebruik', 'verslaving', 'zucht', 'drinken', 'stoppen',
  // Common endings
  'heid', 'lijk', 'baar',
];

/**
 * Detect language from the last user message in conversation history.
 * Returns 'nl' if Dutch is detected, 'en' otherwise.
 * Default (no messages / empty) = 'nl'.
 */
export function detectCrisisLanguage(lastUserMessage: string | null | undefined): CrisisLanguage {
  if (!lastUserMessage || lastUserMessage.trim().length === 0) return 'nl';

  const words = lastUserMessage.toLowerCase().replace(/[^a-zàáâãäåèéêëìíîïòóôõöùúûüýÿñ\s]/g, '').split(/\s+/);
  let dutchScore = 0;

  for (const word of words) {
    if (DUTCH_MARKERS.includes(word)) {
      dutchScore++;
    }
    // Check Dutch suffixes
    if (word.endsWith('heid') || word.endsWith('lijk') || word.endsWith('baar') || word.endsWith('tion') === false && word.endsWith('tie')) {
      dutchScore++;
    }
  }

  // If at least 2 Dutch markers found, or ratio > 20% of words, it's Dutch
  const dutchRatio = words.length > 0 ? dutchScore / words.length : 0;
  return (dutchScore >= 2 || dutchRatio >= 0.2) ? 'nl' : 'en';
}

/**
 * Get crisis content based on detected language.
 */
export function getCrisisContent(language: CrisisLanguage): CrisisContent {
  return language === 'nl' ? CONTENT_NL : CONTENT_EN;
}

/**
 * Get crisis content based on the last user message.
 * Convenience function combining detection + content retrieval.
 */
export function getCrisisContentForMessage(lastUserMessage: string | null | undefined): CrisisContent {
  const lang = detectCrisisLanguage(lastUserMessage);
  return getCrisisContent(lang);
}
