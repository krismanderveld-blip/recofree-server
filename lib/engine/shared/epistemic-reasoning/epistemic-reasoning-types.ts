/**
 * FASE 9A: Core Epistemic Reasoning Engine — Type Definitions
 *
 * Deterministic reasoning layer that prevents:
 * - treating interpretations as facts
 * - using hypotheses as certainties
 * - filling in motives without evidence
 * - medical/recovery claims without treatment team
 * - wrong responsibility attribution
 * - pushing caregiver into rescue role
 * - using old memory as current truth
 * - following craving/shame stories as fact
 *
 * Engine beslist. GPT levert alleen taal.
 */

// ─── 1. EpistemicPersona ───────────────────────────────────────────────────────

export type EpistemicPersona = 'elias' | 'kim';

// ─── 2. EpistemicClaimCategory ─────────────────────────────────────────────────

export type EpistemicClaimCategory =
  | 'observable_fact'
  | 'user_emotion'
  | 'user_interpretation'
  | 'causal_hypothesis'
  | 'medical_or_clinical_claim'
  | 'responsibility_claim'
  | 'action_impulse'
  | 'safety_relevant_claim'
  | 'uncertainty_marker'
  | 'mindreading_risk'
  | 'memory_supported_pattern'
  | 'memory_hypothesis'
  | 'relational_harm_claim'
  | 'recovery_risk_claim'
  | 'protective_factor_claim';

// ─── 3. EpistemicCertainty ─────────────────────────────────────────────────────

export type EpistemicCertainty =
  | 'known'
  | 'likely'
  | 'plausible'
  | 'uncertain'
  | 'unsupported'
  | 'not_assessable';

// ─── 4. EpistemicResponsibilityOwner ───────────────────────────────────────────

export type EpistemicResponsibilityOwner =
  | 'user'
  | 'caregiver'
  | 'dependent_person'
  | 'other_person'
  | 'treatment_team'
  | 'shared_relationship'
  | 'safety_services'
  | 'unknown';

// ─── 5. EpistemicRiskLevel ─────────────────────────────────────────────────────

export type EpistemicRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'acute';

// ─── 6. EpistemicClaim ─────────────────────────────────────────────────────────

export interface EpistemicClaim {
  id: string;
  persona: EpistemicPersona;
  category: EpistemicClaimCategory;
  text: string;
  certainty: EpistemicCertainty;
  responsibilityOwner: EpistemicResponsibilityOwner;
  riskLevel: EpistemicRiskLevel;
  shouldValidateEmotion: boolean;
  shouldTreatAsFact: boolean;
  shouldTreatAsHypothesis: boolean;
  shouldAvoidAttribution: boolean;
  shouldAvoidMedicalCertainty: boolean;
  shouldAvoidRescueAdvice: boolean;
  shouldPreferBoundaryLanguage: boolean;
  shouldPreferAgencyLanguage: boolean;
  source: 'current_message' | 'cmd_selected_memory' | 'dist01' | 'vsp' | 'erp' | 'backpack' | 'state' | 'unknown';
}

// ─── 7. EpistemicResponsibilityMap ─────────────────────────────────────────────

export interface EpistemicResponsibilityMap {
  userOwns: string[];
  caregiverOwns: string[];
  dependentPersonOwns: string[];
  otherPersonOwns: string[];
  treatmentTeamOwns: string[];
  sharedRelationshipOwns: string[];
  safetyServicesOwn: string[];
  unknownOrUnclear: string[];
}

// ─── 8. EpistemicAdviceGuard ───────────────────────────────────────────────────

export interface EpistemicAdviceGuard {
  validateEmotion: boolean;
  separateFactFromInterpretation: boolean;
  keepMultipleExplanationsOpen: boolean;
  avoidMindReading: boolean;
  avoidMedicalCertainty: boolean;
  avoidRescueRole: boolean;
  avoidControlAdvice: boolean;
  preferBoundaryLanguage: boolean;
  preferAgencyLanguage: boolean;
  preferTreatmentTeamReferral: boolean;
  requireRegulationBeforeAnalysis: boolean;
  doNotUseOldMemoryAsCurrentFact: boolean;
  doNotTreatShameAsIdentity: boolean;
  doNotFollowCravingStory: boolean;
  doNotOverrideSafety: boolean;
}

// ─── 9. EpistemicModelRoutingHints ─────────────────────────────────────────────

export interface EpistemicModelRoutingHints {
  epistemicComplexityScore: number;
  responsibilityComplexityScore: number;
  medicalUncertainty: boolean;
  mindReadingRisk: boolean;
  contradictionDetected: boolean;
  rescueRoleRisk: boolean;
  relapseRisk: boolean;
  relationalHarmRisk: boolean;
  safetyRelevant: boolean;
  recommendedModelTier: 'mini' | 'full';
  reasonCodes: string[];
}

// ─── 10. CoreEpistemicReasoningInput ───────────────────────────────────────────

export interface CoreEpistemicReasoningInput {
  persona: EpistemicPersona;
  userMessage: string;
  normalizedMessage?: string | null;
  currentZone?: string | null;
  cravingLevel?: number | null;
  stressLevel?: number | null;
  cmdSelectedDomains?: string[];
  cmdSelectedItemsCount?: number;
  cmdEstimatedTokens?: number;
  nowLocal: string;
}

// ─── 11. CoreEpistemicReasoningOutput ──────────────────────────────────────────

export interface CoreEpistemicReasoningOutput {
  active: boolean;
  persona: EpistemicPersona;
  claims: EpistemicClaim[];
  responsibilityMap: EpistemicResponsibilityMap;
  adviceGuard: EpistemicAdviceGuard;
  modelRoutingHints: EpistemicModelRoutingHints;
  mustAvoidPhrases: string[];
  mustPreferPhrases: string[];
  warnings: string[];
}
