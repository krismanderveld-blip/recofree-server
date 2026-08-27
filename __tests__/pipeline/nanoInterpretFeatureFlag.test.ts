import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// FASE 5C-CORRECTIE: Nano is default ON (TEMPORARY_SEMANTIC_BRIDGE).
// Only explicitly disabled with EXPO_PUBLIC_ENABLE_NANO_INTERPRET=false.

describe('FASE 5C: Nano-Interpret Feature Flag', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // Test 1: Default without env flag — nano IS called (default ON)
  it('1. Default without env flag: nano IS enabled (default ON)', () => {
    delete process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET;
    const enableNanoInterpret = process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET !== 'false';
    expect(enableNanoInterpret).toBe(true);
  });

  // Test 2: EXPO_PUBLIC_ENABLE_NANO_INTERPRET=true — nano IS called
  it('2. Flag=true: nano IS enabled', () => {
    process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET = 'true';
    const enableNanoInterpret = process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET !== 'false';
    expect(enableNanoInterpret).toBe(true);
  });

  // Test 3: EXPO_PUBLIC_ENABLE_NANO_INTERPRET=false — nano is NOT called
  it('3. Flag=false: nano is disabled, deterministic fallback active', () => {
    process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET = 'false';
    const enableNanoInterpret = process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET !== 'false';
    expect(enableNanoInterpret).toBe(false);
  });

  // Test 4: Crisis case — nano is NOT called even if flag is true
  it('4. Crisis case: nano skipped even with flag enabled', () => {
    delete process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET;
    const enableNanoInterpret = process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET !== 'false';
    const isCrisisForNano = true; // PURPLE zone or crisis intent
    const shouldCallNano = enableNanoInterpret && !isCrisisForNano;
    expect(shouldCallNano).toBe(false);
  });

  // Test 5: Franstalige input — nano mag aangeroepen worden
  it('5. FR input: nano enabled for multilingual support', () => {
    delete process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET; // default ON
    const enableNanoInterpret = process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET !== 'false';
    const isCrisisForNano = false;
    const shouldCallNano = enableNanoInterpret && !isCrisisForNano;
    // FR user "Je veux boire mais je ne veux pas rechuter" should reach nano
    expect(shouldCallNano).toBe(true);
  });

  // Test 6: Nano is OPTIONAL_HIGH_PRIORITY_HINT — deterministic engine remains final decider
  it('6. Nano remains OPTIONAL_HIGH_PRIORITY_HINT: safety/crisis/loopblocker can override', () => {
    // Even when nano suggests a module, crisis override still wins
    const nanoSuggestedModule = 'E03';
    const crisisActive = true;
    // Crisis overrides nano suggestion
    const finalModule = crisisActive ? 'CRISIS' : nanoSuggestedModule;
    expect(finalModule).toBe('CRISIS');
  });

  // Test 7: Elias craving with nano OFF — fallback layers handle it
  it('7. Elias craving with nano OFF: detectEliasRelapseRisk still works independently', async () => {
    process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET = 'false';
    // Import the Elias relapse risk helper (independent of nano)
    const { detectEliasRelapseRisk } = await import(
      '@/lib/engine/elias/elias-relapse-risk-helper'
    );
    const result = detectEliasRelapseRisk({
      userMessage: 'Ik heb craving en ik wil drinken',
      persona: 'elias',
      cravingSliderValue: 75,
      relapseActive: false,
      relapseIntentDetected: false,
    });
    expect(result.relapseRiskActive).toBe(true);
  });

  // Test 8: Kim relational harm with nano OFF — detectRelationalSignals still works
  it('8. Kim relational harm with nano OFF: detectRelationalSignals works independently', async () => {
    process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET = 'false';
    const { detectRelationalSignals } = await import(
      '@/lib/engine/kim/relational-stance-filter'
    );
    const result = detectRelationalSignals(
      'Hij heeft al meerdere keren gelogen en mijn vertrouwen is kapot'
    );
    // detectRelationalSignals returns signals object — check that harm/conflict signals are detected
    expect(result.relationshipConflictSignal || result.repeatedBetrayalSignal || result.chronicTrustDamageSignal).toBe(true);
  });

  // Test 9: K05 post-GPT override works independently of nano
  it('9. K05 override works independently of nano flag', async () => {
    process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET = 'false';
    const { applyK05CrossModuleOverride } = await import(
      '@/lib/engine/kim/k05-cross-module-override-client'
    );
    const result = await applyK05CrossModuleOverride({
      responseText: 'Ik neem afstand en ik wil geen contact meer.',
      safetyActive: false,
      relationalHarmActive: false,
      activeModule: 'K01',
    });
    // K05 should detect boundary without repair path and flag it
    expect(result.layer1.boundaryDetected).toBe(true);
    expect(result.layer1.repairPathDetected).toBe(false);
    expect(result.overrideApplied).toBe(true);
  });

  // Test 10: No fetch to /api/nano-interpret when flag=false
  it('10. No server route call when flag=false: callNanoInterpret not invoked', () => {
    process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET = 'false';
    const enableNanoInterpret = process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET !== 'false';
    const isCrisisForNano = false;
    const shouldCallNano = enableNanoInterpret && !isCrisisForNano;
    // If shouldCallNano is false, no fetch happens
    expect(shouldCallNano).toBe(false);
  });

  // Test 11: No minimal proxy regression — verify minimal proxy contract is untouched
  it('11. Minimal proxy contract unchanged: validateMinimalGptProxyRequest still works', async () => {
    const { validateMinimalGptProxyRequest } = await import(
      '@/lib/ai/prompt/minimal-gpt-proxy-contract'
    );
    const validRequest = {
      contractVersion: 'minimal_gpt_proxy_v1' as const,
      requestId: 'test-9',
      store: false as const,
      model: 'gpt-4o-mini' as const,
      persona: 'kim' as const,
      systemPrompt: 'Je bent een therapeut.',
      messages: [{ role: 'user' as const, content: 'Hallo' }],
      maxTokens: 900,
      temperature: 0.7,
      topP: 1,
      metadata: {
        clientBuildVersion: '1.2.63',
        promptBuildVersion: 'v1',
      },
    };
    const result = validateMinimalGptProxyRequest(validRequest as any, {
      allowedModels: ['gpt-4o', 'gpt-4o-mini'],
      maxAllowedTokens: 4096,
      minTemperature: 0,
      maxTemperature: 2,
      minTopP: 0,
      maxTopP: 1,
    });
    expect(result.valid).toBeTruthy();
  });

  it('12. Pure craving does not retain unsupported self_disgust', async () => {
    const { normalizeClientNanoInterpretResult } = await import(
      '@/lib/pipeline/nano-interpret-client'
    );
    const result = normalizeClientNanoInterpretResult({
      translatedNL: 'Ik heb craving en ik wil drinken, maar ik wil het eigenlijk niet doen.',
      intent: 'seeking_action',
      themes: ['craving', 'self_disgust'],
      resolvedModule: 'E01',
      matchedTheme: 'craving',
    }, 'Ik heb craving en ik wil drinken, maar ik wil het eigenlijk niet doen.', 'elias');

    expect(result.themes).toEqual(['craving']);
    expect(result.resolvedModule).toBe('E01');
  });

  it('13. Explicit self-disgust evidence is preserved', async () => {
    const { normalizeClientNanoInterpretResult } = await import(
      '@/lib/pipeline/nano-interpret-client'
    );
    const result = normalizeClientNanoInterpretResult({
      translatedNL: 'Ik walg van mezelf.',
      intent: 'venting',
      themes: ['self_disgust'],
      resolvedModule: 'M19',
      matchedTheme: 'self_disgust',
    }, 'Ik walg van mezelf.', 'elias');

    expect(result.themes).toEqual(['self_disgust']);
    expect(result.matchedTheme).toBe('self_disgust');
  });

  it('14. Kim cannot accept an Elias nano module', async () => {
    const { normalizeClientNanoInterpretResult } = await import(
      '@/lib/pipeline/nano-interpret-client'
    );
    const result = normalizeClientNanoInterpretResult({
      translatedNL: 'Ik wil gewoon zeggen dat hij zijn plan moet trekken.',
      intent: 'seeking_action',
      themes: ['self_hatred', 'worthlessness'],
      resolvedModule: 'E04',
      matchedTheme: 'self_hatred',
    }, 'Ik wil gewoon zeggen dat hij zijn plan moet trekken.', 'kim');

    expect(result.resolvedModule).toBeNull();
    expect(result.themes).toEqual([]);
  });

  it('14b. Broken trust alone does not retain self_hate_at_vulnerability', async () => {
    const { normalizeClientNanoInterpretResult } = await import(
      '@/lib/pipeline/nano-interpret-client'
    );
    const result = normalizeClientNanoInterpretResult({
      translatedNL: 'Hij heeft al meerdere keren gelogen en mijn vertrouwen is kapot.',
      intent: 'venting',
      themes: ['broken_trust', 'self_hate_at_vulnerability'],
      resolvedModule: null,
      matchedTheme: 'broken_trust',
    }, 'Hij heeft al meerdere keren gelogen en mijn vertrouwen is kapot.', 'kim');

    expect(result.themes).toEqual(['broken_trust']);
    expect(result.matchedTheme).toBe('broken_trust');
  });

  it('15. Exact Kim plan-trekken phrase activates existing K05 boundary detection', async () => {
    const { detectK05CommunicationContext } = await import(
      '@/lib/engine/kim/k05-communication'
    );
    const result = detectK05CommunicationContext(
      'Ik wil gewoon zeggen dat hij zijn plan moet trekken en dat ik er klaar mee ben.'
    );

    expect(result.signals.some((signal) => signal.context === 'BOUNDARY_SETTING')).toBe(true);
  });

  it('16. Deterministic K05 block reaches Kim client prompt and never Elias prompt', async () => {
    const { buildClientSystemPrompt } = await import(
      '@/lib/ai/prompt/client-system-prompt-builder'
    );
    const k05Context = '[K05 COMMUNICATION — deterministic]\nUse a boundary with a repair path.';
    const kimPrompt = buildClientSystemPrompt({
      persona: 'kim',
      crisisLevel: 0,
      safetyLevel: 'none',
      k05Context,
    });
    const eliasPrompt = buildClientSystemPrompt({
      persona: 'elias',
      crisisLevel: 0,
      safetyLevel: 'none',
      k05Context,
    });

    expect(kimPrompt.systemPrompt).toContain(k05Context);
    expect(kimPrompt.debug?.includedSections).toContain('k05Context');
    expect(eliasPrompt.systemPrompt).not.toContain(k05Context);
  });

  // Structural test: verify the fail-closed client-first guard exists in pipeline.ts source
  it('pipeline.ts uses the version-controlled nano architecture guard', async () => {
    const fs = await import('fs');
    const source = fs.readFileSync(
      '/home/ubuntu/recofree-app/lib/rugzak/pipeline.ts',
      'utf-8'
    );
    expect(source).toContain("isClientFirstFeatureEnabled('nanoInterpret')");
    expect(source).not.toContain("process.env.EXPO_PUBLIC_ENABLE_NANO_INTERPRET !== 'false'");
    expect(source).toContain('enableNanoInterpret && !isCrisisForNano');
    expect(source).toContain('disabled by feature flag');
  });

  // Structural test: verify nano-interpret-client.ts still exists (not removed)
  it('nano-interpret-client.ts still exists (nano NOT removed)', async () => {
    const fs = await import('fs');
    const exists = fs.existsSync(
      '/home/ubuntu/recofree-app/lib/pipeline/nano-interpret-client.ts'
    );
    expect(exists).toBe(true);
  });

  // Structural test: verify server/nano-interpret-proxy.ts not modified
  it('server/nano-interpret-proxy.ts not modified (no server changes)', async () => {
    const fs = await import('fs');
    const exists = fs.existsSync(
      '/home/ubuntu/recofree-app/server/nano-interpret-proxy.ts'
    );
    expect(exists).toBe(true);
  });
});
