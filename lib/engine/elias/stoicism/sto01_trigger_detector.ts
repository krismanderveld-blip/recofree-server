/**
 * STO01 Stoicism Integration — Trigger Detector
 *
 * Detects stoic trigger markers from user input.
 * Supports English and Dutch markers.
 *
 * MODULE_ID: STO01
 * PIPELINE POSITION: 5e4 (after SW01)
 */

import type { STO01TriggerMarkers, STO01SafetyFlags } from './sto01_types';

// ─── Rumination Outside Control Markers ─────────────────────────────────────

const RUMINATION_MARKERS_EN: string[] = [
  'i cannot stop thinking about',
  'i keep replaying',
  'why did she',
  'why did he',
  'why did they',
  'i cannot accept that this happened',
  'i need them to understand',
  'if they had acted differently',
  'i keep thinking about what they think',
  'i cannot let it go',
  'it keeps going through my head',
  'i cannot stop worrying about',
];

const RUMINATION_MARKERS_NL: string[] = [
  'ik kan niet stoppen met denken',
  'ik blijf maar piekeren',
  'waarom deed zij',
  'waarom deed hij',
  'waarom deden zij',
  'ik kan niet accepteren dat dit gebeurd is',
  'ik heb nodig dat ze begrijpen',
  'als ze anders hadden gehandeld',
  'ik blijf denken aan wat ze denken',
  'ik kan het niet loslaten',
  'het blijft maar door mijn hoofd gaan',
  'ik kan niet stoppen met me zorgen',
];

// ─── External Cause Fixation Markers ────────────────────────────────────────

const EXTERNAL_CAUSE_MARKERS_EN: string[] = [
  'it is because of them',
  'they made me relapse',
  'they made me drink',
  'they made me use',
  'my partner is the reason',
  'if people treated me normally',
  'i have no choice because they',
  'they keep triggering me',
  'it is their fault',
  'they ruined everything',
  'because of what they did',
];

const EXTERNAL_CAUSE_MARKERS_NL: string[] = [
  'het is hun schuld',
  'zij hebben mij laten hervallen',
  'zij hebben mij laten drinken',
  'zij hebben mij laten gebruiken',
  'mijn partner is de reden',
  'als mensen mij normaal behandelden',
  'ik heb geen keuze omdat zij',
  'ze blijven mij triggeren',
  'het komt door hen',
  'zij hebben alles verpest',
  'door wat zij deden',
];

// ─── Relapse Meaning Search Markers ─────────────────────────────────────────

const RELAPSE_MEANING_MARKERS_EN: string[] = [
  'what does this relapse say about me',
  'what does that mean about me',
  'what does that even say about me',
  'maybe i am just broken',
  'what is the point if i always fall back',
  'i ruined everything again',
  'i do not know how to give this meaning',
  'what does this say about who i am',
  'am i just a failure',
  'i always end up here',
];

const RELAPSE_MEANING_MARKERS_NL: string[] = [
  'wat zegt deze terugval over mij',
  'wat betekent dat over mij',
  'misschien ben ik gewoon kapot',
  'wat heeft het voor zin als ik altijd terugval',
  'ik heb alles weer verpest',
  'ik weet niet hoe ik dit betekenis moet geven',
  'wat zegt dit over wie ik ben',
  'ben ik gewoon een mislukking',
  'ik eindig altijd hier',
];

// ─── Explicit Stoicism / Philosophy Markers ─────────────────────────────────

const STOICISM_MARKERS_EN: string[] = [
  'what would a stoic do',
  'give me a stoic exercise',
  'how does stoicism apply',
  'what would marcus aurelius say',
  'what would epictetus say',
  'what would seneca say',
  'stoic',
  'stoicism',
  'marcus aurelius',
  'epictetus',
  'seneca',
  'memento mori',
  'amor fati',
  'dichotomy of control',
];

const PHILOSOPHY_MARKERS_EN: string[] = [
  'i need philosophy right now',
  'how do i accept what happened',
  'what is the philosophical view',
  'give me a philosophical perspective',
  'what does philosophy say',
];

const STOICISM_MARKERS_NL: string[] = [
  'wat zou een stoicijn doen',
  'geef me een stoicijnse oefening',
  'hoe past stoicisme hier',
  'wat zou marcus aurelius zeggen',
  'stoicijns',
  'stoicisme',
];

const PHILOSOPHY_MARKERS_NL: string[] = [
  'ik heb filosofie nodig',
  'hoe accepteer ik wat er gebeurd is',
  'wat is het filosofische perspectief',
  'geef me een filosofisch perspectief',
];

// ─── Safety Markers ─────────────────────────────────────────────────────────

const SUICIDE_MARKERS: string[] = [
  'i want to die',
  'i want to kill myself',
  'i do not want to live',
  'i want to end it',
  'ik wil dood',
  'ik wil mezelf doden',
  'ik wil niet meer leven',
  'ik wil er een einde aan maken',
];

const SELF_HARM_MARKERS: string[] = [
  'i want to hurt myself',
  'i cut myself',
  'i harm myself',
  'ik wil mezelf pijn doen',
  'ik snij mezelf',
];

const MEDICAL_RISK_MARKERS: string[] = [
  'i am shaking badly',
  'i am having seizures',
  'i overdosed',
  'i took too much',
  'i drank heavily and',
  'withdrawal',
  'delirium',
  'ik tril heel erg',
  'ik heb een overdosis',
  'ik heb te veel genomen',
  'ik heb zwaar gedronken en',
  'ontwenning',
];

// ─── Detection Functions ────────────────────────────────────────────────────

function containsAny(text: string, markers: string[]): boolean {
  return markers.some(marker => text.includes(marker));
}

/**
 * Detect STO01 trigger markers from user text input.
 */
export function detectSTO01TriggerMarkers(userText: string): STO01TriggerMarkers {
  const normalized = userText.toLowerCase().trim();

  return {
    ruminationOutsideControl: containsAny(normalized, [...RUMINATION_MARKERS_EN, ...RUMINATION_MARKERS_NL]),
    externalCauseFixation: containsAny(normalized, [...EXTERNAL_CAUSE_MARKERS_EN, ...EXTERNAL_CAUSE_MARKERS_NL]),
    relapseMeaningSearch: containsAny(normalized, [...RELAPSE_MEANING_MARKERS_EN, ...RELAPSE_MEANING_MARKERS_NL]),
    explicitStoicismRequest: containsAny(normalized, [...STOICISM_MARKERS_EN, ...STOICISM_MARKERS_NL]),
    explicitPhilosophyRequest: containsAny(normalized, [...PHILOSOPHY_MARKERS_EN, ...PHILOSOPHY_MARKERS_NL]),
  };
}

/**
 * Detect safety flags from user text input.
 * These override STO01 activation.
 */
export function detectSTO01SafetyFlags(userText: string): STO01SafetyFlags {
  const normalized = userText.toLowerCase().trim();

  return {
    activeSuicidalIntent: containsAny(normalized, SUICIDE_MARKERS),
    passiveDeathWish: false, // Requires deeper analysis, not keyword-based
    selfHarmIntent: containsAny(normalized, SELF_HARM_MARKERS),
    acuteMedicalRisk: containsAny(normalized, MEDICAL_RISK_MARKERS),
    overdoseOrPoisoningRisk: normalized.includes('overdos') || normalized.includes('te veel genomen'),
    severeIntoxication: normalized.includes('heavily intoxicated') || normalized.includes('zwaar beschonken'),
    acuteWithdrawalRisk: normalized.includes('withdrawal') || normalized.includes('ontwenning'),
    deliriumOrSeizureRisk: normalized.includes('delirium') || normalized.includes('seizure') || normalized.includes('aanval'),
    dissociationHeavy: false, // Requires deeper analysis
  };
}

/**
 * Quick check: does the user text contain any STO01 trigger markers?
 * Used for fast gating before full evaluation.
 */
export function hasSTO01Markers(userText: string): boolean {
  const normalized = userText.toLowerCase().trim();
  const allMarkers = [
    ...RUMINATION_MARKERS_EN, ...RUMINATION_MARKERS_NL,
    ...EXTERNAL_CAUSE_MARKERS_EN, ...EXTERNAL_CAUSE_MARKERS_NL,
    ...RELAPSE_MEANING_MARKERS_EN, ...RELAPSE_MEANING_MARKERS_NL,
    ...STOICISM_MARKERS_EN, ...STOICISM_MARKERS_NL,
    ...PHILOSOPHY_MARKERS_EN, ...PHILOSOPHY_MARKERS_NL,
  ];
  return allMarkers.some(marker => normalized.includes(marker));
}
