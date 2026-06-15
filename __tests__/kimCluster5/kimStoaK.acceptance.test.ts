/**
 * Kim Cluster 5 — STOA-K Acceptance Tests
 * 10 critical tests covering persona separation, activation, overrides,
 * safety filter, crisis numbers, and memory patch scoping.
 */

import { describe, it, expect } from 'vitest';
import { detectStoaK } from '@/modules/kim/stoaK/kimStoaKDetector';
import { buildKimStoaKPayload } from '@/modules/kim/stoaK/kimStoaKPayload';
import { buildKimStoaKMemoryPatch } from '@/modules/kim/stoaK/kimStoaKMemoryPatch';
import { enforceKimStoaKOutputSafety } from '@/modules/kim/stoaK/kimStoaKSafetyFilter';
import { runKimAdvancedP10 } from '@/lib/engine/kim/kim-advanced-modules-p10';
import type { KimStoaRuntimeInput } from '@/modules/kim/stoaK/kimStoaK.types';

function makeBaseInput(overrides: Partial<KimStoaRuntimeInput> = {}): KimStoaRuntimeInput {
  return {
    persona: 'kim',
    intakeCompleted: true,
    latestUserMessage: '',
    recentMessages: [],
    language: 'nl',
    detectedMarkers: [],
    lovedOneUseContext: true,
    firstPersonUseContext: false,
    caregiverOverwhelmed: false,
    immediateDanger: false,
    childPresentOrAffected: false,
    aggressionDetected: false,
    domesticViolenceOrAbuseDetected: false,
    disappearanceAcuteDangerDetected: false,
    selfHarmOrSuicideDetected: false,
    medicalEmergencyDetected: false,
    activeRelapseNow: false,
    controlDistinctionDetected: false,
    controlLoopDetected: false,
    lettingGoQuestionDetected: false,
    valuesQuestionDetected: false,
    boundaryControlQuestionDetected: false,
    responsibilitySeparationDetected: false,
    acceptanceNotApprovalDetected: false,
    deeperStoicReflectionDetected: false,
    fastGroundingNeedDetected: false,
    specificReflectiveModuleCandidate: null,
    ...overrides,
  };
}

describe('Kim Cluster 5 — STOA-K Acceptance Tests', () => {
  // ─── Test 1: Persona separation ─────────────────────────────────────────────
  it('Test 1: Elias persona returns BLOCKED_BY_PERSONA', () => {
    const input = makeBaseInput({
      persona: 'elias',
      latestUserMessage: 'ik kan hem niet veranderen maar ik blijf proberen alles te controleren',
    });
    const result = detectStoaK(input);
    expect(result.activationStatus).toBe('BLOCKED_BY_PERSONA');
    expect(result.confidenceScore).toBe(0);
    expect(result.themes).toHaveLength(0);
  });

  // ─── Test 2: Core activation ────────────────────────────────────────────────
  it('Test 2: Core activation with control distinction + control loop markers', () => {
    const input = makeBaseInput({
      latestUserMessage: 'ik kan hem niet veranderen maar ik blijf proberen alles te controleren',
    });
    const result = detectStoaK(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.themes).toContain('cannot_control_loved_one');
    expect(result.themes).toContain('control_loop');
    expect(result.confidenceScore).toBeGreaterThan(0.5);
    expect(result.responseMode).toBe('CONTROL_LOOP_DEFUSION');
  });

  // ─── Test 3: KST01 boundary — fast grounding without deeper reflection ─────
  it('Test 3: Fast grounding need without deeper reflection defers to KST01', () => {
    const input = makeBaseInput({
      latestUserMessage: 'geef me snel iets stoicijns om te kalmeren',
      fastGroundingNeedDetected: false, // will be detected from markers
    });
    const result = detectStoaK(input);
    expect(result.activationStatus).toBe('DEFER_TO_KST01');
    expect(result.routeNext).toBe('KST01');
  });

  // ─── Test 4: STOA-K wins over KST01 when deeper reflection detected ────────
  it('Test 4: STOA-K activates when deeper stoic reflection is detected', () => {
    const input = makeBaseInput({
      latestUserMessage: 'hoe leef ik met wat ik niet kan controleren',
      deeperStoicReflectionDetected: false, // will be detected from markers
    });
    const result = detectStoaK(input);
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.confidenceScore).toBeGreaterThan(0.5);
  });

  // ─── Test 5: Acute override — aggression → DEFER_TO_GEVAAR_K01 ─────────────
  it('Test 5: Aggression detected defers to GEVAAR-K01 with 1712', () => {
    const input = makeBaseInput({
      latestUserMessage: 'ik kan hem niet veranderen',
      aggressionDetected: true,
    });
    const result = detectStoaK(input);
    expect(result.activationStatus).toBe('DEFER_TO_GEVAAR_K01');
    expect(result.routeNext).toBe('GEVAAR-K01');
    expect(result.crisisNumbersToShow).toContain('1712');
  });

  // ─── Test 6: HERV override — active relapse → DEFER_TO_HERV_K01 ────────────
  it('Test 6: Active relapse overrides STOA-K → DEFER_TO_HERV_K01', () => {
    const input = makeBaseInput({
      latestUserMessage: 'ik kan hem niet veranderen',
      activeRelapseNow: true,
    });
    const result = detectStoaK(input);
    expect(result.activationStatus).toBe('DEFER_TO_HERV_K01');
    expect(result.routeNext).toBe('HERV-K01');
  });

  // ─── Test 7: Specific reflective module override ───────────────────────────
  it('Test 7: Specific reflective module candidate defers to that module', () => {
    const input = makeBaseInput({
      latestUserMessage: 'ik kan hem niet veranderen',
      specificReflectiveModuleCandidate: 'SCHAAM-K01',
    });
    const result = detectStoaK(input);
    expect(result.activationStatus).toBe('DEFER_TO_SPECIFIC_REFLECTIVE_MODULE');
    expect(result.routeNext).toBe('SCHAAM-K01');
  });

  // ─── Test 8: Output safety filter rejects suppression language ──────────────
  it('Test 8: Safety filter rejects emotional suppression language', () => {
    const unsafeOutput = 'Gewoon accepteren en laat het je niet raken. Je moet je gevoelens onderdrukken.';
    const filterResult = enforceKimStoaKOutputSafety(unsafeOutput);
    expect(filterResult.safe).toBe(false);
    expect(filterResult.violations.length).toBeGreaterThan(0);
    expect(filterResult.output).toContain('Dat je controle zoekt');
    expect(filterResult.output).not.toContain('onderdrukken');
  });

  // ─── Test 9: Crisis number validation rejects unauthorized numbers ──────────
  it('Test 9: Safety filter rejects unauthorized crisis numbers', () => {
    const outputWithBadNumber = 'Bel 1813 voor hulp bij zelfmoordgedachten.';
    const filterResult = enforceKimStoaKOutputSafety(outputWithBadNumber);
    expect(filterResult.safe).toBe(false);
    expect(filterResult.violations.some(v => v.includes('unauthorized_number'))).toBe(true);

    // Allowed numbers pass
    const outputWithGoodNumber = 'Bij nood, bel 0800 32 123 voor hulp.';
    const goodResult = enforceKimStoaKOutputSafety(outputWithGoodNumber);
    expect(goodResult.safe).toBe(true);
  });

  // ─── Test 10: Memory patch writes to Kim scoped stores only ─────────────────
  it('Test 10: Memory patch targets Kim user.dat/projections.dat/logs.dat, NOT Elias', () => {
    const input = makeBaseInput({
      latestUserMessage: 'ik kan hem niet veranderen maar ik blijf proberen alles te controleren',
    });
    const result = detectStoaK(input);
    expect(result.activationStatus).toBe('ACTIVE');

    const patch = buildKimStoaKMemoryPatch(result, '2026-06-15T12:00:00Z');

    // Kim user.dat
    expect(patch.kimUserDat).toBeDefined();
    expect(patch.kimUserDat.triggerPatterns).toHaveLength(1);
    expect(patch.kimUserDat.triggerPatterns[0].sourceModuleId).toBe('STOA-K');
    expect(patch.kimUserDat.triggerPatterns[0].pattern).toBe('controlLoopCaregiver');

    // Kim projections.dat
    expect(patch.kimProjectionsDat).toBeDefined();

    // Kim logs.dat
    expect(patch.kimLogsDat).toBeDefined();
    expect(patch.kimLogsDat.event.moduleId).toBe('STOA-K');
    expect(patch.kimLogsDat.event.themes).toContain('control_loop');
    expect(patch.kimLogsDat.event.timestamp).toBe('2026-06-15T12:00:00Z');

    // Payload has store:false
    const payload = buildKimStoaKPayload(result);
    expect(payload.storePolicy).toBe(false);
    expect(payload.moduleId).toBe('STOA-K');
    expect(payload.systemPromptBlock).toContain('STOA-K');
    expect(payload.systemPromptBlock).toContain('NEVER use stoicism as emotional suppression');

    // No Elias memory references exist in the patch structure
    expect((patch as any).eliasUserDat).toBeUndefined();
    expect((patch as any).eliasLogsDat).toBeUndefined();
    expect((patch as any).eliasProjectionsDat).toBeUndefined();
  });
});
