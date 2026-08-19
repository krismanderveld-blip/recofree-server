/**
 * AGE CATEGORY FOUNDATION
 * 
 * RecoFree is designed for adults (18+) dealing with addiction or supporting someone with addiction.
 * This foundation establishes the communication depth baseline.
 * 
 * ageCategory = 'adult_18_plus' is the ONLY supported category.
 * All communication depth, therapeutic content, and clinical reasoning assumes adult capacity.
 * 
 * This is NOT a user-facing setting — it's an architectural constant that ensures:
 * - Full therapeutic depth is available (no child-safe filtering beyond safety)
 * - Relationship dynamics are discussed at adult level
 * - Substance use is discussed directly without euphemism
 * - Emotional regulation assumes adult cognitive capacity
 * - Boundary-setting assumes adult autonomy
 */

export type AgeCategory = 'adult_18_24' | 'adult_25_39' | 'adult_40_plus' | 'unknown_adult';

/**
 * Resolve age category from extracted persons' ages or backpack context.
 * Never returns raw birthDate — only a category.
 * Returns 'unknown_adult' when age cannot be determined.
 */
export function resolveAgeCategory(extractedPersons?: Array<{ name?: string; age?: string | null }>, userName?: string): AgeCategory {
  if (!extractedPersons || !userName) return 'unknown_adult';
  // Find the user's own age from extracted persons (if extraction found it)
  const userPerson = extractedPersons.find(
    (p) => p.name && userName && p.name.toLowerCase() === userName.toLowerCase() && p.age
  );
  if (!userPerson?.age) return 'unknown_adult';
  const ageNum = parseInt(userPerson.age, 10);
  if (isNaN(ageNum) || ageNum < 18) return 'unknown_adult';
  if (ageNum <= 24) return 'adult_18_24';
  if (ageNum <= 39) return 'adult_25_39';
  return 'adult_40_plus';
}

/**
 * Build the [AGE / COMMUNICATION CONTEXT] prompt block.
 * Never includes raw birthDate. Only the category + communication hints.
 */
export function buildAgeCategoryPromptBlock(ageCategory: AgeCategory): string {
  const hints: Record<AgeCategory, string> = {
    adult_18_24: 'More explanation, less abstraction. Do not assume high recovery/therapeutic vocabulary.',
    adult_25_39: 'Normal adult recovery/relationship formulation.',
    adult_40_plus: 'More space for life timeline, grief, parenthood, long-term patterns — only when context supports it.',
    unknown_adult: 'Safe adult default. Not too abstract.',
  };
  return [
    '[AGE / COMMUNICATION CONTEXT]',
    `ageCategory: ${ageCategory}`,
    `Hint: ${hints[ageCategory]}`,
    'Use age only as a communication-depth signal. Do not stereotype. Adjust abstraction level to the user\'s language, emotional load, recovery phase, and safety context.',
  ].join('\n');
}

/**
 * Communication depth baseline for adult users.
 * Used by formulation engines and prompt builders to determine maximum depth.
 */
export const ADULT_COMMUNICATION_DEPTH = {
  /** Full therapeutic vocabulary available */
  therapeuticVocabulary: 'full',
  /** Direct substance discussion (no euphemisms) */
  substanceDiscussion: 'direct',
  /** Adult relationship dynamics (intimacy, codependency, boundaries) */
  relationshipDepth: 'full_adult',
  /** Emotional regulation assumes adult cognitive capacity */
  emotionalRegulation: 'adult_capacity',
  /** Boundary-setting assumes full autonomy */
  boundaryAutonomy: 'full',
  /** Crisis intervention assumes adult decision-making */
  crisisIntervention: 'adult_protocol',
} as const;

/**
 * Validate that the app is being used by an adult.
 * Returns true always (18+ is the only supported category).
 * Exists as a foundation for future age-gating if needed.
 */
export function isAdultUser(): boolean {
  return true;
}

/**
 * Get the communication depth modifier for the current age category.
 * Returns 1.0 for adults (no reduction).
 */
export function getAgeCommunicationModifier(): number {
  return 1.0;
}
