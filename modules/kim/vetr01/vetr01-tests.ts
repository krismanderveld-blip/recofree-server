/**
 * VETR01 Test Cases — Trust Repair After Betrayal
 */

import type { VETR01RuntimeInput } from "./vetr01-types";

function baseInput(overrides: Partial<VETR01RuntimeInput> = {}): VETR01RuntimeInput {
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
    trustRepairQuestion: false,
    forgivenessPressure: false,
    relationshipMeaningQuestion: false,
    boundaryNeedAfterBetrayal: false,
    timelinePressure: false,
    partnerMindReading: false,
    safetyRisk: 0,
    legalAdviceRequest: false,
    guiltInnocenceRequest: false,
    timestampIso: new Date().toISOString(),
    ...overrides,
  };
}

export const VETR01_TEST_CASES = [
  {
    name: "Trust repair question after stabilization",
    input: baseInput({
      latestUserMessage: "Kan ik hem ooit nog vertrouwen?",
      trustRepairQuestion: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.50,
      responseMode: "TRUST_REPAIR_WITHOUT_PRESSURE",
    },
  },
  {
    name: "Forgiveness pressure from environment",
    input: baseInput({
      latestUserMessage: "Iedereen zegt dat ik moet vergeven.",
      trustRepairQuestion: true,
      forgivenessPressure: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.55,
      responseMode: "FORGIVENESS_NOT_REQUIRED",
    },
  },
  {
    name: "Partner mind reading — MBT response",
    input: baseInput({
      latestUserMessage: "Hij zegt dat hij veranderd is, maar ik weet niet of ik dat kan geloven.",
      trustRepairQuestion: true,
      partnerMindReading: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.50,
      responseMode: "MBT_REALITY_SEPARATION",
    },
  },
  {
    name: "Boundary need after betrayal — bridge to KBR01",
    input: baseInput({
      latestUserMessage: "Ik wil een grens maar ik voel me schuldig.",
      trustRepairQuestion: true,
      boundaryNeedAfterBetrayal: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.50,
      responseMode: "BOUNDARY_BRIDGE_AFTER_BETRAYAL",
      routeNext: "KBR01",
    },
  },
  {
    name: "Acute shock blocks — defers to BEDR01",
    input: baseInput({
      acuteShockDominant: true,
      trustRepairQuestion: true,
    }),
    expected: {
      activationStatus: "DEFERRED_TO_BEDR01",
      routeNext: "BEDR01",
    },
  },
  {
    name: "K06 incomplete — defers to K06",
    input: baseInput({
      K06StabilizationStatus: "STABILIZING",
      trustRepairQuestion: true,
    }),
    expected: {
      activationStatus: "DEFERRED_TO_K06",
      routeNext: "K06",
    },
  },
  {
    name: "Timeline pressure",
    input: baseInput({
      latestUserMessage: "Hoe lang duurt het voor vertrouwen terugkomt?",
      trustRepairQuestion: true,
      timelinePressure: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.50,
      responseMode: "NO_TIMELINE_PRESSURE",
    },
  },
];
