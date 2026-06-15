/**
 * Memory patch builder for Kim Cluster 2 (GEVAAR-K01 + KIND-K01)
 * All writes are Kim-scoped only — never touches Elias memory
 */

import type {
  KimCluster2DetectionResult,
  KimCluster2MemoryPatch,
  KimCluster2TriggerPatternPatch,
  KimCluster2ProjectionPatch,
  KimCluster2LogEntryPatch,
} from './kimDangerChildCluster.types';

export function buildDangerChildMemoryPatch(
  detection: KimCluster2DetectionResult,
  sessionId: string,
  turnId: string,
): KimCluster2MemoryPatch {
  const now = new Date().toISOString();

  const triggerPatterns: KimCluster2TriggerPatternPatch[] = [];
  const projections: KimCluster2ProjectionPatch[] = [];

  // Build trigger patterns from danger categories
  if (detection.dangerCategories) {
    for (const category of detection.dangerCategories) {
      triggerPatterns.push({
        triggerId: `${detection.moduleId}_${category}_${Date.now()}`,
        label: category,
        normalizedLabel: category.toLowerCase().replace(/_/g, ' '),
        category,
        firstDetectedAt: now,
        lastUpdatedAt: now,
        frequencyIncrement: 1,
        sourceModuleId: detection.moduleId,
      });
    }
  }

  // Build trigger patterns from child safety categories
  if (detection.childSafetyCategories) {
    for (const category of detection.childSafetyCategories) {
      triggerPatterns.push({
        triggerId: `${detection.moduleId}_${category}_${Date.now()}`,
        label: category,
        normalizedLabel: category.toLowerCase().replace(/_/g, ' '),
        category,
        firstDetectedAt: now,
        lastUpdatedAt: now,
        frequencyIncrement: 1,
        sourceModuleId: detection.moduleId,
      });
    }
  }

  // Build projections (fears/concerns)
  if (detection.moduleId === 'GEVAAR-K01') {
    projections.push({
      projectionId: `gevaar_concern_${Date.now()}`,
      kind: 'fear',
      label: `Danger situation: ${detection.dangerCategories?.join(', ') || 'unknown'}`,
      normalizedLabel: `danger: ${detection.dangerCategories?.join(', ') || 'unknown'}`,
      decayScoreInitial: 0.9,
      sourceModuleId: 'GEVAAR-K01',
      firstDetectedAt: now,
      lastUpdatedAt: now,
    });
  }

  if (detection.moduleId === 'KIND-K01') {
    projections.push({
      projectionId: `kind_concern_${Date.now()}`,
      kind: 'concern',
      label: `Child safety: ${detection.childSafetyCategories?.join(', ') || 'unknown'}`,
      normalizedLabel: `child safety: ${detection.childSafetyCategories?.join(', ') || 'unknown'}`,
      decayScoreInitial: 0.95,
      sourceModuleId: 'KIND-K01',
      firstDetectedAt: now,
      lastUpdatedAt: now,
    });
  }

  // Build log entry
  const logEntry: KimCluster2LogEntryPatch = {
    logId: `${detection.moduleId}_log_${Date.now()}`,
    sessionId,
    turnId,
    timestampIso: now,
    moduleId: detection.moduleId,
    responseMode: detection.responseMode,
    matchedMarkers: detection.matchedMarkers,
    crisisNumbersShown: detection.crisisNumbersToShow,
    storePolicy: 'local_kim_scoped_only',
    rawTextStored: false,
  };

  return {
    persona: 'kim',
    moduleId: detection.moduleId,
    storageTargets: ['user.dat', 'projections.dat', 'logs.dat'],
    triggerPatterns,
    projections,
    logEntry,
  };
}
