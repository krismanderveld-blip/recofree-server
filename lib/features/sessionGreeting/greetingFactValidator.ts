/**
 * Greeting Fact Validator — FIX 3
 *
 * BLOCKING output-check: verifies that the GPT greeting ONLY contains
 * information traceable to the supplied facts. If it hallucinates or
 * adds unsupplied information, the greeting is REJECTED.
 *
 * Flow:
 * 1. Run existing style checks (enforceGreetingOutputRulesV3)
 * 2. Run fact-grounding check: every specific claim in the greeting
 *    must be traceable to a supplied fact
 * 3. If rejected: retry (max 2x), then use deterministic fallback
 */

import type { GreetingFact } from './greetingFactExtractor';
import { enforceGreetingOutputRulesV3 } from './buildGreetingSynthesisPrompt';

export interface FactValidationResult {
  valid: boolean;
  reason: string;
  violationType?: 'style' | 'hallucination' | 'unsupported_claim';
}

/**
 * Validate a greeting against both style rules AND fact grounding.
 * This is the BLOCKING validator — if it fails, the greeting is not shown.
 */
export function validateGreetingAgainstFacts(
  greeting: string,
  suppliedFacts: GreetingFact[],
): FactValidationResult {
  // Step 1: Style check (existing)
  const styleResult = enforceGreetingOutputRulesV3(greeting);
  if (!styleResult.valid) {
    return {
      valid: false,
      reason: styleResult.reason,
      violationType: 'style',
    };
  }

  // Step 2: Fact-grounding check
  const groundingResult = checkFactGrounding(greeting, suppliedFacts);
  if (!groundingResult.valid) {
    return {
      valid: false,
      reason: groundingResult.reason,
      violationType: groundingResult.violationType,
    };
  }

  return { valid: true, reason: 'OK' };
}

/**
 * Check if the greeting contains specific claims not traceable to supplied facts.
 *
 * Strategy:
 * - Extract proper nouns, numbers, time references, and specific activities from the greeting
 * - Check if each can be traced back to at least one supplied fact's content
 * - Allow generic/structural phrases (greetings, questions) without fact backing
 */
function checkFactGrounding(
  greeting: string,
  suppliedFacts: GreetingFact[],
): FactValidationResult {
  if (suppliedFacts.length === 0) {
    // No facts supplied — greeting should be generic, no specific claims allowed
    if (containsSpecificClaims(greeting)) {
      return {
        valid: false,
        reason: 'Greeting contains specific claims but no facts were supplied',
        violationType: 'hallucination',
      };
    }
    return { valid: true, reason: 'OK' };
  }

  // Build a combined fact corpus for matching
  const factCorpus = suppliedFacts
    .map(f => f.content.toLowerCase())
    .join(' ');

  // Extract specific claims from the greeting
  const claims = extractSpecificClaims(greeting);

  for (const claim of claims) {
    if (!isClaimGrounded(claim, factCorpus, suppliedFacts)) {
      return {
        valid: false,
        reason: `Unsupported claim: "${claim}" — not found in supplied facts`,
        violationType: 'unsupported_claim',
      };
    }
  }

  return { valid: true, reason: 'OK' };
}

/**
 * Extract specific claims from a greeting that need fact-backing.
 * Returns phrases that contain proper nouns, numbers, time references, or specific activities.
 */
function extractSpecificClaims(greeting: string): string[] {
  const claims: string[] = [];
  const lower = greeting.toLowerCase();

  // 1. Proper nouns (capitalized words that aren't sentence starters, excluding "Ik", "Je", "Het", etc.)
  const commonStarters = new Set(['ik', 'je', 'het', 'de', 'een', 'dat', 'dit', 'wat', 'hoe', 'waar', 'fijn', 'mooi', 'goed', 'hier', 'daar', 'ook', 'nog', 'wel', 'niet', 'maar', 'en', 'of', 'als', 'om', 'met', 'bij', 'van', 'voor', 'naar', 'uit', 'op', 'in', 'aan', 'er', 'zo', 'al', 'nu', 'dan', 'toch', 'even', 'heel', 'echt', 'best', 'veel', 'meer', 'iets', 'alles', 'niets']);
  const nameMatches = greeting.match(/(?<=[\s,.])[A-Z][a-zéèêëïöüáàâ]{2,}/g) || [];
  for (const name of nameMatches) {
    if (!commonStarters.has(name.toLowerCase())) {
      claims.push(name.toLowerCase());
    }
  }

  // 2. Time references (specific days, durations)
  const timePatterns = [
    /(\d+)\s*(?:dagen?|weken?|maanden?|uur|minuten?)\s*(?:geleden|terug)/gi,
    /(?:gisteren|eergisteren|vorige\s+week|afgelopen\s+\w+)/gi,
    /(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)/gi,
  ];
  for (const pattern of timePatterns) {
    const matches = lower.match(pattern) || [];
    claims.push(...matches);
  }

  // 3. Specific numbers with context (not just "3-4 zinnen" type instructions)
  const numberClaims = greeting.match(/\d+\s*(?:keer|x|maal|dagen?|sessies?|gesprekken?)/gi) || [];
  claims.push(...numberClaims.map(c => c.toLowerCase()));

  // 4. Specific activities/events (verbs with objects that imply knowledge)
  const activityPatterns = [
    /(?:je\s+(?:hebt|had|bent|was|ging|deed|maakte|schreef|vertelde|zei))\s+(.{5,40}?)(?=[.,!?]|$)/gi,
    /(?:jullie|we)\s+(?:hadden|spraken|bespraken|hebben)\s+(?:het\s+)?(?:over\s+)?(.{5,40}?)(?=[.,!?]|$)/gi,
  ];
  for (const pattern of activityPatterns) {
    let match;
    while ((match = pattern.exec(greeting)) !== null) {
      if (match[1] && match[1].trim().length > 4) {
        claims.push(match[1].trim().toLowerCase());
      }
    }
  }

  // Deduplicate
  return [...new Set(claims)];
}

/**
 * Check if a specific claim can be traced to the fact corpus.
 * Uses fuzzy matching: the claim's key words must appear in the facts.
 */
function isClaimGrounded(
  claim: string,
  factCorpus: string,
  suppliedFacts: GreetingFact[],
): boolean {
  const claimLower = claim.toLowerCase().trim();

  // Direct substring match in fact corpus
  if (factCorpus.includes(claimLower)) {
    return true;
  }

  // Word-level match: at least 60% of claim words must appear in facts
  const claimWords = claimLower.split(/\s+/).filter(w => w.length > 2);
  if (claimWords.length === 0) return true; // trivial claim

  const matchedWords = claimWords.filter(w => factCorpus.includes(w));
  const matchRatio = matchedWords.length / claimWords.length;

  if (matchRatio >= 0.6) {
    return true;
  }

  // Check individual fact contents for partial match
  for (const fact of suppliedFacts) {
    const factLower = fact.content.toLowerCase();
    if (factLower.includes(claimLower)) return true;

    // Check if claim words overlap with this specific fact
    const factWords = new Set(factLower.split(/\s+/).filter(w => w.length > 2));
    const overlapCount = claimWords.filter(w => factWords.has(w)).length;
    if (overlapCount >= Math.ceil(claimWords.length * 0.5)) return true;
  }

  return false;
}

/**
 * Check if a greeting contains specific claims (proper nouns, numbers, time refs).
 * Used when no facts are supplied — the greeting should be generic.
 */
function containsSpecificClaims(greeting: string): boolean {
  // Check for proper nouns beyond the user's name (which is always allowed)
  const hasUnexpectedProperNouns = /(?<=[\s,.])[A-Z][a-z]{2,}/.test(greeting);
  // Check for specific time references
  const hasTimeRefs = /\d+\s*(?:dagen?|weken?|maanden?)\s*(?:geleden|terug)/i.test(greeting);
  // Check for specific session references
  const hasSessionRefs = /(?:vorige\s+keer|vorige\s+sessie|laatst|gisteren)/i.test(greeting);

  return hasTimeRefs || hasSessionRefs;
}
