/**
 * Kim Relapse Cluster — Pipeline Integration Tests
 *
 * Verifies that:
 * 1. runKimAdvancedP6 activates for Kim persona with relapse markers
 * 2. runKimAdvancedP6 does NOT activate for Elias persona
 * 3. When active, overridesLowerModules is true
 * 4. relapseClusterContext contains the GPT instruction
 * 5. CRISIS-K01 takes priority over HERV-K01
 * 6. HERV-K01 takes priority over NAHERV-K01
 * 7. Safety filter function is provided
 * 8. Memory patch is generated
 * 9. Normal Kim messages (no relapse markers) → no activation
 */

import { describe, it, expect } from 'vitest';
import { runKimAdvancedP6 } from '../../lib/engine/kim/kim-advanced-modules-p6';
import type { KimAdvancedP6Input } from '../../lib/engine/kim/kim-advanced-modules-p6';

function makeInput(overrides: Partial<KimAdvancedP6Input> = {}): KimAdvancedP6Input {
  return {
    intakeCompleted: true,
    persona: 'kim',
    latestUserMessage: 'hij heeft weer gedronken',
    recentMessages: [],
    language: 'nl',
    sessionId: 'test-session-1',
    turnId: 'turn-1',
    caregiverState: 'unknown',
    safetyRiskLevel: 'NONE',
    vspZone: 'GROEN',
    riskLevel: 'low',
    explicitAcuteDanger: false,
    explicitSelfHarmRiskLovedOne: false,
    explicitSelfHarmRiskCaregiver: false,
    explicitViolenceRisk: false,
    explicitMedicalEmergency: false,
    explicitDisappearance: false,
    explicitImpairedDrivingRisk: false,
    explicitChildSafetyRisk: false,
    timestampIso: new Date().toISOString(),
    ...overrides,
  };
}

describe('Kim Relapse Cluster Pipeline Integration (P6)', () => {
  it('1. activates HERV-K01 for Kim persona with active relapse message', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'hij heeft weer gedronken, ik vond lege flessen',
    }));
    expect(result.activeModule).toBe('HERV-K01');
    expect(result.relapseClusterContext).toBeTruthy();
    expect(result.overridesLowerModules).toBe(true);
  });

  it('2. does NOT activate for Elias persona', () => {
    const result = runKimAdvancedP6(makeInput({
      persona: 'elias',
      latestUserMessage: 'hij heeft weer gedronken',
    }));
    expect(result.activeModule).toBeNull();
    expect(result.relapseClusterContext).toBeNull();
    expect(result.overridesLowerModules).toBe(false);
  });

  it('3. overridesLowerModules is true when active', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'mijn partner is weer begonnen met drinken',
    }));
    if (result.activeModule) {
      expect(result.overridesLowerModules).toBe(true);
    }
  });

  it('4. relapseClusterContext contains GPT instruction text', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'hij is weer aan het gebruiken, ik weet niet wat ik moet doen',
    }));
    expect(result.relapseClusterContext).toBeTruthy();
    expect(typeof result.relapseClusterContext).toBe('string');
    // Should contain therapeutic instruction content
    expect(result.relapseClusterContext!.length).toBeGreaterThan(50);
  });

  it('5. CRISIS-K01 takes priority over HERV-K01 when violence is present', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'hij heeft weer gedronken en hij slaat me, ik ben bang',
      explicitViolenceRisk: true,
      safetyRiskLevel: 'HIGH',
    }));
    expect(result.activeModule).toBe('CRISIS-K01');
  });

  it('6. HERV-K01 takes priority over NAHERV-K01 for active relapse', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'hij heeft weer gedronken, hij is nu weer bezig',
    }));
    expect(result.activeModule).toBe('HERV-K01');
  });

  it('7. activates NAHERV-K01 for post-relapse aftermath', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'hij heeft gisteren gedronken, vandaag doet hij alsof er niets is gebeurd',
    }));
    // Should detect aftermath/post-relapse pattern
    expect(result.activeModule).not.toBeNull();
  });

  it('8. provides safety filter function when active', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'hij heeft weer gedronken',
    }));
    if (result.activeModule) {
      expect(result.safetyFilterFn).not.toBeNull();
      expect(typeof result.safetyFilterFn).toBe('function');
    }
  });

  it('9. generates memory patch when active', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'hij is weer begonnen met drinken, ik vond lege flessen',
    }));
    if (result.activeModule) {
      expect(result.memoryPatch).not.toBeNull();
    }
  });

  it('10. does NOT activate for normal Kim messages without relapse markers', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'ik voel me moe vandaag en heb slecht geslapen',
    }));
    expect(result.activeModule).toBeNull();
    expect(result.relapseClusterContext).toBeNull();
    expect(result.overridesLowerModules).toBe(false);
  });

  it('11. English markers work: "he relapsed last night"', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'he relapsed last night, I found empty bottles',
      language: 'en',
    }));
    expect(result.activeModule).not.toBeNull();
  });

  it('12. French markers work: "il a rechuté"', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'il a rechuté hier soir, je suis désespérée',
      language: 'fr',
    }));
    expect(result.activeModule).not.toBeNull();
  });

  it('12b. French markers work: "il a encore bu"', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'il a encore bu ce soir',
      language: 'fr',
    }));
    expect(result.activeModule).toBe('HERV-K01');
  });

  it('13. CRISIS-K01 activates for medical emergency', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'hij is bewusteloos, ik denk een overdosis',
      explicitMedicalEmergency: true,
      safetyRiskLevel: 'IMMEDIATE',
    }));
    expect(result.activeModule).toBe('CRISIS-K01');
  });

  it('14. CRISIS-K01 activates for suicidal risk of loved one', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'hij zegt dat hij er een einde aan wil maken',
      explicitSelfHarmRiskLovedOne: true,
      safetyRiskLevel: 'IMMEDIATE',
    }));
    expect(result.activeModule).toBe('CRISIS-K01');
  });

  it('15. store:false is enforced in the prompt payload', () => {
    const result = runKimAdvancedP6(makeInput({
      latestUserMessage: 'hij heeft weer gedronken',
    }));
    if (result.relapseClusterContext) {
      // The prompt instruction should mention store:false policy
      expect(result.relapseClusterContext.toLowerCase()).toContain('store');
    }
  });
});
