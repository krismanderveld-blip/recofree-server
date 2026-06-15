/**
 * Kim Cluster 4 — Memory Patch Builder
 * Kim-scoped only — never touches Elias memory.
 */

import type {
  KimCluster4DetectionResult,
  KimCluster4MemoryPatchEntry,
} from './kimCluster4.types';

export function buildKimCluster4MemoryPatch(
  result: KimCluster4DetectionResult,
  timestamp: string
): KimCluster4MemoryPatchEntry {
  return {
    timestamp,
    moduleId: result.moduleId,
    activationStatus: result.activationStatus,
    confidenceScore: result.confidenceScore,
    themes: result.themes,
    responseMode: result.responseMode,
    matchedMarkerCount: result.matchedMarkers.length,
    crisisNumbersShown: result.crisisNumbersToShow,
    persona: 'kim',
  };
}
