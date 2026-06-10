/**
 * ISO01 Detector — Isolatie en Sociale Terugtrekking (Kim only)
 * Engine decides, GPT executes.
 */
import type { ISO01RuntimeInput, ISO01DetectionResult, ISO01ResponseMode } from './types';

export function detectISO01(input: ISO01RuntimeInput): ISO01DetectionResult {
  // Gate: intake incomplete
  if (!input.intakeCompleted) {
    return {
      moduleId: 'ISO01',
      activationStatus: 'BLOCKED_BY_INTAKE',
      confidenceScore: 0,
      matchedMarkers: [],
      responseMode: 'SAFETY_EXIT',
      routeNext: 'NO_MODULE',
      reason: 'Intake incomplete.',
    };
  }

  // Gate: persona check
  if (input.persona !== 'kim') {
    return {
      moduleId: 'ISO01',
      activationStatus: 'BLOCKED_BY_PERSONA',
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'SAFETY_EXIT',
      routeNext: 'NO_MODULE',
      reason: 'ISO01 is Kim only.',
    };
  }

  // Gate: crisis override
  if (input.crisisProtocolStatus === 'ACTIVE' || input.safetyRisk >= 0.70) {
    return {
      moduleId: 'ISO01',
      activationStatus: 'BLOCKED_BY_CRISIS',
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'SAFETY_EXIT',
      routeNext: 'CRISIS_PROTOCOL',
      reason: 'Crisis protocol overrides social withdrawal reflection.',
    };
  }

  // Gate: K06 stabilization
  if (input.acuteOverload || input.K06StabilizationStatus !== 'STABILIZED') {
    return {
      moduleId: 'ISO01',
      activationStatus: 'DEFERRED_TO_K06',
      confidenceScore: 0.80,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'K06_STABILIZATION_BRIDGE',
      routeNext: 'K06',
      reason: 'K06 stabilization required before isolation reflection.',
    };
  }

  // Confidence scoring
  // Any specific isolation signal implies social withdrawal is present
  const hasAnyIsolationSignal = input.shameAboutTalking || input.burdenFear ||
    input.protectiveIsolation || input.exhaustionIsolation || input.fearOfJudgment ||
    input.adviceFatigue || input.painfulLoneliness || input.wantsConnectionButScared;
  const effectiveSocialWithdrawal = input.socialWithdrawal || hasAnyIsolationSignal;
  const effectiveNoSocialContact = input.noSocialContact || (effectiveSocialWithdrawal && input.detectedMarkers.length > 0);

  let score = 0;
  if (effectiveNoSocialContact) score += 0.25;
  if (effectiveSocialWithdrawal) score += 0.20;
  if (input.shameAboutTalking) score += 0.18;
  if (input.burdenFear) score += 0.18;
  if (input.protectiveIsolation) score += 0.10;
  if (input.exhaustionIsolation) score += 0.10;
  if (input.fearOfJudgment || input.adviceFatigue) score += 0.08;
  if (input.painfulLoneliness) score += 0.08;
  if (input.wantsConnectionButScared) score += 0.08;
  if (input.detectedMarkers.length > 0) score += 0.05;

  const confidenceScore = Math.min(score, 0.98);

  // Below threshold
  if (confidenceScore < 0.50) {
    return {
      moduleId: 'ISO01',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore,
      matchedMarkers: input.detectedMarkers,
      responseMode: 'SOCIAL_WITHDRAWAL_MIRROR',
      routeNext: 'NO_MODULE',
      reason: 'Social withdrawal/isolation signal below threshold.',
    };
  }

  // Response mode routing
  let responseMode: ISO01ResponseMode = 'SOCIAL_WITHDRAWAL_MIRROR';
  let routeNext: ISO01DetectionResult['routeNext'] = 'ISO01';

  if (input.shameAboutTalking) {
    responseMode = 'SHAME_SAFE_SILENCE_VALIDATION';
    routeNext = 'KSC01';
  } else if (input.burdenFear) {
    responseMode = 'BURDEN_FEAR_SOFTENING';
  } else if (input.protectiveIsolation || input.privacyNeed) {
    responseMode = 'PROTECTIVE_WITHDRAWAL_VALIDATION';
  } else if (input.exhaustionIsolation) {
    responseMode = 'EXHAUSTION_BASED_WITHDRAWAL';
  } else if (input.fearOfJudgment || input.adviceFatigue) {
    responseMode = 'BOUNDARIED_SHARING_OPTION';
    routeNext = 'KBR01';
  } else if (input.wantsConnectionButScared) {
    responseMode = 'MICRO_CONNECTION_ON_OWN_TEMPO';
  } else if (input.painfulLoneliness) {
    responseMode = 'ISOLATION_WITHOUT_PRESSURE';
  }

  return {
    moduleId: 'ISO01',
    activationStatus: 'ACTIVE',
    confidenceScore,
    matchedMarkers: input.detectedMarkers,
    responseMode,
    routeNext,
    reason: 'Kim caregiver isolation / social withdrawal pattern detected.',
  };
}
