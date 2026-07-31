/**
 * SLAAP01 Elias Router
 * Routes detection result to response mode and next module.
 */

import type { SLAAP01EliasDetectionResult } from "./slaap01-types";

export interface SLAAP01EliasRouterOutput {
  shouldActivate: boolean;
  responseMode: string;
  routeNext: string;
  promptBlock: string | null;
  reason: string;
}

export function routeSLAAP01Elias(result: SLAAP01EliasDetectionResult): SLAAP01EliasRouterOutput {
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
    promptBlock: `SLAAP01_ELIAS:${result.responseMode}`,
    reason: result.reason,
  };
}
