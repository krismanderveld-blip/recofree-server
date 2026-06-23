/**
 * Crisis Resources — Dynamic emergency numbers per country.
 * Numbers are FIXED and VERIFIED (23-06-2026). Never GPT-generate or modify numbers.
 * 
 * Display order: life-threatening emergency first, then suicide/crisis, then other.
 * 
 * BE exception: suicide prevention number depends on INTERFACE LANGUAGE:
 *   - NL → 1813 (Zelfmoordlijn)
 *   - FR → 0800 32 123 (Centre de Prévention du Suicide)
 *   - All other BE numbers (112, 101, 1712, 1733) are language-independent.
 */

import type { SupportedCountry } from '@/lib/i18n/i18n-provider';

export type CrisisLanguage = 'nl' | 'en' | 'fr';

/** Category determines display order and styling */
export type CrisisCategory =
  | 'LIFE_THREATENING_EMERGENCY'
  | 'URGENT_POLICE'
  | 'SUICIDE_CRISIS_LINE'
  | 'SUICIDE_CRISIS_LINE_FREE_FULL'
  | 'SUICIDE_CRISIS_CHAT'
  | 'VIOLENCE_ABUSE_CHILD_ABUSE'
  | 'DOMESTIC_VIOLENCE_CHILD_ABUSE'
  | 'OUT_OF_HOURS_GP'
  | 'URGENT_MENTAL_HEALTH_NON_LIFE_THREATENING'
  | 'SAMARITANS'
  | 'CRISIS_TEXT_LINE'
  | 'MEDICAL_EMERGENCY_SAMU'
  | 'SUICIDE_PREVENTION_LINE'
  | 'SUICIDE_AND_CRISIS_LIFELINE'
  | 'SUICIDE_AND_CRISIS_CHAT';

export interface CrisisNumber {
  category: CrisisCategory;
  number: string;
  /** Whether this is a URL/text rather than a phone number */
  isText?: boolean;
}

export interface CrisisResource {
  name: string;
  number: string;
  description: string;
  category: CrisisCategory;
  isText?: boolean;
}

export interface CrisisContent {
  title: string;
  intro: string;
  dismissText: string;
  resources: CrisisResource[];
}

// ─── VERIFIED NUMBERS PER COUNTRY (23-06-2026) ───────────────────────────────
// DO NOT modify, add, or GPT-generate numbers. Only update from verified sources.

const CRISIS_NUMBERS_BE: CrisisNumber[] = [
  { category: 'LIFE_THREATENING_EMERGENCY', number: '112' },
  { category: 'URGENT_POLICE', number: '101' },
  // Suicide line is language-dependent — handled by getBeSuicideLine()
  { category: 'VIOLENCE_ABUSE_CHILD_ABUSE', number: '1712' },
  { category: 'OUT_OF_HOURS_GP', number: '1733' },
];

const BE_SUICIDE_NL: CrisisNumber = { category: 'SUICIDE_CRISIS_LINE', number: '1813' };
const BE_SUICIDE_FR: CrisisNumber = { category: 'SUICIDE_CRISIS_LINE', number: '0800 32 123' };

const CRISIS_NUMBERS_NL: CrisisNumber[] = [
  { category: 'LIFE_THREATENING_EMERGENCY', number: '112' },
  { category: 'SUICIDE_CRISIS_LINE', number: '113' },
  { category: 'SUICIDE_CRISIS_LINE_FREE_FULL', number: '0800-0113' },
  { category: 'DOMESTIC_VIOLENCE_CHILD_ABUSE', number: '0800-2000' },
];

const CRISIS_NUMBERS_FR: CrisisNumber[] = [
  { category: 'LIFE_THREATENING_EMERGENCY', number: '112' },
  { category: 'MEDICAL_EMERGENCY_SAMU', number: '15' },
  { category: 'SUICIDE_PREVENTION_LINE', number: '3114' },
];

const CRISIS_NUMBERS_UK: CrisisNumber[] = [
  { category: 'LIFE_THREATENING_EMERGENCY', number: '999' },
  { category: 'URGENT_MENTAL_HEALTH_NON_LIFE_THREATENING', number: '111' },
  { category: 'SAMARITANS', number: '116123' },
  { category: 'CRISIS_TEXT_LINE', number: 'SHOUT to 85258', isText: true },
];

const CRISIS_NUMBERS_US: CrisisNumber[] = [
  { category: 'LIFE_THREATENING_EMERGENCY', number: '911' },
  { category: 'SUICIDE_AND_CRISIS_LIFELINE', number: '988' },
  { category: 'SUICIDE_AND_CRISIS_CHAT', number: '988lifeline.org', isText: true },
];

// ─── CATEGORY DISPLAY ORDER ──────────────────────────────────────────────────
const CATEGORY_ORDER: CrisisCategory[] = [
  'LIFE_THREATENING_EMERGENCY',
  'MEDICAL_EMERGENCY_SAMU',
  'URGENT_POLICE',
  'SUICIDE_CRISIS_LINE',
  'SUICIDE_CRISIS_LINE_FREE_FULL',
  'SUICIDE_PREVENTION_LINE',
  'SUICIDE_AND_CRISIS_LIFELINE',
  'SUICIDE_AND_CRISIS_CHAT',
  'SAMARITANS',
  'CRISIS_TEXT_LINE',
  'URGENT_MENTAL_HEALTH_NON_LIFE_THREATENING',
  'VIOLENCE_ABUSE_CHILD_ABUSE',
  'DOMESTIC_VIOLENCE_CHILD_ABUSE',
  'OUT_OF_HOURS_GP',
];

// ─── I18N LABELS PER CATEGORY ────────────────────────────────────────────────
// These are the human-readable labels and descriptions per category per language.

type CategoryLabels = { name: string; description: string };
type LabelMap = Record<CrisisCategory, CategoryLabels>;

const LABELS_NL: LabelMap = {
  LIFE_THREATENING_EMERGENCY: { name: 'Acute nood', description: 'Bij onmiddellijk levensgevaar' },
  URGENT_POLICE: { name: 'Politie', description: 'Dringend, niet-levensbedreigend' },
  SUICIDE_CRISIS_LINE: { name: 'Zelfmoordpreventie', description: '24/7, gratis, anoniem' },
  SUICIDE_CRISIS_LINE_FREE_FULL: { name: 'Zelfmoordpreventie (gratis)', description: '24/7, gratis' },
  SUICIDE_CRISIS_CHAT: { name: 'Zelfmoordpreventie (chat)', description: 'Online chat' },
  VIOLENCE_ABUSE_CHILD_ABUSE: { name: 'Geweld & misbruik', description: 'Gratis en anoniem' },
  DOMESTIC_VIOLENCE_CHILD_ABUSE: { name: 'Huiselijk geweld & kindermishandeling', description: 'Gratis en anoniem' },
  OUT_OF_HOURS_GP: { name: 'Huisarts buiten kantooruren', description: 'Medisch advies' },
  URGENT_MENTAL_HEALTH_NON_LIFE_THREATENING: { name: 'Dringende geestelijke gezondheid', description: 'Niet-levensbedreigend' },
  SAMARITANS: { name: 'Samaritans', description: '24/7, gratis' },
  CRISIS_TEXT_LINE: { name: 'Crisis Text Line', description: 'SMS-hulplijn' },
  MEDICAL_EMERGENCY_SAMU: { name: 'SAMU (medische nood)', description: 'Medische spoedgevallen' },
  SUICIDE_PREVENTION_LINE: { name: 'Zelfmoordpreventie', description: '24/7, gratis' },
  SUICIDE_AND_CRISIS_LIFELINE: { name: 'Suicide & Crisis Lifeline', description: '24/7, gratis' },
  SUICIDE_AND_CRISIS_CHAT: { name: 'Suicide & Crisis Lifeline (chat)', description: 'Online chat' },
};

const LABELS_EN: LabelMap = {
  LIFE_THREATENING_EMERGENCY: { name: 'Emergency', description: 'Life-threatening danger' },
  URGENT_POLICE: { name: 'Police', description: 'Urgent, non-life-threatening' },
  SUICIDE_CRISIS_LINE: { name: 'Suicide Prevention', description: '24/7, free, anonymous' },
  SUICIDE_CRISIS_LINE_FREE_FULL: { name: 'Suicide Prevention (free)', description: '24/7, free' },
  SUICIDE_CRISIS_CHAT: { name: 'Suicide Prevention (chat)', description: 'Online chat' },
  VIOLENCE_ABUSE_CHILD_ABUSE: { name: 'Violence & Abuse', description: 'Free and anonymous' },
  DOMESTIC_VIOLENCE_CHILD_ABUSE: { name: 'Domestic Violence & Child Abuse', description: 'Free and anonymous' },
  OUT_OF_HOURS_GP: { name: 'Out-of-hours GP', description: 'Medical advice' },
  URGENT_MENTAL_HEALTH_NON_LIFE_THREATENING: { name: 'Urgent Mental Health', description: 'Non-life-threatening' },
  SAMARITANS: { name: 'Samaritans', description: '24/7, free' },
  CRISIS_TEXT_LINE: { name: 'Crisis Text Line', description: 'Text SHOUT to 85258' },
  MEDICAL_EMERGENCY_SAMU: { name: 'SAMU (Medical Emergency)', description: 'Medical emergencies' },
  SUICIDE_PREVENTION_LINE: { name: 'Suicide Prevention', description: '24/7, free' },
  SUICIDE_AND_CRISIS_LIFELINE: { name: 'Suicide & Crisis Lifeline', description: '24/7, free' },
  SUICIDE_AND_CRISIS_CHAT: { name: 'Suicide & Crisis Lifeline (chat)', description: 'Online chat' },
};

const LABELS_FR: LabelMap = {
  LIFE_THREATENING_EMERGENCY: { name: 'Urgence vitale', description: 'Danger immédiat' },
  URGENT_POLICE: { name: 'Police', description: 'Urgent, non vital' },
  SUICIDE_CRISIS_LINE: { name: 'Prévention du suicide', description: '24/7, gratuit, anonyme' },
  SUICIDE_CRISIS_LINE_FREE_FULL: { name: 'Prévention du suicide (gratuit)', description: '24/7, gratuit' },
  SUICIDE_CRISIS_CHAT: { name: 'Prévention du suicide (chat)', description: 'Chat en ligne' },
  VIOLENCE_ABUSE_CHILD_ABUSE: { name: 'Violence & maltraitance', description: 'Gratuit et anonyme' },
  DOMESTIC_VIOLENCE_CHILD_ABUSE: { name: 'Violence domestique & maltraitance', description: 'Gratuit et anonyme' },
  OUT_OF_HOURS_GP: { name: 'Médecin de garde', description: 'Conseil médical' },
  URGENT_MENTAL_HEALTH_NON_LIFE_THREATENING: { name: 'Santé mentale urgente', description: 'Non vital' },
  SAMARITANS: { name: 'Samaritans', description: '24/7, gratuit' },
  CRISIS_TEXT_LINE: { name: 'Ligne de crise (SMS)', description: 'Aide par SMS' },
  MEDICAL_EMERGENCY_SAMU: { name: 'SAMU', description: 'Urgences médicales' },
  SUICIDE_PREVENTION_LINE: { name: 'Prévention du suicide', description: '24/7, gratuit' },
  SUICIDE_AND_CRISIS_LIFELINE: { name: 'Suicide & Crisis Lifeline', description: '24/7, gratuit' },
  SUICIDE_AND_CRISIS_CHAT: { name: 'Suicide & Crisis Lifeline (chat)', description: 'Chat en ligne' },
};

function getLabelsForLanguage(lang: CrisisLanguage): LabelMap {
  switch (lang) {
    case 'nl': return LABELS_NL;
    case 'fr': return LABELS_FR;
    case 'en': return LABELS_EN;
    default: return LABELS_NL;
  }
}

// ─── CONTENT STRINGS PER LANGUAGE ────────────────────────────────────────────

interface ContentStrings {
  title: string;
  intro: string;
  dismissText: string;
}

const CONTENT_STRINGS: Record<CrisisLanguage, ContentStrings> = {
  nl: {
    title: 'Je staat er niet alleen voor',
    intro: 'Het klinkt alsof je het nu heel zwaar hebt. Neem contact op met één van deze hulplijnen — ze zijn er voor jou, dag en nacht.',
    dismissText: 'Het gaat nu even',
  },
  en: {
    title: "You're not alone",
    intro: "It sounds like you're going through something really difficult. Please reach out to one of these helplines — they're here for you, day and night.",
    dismissText: "I'm okay for now",
  },
  fr: {
    title: "Vous n'êtes pas seul(e)",
    intro: "Il semble que vous traversez un moment très difficile. Contactez l'une de ces lignes d'aide — elles sont là pour vous, jour et nuit.",
    dismissText: 'Ça va pour le moment',
  },
};

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

/**
 * Get crisis numbers for a given country, with BE language exception.
 * Returns numbers sorted by display order (life-threatening first).
 */
export function getCrisisNumbersForCountry(
  country: SupportedCountry,
  interfaceLanguage: CrisisLanguage,
): CrisisNumber[] {
  let numbers: CrisisNumber[];

  switch (country) {
    case 'BE': {
      // BE suicide line depends on interface language
      const suicideLine = interfaceLanguage === 'fr' ? BE_SUICIDE_FR : BE_SUICIDE_NL;
      // Insert suicide line after police (position 2)
      numbers = [
        CRISIS_NUMBERS_BE[0], // 112
        CRISIS_NUMBERS_BE[1], // 101
        suicideLine,
        CRISIS_NUMBERS_BE[2], // 1712
        CRISIS_NUMBERS_BE[3], // 1733
      ];
      break;
    }
    case 'NL': numbers = [...CRISIS_NUMBERS_NL]; break;
    case 'FR': numbers = [...CRISIS_NUMBERS_FR]; break;
    case 'UK': numbers = [...CRISIS_NUMBERS_UK]; break;
    case 'US': numbers = [...CRISIS_NUMBERS_US]; break;
    default: numbers = [...CRISIS_NUMBERS_BE]; break;
  }

  // Sort by category order
  numbers.sort((a, b) => {
    const aIdx = CATEGORY_ORDER.indexOf(a.category);
    const bIdx = CATEGORY_ORDER.indexOf(b.category);
    return aIdx - bIdx;
  });

  return numbers;
}

/**
 * Get full crisis resources (with labels) for a given country and language.
 */
export function getCrisisResourcesForCountry(
  country: SupportedCountry,
  interfaceLanguage: CrisisLanguage,
): CrisisResource[] {
  const numbers = getCrisisNumbersForCountry(country, interfaceLanguage);
  const labels = getLabelsForLanguage(interfaceLanguage);

  return numbers.map((n) => ({
    name: labels[n.category].name,
    number: n.number,
    description: labels[n.category].description,
    category: n.category,
    isText: n.isText,
  }));
}

/**
 * Get full crisis content (title + intro + resources) for a given country and language.
 */
export function getCrisisContent(
  country: SupportedCountry,
  interfaceLanguage: CrisisLanguage,
): CrisisContent {
  const strings = CONTENT_STRINGS[interfaceLanguage] || CONTENT_STRINGS.nl;
  const resources = getCrisisResourcesForCountry(country, interfaceLanguage);

  return {
    title: strings.title,
    intro: strings.intro,
    dismissText: strings.dismissText,
    resources,
  };
}

/**
 * Get the primary suicide/crisis line number for a country + language.
 * Used for the chat footer and quick-call buttons.
 */
export function getPrimarySuicideLine(
  country: SupportedCountry,
  interfaceLanguage: CrisisLanguage,
): { number: string; name: string } {
  const labels = getLabelsForLanguage(interfaceLanguage);

  switch (country) {
    case 'BE':
      if (interfaceLanguage === 'fr') {
        return { number: '0800 32 123', name: labels.SUICIDE_CRISIS_LINE.name };
      }
      return { number: '1813', name: labels.SUICIDE_CRISIS_LINE.name };
    case 'NL':
      return { number: '113', name: labels.SUICIDE_CRISIS_LINE.name };
    case 'FR':
      return { number: '3114', name: labels.SUICIDE_PREVENTION_LINE.name };
    case 'UK':
      return { number: '116123', name: 'Samaritans' };
    case 'US':
      return { number: '988', name: labels.SUICIDE_AND_CRISIS_LIFELINE.name };
    default:
      return { number: '1813', name: labels.SUICIDE_CRISIS_LINE.name };
  }
}

/**
 * Get the emergency number (life-threatening) for a country.
 */
export function getEmergencyNumber(country: SupportedCountry): string {
  switch (country) {
    case 'UK': return '999';
    case 'US': return '911';
    default: return '112'; // BE, NL, FR all use 112
  }
}

// ─── LEGACY COMPAT ───────────────────────────────────────────────────────────
// Keep detectCrisisLanguage for backward compat with existing code.

const DUTCH_MARKERS = [
  'ik', 'het', 'een', 'dat', 'niet', 'van', 'maar', 'met', 'ook', 'nog',
  'wel', 'ben', 'heb', 'kan', 'wil', 'moet', 'zou', 'als', 'naar', 'voor',
  'wat', 'wie', 'hoe', 'waar', 'wanneer', 'waarom', 'omdat', 'dus', 'toch',
  'mij', 'jij', 'zij', 'hij', 'wij', 'jullie', 'hun', 'haar',
  'hebben', 'zijn', 'worden', 'gaan', 'komen', 'doen', 'zeggen', 'denken', 'voelen',
  'hulp', 'pijn', 'alleen', 'bang', 'moe', 'dood', 'zelfmoord', 'einde',
  'terugval', 'craving', 'gebruik', 'verslaving', 'zucht', 'drinken', 'stoppen',
];

/**
 * @deprecated Use getCrisisContent(country, language) instead.
 */
export function detectCrisisLanguage(lastUserMessage: string | null | undefined): CrisisLanguage {
  if (!lastUserMessage || lastUserMessage.trim().length === 0) return 'nl';
  const words = lastUserMessage.toLowerCase().replace(/[^a-zàáâãäåèéêëìíîïòóôõöùúûüýÿñ\s]/g, '').split(/\s+/);
  let dutchScore = 0;
  for (const word of words) {
    if (DUTCH_MARKERS.includes(word)) dutchScore++;
    if (word.endsWith('heid') || word.endsWith('lijk') || word.endsWith('baar')) dutchScore++;
  }
  const dutchRatio = words.length > 0 ? dutchScore / words.length : 0;
  return (dutchScore >= 2 || dutchRatio >= 0.2) ? 'nl' : 'en';
}

/**
 * @deprecated Use getCrisisContent(country, language) instead.
 */
export function getCrisisContentForMessage(lastUserMessage: string | null | undefined): CrisisContent {
  const lang = detectCrisisLanguage(lastUserMessage);
  // Legacy: always returns BE numbers
  return getCrisisContent('BE', lang);
}
