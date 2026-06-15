/**
 * Session Greeting V3 — Synthesis Prompt Builder
 *
 * Builds the GPT prompt payload for synthesis mode.
 * GPT receives:
 * - Selected sources (max 3) with safe anchors
 * - Synthesis instruction: "weave these into ONE natural greeting"
 * - Forbidden patterns (checklist style, "hoe voel je je", inventory)
 * - Language rule: grammatically correct, fluent Dutch
 *
 * Also provides override prompt builders for CRISIS/FIRST/MISSING modes.
 */

import type {
  GreetingSynthesisPromptPayload,
  SelectedSynthesisSource,
  GreetingOverrideResult,
} from './sessionGreetingV3.types';

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
];

// ─── Synthesis Prompt ───────────────────────────────────────────────────────

export function buildGreetingSynthesisPromptPayload(
  userName: string,
  selectedSources: SelectedSynthesisSource[],
): GreetingSynthesisPromptPayload {
  const sourceDescriptions = selectedSources
    .map((s, i) => `  ${i + 1}. [${s.sourceType}]: "${s.safeAnchor}"`)
    .join('\n');

  const synthesisInstruction = buildSynthesisInstruction(userName, sourceDescriptions, selectedSources.length);

  return {
    persona: 'elias',
    userName,
    mode: 'SYNTHESIS',
    maxSentences: 4,
    selectedSources,
    synthesisInstruction,
    forbiddenPatterns: FORBIDDEN_PATTERNS,
    languageRule: 'Schrijf grammaticaal correct, vloeiend Nederlands. Geen afkortingen, geen emoji, geen opsommingen.',
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

VOORBEELD VAN GOEDE SYNTHESE (ter illustratie, niet kopiëren):
"${userName}, fijn dat je er bent. Goed dat je gisteren een fijne dag had — dat straalt door. Waar wil je het vandaag over hebben?"`;
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

  return { valid: true, reason: 'OK' };
}

/**
 * Returns the forbidden patterns list for external use (e.g., tests).
 */
export function getForbiddenPatterns(): string[] {
  return [...FORBIDDEN_PATTERNS];
}
