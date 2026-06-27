/**
 * Greeting Fact Extractor — FIX 2
 *
 * The engine determines TAGGED FACTS from selected sources.
 * GPT may ONLY verbalize these facts — it cannot add, interpret, or invent.
 *
 * Each fact has:
 * - tag: unique identifier (FEIT_1, FEIT_2, ...)
 * - source: which data layer it came from
 * - content: the literal text/value from the source
 * - relation: how this fact should relate to the greeting (engine-decided)
 */

import type { SelectedSynthesisSource } from './sessionGreetingV3.types';
import type { GreetingVspSectionSnapshot } from './sessionGreeting.types';

export interface GreetingFact {
  tag: string; // e.g. "FEIT_1"
  source: string; // e.g. "LAST_SESSION_SUMMARY", "TODAY_MOOD"
  content: string; // literal text from the source
  relation: GreetingFactRelation; // how to use this fact
}

export type GreetingFactRelation =
  | 'continuity_reference' // refer back to previous session
  | 'acknowledge_state' // acknowledge current mood/state
  | 'personal_recognition' // show you know them (name, place, activity)
  | 'coping_suggestion' // suggest their own coping strategy
  | 'positive_reinforcement'; // reinforce something positive

export interface GreetingFactExtractionResult {
  facts: GreetingFact[];
  primaryFact: GreetingFact | null; // the most important fact (always LAST_SESSION if available)
  fallbackGreeting: string; // deterministic fallback if GPT fails/hallucinates
}

/**
 * Extract tagged facts from selected sources.
 * The engine decides WHAT to say — GPT only decides HOW to say it.
 */
export function extractGreetingFacts(
  selectedSources: SelectedSynthesisSource[],
  userName: string,
  vspSection?: GreetingVspSectionSnapshot,
  vspZone?: string,
): GreetingFactExtractionResult {
  const facts: GreetingFact[] = [];
  let factIndex = 1;

  // Process sources in priority order (LAST_SESSION_SUMMARY first due to CONTINUITY RULE)
  const sorted = [...selectedSources].sort((a, b) => {
    if (a.sourceType === 'LAST_SESSION_SUMMARY') return -1;
    if (b.sourceType === 'LAST_SESSION_SUMMARY') return 1;
    return b.relevanceScore - a.relevanceScore;
  });

  for (const source of sorted) {
    if (!source.safeAnchor || source.safeAnchor.trim().length < 5) continue;

    const relation = determineRelation(source.sourceType);
    const content = extractCoreFact(source.sourceType, source.safeAnchor);

    if (content) {
      facts.push({
        tag: `FEIT_${factIndex}`,
        source: source.sourceType,
        content,
        relation,
      });
      factIndex++;
    }
  }

  // Add VSP fact if in elevated zone
  if (vspSection?.currentZoneEntry && ['GEEL', 'ORANJE', 'ROOD', 'PAARS'].includes((vspZone ?? '').toUpperCase())) {
    const entry = vspSection.currentZoneEntry;
    if (entry.whatHelps && entry.whatHelps.length > 0) {
      facts.push({
        tag: `FEIT_${factIndex}`,
        source: 'VSP_WAT_HELPT',
        content: entry.whatHelps[0],
        relation: 'coping_suggestion',
      });
      factIndex++;
    }
    if (entry.anchorSentence) {
      facts.push({
        tag: `FEIT_${factIndex}`,
        source: 'VSP_ANKERZIN',
        content: entry.anchorSentence,
        relation: 'coping_suggestion',
      });
      factIndex++;
    }
  }

  const primaryFact = facts.find(f => f.source === 'LAST_SESSION_SUMMARY') || facts[0] || null;

  // Build deterministic fallback (no GPT needed)
  const fallbackGreeting = buildDeterministicFallback(facts, userName, vspZone);

  return { facts, primaryFact, fallbackGreeting };
}

/**
 * Determine the relation type based on source type.
 */
function determineRelation(sourceType: string): GreetingFactRelation {
  switch (sourceType) {
    case 'LAST_SESSION_SUMMARY':
    case 'RECURRING_PATTERN':
      return 'continuity_reference';
    case 'TODAY_MOOD':
      return 'acknowledge_state';
    case 'RECENT_DIARY':
    case 'RECENT_GRATITUDE':
    case 'BACKPACK_RECENT_UPDATE':
      return 'personal_recognition';
    case 'ACTIVE_HOPE_OR_FEAR':
      return 'acknowledge_state';
    case 'SCHEMA_ROTATION':
      return 'continuity_reference';
    default:
      return 'personal_recognition';
  }
}

/**
 * Extract the core factual content from a source's safeAnchor.
 * Strips meta-labels, speaker prefixes, and structural markers — keeps only the user's own words or concrete data.
 */
function extractCoreFact(sourceType: string, safeAnchor: string): string {
  let cleaned = safeAnchor.trim();

  // Strip session labels that buildGreetingSynthesisCandidates adds
  // e.g. "Laatste sessie: ...", "Sessie daarvoor: ...", "Eerdere sessie: ...", "Vorige sessie: ..."
  cleaned = cleaned.replace(/^(?:Laatste sessie|Sessie daarvoor|Eerdere sessie|Vorige sessie):\s*/gi, '');

  // For multi-line anchors (multiple sessions), strip labels from each line
  cleaned = cleaned.replace(/\n(?:Laatste sessie|Sessie daarvoor|Eerdere sessie|Vorige sessie):\s*/gi, '\n');

  // Strip speaker prefixes like "elias: ", "kim: ", "kris: ", "gebruiker: "
  // These appear in raw session narratives from logs.dat
  cleaned = cleaned.replace(/(?:^|(?<=\n))\s*(?:elias|kim|kris|gebruiker|user):\s*/gi, '');

  // Strip "Sessie-inhoud (N berichten):" prefix
  cleaned = cleaned.replace(/^Sessie-inhoud \(\d+ berichten\):\s*/i, '');
  cleaned = cleaned.replace(/^Sessie met \d+ berichten.*?:\s*/i, '');

  // Collapse multiple whitespace/newlines
  cleaned = cleaned.replace(/\n{2,}/g, '\n').trim();

  // Limit to 200 chars to keep facts concise
  if (cleaned.length > 200) {
    return cleaned.slice(0, 197) + '...';
  }
  return cleaned;
}

/**
 * Build a deterministic fallback greeting from facts alone (no GPT).
 * Used when GPT hallucinates or fails after retries.
 */
function buildDeterministicFallback(
  facts: GreetingFact[],
  userName: string,
  vspZone?: string,
): string {
  const zone = (vspZone ?? 'GROEN').toUpperCase();

  // Always start with name
  let greeting = `${userName}, fijn dat je er bent.`;

  // Find continuity fact (previous session)
  const continuityFact = facts.find(f => f.relation === 'continuity_reference');
  if (continuityFact) {
    // Extract key topic from the session summary
    const topic = extractTopicFromNarrative(continuityFact.content);
    if (topic) {
      greeting += ` Vorige keer hadden we het over ${topic}.`;
    }
  }

  // Find state acknowledgment
  const stateFact = facts.find(f => f.relation === 'acknowledge_state');
  if (stateFact && !continuityFact) {
    greeting += ` ${stateFact.content.slice(0, 80)}.`;
  }

  // Find coping suggestion for elevated zones
  const copingFact = facts.find(f => f.relation === 'coping_suggestion');
  if (copingFact && ['ORANJE', 'ROOD', 'PAARS'].includes(zone)) {
    greeting += ` Denk aan wat je zelf zei dat helpt: ${copingFact.content}.`;
  }

  // End with zone-appropriate question
  if (['ROOD', 'PAARS'].includes(zone)) {
    greeting += ' Wat heb je nu nodig?';
  } else if (zone === 'ORANJE') {
    greeting += ' Waar wil je het over hebben?';
  } else {
    greeting += ' Waar wil je het vandaag over hebben?';
  }

  return greeting;
}

/**
 * Extract the main topic from a session narrative.
 * Returns a short phrase suitable for "Vorige keer hadden we het over [X]"
 */
function extractTopicFromNarrative(narrative: string): string | null {
  if (!narrative || narrative.length < 10) return null;

  // If narrative contains pipe-separated messages, take the most substantive one
  if (narrative.includes(' | ')) {
    const parts = narrative.split(' | ');
    // Find the longest meaningful part (likely the main topic)
    const substantive = parts
      .filter(p => p.length > 15)
      .sort((a, b) => b.length - a.length)[0];
    if (substantive) {
      return substantive.slice(0, 80).toLowerCase();
    }
  }

  // Otherwise take first 80 chars of the narrative
  const clean = narrative
    .replace(/^Sessie-inhoud \(\d+ berichten\):\s*/i, '')
    .replace(/^Sessie met \d+ berichten.*?:\s*/i, '')
    .trim();

  if (clean.length < 10) return null;
  return clean.slice(0, 80).toLowerCase();
}
