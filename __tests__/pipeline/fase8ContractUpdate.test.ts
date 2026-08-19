/**
 * FASE 8: Context application contract update tests.
 * Verifies the updated CONTEXT_AWARE_APPLICATION_CONTRACT contains all 11 clinical formulation rules.
 */
import { describe, it, expect } from 'vitest';
import { CONTEXT_AWARE_APPLICATION_CONTRACT } from '@/lib/engine/shared/context-application-contract';

describe('FASE 8: Context application contract update', () => {
  it('1. contains working hypotheses / never diagnose rule', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('working hypotheses, never diagnoses');
  });

  it('2. contains contraindications-before-advice rule', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Apply contraindications BEFORE giving advice');
  });

  it('3. contains safeFormulationHints rule', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('safeFormulationHints');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Prefer the user-safe wording');
  });

  it('4. contains anti-generic-coping rule when triggerChains/pathways available', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Avoid generic coping if triggerChains');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Use the chain to choose the intervention');
  });

  it('5. contains Elias-specific relapse/functionOfAddiction guidance', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Elias-specific');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('relapsePathways');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('functionOfAddiction');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('shame reduction');
  });

  it('6. contains Kim-specific caregiver burden/responsibility separation guidance', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Kim-specific');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('caregiverBurdenPathways');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('responsibility separation');
  });

  it('7. forbids making Kim coach/monitor/therapist', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Never make Kim the coach, therapist, monitor or recovery manager');
  });

  it('8. forbids guilt-pressure around children', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Never use children as guilt-pressure');
  });

  it('9. says do not mention every schema/mode/pathway', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Do NOT mention every schema, mode or pathway');
  });

  it('10. preserves crisis/safety override', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Safety/crisis instructions override everything');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('crisis protocol overrides all formulation');
  });

  it('11. Kim/Elias separation preserved — both mentioned separately', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Elias-specific');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Kim-specific');
    // Elias should not have Kim rules and vice versa in the same bullet
    const eliasLine = CONTEXT_AWARE_APPLICATION_CONTRACT.split('\n').find(l => l.includes('Elias-specific'));
    const kimLine = CONTEXT_AWARE_APPLICATION_CONTRACT.split('\n').find(l => l.includes('Kim-specific'));
    expect(eliasLine).not.toContain('caregiverBurdenPathways');
    expect(kimLine).not.toContain('relapsePathways');
  });

  it('12. contract does not contain diagnosis language', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).not.toContain('codependent');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).not.toContain('narcissist');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).not.toContain('borderline');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).not.toContain('toxic');
  });

  it('13. contract does not dump raw data references', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).not.toContain('user.dat');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).not.toContain('AsyncStorage');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).not.toContain('DIST01');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).not.toContain('birthDate');
  });
});
