/**
 * KBR01 — Boundary Restoration (Kim only)
 * TEST CASES
 */

import { describe, it, expect } from 'vitest';
import { detectKBR01 } from './kbr01-detector';
import { routeKBR01 } from './kbr01-router';
import { buildKBR01PromptPayload } from './kbr01-prompt';
import { buildKBR01StoragePatch } from './kbr01-storage';
import type { KBR01RuntimeInputs } from './kbr01-types';

function makeInput(overrides: Partial<KBR01RuntimeInputs> = {}): KBR01RuntimeInputs {
  return {
    userType: 'kim',
    latestUserMessage: '',
    crisisLevel: 0,
    k06SafetyGate: 'cleared',
    stabilizationStatus: 'stable',
    ...overrides,
  };
}

describe('KBR01 Detector', () => {
  it('detects boundary wording request', () => {
    const r = detectKBR01(makeInput({ latestUserMessage: 'What do I say when he comes home drunk? Give me a script.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('BOUNDARY_WORDING_REQUEST');
    expect(r.recommendedMode).toBe('SCRIPT_BUILDER');
  });

  it('detects boundary planning', () => {
    const r = detectKBR01(makeInput({ latestUserMessage: 'I need a boundary around his spending.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('BOUNDARY_PLANNING_REQUEST');
    expect(r.recommendedMode).toBe('BOUNDARY_CLARIFIER');
  });

  it('detects boundary collapse', () => {
    const r = detectKBR01(makeInput({ latestUserMessage: 'I gave in again. I said yes again even though I did not want to.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('BOUNDARY_COLLAPSE');
    expect(r.recommendedMode).toBe('FOLLOW_THROUGH_REPAIR');
  });

  it('detects over-explaining loop', () => {
    const r = detectKBR01(makeInput({ latestUserMessage: 'I keep explaining over and over but they do not listen.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('OVER_EXPLAINING_LOOP');
    expect(r.recommendedMode).toBe('OVER_EXPLAINING_STOP');
  });

  it('detects punitive intent and redirects', () => {
    const r = detectKBR01(makeInput({ latestUserMessage: 'I want to teach them a lesson. Make them pay.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('PUNITIVE_INTENT');
    expect(r.recommendedMode).toBe('PUNITIVE_REDIRECT');
  });

  it('blocks for Elias users', () => {
    const r = detectKBR01(makeInput({ userType: 'elias', latestUserMessage: 'I need a boundary.' }));
    expect(r.activationStatus).toBe('BLOCKED_WRONG_USER_TYPE');
  });

  it('blocks on crisis', () => {
    const r = detectKBR01(makeInput({ crisisLevel: 2, latestUserMessage: 'He threatens me.' }));
    expect(r.activationStatus).toBe('BLOCKED_BY_SAFETY');
    expect(r.routeNext).toBe('K06_SAFETY');
  });

  it('detects NL language', () => {
    const r = detectKBR01(makeInput({ latestUserMessage: 'Wat moet ik zeggen? Ik heb een grens nodig.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('BOUNDARY_WORDING_REQUEST');
  });

  it('activates from KDL01 route', () => {
    const r = detectKBR01(makeInput({ latestUserMessage: 'I need practical help now.', routedFromKDL01: true }));
    expect(r.confidenceScore).toBeGreaterThanOrEqual(0.35);
  });
});

describe('KBR01 Router', () => {
  it('returns full output contract', () => {
    const detection = detectKBR01(makeInput({ latestUserMessage: 'What do I say? Give me a script.' }));
    const output = routeKBR01(detection);
    expect(output.promptPayload).not.toBeNull();
    expect(output.storagePatch.kbr01Activated).toBe(true);
    expect(output.routeNext).toBe('KBR01_BOUNDARY_RESTORATION');
  });
});

describe('KBR01 Prompt', () => {
  it('returns null when not active', () => {
    const detection = detectKBR01(makeInput({ latestUserMessage: 'Hello' }));
    expect(buildKBR01PromptPayload(detection)).toBeNull();
  });

  it('returns valid payload when active', () => {
    const detection = detectKBR01(makeInput({ latestUserMessage: 'What do I say? Give me a script.' }));
    const payload = buildKBR01PromptPayload(detection);
    expect(payload!.moduleId).toBe('KBR01');
    expect(payload!.tone).toBe('warm_clear_firm_practical');
    expect(payload!.boundaryStructure).toHaveLength(5);
  });
});

describe('KBR01 Storage', () => {
  it('returns empty patch when not active', () => {
    const detection = detectKBR01(makeInput({ latestUserMessage: 'Hello' }));
    expect(buildKBR01StoragePatch(detection)).toEqual({});
  });

  it('increments script builder count', () => {
    const detection = detectKBR01(makeInput({ latestUserMessage: 'What do I say? Give me a script.' }));
    const patch = buildKBR01StoragePatch(detection, { kbr01Activated: true, activationCount: 1, boundaryReadinessHistory: [], boundaryCollapseCount: 0, scriptBuilderCount: 2, safetyExitCount: 0 });
    expect(patch.scriptBuilderCount).toBe(3);
  });
});
