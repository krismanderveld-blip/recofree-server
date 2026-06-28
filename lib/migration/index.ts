/**
 * Migration Harness — Phase 0
 *
 * Re-exports all migration infrastructure for convenient access.
 */

// Engine mode feature flag
export {
  type EngineMode,
  getEngineMode,
  setEngineMode,
  shouldRunClientEngine,
  shouldCallServerEngine,
  isClientEngineActive,
  isServerEngineActive,
  shouldRunClientCrisisNet,
} from './engine-mode';

// Canonical types
export type {
  CanonicalEngineInput,
  DeviceTimeContextPayload,
  VspSectionPayload,
  MoodSlidersPayload,
  ConversationMessage,
  UserDatSummaryPayload,
  LogsSessionPayload,
  EngineRequestType,
} from './engine-input.types';

export type {
  CanonicalEngineOutput,
  NormalizedRegulationResult,
  NormalizedProjectionUpdate,
  NormalizedModuleActivation,
  EngineStatePatches,
  EngineProcessResponse,
} from './engine-output.types';

// Shadow logging
export {
  type ShadowMismatchSeverity,
  type ShadowFieldComparison,
  type ShadowLogEntry,
  type ShadowLogStore,
  compareEngineOutputs,
} from './shadow-log';

export { createShadowLogStore } from './shadow-log-store';

// Golden testset
export {
  type GoldenTestCategory,
  type GoldenTestCase,
  appendGoldenTestCase,
  readGoldenTestCases,
  getGoldenTestsByCategory,
  clearGoldenTestCases,
  detectGoldenCategory,
  DETERMINISTIC_FIELDS,
  SEMANTIC_FIELDS,
} from './golden-testset';
