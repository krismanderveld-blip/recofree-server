/**
 * Kim Cluster 4 — Detectors
 * HOOP-K01, SCHAAM-K01, ROUW-K01, ISOL-K01
 */

import type {
  KimCluster4RuntimeInput,
  KimCluster4DetectionResult,
  KimCluster4Theme,
  KimCluster4ResponseMode,
} from './kimCluster4.types';
import { applyKimCluster4AcuteOverride } from './kimCluster4AcuteOverrideGate';
import { NL_HOOP_MARKERS, NL_SCHAAM_MARKERS, NL_ROUW_MARKERS, NL_ISOL_MARKERS } from './kimCluster4Markers.nl';
import { EN_HOOP_MARKERS, EN_SCHAAM_MARKERS, EN_ROUW_MARKERS, EN_ISOL_MARKERS } from './kimCluster4Markers.en';
import { FR_HOOP_MARKERS, FR_SCHAAM_MARKERS, FR_ROUW_MARKERS, FR_ISOL_MARKERS } from './kimCluster4Markers.fr';

// ─── Marker Scanner ───────────────────────────────────────────────────────────

function scanMarkers(message: string, patterns: RegExp[]): string[] {
  const matches: string[] = [];
  for (const p of patterns) {
    const m = message.match(p);
    if (m) matches.push(m[0]);
  }
  return matches;
}

// ─── HOOP-K01 Detector ────────────────────────────────────────────────────────

export function detectHoopK01(input: KimCluster4RuntimeInput): KimCluster4DetectionResult {
  const override = applyKimCluster4AcuteOverride(input, 'HOOP-K01');
  if (override.blocked) {
    return {
      moduleId: 'HOOP-K01',
      activationStatus: override.activationStatus,
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      themes: override.activationStatus === 'DEFERRED_TO_CRISIS_K01'
        ? ['suicidal_hopelessness_in_kim']
        : [],
      responseMode: override.responseMode,
      crisisNumbersToShow: override.crisisNumbersToShow,
      routeNext: override.routeNext,
      reason: override.reason,
    };
  }

  // Scan markers
  const allMarkers = [...NL_HOOP_MARKERS, ...EN_HOOP_MARKERS, ...FR_HOOP_MARKERS];
  const matched = scanMarkers(input.message, allMarkers);

  const themes: KimCluster4Theme[] = [];
  if (input.enoughIsEnoughDetected) themes.push('question_enough_is_enough');
  if (input.hopeExhaustionDetected) themes.push('loss_of_hope_in_recovery', 'loss_of_hope_in_relationship');

  // Also detect from markers if semantic flags weren't set
  if (matched.length > 0 && themes.length === 0) {
    themes.push('loss_of_hope_in_relationship');
  }

  if (themes.length === 0 && matched.length === 0) {
    return {
      moduleId: 'HOOP-K01',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      themes: [],
      responseMode: 'ENOUGH_IS_ENOUGH_REFLECTION',
      crisisNumbersToShow: [],
      routeNext: 'NO_MODULE',
      reason: 'No HOOP-K01 marker detected.',
    };
  }

  const confidenceScore =
    input.enoughIsEnoughDetected && input.hopeExhaustionDetected ? 0.94 :
    input.enoughIsEnoughDetected ? 0.90 :
    input.hopeExhaustionDetected ? 0.86 :
    matched.length >= 2 ? 0.82 :
    0.72;

  const responseMode: KimCluster4ResponseMode =
    input.enoughIsEnoughDetected
      ? 'ENOUGH_IS_ENOUGH_REFLECTION'
      : 'LOSS_OF_HOPE_EXPLORATION';

  return {
    moduleId: 'HOOP-K01',
    activationStatus: 'ACTIVE',
    confidenceScore,
    matchedMarkers: [...input.detectedMarkers, ...matched],
    themes: [...new Set(themes)],
    responseMode,
    crisisNumbersToShow: [],
    routeNext: 'HOOP-K01',
    reason: 'Hope exhaustion / enough-is-enough detected in Kim.',
  };
}

// ─── SCHAAM-K01 Detector ──────────────────────────────────────────────────────

export function detectSchaamK01(input: KimCluster4RuntimeInput): KimCluster4DetectionResult {
  const override = applyKimCluster4AcuteOverride(input, 'SCHAAM-K01');
  if (override.blocked) {
    return {
      moduleId: 'SCHAAM-K01',
      activationStatus: override.activationStatus,
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      themes: [],
      responseMode: override.responseMode,
      crisisNumbersToShow: override.crisisNumbersToShow,
      routeNext: override.routeNext,
      reason: override.reason,
    };
  }

  const allMarkers = [...NL_SCHAAM_MARKERS, ...EN_SCHAAM_MARKERS, ...FR_SCHAAM_MARKERS];
  const matched = scanMarkers(input.message, allMarkers);

  const themes: KimCluster4Theme[] = [];
  if (input.shameSecrecyDetected) themes.push('shame_about_loved_one_addiction', 'secrecy_and_withdrawal');
  if (input.socialWithdrawalDetected) themes.push('secrecy_and_withdrawal');

  if (matched.length > 0 && themes.length === 0) {
    themes.push('shame_about_loved_one_addiction');
  }

  if (themes.length === 0 && matched.length === 0) {
    return {
      moduleId: 'SCHAAM-K01',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      themes: [],
      responseMode: 'SHAME_AND_SECRECY',
      crisisNumbersToShow: [],
      routeNext: 'NO_MODULE',
      reason: 'No SCHAAM-K01 marker detected.',
    };
  }

  const confidenceScore =
    input.shameSecrecyDetected && input.socialWithdrawalDetected ? 0.92 :
    input.shameSecrecyDetected ? 0.88 :
    input.socialWithdrawalDetected ? 0.76 :
    matched.length >= 2 ? 0.80 :
    0.65;

  return {
    moduleId: 'SCHAAM-K01',
    activationStatus: 'ACTIVE',
    confidenceScore,
    matchedMarkers: [...input.detectedMarkers, ...matched],
    themes: [...new Set(themes)],
    responseMode: input.socialWithdrawalDetected ? 'GENTLE_RECONNECTION' : 'SHAME_AND_SECRECY',
    crisisNumbersToShow: [],
    routeNext: 'SCHAAM-K01',
    reason: 'Shame/secrecy around loved one\'s addiction detected.',
  };
}

// ─── ROUW-K01 Detector ────────────────────────────────────────────────────────

export function detectRouwK01(input: KimCluster4RuntimeInput): KimCluster4DetectionResult {
  const override = applyKimCluster4AcuteOverride(input, 'ROUW-K01');
  if (override.blocked) {
    return {
      moduleId: 'ROUW-K01',
      activationStatus: override.activationStatus,
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      themes: [],
      responseMode: override.responseMode,
      crisisNumbersToShow: override.crisisNumbersToShow,
      routeNext: override.routeNext,
      reason: override.reason,
    };
  }

  const allMarkers = [...NL_ROUW_MARKERS, ...EN_ROUW_MARKERS, ...FR_ROUW_MARKERS];
  const matched = scanMarkers(input.message, allMarkers);

  const themes: KimCluster4Theme[] = [];
  if (input.ambiguousLossDetected) themes.push('ambiguous_loss', 'living_grief');
  if (input.lostFutureGriefDetected) themes.push('mourning_lost_future');

  if (matched.length > 0 && themes.length === 0) {
    themes.push('ambiguous_loss');
  }

  if (themes.length === 0 && matched.length === 0) {
    return {
      moduleId: 'ROUW-K01',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      themes: [],
      responseMode: 'AMBIGUOUS_LOSS',
      crisisNumbersToShow: [],
      routeNext: 'NO_MODULE',
      reason: 'No ROUW-K01 marker detected.',
    };
  }

  const confidenceScore =
    input.ambiguousLossDetected && input.lostFutureGriefDetected ? 0.94 :
    input.ambiguousLossDetected ? 0.90 :
    input.lostFutureGriefDetected ? 0.86 :
    matched.length >= 2 ? 0.84 :
    0.70;

  const responseMode: KimCluster4ResponseMode =
    input.lostFutureGriefDetected ? 'LOST_FUTURE_GRIEF' : 'AMBIGUOUS_LOSS';

  return {
    moduleId: 'ROUW-K01',
    activationStatus: 'ACTIVE',
    confidenceScore,
    matchedMarkers: [...input.detectedMarkers, ...matched],
    themes: [...new Set(themes)],
    responseMode,
    crisisNumbersToShow: [],
    routeNext: 'ROUW-K01',
    reason: 'Ambiguous loss / living grief detected.',
  };
}

// ─── ISOL-K01 Detector ────────────────────────────────────────────────────────

export function detectIsolK01(input: KimCluster4RuntimeInput): KimCluster4DetectionResult {
  const override = applyKimCluster4AcuteOverride(input, 'ISOL-K01');
  if (override.blocked) {
    return {
      moduleId: 'ISOL-K01',
      activationStatus: override.activationStatus,
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      themes: [],
      responseMode: override.responseMode,
      crisisNumbersToShow: override.crisisNumbersToShow,
      routeNext: override.routeNext,
      reason: override.reason,
    };
  }

  const allMarkers = [...NL_ISOL_MARKERS, ...EN_ISOL_MARKERS, ...FR_ISOL_MARKERS];
  const matched = scanMarkers(input.message, allMarkers);

  const themes: KimCluster4Theme[] = [];
  if (input.socialIsolationDetected) themes.push('social_isolation');
  if (input.lossOfOwnContactsDetected) themes.push('loss_of_own_contacts');
  if (input.shameSecrecyDetected) themes.push('secrecy_and_withdrawal');

  if (matched.length > 0 && themes.length === 0) {
    themes.push('social_isolation');
  }

  if (themes.length === 0 && matched.length === 0) {
    return {
      moduleId: 'ISOL-K01',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      themes: [],
      responseMode: 'SOCIAL_ISOLATION_BY_CAREGIVING',
      crisisNumbersToShow: [],
      routeNext: 'NO_MODULE',
      reason: 'No ISOL-K01 marker detected.',
    };
  }

  const confidenceScore =
    input.socialIsolationDetected && input.lossOfOwnContactsDetected ? 0.92 :
    input.socialIsolationDetected ? 0.88 :
    input.lossOfOwnContactsDetected ? 0.84 :
    input.shameSecrecyDetected ? 0.72 :
    matched.length >= 2 ? 0.78 :
    0.60;

  return {
    moduleId: 'ISOL-K01',
    activationStatus: 'ACTIVE',
    confidenceScore,
    matchedMarkers: [...input.detectedMarkers, ...matched],
    themes: [...new Set(themes)],
    responseMode: 'SOCIAL_ISOLATION_BY_CAREGIVING',
    crisisNumbersToShow: [],
    routeNext: 'ISOL-K01',
    reason: 'Social isolation through caregiving detected.',
  };
}

// ─── Priority Resolver ────────────────────────────────────────────────────────

/**
 * Resolve which Cluster 4 module wins.
 * Priority among Cluster 4 modules (when multiple activate):
 * - ISOL > SCHAAM when isolation is primary
 * - SCHAAM > ISOL when shame is primary
 * - ROUW wins when ambiguous loss is explicit
 * - HOOP wins when enough-is-enough is explicit
 * Default: highest confidence wins.
 *
 * Special interactions:
 * - ISOL wins over SCHAAM if socialIsolation is explicit primary
 * - SCHAAM wins over ISOL if shame is explicit primary and isolation is secondary
 */
export function resolveCluster4Priority(
  input: KimCluster4RuntimeInput
): KimCluster4DetectionResult {
  const hoopResult = detectHoopK01(input);
  const schaamResult = detectSchaamK01(input);
  const rouwResult = detectRouwK01(input);
  const isolResult = detectIsolK01(input);

  // If any deferred to acute, return that (highest priority acute first)
  const deferredResults = [hoopResult, schaamResult, rouwResult, isolResult].filter(
    r => r.activationStatus !== 'ACTIVE' && r.activationStatus !== 'NOT_ACTIVE'
  );
  if (deferredResults.length > 0) {
    // Return the one with highest priority acute route
    const priorityOrder = ['DEFERRED_TO_CRISIS_K01', 'DEFERRED_TO_GEVAAR_K01', 'DEFERRED_TO_KIND_K01', 'DEFERRED_TO_HERV_K01', 'DEFERRED_TO_NAHERV_K01', 'BLOCKED_BY_PERSONA'];
    deferredResults.sort((a, b) =>
      priorityOrder.indexOf(a.activationStatus) - priorityOrder.indexOf(b.activationStatus)
    );
    return deferredResults[0];
  }

  // Collect active results
  const activeResults = [hoopResult, schaamResult, rouwResult, isolResult].filter(
    r => r.activationStatus === 'ACTIVE'
  );

  if (activeResults.length === 0) {
    // None active — return HOOP as default NOT_ACTIVE
    return hoopResult;
  }

  if (activeResults.length === 1) {
    return activeResults[0];
  }

  // Multiple active — resolve priority
  // Highest confidence wins by default
  activeResults.sort((a, b) => b.confidenceScore - a.confidenceScore);
  return activeResults[0];
}
