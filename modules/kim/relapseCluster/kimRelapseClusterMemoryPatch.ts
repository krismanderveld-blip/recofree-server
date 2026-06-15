/**
 * Kim Relapse Cluster Memory Patch Builder
 * Builds Kim-scoped patches for user.dat, logs.dat, projections.dat, state.dat.
 * NEVER touches Elias memory layers.
 */
import type {
  KimRelapseClusterDetectionResult,
  KimRelapseClusterMemoryPatch,
  KimTriggerPatternPatch,
  KimProjectionFearPatch,
  KimProjectionHopePatch,
} from './kimRelapseCluster.types';

export function buildKimRelapseClusterMemoryPatch(
  detection: KimRelapseClusterDetectionResult,
  timestampIso: string
): KimRelapseClusterMemoryPatch | null {
  if (!detection.selectedModuleId) return null;

  const patch: KimRelapseClusterMemoryPatch = {
    persona: 'kim',
    moduleId: detection.selectedModuleId,
    storePolicy: 'local_only',
    userDatPatch: {
      triggerPatterns: buildTriggerPatterns(detection, timestampIso),
      moduleUsage: {
        moduleId: detection.selectedModuleId,
        incrementUsage: true,
        lastUsedAt: timestampIso,
      },
    },
    projectionsDatPatch: {
      fears: buildFears(detection, timestampIso),
      hopes: buildHopes(detection, timestampIso),
    },
    stateDatPatch: {
      caregiverState: undefined, // set by caller from runtime input
      lastRelapseRelatedModule: detection.selectedModuleId,
      safetyRiskLevel: detection.safetyRiskLevel,
    },
    logsDatPatch: {
      eventType: 'KIM_RELAPSE_CLUSTER_EVENT',
      selectedModuleId: detection.selectedModuleId,
      phase: detection.phase,
      safetyRiskLevel: detection.safetyRiskLevel,
      crisisEscalationRoute: detection.crisisEscalationRoute,
      timestampIso,
    },
  };

  return patch;
}

function buildTriggerPatterns(
  detection: KimRelapseClusterDetectionResult,
  timestampIso: string
): KimTriggerPatternPatch[] {
  const triggers: KimTriggerPatternPatch[] = [];

  for (const marker of detection.matchedMarkers) {
    let triggerType: KimTriggerPatternPatch['triggerType'];
    switch (marker.markerType) {
      case 'active_use':
        triggerType = 'loved_one_active_use';
        break;
      case 'imminent_use':
        triggerType = 'loved_one_imminent_use';
        break;
      case 'disappearance':
        triggerType = 'loved_one_disappearance';
        break;
      case 'post_relapse':
      case 'aftercare_conversation':
        triggerType = 'post_relapse_conversation';
        break;
      case 'boundary_rescue_pressure':
        triggerType = 'caregiver_rescue_pressure';
        break;
      case 'caregiver_overwhelm':
        triggerType = 'caregiver_overwhelm';
        break;
      default:
        triggerType = 'safety_threat';
        break;
    }

    triggers.push({
      normalizedTrigger: marker.phrase.toLowerCase(),
      label: marker.markerId,
      triggerType,
      incrementFrequency: true,
      lastSeenAt: timestampIso,
    });
  }

  return triggers;
}

function buildFears(
  detection: KimRelapseClusterDetectionResult,
  timestampIso: string
): KimProjectionFearPatch[] {
  const fears: KimProjectionFearPatch[] = [];

  if (detection.phase === 'ACTIVE_RELAPSE_NOW') {
    fears.push({
      normalizedLabel: 'fear_loved_one_relapse',
      label: 'Angst voor herval van naaste',
      category: 'fear_loved_one_relapse',
      decayScoreInput: 0.9,
      lastReinforcedAt: timestampIso,
    });
  }

  if (detection.safetyRiskLevel === 'HIGH' || detection.safetyRiskLevel === 'IMMEDIATE') {
    fears.push({
      normalizedLabel: 'fear_loved_one_death_or_overdose',
      label: 'Angst voor overdosis of dood van naaste',
      category: 'fear_loved_one_death_or_overdose',
      decayScoreInput: 0.95,
      lastReinforcedAt: timestampIso,
    });
  }

  if (detection.matchedMarkers.some(m => m.markerType === 'disappearance')) {
    fears.push({
      normalizedLabel: 'fear_loved_one_disappears',
      label: 'Angst dat naaste verdwijnt',
      category: 'fear_loved_one_disappears',
      decayScoreInput: 0.85,
      lastReinforcedAt: timestampIso,
    });
  }

  if (detection.matchedMarkers.some(m => m.markerType === 'boundary_rescue_pressure')) {
    fears.push({
      normalizedLabel: 'fear_of_setting_boundaries',
      label: 'Angst om grenzen te stellen',
      category: 'fear_of_setting_boundaries',
      decayScoreInput: 0.7,
      lastReinforcedAt: timestampIso,
    });
  }

  return fears;
}

function buildHopes(
  detection: KimRelapseClusterDetectionResult,
  timestampIso: string
): KimProjectionHopePatch[] {
  const hopes: KimProjectionHopePatch[] = [];

  if (detection.phase === 'POST_RELAPSE_AFTERSHOCK') {
    hopes.push({
      normalizedLabel: 'hope_for_calm_conversation',
      label: 'Hoop op een rustig gesprek',
      category: 'hope_for_calm_conversation',
      decayScoreInput: 0.6,
      lastReinforcedAt: timestampIso,
    });
    hopes.push({
      normalizedLabel: 'hope_for_boundary_clarity',
      label: 'Hoop op duidelijke grenzen',
      category: 'hope_for_boundary_clarity',
      decayScoreInput: 0.6,
      lastReinforcedAt: timestampIso,
    });
  }

  if (detection.matchedMarkers.some(m => m.markerType === 'disappearance')) {
    hopes.push({
      normalizedLabel: 'hope_loved_one_returns_safe',
      label: 'Hoop dat naaste veilig terugkomt',
      category: 'hope_loved_one_returns_safe',
      decayScoreInput: 0.8,
      lastReinforcedAt: timestampIso,
    });
  }

  return hopes;
}
