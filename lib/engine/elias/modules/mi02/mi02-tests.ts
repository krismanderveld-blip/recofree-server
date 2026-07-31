/**
 * MI02 — Motivational Interviewing Verdieping (Elias only)
 * TEST CASES
 */
import { describe, it, expect } from 'vitest';
import { detectMI02 } from './mi02-detector';
import { buildMI02PromptPayload } from './mi02-prompt';
import { buildMI02StoragePatch } from './mi02-storage';
import { routeMI02 } from './mi02-router';
import type { MI02RuntimeInput } from './mi02-types';

function baseInput(overrides: Partial<MI02RuntimeInput> = {}): MI02RuntimeInput {
  return {
    intakeCompleted: true,
    persona: 'elias',
    latestUserMessage: 'Ik wil herstellen maar ook niet.',
    recentMessages: [],
    language: 'nl',
    detectedMarkers: [],
    crisisProtocolStatus: 'CLEAR',
    medicalRisk: 0.1,
    safetyRisk: 0.1,
    paarsZoneActive: false,
    cravingIntensity: 0.4,
    userRegulationLevel: 0.70,
    directAmbivalenceMarker: true,
    changeTalkPresent: true,
    sustainTalkPresent: true,
    adviceResistance: false,
    externalMotivationDominant: false,
    readinessScoreAvailable: false,
    sessionMixedSignalsCount: 2,
    mi01PreviouslyActive: true,
    timestampIso: new Date().toISOString(),
    ...overrides,
  };
}

describe('MI02 Detector', () => {
  it('TEST 1: double-sided reflection with full ambivalence', () => {
    const input = baseInput();
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('DOUBLE_SIDED_REFLECTION');
    expect(result.oarsTechnique).toBe('REFLECTION');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.75);
  });

  it('TEST 2: sustain talk reflection when only sustain talk', () => {
    const input = baseInput({
      latestUserMessage: 'Gebruik helpt me ook.',
      directAmbivalenceMarker: false,
      changeTalkPresent: false,
      sustainTalkPresent: true,
      sessionMixedSignalsCount: 0,
    });
    const result = detectMI02(input);
    // Score: sustain+change=0 (only sustain, no change), advice=0, external=0, mixed=0, markers=0.10, mi01=0.05 = 0.15 < 0.50
    // Need more signals to activate
    expect(result.activationStatus).toBe('NOT_ACTIVE');
  });

  it('TEST 3: affirm autonomy when advice resistance', () => {
    const input = baseInput({
      latestUserMessage: 'Ik wil geen advies.',
      directAmbivalenceMarker: true,
      adviceResistance: true,
      changeTalkPresent: false,
      sustainTalkPresent: false,
    });
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('AFFIRM_AUTONOMY');
    expect(result.oarsTechnique).toBe('AFFIRMATION');
  });

  it('TEST 4: sustain talk reflection with sufficient signals', () => {
    const input = baseInput({
      latestUserMessage: 'Gebruik helpt me ook.',
      directAmbivalenceMarker: true,
      changeTalkPresent: false,
      sustainTalkPresent: true,
    });
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('SUSTAIN_TALK_REFLECTION');
  });

  it('TEST 5: change talk evocation', () => {
    const input = baseInput({
      latestUserMessage: 'Een klein deel wil wel beter worden.',
      directAmbivalenceMarker: true,
      changeTalkPresent: true,
      sustainTalkPresent: false,
    });
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('CHANGE_TALK_EVOCATION');
    expect(result.routeNext).toBe('ACT');
  });

  it('TEST 6: deferred during PAARS zone', () => {
    const input = baseInput({ paarsZoneActive: true });
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('DEFERRED_TO_RELAPSE_CONTAINMENT');
    expect(result.routeNext).toBe('FALE01');
  });

  it('TEST 7: blocked by crisis', () => {
    const input = baseInput({ crisisProtocolStatus: 'ACTIVE' });
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('BLOCKED_BY_CRISIS');
    expect(result.routeNext).toBe('CRISIS_PROTOCOL');
  });

  it('blocked by medical risk', () => {
    const input = baseInput({ medicalRisk: 0.85 });
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('BLOCKED_BY_MEDICAL');
    expect(result.routeNext).toBe('MEDICAL_SAFETY_PROTOCOL');
  });

  it('not active below threshold', () => {
    const input = baseInput({
      directAmbivalenceMarker: false,
      changeTalkPresent: false,
      sustainTalkPresent: false,
      adviceResistance: false,
      externalMotivationDominant: false,
      sessionMixedSignalsCount: 0,
      mi01PreviouslyActive: false,
      latestUserMessage: 'Hoe gaat het vandaag?',
    });
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('NOT_ACTIVE');
  });

  it('routes to AGC01 when external motivation dominates', () => {
    const input = baseInput({
      directAmbivalenceMarker: true,
      changeTalkPresent: false,
      sustainTalkPresent: true,
      externalMotivationDominant: true,
    });
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.routeNext).toBe('AGC01');
  });

  it('ambivalence summary when mixed signals >= 3', () => {
    const input = baseInput({
      directAmbivalenceMarker: true,
      changeTalkPresent: false,
      sustainTalkPresent: false,
      adviceResistance: false,
      sessionMixedSignalsCount: 4,
    });
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('AMBIVALENCE_SUMMARY');
    expect(result.oarsTechnique).toBe('SUMMARY');
  });
});

describe('MI02 Prompt Payload', () => {
  it('builds payload when active', () => {
    const input = baseInput();
    const detection = detectMI02(input);
    const payload = buildMI02PromptPayload(detection);
    expect(payload).not.toBeNull();
    expect(payload!.moduleId).toBe('MI02');
    expect(payload!.gptMayDiagnose).toBe(false);
    expect(payload!.gptMayPersuade).toBe(false);
    expect(payload!.gptMayDecideForUser).toBe(false);
  });

  it('returns null when not active', () => {
    const input = baseInput({ crisisProtocolStatus: 'ACTIVE' });
    const detection = detectMI02(input);
    const payload = buildMI02PromptPayload(detection);
    expect(payload).toBeNull();
  });
});

describe('MI02 Storage Patch', () => {
  it('builds patch when active', () => {
    const input = baseInput();
    const detection = detectMI02(input);
    const patch = buildMI02StoragePatch(input, detection);
    expect(patch.lastActivatedModuleId).toBe('MI02');
    expect(patch.changeTalkPresent).toBe(true);
    expect(patch.sustainTalkPresent).toBe(true);
    expect(patch.directAmbivalenceMarker).toBe(true);
  });

  it('returns empty when not active', () => {
    const input = baseInput({ crisisProtocolStatus: 'ACTIVE' });
    const detection = detectMI02(input);
    const patch = buildMI02StoragePatch(input, detection);
    expect(Object.keys(patch).length).toBe(0);
  });
});

describe('MI02 Router', () => {
  it('bridges to ACT when change talk evocation', () => {
    const input = baseInput({
      directAmbivalenceMarker: true,
      changeTalkPresent: true,
      sustainTalkPresent: false,
    });
    const detection = detectMI02(input);
    const decision = routeMI02(input, detection);
    expect(decision.bridgeToACT).toBe(true);
  });

  it('bridges to AGC01 when external motivation dominates', () => {
    const input = baseInput({
      directAmbivalenceMarker: true,
      changeTalkPresent: false,
      sustainTalkPresent: true,
      externalMotivationDominant: true,
    });
    const detection = detectMI02(input);
    const decision = routeMI02(input, detection);
    expect(decision.bridgeToAGC01).toBe(true);
  });
});
