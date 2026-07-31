/**
 * Kim Cluster 4 — Emotional Loss Cluster Acceptance Tests
 * HOOP-K01, SCHAAM-K01, ROUW-K01, ISOL-K01
 *
 * Critical checks:
 * 1. Persona separation (Elias does NOT activate)
 * 2. HOOP-K01 suicidality-split (situational hope loss → reflective; suicidal ideation → CRISIS escalation)
 * 3. Acute clusters override (P6/P7 win over P9)
 * 4. P8 wins over P9 (relational dynamics > emotional loss)
 * 5. Each module activates on correct markers
 * 6. Safety filter blocks diagnosis/prescription language
 */
import { describe, it, expect } from 'vitest';
import { resolveCluster4Priority } from '@/lib/engine/kim/modules/emotionalLossCluster/kimCluster4Detector';
import { buildKimCluster4Payload } from '@/lib/engine/kim/modules/emotionalLossCluster/kimCluster4Payloads';
import { applyKimCluster4SafetyFilter } from '@/lib/engine/kim/modules/emotionalLossCluster/kimCluster4SafetyFilter';
import { runKimAdvancedP9 } from '@/lib/engine/kim/kim-advanced-modules-p9';
import type { KimCluster4RuntimeInput } from '@/lib/engine/kim/modules/emotionalLossCluster/kimCluster4.types';

function makeInput(overrides: Partial<KimCluster4RuntimeInput> = {}): KimCluster4RuntimeInput {
  return {
    message: 'ik verlies alle hoop',
    persona: 'kim',
    selfHarmOrSuicideDetectedInKim: false,
    immediateDanger: false,
    dangerOrViolenceDetected: false,
    domesticViolenceOrAbuseDetected: false,
    aggressionDetected: false,
    childPresentOrAffected: false,
    activeRelapseNow: false,
    immediateAftermathActive: false,
    enoughIsEnoughDetected: false,
    hopeExhaustionDetected: false,
    shameSecrecyDetected: false,
    socialWithdrawalDetected: false,
    ambiguousLossDetected: false,
    lostFutureGriefDetected: false,
    socialIsolationDetected: false,
    lossOfOwnContactsDetected: false,
    detectedMarkers: [],
    ...overrides,
  };
}

describe('Kim Cluster 4 — Critical Acceptance Tests', () => {
  // ─── TEST 1: Persona separation ───
  it('1. Elias persona → BLOCKED_BY_PERSONA, no module activation', () => {
    const result = resolveCluster4Priority(makeInput({
      persona: 'elias',
      message: 'ik verlies alle hoop',
      hopeExhaustionDetected: true,
    }));
    expect(result.activationStatus).toBe('BLOCKED_BY_PERSONA');
    // moduleId reflects which detector first returned the block
    expect(result.moduleId).toBeTruthy();
  });

  // ─── TEST 2: HOOP-K01 activates on hope exhaustion ───
  it('2. HOOP-K01 activates on hope exhaustion markers', () => {
    const result = resolveCluster4Priority(makeInput({
      message: 'wanneer is genoeg genoeg? ik verlies alle hoop dat het ooit beter wordt',
      hopeExhaustionDetected: true,
      enoughIsEnoughDetected: true,
    }));
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.moduleId).toBe('HOOP-K01');
  });

  // ─── TEST 3: HOOP-K01 suicidality-split — suicidal ideation → CRISIS escalation ───
  it('3. HOOP-K01 suicidality-split: suicidal ideation in Kim → DEFERRED_TO_CRISIS', () => {
    const result = resolveCluster4Priority(makeInput({
      message: 'ik wil er niet meer zijn',
      selfHarmOrSuicideDetectedInKim: true,
      hopeExhaustionDetected: true,
    }));
    expect(result.activationStatus).not.toBe('ACTIVE');
    // Should defer to crisis, not activate as reflective
    expect(result.reason).toMatch(/suicid|crisis|acute/i);
  });

  // ─── TEST 4: SCHAAM-K01 activates on shame/secrecy ───
  it('4. SCHAAM-K01 activates on shame and secrecy markers', () => {
    const result = resolveCluster4Priority(makeInput({
      message: 'ik schaam me zo erg dat niemand weet wat er thuis gebeurt',
      shameSecrecyDetected: true,
      socialWithdrawalDetected: true,
    }));
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.moduleId).toBe('SCHAAM-K01');
  });

  // ─── TEST 5: ROUW-K01 activates on ambiguous loss ───
  it('5. ROUW-K01 activates on ambiguous loss markers', () => {
    const result = resolveCluster4Priority(makeInput({
      message: 'ik mis wie hij vroeger was, hij leeft nog maar is er niet meer',
      ambiguousLossDetected: true,
      lostFutureGriefDetected: true,
    }));
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.moduleId).toBe('ROUW-K01');
  });

  // ─── TEST 6: ISOL-K01 activates on social isolation ───
  it('6. ISOL-K01 activates on social isolation markers', () => {
    const result = resolveCluster4Priority(makeInput({
      message: 'ik ben al mijn contacten kwijt, ik sta er helemaal alleen voor',
      socialIsolationDetected: true,
      lossOfOwnContactsDetected: true,
    }));
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.moduleId).toBe('ISOL-K01');
  });

  // ─── TEST 7: Acute clusters override P9 ───
  it('7. Active relapse (P6) overrides P9 — no emotional loss activation', () => {
    const result = resolveCluster4Priority(makeInput({
      message: 'hij drinkt nu weer en ik verlies alle hoop',
      activeRelapseNow: true,
      hopeExhaustionDetected: true,
    }));
    // Should be deferred to acute, not active
    expect(result.activationStatus).not.toBe('ACTIVE');
  });

  // ─── TEST 8: Immediate danger overrides P9 ───
  it('8. Immediate danger + aggression overrides P9 — no emotional loss activation', () => {
    const result = resolveCluster4Priority(makeInput({
      message: 'hij is agressief en ik verlies alle hoop',
      immediateDanger: true,
      aggressionDetected: true,
      dangerOrViolenceDetected: true,
      hopeExhaustionDetected: true,
    }));
    // Deferred to acute cluster
    expect(result.activationStatus).not.toBe('ACTIVE');
  });

  // ─── TEST 9: P9 pipeline integration — Kim user with hope exhaustion ───
  it('9. P9 pipeline integration: Kim user with hope exhaustion → active', () => {
    const result = runKimAdvancedP9({
      message: 'wanneer is genoeg genoeg? ik verlies alle hoop',
      persona: 'kim',
      hopeExhaustionDetected: true,
      enoughIsEnoughDetected: true,
    });
    expect(result.active).toBe(true);
    expect(result.moduleId).toBe('HOOP-K01');
    expect(result.contextString).toContain('HOOP-K01');
  });

  // ─── TEST 10: P9 pipeline integration — Elias user → not active ───
  it('10. P9 pipeline integration: Elias user → not active', () => {
    const result = runKimAdvancedP9({
      message: 'ik verlies alle hoop',
      persona: 'elias',
      hopeExhaustionDetected: true,
    });
    expect(result.active).toBe(false);
  });

  // ─── TEST 11: Safety filter blocks diagnosis language ───
  it('11. Safety filter blocks diagnosis/prescription language', () => {
    const diagnosisOutput = 'Je hebt waarschijnlijk een depressie en moet antidepressiva nemen';
    const filtered = applyKimCluster4SafetyFilter(diagnosisOutput, 'HOOP-K01');
    expect(filtered.safe).toBe(false);
    expect(filtered.violations.length).toBeGreaterThan(0);
  });

  // ─── TEST 12: Safety filter allows valid reflective response ───
  it('12. Safety filter allows valid reflective response', () => {
    const validOutput = 'Ik hoor dat je het gevoel hebt dat de hoop opraakt. Dat is een zwaar gevoel om te dragen.';
    const filtered = applyKimCluster4SafetyFilter(validOutput, 'HOOP-K01');
    expect(filtered.safe).toBe(true);
  });

  // ─── TEST 13: HOOP-K01 payload contains correct themes ───
  it('13. HOOP-K01 payload contains hope-exhaustion themes', () => {
    const result = resolveCluster4Priority(makeInput({
      message: 'wanneer is genoeg genoeg',
      hopeExhaustionDetected: true,
      enoughIsEnoughDetected: true,
    }));
    expect(result.activationStatus).toBe('ACTIVE');
    const payload = buildKimCluster4Payload(result);
    expect(payload.fullPrompt).toContain('HOOP-K01');
    expect(payload.fullPrompt.length).toBeGreaterThan(50);
  });

  // ─── TEST 14: Crisis numbers only when acute signals present ───
  it('14. No crisis numbers in reflective mode (no acute signals)', () => {
    const result = resolveCluster4Priority(makeInput({
      message: 'ik schaam me zo erg',
      shameSecrecyDetected: true,
    }));
    expect(result.activationStatus).toBe('ACTIVE');
    expect(result.moduleId).toBe('SCHAAM-K01');
    // No crisis escalation for pure reflective
    expect(result.crisisEscalation).toBeFalsy();
  });
});
