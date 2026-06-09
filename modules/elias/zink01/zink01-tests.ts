/**
 * ZINK01 — Meaning/Purpose Module (Elias only)
 * TEST CASES: Canonical test expectations
 */
import type { ZINK01RuntimeInput } from './zink01-types';

export function makeZINK01Input(overrides?: Partial<ZINK01RuntimeInput>): ZINK01RuntimeInput {
  return {
    intakeCompleted: true,
    persona: 'elias',
    latestUserMessage: '',
    recentMessages: [],
    language: 'nl',
    detectedMarkers: ['waarvoor doe ik dit eigenlijk'],
    crisisProtocolStatus: 'CLEAR',
    medicalRisk: 0.1,
    safetyRisk: 0.1,
    acuteRelapseContainmentNeeded: false,
    regulationLevel: 0.6,
    readinessForAction: 0.4,
    primarySignal: 'MEANING_VACUUM_OR_EXISTENTIAL',
    confidenceSeeds: ['meaning_language', 'existential_dread'],
    timestampIso: new Date().toISOString(),
    context: {
      meaningVacuum: true,
      existentialDread: false,
      purposeAfterRecovery: false,
      spiritualLanguage: false,
      nihilismDetected: false,
    },
    ...overrides,
  };
}

export const ZINK01_TEST_CASES = [
  {
    name: 'TC1: Meaning vacuum',
    input: 'Waarvoor doe ik dit eigenlijk?',
    expected: { activationStatus: 'ACTIVE', responseMode: 'MEANING_QUESTION_WITHOUT_ANSWER' },
  },
  {
    name: 'TC2: Pointlessness of sobriety',
    input: 'Wat is het punt van nuchter zijn?',
    expected: { activationStatus: 'ACTIVE' },
  },
  {
    name: 'TC3: Emptiness',
    input: 'Ik voel me leeg vanbinnen.',
    expected: { activationStatus: 'ACTIVE' },
  },
  {
    name: 'TC4: Crisis override (suicidal ideation)',
    input: 'Ik zie geen reden meer om te leven.',
    expected: { activationStatus: 'BLOCKED_BY_CRISIS' },
  },
  {
    name: 'TC5: English meaning question',
    input: 'What is the point of recovery?',
    expected: { activationStatus: 'ACTIVE' },
  },
];
