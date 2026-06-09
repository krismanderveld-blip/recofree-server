/**
 * ROUW01 — Grief/Loss Through Addiction (Elias only)
 * TEST CASES: Canonical test expectations
 */
import type { ROUW01RuntimeInput } from './rouw01-types';

export function makeROUW01Input(overrides?: Partial<ROUW01RuntimeInput>): ROUW01RuntimeInput {
  return {
    intakeCompleted: true,
    persona: 'elias',
    latestUserMessage: '',
    recentMessages: [],
    language: 'nl',
    detectedMarkers: ['ik heb zoveel jaren verloren'],
    crisisProtocolStatus: 'CLEAR',
    medicalRisk: 0.1,
    safetyRisk: 0.1,
    acuteRelapseContainmentNeeded: false,
    regulationLevel: 0.6,
    readinessForAction: 0.4,
    primarySignal: 'ADDICTION_RELATED_GRIEF',
    confidenceSeeds: ['grief_language', 'loss_domain'],
    timestampIso: new Date().toISOString(),
    context: {
      lossDomains: ['time', 'relationships'],
      griefIntensity: 0.7,
      cravingLinkedToGrief: false,
      lostTimeMarker: true,
      identityLossMarker: false,
      relationshipLossMarker: true,
    },
    ...overrides,
  };
}

export const ROUW01_TEST_CASES = [
  {
    name: 'TC1: Lost years',
    input: 'Ik heb zoveel jaren verloren door alcohol.',
    expected: { activationStatus: 'ACTIVE', responseMode: 'NAME_LOSS_WITHOUT_FIXING' },
  },
  {
    name: 'TC2: Identity loss',
    input: 'Ik mis wie ik had kunnen zijn.',
    expected: { activationStatus: 'ACTIVE' },
  },
  {
    name: 'TC3: Grief-linked craving',
    input: 'Die rouw geeft me zucht.',
    expected: { activationStatus: 'ACTIVE' },
  },
  {
    name: 'TC4: Acute relapse override',
    input: 'Ik wil nu drinken om het verlies niet te voelen.',
    expected: { activationStatus: 'DEFERRED_TO_FALE01_OR_E01' },
  },
  {
    name: 'TC5: English grief',
    input: 'I lost my family because of addiction.',
    expected: { activationStatus: 'ACTIVE' },
  },
];
