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

export const AGE_CATEGORY = 'adult_18_plus' as const;
export type AgeCategory = typeof AGE_CATEGORY;

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
