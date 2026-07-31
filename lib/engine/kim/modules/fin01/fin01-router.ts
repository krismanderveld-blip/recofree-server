/**
 * FIN01 Router — Routes detection results to appropriate prompt mode
 */

import type { FIN01Detection, FIN01RoutingOutput, FIN01Phase, FIN01Marker } from './fin01-types';

export function routeFIN01(detection: FIN01Detection): FIN01RoutingOutput {
  if (!detection.detected) {
    return {
      activate: false,
      phase: 'awareness',
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

function determineIntensity(detection: FIN01Detection): 'gentle' | 'moderate' | 'direct' {
  if (detection.confidence < 0.45) return 'gentle';
  if (detection.confidence < 0.7) return 'moderate';
  return 'direct';
}

function selectTargetMarkers(markers: FIN01Marker[], phase: FIN01Phase): FIN01Marker[] {
  const phaseRelevance: Record<FIN01Phase, FIN01Marker[]> = {
    'awareness': ['financial-control', 'debt-from-addiction', 'hidden-spending', 'money-as-peace'],
    'impact-mapping': ['debt-from-addiction', 'sacrifice-savings', 'work-overload', 'shame-about-money'],
    'agency-building': ['economic-trapped', 'financial-gaslighting', 'shame-about-money'],
    'protection': ['financial-control', 'economic-trapped', 'hidden-spending'],
    'autonomy': markers, // all markers relevant
  };

  const relevant = phaseRelevance[phase];
  return markers.filter(m => relevant.includes(m)).slice(0, 3);
}

function buildContextNote(phase: FIN01Phase, markers: FIN01Marker[], intensity: string): string {
  const markerStr = markers.join(', ');
  const phaseDescriptions: Record<FIN01Phase, string> = {
    'awareness': `Help user see financial control/dependency pattern. Markers: ${markerStr}. ${intensity} approach.`,
    'impact-mapping': `Map full financial impact of the situation. Markers: ${markerStr}. ${intensity} exploration.`,
    'agency-building': `Build sense of financial agency and self-worth. Markers: ${markerStr}. ${intensity} empowerment.`,
    'protection': `Explore concrete financial protection steps. Markers: ${markerStr}. ${intensity} guidance.`,
    'autonomy': `Support financial autonomy as self-care. Markers: ${markerStr}. ${intensity} consolidation.`,
  };

  return phaseDescriptions[phase];
}
