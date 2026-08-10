import { describe, it, expect } from 'vitest';
import { buildKimRelationalFormulationContext } from '../../lib/engine/kim/relational-formulation';

describe('FASE 6C: Kim Formulation Pipeline Integration', () => {
  const baseInput = {
    userMessage: 'hij heeft gelogen over waar hij was',
    persona: 'kim' as const,
    effectiveDepth: 'medium' as const,
    safetyActive: false,
    crisisActive: false,
    relationalHarmPatternActive: false,
    guidanceDepth: 'normal' as const,
    currentZone: 'green' as const,
    moduleId: 'K01',
    memoryFacts: [],
    engineSignals: [],
    localTimestamp: new Date().toISOString(),
    normalizedMessage: undefined,
    semanticThemes: [] as string[],
    semanticResolvedModule: null,
    semanticMatchedTheme: null,
    semanticSource: 'deterministic' as const,
  };

  // Test 1: Kim pipeline with trust/lying message builds formulation context
  it('1. Kim trust/lying message builds formulation context', () => {
    const ctx = buildKimRelationalFormulationContext(baseInput);
    expect(ctx.mode).not.toBe('off');
    expect(ctx.mode).not.toBe('insufficient_context');
    expect(ctx.activeDomains).toContain('trust');
  });

  // Test 2: Kim pipeline with nano.translatedNL uses normalizedMessage
  it('2. Kim with nano translatedNL uses normalizedMessage for detection', () => {
    const ctx = buildKimRelationalFormulationContext({
      ...baseInput,
      userMessage: 'il a menti sur où il était', // French
      normalizedMessage: 'hij heeft gelogen over waar hij was', // NL translation from nano
      semanticSource: 'nano',
    });
    expect(ctx.activeDomains).toContain('trust');
  });

  // Test 3: Kim pipeline without nano uses userMessage
  it('3. Kim without nano uses userMessage directly', () => {
    const ctx = buildKimRelationalFormulationContext({
      ...baseInput,
      normalizedMessage: undefined,
      semanticSource: 'deterministic',
    });
    expect(ctx.activeDomains).toContain('trust');
  });

  // Test 4: Elias pipeline gets no Kim formulation context
  it('4. Elias gets no Kim formulation context', () => {
    const ctx = buildKimRelationalFormulationContext({
      ...baseInput,
      persona: 'elias',
    });
    expect(ctx.mode).toBe('off');
    expect(ctx.activeDomains).toEqual([]);
  });

  // Test 5: safetyActive Kim gives safety_blocked
  it('5. safetyActive Kim gives safety_blocked mode', () => {
    const ctx = buildKimRelationalFormulationContext({
      ...baseInput,
      safetyActive: true,
    });
    expect(ctx.mode).toBe('safety_blocked');
  });

  // Test 6: crisisActive Kim gives safety_blocked
  it('6. crisisActive Kim gives safety_blocked mode', () => {
    const ctx = buildKimRelationalFormulationContext({
      ...baseInput,
      crisisActive: true,
    });
    expect(ctx.mode).toBe('safety_blocked');
  });

  // Test 21: Nano remains semantic hint, not final decision
  it('21. Nano semantic hint does not override engine mode', () => {
    const ctx = buildKimRelationalFormulationContext({
      ...baseInput,
      semanticResolvedModule: 'K05',
      semanticMatchedTheme: 'communication',
      semanticSource: 'nano',
    });
    // Engine still detects trust from userMessage, not forced to communication
    expect(ctx.activeDomains).toContain('trust');
  });

  // Test 22: No server imports in formulation engine
  it('22. No server imports in formulation engine', async () => {
    const fs = await import('fs');
    const engineFile = fs.readFileSync(
      require.resolve('../../lib/engine/kim/relational-formulation/kim-relational-formulation-engine.ts'),
      'utf-8'
    );
    const importLines = engineFile.split('\n').filter(l => l.startsWith('import') && !l.includes('// '));
    const serverImports = importLines.filter(l => l.includes('server/') || l.includes('invokeLLM') || l.includes('forge'));
    expect(serverImports).toHaveLength(0);
  });

  // Test 24: No memory writes in formulation engine
  it('24. No memory writes in formulation engine', async () => {
    const fs = await import('fs');
    const engineFile = fs.readFileSync(
      require.resolve('../../lib/engine/kim/relational-formulation/kim-relational-formulation-engine.ts'),
      'utf-8'
    );
    expect(engineFile).not.toContain('AsyncStorage');
    expect(engineFile).not.toContain('writeFile');
    expect(engineFile).not.toContain('setItem');
  });

  // Test 28: 0 TypeScript errors (validated externally)
  it('28. Engine returns valid schema version', () => {
    const ctx = buildKimRelationalFormulationContext(baseInput);
    expect(ctx.schemaVersion).toBe('kim_relational_formulation_v1');
    expect(ctx.persona).toBe('kim');
  });
});
