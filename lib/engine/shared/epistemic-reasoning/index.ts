/**
 * FASE 9A: Core Epistemic Reasoning Engine — Exports
 */

// Types
export type {
  EpistemicPersona,
  EpistemicClaimCategory,
  EpistemicCertainty,
  EpistemicResponsibilityOwner,
  EpistemicRiskLevel,
  EpistemicClaim,
  EpistemicResponsibilityMap,
  EpistemicAdviceGuard,
  EpistemicModelRoutingHints,
  CoreEpistemicReasoningInput,
  CoreEpistemicReasoningOutput,
} from './epistemic-reasoning-types';

// Engine functions
export {
  buildCoreEpistemicReasoning,
  extractEpistemicClaims,
  classifyClaimCertainty,
  buildResponsibilityMap,
  buildAdviceGuard,
  validateEpistemicOutput,
  buildEpistemicGuidanceSummary,
} from './epistemic-reasoning-engine';

// Model routing
export type {
  EpistemicModelRoutingInput,
  EpistemicModelRoutingOutput,
} from './epistemic-model-routing';

export {
  resolveEpistemicModelRouting,
} from './epistemic-model-routing';
