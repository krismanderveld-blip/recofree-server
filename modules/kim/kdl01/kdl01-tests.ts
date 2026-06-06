/**
 * KDL01 — Detachment with Love (Kim only)
 * TEST CASES
 */

import { describe, it, expect } from 'vitest';
import { detectKDL01 } from './kdl01-detector';
import { routeKDL01 } from './kdl01-router';
import { buildKDL01PromptPayload } from './kdl01-prompt';
import { buildKDL01StoragePatch } from './kdl01-storage';
import type { KDL01RuntimeInputs } from './kdl01-types';

function makeInput(overrides: Partial<KDL01RuntimeInputs> = {}): KDL01RuntimeInputs {
  return {
    userType: 'kim',
    latestUserMessage: '',
    crisisLevel: 0,
    k06SafetyGate: 'cleared',
    stabilizationStatus: 'stable',
    ...overrides,
  };
}

describe('KDL01 Detector', () => {
  it('detects detachment request', () => {
    const r = detectKDL01(makeInput({ latestUserMessage: 'I need to detach but I still love them.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('DETACHMENT_REQUEST');
    expect(r.recommendedMode).toBe('DETACHMENT_NOT_ABANDONMENT');
  });

  it('detects self-loss through love', () => {
    const r = detectKDL01(makeInput({ latestUserMessage: 'I am losing myself in this. This is destroying me.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('SELF_LOSS_THROUGH_LOVE');
    expect(r.recommendedMode).toBe('LOVE_WITHOUT_SELF_ERASURE');
  });

  it('detects rescue fusion', () => {
    const r = detectKDL01(makeInput({ latestUserMessage: 'I keep saving them. Everything depends on me.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('RESCUE_FUSION');
    expect(r.recommendedMode).toBe('RESCUE_LOOP_INTERRUPT');
  });

  it('detects consequence guilt', () => {
    const r = detectKDL01(makeInput({ latestUserMessage: 'I feel cruel when I set a boundary. I feel selfish for choosing myself.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('CONSEQUENCE_GUILT');
    expect(r.recommendedMode).toBe('CONSEQUENCE_WITHOUT_CRUELTY');
  });

  it('blocks for Elias users', () => {
    const r = detectKDL01(makeInput({ userType: 'elias', latestUserMessage: 'I need to detach.' }));
    expect(r.activationStatus).toBe('BLOCKED_WRONG_USER_TYPE');
  });

  it('blocks on crisis', () => {
    const r = detectKDL01(makeInput({ crisisLevel: 3, latestUserMessage: 'He is threatening me.' }));
    expect(r.activationStatus).toBe('BLOCKED_BY_SAFETY');
    expect(r.routeNext).toBe('K06_SAFETY');
  });

  it('detects NL language', () => {
    const r = detectKDL01(makeInput({ latestUserMessage: 'Ik raak mezelf kwijt. Dit maakt mij kapot.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('SELF_LOSS_THROUGH_LOVE');
  });

  it('activates from KST01 route', () => {
    const r = detectKDL01(makeInput({ latestUserMessage: 'Ik weet het niet meer', routedFromKST01: true }));
    expect(r.confidenceScore).toBeGreaterThanOrEqual(0.4);
    expect(r.triggers).toContain('BOUNDARY_LOVE_CONFLICT');
  });
});

describe('KDL01 Router', () => {
  it('returns full output contract', () => {
    const detection = detectKDL01(makeInput({ latestUserMessage: 'I need to detach but I still love them.' }));
    const output = routeKDL01(detection);
    expect(output.promptPayload).not.toBeNull();
    expect(output.storagePatch.kdl01Activated).toBe(true);
    expect(output.routeNext).toBe('KDL01_DETACHMENT_WITH_LOVE');
  });
});

describe('KDL01 Prompt', () => {
  it('returns null when not active', () => {
    const detection = detectKDL01(makeInput({ latestUserMessage: 'Hello' }));
    expect(buildKDL01PromptPayload(detection)).toBeNull();
  });

  it('returns valid payload when active', () => {
    const detection = detectKDL01(makeInput({ latestUserMessage: 'I am losing myself. This is destroying me.' }));
    const payload = buildKDL01PromptPayload(detection);
    expect(payload!.moduleId).toBe('KDL01');
    expect(payload!.tone).toBe('warm_steady_grounded_gently_firm');
  });
});

describe('KDL01 Storage', () => {
  it('returns empty patch when not active', () => {
    const detection = detectKDL01(makeInput({ latestUserMessage: 'Hello' }));
    expect(buildKDL01StoragePatch(detection)).toEqual({});
  });

  it('increments activation count', () => {
    const detection = detectKDL01(makeInput({ latestUserMessage: 'I am losing myself. This is destroying me.' }));
    const patch = buildKDL01StoragePatch(detection, { kdl01Activated: true, activationCount: 2, selfLossLevelHistory: [], rescueLoopLevelHistory: [], boundaryLoveConflictCount: 0, safetyExitCount: 0 });
    expect(patch.activationCount).toBe(3);
  });
});
