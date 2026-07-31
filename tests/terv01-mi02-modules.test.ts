/**
 * TERV01 + MI02 Module Tests
 * Validates both modules' detectors, prompts, storage, and routing
 */
import { describe, it, expect } from 'vitest';
import { detectTERV01 } from '../lib/engine/elias/modules/terv01/terv01-detector';
import { buildTERV01PromptPayload } from '../lib/engine/elias/modules/terv01/terv01-prompt';
import { buildTERV01StoragePatch } from '../lib/engine/elias/modules/terv01/terv01-storage';
import { routeTERV01 } from '../lib/engine/elias/modules/terv01/terv01-router';
import { detectMI02 } from '../lib/engine/elias/modules/mi02/mi02-detector';
import { buildMI02PromptPayload } from '../lib/engine/elias/modules/mi02/mi02-prompt';
import { buildMI02StoragePatch } from '../lib/engine/elias/modules/mi02/mi02-storage';
import { routeMI02 } from '../lib/engine/elias/modules/mi02/mi02-router';
import type { TERV01RuntimeInput } from '../lib/engine/elias/modules/terv01/terv01-types';
import type { MI02RuntimeInput } from '../lib/engine/elias/modules/mi02/mi02-types';

// ── TERV01 Tests ──

function baseTERV01Input(overrides: Partial<TERV01RuntimeInput> = {}): TERV01RuntimeInput {
  return {
    intakeCompleted: true,
    persona: 'elias',
    currentZone: 'GEEL',
    previousZone: 'PAARS',
    previousSessionEnded: true,
    previousSessionId: 'session-001',
    stabilizationCompleted: true,
    latestUserMessage: 'Ik wil begrijpen hoe het fout liep.',
    recentMessages: [],
    language: 'nl',
    detectedMarkers: [],
    crisisProtocolStatus: 'CLEAR',
    medicalRisk: 0.1,
    safetyRisk: 0.1,
    relapseConfirmed: true,
    relapseLikely: true,
    userRequestsAnalysis: true,
    userRegulationLevel: 0.70,
    shameIntensity: 0.30,
    chainDataCompleteness: 0.80,
    triggerKnown: true,
    thoughtKnown: true,
    feelingKnown: true,
    behaviorKnown: true,
    usePointKnown: true,
    timestampIso: new Date().toISOString(),
    ...overrides,
  };
}

describe('TERV01 Detector', () => {
  it('activates with full chain after PAARS', () => {
    const input = baseTERV01Input();
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('CLINICAL_CHAIN_MAPPING');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.90);
  });

  it('blocked during active PAARS', () => {
    const input = baseTERV01Input({ currentZone: 'PAARS' });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('BLOCKED_DURING_PAARS');
    expect(result.routeNext).toBe('FALE01_STAGE_1');
  });

  it('deferred when stabilization incomplete', () => {
    const input = baseTERV01Input({ stabilizationCompleted: false, userRegulationLevel: 0.40 });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('DEFERRED_STABILIZATION_REQUIRED');
    expect(result.routeNext).toBe('EKT01_VERHELDERING');
  });

  it('trigger clarification when trigger unknown', () => {
    const input = baseTERV01Input({ triggerKnown: false, chainDataCompleteness: 0.30 });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('TRIGGER_CLARIFICATION');
  });

  it('thought bridge when trigger known but thought unknown', () => {
    const input = baseTERV01Input({ triggerKnown: true, thoughtKnown: false, chainDataCompleteness: 0.40 });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('THOUGHT_BRIDGE_IDENTIFICATION');
  });

  it('blocked by medical risk', () => {
    const input = baseTERV01Input({ medicalRisk: 0.85 });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('BLOCKED_BY_MEDICAL');
    expect(result.routeNext).toBe('MEDICAL_SAFETY_PROTOCOL');
  });

  it('blocked by crisis', () => {
    const input = baseTERV01Input({ crisisProtocolStatus: 'ACTIVE' });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('BLOCKED_BY_CRISIS');
    expect(result.routeNext).toBe('CRISIS_PROTOCOL');
  });

  it('not active when no previous PAARS session', () => {
    const input = baseTERV01Input({ previousZone: 'GEEL' });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('NOT_ACTIVE');
  });

  it('routes to MI02 after prevention point contract', () => {
    const input = baseTERV01Input({ chainDataCompleteness: 0.50 });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('PREVENTION_POINT_CONTRACT');
    expect(result.routeNext).toBe('MI02');
  });
});

describe('TERV01 Prompt Payload', () => {
  it('builds payload when active', () => {
    const input = baseTERV01Input();
    const detection = detectTERV01(input);
    const payload = buildTERV01PromptPayload(input, detection);
    expect(payload).not.toBeNull();
    expect(payload!.moduleId).toBe('TERV01');
    expect(payload!.clinicianReadable).toBe(true);
    expect(payload!.gptMayDiagnose).toBe(false);
    expect(payload!.gptMayAnalyzeDuringPaars).toBe(false);
  });

  it('returns null when not active', () => {
    const input = baseTERV01Input({ previousZone: 'GEEL' });
    const detection = detectTERV01(input);
    const payload = buildTERV01PromptPayload(input, detection);
    expect(payload).toBeNull();
  });
});

describe('TERV01 Storage Patch', () => {
  it('builds patch when active', () => {
    const input = baseTERV01Input();
    const detection = detectTERV01(input);
    const patch = buildTERV01StoragePatch(input, detection, { trigger: 'stress', triggerConfidence: 0.9 });
    expect(patch.lastActivatedModuleId).toBe('TERV01');
    expect(patch.relapseConfirmed).toBe(true);
    expect(patch.chainMap?.trigger).toBe('stress');
  });

  it('returns empty when not active', () => {
    const input = baseTERV01Input({ previousZone: 'GEEL' });
    const detection = detectTERV01(input);
    const patch = buildTERV01StoragePatch(input, detection, {});
    expect(Object.keys(patch).length).toBe(0);
  });
});

describe('TERV01 Router', () => {
  it('overrides to stabilization when shame is high', () => {
    const input = baseTERV01Input({ shameIntensity: 0.90 });
    const detection = detectTERV01(input);
    const decision = routeTERV01(input, detection);
    expect(decision.responseMode).toBe('POST_PAARS_STABILIZATION_CHECK');
    expect(decision.chainStep).toBe('stabilization');
  });
});

// ── MI02 Tests ──

function baseMI02Input(overrides: Partial<MI02RuntimeInput> = {}): MI02RuntimeInput {
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
  it('double-sided reflection with full ambivalence', () => {
    const input = baseMI02Input();
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('DOUBLE_SIDED_REFLECTION');
    expect(result.oarsTechnique).toBe('REFLECTION');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.75);
  });

  it('affirm autonomy when advice resistance', () => {
    const input = baseMI02Input({
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

  it('sustain talk reflection with sufficient signals', () => {
    const input = baseMI02Input({
      directAmbivalenceMarker: true,
      changeTalkPresent: false,
      sustainTalkPresent: true,
    });
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('SUSTAIN_TALK_REFLECTION');
  });

  it('change talk evocation routes to ACT', () => {
    const input = baseMI02Input({
      directAmbivalenceMarker: true,
      changeTalkPresent: true,
      sustainTalkPresent: false,
    });
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('CHANGE_TALK_EVOCATION');
    expect(result.routeNext).toBe('ACT');
  });

  it('deferred during PAARS zone', () => {
    const input = baseMI02Input({ paarsZoneActive: true });
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('DEFERRED_TO_RELAPSE_CONTAINMENT');
    expect(result.routeNext).toBe('FALE01');
  });

  it('blocked by crisis', () => {
    const input = baseMI02Input({ crisisProtocolStatus: 'ACTIVE' });
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('BLOCKED_BY_CRISIS');
    expect(result.routeNext).toBe('CRISIS_PROTOCOL');
  });

  it('blocked by medical risk', () => {
    const input = baseMI02Input({ medicalRisk: 0.85 });
    const result = detectMI02(input);
    expect(result.activationStatus).toBe('BLOCKED_BY_MEDICAL');
    expect(result.routeNext).toBe('MEDICAL_SAFETY_PROTOCOL');
  });

  it('not active below threshold', () => {
    const input = baseMI02Input({
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
    const input = baseMI02Input({
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
    const input = baseMI02Input({
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
    const input = baseMI02Input();
    const detection = detectMI02(input);
    const payload = buildMI02PromptPayload(detection);
    expect(payload).not.toBeNull();
    expect(payload!.moduleId).toBe('MI02');
    expect(payload!.gptMayDiagnose).toBe(false);
    expect(payload!.gptMayPersuade).toBe(false);
    expect(payload!.gptMayDecideForUser).toBe(false);
  });

  it('returns null when not active', () => {
    const input = baseMI02Input({ crisisProtocolStatus: 'ACTIVE' });
    const detection = detectMI02(input);
    const payload = buildMI02PromptPayload(detection);
    expect(payload).toBeNull();
  });
});

describe('MI02 Storage Patch', () => {
  it('builds patch when active', () => {
    const input = baseMI02Input();
    const detection = detectMI02(input);
    const patch = buildMI02StoragePatch(input, detection);
    expect(patch.lastActivatedModuleId).toBe('MI02');
    expect(patch.changeTalkPresent).toBe(true);
    expect(patch.sustainTalkPresent).toBe(true);
    expect(patch.directAmbivalenceMarker).toBe(true);
  });

  it('returns empty when not active', () => {
    const input = baseMI02Input({ crisisProtocolStatus: 'ACTIVE' });
    const detection = detectMI02(input);
    const patch = buildMI02StoragePatch(input, detection);
    expect(Object.keys(patch).length).toBe(0);
  });
});

describe('MI02 Router', () => {
  it('bridges to ACT when change talk evocation', () => {
    const input = baseMI02Input({
      directAmbivalenceMarker: true,
      changeTalkPresent: true,
      sustainTalkPresent: false,
    });
    const detection = detectMI02(input);
    const decision = routeMI02(input, detection);
    expect(decision.bridgeToACT).toBe(true);
  });

  it('bridges to AGC01 when external motivation dominates', () => {
    const input = baseMI02Input({
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
