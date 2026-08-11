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
  compareEngineOutputs,
} from './shadow-log';

// Input builder
export { buildCanonicalEngineInput } from './build-engine-input';
export type { BuildEngineInputParams } from './build-engine-input';

// Patch writer (client-side state patch application)
export { applyServerPatches } from './patch-writer';
export type { ServerStatePatches, PatchWriteResult } from './patch-writer';

// Server-active client (Checkpoint F)
export {
  callServerEngine,
  dispatchEngine,
} from './server-active-client';
export type {
  ServerEngineCallResult,
  ServerEngineCallInput,
  EngineDispatchResult,
} from './server-active-client';
