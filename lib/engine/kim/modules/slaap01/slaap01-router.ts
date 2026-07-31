/**
 * SLAAP01 Kim Router
 * Routes detection result to response mode and next module.
 */

import type { SLAAP01KimDetectionResult } from "./slaap01-types";

export interface SLAAP01KimRouterOutput {
  shouldActivate: boolean;
  responseMode: string;
  routeNext: string;
  promptBlock: string | null;
  reason: string;
}

export function routeSLAAP01Kim(result: SLAAP01KimDetectionResult): SLAAP01KimRouterOutput {
  if (result.activationStatus !== "ACTIVE") {
    return {
      shouldActivate: false,
      responseMode: result.responseMode,
      routeNext: result.routeNext,
      promptBlock: null,
      reason: result.reason,
    };
  }

  return {
    shouldActivate: true,
    responseMode: result.responseMode,
    routeNext: result.routeNext,
    promptBlock: `SLAAP01_KIM:${result.responseMode}`,
    reason: result.reason,
  };
}
