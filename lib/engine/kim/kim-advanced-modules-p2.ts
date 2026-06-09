/**
 * Kim Advanced Modules P2 — BEDR01, VETR01, GASL01
 * Integration layer for betrayal discovery, trust repair, and gaslighting recognition.
 *
 * Priority order:
 * 1. K06 always runs first (handled by existing kim-advanced-modules.ts)
 * 2. BEDR01 has priority at acute shock
 * 3. VETR01 requires K06 stabilization complete
 * 4. GASL01 limited to fact anchoring if K06 incomplete
 *
 * Kim only. Never reads Elias data. Crisis/safety override.
 */

import { detectBEDR01 } from "@/modules/kim/bedr01/bedr01-detector";
import { routeBEDR01 } from "@/modules/kim/bedr01/bedr01-router";
import { detectVETR01 } from "@/modules/kim/vetr01/vetr01-detector";
import { routeVETR01 } from "@/modules/kim/vetr01/vetr01-router";
import { detectGASL01 } from "@/modules/kim/gasl01/gasl01-detector";
import { routeGASL01 } from "@/modules/kim/gasl01/gasl01-router";

import type { BEDR01RuntimeInput } from "@/modules/kim/bedr01/bedr01-types";
import type { VETR01RuntimeInput } from "@/modules/kim/vetr01/vetr01-types";
import type { GASL01RuntimeInput } from "@/modules/kim/gasl01/gasl01-types";

export interface KimAdvancedP2Input {
  intakeCompleted: boolean;
  persona: "kim";
  latestUserMessage: string;
  recentMessages: string[];
  language: "nl" | "en" | "mixed" | "unknown";
  detectedMarkers: string[];
  crisisProtocolStatus: "CLEAR" | "MONITOR" | "ACTIVE";
  K06StabilizationStatus: "NOT_RUN" | "STABILIZING" | "STABILIZED";
  acuteShockDominant: boolean;
  discoveryJustHappened: boolean;
  bodyDysregulation: boolean;
  decisionPressure: boolean;
  childrenInvolved: boolean;
  safetyRisk: number;
  legalAdviceRequest: boolean;
  guiltInnocenceRequest: boolean;
  trustRepairQuestion: boolean;
  forgivenessPressure: boolean;
  relationshipMeaningQuestion: boolean;
  boundaryNeedAfterBetrayal: boolean;
  timelinePressure: boolean;
  partnerMindReading: boolean;
  selfDoubtDominant: boolean;
  realityQuestionDominant: boolean;
  darvoPatternDetected: boolean;
  informationAsymmetry: boolean;
  childrenTriangulation: boolean;
  partnerBlamesCaregiver: boolean;
  timestampIso: string;
}

export interface KimAdvancedP2Result {
  bedr01Context: string | null;
  vetr01Context: string | null;
  gasl01Context: string | null;
  activeModule: "BEDR01" | "VETR01" | "GASL01" | null;
  routeNext: string;
}

export function runKimAdvancedP2(input: KimAdvancedP2Input): KimAdvancedP2Result {
  // Persona guard
  if (input.persona !== "kim") {
    return {
      bedr01Context: null,
      vetr01Context: null,
      gasl01Context: null,
      activeModule: null,
      routeNext: "NO_MODULE",
    };
  }

  // Step 1: BEDR01 — priority at acute shock
  const bedr01Input: BEDR01RuntimeInput = {
    intakeCompleted: input.intakeCompleted,
    persona: input.persona,
    latestUserMessage: input.latestUserMessage,
    recentMessages: input.recentMessages,
    language: input.language,
    detectedMarkers: input.detectedMarkers,
    crisisProtocolStatus: input.crisisProtocolStatus,
    K06StabilizationStatus: input.K06StabilizationStatus,
    acuteShockDominant: input.acuteShockDominant,
    discoveryJustHappened: input.discoveryJustHappened,
    bodyDysregulation: input.bodyDysregulation,
    decisionPressure: input.decisionPressure,
    childrenInvolved: input.childrenInvolved,
    safetyRisk: input.safetyRisk,
    legalAdviceRequest: input.legalAdviceRequest,
    guiltInnocenceRequest: input.guiltInnocenceRequest,
    timestampIso: input.timestampIso,
  };

  const bedr01Detection = detectBEDR01(bedr01Input);

  if (bedr01Detection.activationStatus === "ACTIVE") {
    const bedr01Result = routeBEDR01(bedr01Input, bedr01Detection);
    return {
      bedr01Context: bedr01Result.promptPayload
        ? bedr01Result.promptPayload.compactPrompt
        : null,
      vetr01Context: null,
      gasl01Context: null,
      activeModule: "BEDR01",
      routeNext: bedr01Result.routeNext,
    };
  }

  // Step 2: VETR01 — requires K06 stabilization
  const vetr01Input: VETR01RuntimeInput = {
    intakeCompleted: input.intakeCompleted,
    persona: input.persona,
    latestUserMessage: input.latestUserMessage,
    recentMessages: input.recentMessages,
    language: input.language,
    detectedMarkers: input.detectedMarkers,
    crisisProtocolStatus: input.crisisProtocolStatus,
    K06StabilizationStatus: input.K06StabilizationStatus,
    acuteShockDominant: input.acuteShockDominant,
    trustRepairQuestion: input.trustRepairQuestion,
    forgivenessPressure: input.forgivenessPressure,
    relationshipMeaningQuestion: input.relationshipMeaningQuestion,
    boundaryNeedAfterBetrayal: input.boundaryNeedAfterBetrayal,
    timelinePressure: input.timelinePressure,
    partnerMindReading: input.partnerMindReading,
    safetyRisk: input.safetyRisk,
    legalAdviceRequest: input.legalAdviceRequest,
    guiltInnocenceRequest: input.guiltInnocenceRequest,
    timestampIso: input.timestampIso,
  };

  const vetr01Detection = detectVETR01(vetr01Input);

  if (vetr01Detection.activationStatus === "ACTIVE") {
    const vetr01Result = routeVETR01(vetr01Input, vetr01Detection);
    return {
      bedr01Context: null,
      vetr01Context: vetr01Result.promptPayload
        ? vetr01Result.promptPayload.compactPrompt
        : null,
      gasl01Context: null,
      activeModule: "VETR01",
      routeNext: vetr01Result.routeNext,
    };
  }

  // Step 3: GASL01 — fact anchoring if K06 incomplete, full if stabilized
  const gasl01Input: GASL01RuntimeInput = {
    intakeCompleted: input.intakeCompleted,
    persona: input.persona,
    latestUserMessage: input.latestUserMessage,
    recentMessages: input.recentMessages,
    language: input.language,
    detectedMarkers: input.detectedMarkers,
    crisisProtocolStatus: input.crisisProtocolStatus,
    K06StabilizationStatus: input.K06StabilizationStatus,
    acuteShockDominant: input.acuteShockDominant,
    selfDoubtDominant: input.selfDoubtDominant,
    realityQuestionDominant: input.realityQuestionDominant,
    darvoPatternDetected: input.darvoPatternDetected,
    informationAsymmetry: input.informationAsymmetry,
    childrenTriangulation: input.childrenTriangulation,
    partnerBlamesCaregiver: input.partnerBlamesCaregiver,
    safetyRisk: input.safetyRisk,
    legalAdviceRequest: input.legalAdviceRequest,
    timestampIso: input.timestampIso,
  };

  const gasl01Detection = detectGASL01(gasl01Input);

  if (gasl01Detection.activationStatus === "ACTIVE" || gasl01Detection.activationStatus === "LIMITED_FACT_ANCHORING_ONLY") {
    const gasl01Result = routeGASL01(gasl01Input, gasl01Detection);
    return {
      bedr01Context: null,
      vetr01Context: null,
      gasl01Context: gasl01Result.promptPayload
        ? gasl01Result.promptPayload.compactPrompt
        : null,
      activeModule: "GASL01",
      routeNext: gasl01Result.routeNext,
    };
  }

  return {
    bedr01Context: null,
    vetr01Context: null,
    gasl01Context: null,
    activeModule: null,
    routeNext: "NO_MODULE",
  };
}
