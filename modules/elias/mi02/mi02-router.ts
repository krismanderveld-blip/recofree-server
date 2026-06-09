/**
 * MI02 — Motivational Interviewing Verdieping (Elias only)
 * ROUTER: Response mode selection and OARS technique routing
 */
import type { MI02RuntimeInput, MI02DetectionResult, MI02ResponseMode, MI02OarsTechnique, MI02RouteNext } from './mi02-types';

export interface MI02RouterDecision {
  responseMode: MI02ResponseMode;
  oarsTechnique: MI02OarsTechnique;
  routeNext: MI02RouteNext;
  bridgeToMI01: boolean;
  bridgeToACT: boolean;
  bridgeToAGC01: boolean;
}

export function routeMI02(input: MI02RuntimeInput, detection: MI02DetectionResult): MI02RouterDecision {
  if (detection.activationStatus !== 'ACTIVE') {
    return {
      responseMode: detection.responseMode,
      oarsTechnique: detection.oarsTechnique,
      routeNext: detection.routeNext,
      bridgeToMI01: false,
      bridgeToACT: false,
      bridgeToAGC01: false,
    };
  }

  // Determine bridges
  const bridgeToMI01 = !input.mi01PreviouslyActive && detection.confidenceScore < 0.65;
  const bridgeToACT = detection.responseMode === 'CHANGE_TALK_EVOCATION';
  const bridgeToAGC01 = input.externalMotivationDominant && detection.responseMode !== 'DOUBLE_SIDED_REFLECTION';

  return {
    responseMode: detection.responseMode,
    oarsTechnique: detection.oarsTechnique,
    routeNext: detection.routeNext,
    bridgeToMI01,
    bridgeToACT,
    bridgeToAGC01,
  };
}
