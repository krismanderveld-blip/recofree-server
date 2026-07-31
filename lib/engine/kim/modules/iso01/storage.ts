/**
 * ISO01 Storage Patch Builder — Isolatie en Sociale Terugtrekking (Kim only)
 */
import type { ISO01RuntimeInput, ISO01DetectionResult, ISO01StoragePatch } from './types';

export function buildISO01StoragePatch(
  input: ISO01RuntimeInput,
  result: ISO01DetectionResult
): Partial<ISO01StoragePatch> {
  if (result.activationStatus !== 'ACTIVE') return {};

  const bridgeModuleSuggested: ISO01StoragePatch['bridgeModuleSuggested'] =
    result.routeNext === 'KSC01' ? 'KSC01' :
    result.routeNext === 'KBR01' ? 'KBR01' :
    result.routeNext === 'KDL01' ? 'KDL01' :
    result.routeNext === 'CDP01' ? 'CDP01' :
    result.routeNext === 'RNW01' ? 'RNW01' :
    null;

  return {
    persona: 'kim',
    storagePath: 'local://recofree/personas/kim/user.dat.modules.ISO01',
    lastActivatedModuleId: 'ISO01',
    lastActivatedAt: input.timestampIso,
    responseMode: result.responseMode,
    socialWithdrawal: input.socialWithdrawal,
    shameAboutTalking: input.shameAboutTalking,
    burdenFear: input.burdenFear,
    protectiveIsolation: input.protectiveIsolation,
    exhaustionIsolation: input.exhaustionIsolation,
    painfulLoneliness: input.painfulLoneliness,
    bridgeModuleSuggested,
  };
}
