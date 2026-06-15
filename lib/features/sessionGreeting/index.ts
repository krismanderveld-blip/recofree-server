/**
 * Session Greeting Engine — Barrel Export
 */

// V1 (legacy, kept for backward compat)
export { runSessionGreetingEngine } from './sessionGreetingEngine';
export type { SessionGreetingResult, SessionGreetingEngineOptions } from './sessionGreetingEngine';

export { evaluateGreetingFreshness } from './evaluateGreetingFreshness';
export type { EvaluateGreetingFreshnessInput } from './evaluateGreetingFreshness';

export { buildGreetingAnchorCandidates } from './buildGreetingAnchorCandidates';
export type { BuildGreetingAnchorCandidatesInput } from './buildGreetingAnchorCandidates';

export { resolveGreetingAnchorPriority } from './resolveGreetingAnchorPriority';

export { resolveSchemaRotationAnchor } from './resolveSchemaRotationAnchor';
export type { ResolveSchemaRotationInput, SchemaRotationResult } from './resolveSchemaRotationAnchor';

export { buildGreetingPromptPayload, enforceGreetingOutputRules } from './buildGreetingPromptPayload';
export type { GreetingPromptPayload } from './buildGreetingPromptPayload';

// V3 (synthesis model)
export { sessionGreetingEngineV3 } from './sessionGreetingEngineV3';
export type { SessionGreetingV3EngineResult } from './sessionGreetingEngineV3';

export { resolveGreetingOverride } from './resolveGreetingOverride';
export type { ResolveGreetingOverrideInput } from './resolveGreetingOverride';

export { buildGreetingSynthesisCandidates } from './buildGreetingSynthesisCandidates';

export { selectGreetingSynthesisSources } from './selectGreetingSynthesisSources';
export type { SelectSynthesisSourcesInput } from './selectGreetingSynthesisSources';

export {
  buildGreetingSynthesisPromptPayload,
  enforceGreetingOutputRulesV3,
  getForbiddenPatterns,
  buildCrisisOverridePrompt,
  buildFirstSessionOverridePrompt,
  buildMissingDataOverridePrompt,
} from './buildGreetingSynthesisPrompt';

export { selectMostEmotionallyRelevantMoodMetric } from './selectMoodMetric';

export * from './sessionGreeting.types';
export * from './sessionGreetingV3.types';
export * from './timeHelpers';
