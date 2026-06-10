/**
 * Kim Advanced Modules P5 — ISO01 (Isolatie en Sociale Terugtrekking)
 * Integration layer for caregiver isolation and social withdrawal support.
 *
 * Pipeline position: after P3 (CDP01/RNW01) and P4 (PAR01/FIN01).
 *
 * Priority order:
 * 1. K06 always runs first (handled upstream)
 * 2. BEDR01/VETR01/GASL01 (P2) override if acute betrayal/gaslighting is primary
 * 3. CDP01/RNW01 (P3) override if codependency/grief is primary
 * 4. PAR01/FIN01 (P4) override if parentification/financial control is primary
 * 5. ISO01 activates if social withdrawal/isolation is primary
 *
 * Kim only. Never reads Elias data. Crisis/safety override.
 */

import { detectISO01 } from '@/modules/kim/iso01/detector';
import { buildISO01PromptPayload } from '@/modules/kim/iso01/prompt';
import type { ISO01RuntimeInput } from '@/modules/kim/iso01/types';

export interface KimAdvancedP5Input {
  intakeCompleted: boolean;
  persona: 'kim';
  latestUserMessage: string;
  recentMessages: string[];
  language: 'nl' | 'en' | 'mixed' | 'unknown';
  detectedMarkers: string[];
  crisisProtocolStatus: 'CLEAR' | 'MONITOR' | 'ACTIVE';
  K06StabilizationStatus: 'NOT_RUN' | 'STABILIZING' | 'STABILIZED';
  // ISO01 signals
  socialWithdrawal: boolean;
  shameAboutTalking: boolean;
  burdenFear: boolean;
  protectiveIsolation: boolean;
  exhaustionIsolation: boolean;
  noSocialContact: boolean;
  privacyNeed: boolean;
  fearOfJudgment: boolean;
  adviceFatigue: boolean;
  painfulLoneliness: boolean;
  wantsConnectionButScared: boolean;
  acuteOverload: boolean;
  // Shared
  safetyRisk: number;
  timestampIso: string;
}

export interface KimAdvancedP5Result {
  iso01Context: string | null;
  activeModule: 'ISO01' | null;
  routeNext: string;
}

export function runKimAdvancedP5(input: KimAdvancedP5Input): KimAdvancedP5Result {
  // Persona guard
  if (input.persona !== 'kim') {
    return {
      iso01Context: null,
      activeModule: null,
      routeNext: 'NO_MODULE',
    };
  }

  // Build ISO01 runtime input
  const iso01Input: ISO01RuntimeInput = {
    intakeCompleted: input.intakeCompleted,
    persona: input.persona,
    latestUserMessage: input.latestUserMessage,
    recentMessages: input.recentMessages,
    language: input.language,
    detectedMarkers: input.detectedMarkers,
    crisisProtocolStatus: input.crisisProtocolStatus,
    K06StabilizationStatus: input.K06StabilizationStatus,
    socialWithdrawal: input.socialWithdrawal,
    shameAboutTalking: input.shameAboutTalking,
    burdenFear: input.burdenFear,
    protectiveIsolation: input.protectiveIsolation,
    exhaustionIsolation: input.exhaustionIsolation,
    noSocialContact: input.noSocialContact,
    privacyNeed: input.privacyNeed,
    fearOfJudgment: input.fearOfJudgment,
    adviceFatigue: input.adviceFatigue,
    painfulLoneliness: input.painfulLoneliness,
    wantsConnectionButScared: input.wantsConnectionButScared,
    acuteOverload: input.acuteOverload,
    safetyRisk: input.safetyRisk,
    timestampIso: input.timestampIso,
  };

  const detection = detectISO01(iso01Input);

  if (detection.activationStatus === 'ACTIVE') {
    const payload = buildISO01PromptPayload(detection);
    return {
      iso01Context: payload ? payload.compactPrompt : null,
      activeModule: 'ISO01',
      routeNext: detection.routeNext,
    };
  }

  return {
    iso01Context: null,
    activeModule: null,
    routeNext: 'NO_MODULE',
  };
}
