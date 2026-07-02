/**
 * Greeting Fact Extractor — FIX 3
 *
 * The engine determines TAGGED FACTS from selected sources.
 * GPT may ONLY verbalize these facts — it cannot add, interpret, or invent.
 *
 * Each fact has:
 * - tag: unique identifier (FEIT_1, FEIT_2, ...)
 * - source: which data layer it came from
 * - content: the literal text/value from the source
 * - relation: how this fact should relate to the greeting (engine-decided)
 *
 * FIX 3: buildDeterministicFallback now converts raw third-person narrative
 * ("kris voelt zich overweldigd") to natural second-person greeting text.
 * No raw logs.dat text is ever shown to the user.
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
 *
 * CRITICAL: This fallback must produce NATURAL SECOND-PERSON text.
 * Raw logs.dat narratives are in third-person ("kris voelt zich overweldigd")
 * and must NEVER appear verbatim. Instead, extract the TOPIC and embed it
 * in a natural template sentence.
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
    // Convert raw narrative to a safe second-person topic reference
    const topic = narrativeToSecondPersonTopic(continuityFact.content);
    if (topic) {
      greeting += ` ${topic}`;
    }
  }

  // Find state acknowledgment
  const stateFact = facts.find(f => f.relation === 'acknowledge_state');
  if (stateFact && !continuityFact) {
    const stateText = narrativeToSecondPersonState(stateFact.content);
    if (stateText) {
      greeting += ` ${stateText}`;
    }
  }

  // Find coping suggestion for elevated zones
  const copingFact = facts.find(f => f.relation === 'coping_suggestion');
  if (copingFact && ['ORANJE', 'ROOD', 'PAARS'].includes(zone)) {
    greeting += ` Denk aan wat je zelf zei dat helpt: ${truncateAtBoundary(copingFact.content, 60)}.`;
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

// ─── Narrative-to-Second-Person Converters ─────────────────────────────────

/**
 * Convert a raw third-person narrative into a natural second-person topic reference.
 *
 * Input examples (raw from logs.dat):
 *   "kris voelt zich overweldigd door de situatie met zijn begeleider"
 *   "gebruiker besprak stress op werk en relatieproblemen"
 *   "craving en copingstrategieën bij sociale druk"
 *
 * Output examples:
 *   "Vorige keer hadden we het over hoe je je voelde bij de situatie met je begeleider."
 *   "Vorige keer hadden we het over stress op werk."
 *   "Vorige keer hadden we het over craving bij sociale druk."
 *
 * If the narrative is too messy to convert cleanly, returns a generic continuity line.
 */
function narrativeToSecondPersonTopic(narrative: string): string | null {
  if (!narrative || narrative.length < 10) return null;

  // Step 1: Extract the core topic (strip prefixes, names, third-person constructions)
  let topic = extractTopicCore(narrative);
  if (!topic || topic.length < 5) {
    // If we can't extract a clean topic, use generic continuity
    return 'We pakken de draad op van vorige keer.';
  }

  // Step 2: Convert third-person to second-person
  topic = thirdToSecondPerson(topic);

  // Step 3: Ensure clean sentence boundary
  topic = truncateAtBoundary(topic, 70);

  if (!topic || topic.length < 5) {
    return 'We pakken de draad op van vorige keer.';
  }

  return `Vorige keer hadden we het over ${topic}.`;
}

/**
 * Convert a raw state/mood narrative into a natural second-person acknowledgment.
 */
function narrativeToSecondPersonState(narrative: string): string | null {
  if (!narrative || narrative.length < 5) return null;

  let text = extractTopicCore(narrative);
  if (!text || text.length < 5) return null;

  text = thirdToSecondPerson(text);
  text = truncateAtBoundary(text, 60);

  if (!text || text.length < 5) return null;

  return `Ik zie dat ${text}.`;
}

/**
 * Extract the core topic from a narrative, stripping all meta-prefixes,
 * names, and structural markers.
 */
function extractTopicCore(narrative: string): string | null {
  let clean = narrative.trim().toLowerCase();

  // Strip common narrative prefixes
  clean = clean
    .replace(/^sessie-inhoud \(\d+ berichten\):\s*/i, '')
    .replace(/^sessie met \d+ berichten.*?:\s*/i, '')
    .replace(/^gebruiker besprak:?\s*/i, '')
    .replace(/^de gebruiker besprak:?\s*/i, '')
    .replace(/^gebruiker vertelde:?\s*/i, '')
    .replace(/^de gebruiker vertelde:?\s*/i, '')
    .replace(/^samenvatting:?\s*/i, '');

  // Strip user names at the start (common pattern: "kris voelt zich...", "jan besprak...")
  // Match: [name] [verb] ... → strip the name
  clean = clean.replace(/^[a-z]{2,15}\s+(?=voelt|voelde|besprak|vertelde|heeft|had|is|was|ervaart|ervoer|maakt|maakte|denkt|dacht|wil|wilde|zoekt|zocht|merkt|merkte|praat|praatte|sprak|spreekt)/i, '');

  // If narrative contains pipe-separated messages, take the most substantive one
  if (clean.includes(' | ')) {
    const parts = clean.split(' | ');
    const substantive = parts
      .filter(p => p.length > 15)
      .sort((a, b) => b.length - a.length)[0];
    if (substantive) {
      clean = substantive.trim();
    }
  }

  // Try to get the first complete sentence if multiple exist
  const firstSentence = clean.match(/^[^.!?]+[.!?]/)?.[0];
  if (firstSentence && firstSentence.length >= 10 && firstSentence.length <= 100) {
    clean = firstSentence.replace(/[.!?]+$/, '').trim();
  }

  if (clean.length < 5) return null;
  return clean;
}

/**
 * Convert Dutch third-person constructions to second-person.
 * Handles common patterns from GPT-generated session summaries.
 *
 * "voelt zich overweldigd" → "je je overweldigd voelt"
 * "heeft moeite met..." → "je moeite hebt met..."
 * "is bang voor..." → "je bang bent voor..."
 */
function thirdToSecondPerson(text: string): string {
  let result = text;

  // Pattern: "voelt zich [X]" → "hoe je je [X] voelt"
  result = result.replace(/^voelt zich\s+(.+)$/i, 'hoe je je $1 voelt');
  result = result.replace(/^voelde zich\s+(.+)$/i, 'hoe je je $1 voelde');

  // Pattern: "heeft [X]" → "je [X] hebt"
  result = result.replace(/^heeft\s+(.+)$/i, 'je $1 hebt');
  result = result.replace(/^had\s+(.+)$/i, 'je $1 had');

  // Pattern: "is [X]" → "je [X] bent"
  result = result.replace(/^is\s+(.+)$/i, 'je $1 bent');
  result = result.replace(/^was\s+(.+)$/i, 'je $1 was');

  // Pattern: "ervaart [X]" → "wat je ervaart met [X]"
  result = result.replace(/^ervaart\s+(.+)$/i, 'wat je ervaart met $1');
  result = result.replace(/^ervoer\s+(.+)$/i, 'wat je ervoer met $1');

  // Pattern: "maakt zich zorgen over [X]" → "je zorgen over [X]"
  result = result.replace(/^maakt zich zorgen over\s+(.+)$/i, 'je zorgen over $1');
  result = result.replace(/^maakte zich zorgen over\s+(.+)$/i, 'je zorgen over $1');

  // Pattern: "denkt na over [X]" → "waar je over nadenkt"
  result = result.replace(/^denkt na over\s+(.+)$/i, 'waar je over nadenkt: $1');

  // Pattern: "wil [X]" → "wat je wilt: [X]"
  result = result.replace(/^wil\s+(.+)$/i, 'wat je wilt: $1');
  result = result.replace(/^wilde\s+(.+)$/i, 'wat je wilde: $1');

  // Replace possessive "zijn/haar" with "je" when it appears to refer to the user
  result = result.replace(/\bzijn\s+(begeleider|partner|moeder|vader|broer|zus|vriend|vriendin|baas|collega|kind|kinderen|gezin|familie|werk|baan|relatie|situatie|gevoel|gevoelens|gedachten|angst|stress|craving)\b/gi, 'je $1');
  result = result.replace(/\bhaar\s+(begeleider|partner|moeder|vader|broer|zus|vriend|vriendin|baas|collega|kind|kinderen|gezin|familie|werk|baan|relatie|situatie|gevoel|gevoelens|gedachten|angst|stress|craving)\b/gi, 'je $1');

  return result;
}

// ─── Utility Functions ─────────────────────────────────────────────────────

/**
 * Truncate text at a word boundary, never mid-word.
 * Returns text up to maxLen chars, cut at the last space before maxLen.
 */
export function truncateAtBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text.replace(/[.!?,;:]+$/, '').trim();

  // Find last space before maxLen
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  const result = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;

  // Remove trailing punctuation for clean embedding
  return result.replace(/[.!?,;:\s]+$/, '').trim();
}
