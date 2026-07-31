/**
 * VspInsight Live Feed
 * Updates the VspInsightProfile during LIVE_MESSAGE turns (not just SESSION_INIT).
 *
 * Detects:
 * 1. Observed early signs from chat signals (avoidance, craving, overwhelm patterns)
 * 2. Discrepancy events (zone mismatch between user report and detected state)
 * 3. Phase transition examples (insight state changes within a session)
 *
 * This is a lightweight, non-blocking operation that runs after each AI response.
 */

import type { VspInsightState, VspZone, VspObservedEarlySign, VspSilentDiscrepancyEvent, VspInsightProfilePatch, RecoFreePersona, VspChatSignalSnapshot } from './vspInsightTypes';
import { extractChatSignals } from './vspChatSignalAdapter';
import { LocalDeviceTimeService } from '@/lib/core/time';

export interface VspLiveFeedInput {
  persona: RecoFreePersona;
  userMessage: string;
  insightState: VspInsightState;
  detectedZone: string; // e.g., 'GROEN', 'GEEL', 'ORANJE', 'ROOD', 'PAARS'
  userReportedZone?: string | null;
  sessionTurnCount: number;
}

export interface VspLiveFeedResult {
  shouldPatch: boolean;
  patch: VspInsightProfilePatch | null;
  debug: {
    observedSignsDetected: number;
    discrepancyDetected: boolean;
    reason: string;
  };
}

/**
 * Map chat signal markers to observed early sign labels.
 */
function mapSignalsToObservedSigns(
  signals: VspChatSignalSnapshot,
  insightState: VspInsightState,
  detectedZone: string,
  now: string
): VspObservedEarlySign[] {
  const signs: VspObservedEarlySign[] = [];

  // Avoidance markers → observed early sign
  if (signals.avoidanceMarkers.length >= 2) {
    signs.push({
      signId: `obs_avoidance_${now.replace(/[^0-9]/g, '').slice(0, 14)}`,
      label: 'Vermijdingspatroon',
      normalizedLabel: 'avoidance_pattern',
      examples: signals.avoidanceMarkers.slice(0, 3),
      associatedInsightState: insightState,
      associatedZone: mapZoneString(detectedZone),
      confidence: Math.min(0.3 + signals.avoidanceMarkers.length * 0.15, 0.85),
      frequency: 1,
      firstDetectedAt: now,
      lastUpdatedAt: now,
      sourceSignals: ['chat'],
    });
  }

  // Craving markers → observed early sign
  if (signals.cravingMarkers.length >= 1) {
    signs.push({
      signId: `obs_craving_${now.replace(/[^0-9]/g, '').slice(0, 14)}`,
      label: 'Craving-signaal',
      normalizedLabel: 'craving_signal',
      examples: signals.cravingMarkers.slice(0, 3),
      associatedInsightState: insightState,
      associatedZone: mapZoneString(detectedZone),
      confidence: Math.min(0.4 + signals.cravingMarkers.length * 0.2, 0.9),
      frequency: 1,
      firstDetectedAt: now,
      lastUpdatedAt: now,
      sourceSignals: ['chat'],
    });
  }

  // Overwhelm markers → observed early sign
  if (signals.overwhelmMarkers.length >= 2) {
    signs.push({
      signId: `obs_overwhelm_${now.replace(/[^0-9]/g, '').slice(0, 14)}`,
      label: 'Overbelasting-signaal',
      normalizedLabel: 'overwhelm_signal',
      examples: signals.overwhelmMarkers.slice(0, 3),
      associatedInsightState: insightState,
      associatedZone: mapZoneString(detectedZone),
      confidence: Math.min(0.3 + signals.overwhelmMarkers.length * 0.15, 0.85),
      frequency: 1,
      firstDetectedAt: now,
      lastUpdatedAt: now,
      sourceSignals: ['chat'],
    });
  }

  // Rationality markers (high count) → possible rational green pattern
  if (signals.rationalityMarkers.length >= 3 && insightState === 'RATIONAL_GREEN') {
    signs.push({
      signId: `obs_rational_${now.replace(/[^0-9]/g, '').slice(0, 14)}`,
      label: 'Rationeel groen patroon',
      normalizedLabel: 'rational_green_pattern',
      examples: signals.rationalityMarkers.slice(0, 3),
      associatedInsightState: 'RATIONAL_GREEN',
      associatedZone: 'silent_only',
      confidence: Math.min(0.3 + signals.rationalityMarkers.length * 0.1, 0.75),
      frequency: 1,
      firstDetectedAt: now,
      lastUpdatedAt: now,
      sourceSignals: ['chat'],
    });
  }

  return signs;
}

/**
 * Detect discrepancy between user-reported zone and detected zone.
 */
function detectDiscrepancy(
  userReportedZone: string | null | undefined,
  detectedZone: string,
  insightState: VspInsightState,
  now: string
): VspSilentDiscrepancyEvent | null {
  if (!userReportedZone) return null;

  const zoneSeverity: Record<string, number> = {
    'GROEN': 1, 'LICHTGROEN': 1, 'GEEL': 2, 'ORANJE': 3, 'ROOD': 4, 'PAARS': 5,
  };

  const reportedSev = zoneSeverity[userReportedZone.toUpperCase()] ?? 0;
  const detectedSev = zoneSeverity[detectedZone.toUpperCase()] ?? 0;

  // Significant discrepancy: 2+ levels difference
  if (Math.abs(reportedSev - detectedSev) >= 2) {
    // Map to the closest VspDiscrepancyType
    let discrepancyType: import('./vspInsightTypes').VspDiscrepancyType = 'NONE';
    if (reportedSev <= 1 && insightState === 'RATIONAL_GREEN') {
      discrepancyType = 'USER_REPORTED_GREEN_BUT_RATIONAL_GREEN_SIGNALS';
    } else if (reportedSev <= 1 && detectedSev >= 3) {
      discrepancyType = 'USER_REPORTED_GREEN_BUT_OVERWHELM_SIGNALS';
    } else if (reportedSev <= 2 && detectedSev >= 3) {
      discrepancyType = 'USER_REPORTED_LOW_BUT_CRAVING_LANGUAGE';
    } else if (reportedSev <= 2) {
      discrepancyType = 'USER_REPORTED_STABLE_BUT_AVOIDANT_LANGUAGE';
    }

    return {
      eventId: `disc_${now.replace(/[^0-9]/g, '').slice(0, 14)}`,
      timestampIso: now,
      userReportedZone: mapZoneString(userReportedZone),
      inferredInsightState: insightState,
      discrepancyType,
      usedForFramework: 'MI', // default framework
      communicatedToUser: false,
      sourceSignals: ['chat'],
    };
  }

  return null;
}

function mapZoneString(zone: string): VspZone {
  const map: Record<string, VspZone> = {
    'GROEN': 'GROEN',
    'LICHTGROEN': 'GROEN',
    'GEEL': 'GEEL',
    'ORANJE': 'ORANJE',
    'ROOD': 'ROOD',
    'PAARS': 'PAARS',
  };
  return map[zone.toUpperCase()] ?? 'GROEN';
}

/**
 * Run the VspInsight live feed.
 * Called after each AI response during LIVE_MESSAGE turns.
 * Returns a patch to apply to the VspInsightProfile if significant signals detected.
 */
export function runVspInsightLiveFeed(input: VspLiveFeedInput): VspLiveFeedResult {
  const { persona, userMessage, insightState, detectedZone, userReportedZone, sessionTurnCount } = input;

  // Skip early turns (not enough context)
  if (sessionTurnCount < 2) {
    return {
      shouldPatch: false,
      patch: null,
      debug: { observedSignsDetected: 0, discrepancyDetected: false, reason: 'Too early in session' },
    };
  }

  const now = LocalDeviceTimeService.now().utcIso;
  const signals = extractChatSignals(userMessage);

  // Detect observed early signs
  const observedSigns = mapSignalsToObservedSigns(signals, insightState, detectedZone, now);

  // Detect discrepancy
  const discrepancy = detectDiscrepancy(userReportedZone, detectedZone, insightState, now);

  // Only patch if we have meaningful data
  const hasData = observedSigns.length > 0 || discrepancy !== null;

  if (!hasData) {
    return {
      shouldPatch: false,
      patch: null,
      debug: { observedSignsDetected: 0, discrepancyDetected: false, reason: 'No significant signals' },
    };
  }

  const patch: VspInsightProfilePatch = {
    profileVersion: 'vsp_insight_profile.v1',
    persona,
    updatedAt: now,
    upsertSelfReportedEarlySigns: [],
    upsertObservedEarlySigns: observedSigns,
    upsertPhaseTransitionExamples: [],
    upsertDiscrepancyEvents: discrepancy ? [discrepancy] : [],
    lastInsightState: insightState,
    lastUserReportedZone: userReportedZone ? mapZoneString(userReportedZone) : undefined,
  };

  return {
    shouldPatch: true,
    patch,
    debug: {
      observedSignsDetected: observedSigns.length,
      discrepancyDetected: discrepancy !== null,
      reason: `Detected ${observedSigns.length} signs${discrepancy ? ' + discrepancy' : ''}`,
    },
  };
}
