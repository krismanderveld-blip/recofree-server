/**
 * PAR01 Router — Routes detection results to appropriate prompt mode
 */

import type { PAR01Detection, PAR01RoutingOutput, PAR01Phase, PAR01Marker } from './par01-types';

export function routePAR01(detection: PAR01Detection): PAR01RoutingOutput {
  if (!detection.detected) {
    return {
      activate: false,
      phase: 'recognition',
      intensity: 'gentle',
      targetMarkers: [],
      contextNote: '',
    };
  }

  const phase = detection.phase;
  const intensity = determineIntensity(detection);
  const targetMarkers = selectTargetMarkers(detection.markers, phase);

  return {
    activate: true,
    phase,
    intensity,
    targetMarkers,
    contextNote: buildContextNote(phase, targetMarkers, intensity),
  };
}

function determineIntensity(detection: PAR01Detection): 'gentle' | 'moderate' | 'direct' {
  if (detection.confidence < 0.45) return 'gentle';
  if (detection.confidence < 0.7) return 'moderate';
  return 'direct';
}

function selectTargetMarkers(markers: PAR01Marker[], phase: PAR01Phase): PAR01Marker[] {
  const phaseRelevance: Record<PAR01Phase, PAR01Marker[]> = {
    'recognition': ['role-reversal', 'responsibility-overload', 'identity-as-caretaker'],
    'origin-tracing': ['childhood-pattern', 'role-reversal', 'identity-as-caretaker'],
    'impact-naming': ['exhaustion-denial', 'own-needs-suppressed', 'emotional-labor'],
    'boundary-seed': ['boundary-inability', 'guilt-when-stepping-back', 'own-needs-suppressed'],
    'integration': markers, // all markers relevant in integration
  };

  const relevant = phaseRelevance[phase];
  return markers.filter(m => relevant.includes(m)).slice(0, 3);
}

function buildContextNote(phase: PAR01Phase, markers: PAR01Marker[], intensity: string): string {
  const markerStr = markers.join(', ');
  const phaseDescriptions: Record<PAR01Phase, string> = {
    'recognition': `Help user recognize parentification pattern. Detected markers: ${markerStr}. Use ${intensity} mirroring.`,
    'origin-tracing': `Trace parentification to origin (childhood/family). Markers: ${markerStr}. ${intensity} exploration.`,
    'impact-naming': `Name the cost of parentification on user's life. Markers: ${markerStr}. ${intensity} confrontation.`,
    'boundary-seed': `Plant seeds for boundary setting. Markers: ${markerStr}. ${intensity} encouragement.`,
    'integration': `Support integration of parentification awareness. Markers: ${markerStr}. ${intensity} consolidation.`,
  };

  return phaseDescriptions[phase];
}
