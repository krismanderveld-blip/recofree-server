/**
 * TERV01 — Post-Purple Zone Relapse Chain Analysis (Elias only)
 * ROUTER: Response mode selection and routing logic
 */
import type { TERV01RuntimeInput, TERV01DetectionResult, TERV01ResponseMode, TERV01RouteNext } from './terv01-types';

export interface TERV01RouterDecision {
  responseMode: TERV01ResponseMode;
  routeNext: TERV01RouteNext;
  chainStep: 'trigger' | 'thought' | 'feeling' | 'behavior' | 'use' | 'prevention' | 'stabilization' | 'none';
  clinicianReadable: boolean;
}

export function routeTERV01(input: TERV01RuntimeInput, detection: TERV01DetectionResult): TERV01RouterDecision {
  if (detection.activationStatus !== 'ACTIVE') {
    return {
      responseMode: detection.responseMode,
      routeNext: detection.routeNext,
      chainStep: 'none',
      clinicianReadable: false,
    };
  }

  // Map response mode to chain step
  let chainStep: TERV01RouterDecision['chainStep'] = 'none';
  switch (detection.responseMode) {
    case 'TRIGGER_CLARIFICATION': chainStep = 'trigger'; break;
    case 'THOUGHT_BRIDGE_IDENTIFICATION': chainStep = 'thought'; break;
    case 'EMOTION_BODY_MAPPING': chainStep = 'feeling'; break;
    case 'BEHAVIORAL_ACCESS_POINT': chainStep = 'behavior'; break;
    case 'CLINICAL_CHAIN_MAPPING': chainStep = 'use'; break;
    case 'PREVENTION_POINT_CONTRACT': chainStep = 'prevention'; break;
    case 'POST_PAARS_STABILIZATION_CHECK': chainStep = 'stabilization'; break;
  }

  // Shame override: if shame is too high, slow down and route to stabilization
  if (input.shameIntensity > 0.80 && detection.responseMode !== 'POST_PAARS_STABILIZATION_CHECK') {
    return {
      responseMode: 'POST_PAARS_STABILIZATION_CHECK',
      routeNext: 'EKT01_VERHELDERING',
      chainStep: 'stabilization',
      clinicianReadable: true,
    };
  }

  return {
    responseMode: detection.responseMode,
    routeNext: detection.routeNext,
    chainStep,
    clinicianReadable: true,
  };
}
