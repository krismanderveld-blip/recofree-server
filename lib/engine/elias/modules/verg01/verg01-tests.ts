/**
 * VERG01 — Self-Forgiveness After Relapse (Elias only)
 * TEST CASES: Canonical test expectations
 */
import type { VERG01RuntimeInput } from './verg01-types';

export function makeVERG01Input(overrides?: Partial<VERG01RuntimeInput>): VERG01RuntimeInput {
  return {
    intakeCompleted: true,
    persona: 'elias',
    latestUserMessage: '',
    recentMessages: [],
    language: 'nl',
    detectedMarkers: ['ik kan mezelf niet vergeven'],
    crisisProtocolStatus: 'CLEAR',
    medicalRisk: 0.1,
    safetyRisk: 0.1,
    acuteRelapseContainmentNeeded: false,
    regulationLevel: 0.6,
    readinessForAction: 0.4,
    primarySignal: 'SELF_FORGIVENESS_AFTER_RELAPSE',
    confidenceSeeds: ['forgiveness_language', 'relapse_guilt'],
    timestampIso: new Date().toISOString(),
    context: {
      forgivenessLanguage: true,
      relapseLinkedGuilt: true,
      selfPunishmentLoop: false,
      repairReadiness: 0.4,
      shameIntensity: 0.7,
      guiltIntensity: 0.6,
    },
    ...overrides,
  };
}

export const VERG01_TEST_CASES = [
  {
    name: 'TC1: Direct forgiveness struggle',
    input: 'Ik kan mezelf niet vergeven dat ik weer hervallen ben.',
    expected: { activationStatus: 'ACTIVE', responseMode: 'RESPONSIBILITY_WITHOUT_IDENTITY_COLLAPSE' },
  },
  {
    name: 'TC2: Self-punishment loop',
    input: 'Ik moet blijven boeten voor wat ik gedaan heb.',
    expected: { activationStatus: 'ACTIVE' },
  },
  {
    name: 'TC3: Forgiveness fear',
    input: 'Als ik mezelf vergeef praat ik het goed.',
    expected: { activationStatus: 'ACTIVE' },
  },
  {
    name: 'TC4: Repair readiness',
    input: 'Ik wil eerlijk herstellen wat ik kapot maakte.',
    expected: { activationStatus: 'ACTIVE', responseMode: 'REPAIR_READINESS_CHECK' },
  },
  {
    name: 'TC5: Crisis override',
    input: 'Ik kan niet leven met wat ik gedaan heb.',
    expected: { activationStatus: 'BLOCKED_BY_CRISIS' },
  },
];
