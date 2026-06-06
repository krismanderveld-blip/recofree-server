/**
 * KST01 — Stoicism for Caregivers (Kim only)
 * ROUTER: Determines next module target based on detection result
 */

import type {
  KST01DetectionResult,
  KST01OutputContract,
  KST01StorageState,
  KimModuleRouteTarget,
  KST01RouteLabel,
} from './kst01-types';
import { buildKST01PromptPayload } from './kst01-prompt';
import { buildKST01StoragePatch } from './kst01-storage';

/**
 * Routing rules:
 * - KST01 → KDL01 when CONNECTED_NOT_CONSUMED mode (boundary/love conflict dominant)
 * - KST01 → KBR01 when boundary planning is needed
 * - KST01 → KSC01 when caregiver shame is primary
 * - KST01 → K06_SAFETY when crisisLevel >= 2
 */
export function routeKST01(
  detection: KST01DetectionResult,
  previousStorage?: KST01StorageState,
): KST01OutputContract {
  const promptPayload = buildKST01PromptPayload(detection);
  const storagePatch = buildKST01StoragePatch(detection, previousStorage);

  // Determine route target
  let routeNext: KimModuleRouteTarget = 'NO_MODULE';

  if (detection.activationStatus === 'BLOCKED_BY_SAFETY') {
    routeNext = 'K06_SAFETY';
  } else if (detection.activationStatus === 'ACTIVE') {
    routeNext = determineNextRoute(detection);
  } else if (detection.activationStatus === 'BLOCKED_WRONG_USER_TYPE') {
    routeNext = 'NO_MODULE';
  }

  return {
    detection,
    promptPayload,
    storagePatch,
    routeNext,
  };
}

function determineNextRoute(detection: KST01DetectionResult): KimModuleRouteTarget {
  // CONNECTED_NOT_CONSUMED → route to KDL01
  if (detection.recommendedMode === 'CONNECTED_NOT_CONSUMED') {
    return 'KDL01_DETACHMENT_WITH_LOVE';
  }

  // If boundary planning is needed (boundary_love_conflict trigger present)
  if (detection.triggers.includes('BOUNDARY_LOVE_CONFLICT') &&
      detection.recommendedMode !== 'CONNECTED_NOT_CONSUMED') {
    return 'KBR01_BOUNDARY_RESTORATION';
  }

  // Self-loss with high shame → route to KSC01
  if (detection.triggers.includes('SELF_LOSS_THROUGH_CARE') &&
      detection.triggers.includes('OVER_RESPONSIBILITY')) {
    return 'KSC01_SELF_COMPASSION_CAREGIVER';
  }

  // Safety exit
  if (detection.recommendedMode === 'SAFETY_EXIT') {
    return 'K06_SAFETY';
  }

  // Default: KST01 handles it directly
  return 'KST01_STOICISM_FOR_CAREGIVERS';
}

export function getKST01RouteLabel(detection: KST01DetectionResult): KST01RouteLabel {
  if (detection.recommendedMode === 'SAFETY_EXIT') return 'SAFETY_EXIT_TO_K06';
  if (detection.recommendedMode === 'CONNECTED_NOT_CONSUMED') return 'CONNECTED_NOT_CONSUMED_TO_KDL01';
  if (detection.triggers.includes('BOUNDARY_LOVE_CONFLICT')) return 'BOUNDARY_PLANNING_TO_KBR01';
  if (detection.triggers.includes('SELF_LOSS_THROUGH_CARE') && detection.triggers.includes('OVER_RESPONSIBILITY')) {
    return 'CAREGIVER_SHAME_TO_KSC01';
  }
  return 'CONTINUE_KIM_PIPELINE';
}
