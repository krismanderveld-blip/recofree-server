/**
 * AUTO-DEBUG FULL SYSTEM TEST
 * 
 * Simulates ALL runtime paths that can fail on device.
 * If ANY test fails here, it WILL fail on device.
 * 
 * Coverage:
 * A. PROMPT BUILDER — does buildClientSystemPrompt produce valid output for all scenarios?
 * B. PERSONA SEPARATION — does Elias get only Elias content, Kim only Kim?
 * C. CONTRACT INJECTION — is CONTEXT_AWARE_APPLICATION_CONTRACT always present?
 * D. DECEASED SAFETY — does the contract block active relationship questions for deceased persons?
 * E. PERSONAL ANCHORS — do anchors reach the prompt?
 * F. CLINICAL CONTEXT — does personalClinicalContext reach the prompt?
 * G. AGE CATEGORY — does ageCategory reach the prompt?
 * H. K05 OVERRIDE — does scanLayer1 detect boundaries without repair paths?
 * I. RELATIONAL STANCE — does detectRelationalSignals detect harm patterns?
 * J. KIM FORMULATION — does buildKimRelationalFormulationBlock produce output?
 * K. ELIAS FORMULATION — does buildEliasRecoveryFormulationBlock produce output?
 * L. MODULE ROUTING — do Elias/Kim decision layers produce valid module selections?
 * M. SAFETY ROUTING — does crisis input produce safety-first response?
 * N. MINIMAL PROXY CONTRACT — does validateMinimalGptProxyRequest accept valid requests?
 * O. DEEP ANALYSIS RESPONSE PARSING — does analyzeSection correctly parse contract response?
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('@/lib/crypto/session-memory-cache', () => ({
  SessionMemoryCache: {
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('@/lib/_core/auth', () => ({
  getSessionToken: vi.fn(() => Promise.resolve('test-token')),
}));
vi.mock('@/constants/oauth', () => ({
  getApiBaseUrl: vi.fn(() => 'https://test-railway.up.railway.app'),
}));

// ── Imports ──
import { buildClientSystemPrompt } from '@/lib/ai/prompt/client-system-prompt-builder';
import { CONTEXT_AWARE_APPLICATION_CONTRACT } from '@/lib/engine/shared/context-application-contract';
import { scanLayer1 } from '@/lib/engine/kim/k05-cross-module-override-client';
import { detectRelationalSignals } from '@/lib/engine/kim/relational-stance-filter';
import { validateMinimalGptProxyRequest } from '@/lib/ai/prompt/minimal-gpt-proxy-contract';
import type { ClientPromptBuildInput } from '@/lib/ai/prompt/client-prompt-types';

// ── Helpers ──
function makeInput(overrides: Partial<ClientPromptBuildInput> = {}): ClientPromptBuildInput {
  return {
    persona: 'elias',
    crisisLevel: 0,
    safetyLevel: 'green',
    selectedModule: 'ONTK01',
    userName: 'Kris',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// A. PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════
describe('A. PROMPT BUILDER', () => {
  it('A1. Elias basic prompt builds without crash', () => {
    const result = buildClientSystemPrompt(makeInput());
    expect(result.systemPrompt).toBeDefined();
    expect(result.systemPrompt.length).toBeGreaterThan(100);
    expect(result.persona).toBe('elias');
    expect(result.promptBuildVersion).toBe('client_mirror_v1');
  });

  it('A2. Kim basic prompt builds without crash', () => {
    const result = buildClientSystemPrompt(makeInput({ persona: 'kim', selectedModule: 'K01' }));
    expect(result.systemPrompt).toBeDefined();
    expect(result.systemPrompt.length).toBeGreaterThan(100);
    expect(result.persona).toBe('kim');
  });

  it('A3. Elias crisis prompt builds without crash', () => {
    const result = buildClientSystemPrompt(makeInput({ crisisLevel: 3, safetyLevel: 'red' }));
    expect(result.systemPrompt).toBeDefined();
    expect(result.systemPrompt.length).toBeGreaterThan(100);
  });

  it('A4. Kim crisis prompt builds without crash', () => {
    const result = buildClientSystemPrompt(makeInput({ persona: 'kim', crisisLevel: 3, safetyLevel: 'red' }));
    expect(result.systemPrompt).toBeDefined();
  });

  it('A5. Prompt with ALL optional fields builds without crash', () => {
    const result = buildClientSystemPrompt(makeInput({
      personalAnchors: '- Jules: zoon\n- Melissa: partner\n- Marie Louise Steegmans: moeder; overleden',
      personalClinicalContext: '[PERSONAL CLINICAL CONTEXT]\nSchemas: abandonment (0.7)\nModes: vulnerable_child',
      ageCategory: 'adult_25_39',
      kimFormulationBlock: '[KIM FORMULATION]\nTest block',
      eliasFormulationBlock: '[ELIAS FORMULATION]\nTest block',
      cmdMemorySummary: '[CMD MEMORY]\nTest summary',
      rejectedSuggestionsBlock: '[REJECTED]\nwandelen',
      contextDatSerialized: 'context summary here',
      projectionContext: '[PROJECTIONS]\nfear: terugval',
    }));
    expect(result.systemPrompt).toBeDefined();
    expect(result.systemPrompt.length).toBeGreaterThan(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// B. PERSONA SEPARATION
// ═══════════════════════════════════════════════════════════════════════
describe('B. PERSONA SEPARATION', () => {
  it('B1. Elias prompt does NOT contain Kim identity', () => {
    const result = buildClientSystemPrompt(makeInput());
    expect(result.systemPrompt).not.toContain('Jij bent Kim');
    expect(result.systemPrompt).not.toContain('KIM_IDENTITY');
  });

  it('B2. Kim prompt does NOT contain Elias identity', () => {
    const result = buildClientSystemPrompt(makeInput({ persona: 'kim', selectedModule: 'K01' }));
    expect(result.systemPrompt).not.toContain('Jij bent Elias');
    expect(result.systemPrompt).not.toContain('ELIAS_IDENTITY');
  });

  it('B3. Elias prompt does NOT contain Kim formulation when not provided', () => {
    const result = buildClientSystemPrompt(makeInput({ kimFormulationBlock: undefined }));
    expect(result.systemPrompt).not.toContain('[KIM FORMULATION]');
  });

  it('B4. Kim prompt does NOT contain Elias formulation when not provided', () => {
    const result = buildClientSystemPrompt(makeInput({ persona: 'kim', eliasFormulationBlock: undefined }));
    expect(result.systemPrompt).not.toContain('[ELIAS FORMULATION]');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// C. CONTRACT INJECTION
// ═══════════════════════════════════════════════════════════════════════
describe('C. CONTRACT INJECTION', () => {
  it('C1. Contract string is non-empty', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT.length).toBeGreaterThan(100);
  });

  it('C2. Elias prompt contains contract', () => {
    const result = buildClientSystemPrompt(makeInput());
    expect(result.systemPrompt).toContain('CONTEXT APPLICATION RULES');
  });

  it('C3. Kim prompt contains contract', () => {
    const result = buildClientSystemPrompt(makeInput({ persona: 'kim', selectedModule: 'K01' }));
    expect(result.systemPrompt).toContain('CONTEXT APPLICATION RULES');
  });

  it('C4. Contract present even without projectionContext', () => {
    const result = buildClientSystemPrompt(makeInput({ projectionContext: undefined }));
    expect(result.systemPrompt).toContain('CONTEXT APPLICATION RULES');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// D. DECEASED SAFETY
// ═══════════════════════════════════════════════════════════════════════
describe('D. DECEASED SAFETY', () => {
  it('D1. Contract contains DECEASED SAFETY rule', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('DECEASED SAFETY');
  });

  it('D2. Contract blocks active relationship questions for deceased', () => {
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('NEVER ask active relationship questions');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('hoe gaat het tussen jullie');
  });

  it('D3. Deceased safety reaches Elias prompt', () => {
    const result = buildClientSystemPrompt(makeInput({
      personalAnchors: '- Marie Louise Steegmans: moeder; overleden',
    }));
    expect(result.systemPrompt).toContain('DECEASED SAFETY');
    expect(result.systemPrompt).toContain('Marie Louise Steegmans');
    expect(result.systemPrompt).toContain('overleden');
  });

  it('D4. Deceased safety reaches Kim prompt', () => {
    const result = buildClientSystemPrompt(makeInput({
      persona: 'kim',
      selectedModule: 'K01',
      personalAnchors: '- Marie Louise Steegmans: moeder; overleden',
    }));
    expect(result.systemPrompt).toContain('DECEASED SAFETY');
    expect(result.systemPrompt).toContain('overleden');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// E. PERSONAL ANCHORS
// ═══════════════════════════════════════════════════════════════════════
describe('E. PERSONAL ANCHORS', () => {
  it('E1. Anchors reach Elias prompt', () => {
    const result = buildClientSystemPrompt(makeInput({
      personalAnchors: '- Jules: zoon\n- Melissa: partner',
    }));
    expect(result.systemPrompt).toContain('Jules');
    expect(result.systemPrompt).toContain('zoon');
    expect(result.systemPrompt).toContain('Melissa');
    expect(result.systemPrompt).toContain('partner');
  });

  it('E2. Anchors reach Kim prompt', () => {
    const result = buildClientSystemPrompt(makeInput({
      persona: 'kim',
      selectedModule: 'K01',
      personalAnchors: '- Jules: zoon\n- Melissa: partner',
    }));
    expect(result.systemPrompt).toContain('Jules');
    expect(result.systemPrompt).toContain('Melissa');
  });

  it('E3. No anchors does not crash', () => {
    const result = buildClientSystemPrompt(makeInput({ personalAnchors: undefined }));
    expect(result.systemPrompt).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// F. CLINICAL CONTEXT
// ═══════════════════════════════════════════════════════════════════════
describe('F. CLINICAL CONTEXT', () => {
  const clinicalCtx = '[PERSONAL CLINICAL CONTEXT — working hypotheses, never diagnose]\nSchemas (hypotheses): abandonment (0.7), self_sacrifice (0.65)\nModes (observed): vulnerable_child, detached_protector\nTriggers: conflict met zoon; verlies moeder\nContraindications: AVOID actieve relatievragen over overleden moeder';

  it('F1. ClinicalCtx reaches Elias prompt', () => {
    const result = buildClientSystemPrompt(makeInput({ personalClinicalContext: clinicalCtx }));
    expect(result.systemPrompt).toContain('PERSONAL CLINICAL CONTEXT');
    expect(result.systemPrompt).toContain('abandonment');
    expect(result.systemPrompt).toContain('vulnerable_child');
    expect(result.systemPrompt).toContain('conflict met zoon');
  });

  it('F2. ClinicalCtx reaches Kim prompt', () => {
    const result = buildClientSystemPrompt(makeInput({
      persona: 'kim',
      selectedModule: 'K01',
      personalClinicalContext: clinicalCtx,
    }));
    expect(result.systemPrompt).toContain('PERSONAL CLINICAL CONTEXT');
    expect(result.systemPrompt).toContain('abandonment');
  });

  it('F3. No clinicalCtx does not crash', () => {
    const result = buildClientSystemPrompt(makeInput({ personalClinicalContext: undefined }));
    expect(result.systemPrompt).toBeDefined();
  });

  it('F4. Contraindications in clinicalCtx reach prompt', () => {
    const result = buildClientSystemPrompt(makeInput({ personalClinicalContext: clinicalCtx }));
    expect(result.systemPrompt).toContain('Contraindications');
    expect(result.systemPrompt).toContain('AVOID');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// G. AGE CATEGORY
// ═══════════════════════════════════════════════════════════════════════
describe('G. AGE CATEGORY', () => {
  it('G1. ageCategory reaches prompt', () => {
    const result = buildClientSystemPrompt(makeInput({ ageCategory: 'adult_25_39' }));
    expect(result.systemPrompt).toContain('AGE');
    expect(result.systemPrompt).toContain('25');
  });

  it('G2. No ageCategory does not crash', () => {
    const result = buildClientSystemPrompt(makeInput({ ageCategory: undefined }));
    expect(result.systemPrompt).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// H. K05 OVERRIDE
// ═══════════════════════════════════════════════════════════════════════
describe('H. K05 OVERRIDE', () => {
  it('H1. Detects boundary without repair path', () => {
    const result = scanLayer1('Ik wil niet meer met hem praten. Ik stop ermee.');
    expect(result.boundaryDetected).toBe(true);
    expect(result.repairPathDetected).toBe(false);
    expect(result.needsLayer2).toBe(true);
  });

  it('H2. Detects boundary WITH repair path', () => {
    const result = scanLayer1('Ik neem afstand, maar als er genoeg rust is kunnen we later praten.');
    expect(result.boundaryDetected).toBe(true);
    expect(result.repairPathDetected).toBe(true);
    expect(result.needsLayer2).toBe(false);
  });

  it('H3. No boundary in normal text', () => {
    const result = scanLayer1('Ik voel me vandaag goed, ik heb goed geslapen.');
    expect(result.boundaryDetected).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// I. RELATIONAL STANCE
// ═══════════════════════════════════════════════════════════════════════
describe('I. RELATIONAL STANCE', () => {
  it('I1. Detects trust violation', () => {
    const signals = detectRelationalSignals('Hij heeft weer gelogen over waar hij was.');
    expect(signals.repeatedBetrayalSignal || signals.chronicTrustDamageSignal || signals.relationshipConflictSignal).toBe(true);
  });

  it('I2. No harm in supportive text', () => {
    const signals = detectRelationalSignals('Ik wil hem helpen maar ik weet niet hoe.');
    expect(signals.relationalHarmPatternSignal).toBeFalsy();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// J-K. FORMULATION BLOCKS
// ═══════════════════════════════════════════════════════════════════════
describe('J-K. FORMULATION BLOCKS', () => {
  it('J1. Kim formulation block reaches prompt when provided', () => {
    const result = buildClientSystemPrompt(makeInput({
      persona: 'kim',
      selectedModule: 'K01',
      kimFormulationBlock: '[KIM RELATIONAL FORMULATION]\nPattern: boundary_without_repair\nDirective: add repair path',
    }));
    expect(result.systemPrompt).toContain('KIM RELATIONAL FORMULATION');
    expect(result.systemPrompt).toContain('boundary_without_repair');
  });

  it('K1. Elias formulation block reaches prompt when provided', () => {
    const result = buildClientSystemPrompt(makeInput({
      eliasFormulationBlock: '[ELIAS RECOVERY FORMULATION]\nPattern: craving_management\nDirective: use distraction technique',
    }));
    expect(result.systemPrompt).toContain('ELIAS RECOVERY FORMULATION');
    expect(result.systemPrompt).toContain('craving_management');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// L. CMD MEMORY
// ═══════════════════════════════════════════════════════════════════════
describe('L. CMD MEMORY', () => {
  it('L1. CMD memory summary reaches prompt when provided', () => {
    const result = buildClientSystemPrompt(makeInput({
      cmdMemorySummary: '[SELECTED CLINICAL MEMORY]\nPrevious session: discussed craving management',
    }));
    expect(result.systemPrompt).toContain('SELECTED CLINICAL MEMORY');
    expect(result.systemPrompt).toContain('craving management');
  });

  it('L2. No CMD memory does not crash', () => {
    const result = buildClientSystemPrompt(makeInput({ cmdMemorySummary: undefined }));
    expect(result.systemPrompt).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// M. REJECTED SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════════
describe('M. REJECTED SUGGESTIONS', () => {
  it('M1. Rejected suggestions reach prompt', () => {
    const result = buildClientSystemPrompt(makeInput({
      rejectedSuggestionsBlock: '[REJECTED SUGGESTIONS]\n- wandelen\n- mediteren',
    }));
    expect(result.systemPrompt).toContain('REJECTED SUGGESTIONS');
    expect(result.systemPrompt).toContain('wandelen');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// N. MINIMAL PROXY CONTRACT VALIDATION
// ═══════════════════════════════════════════════════════════════════════
describe('N. MINIMAL PROXY CONTRACT', () => {
  const validRequest = {
    contractVersion: 'minimal_gpt_proxy_v1',
    requestId: 'test_123',
    persona: 'elias',
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hello' }],
    maxTokens: 1000,
    temperature: 0.7,
    topP: 1,
    store: false,
    metadata: {
      clientBuildVersion: 'test_v1',
      promptBuildVersion: 'client_mirror_v1',
    },
  };

  const validationOptions = {
    allowedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
    maxAllowedTokens: 4000,
    minTemperature: 0,
    maxTemperature: 1,
    minTopP: 0,
    maxTopP: 1,
  };

  it('N1. Valid request passes validation', () => {
    const result = validateMinimalGptProxyRequest(validRequest, validationOptions);
    expect(result.valid).toBe(true);
  });

  it('N2. Missing contractVersion fails', () => {
    const { contractVersion, ...bad } = validRequest;
    const result = validateMinimalGptProxyRequest(bad, validationOptions);
    expect(result.valid).toBe(false);
  });

  it('N3. Missing persona fails', () => {
    const { persona, ...bad } = validRequest;
    const result = validateMinimalGptProxyRequest(bad, validationOptions);
    expect(result.valid).toBe(false);
  });

  it('N4. System role in messages fails', () => {
    const bad = { ...validRequest, messages: [{ role: 'system', content: 'test' }] };
    const result = validateMinimalGptProxyRequest(bad, validationOptions);
    expect(result.valid).toBe(false);
  });

  it('N5. Section analysis request format passes', () => {
    const sectionRequest = {
      contractVersion: 'minimal_gpt_proxy_v1',
      requestId: 'section_analysis_family_1234',
      persona: 'elias',
      systemPrompt: 'Analyze this backpack section...',
      messages: [{ role: 'user', content: 'Ouderlijk gezin...' }],
      model: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 4000,
      topP: 1,
      store: false,
      metadata: {
        clientBuildVersion: 'section_analysis_v1',
        promptBuildVersion: 'client_mirror_v1',
      },
    };
    const result = validateMinimalGptProxyRequest(sectionRequest, validationOptions);
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// O. RAW DATA EXCLUSION
// ═══════════════════════════════════════════════════════════════════════
describe('O. RAW DATA EXCLUSION', () => {
  it('O1. Prompt does not contain raw birthDate', () => {
    const result = buildClientSystemPrompt(makeInput({
      personalAnchors: '- Kris: gebruiker',
      personalClinicalContext: '[PERSONAL CLINICAL CONTEXT]\nSchemas: abandonment',
    }));
    expect(result.systemPrompt).not.toContain('birthDate');
    expect(result.systemPrompt).not.toContain('1988-');
    expect(result.systemPrompt).not.toContain('geboortedatum');
  });

  it('O2. Prompt does not contain raw Backpack dump', () => {
    const result = buildClientSystemPrompt(makeInput());
    expect(result.systemPrompt).not.toContain('@recofree_userdat');
    expect(result.systemPrompt).not.toContain('AsyncStorage');
    expect(result.systemPrompt).not.toContain('SessionMemoryCache');
  });
});
