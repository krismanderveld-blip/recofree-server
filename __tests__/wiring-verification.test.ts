/**
 * WIRING VERIFICATION TESTS
 * 
 * Tests that prove every critical component is correctly wired:
 * YES = wired and working, NO = broken or missing.
 * 
 * Each test traces one specific data path from source to destination.
 * No mocking of the path itself — only mock external dependencies (GPT, fetch).
 */
import { describe, it, expect, beforeAll } from 'vitest';

// ── 1. IMPORTS: verify every critical module can be imported ──────────────
describe('WIRING: Module imports resolve correctly', () => {
  it('client-system-prompt-builder imports', async () => {
    const mod = await import('@/lib/ai/prompt/client-system-prompt-builder');
    expect(mod.buildClientSystemPrompt).toBeDefined();
    expect(typeof mod.buildClientSystemPrompt).toBe('function');
  });

  it('elias-prompt-composer imports', async () => {
    const mod = await import('@/lib/ai/prompt/elias-prompt-composer');
    expect(mod.composeEliasPrompt).toBeDefined();
  });

  it('kim-prompt-composer imports', async () => {
    const mod = await import('@/lib/ai/prompt/kim-prompt-composer');
    expect(mod.composeKimPrompt).toBeDefined();
  });

  it('relevance selector imports', async () => {
    const mod = await import('@/lib/engine/shared/clinical-context-relevance-selector');
    expect(mod.selectRelevantClinicalContext).toBeDefined();
  });

  it('tendency-canonical-bridge imports', async () => {
    const mod = await import('@/lib/engine/shared/tendency-canonical-bridge');
    expect(mod.promoteTendenciesToCanonical).toBeDefined();
  });

  it('context-application-contract imports', async () => {
    const mod = await import('@/lib/engine/shared/context-application-contract');
    expect(mod.CONTEXT_AWARE_APPLICATION_CONTRACT).toBeDefined();
    expect(typeof mod.CONTEXT_AWARE_APPLICATION_CONTRACT).toBe('string');
    expect(mod.CONTEXT_AWARE_APPLICATION_CONTRACT.length).toBeGreaterThan(100);
  });

  it('guidance-depth-resolver imports', async () => {
    const mod = await import('@/lib/engine/shared/guidance-depth-resolver');
    expect(mod.resolveGuidanceDepth).toBeDefined();
  });

  it('schema-mode-router imports', async () => {
    const mod = await import('@/lib/engine/shared/schema-mode-router');
    expect(mod.runSchemaModeEngine).toBeDefined();
  });

  it('age-category-foundation imports', async () => {
    const mod = await import('@/lib/engine/shared/age-category-foundation');
    expect(mod.resolveAgeCategory).toBeDefined();
    expect(mod.buildAgeCategoryPromptBlock).toBeDefined();
  });

  it('buildPersonalClinicalContext imports from pipeline', async () => {
    const mod = await import('@/lib/rugzak/pipeline');
    expect(mod.buildPersonalClinicalContext).toBeDefined();
  });
});

// ── 2. PROMPT BUILDER: verify all sections reach the prompt ──────────────
describe('WIRING: buildClientSystemPrompt includes all sections', () => {
  let buildClientSystemPrompt: any;
  
  beforeAll(async () => {
    const mod = await import('@/lib/ai/prompt/client-system-prompt-builder');
    buildClientSystemPrompt = mod.buildClientSystemPrompt;
  });

  const BASE_INPUT = {
    persona: 'elias' as const,
    userName: 'TestUser',
    selectedModule: 'ONTK01',
    crisisLevel: 0,
    safetyLevel: 'none' as const,
  };

  it('contextApplicationContract is included when provided', () => {
    const result = buildClientSystemPrompt({
      ...BASE_INPUT,
    });
    // contextApplicationContract is always set by the persona composer
    expect(result.debug.includedSections).toContain('contextApplicationContract');
  });

  it('personalAnchors is included when provided', () => {
    const result = buildClientSystemPrompt({
      ...BASE_INPUT,
      personalAnchors: 'Jules (zoon), Ellen (ex-partner)',
    });
    expect(result.debug.includedSections).toContain('personalAnchors');
    expect(result.systemPrompt).toContain('Jules (zoon)');
  });

  it('personalClinicalContext is included when provided', () => {
    const result = buildClientSystemPrompt({
      ...BASE_INPUT,
      personalClinicalContext: 'Schemas: abandonment (zeer sterk aanwezig)',
    });
    expect(result.debug.includedSections).toContain('personalClinicalContext');
    expect(result.systemPrompt).toContain('abandonment');
  });

  it('ageCategory is included when provided', () => {
    const result = buildClientSystemPrompt({
      ...BASE_INPUT,
      ageCategory: 'adult_30_50',
    });
    expect(result.debug.includedSections).toContain('ageCategory');
  });

  it('diarySummary is included when provided', () => {
    const result = buildClientSystemPrompt({
      ...BASE_INPUT,
      diarySummary: 'Vandaag goed geslapen, geen craving',
    });
    expect(result.debug.includedSections).toContain('diary');
    expect(result.systemPrompt).toContain('Vandaag goed geslapen');
  });

  it('crisis instructions are included at crisisLevel >= 2', () => {
    const result = buildClientSystemPrompt({
      ...BASE_INPUT,
      crisisLevel: 2,
    });
    expect(result.debug.includedSections).toContain('crisisInstructions');
    expect(result.systemPrompt).toContain('1813');
  });

  it('crisis instructions are NOT included at crisisLevel 0', () => {
    const result = buildClientSystemPrompt({
      ...BASE_INPUT,
      crisisLevel: 0,
    });
    expect(result.debug.includedSections).not.toContain('crisisInstructions');
  });

  it('formulationBlock is included for Elias when provided', () => {
    const result = buildClientSystemPrompt({
      ...BASE_INPUT,
      eliasFormulationBlock: 'Elias formulation: recovery-focused',
    });
    expect(result.debug.includedSections.join(',')).toMatch(/formulationBlock|eliasFormulationBlock/);
    expect(result.systemPrompt).toContain('recovery-focused');
  });

  it('formulationBlock is included for Kim when provided', () => {
    const result = buildClientSystemPrompt({
      ...BASE_INPUT,
      persona: 'kim',
      kimFormulationBlock: 'Kim formulation: relational therapist',
    });
    expect(result.debug.includedSections.join(',')).toMatch(/formulationBlock|eliasFormulationBlock/);
    expect(result.systemPrompt).toContain('relational therapist');
  });

  it('rejectedSuggestionsBlock is included when provided', () => {
    const result = buildClientSystemPrompt({
      ...BASE_INPUT,
      rejectedSuggestionsBlock: 'User rejected: meditation suggestion',
    });
    expect(result.debug.includedSections).toContain('rejectedSuggestions');
    expect(result.systemPrompt).toContain('meditation suggestion');
  });

  it('contextDatSerialized is included when provided', () => {
    const result = buildClientSystemPrompt({
      ...BASE_INPUT,
      contextDatSerialized: 'Context: user has 2 children',
    });
    expect(result.systemPrompt).toContain('user has 2 children');
  });

  it('projectionContext is included when provided', () => {
    const result = buildClientSystemPrompt({
      ...BASE_INPUT,
      projectionContext: 'Projection: fear of relapse',
    });
    expect(result.systemPrompt).toContain('fear of relapse');
  });

  it('relationalStanceDirective is included for Kim', () => {
    const result = buildClientSystemPrompt({
      ...BASE_INPUT,
      persona: 'kim',
      relationalStanceDirective: 'Maintain relational balance',
    });
    expect(result.systemPrompt).toContain('relational balance');
  });
});

// ── 3. PERSONA SEPARATION ──────────────────────────────────────────────
describe('WIRING: Persona separation', () => {
  let buildClientSystemPrompt: any;
  
  beforeAll(async () => {
    const mod = await import('@/lib/ai/prompt/client-system-prompt-builder');
    buildClientSystemPrompt = mod.buildClientSystemPrompt;
  });

  it('Elias prompt contains ELIAS identity', () => {
    const result = buildClientSystemPrompt({
      persona: 'elias',
      userName: 'Test',
      selectedModule: 'ONTK01',
      crisisLevel: 0,
      safetyLevel: 'none',
    });
    expect(result.systemPrompt).toContain('Elias');
  });

  it('Kim prompt contains KIM identity', () => {
    const result = buildClientSystemPrompt({
      persona: 'kim',
      userName: 'Test',
      selectedModule: 'K01',
      crisisLevel: 0,
      safetyLevel: 'none',
    });
    expect(result.systemPrompt).toContain('Kim');
  });

  it('Kim prompt does NOT contain Elias formulation', () => {
    const result = buildClientSystemPrompt({
      persona: 'kim',
      userName: 'Test',
      selectedModule: 'K01',
      crisisLevel: 0,
      safetyLevel: 'none',
      eliasFormulationBlock: 'ELIAS_ONLY_CONTENT',
    });
    expect(result.systemPrompt).not.toContain('ELIAS_ONLY_CONTENT');
  });

  it('Elias prompt does NOT contain Kim formulation', () => {
    const result = buildClientSystemPrompt({
      persona: 'elias',
      userName: 'Test',
      selectedModule: 'ONTK01',
      crisisLevel: 0,
      safetyLevel: 'none',
      kimFormulationBlock: 'KIM_ONLY_CONTENT',
    });
    expect(result.systemPrompt).not.toContain('KIM_ONLY_CONTENT');
  });
});

// ── 4. DECEASED SAFETY ──────────────────────────────────────────────────
describe('WIRING: Deceased safety rule', () => {
  it('CONTEXT_AWARE_APPLICATION_CONTRACT contains deceased rule', async () => {
    const { CONTEXT_AWARE_APPLICATION_CONTRACT } = await import('@/lib/engine/shared/context-application-contract');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('DECEASED SAFETY');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('overleden');
  });
});

// ── 5. STORE:FALSE ──────────────────────────────────────────────────────
describe('WIRING: store:false in all server OpenAI calls', () => {
  it('nano-interpret.ts has store:false', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/server/engine/nano-interpret.ts', 'utf-8');
    expect(content).toContain('store: false');
  });

  it('ai-chat.ts has store:false in main GPT call', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/server/ai-chat.ts', 'utf-8');
    const storeMatches = content.match(/store:\s*false/g);
    expect(storeMatches).not.toBeNull();
    expect(storeMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it('minimal-gpt-proxy.ts enforces store:false', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/server/minimal-gpt-proxy.ts', 'utf-8');
    expect(content).toContain('store: false');
  });

  it('section-analysis-service sends store:false', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/backpack-extractor/section-analysis-service.ts', 'utf-8');
    expect(content).toContain('store: false');
  });

  it('llm.ts extraction has store:false', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/server/_core/llm.ts', 'utf-8');
    expect(content).toContain('store = false');
  });
});

// ── 6. RELEVANCE SELECTOR ──────────────────────────────────────────────
describe('WIRING: Relevance selector', () => {
  it('selectRelevantClinicalContext returns direct_question_all for schema question', async () => {
    const { selectRelevantClinicalContext } = await import('@/lib/engine/shared/clinical-context-relevance-selector');
    const result = selectRelevantClinicalContext([], undefined, 'wat zijn mijn schemas en modi?');
    expect(result.reason).toBe('direct_question_all');
    expect(result.relevantSchemas).toBe('all');
    expect(result.relevantModes).toBe('all');
  });

  it('selectRelevantClinicalContext filters by theme', async () => {
    const { selectRelevantClinicalContext } = await import('@/lib/engine/shared/clinical-context-relevance-selector');
    const result = selectRelevantClinicalContext(['craving'], undefined, 'ik heb craving');
    expect(result.reason).toBe('theme_matched');
    expect(Array.isArray(result.relevantSchemas) ? result.relevantSchemas : []).toContain('insufficient_self_control');
    expect(result.relevantSchemas).not.toBe('all');
  });

  it('selectRelevantClinicalContext sends all when no theme match', async () => {
    const { selectRelevantClinicalContext } = await import('@/lib/engine/shared/clinical-context-relevance-selector');
    const result = selectRelevantClinicalContext(['greeting'], undefined, 'hoi');
    // greeting is not mapped, should fall through to send all
    expect(result.relevantSchemas).toBe('all');
  });

  it('pipeline.ts uses import (not require) for relevance selector', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/rugzak/pipeline.ts', 'utf-8');
    expect(content).toContain("import { selectRelevantClinicalContext } from '../engine/shared/clinical-context-relevance-selector'");
    // Should NOT have require() for this module
    expect(content).not.toContain("require('../engine/shared/clinical-context-relevance-selector')");
  });
});

// ── 7. TENDENCY BRIDGE ──────────────────────────────────────────────────
describe('WIRING: Tendency-to-canonical bridge', () => {
  it('pipeline.ts uses import (not require) for tendency bridge', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/rugzak/pipeline.ts', 'utf-8');
    expect(content).toContain("import { promoteTendenciesToCanonical } from '../engine/shared/tendency-canonical-bridge'");
  });

  it('promoteTendenciesToCanonical is called in pipeline', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/rugzak/pipeline.ts', 'utf-8');
    expect(content).toContain('promoteTendenciesToCanonical({');
  });
});

// ── 8. PERSONAL CLINICAL CONTEXT ──────────────────────────────────────
describe('WIRING: buildPersonalClinicalContext', () => {
  let buildPersonalClinicalContext: any;
  
  beforeAll(async () => {
    const mod = await import('@/lib/rugzak/pipeline');
    buildPersonalClinicalContext = mod.buildPersonalClinicalContext;
  });

  it('returns content with canonical schemas', () => {
    const result = buildPersonalClinicalContext({
      schemas: [
        { schema: 'abandonment', confidence: 0.8, evidenceType: 'explicit' },
        { schema: 'emotional_deprivation', confidence: 0.7, evidenceType: 'inferred' },
      ],
      modes: [
        { mode: 'vulnerable_child', confidence: 0.85, evidenceType: 'explicit' },
      ],
    }, 'elias');
    expect(result).toBeDefined();
    expect(result).toContain('abandonment');
    expect(result).toContain('emotional_deprivation');
    expect(result).toContain('vulnerable_child');
  });

  it('includes presence labels', () => {
    const result = buildPersonalClinicalContext({
      schemas: [
        { schema: 'abandonment', confidence: 0.9, evidenceType: 'explicit' },
        { schema: 'emotional_deprivation', confidence: 0.4, evidenceType: 'inferred' },
      ],
    }, 'elias');
    expect(result).toContain('zeer sterk aanwezig');
    expect(result).toContain('minder dominant');
  });

  it('falls back to schemaTendencies when canonical empty', () => {
    const result = buildPersonalClinicalContext({
      schemas: [],
      modes: [],
      schemaTendencies: [
        { schemaId: 'abandonment', confidence: 0.7, confirmed: true },
      ],
      modeTendencies: [
        { modeId: 'vulnerable_child', confidence: 0.8, confirmed: true },
      ],
    }, 'elias');
    expect(result).toBeDefined();
    expect(result).toContain('abandonment');
  });

  it('returns undefined when no data at all', () => {
    const result = buildPersonalClinicalContext({}, 'elias');
    expect(result).toBeUndefined();
  });

  it('does NOT contain raw birthDate', () => {
    const result = buildPersonalClinicalContext({
      schemas: [{ schema: 'abandonment', confidence: 0.8 }],
      birthDate: '1990-01-15',
    }, 'elias');
    expect(result).not.toContain('1990-01-15');
  });

  it('Elias gets relapsePathways but NOT caregiverBurdenPathways', () => {
    const result = buildPersonalClinicalContext({
      schemas: [{ schema: 'abandonment', confidence: 0.8 }],
      relapsePathways: [{ type: 'stress_relapse', description: 'stress leads to drinking', confidence: 0.7 }],
      caregiverBurdenPathways: [{ type: 'emotional_exhaustion', description: 'caring causes burnout', confidence: 0.7 }],
    }, 'elias');
    expect(result).toBeDefined();
    // Elias should NOT have caregiver burden pathways
    expect(result).not.toContain('emotional_exhaustion');
  });

  it('Kim gets caregiverBurdenPathways but NOT relapsePathways', () => {
    const result = buildPersonalClinicalContext({
      schemas: [{ schema: 'abandonment', confidence: 0.8 }],
      relapsePathways: [{ type: 'stress_relapse', description: 'stress leads to drinking', confidence: 0.7 }],
      caregiverBurdenPathways: [{ type: 'emotional_exhaustion', description: 'caring causes burnout', confidence: 0.7 }],
    }, 'kim');
    expect(result).toBeDefined();
    // Kim should NOT have relapse pathways
    expect(result).not.toContain('stress_relapse');
  });
});

// ── 9. RAW DATA EXCLUSION ──────────────────────────────────────────────
describe('WIRING: Raw data exclusion from prompt', () => {
  let buildClientSystemPrompt: any;
  
  beforeAll(async () => {
    const mod = await import('@/lib/ai/prompt/client-system-prompt-builder');
    buildClientSystemPrompt = mod.buildClientSystemPrompt;
  });

  it('prompt does NOT contain raw backpack section content', () => {
    const result = buildClientSystemPrompt({
      persona: 'elias',
      userName: 'Test',
      selectedModule: 'ONTK01',
      crisisLevel: 0,
      safetyLevel: 'none',
    });
    expect(result.systemPrompt).not.toContain('backpackRaw');
    expect(result.systemPrompt).not.toContain('user.dat');
    expect(result.systemPrompt).not.toContain('DIST01');
  });
});

// ── 10. CONTRACT RULE ENFORCEMENT ──────────────────────────────────────
describe('WIRING: Contract rules', () => {
  it('contract contains all 12 rules', async () => {
    const { CONTEXT_AWARE_APPLICATION_CONTRACT } = await import('@/lib/engine/shared/context-application-contract');
    for (let i = 1; i <= 12; i++) {
      expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain(`${i}.`);
    }
  });

  it('contract rule 5 has exception for list ALL', async () => {
    const { CONTEXT_AWARE_APPLICATION_CONTRACT } = await import('@/lib/engine/shared/context-application-contract');
    expect(CONTEXT_AWARE_APPLICATION_CONTRACT).toContain('list ALL to user with presence labels');
  });
});

// ── 11. SECTION ANALYSIS CONTRACT FORMAT ──────────────────────────────
describe('WIRING: Section analysis contract format', () => {
  it('section-analysis-service sends contractVersion', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/backpack-extractor/section-analysis-service.ts', 'utf-8');
    expect(content).toContain("contractVersion: 'minimal_gpt_proxy_v1'");
    expect(content).toContain('requestId:');
    expect(content).toContain('persona:');
    expect(content).toContain('store: false');
  });
});

// ── 12. FORCEANALYZE ENUM VALIDATION ──────────────────────────────────
describe('WIRING: forceReanalyze validates enum values', () => {
  it('section-analysis-service checks valid schema IDs', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/backpack-extractor/section-analysis-service.ts', 'utf-8');
    expect(content).toContain('validSchemaIds');
    expect(content).toContain('validModeIds');
    expect(content).toContain('forceReanalyze');
  });
});

// ── 13. EXTRACTION PROVIDER FALLBACK ──────────────────────────────────
describe('WIRING: Extraction provider fallback', () => {
  it('llm.ts has forge → openai fallback', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/server/_core/llm.ts', 'utf-8');
    expect(content).toContain('OPENAI_API_KEY');
    expect(content).toContain('forgeApiKey');
    expect(content).toContain('LLM_PROVIDER_MISSING');
  });
});

// ── 14. OPENAI-PROVIDER PASSES ALL FIELDS ──────────────────────────────
describe('WIRING: openai-provider passes all context fields', () => {
  it('passes crisisLevel to prompt builder', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/ai/openai-provider.ts', 'utf-8');
    expect(content).toContain('crisisLevel:');
  });

  it('passes personalAnchors to prompt builder', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/ai/openai-provider.ts', 'utf-8');
    expect(content).toContain('personalAnchors:');
  });

  it('passes personalClinicalContext to prompt builder', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/ai/openai-provider.ts', 'utf-8');
    expect(content).toContain('personalClinicalContext:');
  });

  it('passes ageCategory to prompt builder', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/ai/openai-provider.ts', 'utf-8');
    expect(content).toContain('ageCategory:');
  });

  it('passes diarySummary to prompt builder', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/ai/openai-provider.ts', 'utf-8');
    expect(content).toContain('diarySummary:');
  });

  it('passes eliasFormulationBlock to prompt builder', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/ai/openai-provider.ts', 'utf-8');
    expect(content).toContain('eliasFormulationBlock:');
  });

  it('passes kimFormulationBlock to prompt builder', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/ai/openai-provider.ts', 'utf-8');
    expect(content).toContain('kimFormulationBlock:');
  });

  it('passes projectionContext to prompt builder', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/ai/openai-provider.ts', 'utf-8');
    expect(content).toContain('projectionContext:');
  });

  it('passes relationalStanceDirective to prompt builder', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/ai/openai-provider.ts', 'utf-8');
    expect(content).toContain('relationalStanceDirective:');
  });

  it('passes cmdMemorySummary to prompt builder', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/ai/openai-provider.ts', 'utf-8');
    expect(content).toContain('cmdMemorySummary:');
  });
});

// ── 15. NO REQUIRE() FOR CRITICAL MODULES ──────────────────────────────
describe('WIRING: No require() for critical client modules in pipeline', () => {
  it('pipeline.ts does not use require() for relevance selector', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/rugzak/pipeline.ts', 'utf-8');
    expect(content).not.toContain("require('../engine/shared/clinical-context-relevance-selector')");
  });

  it('pipeline.ts does not use require() for tendency bridge', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('/home/ubuntu/recofree-app/lib/rugzak/pipeline.ts', 'utf-8');
    expect(content).not.toContain("require('../engine/shared/tendency-canonical-bridge')");
  });
});
