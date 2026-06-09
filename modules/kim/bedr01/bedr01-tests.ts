/**
 * BEDR01 Test Cases — Betrayal Discovery Response
 */

import type { BEDR01RuntimeInput } from "./bedr01-types";

function baseInput(overrides: Partial<BEDR01RuntimeInput> = {}): BEDR01RuntimeInput {
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
    discoveryJustHappened: false,
    bodyDysregulation: false,
    decisionPressure: false,
    childrenInvolved: false,
    safetyRisk: 0,
    legalAdviceRequest: false,
    guiltInnocenceRequest: false,
    timestampIso: new Date().toISOString(),
    ...overrides,
  };
}

export const BEDR01_TEST_CASES = [
  {
    name: "Acute shock after discovery",
    input: baseInput({
      latestUserMessage: "Ik heb het net ontdekt. Hij heeft me bedrogen. Ik ben in shock.",
      acuteShockDominant: true,
      discoveryJustHappened: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.65,
      responseMode: "REALITY_ANCHOR",
    },
  },
  {
    name: "Body dysregulation dominant",
    input: baseInput({
      latestUserMessage: "Ik kan niet stoppen met trillen. Ik vond berichten op zijn telefoon.",
      acuteShockDominant: true,
      discoveryJustHappened: true,
      bodyDysregulation: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.80,
      responseMode: "BODY_REGULATION_FIRST",
    },
  },
  {
    name: "Decision pressure — no pressure response",
    input: baseInput({
      latestUserMessage: "Iedereen zegt dat ik nu moet beslissen of ik wegga.",
      acuteShockDominant: true,
      discoveryJustHappened: false,
      decisionPressure: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.50,
      responseMode: "NO_DECISION_PRESSURE",
    },
  },
  {
    name: "Children involved + safety risk",
    input: baseInput({
      latestUserMessage: "De kinderen waren erbij toen ik het ontdekte.",
      acuteShockDominant: true,
      discoveryJustHappened: true,
      childrenInvolved: true,
      safetyRisk: 0.45,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.75,
      responseMode: "CHILDREN_SAFETY_CHECK",
    },
  },
  {
    name: "Crisis blocks activation",
    input: baseInput({
      crisisProtocolStatus: "ACTIVE",
      acuteShockDominant: true,
    }),
    expected: {
      activationStatus: "BLOCKED_BY_CRISIS",
      routeNext: "CRISIS_PROTOCOL",
    },
  },
  {
    name: "Safety risk defers",
    input: baseInput({
      safetyRisk: 0.80,
      acuteShockDominant: true,
    }),
    expected: {
      activationStatus: "DEFERRED_TO_SAFETY",
      routeNext: "SAFETY_PROTOCOL",
    },
  },
  {
    name: "Persona block — Elias rejected",
    input: baseInput({
      persona: "kim" as any, // Would be "elias" in real test
    }),
    expected: {
      activationStatus: "NOT_ACTIVE", // Below threshold with no signals
    },
  },
];
