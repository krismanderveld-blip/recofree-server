/**
 * KSC01 — Self-Compassion for Caregivers (Kim only)
 * TEST CASES
 */

import { describe, it, expect } from 'vitest';
import { detectKSC01 } from './ksc01-detector';
import { routeKSC01 } from './ksc01-router';
import { buildKSC01PromptPayload } from './ksc01-prompt';
import { buildKSC01StoragePatch } from './ksc01-storage';
import type { KSC01RuntimeInputs } from './ksc01-types';

function makeInput(overrides: Partial<KSC01RuntimeInputs> = {}): KSC01RuntimeInputs {
  return {
    userType: 'kim',
    latestUserMessage: '',
    crisisLevel: 0,
    k06SafetyGate: 'cleared',
    stabilizationStatus: 'stable',
    ...overrides,
  };
}

describe('KSC01 Detector', () => {
  it('detects caregiver shame', () => {
    const r = detectKSC01(makeInput({ latestUserMessage: 'I feel selfish. I am a bad partner. I am not enough.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('CAREGIVER_SHAME');
    expect(r.recommendedMode).toBe('SHAME_SOFTENING');
  });

  it('detects relapse self-blame', () => {
    const r = detectKSC01(makeInput({ latestUserMessage: 'It is my fault they relapsed. If i had done more this would not have happened.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('RELAPSE_SELF_BLAME');
    expect(r.recommendedMode).toBe('RELAPSE_NOT_MY_FAILURE');
  });

  it('detects boundary guilt', () => {
    const r = detectKSC01(makeInput({ latestUserMessage: 'I feel guilty for saying no. I feel guilty for setting a boundary.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('BOUNDARY_GUILT');
    expect(r.recommendedMode).toBe('GUILT_REALITY_CHECK');
  });

  it('detects anger shame', () => {
    const r = detectKSC01(makeInput({ latestUserMessage: 'I hate that i feel angry. I should not be angry at someone who is sick.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('ANGER_SHAME');
    expect(r.recommendedMode).toBe('ANGER_PERMISSION');
  });

  it('detects rest guilt', () => {
    const r = detectKSC01(makeInput({ latestUserMessage: 'I feel guilty for resting. I feel bad when i relax.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('REST_GUILT');
    expect(r.recommendedMode).toBe('REST_PERMISSION');
  });

  it('detects good caregiver myth', () => {
    const r = detectKSC01(makeInput({ latestUserMessage: 'A good partner would handle this better. Others manage better than me.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('GOOD_CAREGIVER_MYTH');
    expect(r.recommendedMode).toBe('GOOD_CAREGIVER_MYTH_REPAIR');
  });

  it('blocks for Elias users', () => {
    const r = detectKSC01(makeInput({ userType: 'elias', latestUserMessage: 'I feel selfish.' }));
    expect(r.activationStatus).toBe('BLOCKED_WRONG_USER_TYPE');
  });

  it('blocks on crisis', () => {
    const r = detectKSC01(makeInput({ crisisLevel: 2, latestUserMessage: 'I am in danger.' }));
    expect(r.activationStatus).toBe('BLOCKED_BY_SAFETY');
    expect(r.routeNext).toBe('K06_SAFETY');
  });

  it('detects NL language', () => {
    const r = detectKSC01(makeInput({ latestUserMessage: 'Ik voel me egoistisch. Ik ben een slechte partner.' }));
    expect(r.activationStatus).toBe('ACTIVE');
    expect(r.triggers).toContain('CAREGIVER_SHAME');
  });

  it('routes to KBR01 when boundary ready', () => {
    const r = detectKSC01(makeInput({
      latestUserMessage: 'I feel guilty for setting a boundary. But I think I need one.',
      boundaryReadinessLevel: 6,
    }));
    expect(r.recommendedMode).toBe('COMPASSION_TO_BOUNDARY');
    expect(r.routeNext).toBe('KBR01_BOUNDARY_RESTORATION');
  });

  it('routes to KDL01 when self-loss high', () => {
    const r = detectKSC01(makeInput({
      latestUserMessage: 'I feel selfish. I am not enough. I am disappearing.',
      selfLossLevel: 8,
    }));
    expect(r.routeNext).toBe('KDL01_DETACHMENT_WITH_LOVE');
  });

  it('activates from KST01 route', () => {
    const r = detectKSC01(makeInput({ latestUserMessage: 'I feel ashamed', routedFromKST01: true }));
    expect(r.confidenceScore).toBeGreaterThanOrEqual(0.3);
  });
});

describe('KSC01 Router', () => {
  it('returns full output contract', () => {
    const detection = detectKSC01(makeInput({ latestUserMessage: 'I feel selfish. I am a bad partner.' }));
    const output = routeKSC01(detection);
    expect(output.promptPayload).not.toBeNull();
    expect(output.storagePatch.ksc01Activated).toBe(true);
    expect(output.routeNext).toBe('KSC01_SELF_COMPASSION_CAREGIVER');
  });
});

describe('KSC01 Prompt', () => {
  it('returns null when not active', () => {
    const detection = detectKSC01(makeInput({ latestUserMessage: 'Hello' }));
    expect(buildKSC01PromptPayload(detection)).toBeNull();
  });

  it('returns valid payload when active', () => {
    const detection = detectKSC01(makeInput({ latestUserMessage: 'I feel selfish. I am a bad partner.' }));
    const payload = buildKSC01PromptPayload(detection);
    expect(payload!.moduleId).toBe('KSC01');
    expect(payload!.tone).toBe('warm_precise_grounded_shame_sensitive');
    expect(payload!.coreFrame).toBe('grounded_accountable_self_compassion');
  });
});

describe('KSC01 Storage', () => {
  it('returns empty patch when not active', () => {
    const detection = detectKSC01(makeInput({ latestUserMessage: 'Hello' }));
    expect(buildKSC01StoragePatch(detection)).toEqual({});
  });

  it('increments relapse self-blame count', () => {
    const detection = detectKSC01(makeInput({ latestUserMessage: 'It is my fault they relapsed. I should have seen it coming.' }));
    const patch = buildKSC01StoragePatch(detection, { ksc01Activated: true, activationCount: 1, caregiverShameHistory: [], guiltLevelHistory: [], relapseSelfBlameCount: 2, boundaryGuiltCount: 0, safetyExitCount: 0 });
    expect(patch.relapseSelfBlameCount).toBe(3);
  });
});
