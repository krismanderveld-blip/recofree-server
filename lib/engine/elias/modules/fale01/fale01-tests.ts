/**
 * FALE01 — Two-Stage Failure Response After Relapse (Elias only)
 * TEST CASES: Canonical test expectations
 */
import type { FALE01RuntimeInput } from './fale01-types';

export function makeFALE01Input(overrides?: Partial<FALE01RuntimeInput>): FALE01RuntimeInput {
  return {
    intakeCompleted: true,
    persona: 'elias',
    latestUserMessage: '',
    recentMessages: [],
    language: 'nl',
    detectedMarkers: ['ik ben hervallen', 'ik heb gefaald'],
    crisisProtocolStatus: 'CLEAR',
    medicalRisk: 0.1,
    safetyRisk: 0.1,
    acuteRelapseContainmentNeeded: false,
    regulationLevel: 0.6,
    readinessForAction: 0.4,
    primarySignal: 'RELAPSE_OR_FAILURE_EVENT',
    confidenceSeeds: ['relapse_confirmed', 'shame_high'],
    timestampIso: new Date().toISOString(),
    context: {
      relapseConfirmed: true,
      stage: 'STAGE_1_CONTAINMENT',
      shameIntensity: 0.7,
      continuationRisk: 0.5,
      chainClarity: 0.3,
      timeSinceRelapseHours: 2,
    },
    ...overrides,
  };
}

export const FALE01_TEST_CASES = [
  {
    name: 'TC1: Direct relapse → Stage 1 containment',
    input: 'Ik ben hervallen. Ik heb gefaald.',
    expected: { activationStatus: 'ACTIVE', responseMode: 'STAGE_1_IMMEDIATE_CONTAINMENT' },
  },
  {
    name: 'TC2: Continuation risk → Stage 1 continuation prevention',
    input: 'Nu maakt het toch niet meer uit.',
    expected: { activationStatus: 'ACTIVE', responseMode: 'STAGE_1_IMMEDIATE_CONTAINMENT' },
  },
  {
    name: 'TC3: Stable + ready → Stage 2 analysis',
    input: 'Ik ben veilig nu en wil kijken hoe het gebeurde.',
    expected: { activationStatus: 'ACTIVE', responseMode: 'STAGE_2_PREVENTION_CONTRACT' },
  },
  {
    name: 'TC4: Medical risk → blocked',
    input: 'Ik dronk veel en nam benzos.',
    expected: { activationStatus: 'BLOCKED_BY_MEDICAL' },
  },
  {
    name: 'TC5: English relapse + continuation',
    input: 'I relapsed and I might as well keep going.',
    expected: { activationStatus: 'ACTIVE' },
  },
];
