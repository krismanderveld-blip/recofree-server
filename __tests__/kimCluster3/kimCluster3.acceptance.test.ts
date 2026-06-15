/**
 * Kim Cluster 3 — Relational Dynamics (ROL-K01, VETR02-K, LEUGEN-K01)
 * Critical acceptance tests:
 * - Persona separation (Elias does NOT activate)
 * - Acute clusters override reflective modules
 * - Crisis numbers only when acute signals present
 * - Correct module activation per scenario
 * - Output safety filter blocks forbidden patterns
 */

import { describe, it, expect } from 'vitest';
import { resolveCluster3Priority } from '@/modules/kim/relationalDynamicsCluster/kimCluster3Detector';
import { buildKimCluster3Payload } from '@/modules/kim/relationalDynamicsCluster/kimCluster3Payloads';
import { buildKimCluster3MemoryPatch } from '@/modules/kim/relationalDynamicsCluster/kimCluster3MemoryPatch';
import { enforceKimCluster3OutputSafety } from '@/modules/kim/relationalDynamicsCluster/kimCluster3SafetyFilter';
import { runKimAdvancedModulesP8 } from '@/lib/engine/kim/kim-advanced-modules-p8';
import type { KimCluster3RuntimeInput } from '@/modules/kim/relationalDynamicsCluster/kimCluster3.types';

function makeBaseInput(overrides: Partial<KimCluster3RuntimeInput> = {}): KimCluster3RuntimeInput {
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
    activeRelapseNow: false,
    postRelapseAftermath: false,
    aggressionDetected: false,
    domesticViolenceOrAbuseDetected: false,
    selfHarmOrSuicideDetected: false,
    medicalEmergencyDetected: false,
    disappearanceAcuteDangerDetected: false,
    careRoleDroppedOrPaused: false,
    lovedOneStableOrAdmitted: false,
    suppressedEmotionWaveDetected: false,
    partnerAbsentOrInAdmission: false,
    hypervigilanceDetected: false,
    reexperienceDetected: false,
    chronicLyingDetected: false,
    detectiveRoleDetected: false,
    betrayalPainDetected: false,
    timestampIso: new Date().toISOString(),
    sessionId: 'test-session-1',
    turnId: 'turn-1',
    ...overrides,
  };
}

describe('Kim Cluster 3 — Acceptance Tests', () => {
  // ─── TEST 1: Persona separation — Elias does NOT activate ───
  it('T1: Elias persona does not activate any Cluster 3 module', () => {
    const input = makeBaseInput({
      persona: 'elias' as any,
      latestUserMessage: 'hij is opgenomen en ik voel me leeg',
      careRoleDroppedOrPaused: true,
      suppressedEmotionWaveDetected: true,
    });
    const result = resolveCluster3Priority(input);
    // Returns a result with BLOCKED_BY_PERSONA status (not null)
    if (result) {
      expect(result.activationStatus).toBe('BLOCKED_BY_PERSONA');
      expect(result.routeNext).toBe('NO_MODULE');
    } else {
      // Also acceptable if null
      expect(result).toBeNull();
    }
  });

  // ─── TEST 2: ROL-K01 activates when care role dropped + emotion wave ───
  it('T2: ROL-K01 activates when care role dropped and suppressed emotions surface', () => {
    const input = makeBaseInput({
      latestUserMessage: 'hij is opgenomen en ik voel me zo boos en leeg',
      careRoleDroppedOrPaused: true,
      lovedOneStableOrAdmitted: true,
      suppressedEmotionWaveDetected: true,
    });
    const result = resolveCluster3Priority(input);
    expect(result).not.toBeNull();
    expect(result!.moduleId).toBe('ROL-K01');
    expect(result!.activationStatus).toBe('ACTIVE');
  });

  // ─── TEST 3: VETR02-K activates on absence + hypervigilance ───
  it('T3: VETR02-K activates on partner absence with hypervigilance', () => {
    const input = makeBaseInput({
      latestUserMessage: 'hij is in detox en ik check constant mijn telefoon',
      partnerAbsentOrInAdmission: true,
      hypervigilanceDetected: true,
    });
    const result = resolveCluster3Priority(input);
    expect(result).not.toBeNull();
    expect(result!.moduleId).toBe('VETR02-K');
    expect(result!.activationStatus).toBe('ACTIVE');
  });

  // ─── TEST 4: LEUGEN-K01 activates on chronic lying + betrayal pain ───
  it('T4: LEUGEN-K01 activates on chronic lying with betrayal pain', () => {
    const input = makeBaseInput({
      latestUserMessage: 'hij blijft liegen en ik vertrouw niets meer',
      chronicLyingDetected: true,
      betrayalPainDetected: true,
    });
    const result = resolveCluster3Priority(input);
    expect(result).not.toBeNull();
    expect(result!.moduleId).toBe('LEUGEN-K01');
    expect(result!.activationStatus).toBe('ACTIVE');
  });

  // ─── TEST 5: Acute cluster overrides — active relapse blocks Cluster 3 ───
  it('T5: Active relapse (acute) blocks Cluster 3 activation', () => {
    const input = makeBaseInput({
      latestUserMessage: 'hij drinkt nu weer en ik voel me leeg',
      activeRelapseNow: true,
      careRoleDroppedOrPaused: true,
      suppressedEmotionWaveDetected: true,
    });
    const result = resolveCluster3Priority(input);
    // Should be deferred to an acute module
    if (result) {
      expect(result.activationStatus).not.toBe('ACTIVE');
      expect(result.activationStatus).toMatch(/DEFER/);
    } else {
      expect(result).toBeNull();
    }
  });

  // ─── TEST 6: Immediate danger blocks Cluster 3 ───
  it('T6: Immediate danger blocks Cluster 3 activation', () => {
    const input = makeBaseInput({
      latestUserMessage: 'hij is opgenomen maar ik voel me onveilig, hij dreigt',
      immediateDanger: true,
      careRoleDroppedOrPaused: true,
      suppressedEmotionWaveDetected: true,
    });
    const result = resolveCluster3Priority(input);
    if (result) {
      expect(result.activationStatus).not.toBe('ACTIVE');
      expect(result.activationStatus).toMatch(/DEFER/);
    } else {
      expect(result).toBeNull();
    }
  });

  // ─── TEST 7: No crisis numbers in non-acute scenario ───
  it('T7: No crisis numbers shown when no acute signals present', () => {
    const input = makeBaseInput({
      latestUserMessage: 'hij is stabiel maar ik voel me zo leeg',
      careRoleDroppedOrPaused: true,
      lovedOneStableOrAdmitted: true,
      suppressedEmotionWaveDetected: true,
    });
    const result = resolveCluster3Priority(input);
    expect(result).not.toBeNull();
    expect(result!.crisisNumbersToShow).toEqual([]);
  });

  // ─── TEST 8: Safety filter blocks control advice ───
  it('T8: Safety filter blocks detective/control advice', () => {
    const output = enforceKimCluster3OutputSafety({
      moduleId: 'LEUGEN-K01',
      text: 'Je moet zijn telefoon controleren om de waarheid te achterhalen.',
      responseMode: 'REFLECTIVE',
      crisisNumbersToShow: [],
    });
    // Should be replaced with fallback
    expect(output).not.toContain('controleer');
    expect(output).toContain('grenzen');
  });

  // ─── TEST 9: Safety filter blocks diagnosis ───
  it('T9: Safety filter blocks diagnosis language', () => {
    const output = enforceKimCluster3OutputSafety({
      moduleId: 'VETR02-K',
      text: 'Je bent getraumatiseerd door zijn gedrag.',
      responseMode: 'REFLECTIVE',
      crisisNumbersToShow: [],
    });
    expect(output).not.toContain('getraumatiseerd');
  });

  // ─── TEST 10: Safety filter blocks shaming ───
  it('T10: Safety filter blocks shaming language', () => {
    const output = enforceKimCluster3OutputSafety({
      moduleId: 'ROL-K01',
      text: 'Je moet gewoon ontspannen nu hij weg is.',
      responseMode: 'REFLECTIVE',
      crisisNumbersToShow: [],
    });
    expect(output).not.toContain('gewoon ontspannen');
  });

  // ─── TEST 11: Payload has store:false ───
  it('T11: Payload always has store:false', () => {
    const input = makeBaseInput({
      latestUserMessage: 'hij is opgenomen en ik voel me boos',
      careRoleDroppedOrPaused: true,
      lovedOneStableOrAdmitted: true,
      suppressedEmotionWaveDetected: true,
    });
    const result = resolveCluster3Priority(input);
    expect(result).not.toBeNull();
    const payload = buildKimCluster3Payload(result!);
    expect(payload.store).toBe(false);
    expect(payload.gptMayDiagnose).toBe(false);
    expect(payload.gptMayGiveLegalAdvice).toBe(false);
    expect(payload.gptMayUseEliasMemory).toBe(false);
  });

  // ─── TEST 12: Memory patch is Kim-scoped only ───
  it('T12: Memory patch targets Kim-scoped storage only', () => {
    const input = makeBaseInput({
      latestUserMessage: 'hij is stabiel maar ik voel me leeg en boos',
      careRoleDroppedOrPaused: true,
      lovedOneStableOrAdmitted: true,
      suppressedEmotionWaveDetected: true,
    });
    const result = resolveCluster3Priority(input);
    expect(result).not.toBeNull();
    const patch = buildKimCluster3MemoryPatch(result!, input);
    expect(patch).not.toBeNull();
    expect(patch!.persona).toBe('kim');
    expect(patch!.storageTargets).toEqual(['user.dat', 'projections.dat', 'logs.dat']);
  });

  // ─── TEST 13: P8 integration — not active when P6 overrides ───
  it('T13: P8 does not activate when P6 (relapse cluster) overrides', () => {
    const result = runKimAdvancedModulesP8({
      persona: 'kim',
      intakeCompleted: true,
      latestUserMessage: 'hij is opgenomen en ik voel me leeg',
      recentMessages: [],
      language: 'nl',
      activeRelapseNow: true,
      postRelapseAftermath: false,
      caregiverOverwhelmed: false,
      immediateDanger: false,
      childPresentOrAffected: false,
      aggressionDetected: false,
      domesticViolenceOrAbuseDetected: false,
      selfHarmOrSuicideDetected: false,
      medicalEmergencyDetected: false,
      disappearanceAcuteDangerDetected: false,
      careRoleDroppedOrPaused: true,
      lovedOneStableOrAdmitted: true,
      suppressedEmotionWaveDetected: true,
      partnerAbsentOrInAdmission: false,
      hypervigilanceDetected: false,
      reexperienceDetected: false,
      chronicLyingDetected: false,
      detectiveRoleDetected: false,
      betrayalPainDetected: false,
      lovedOneUseContext: true,
      firstPersonUseContext: false,
      sessionId: 'test-session',
      turnId: 'turn-1',
      timestampIso: new Date().toISOString(),
    });
    expect(result.active).toBe(false);
  });

  // ─── TEST 14: P8 integration — activates ROL-K01 in non-acute scenario ───
  it('T14: P8 activates ROL-K01 in non-acute scenario', () => {
    const result = runKimAdvancedModulesP8({
      persona: 'kim',
      intakeCompleted: true,
      latestUserMessage: 'hij is opgenomen en ik voel me zo boos en leeg',
      recentMessages: [],
      language: 'nl',
      activeRelapseNow: false,
      postRelapseAftermath: false,
      caregiverOverwhelmed: false,
      immediateDanger: false,
      childPresentOrAffected: false,
      aggressionDetected: false,
      domesticViolenceOrAbuseDetected: false,
      selfHarmOrSuicideDetected: false,
      medicalEmergencyDetected: false,
      disappearanceAcuteDangerDetected: false,
      careRoleDroppedOrPaused: true,
      lovedOneStableOrAdmitted: true,
      suppressedEmotionWaveDetected: true,
      partnerAbsentOrInAdmission: false,
      hypervigilanceDetected: false,
      reexperienceDetected: false,
      chronicLyingDetected: false,
      detectiveRoleDetected: false,
      betrayalPainDetected: false,
      lovedOneUseContext: true,
      firstPersonUseContext: false,
      sessionId: 'test-session',
      turnId: 'turn-1',
      timestampIso: new Date().toISOString(),
    });
    expect(result.active).toBe(true);
    expect(result.moduleId).toBe('ROL-K01');
    expect(result.promptContext).toContain('ROL-K01');
    expect(result.payload).not.toBeNull();
    expect(result.payload!.store).toBe(false);
  });
});
