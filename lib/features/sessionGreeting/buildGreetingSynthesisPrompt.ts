/**
 * Session Greeting V3 — Synthesis Prompt Builder (with Absence Awareness)
 *
 * Builds the GPT prompt payload for synthesis mode.
 * GPT receives:
 * - Selected sources (max 3 normal, max 2 for return-after-absence) with safe anchors
 * - Synthesis instruction: "weave these into ONE natural greeting"
 * - Absence context when RETURN_AFTER_ABSENCE mode is active
 * - Forbidden patterns (checklist style, "hoe voel je je", inventory, blame/relapse)
 * - Language rule: grammatically correct, fluent Dutch
 *
 * Also provides override prompt builders for CRISIS/FIRST/MISSING/RETURN modes.
 */

import type {
  GreetingSynthesisPromptPayload,
  SelectedSynthesisSource,
  SessionAbsenceResultForPrompt,
  GreetingSynthesisMode,
} from './sessionGreetingV3.types';
import type { SessionAbsenceResult } from './calculateSessionAbsence';

// ─── Forbidden Patterns ─────────────────────────────────────────────────────

const FORBIDDEN_PATTERNS: string[] = [
  'hoe voel je je',
  'hoe gaat het',
  'hoe is het',
  'ik zie dat je',
  'ten eerste',
  'ten tweede',
  'ten derde',
  'punt 1',
  'punt 2',
  'laten we beginnen met',
  'ik merk op dat',
  'samenvattend',
  'om samen te vatten',
  'checklist',
  'inventory',
  'laat me even opsommen',
  // Absence-specific forbidden patterns (blame/relapse assumption)
  'terugval',
  'hervallen',
  'je hebt het opgegeven',
  'je was weg',
  'waar was je',
  'waarom ben je weggebleven',
  'je hebt gefaald',
  'het is mislukt',
  'je bent teruggevallen',
];

// ─── Synthesis Prompt ───────────────────────────────────────────────────────

export interface BuildSynthesisPromptInput {
  userName: string;
  selectedSources: SelectedSynthesisSource[];
  absence: SessionAbsenceResult;
  mode: GreetingSynthesisMode;
}

export function buildGreetingSynthesisPromptPayload(
  input: BuildSynthesisPromptInput,
): GreetingSynthesisPromptPayload {
  const { userName, selectedSources, absence, mode } = input;

  const sourceDescriptions = selectedSources
    .map((s, i) => `  ${i + 1}. [${s.sourceType}]: "${s.safeAnchor}"`)
    .join('\n');

  const isReturnMode = mode === 'RETURN_AFTER_ABSENCE';
  const absenceForPrompt: SessionAbsenceResultForPrompt | undefined = isReturnMode
    ? buildAbsenceForPrompt(absence)
    : undefined;

  const synthesisInstruction = isReturnMode
    ? buildReturnAfterAbsenceInstruction(userName, sourceDescriptions, selectedSources.length, absence)
    : buildSynthesisInstruction(userName, sourceDescriptions, selectedSources.length);

  const openQuestionInstruction = isReturnMode
    ? 'Eindig met een zachte, open vraag die NIET vraagt waarom ze weg waren. Vraag naar het nu-moment of wat ze nodig hebben.'
    : 'Eindig met een open, uitnodigende vraag die aansluit bij de bronnen.';

  return {
    persona: 'elias',
    userName,
    mode,
    maxSentences: 4,
    selectedSources,
    absence: absenceForPrompt,
    synthesisInstruction,
    openQuestionInstruction,
    forbiddenPatterns: FORBIDDEN_PATTERNS,
    languageRule: 'Schrijf grammaticaal correct, vloeiend Nederlands. Geen afkortingen, geen emoji, geen opsommingen.',
  };
}

function buildAbsenceForPrompt(absence: SessionAbsenceResult): SessionAbsenceResultForPrompt {
  let wordingHint: SessionAbsenceResultForPrompt['wordingHint'];
  if (absence.band === 'LONG_RETURN') {
    wordingHint = 'long_return_soft';
  } else if (absence.band === 'SHORT') {
    wordingHint = 'short_return';
  } else {
    wordingHint = 'return_after_absence';
  }

  return {
    band: absence.band,
    absenceDaysRounded: absence.absenceDaysExact !== null
      ? Math.round(absence.absenceDaysExact * 10) / 10
      : null,
    wordingHint,
  };
}

function buildSynthesisInstruction(
  userName: string,
  sourceDescriptions: string,
  sourceCount: number,
): string {
  return `Je bent Elias. Schrijf een warme, persoonlijke begroeting voor ${userName}.

BRONNEN om te verweven (${sourceCount}):
${sourceDescriptions}

INSTRUCTIES:
- Verweef de bronnen tot ÉÉN vloeiende, menselijke begroeting
- Gebruik MAXIMAAL 3-4 zinnen totaal
- Begin met een persoonlijke opening (gebruik de naam)
- Eindig met een open, uitnodigende vraag die aansluit bij de bronnen
- De begroeting moet aanvoelen als een warm gesprek, NIET als een samenvatting
- Noem NOOIT de bronnen expliciet ("ik zie in je dagboek" is verboden)
- Verwijs indirect en natuurlijk naar de inhoud
- Geen opsommingen, geen checklist-taal, geen "ten eerste/ten tweede"
- Grammaticaal correct, vloeiend Nederlands
- Geen emoji

VERBODEN ZINNEN:
- "Hoe voel je je?" (te generiek)
- "Hoe gaat het?" (te generiek)
- "Ik zie dat je..." (te klinisch)
- "Laten we beginnen met..." (te gestructureerd)
- Elke zin die klinkt als een inventarisatie of checklist

KRITIEK — GEEN HALLUCINATIE:
- Verwijs ALLEEN naar informatie die EXPLICIET in de bronnen hierboven staat
- Verzin NOOIT sessies, gesprekken of activiteiten die niet in de bronnen staan
- Als een bron zegt "dagboek van gisteren" mag je ernaar verwijzen; als er GEEN bron over gisteren is, NOEM gisteren dan NIET
- Zeg NOOIT "fijne dag gisteren" of "sessie van gisteren" tenzij dit LETTERLIJK uit een bron komt
- Bij twijfel: houd het algemeen en warm zonder specifieke tijdsreferenties

VOORBEELD VAN GOEDE SYNTHESE (ter illustratie, niet kopiëren):
"${userName}, fijn dat je er bent. Er klinkt iets door van rust in wat je deelde — mooi om te zien. Waar wil je het vandaag over hebben?"`;
}

function buildReturnAfterAbsenceInstruction(
  userName: string,
  sourceDescriptions: string,
  sourceCount: number,
  absence: SessionAbsenceResult,
): string {
  const days = absence.absenceDaysExact !== null
    ? Math.round(absence.absenceDaysExact)
    : 'enkele';
  const isLongReturn = absence.band === 'LONG_RETURN';

  const toneInstruction = isLongReturn
    ? `TOON: Extra zacht en warm. Geen alarm, geen bezorgdheid, geen verwijt. De gebruiker is er weer — dat is het enige dat telt. Behandel de terugkeer als iets positiefs.`
    : `TOON: Warm en verwelkomend. Erken kort dat het even geleden is, zonder er zwaar aan te tillen.`;

  const sourcePart = sourceCount > 0
    ? `\nOPTIONELE BRONNEN om subtiel te verweven (${sourceCount}):\n${sourceDescriptions}\n- Verweef deze ALLEEN als het natuurlijk past bij de terugkeer-begroeting\n- De afwezigheids-erkenning staat VOOROP, bronnen zijn secundair`
    : '';

  return `Je bent Elias. ${userName} is terug na ${days} dagen afwezigheid.

${toneInstruction}

INSTRUCTIES:
- Begin met een warme erkenning dat ${userName} er weer is
- Gebruik MAXIMAAL 3-4 zinnen totaal
- Erken de afwezigheid ZONDER te vragen waarom ze weg waren
- Maak GEEN aannames over wat er gebeurd is (geen "terugval", geen "moeilijke periode")
- Eindig met een zachte, open vraag over het nu-moment
- De begroeting moet aanvoelen als een vriend die blij is je te zien
${sourcePart}

ABSOLUUT VERBODEN:
- Vragen waarom ze weg waren ("waar was je?", "waarom ben je weggebleven?")
- Aannames over terugval of falen ("je bent teruggevallen", "het is mislukt")
- Verwijten of schuldgevoel triggeren
- Alarm-toon of bezorgdheid over de afwezigheid
- "Hoe voel je je?" of "Hoe gaat het?"
- Opsommingen of checklist-taal
- Emoji

KRITIEK — GEEN HALLUCINATIE:
- Verwijs ALLEEN naar informatie die EXPLICIET in de bronnen hierboven staat
- Verzin NOOIT sessies, gesprekken of activiteiten die niet in de bronnen staan
- Zeg NOOIT "sessie van gisteren" of "vorige keer" tenzij dit LETTERLIJK uit een bron komt
- Bij twijfel: houd het algemeen en warm zonder specifieke tijdsreferenties

VOORBEELD (ter illustratie, niet kopiëren):
"${userName}, fijn dat je er weer bent. Het maakt niet uit hoe lang het geweest is — je bent hier, en dat telt. Wat heb je nodig vandaag?"`;
}

// ─── Override Prompt Builders ────────────────────────────────────────────────

export function buildCrisisOverridePrompt(userName: string, craving: number): string {
  return `Je bent Elias. ${userName} heeft een hoge craving (${craving}/10) ingevuld.

Schrijf een korte, directe begroeting (2-3 zinnen):
- Erken dat het zwaar is ZONDER te dramatiseren
- Bied aanwezigheid ("ik ben hier")
- Stel één concrete vraag over het nu-moment
- Geen opsommingen, geen checklist, geen "hoe voel je je"
- Grammaticaal correct Nederlands, geen emoji`;
}

export function buildFirstSessionOverridePrompt(userName: string | null): string {
  const name = userName || 'daar';
  return `Je bent Elias. Dit is de EERSTE sessie van ${name}.

Schrijf een warme welkomstbegroeting (2-3 zinnen):
- Verwelkom de gebruiker persoonlijk
- Maak het laagdrempelig en veilig
- Stel één open vraag die uitnodigt om te beginnen
- Geen opsommingen, geen checklist
- Grammaticaal correct Nederlands, geen emoji`;
}

export function buildMissingDataOverridePrompt(userName: string): string {
  return `Je bent Elias. ${userName} heeft nog geen check-in gedaan vandaag (geen sliders, geen recent dagboek).

Schrijf een korte, uitnodigende begroeting (2-3 zinnen):
- Verwelkom de gebruiker
- Nodig subtiel uit om te delen hoe het gaat
- Maak het NIET dwingend of verplichtend
- Geen opsommingen, geen checklist, geen "hoe voel je je"
- Grammaticaal correct Nederlands, geen emoji`;
}

// ─── Output Safety Filter ───────────────────────────────────────────────────

export interface GreetingOutputValidation {
  valid: boolean;
  reason: string;
}

/**
 * Validates GPT output against safety rules.
 * Rejects:
 * - More than 5 sentences
 * - Contains forbidden patterns
 * - Contains emoji
 * - Contains numbered lists or bullet points
 * - Is empty or too short
 * - Contains blame/relapse assumptions (absence-specific)
 */
export function enforceGreetingOutputRulesV3(output: string): GreetingOutputValidation {
  if (!output || output.trim().length < 10) {
    return { valid: false, reason: 'Output too short or empty' };
  }

  const trimmed = output.trim();

  // Check sentence count (rough: split on . ! ?)
  const sentences = trimmed
    .split(/[.!?]+/)
    .filter(s => s.trim().length > 5);
  if (sentences.length > 5) {
    return { valid: false, reason: `Too many sentences: ${sentences.length} (max 5)` };
  }

  // Check forbidden patterns
  const lower = trimmed.toLowerCase();
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (lower.includes(pattern)) {
      return { valid: false, reason: `Contains forbidden pattern: "${pattern}"` };
    }
  }

  // Check emoji (basic range)
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  if (emojiRegex.test(trimmed)) {
    return { valid: false, reason: 'Contains emoji' };
  }

  // Check numbered lists or bullet points
  if (/^\s*[\d]+[.)]\s/m.test(trimmed) || /^\s*[-•*]\s/m.test(trimmed)) {
    return { valid: false, reason: 'Contains list formatting (bullets or numbers)' };
  }

  // Check inventory-style language
  const inventoryPatterns = [
    /ik\s+(?:zie|merk|constateer)\s+(?:dat|het\s+volgende)/i,
    /(?:ten\s+eerste|ten\s+tweede|ten\s+derde)/i,
    /(?:punt\s+\d|stap\s+\d)/i,
    /laat\s+me\s+(?:even\s+)?(?:opsommen|samenvatten)/i,
  ];
  for (const pattern of inventoryPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: 'Contains inventory/checklist language' };
    }
  }

  // Check blame/relapse assumption patterns
  const blamePatterns = [
    /je\s+(?:hebt|bent)\s+(?:het\s+)?(?:opgegeven|gefaald|teruggevallen)/i,
    /(?:het\s+is|dat\s+is)\s+mislukt/i,
    /waarom\s+(?:ben|was)\s+je\s+(?:weg|weggebleven)/i,
    /waar\s+was\s+je/i,
  ];
  for (const pattern of blamePatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: 'Contains blame or relapse assumption' };
    }
  }

  return { valid: true, reason: 'OK' };
}

/**
 * Returns the forbidden patterns list for external use (e.g., tests).
 */
export function getForbiddenPatterns(): string[] {
  return [...FORBIDDEN_PATTERNS];
}
