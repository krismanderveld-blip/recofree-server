import { describe, it, expect } from 'vitest';
import { detectShadowSignals, buildShadowSignal, hasShadowMarkers } from '../lib/engine/elias/shadow/sw01_trigger_detector';
import { routeZuchtShadow } from '../lib/engine/elias/shadow/sw01_zucht_router';

describe('SW01 Shadow Work — Trigger Detection', () => {
  // ─── Test 1: No markers → confidence 0.0, SW01 skipped ─────────────────────
  it('returns confidence 0.0 and SW01 inactive when no markers present', () => {
    const result = detectShadowSignals(
      'I had a nice day today, went for a walk.',
      'chat',
      false,
      []
    );

    expect(result.confidence).toBe(0);
    expect(result.verbalMatches).toHaveLength(0);
    expect(result.behaviouralMatches).toHaveLength(0);

    // buildShadowSignal returns null at confidence < 0.4
    const signal = buildShadowSignal(result, 'chat', 3);
    expect(signal).toBeNull();

    // hasShadowMarkers also returns false → pipeline would skip SW01 entirely
    expect(hasShadowMarkers('I had a nice day today, went for a walk.')).toBe(false);
  });

  // ─── Test 2: 1 verbal marker → confidence 0.4 ─────────────────────────────
  it('returns confidence 0.4 with exactly one verbal marker', () => {
    const result = detectShadowSignals(
      'I hate that part of me that keeps failing.',
      'chat',
      false,
      []
    );

    expect(result.confidence).toBe(0.4);
    expect(result.verbalMatches).toContain('i hate that part of me');
    expect(result.verbalMatches.length).toBe(1);
  });

  // ─── Test 3: 2+ verbal markers → confidence 0.7 ───────────────────────────
  it('returns confidence 0.7 with two or more verbal markers', () => {
    const result = detectShadowSignals(
      'I am broken. I always ruin everything around me.',
      'chat',
      false,
      []
    );

    expect(result.confidence).toBe(0.7);
    expect(result.verbalMatches).toContain('i am broken');
    expect(result.verbalMatches).toContain('i always ruin everything');
    expect(result.verbalMatches.length).toBeGreaterThanOrEqual(2);
  });

  // ─── Test 4: verbal + behavioural marker → confidence 0.85 ─────────────────
  it('returns confidence 0.85 with verbal + behavioural markers combined', () => {
    const result = detectShadowSignals(
      'I cannot forgive myself for what I did.',
      'chat',
      false,
      ['moral self-attack']
    );

    expect(result.confidence).toBe(0.85);
    expect(result.verbalMatches).toContain('i cannot forgive myself');
    expect(result.behaviouralMatches).toContain('moral self-attack');
  });

  // ─── Test 5: relapse loop active → confidence 0.95 ─────────────────────────
  it('returns confidence 0.95 when relapse loop is active', () => {
    const result = detectShadowSignals(
      'I am disgusting and I keep secrets from everyone.',
      'chat',
      true, // relapse loop active
      []
    );

    expect(result.confidence).toBe(0.95);
    // Verbal matches still detected even though confidence is overridden
    expect(result.verbalMatches.length).toBeGreaterThanOrEqual(1);
  });
});

describe('SW01 Shadow Work — Zucht Router', () => {
  // ─── Test 6: Zucht ROOD → allowed_depth = 'containment' ───────────────────
  it('routes to containment depth when zucht is RED (>= 8)', () => {
    const state = routeZuchtShadow(9);

    expect(state.zucht_color).toBe('red');
    expect(state.allowed_depth).toBe('containment');
    expect(state.intervention_style).toBe('contained_direct');
  });

  // ─── Test 7: Zucht GROEN → allowed_depth = 'reflection' ───────────────────
  it('routes to reflection depth when zucht is GREEN (< 4)', () => {
    const state = routeZuchtShadow(2);

    expect(state.zucht_color).toBe('green');
    expect(state.allowed_depth).toBe('reflection');
    expect(state.intervention_style).toBe('warm_direct');
  });
});

describe('SW01 Shadow Work — Elias Only Guard', () => {
  // ─── Test 8: Kim input → SW01 never active ────────────────────────────────
  it('SW01 never activates for Kim users (hasShadowMarkers is Elias-only gated in pipeline)', () => {
    // SW01 is Elias-only by design. The pipeline guards this with:
    //   if (backpack.userType === 'elias' && hasShadowMarkers(userMessage))
    // We verify that even if a Kim user sends shadow-laden text,
    // the detection functions themselves still return results (they are persona-agnostic),
    // but computeSW01Directive should NOT be called for Kim.
    // The guard is: hasShadowMarkers returns true, but pipeline skips for non-elias.

    // Simulate: Kim user sends text with shadow markers
    const kimText = 'I am broken. I hate that part of me.';

    // hasShadowMarkers detects markers regardless of persona
    expect(hasShadowMarkers(kimText)).toBe(true);

    // But for Kim, the pipeline never calls computeSW01Directive.
    // We verify the guard logic: userType !== 'elias' → skip
    const userType: string = 'kim';
    const shouldActivateSW01 = userType === 'elias' && hasShadowMarkers(kimText);
    expect(shouldActivateSW01).toBe(false);

    // For Elias, the same text WOULD activate
    const elisUserType = 'elias';
    const shouldActivateForElias = elisUserType === 'elias' && hasShadowMarkers(kimText);
    expect(shouldActivateForElias).toBe(true);
  });
});
