/**
 * GASL01 Test Cases — Gaslighting Recognition & Fact Anchoring
 */

import type { GASL01RuntimeInput } from "./gasl01-types";

function baseInput(overrides: Partial<GASL01RuntimeInput> = {}): GASL01RuntimeInput {
  return {
    intakeCompleted: true,
    persona: "kim",
    latestUserMessage: "",
    recentMessages: [],
    language: "nl",
    detectedMarkers: [],
    crisisProtocolStatus: "CLEAR",
    K06StabilizationStatus: "STABILIZED",
    acuteShockDominant: false,
    selfDoubtDominant: false,
    realityQuestionDominant: false,
    darvoPatternDetected: false,
    informationAsymmetry: false,
    childrenTriangulation: false,
    partnerBlamesCaregiver: false,
    safetyRisk: 0,
    legalAdviceRequest: false,
    timestampIso: new Date().toISOString(),
    ...overrides,
  };
}

export const GASL01_TEST_CASES = [
  {
    name: "Self-doubt dominant — normalization",
    input: baseInput({
      latestUserMessage: "Misschien heb ik het mis. Misschien overdrijf ik.",
      selfDoubtDominant: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.45,
      responseMode: "SELF_DOUBT_NORMALIZATION",
    },
  },
  {
    name: "DARVO pattern detected",
    input: baseInput({
      latestUserMessage: "Hij draait het om. Hij zegt dat ik het heb veroorzaakt.",
      selfDoubtDominant: true,
      darvoPatternDetected: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.50,
      responseMode: "DARVO_RECOGNITION",
    },
  },
  {
    name: "Reality question — validation",
    input: baseInput({
      latestUserMessage: "Ik weet niet meer wat waar is. Ben ik gek?",
      realityQuestionDominant: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.45,
      responseMode: "REALITY_VALIDATION",
    },
  },
  {
    name: "Children triangulation",
    input: baseInput({
      latestUserMessage: "De kinderen zeggen dat ik de schuldige ben. Hij gebruikt ze tegen mij.",
      selfDoubtDominant: true,
      childrenTriangulation: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.50,
      responseMode: "CHILDREN_TRIANGULATION",
    },
  },
  {
    name: "K06 incomplete — fact anchoring only",
    input: baseInput({
      K06StabilizationStatus: "STABILIZING",
      selfDoubtDominant: true,
      realityQuestionDominant: true,
    }),
    expected: {
      activationStatus: "LIMITED_FACT_ANCHORING_ONLY",
      responseMode: "FACT_ANCHORING",
    },
  },
  {
    name: "Acute shock defers to BEDR01",
    input: baseInput({
      acuteShockDominant: true,
      selfDoubtDominant: true,
    }),
    expected: {
      activationStatus: "DEFERRED_TO_BEDR01",
      routeNext: "BEDR01",
    },
  },
  {
    name: "Information asymmetry",
    input: baseInput({
      latestUserMessage: "Hij liegt maar iedereen gelooft hem. Ik heb geen bewijs.",
      selfDoubtDominant: true,
      informationAsymmetry: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.50,
      responseMode: "INFORMATION_ASYMMETRY",
    },
  },
  {
    name: "Crisis blocks activation",
    input: baseInput({
      crisisProtocolStatus: "ACTIVE",
      selfDoubtDominant: true,
    }),
    expected: {
      activationStatus: "BLOCKED_BY_CRISIS",
      routeNext: "CRISIS_PROTOCOL",
    },
  },
];
