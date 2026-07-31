/**
 * CDP01 Test Cases — Codependentie Patroon Detectie
 */

import type { CDP01RuntimeInput } from "./cdp01-types";

function baseInput(overrides: Partial<CDP01RuntimeInput> = {}): CDP01RuntimeInput {
  return {
    intakeCompleted: true,
    persona: "kim",
    latestUserMessage: "",
    recentMessages: [],
    language: "nl",
    detectedMarkers: [],
    crisisProtocolStatus: "CLEAR",
    K06StabilizationStatus: "STABILIZED",
    selfLossPattern: false,
    relationalFusion: false,
    emotionalDependencyOnPartnerState: false,
    rescueCompulsion: false,
    overResponsibility: false,
    controlFromFear: false,
    selfCareGuilt: false,
    identityCollapseWithoutPartner: false,
    acuteOverload: false,
    safetyRisk: 0,
    timestampIso: new Date().toISOString(),
    ...overrides,
  };
}

export const CDP01_TEST_CASES = [
  {
    name: "Self-loss pattern with identity collapse",
    input: baseInput({
      latestUserMessage: "Zonder hem weet ik niet wie ik ben. Ik besta precies niet meer.",
      selfLossPattern: true,
      identityCollapseWithoutPartner: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.55,
      responseMode: "IDENTITY_SEPARATION_GENTLE",
    },
  },
  {
    name: "Emotional dependency on partner state",
    input: baseInput({
      latestUserMessage: "Als het goed gaat met hem gaat het goed met mij. Als hij slecht gaat, ga ik mee onder.",
      selfLossPattern: true,
      emotionalDependencyOnPartnerState: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.50,
      responseMode: "EMOTIONAL_LINK_REFLECTION",
    },
  },
  {
    name: "Rescue compulsion — bridge to KDL01",
    input: baseInput({
      latestUserMessage: "Ik moet hem redden. Als ik loslaat, gaat hij kapot.",
      selfLossPattern: true,
      rescueCompulsion: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.50,
      responseMode: "LOVE_VS_OVERRESPONSIBILITY",
      routeNext: "KDL01",
    },
  },
  {
    name: "Self-care guilt — bridge to KSC01",
    input: baseInput({
      latestUserMessage: "Ik voel me egoistisch als ik iets voor mezelf doe.",
      selfLossPattern: true,
      selfCareGuilt: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.50,
      responseMode: "SELF_CARE_GUILT_SOFTENING",
      routeNext: "KSC01",
    },
  },
  {
    name: "Control from fear — bridge to KBR01",
    input: baseInput({
      latestUserMessage: "Ik controleer alles. Ik check constant zijn telefoon.",
      selfLossPattern: true,
      controlFromFear: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.50,
      responseMode: "CONTROL_AS_FEAR_RESPONSE",
      routeNext: "KBR01",
    },
  },
  {
    name: "Crisis blocks activation",
    input: baseInput({
      crisisProtocolStatus: "ACTIVE",
      selfLossPattern: true,
      identityCollapseWithoutPartner: true,
    }),
    expected: {
      activationStatus: "BLOCKED_BY_CRISIS",
      routeNext: "CRISIS_PROTOCOL",
    },
  },
  {
    name: "K06 not stabilized — deferred",
    input: baseInput({
      K06StabilizationStatus: "STABILIZING",
      acuteOverload: true,
      selfLossPattern: true,
    }),
    expected: {
      activationStatus: "DEFERRED_TO_K06",
      routeNext: "K06",
    },
  },
  {
    name: "Below threshold — not active",
    input: baseInput({
      latestUserMessage: "Ik had een goede dag vandaag.",
    }),
    expected: {
      activationStatus: "NOT_ACTIVE",
    },
  },
];
