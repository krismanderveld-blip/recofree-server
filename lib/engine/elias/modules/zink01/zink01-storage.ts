/**
 * ZINK01 — Meaning/Purpose Module (Elias only)
 * STORAGE: Builds storage patch and merges progress
 */
import type { ZINK01RuntimeInput, ZINK01DetectionResult, ZINK01StoragePatch, ZINK01StorageState } from './zink01-types';
import { createDefaultZINK01Storage } from './zink01-types';

export function buildZINK01StoragePatch(
  input: ZINK01RuntimeInput,
  result: ZINK01DetectionResult,
): Partial<ZINK01StoragePatch> {
  if (result.activationStatus !== 'ACTIVE') return {};

  return {
    lastActivatedModuleId: 'ZINK01',
    lastActivatedAt: input.timestampIso,
    confidenceScore: result.confidenceScore,
    matchedMarkers: result.matchedMarkers,
    selectedResponseMode: result.responseMode,
    meaningVacuum: input.context.meaningVacuum,
    existentialDread: input.context.existentialDread,
    purposeAfterRecovery: input.context.purposeAfterRecovery,
    nihilismDetected: input.context.nihilismDetected,
  };
}

export function updateZINK01Progress(
  current: ZINK01StorageState | undefined,
  patch: Partial<ZINK01StoragePatch>,
): ZINK01StorageState {
  const state = current ?? createDefaultZINK01Storage();
  if (!patch.lastActivatedAt) return state;

  return {
    ...state,
    activationCount: state.activationCount + 1,
    lastActivatedAt: patch.lastActivatedAt,
    lastResponseMode: patch.selectedResponseMode ?? state.lastResponseMode,
    meaningVacuumCount: state.meaningVacuumCount + (patch.meaningVacuum ? 1 : 0),
    meaningActionCount: state.meaningActionCount + (patch.selectedResponseMode === 'ONE_MEANING_CARRYING_ACTION' ? 1 : 0),
  };
}
