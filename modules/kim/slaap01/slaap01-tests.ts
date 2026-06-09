/**
 * SLAAP01 Kim Test Cases
 * Canonical test cases from spec section 17.
 */

import type { SLAAP01KimRuntimeInput } from "./slaap01-types";

function baseKimInput(overrides: Partial<SLAAP01KimRuntimeInput> = {}): SLAAP01KimRuntimeInput {
  return {
    persona: "kim",
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
    nightVigilanceDetected: false,
    sleepGuiltDetected: false,
    fatigueBoundaryTriggerDetected: false,
    boundaryFatigueIntensity: 0,
    caregiverStressIntensity: 0,
    acuteHouseholdSafetyRisk: false,
    timestampIso: new Date().toISOString(),
    ...overrides,
  };
}

export const SLAAP01_KIM_TEST_CASES = [
  {
    name: "TEST 6 - Kim night vigilance",
    input: baseKimInput({
      latestUserMessage: "Ik blijf wakker om te luisteren of hij drinkt.",
      nightVigilanceDetected: true,
      sleepProblemDetected: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      responseMode: "KIM_NIGHT_VIGILANCE_BOUNDARY",
      routeNext: "KBR01",
    },
  },
  {
    name: "TEST 7 - Kim sleep guilt",
    input: baseKimInput({
      latestUserMessage: "Ik voel me schuldig als ik ga slapen terwijl hij zo zit.",
      sleepGuiltDetected: true,
      sleepProblemDetected: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      responseMode: "KIM_SLEEP_GUILT_DECOUPLING",
      routeNext: "KSC01",
    },
  },
  {
    name: "TEST 8 - Kim fatigue boundary",
    input: baseKimInput({
      latestUserMessage: "Als ik moe ben ontplof ik sneller en kan ik mijn grens niet houden.",
      fatigueBoundaryTriggerDetected: true,
      sleepProblemDetected: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      responseMode: "KIM_FATIGUE_BOUNDARY_TRIGGER",
      routeNext: "KBR01",
    },
  },
  {
    name: "TEST 9 - Kim sleep hygiene",
    input: baseKimInput({
      latestUserMessage: "Ik slaap slecht. Wat kan ik doen?",
      sleepProblemDetected: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      responseMode: "KIM_SLEEP_HYGIENE_WITHOUT_GUILT",
      routeNext: "SLAAP01",
    },
  },
  {
    name: "TEST 11 - Kim acute household safety",
    input: baseKimInput({
      latestUserMessage: "Ik durf niet te slapen want hij is agressief als hij drinkt.",
      nightVigilanceDetected: true,
      sleepProblemDetected: true,
      acuteHouseholdSafetyRisk: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      responseMode: "KIM_CAREGIVER_SAFETY_DISTINCTION",
      routeNext: "SAFETY_PROTOCOL",
    },
  },
  {
    name: "TEST 12 - Kim crisis override",
    input: baseKimInput({
      crisisProtocolStatus: "ACTIVE",
      sleepProblemDetected: true,
    }),
    expected: {
      activationStatus: "BLOCKED_BY_CRISIS",
      routeNext: "CRISIS_PROTOCOL",
    },
  },
];
