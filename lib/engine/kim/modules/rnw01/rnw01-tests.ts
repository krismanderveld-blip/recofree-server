/**
 * RNW01 Test Cases — Rouw Naaste: Wie Ze Was
 */

import type { RNW01RuntimeInput } from "./rnw01-types";

function baseInput(overrides: Partial<RNW01RuntimeInput> = {}): RNW01RuntimeInput {
  return {
    intakeCompleted: true,
    persona: "kim",
    latestUserMessage: "",
    recentMessages: [],
    language: "nl",
    detectedMarkers: [],
    crisisProtocolStatus: "CLEAR",
    K06StabilizationStatus: "STABILIZED",
    missesOldPerson: false,
    griefForLivingPerson: false,
    ambiguousGriefMarker: false,
    falseHopeSeeking: false,
    acceptancePressure: false,
    relationshipAsItWasLost: false,
    guiltAboutGrieving: false,
    futureLoss: false,
    acuteFlooding: false,
    safetyRisk: 0,
    timestampIso: new Date().toISOString(),
    ...overrides,
  };
}

export const RNW01_TEST_CASES = [
  {
    name: "Misses who they were — primary validation",
    input: baseInput({
      latestUserMessage: "Ik mis wie hij was.",
      missesOldPerson: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.35,
      responseMode: "MISSING_WHO_THEY_WERE_VALIDATION",
    },
  },
  {
    name: "Ambiguous grief naming",
    input: baseInput({
      latestUserMessage: "Zij leeft nog maar voelt weg.",
      griefForLivingPerson: true,
      ambiguousGriefMarker: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.35,
      responseMode: "AMBIGUOUS_GRIEF_NAMING",
    },
  },
  {
    name: "False hope seeking — no false hope response",
    input: baseInput({
      latestUserMessage: "Komt de oude hem ooit terug?",
      missesOldPerson: true,
      falseHopeSeeking: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.40,
      responseMode: "NO_FALSE_HOPE_STILL_TENDER",
    },
  },
  {
    name: "Acceptance pressure — no forced acceptance",
    input: baseInput({
      latestUserMessage: "Ik moet dit gewoon accepteren zeker?",
      missesOldPerson: true,
      acceptancePressure: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.40,
      responseMode: "NO_FORCED_ACCEPTANCE",
    },
  },
  {
    name: "Relationship loss validation",
    input: baseInput({
      latestUserMessage: "Ik mis ons van vroeger.",
      missesOldPerson: true,
      relationshipAsItWasLost: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.45,
      responseMode: "RELATIONSHIP_LOSS_VALIDATION",
    },
  },
  {
    name: "Guilt about grieving — bridge to KSC01",
    input: baseInput({
      latestUserMessage: "Ik voel me schuldig dat ik rouw terwijl hij nog leeft.",
      missesOldPerson: true,
      guiltAboutGrieving: true,
    }),
    expected: {
      activationStatus: "ACTIVE",
      minConfidence: 0.45,
      responseMode: "GRIEF_PERMISSION_WITHOUT_GUILT",
      routeNext: "KSC01",
    },
  },
  {
    name: "Crisis blocks activation",
    input: baseInput({
      crisisProtocolStatus: "ACTIVE",
      missesOldPerson: true,
    }),
    expected: {
      activationStatus: "BLOCKED_BY_CRISIS",
      routeNext: "CRISIS_PROTOCOL",
    },
  },
  {
    name: "K06 stabilizing + acute flooding — deferred",
    input: baseInput({
      K06StabilizationStatus: "STABILIZING",
      acuteFlooding: true,
      missesOldPerson: true,
    }),
    expected: {
      activationStatus: "DEFERRED_TO_K06",
      routeNext: "K06",
    },
  },
];
