import { describe, it, expect } from 'vitest';
import { detectClinicalFactorsFromChat } from '@/lib/engine/shared/clinical-factor-chat-detector';
import type { UserReportedClinicalFactor } from '@/lib/ai/types';
import { buildPersonalClinicalContext } from '@/lib/rugzak/pipeline';
import { CONTEXT_AWARE_APPLICATION_CONTRACT } from '@/lib/engine/shared/context-application-contract';

// ─── TYPE VALIDATION TESTS ──────────────────────────────────────

describe('Clinical Factors — Type Validation', () => {
  it('T_CF_01: UserReportedClinicalFactor type has all required fields', () => {
    const factor: UserReportedClinicalFactor = {
      factorId: 'adhd',
      label: 'ADHD',
      category: 'neurodevelopmental',
      status: 'user_reported_diagnosed',
      source: 'chat',
      evidenceSnippet: 'Ik heb ADHD',
      firstSeenAt: '2026-01-01T00:00:00Z',
      lastSeenAt: '2026-01-01T00:00:00Z',
      activeImpactAreas: ['impulse_control', 'attention_focus'],
      promptUse: 'adapt_pacing',
      confidence: 0.95,
    };
    expect(factor.factorId).toBe('adhd');
    expect(factor.category).toBe('neurodevelopmental');
    expect(factor.status).toBe('user_reported_diagnosed');
    expect(factor.activeImpactAreas).toContain('impulse_control');
  });

  it('T_CF_02: status hierarchy is correct', () => {
    const statuses = ['user_reported_diagnosed', 'clinician_reported_by_user', 'user_suspected', 'screening_indicated', 'unclear'] as const;
    expect(statuses[0]).toBe('user_reported_diagnosed');
    expect(statuses[4]).toBe('unclear');
  });
});

// ─── CHAT DETECTION TESTS ───────────────────────────────────────

describe('Clinical Factors — Chat Detection', () => {
  it('T_CF_03: detects ADHD from "ik heb ADHD"', () => {
    const results = detectClinicalFactorsFromChat('ik heb ADHD en dat maakt het moeilijk');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].factorId).toBe('adhd');
    expect(results[0].status).toBe('user_reported_diagnosed');
    expect(results[0].category).toBe('neurodevelopmental');
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('T_CF_04: detects borderline from clinician report', () => {
    const results = detectClinicalFactorsFromChat('mijn psychiater zegt dat ik borderline trekken heb');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].factorId).toBe('borderline_traits');
    expect(results[0].status).toBe('clinician_reported_by_user');
  });

  it('T_CF_05: detects autism as user_suspected', () => {
    const results = detectClinicalFactorsFromChat('ik vermoed dat ik autisme heb');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].factorId).toBe('autism_spectrum');
    expect(results[0].status).toBe('user_suspected');
    expect(results[0].confidence).toBeLessThan(0.9);
  });

  it('T_CF_06: does NOT detect from symptoms alone', () => {
    const results = detectClinicalFactorsFromChat('ik kan me niet concentreren en ben impulsief');
    expect(results.length).toBe(0);
  });

  it('T_CF_07: does NOT detect from general mention without self-report', () => {
    const results = detectClinicalFactorsFromChat('mijn broer heeft ADHD');
    expect(results.length).toBe(0);
  });

  it('T_CF_08: detects dual diagnosis', () => {
    const results = detectClinicalFactorsFromChat('ik zit in dubbeldiagnose behandeling');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].factorId).toBe('dual_diagnosis');
    expect(results[0].category).toBe('substance_related');
  });

  it('T_CF_09: detects medication mention', () => {
    const results = detectClinicalFactorsFromChat('ik slik antidepressiva sinds vorig jaar');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].factorId).toBe('medication_use');
    expect(results[0].category).toBe('medication');
    expect(results[0].promptUse).toBe('medication_awareness');
  });

  it('T_CF_10: does not duplicate existing factor', () => {
    const existing: UserReportedClinicalFactor[] = [{
      factorId: 'adhd',
      label: 'ADHD',
      category: 'neurodevelopmental',
      status: 'user_reported_diagnosed',
      source: 'chat',
      evidenceSnippet: 'ik heb ADHD',
      firstSeenAt: '2026-01-01T00:00:00Z',
      lastSeenAt: '2026-01-01T00:00:00Z',
      activeImpactAreas: ['impulse_control'],
      promptUse: 'adapt_pacing',
      confidence: 0.95,
    }];
    const results = detectClinicalFactorsFromChat('ik heb ADHD', existing);
    expect(results.length).toBe(0); // Already exists, no new factor
  });

  it('T_CF_11: detects depression', () => {
    const results = detectClinicalFactorsFromChat('ik ben gediagnosticeerd met depressie');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].factorId).toBe('depression');
    expect(results[0].status).toBe('user_reported_diagnosed');
  });

  it('T_CF_12: detects PTSD/trauma', () => {
    const results = detectClinicalFactorsFromChat('ik heb PTSS door wat er vroeger is gebeurd');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].factorId).toBe('ptsd');
    expect(results[0].category).toBe('trauma_related');
  });
});

// ─── PROMPT FORMATTING TESTS ────────────────────────────────────

describe('Clinical Factors — Prompt Formatting', () => {
  it('T_CF_13: factor with diagnosed status reaches prompt', () => {
    const userDat = {
      userReportedClinicalFactors: [{
        factorId: 'adhd', label: 'ADHD', category: 'neurodevelopmental',
        status: 'user_reported_diagnosed', source: 'chat',
        evidenceSnippet: 'ik heb ADHD', firstSeenAt: '2026-01-01T00:00:00Z',
        lastSeenAt: '2026-01-01T00:00:00Z', activeImpactAreas: ['impulse_control'],
        promptUse: 'adapt_pacing', confidence: 0.95,
      }],
    } as any;
    const result = buildPersonalClinicalContext(userDat, 'elias');
    expect(result).toContain('ADHD');
    expect(result).toContain('diagnosed');
    expect(result).toContain('USER-REPORTED CLINICAL FACTORS');
    expect(result).toContain('never diagnose');
  });

  it('T_CF_14: factor with user_suspected does NOT confirm diagnosis', () => {
    const userDat = {
      userReportedClinicalFactors: [{
        factorId: 'autism_spectrum', label: 'Autisme spectrum', category: 'neurodevelopmental',
        status: 'user_suspected', source: 'chat',
        evidenceSnippet: 'ik vermoed autisme', firstSeenAt: '2026-01-01T00:00:00Z',
        lastSeenAt: '2026-01-01T00:00:00Z', activeImpactAreas: ['social_interaction'],
        promptUse: 'adapt_structure', confidence: 0.6,
      }],
    } as any;
    const result = buildPersonalClinicalContext(userDat, 'elias');
    expect(result).toContain('user-suspected');
    expect(result).not.toContain('diagnosed');
  });

  it('T_CF_15: screening_indicated is NOT sent to GPT', () => {
    const userDat = {
      userReportedClinicalFactors: [{
        factorId: 'adhd', label: 'ADHD', category: 'neurodevelopmental',
        status: 'screening_indicated', source: 'chat',
        evidenceSnippet: 'repeated attention issues', firstSeenAt: '2026-01-01T00:00:00Z',
        lastSeenAt: '2026-01-01T00:00:00Z', activeImpactAreas: ['attention_focus'],
        promptUse: 'adapt_pacing', confidence: 0.4,
      }],
    } as any;
    const result = buildPersonalClinicalContext(userDat, 'elias');
    // screening_indicated should be filtered out
    // Result is undefined because screening_indicated is the only factor and it's filtered out
    expect(result === undefined || !result.includes('ADHD')).toBe(true);
  });

  it('T_CF_16: medication factor includes safety notes', () => {
    const userDat = {
      userReportedClinicalFactors: [{
        factorId: 'medication_use', label: 'Medicatiegebruik', category: 'medication',
        status: 'user_reported_diagnosed', source: 'chat',
        evidenceSnippet: 'ik slik antidepressiva', firstSeenAt: '2026-01-01T00:00:00Z',
        lastSeenAt: '2026-01-01T00:00:00Z', activeImpactAreas: ['medication_adherence'],
        promptUse: 'medication_awareness',
        safetyNotes: 'No dosage advice. No medical advice. Context/awareness only.',
        confidence: 0.9,
      }],
    } as any;
    const result = buildPersonalClinicalContext(userDat, 'elias');
    expect(result).toContain('safety:');
    expect(result).toContain('No dosage advice');
  });

  it('T_CF_17: empty clinicalFactors array does not crash', () => {
    const userDat = { userReportedClinicalFactors: [] } as any;
    const result = buildPersonalClinicalContext(userDat, 'elias');
    // Should not contain clinical factors section if empty
    expect(result === undefined || !result.includes('USER-REPORTED CLINICAL FACTORS')).toBe(true);
  });

  it('T_CF_18: no raw clinical factor data in prompt (no evidenceSnippet)', () => {
    const userDat = {
      userReportedClinicalFactors: [{
        factorId: 'adhd', label: 'ADHD', category: 'neurodevelopmental',
        status: 'user_reported_diagnosed', source: 'chat',
        evidenceSnippet: 'ik heb ADHD gediagnosticeerd door mijn psychiater vorig jaar',
        firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-01T00:00:00Z',
        activeImpactAreas: ['impulse_control'], promptUse: 'adapt_pacing', confidence: 0.95,
      }],
    } as any;
    const result = buildPersonalClinicalContext(userDat, 'elias');
    // evidenceSnippet should NOT appear in prompt (raw data)
    expect(result).not.toContain('gediagnosticeerd door mijn psychiater vorig jaar');
  });
});

// ─── PERSONA SEPARATION TESTS ───────────────────────────────────

describe('Clinical Factors — Persona Separation', () => {
  it('T_CF_19: Kim/Elias both get clinical factors', () => {
    const userDat = {
      userReportedClinicalFactors: [{
        factorId: 'depression', label: 'Depressie', category: 'mood_disorder',
        status: 'user_reported_diagnosed', source: 'chat',
        evidenceSnippet: 'ik heb depressie', firstSeenAt: '2026-01-01T00:00:00Z',
        lastSeenAt: '2026-01-01T00:00:00Z', activeImpactAreas: ['emotional_regulation'],
        promptUse: 'increase_risk_awareness', confidence: 0.95,
      }],
    } as any;
    const eliasResult = buildPersonalClinicalContext(userDat, 'elias');
    const kimResult = buildPersonalClinicalContext(userDat, 'kim');
    expect(eliasResult).toContain('Depressie');
    expect(kimResult).toContain('Depressie');
  });
});

// ─── CONTRACT RULE TESTS ────────────────────────────────────────

describe('Clinical Factors — Contract Rules', () => {
  it('T_CF_20: contract rule 13 exists and forbids diagnosis', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('13. USER-REPORTED CLINICAL FACTORS');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Never present them as a diagnosis');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Never infer new diagnoses from symptoms');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('Never suggest the user');
  });

  it('T_CF_21: contract still has rule about hypotheses (rule 1)', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('working hypotheses, never diagnoses');
  });
});

// ─── MERGE/DEDUP TESTS ──────────────────────────────────────────

describe('Clinical Factors — Merge Logic', () => {
  it('T_CF_22: higher confidence replaces lower for same factorId', () => {
    const existing: UserReportedClinicalFactor[] = [{
      factorId: 'adhd', label: 'ADHD', category: 'neurodevelopmental',
      status: 'user_suspected', source: 'chat',
      evidenceSnippet: 'ik vermoed ADHD', firstSeenAt: '2026-01-01T00:00:00Z',
      lastSeenAt: '2026-01-01T00:00:00Z', activeImpactAreas: ['impulse_control'],
      promptUse: 'adapt_pacing', confidence: 0.6,
    }];
    // Simulate upgrade: user now says "ik heb ADHD" (diagnosed)
    const newDetection = detectClinicalFactorsFromChat('ik heb ADHD', existing);
    // Since existing already has adhd, detector updates in-place
    expect(existing[0].status).toBe('user_reported_diagnosed');
    expect(existing[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('T_CF_23: different factors coexist', () => {
    const results1 = detectClinicalFactorsFromChat('ik heb ADHD en depressie');
    expect(results1.length).toBe(2);
    expect(results1.map(r => r.factorId)).toContain('adhd');
    expect(results1.map(r => r.factorId)).toContain('depression');
  });
});

// ─── SAFETY TESTS ───────────────────────────────────────────────

describe('Clinical Factors — Safety', () => {
  it('T_CF_24: borderline factor has safety notes about abandonment', () => {
    const results = detectClinicalFactorsFromChat('ik heb borderline');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].safetyNotes).toContain('abandonment');
  });

  it('T_CF_25: PTSD factor has safety notes about re-traumatization', () => {
    const results = detectClinicalFactorsFromChat('ik heb PTSS');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].safetyNotes).toContain('re-traumatization');
  });

  it('T_CF_26: psychotic spectrum has safety notes about reality perception', () => {
    const results = detectClinicalFactorsFromChat('ik ben gediagnosticeerd met schizofrenie');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].safetyNotes).toContain('reality perception');
  });
});
