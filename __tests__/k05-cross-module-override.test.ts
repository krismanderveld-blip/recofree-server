/**
 * K05 CROSS-MODULE OVERRIDE — Proof Tests
 *
 * Tests that demonstrate the runtime enforcement works:
 * 1. Bare boundary → detected → classified → corrected
 * 2. Boundary with repair path → no correction
 * 3. No boundary at all → no correction
 * 4. Safety-first active → no correction (exception)
 * 5. RELATIONAL_HARM_PATTERN active → no correction (exception)
 * 6. Distance boundary → distance-specific fallback
 * 7. Boundary with repair path detected by Layer 1 → Layer 2 not called
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanLayer1, applyK05CrossModuleOverride } from '../server/k05-cross-module-override';
import type { K05OverrideInput } from '../server/k05-cross-module-override';

// Mock invokeLLM to avoid real API calls in tests
vi.mock('../server/_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          containsBoundaryStatement: true,
          containsRepairPath: false,
        }),
      },
    }],
  }),
}));

// ─── Layer 1 Unit Tests ────────────────────────────────────────────────

describe('K05 Layer 1 — Deterministic Pattern Scan', () => {
  it('detects boundary without repair path', () => {
    const text = 'Ik begrijp dat dit moeilijk is. Maar ik kan dit niet accepteren. Dit gaat te ver en ik trek hier een grens.';
    const result = scanLayer1(text);
    expect(result.boundaryDetected).toBe(true);
    expect(result.repairPathDetected).toBe(false);
    expect(result.needsLayer2).toBe(true);
  });

  it('detects boundary WITH repair path → no Layer 2 needed', () => {
    const text = 'Ik kan dit niet accepteren. Maar ik wil wel dat we hier later over praten wanneer we rustiger zijn.';
    const result = scanLayer1(text);
    expect(result.boundaryDetected).toBe(true);
    expect(result.repairPathDetected).toBe(true);
    expect(result.needsLayer2).toBe(false);
  });

  it('no boundary at all → no Layer 2', () => {
    const text = 'Ik hoor je. Het klinkt alsof je een moeilijke dag hebt gehad. Wat zou je nu het meest helpen?';
    const result = scanLayer1(text);
    expect(result.boundaryDetected).toBe(false);
    expect(result.needsLayer2).toBe(false);
  });

  it('detects distance boundary', () => {
    const text = 'Ik neem afstand van deze situatie. Ik ga weg en ik wil hier niet meer over praten.';
    const result = scanLayer1(text);
    expect(result.boundaryDetected).toBe(true);
    expect(result.repairPathDetected).toBe(false);
    expect(result.needsLayer2).toBe(true);
  });
});

// ─── Full Override Integration Tests ───────────────────────────────────

describe('K05 Cross-Module Override — Full Pipeline', () => {
  const BARE_BOUNDARY_RESPONSE =
    'Ik begrijp dat dit pijn doet. Maar dit is mijn grens. Ik kan dit niet accepteren en ik stop met dit gesprek.';

  const BOUNDARY_WITH_REPAIR =
    'Ik begrijp dat dit pijn doet. Dit is mijn grens, ik kan dit niet accepteren. Maar ik wil wel dat we hier later over praten wanneer het rustiger is.';

  const NO_BOUNDARY_RESPONSE =
    'Ik hoor je. Het klinkt alsof je een moeilijke dag hebt gehad. Wat zou je nu het meest helpen?';

  const DISTANCE_BOUNDARY_RESPONSE =
    'Ik neem afstand van dit gesprek. Ik trek me terug omdat ik niet meer helder kan denken.';

  const SAFETY_CRISIS_RESPONSE =
    'Ik hoor dat je je niet veilig voelt. Ik stop met dit gesprek nu. Bel 0800 32 123 als je in gevaar bent.';

  const HARM_PATTERN_RESPONSE =
    'Ik herken dit patroon. De ander heeft opnieuw gelogen en ik kan dit niet accepteren. Ik trek hier een grens.';

  // Test 1: Bare boundary → detected → classified → corrected
  it('TEST 1: bare boundary gets corrected with repair path fallback', async () => {
    const input: K05OverrideInput = {
      responseText: BARE_BOUNDARY_RESPONSE,
      safetyActive: false,
      relationalHarmActive: false,
      activeModule: 'KBR01',
    };

    const result = await applyK05CrossModuleOverride(input);

    // BEFORE: bare boundary without repair path
    expect(BARE_BOUNDARY_RESPONSE).not.toContain('rust en veiligheid');
    expect(BARE_BOUNDARY_RESPONSE).not.toContain('elkaar echt te horen');

    // AFTER: correction applied
    expect(result.overrideApplied).toBe(true);
    expect(result.layer1.boundaryDetected).toBe(true);
    expect(result.layer1.repairPathDetected).toBe(false);
    expect(result.layer1.needsLayer2).toBe(true);
    expect(result.layer2).not.toBeNull();
    expect(result.layer2!.requiresCorrection).toBe(true);
    expect(result.layer2!.reason).toBe('boundary_without_repair_path');
    expect(result.correctionMethod).toBe('deterministic_fallback');

    // The corrected text contains the original + repair path
    expect(result.correctedText).toContain(BARE_BOUNDARY_RESPONSE);
    expect(result.correctedText).toContain('Ik wil contact niet verbreken');
    expect(result.correctedText).toContain('rust en veiligheid');
    expect(result.correctedText).toContain('elkaar echt te horen');

    console.log('\n=== TEST 1: BEFORE ===');
    console.log(BARE_BOUNDARY_RESPONSE);
    console.log('\n=== TEST 1: AFTER ===');
    console.log(result.correctedText);
  });

  // Test 2: Boundary with repair path → no correction
  it('TEST 2: boundary with repair path is not corrected', async () => {
    const input: K05OverrideInput = {
      responseText: BOUNDARY_WITH_REPAIR,
      safetyActive: false,
      relationalHarmActive: false,
      activeModule: 'K01',
    };

    const result = await applyK05CrossModuleOverride(input);

    expect(result.overrideApplied).toBe(false);
    expect(result.layer1.boundaryDetected).toBe(true);
    expect(result.layer1.repairPathDetected).toBe(true);
    expect(result.layer1.needsLayer2).toBe(false);
    expect(result.layer2).toBeNull(); // Layer 2 was NOT called
    expect(result.correctedText).toBe(BOUNDARY_WITH_REPAIR);
  });

  // Test 3: No boundary at all → no correction
  it('TEST 3: response without boundary is not corrected', async () => {
    const input: K05OverrideInput = {
      responseText: NO_BOUNDARY_RESPONSE,
      safetyActive: false,
      relationalHarmActive: false,
      activeModule: 'KO1',
    };

    const result = await applyK05CrossModuleOverride(input);

    expect(result.overrideApplied).toBe(false);
    expect(result.layer1.boundaryDetected).toBe(false);
    expect(result.layer1.needsLayer2).toBe(false);
    expect(result.layer2).toBeNull();
    expect(result.correctedText).toBe(NO_BOUNDARY_RESPONSE);
  });

  // Test 4: Safety-first active → no correction (exception)
  it('TEST 4: safety-first active skips override entirely', async () => {
    const input: K05OverrideInput = {
      responseText: SAFETY_CRISIS_RESPONSE,
      safetyActive: true,
      relationalHarmActive: false,
      activeModule: 'K06',
    };

    const result = await applyK05CrossModuleOverride(input);

    expect(result.overrideApplied).toBe(false);
    expect(result.layer2!.reason).toBe('safety_exception');
    expect(result.correctedText).toBe(SAFETY_CRISIS_RESPONSE);
    // Safety response must NOT get a repair path appended
    expect(result.correctedText).not.toContain('Ik wil contact niet verbreken');
  });

  // Test 5: RELATIONAL_HARM_PATTERN active → no forced connection
  it('TEST 5: relational harm pattern active skips override', async () => {
    const input: K05OverrideInput = {
      responseText: HARM_PATTERN_RESPONSE,
      safetyActive: false,
      relationalHarmActive: true,
      activeModule: 'KBR01',
    };

    const result = await applyK05CrossModuleOverride(input);

    expect(result.overrideApplied).toBe(false);
    expect(result.layer2!.reason).toBe('relational_harm_exception');
    expect(result.correctedText).toBe(HARM_PATTERN_RESPONSE);
    // Harm pattern response must NOT get forced connection
    expect(result.correctedText).not.toContain('Ik wil contact niet verbreken');
  });

  // Test 6: Distance boundary → distance-specific fallback
  it('TEST 6: distance boundary gets distance-specific repair path', async () => {
    const input: K05OverrideInput = {
      responseText: DISTANCE_BOUNDARY_RESPONSE,
      safetyActive: false,
      relationalHarmActive: false,
      activeModule: 'KDL01',
    };

    const result = await applyK05CrossModuleOverride(input);

    expect(result.overrideApplied).toBe(true);
    expect(result.correctionMethod).toBe('deterministic_fallback_distance');
    expect(result.correctedText).toContain(DISTANCE_BOUNDARY_RESPONSE);
    expect(result.correctedText).toContain('niet om te straffen');
    expect(result.correctedText).toContain('rust en respect');
    expect(result.correctedText).toContain('contact opnieuw mogelijk is');

    console.log('\n=== TEST 6: BEFORE ===');
    console.log(DISTANCE_BOUNDARY_RESPONSE);
    console.log('\n=== TEST 6: AFTER ===');
    console.log(result.correctedText);
  });

  // Test 7: Layer 1 detects boundary + repair path → Layer 2 NOT called
  it('TEST 7: Layer 2 is not called when Layer 1 finds both boundary and repair path', async () => {
    const { invokeLLM } = await import('../server/_core/llm');
    const mockInvoke = vi.mocked(invokeLLM);
    mockInvoke.mockClear();

    const input: K05OverrideInput = {
      responseText: BOUNDARY_WITH_REPAIR,
      safetyActive: false,
      relationalHarmActive: false,
      activeModule: 'K01',
    };

    await applyK05CrossModuleOverride(input);

    // invokeLLM should NOT have been called because Layer 1 found repair path
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
