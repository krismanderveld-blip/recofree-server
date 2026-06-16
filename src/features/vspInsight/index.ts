/**
 * VSP Insight System — Barrel Export
 *
 * The VSP Insight layer sits ABOVE the immutable deterministic safety core.
 * It may READ safety core output but NEVER MUTATE it.
 * Silent discrepancy is stored locally only — never communicated.
 * store:false enforced on all GPT calls.
 */

// Types
export * from "./vspInsightTypes";

// Core detectors
export { detectVspInsightState } from "./detectVspInsightState";
export type { DetectVspInsightStateInput, DetectVspInsightStateResult } from "./detectVspInsightState";

export { detectRationalGreenSignals, extractRationalGreenMarkers, messageLacksFeelingWords } from "./detectRationalGreenSignals";
export type { DetectRationalGreenInput, DetectRationalGreenResult } from "./detectRationalGreenSignals";

export { detectOverwhelmSignals, extractOverwhelmMarkers } from "./detectOverwhelmSignals";
export type { DetectOverwhelmInput, DetectOverwhelmResult } from "./detectOverwhelmSignals";

// Router
export { routeVspInsight } from "./vspInsightRouter";
export type { VspInsightRouterInput, VspInsightRouterResult } from "./vspInsightRouter";

// Chat signal adapter
export { extractChatSignals, mergeChatSignals, createEmptyChatSignals } from "./vspChatSignalAdapter";

// Storage
export {
  loadVspInsightProfile,
  saveVspInsightProfile,
  applyVspInsightProfilePatch,
  loadDiscrepancyEvents,
  appendDiscrepancyEvent,
  loadPhaseTransitions,
  appendPhaseTransition,
  loadSoothingEffects,
  appendSoothingEffect,
  saveLastSoothingChoice,
  loadLastSoothingChoice,
  clearVspInsightData,
} from "./vspInsightStorage";

// Phase tracker
export {
  detectPhaseTransition,
  candidateToExample,
  createPhaseTrackerState,
} from "./vspInsightPhaseTracker";
export type { PhaseTrackerState } from "./vspInsightPhaseTracker";

// Kim variant
export {
  mapToKimInsightState,
  routeKimVspInsight,
  detectKimOverwhelmBoost,
  detectKimRationalGreenBoost,
} from "./kimVspVariant";
export type { KimVspRouterInput, KimVspRouterResult } from "./kimVspVariant";

// PDF export
export { buildPdfSections, buildPdfPlainText } from "./vspInsightPdfExport";
export type { VspPdfSection } from "./vspInsightPdfExport";
