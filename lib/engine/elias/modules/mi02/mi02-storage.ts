/**
 * MI02 — Motivational Interviewing Verdieping (Elias only)
 * STORAGE: Patch builder for user.dat persistence (Elias only)
 */
import type { MI02RuntimeInput, MI02DetectionResult, MI02StoragePatch } from './mi02-types';

export function buildMI02StoragePatch(
  input: MI02RuntimeInput,
  result: MI02DetectionResult,
): Partial<MI02StoragePatch> {
  if (result.activationStatus !== 'ACTIVE') return {};

  return {
    lastActivatedModuleId: 'MI02',
    lastActivatedAt: input.timestampIso,
    responseMode: result.responseMode,
    oarsTechnique: result.oarsTechnique,
    changeTalkPresent: input.changeTalkPresent,
    sustainTalkPresent: input.sustainTalkPresent,
    directAmbivalenceMarker: input.directAmbivalenceMarker,
    readinessScore: input.readinessScore,
    externalMotivationDominant: input.externalMotivationDominant,
  };
}
