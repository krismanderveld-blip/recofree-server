/**
 * Kim Cluster 4 — Memory Patch Builder
 * Kim-scoped only — never touches Elias memory.
 */

import type {
  KimCluster4DetectionResult,
  KimCluster4MemoryPatch,
} from './kimCluster4.types';

export function buildKimCluster4MemoryPatch(
  result: KimCluster4DetectionResult,
  timestamp: string
): KimCluster4MemoryPatch {
  return {
    persona: 'kim',
    moduleId: result.moduleId,
    userDat: {
      triggerPatterns: result.themes,
      lastUpdatedAt: timestamp,
      frequency: 1,
      sourceModuleId: result.moduleId,
    },
    projectionsDat: [],
    logsDat: {
      moduleId: result.moduleId,
      themes: result.themes,
      responseMode: result.responseMode,
      timestamp,
      encrypted: true,
      rawText: false,
    },
  };
}
