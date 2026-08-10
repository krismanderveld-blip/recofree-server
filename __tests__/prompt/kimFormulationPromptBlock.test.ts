import { describe, it, expect } from 'vitest';
import { buildKimRelationalFormulationBlock } from '../../lib/ai/prompt/kim-prompt-composer';
import { buildClientSystemPrompt } from '../../lib/ai/prompt/client-system-prompt-builder';
import { buildKimRelationalFormulationContext } from '../../lib/engine/kim/relational-formulation';
import type { KimRelationalFormulationContext } from '../../lib/engine/kim/relational-formulation/kim-relational-formulation-types';
import type { ClientPromptBuildInput } from '../../lib/ai/prompt/client-prompt-types';

describe('FASE 6C: Kim Formulation Prompt Block', () => {
  const trustInput = {
    userMessage: 'hij heeft weer gelogen',
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
  };

  function getActiveContext(): KimRelationalFormulationContext {
    return buildKimRelationalFormulationContext(trustInput);
  }

  // Test 7: Prompt builder injects block for Kim medium context
  it('7. Prompt builder injects block for Kim medium context', () => {
    const ctx = getActiveContext();
    const block = buildKimRelationalFormulationBlock(ctx);
    expect(block).toBeDefined();
    expect(block).toContain('[KIM RELATIONAL FORMULATION');
  });

  // Test 8: Prompt builder injects no block for Elias
  it('8. No block for Elias', () => {
    const result = buildClientSystemPrompt({
      persona: 'elias',
      crisisLevel: 0,
      safetyLevel: 'none',
      kimFormulationBlock: undefined,
    });
    expect(result.systemPrompt).not.toContain('[KIM RELATIONAL FORMULATION');
  });

  // Test 9: No block at mode off
  it('9. No block at mode off', () => {
    const ctx = buildKimRelationalFormulationContext({
      ...trustInput,
      persona: 'elias',
    });
    const block = buildKimRelationalFormulationBlock(ctx);
    expect(block).toBeUndefined();
  });

  // Test 10: No block at insufficient_context
  it('10. No block at insufficient_context', () => {
    const ctx = buildKimRelationalFormulationContext({
      ...trustInput,
      userMessage: '',
    });
    const block = buildKimRelationalFormulationBlock(ctx);
    expect(block).toBeUndefined();
  });

  // Test 11: No block at safety_blocked
  it('11. No block at safety_blocked', () => {
    const ctx = buildKimRelationalFormulationContext({
      ...trustInput,
      safetyActive: true,
    });
    const block = buildKimRelationalFormulationBlock(ctx);
    expect(block).toBeUndefined();
  });

  // Test 12: Block contains severity/domains/mustMention
  it('12. Block contains severity, domains, mustMention', () => {
    const ctx = getActiveContext();
    const block = buildKimRelationalFormulationBlock(ctx)!;
    expect(block).toContain('severity:');
    expect(block).toContain('Domains:');
    expect(block).toContain('Must mention:');
  });

  // Test 13: Block contains mustAvoid
  it('13. Block contains mustAvoid', () => {
    const ctx = getActiveContext();
    const block = buildKimRelationalFormulationBlock(ctx)!;
    expect(block).toContain('Must avoid:');
  });

  // Test 14: Block contains responsibilityMap
  it('14. Block contains responsibilityMap', () => {
    const ctx = getActiveContext();
    const block = buildKimRelationalFormulationBlock(ctx)!;
    expect(block).toContain('Responsibility:');
  });

  // Test 15: Block contains domainSeparations if present
  it('15. Block contains domainSeparations if present', () => {
    const ctx = getActiveContext();
    if (ctx.domainSeparations.length > 0) {
      const block = buildKimRelationalFormulationBlock(ctx)!;
      expect(block).toContain('Domain separations:');
    }
  });

  // Test 16: Block contains repairConditions if present
  it('16. Block contains repairConditions if present', () => {
    const ctx = getActiveContext();
    if (ctx.repairConditions.length > 0) {
      const block = buildKimRelationalFormulationBlock(ctx)!;
      expect(block).toContain('Repair conditions:');
    }
  });

  // Test 17: CoreHypothesis only at high
  it('17. CoreHypothesis only at high', () => {
    const lowCtx = buildKimRelationalFormulationContext({
      ...trustInput,
      effectiveDepth: 'low',
    });
    const lowBlock = buildKimRelationalFormulationBlock(lowCtx);
    if (lowBlock) {
      expect(lowBlock).not.toContain('Core hypothesis:');
    }

    const highCtx = buildKimRelationalFormulationContext({
      ...trustInput,
      effectiveDepth: 'high',
    });
    const highBlock = buildKimRelationalFormulationBlock(highCtx);
    if (highBlock && highCtx.coreHypothesis) {
      expect(highBlock).toContain('Core hypothesis:');
    }
  });

  // Test 18: Block is not raw JSON
  it('18. Block is not raw JSON', () => {
    const ctx = getActiveContext();
    const block = buildKimRelationalFormulationBlock(ctx)!;
    expect(block).not.toMatch(/^\s*\{/);
    expect(block).not.toContain('"schemaVersion"');
  });

  // Test 19: Block is compact (under 400 tokens estimated)
  it('19. Block is compact', () => {
    const ctx = getActiveContext();
    const block = buildKimRelationalFormulationBlock(ctx)!;
    // Rough estimate: 1 token ≈ 4 chars
    const estimatedTokens = block.length / 4;
    expect(estimatedTokens).toBeLessThan(400);
  });

  // Test 20: Kim/Elias persona separation in prompt builder
  it('20. Kim/Elias persona separation in prompt builder', () => {
    const ctx = getActiveContext();
    const block = buildKimRelationalFormulationBlock(ctx)!;

    const kimResult = buildClientSystemPrompt({
      persona: 'kim',
      crisisLevel: 0,
      safetyLevel: 'none',
      kimFormulationBlock: block,
    });
    expect(kimResult.systemPrompt).toContain('[KIM RELATIONAL FORMULATION');

    const eliasResult = buildClientSystemPrompt({
      persona: 'elias',
      crisisLevel: 0,
      safetyLevel: 'none',
      kimFormulationBlock: block, // Even if passed, Elias should not include it
    });
    expect(eliasResult.systemPrompt).not.toContain('[KIM RELATIONAL FORMULATION');
  });
});

