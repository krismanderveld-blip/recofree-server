/**
 * IDEN01 — Identity Rebuilding Outside Addiction (Elias only)
 * TEST CASES: Canonical test expectations
 */
import type { IDEN01RuntimeInput } from './iden01-types';

export function makeIDEN01Input(overrides?: Partial<IDEN01RuntimeInput>): IDEN01RuntimeInput {
  return {
    intakeCompleted: true,
    persona: 'elias',
    latestUserMessage: '',
    recentMessages: [],
    language: 'nl',
    detectedMarkers: ['wie ben ik zonder mijn verslaving'],
    crisisProtocolStatus: 'CLEAR',
    medicalRisk: 0.1,
    safetyRisk: 0.1,
    acuteRelapseContainmentNeeded: false,
    regulationLevel: 0.6,
    readinessForAction: 0.4,
    primarySignal: 'IDENTITY_OUTSIDE_ADDICTION',
    confidenceSeeds: ['identity_language', 'addiction_fusion'],
    timestampIso: new Date().toISOString(),
    context: {
      addictionIdentityFusion: true,
      relapseIdentityCollapse: false,
      roleFusion: false,
      backpackAnchorsAvailable: true,
      valuesReadiness: 0.5,
    },
    ...overrides,
  };
}

export const IDEN01_TEST_CASES = [
  {
    name: 'TC1: Identity question',
    input: 'Wie ben ik zonder mijn verslaving?',
    expected: { activationStatus: 'ACTIVE', responseMode: 'IDENTITY_SEPARATION_FROM_ADDICTION' },
  },
  {
    name: 'TC2: Addiction-identity fusion',
    input: 'Ik ben alleen nog een verslaafde.',
    expected: { activationStatus: 'ACTIVE' },
  },
  {
    name: 'TC3: Relapse identity collapse',
    input: 'Na die terugval ben ik weer niets.',
    expected: { activationStatus: 'ACTIVE' },
  },
  {
    name: 'TC4: Role fusion',
    input: 'Ik ben alleen nog patient.',
    expected: { activationStatus: 'ACTIVE' },
  },
  {
    name: 'TC5: English identity',
    input: 'Who am I outside alcohol?',
    expected: { activationStatus: 'ACTIVE' },
  },
];
