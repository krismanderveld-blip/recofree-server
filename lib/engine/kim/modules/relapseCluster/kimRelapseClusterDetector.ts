/**
 * Kim Relapse Cluster Detector
 * Deterministic engine-driven module activation.
 * GPT never decides module activation.
 */
import type {
  KimRelapseClusterRuntimeInput,
  KimRelapseClusterDetectionResult,
  KimRelapseClusterDetectedMarker,
  KimRelapseClusterLanguage,
} from './kimRelapseCluster.types';
import type { MarkerDefinition } from './kimRelapseClusterMarkers.nl';
import { NL_MARKERS } from './kimRelapseClusterMarkers.nl';
import { EN_MARKERS } from './kimRelapseClusterMarkers.en';
import { FR_MARKERS } from './kimRelapseClusterMarkers.fr';

const ALL_MARKERS: MarkerDefinition[] = [...NL_MARKERS, ...EN_MARKERS, ...FR_MARKERS];

/**
 * Scan the normalized message against all marker patterns and return matched markers.
 */
export function scanMarkers(normalizedMessage: string): KimRelapseClusterDetectedMarker[] {
  const matched: KimRelapseClusterDetectedMarker[] = [];

  for (const def of ALL_MARKERS) {
    const match = def.pattern.exec(normalizedMessage);
    if (match) {
      const lang: KimRelapseClusterLanguage = def.markerId.startsWith('nl_')
        ? 'nl'
        : def.markerId.startsWith('en_')
          ? 'en'
          : 'fr';

      matched.push({
        markerId: def.markerId,
        moduleCandidate: def.moduleCandidate,
        phrase: match[0],
        language: lang,
        confidence: def.confidence,
        markerType: def.markerType,
      });
    }
  }

  return matched;
}

/**
 * Main detector function.
 * Priority: CRISIS-K01 > HERV-K01 > NAHERV-K01
 */
export function detectKimRelapseClusterModule(
  input: KimRelapseClusterRuntimeInput
): KimRelapseClusterDetectionResult {
  // Persona guard: Kim-only
  if (input.persona !== 'kim') {
    return {
      selectedModuleId: null,
      phase: 'NOT_RELAPSE_RELATED',
      confidence: 0,
      safetyRiskLevel: 'NONE',
      crisisEscalationRoute: 'NONE',
      matchedMarkers: [],
      routeNext: 'NO_MODULE',
      reason: 'Kim relapse cluster is Kim-only.',
    };
  }

  // Use provided markers or scan from message
  const markers = input.detectedMarkers.length > 0
    ? input.detectedMarkers
    : scanMarkers(input.normalizedMessage);

  // 1. Check for crisis signals (highest priority)
  const crisisMarkerTypes = ['acute_danger', 'violence', 'suicide_self_harm', 'medical_emergency', 'disappearance'];
  const crisisMarkers = markers.filter(m => crisisMarkerTypes.includes(m.markerType));

  const hasCrisisFlags =
    input.explicitAcuteDanger ||
    input.explicitMedicalEmergency ||
    input.explicitSelfHarmRiskLovedOne ||
    input.explicitSelfHarmRiskCaregiver ||
    input.explicitViolenceRisk ||
    input.explicitDisappearance ||
    input.explicitImpairedDrivingRisk ||
    input.explicitChildSafetyRisk ||
    input.caregiverState === 'panicked' ||
    input.caregiverState === 'unsafe';

  if (hasCrisisFlags || crisisMarkers.length > 0) {
    const allCrisisMarkers = crisisMarkers.length > 0 ? crisisMarkers : markers;
    const maxConf = allCrisisMarkers.length > 0
      ? Math.max(...allCrisisMarkers.map(m => m.confidence))
      : 0.9;

    // Determine safety risk level
    let safetyRisk = input.safetyRiskLevel;
    if (
      input.explicitAcuteDanger ||
      input.explicitMedicalEmergency ||
      input.explicitViolenceRisk ||
      input.explicitChildSafetyRisk ||
      input.caregiverState === 'unsafe'
    ) {
      safetyRisk = 'IMMEDIATE';
    } else if (
      input.explicitSelfHarmRiskLovedOne ||
      input.explicitSelfHarmRiskCaregiver ||
      input.explicitDisappearance ||
      input.explicitImpairedDrivingRisk
    ) {
      safetyRisk = 'HIGH';
    } else if (input.caregiverState === 'panicked') {
      safetyRisk = 'HIGH';
    } else if (crisisMarkers.some(m => m.markerType === 'violence' || m.markerType === 'acute_danger')) {
      safetyRisk = 'HIGH';
    } else if (crisisMarkers.length > 0) {
      safetyRisk = 'MODERATE';
    }

    // Determine crisis escalation route
    let crisisRoute = resolveEscalationRoute(input, crisisMarkers);

    return {
      selectedModuleId: 'CRISIS-K01',
      phase: 'ACUTE_UNCERTAINTY_OR_DANGER',
      confidence: maxConf,
      safetyRiskLevel: safetyRisk,
      crisisEscalationRoute: crisisRoute,
      matchedMarkers: allCrisisMarkers,
      routeNext: 'CRISIS-K01',
      reason: 'Acute crisis detected: ' + (crisisMarkers.map(m => m.markerType).join(', ') || 'explicit flags'),
    };
  }

  // 2. Check for active relapse markers (HERV-K01)
  const activeRelapseMarkers = markers.filter(
    m => m.moduleCandidate === 'HERV-K01' && ['active_use', 'imminent_use', 'boundary_rescue_pressure'].includes(m.markerType)
  );

  if (activeRelapseMarkers.length > 0) {
    return {
      selectedModuleId: 'HERV-K01',
      phase: 'ACTIVE_RELAPSE_NOW',
      confidence: Math.max(...activeRelapseMarkers.map(m => m.confidence)),
      safetyRiskLevel: input.safetyRiskLevel,
      crisisEscalationRoute: 'NONE',
      matchedMarkers: activeRelapseMarkers,
      routeNext: 'HERV-K01',
      reason: 'Loved one active relapse/use detected from caregiver perspective.',
    };
  }

  // 3. Check for post-relapse markers (NAHERV-K01)
  const postRelapseMarkers = markers.filter(
    m => m.moduleCandidate === 'NAHERV-K01' && ['post_relapse', 'aftercare_conversation'].includes(m.markerType)
  );

  if (postRelapseMarkers.length > 0) {
    return {
      selectedModuleId: 'NAHERV-K01',
      phase: 'POST_RELAPSE_AFTERSHOCK',
      confidence: Math.max(...postRelapseMarkers.map(m => m.confidence)),
      safetyRiskLevel: input.safetyRiskLevel,
      crisisEscalationRoute: 'NONE',
      matchedMarkers: postRelapseMarkers,
      routeNext: 'NAHERV-K01',
      reason: 'Post-relapse aftermath detected from caregiver perspective.',
    };
  }

  // 4. Check for caregiver overwhelm without other relapse markers
  const overwhelmMarkers = markers.filter(m => m.markerType === 'caregiver_overwhelm');
  if (overwhelmMarkers.length > 0) {
    return {
      selectedModuleId: 'CRISIS-K01',
      phase: 'ACUTE_UNCERTAINTY_OR_DANGER',
      confidence: Math.max(...overwhelmMarkers.map(m => m.confidence)),
      safetyRiskLevel: 'MODERATE',
      crisisEscalationRoute: 'CRISIS_K01',
      matchedMarkers: overwhelmMarkers,
      routeNext: 'CRISIS-K01',
      reason: 'Caregiver acute overwhelm detected.',
    };
  }

  // 5. No relapse cluster activation
  return {
    selectedModuleId: null,
    phase: 'NOT_RELAPSE_RELATED',
    confidence: 0,
    safetyRiskLevel: 'NONE',
    crisisEscalationRoute: 'NONE',
    matchedMarkers: [],
    routeNext: 'NO_MODULE',
    reason: 'No Kim relapse-cluster activation marker detected.',
  };
}

/**
 * Resolve the crisis escalation route based on input flags and markers.
 * Uses Belgian crisis number 1813 for suicide prevention.
 */
function resolveEscalationRoute(
  input: KimRelapseClusterRuntimeInput,
  crisisMarkers: KimRelapseClusterDetectedMarker[]
): import('./kimRelapseCluster.types').KimCrisisEscalationRoute {
  // Immediate life-threatening → 112
  if (
    input.explicitMedicalEmergency ||
    input.explicitAcuteDanger ||
    crisisMarkers.some(m => m.markerType === 'medical_emergency')
  ) {
    return 'CALL_112';
  }

  // Violence with immediate danger → 112 or 101
  if (input.explicitViolenceRisk || crisisMarkers.some(m => m.markerType === 'violence')) {
    if (input.caregiverState === 'unsafe' || input.explicitChildSafetyRisk) {
      return 'CALL_112';
    }
    return 'CALL_101';
  }

  // Impaired driving → 112
  if (input.explicitImpairedDrivingRisk) {
    return 'CALL_112';
  }

  // Child safety → 112 if immediate, 1712 if not
  if (input.explicitChildSafetyRisk) {
    if (input.caregiverState === 'unsafe' || input.safetyRiskLevel === 'IMMEDIATE') {
      return 'CALL_112';
    }
    return 'CONTACT_1712';
  }

  // Suicide/self-harm → 1813
  if (
    input.explicitSelfHarmRiskLovedOne ||
    input.explicitSelfHarmRiskCaregiver ||
    crisisMarkers.some(m => m.markerType === 'suicide_self_harm')
  ) {
    // If immediate physical danger alongside suicide risk → 112
    if (input.explicitAcuteDanger || input.safetyRiskLevel === 'IMMEDIATE') {
      return 'CALL_112';
    }
    return 'CALL_1813';
  }

  // Disappearance with danger
  if (input.explicitDisappearance || crisisMarkers.some(m => m.markerType === 'disappearance')) {
    return 'CONTACT_PROFESSIONAL_SUPPORT';
  }

  // Default crisis stabilisation
  return 'CRISIS_K01';
}
