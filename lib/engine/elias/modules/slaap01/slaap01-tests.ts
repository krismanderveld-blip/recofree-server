/**
 * SLAAP01 Elias Test Cases
 * Canonical test cases from spec section 17.
 */

import type { SLAAP01EliasRuntimeInput } from "./slaap01-types";

function baseEliasInput(overrides: Partial<SLAAP01EliasRuntimeInput> = {}): SLAAP01EliasRuntimeInput {
  return {
    persona: "elias",
    intakeCompleted: true,
    latestUserMessage: "",
    recentMessages: [],
    language: "nl",
    detectedMarkers: [],
    crisisProtocolStatus: "CLEAR",
    medicalRisk: 0.1,
    safetyRisk: 0.1,
    sleepProblemDetected: false,
    sleepAnxietyDetected: false,
    nightCravingDetected: false,
    cravingIntensity: 0,
    fatigueRelapseTriggerDetected: false,
    withdrawalSleepConcern: false,
    withdrawalRisk: 0,
    paarsZoneActive: false,
    relapseRecentlyOccurred: false,
    timestampIso: new Date().toISOString(),
    ...overrides,
  };
}

export const SLAAP01_ELIAS_TEST_CASES = [
  {
    name: "TEST 1 - Elias night craving",
    input: baseEliasInput({
      latestUserMessage: "'s Nachts krijg ik zucht en wil ik drinken.",
      nightCravingDetected: true,
      cravingIntensity: 0.75,
      sleepProblemDetected: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      responseMode: "ELIAS_NIGHT_CRAVING_DISTRESS_TOLERANCE",
      routeNext: "E01",
    },
  },
  {
    name: "TEST 2 - Elias sleep hygiene",
    input: baseEliasInput({
      latestUserMessage: "Wat kan ik doen om beter te slapen zonder medicatie?",
      sleepProblemDetected: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      responseMode: "ELIAS_SLEEP_HYGIENE_NO_PRESSURE",
      routeNext: "SLAAP01",
    },
  },
  {
    name: "TEST 3 - Elias withdrawal concern",
    input: baseEliasInput({
      latestUserMessage: "Sinds ik gestopt ben met alcohol slaap ik niet en tril ik.",
      withdrawalSleepConcern: true,
      withdrawalRisk: 0.80,
      sleepProblemDetected: true,
    }),
    expected: {
      activationStatus: "BLOCKED_BY_MEDICAL",
      responseMode: "ELIAS_WITHDRAWAL_SLEEP_MEDICAL_CAUTION",
      routeNext: "MEDICAL_SAFETY_PROTOCOL",
    },
  },
  {
    name: "TEST 4 - Elias sleep anxiety",
    input: baseEliasInput({
      latestUserMessage: "Ik ben bang dat ik weer niet zal slapen.",
      sleepAnxietyDetected: true,
      sleepProblemDetected: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      responseMode: "ELIAS_SLEEP_ANXIETY_ACCEPTANCE",
      routeNext: "SLAAP01",
    },
  },
  {
    name: "TEST 5 - Elias PAARS block",
    input: baseEliasInput({
      paarsZoneActive: true,
      nightCravingDetected: true,
      sleepProblemDetected: true,
    }),
    expected: {
      activationStatus: "DEFERRED_TO_RELAPSE_OR_SAFETY",
      routeNext: "FALE01",
    },
  },
  {
    name: "TEST 10 - Crisis override",
    input: baseEliasInput({
      crisisProtocolStatus: "ACTIVE",
      sleepProblemDetected: true,
    }),
    expected: {
      activationStatus: "BLOCKED_BY_CRISIS",
      routeNext: "CRISIS_PROTOCOL",
    },
  },
];
