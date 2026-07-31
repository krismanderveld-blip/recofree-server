/**
 * TERV01 — Post-Purple Zone Relapse Chain Analysis (Elias only)
 * TEST CASES
 */
import { describe, it, expect } from 'vitest';
import { detectTERV01 } from './terv01-detector';
import { buildTERV01PromptPayload } from './terv01-prompt';
import { buildTERV01StoragePatch } from './terv01-storage';
import { routeTERV01 } from './terv01-router';
import type { TERV01RuntimeInput } from './terv01-types';

function baseInput(overrides: Partial<TERV01RuntimeInput> = {}): TERV01RuntimeInput {
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
  it('TEST 1: activates with full chain after PAARS', () => {
    const input = baseInput();
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('CLINICAL_CHAIN_MAPPING');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.90);
  });

  it('TEST 2: blocked during active PAARS', () => {
    const input = baseInput({ currentZone: 'PAARS' });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('BLOCKED_DURING_PAARS');
    expect(result.routeNext).toBe('FALE01_STAGE_1');
  });

  it('TEST 3: deferred when stabilization incomplete', () => {
    const input = baseInput({ stabilizationCompleted: false, userRegulationLevel: 0.40 });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('DEFERRED_STABILIZATION_REQUIRED');
    expect(result.routeNext).toBe('EKT01_VERHELDERING');
  });

  it('TEST 4: trigger clarification when trigger unknown', () => {
    const input = baseInput({ triggerKnown: false, chainDataCompleteness: 0.30 });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('TRIGGER_CLARIFICATION');
  });

  it('TEST 5: thought bridge when trigger known but thought unknown', () => {
    const input = baseInput({ triggerKnown: true, thoughtKnown: false, chainDataCompleteness: 0.40 });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('THOUGHT_BRIDGE_IDENTIFICATION');
  });

  it('TEST 6: blocked by medical risk', () => {
    const input = baseInput({ medicalRisk: 0.85 });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('BLOCKED_BY_MEDICAL');
    expect(result.routeNext).toBe('MEDICAL_SAFETY_PROTOCOL');
  });

  it('TEST 7: blocked by crisis', () => {
    const input = baseInput({ crisisProtocolStatus: 'ACTIVE' });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('BLOCKED_BY_CRISIS');
    expect(result.routeNext).toBe('CRISIS_PROTOCOL');
  });

  it('not active when no previous PAARS session', () => {
    const input = baseInput({ previousZone: 'GEEL' });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('NOT_ACTIVE');
  });

  it('routes to MI02 after prevention point contract', () => {
    const input = baseInput({ chainDataCompleteness: 0.50 });
    const result = detectTERV01(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.responseMode).toBe('PREVENTION_POINT_CONTRACT');
    expect(result.routeNext).toBe('MI02');
  });
});

describe('TERV01 Prompt Payload', () => {
  it('builds payload when active', () => {
    const input = baseInput();
    const detection = detectTERV01(input);
    const payload = buildTERV01PromptPayload(input, detection);
    expect(payload).not.toBeNull();
    expect(payload!.moduleId).toBe('TERV01');
    expect(payload!.clinicianReadable).toBe(true);
    expect(payload!.gptMayDiagnose).toBe(false);
    expect(payload!.gptMayAnalyzeDuringPaars).toBe(false);
  });

  it('returns null when not active', () => {
    const input = baseInput({ previousZone: 'GEEL' });
    const detection = detectTERV01(input);
    const payload = buildTERV01PromptPayload(input, detection);
    expect(payload).toBeNull();
  });
});

describe('TERV01 Storage Patch', () => {
  it('builds patch when active', () => {
    const input = baseInput();
    const detection = detectTERV01(input);
    const patch = buildTERV01StoragePatch(input, detection, { trigger: 'stress', triggerConfidence: 0.9 });
    expect(patch.lastActivatedModuleId).toBe('TERV01');
    expect(patch.relapseConfirmed).toBe(true);
    expect(patch.chainMap?.trigger).toBe('stress');
  });

  it('returns empty when not active', () => {
    const input = baseInput({ previousZone: 'GEEL' });
    const detection = detectTERV01(input);
    const patch = buildTERV01StoragePatch(input, detection, {});
    expect(Object.keys(patch).length).toBe(0);
  });
});

describe('TERV01 Router', () => {
  it('overrides to stabilization when shame is high', () => {
    const input = baseInput({ shameIntensity: 0.90 });
    const detection = detectTERV01(input);
    const decision = routeTERV01(input, detection);
    expect(decision.responseMode).toBe('POST_PAARS_STABILIZATION_CHECK');
    expect(decision.chainStep).toBe('stabilization');
  });
});
