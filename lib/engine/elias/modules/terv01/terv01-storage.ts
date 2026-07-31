/**
 * TERV01 — Post-Purple Zone Relapse Chain Analysis (Elias only)
 * STORAGE: Patch builder for user.dat persistence (Elias only)
 */
import type { TERV01RuntimeInput, TERV01DetectionResult, TERV01StoragePatch, TERV01ChainMap } from './terv01-types';

export function buildTERV01StoragePatch(
  input: TERV01RuntimeInput,
  result: TERV01DetectionResult,
  finalizedChainMap: Partial<TERV01ChainMap>,
): Partial<TERV01StoragePatch> {
  if (result.activationStatus !== 'ACTIVE') return {};

  return {
    lastActivatedModuleId: 'TERV01',
    lastActivatedAt: input.timestampIso,
    previousSessionId: input.previousSessionId,
    relapseConfirmed: input.relapseConfirmed,
    chainMap: finalizedChainMap,
    chainDataCompleteness: input.chainDataCompleteness,
    selectedResponseMode: result.responseMode,
    preventionPointSelected: finalizedChainMap.firstInterruptionPoint,
    clinicianReadableSummaryCreated: true,
  };
}
