/**
 * KST01 — Stoicism for Caregivers (Kim only)
 * TEST CASES: Vitest unit tests
 */

import { describe, it, expect } from 'vitest';
import { detectKST01 } from './kst01-detector';
import { routeKST01 } from './kst01-router';
import { buildKST01PromptPayload, buildKST01FullPromptBlock } from './kst01-prompt';
import { buildKST01StoragePatch, updateKST01Progress } from './kst01-storage';
import type { KST01RuntimeInputs } from './kst01-types';

function makeInput(overrides: Partial<KST01RuntimeInputs> = {}): KST01RuntimeInputs {
  return {
    userType: 'kim',
    latestUserMessage: '',
    crisisLevel: 0,
    k06SafetyGate: 'cleared',
    stabilizationStatus: 'stable',
    ...overrides,
  };
}

describe('KST01 Detector', () => {
  it('TEST 1: Control loop detection', () => {
    const result = detectKST01(makeInput({ latestUserMessage: 'How do I make him stop drinking?' }));
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.triggers).toContain('CONTROL_LOOP_CAREGIVER');
    expect(result.recommendedMode).toBe('CONTROL_SEPARATOR');
    expect(result.recommendedPrinciples).toContain('DICHOTOMY_OF_CONTROL');
  });

  it('TEST 2: Over-responsibility detection', () => {
    const result = detectKST01(makeInput({ latestUserMessage: 'His relapse is my fault. I feel responsible for everything.' }));
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.triggers).toContain('OVER_RESPONSIBILITY');
    expect(result.recommendedMode).toBe('CONTROL_SEPARATOR');
  });

  it('TEST 3: Self-loss detection', () => {
    const result = detectKST01(makeInput({ latestUserMessage: 'I am losing myself in this. Everything is about them.' }));
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.triggers).toContain('SELF_LOSS_THROUGH_CARE');
    expect(result.recommendedMode).toBe('SELF_CONNECTION_RESTORE');
    expect(result.recommendedPrinciples).toContain('MEMENTO_MORI');
    expect(result.recommendedPrinciples).toContain('SYMPATHEIA');
  });

  it('TEST 4: Philosophy request', () => {
    const result = detectKST01(makeInput({ latestUserMessage: 'What would Stoicism say about this?' }));
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.triggers).toContain('PHILOSOPHY_REQUEST');
    expect(result.recommendedMode).toBe('CONTROL_SEPARATOR');
  });

  it('TEST 5: Meaning after relapse', () => {
    const result = detectKST01(makeInput({ latestUserMessage: 'She relapsed again. What is the point?' }));
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.triggers).toContain('MEANING_AFTER_RELAPSE');
    expect(result.recommendedMode).toBe('MEANING_AFTER_RELAPSE');
    expect(result.recommendedPrinciples).toContain('AMOR_FATI');
  });

  it('TEST 6: Blocked for Elias users', () => {
    const result = detectKST01(makeInput({ userType: 'elias', latestUserMessage: 'I need Stoicism for my craving.' }));
    expect(result.activationStatus).toBe('BLOCKED_WRONG_USER_TYPE');
  });

  it('TEST 7: Safety exit on crisis', () => {
    const result = detectKST01(makeInput({ crisisLevel: 3, latestUserMessage: 'He is threatening me.' }));
    expect(result.activationStatus).toBe('BLOCKED_BY_SAFETY');
    expect(result.recommendedMode).toBe('SAFETY_EXIT');
  });

  it('TEST 8: Boundary/love conflict', () => {
    const result = detectKST01(makeInput({ latestUserMessage: 'How can I detach without giving up on them? Distance equals lack of love.' }));
    expect(result.triggers).toContain('BOUNDARY_LOVE_CONFLICT');
    expect(result.recommendedMode).toBe('CONNECTED_NOT_CONSUMED');
  });

  it('TEST 9: Emotional fusion', () => {
    const result = detectKST01(makeInput({ latestUserMessage: 'I get dragged into every crisis. How to stay calm without being cold?' }));
    expect(result.triggers).toContain('EMOTIONAL_FUSION');
    expect(result.recommendedMode).toBe('STEADINESS_WITH_FEELING');
  });

  it('TEST 10: Life on hold', () => {
    const result = detectKST01(makeInput({ latestUserMessage: 'My life is paused. I am waiting for them to change.' }));
    expect(result.triggers).toContain('LIFE_ON_HOLD');
    expect(result.recommendedMode).toBe('LIFE_IS_NOT_A_WAITING_ROOM');
  });

  it('TEST 11: Slider-based activation', () => {
    const result = detectKST01(makeInput({
      latestUserMessage: 'Ik weet het niet meer',
      controlLoopLevel: 8,
      selfLossLevel: 7,
    }));
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.5);
    expect(result.triggers).toContain('CONTROL_LOOP_CAREGIVER');
    expect(result.triggers).toContain('SELF_LOSS_THROUGH_CARE');
  });

  it('TEST 12: NL language detection', () => {
    const result = detectKST01(makeInput({ latestUserMessage: 'Ik voel me verantwoordelijk. Ik raak mezelf kwijt.' }));
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.triggers).toContain('OVER_RESPONSIBILITY');
    expect(result.triggers).toContain('SELF_LOSS_THROUGH_CARE');
  });
});

describe('KST01 Router', () => {
  it('Routes to KDL01 on CONNECTED_NOT_CONSUMED', () => {
    const detection = detectKST01(makeInput({ latestUserMessage: 'How can I detach without giving up? Distance equals lack of love.' }));
    const output = routeKST01(detection);
    expect(output.routeNext).toBe('KDL01_DETACHMENT_WITH_LOVE');
  });

  it('Routes to K06_SAFETY on crisis', () => {
    const detection = detectKST01(makeInput({ crisisLevel: 3, latestUserMessage: 'He is threatening me.' }));
    const output = routeKST01(detection);
    expect(output.routeNext).toBe('K06_SAFETY');
  });

  it('Routes to KST01 for standard activation', () => {
    const detection = detectKST01(makeInput({ latestUserMessage: 'How do I make him stop drinking?' }));
    const output = routeKST01(detection);
    expect(output.routeNext).toBe('KST01_STOICISM_FOR_CAREGIVERS');
  });
});

describe('KST01 Prompt Builder', () => {
  it('Returns null when not active', () => {
    const detection = detectKST01(makeInput({ latestUserMessage: 'Hello' }));
    const payload = buildKST01PromptPayload(detection);
    expect(payload).toBeNull();
  });

  it('Returns valid payload when active', () => {
    const detection = detectKST01(makeInput({ latestUserMessage: 'How do I make him stop drinking?' }));
    const payload = buildKST01PromptPayload(detection);
    expect(payload).not.toBeNull();
    expect(payload!.moduleId).toBe('KST01');
    expect(payload!.active).toBe(true);
    expect(payload!.tone).toBe('warm_steady_gently_firm');
    expect(payload!.forbiddenPhrases.length).toBeGreaterThan(0);
  });

  it('Builds full prompt block', () => {
    const detection = detectKST01(makeInput({ latestUserMessage: 'How do I make him stop drinking?' }));
    const payload = buildKST01PromptPayload(detection)!;
    const block = buildKST01FullPromptBlock(payload);
    expect(block).toContain('KST01 STOICISM FOR CAREGIVERS ACTIVE');
    expect(block).toContain('CONTROL_SEPARATOR');
    expect(block).toContain('DICHOTOMY_OF_CONTROL');
  });
});

describe('KST01 Storage', () => {
  it('Returns empty patch when not active', () => {
    const detection = detectKST01(makeInput({ latestUserMessage: 'Hello' }));
    const patch = buildKST01StoragePatch(detection);
    expect(patch).toEqual({});
  });

  it('Increments activation count', () => {
    const detection = detectKST01(makeInput({ latestUserMessage: 'How do I make him stop drinking?' }));
    const patch = buildKST01StoragePatch(detection, { kst01Activated: true, activationCount: 3, controlLoopLevelHistory: [], selfLossLevelHistory: [], emotionalFusionLevelHistory: [], mementoMoriUsedCount: 0, safetyExitCount: 0 });
    expect(patch.activationCount).toBe(4);
  });

  it('Updates progress correctly', () => {
    const updated = updateKST01Progress(undefined, { kst01Activated: true, activationCount: 1 });
    expect(updated.kst01Activated).toBe(true);
    expect(updated.activationCount).toBe(1);
    expect(updated.controlLoopLevelHistory).toEqual([]);
  });
});
