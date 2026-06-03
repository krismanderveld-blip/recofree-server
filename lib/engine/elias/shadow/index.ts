/**
 * SW01 Shadow Work — Elias Only
 * Barrel export for the shadow work module.
 */

export * from './sw01_shadow_types';
export { detectShadowSignals, buildShadowSignal, hasShadowMarkers } from './sw01_trigger_detector';
export { routeZuchtShadow, allowsDeepExploration, allowsPatternDetection, requiresContainment, requiresInterruption, getDepthDescription } from './sw01_zucht_router';
export { SHADOW_RELAPSE_LOOPS, matchRelapseLoop, getLoopById } from './sw01_relapse_loops';
export { detectProjectionIntensity, detectRelationalCategory, getRelationalPattern, buildProjectionEntry, getProjectionQuestions } from './sw01_projection_mapper';
export { selectJournalProtocol, getJournalPrompts, getSingleJournalPrompt, ALL_JOURNAL_PROTOCOLS, CHAPTER_REFLECTIONS } from './sw01_journaling_prompts';
export { computeSW01Directive, buildSW01PromptBlock, selectInterventionMode } from './sw01_prompt_injector';
export { getSW01SessionState, resetSW01SessionState, updateSW01SessionState, updateSW01Progress } from './sw01_storage_contract';
