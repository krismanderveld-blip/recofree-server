import { describe, expect, it } from 'vitest';

import {
  buildMedicalSafetyFailureResponse,
  isExplicitColdTurkeySafetyQuestion,
} from '@/lib/ai/medical-safety-fallback';
import {
  MINIMAL_GPT_PROXY_ALLOWED_MODELS,
  validateMinimalGptProxyRequest,
} from '@/lib/ai/prompt/minimal-gpt-proxy-contract';
import { buildCoreEpistemicReasoning } from '@/lib/engine/shared/epistemic-reasoning';
import { resolveEpistemicModelRouting } from '@/lib/engine/shared/epistemic-reasoning/epistemic-model-routing';

const DEVICE_MESSAGE = 'Kan ik plots stoppen met zwaar drinken zonder dokter?';

describe('P0 cold-turkey Railway minimal-proxy regression', () => {
  it('detects the exact Dutch device question as an explicit abrupt-stopping safety question', () => {
    expect(isExplicitColdTurkeySafetyQuestion(DEVICE_MESSAGE)).toBe(true);
  });

  it('does not infer a cold-turkey state from symptoms alone', () => {
    expect(isExplicitColdTurkeySafetyQuestion('Ik voel me moe en gespannen vandaag.')).toBe(false);
  });

  it('marks the exact device question medical, safety-relevant and full-tier in the core engine', () => {
    const output = buildCoreEpistemicReasoning({
      persona: 'elias',
      userMessage: DEVICE_MESSAGE,
      normalizedMessage: DEVICE_MESSAGE,
      currentZone: 'YELLOW',
      nowLocal: '2026-08-25T09:00:00+02:00',
    });

    expect(output.modelRoutingHints.medicalUncertainty).toBe(true);
    expect(output.modelRoutingHints.safetyRelevant).toBe(true);
    expect(output.modelRoutingHints.recommendedModelTier).toBe('full');
  });

  it('hard-routes every safety-relevant question to the full model', () => {
    const result = resolveEpistemicModelRouting({
      persona: 'elias',
      currentZone: 'YELLOW',
      riskScore: 22,
      crisisLevel: 0,
      medicalUncertainty: true,
      safetyRelevant: true,
    });

    expect(result.modelTier).toBe('full');
    expect(result.selectedModel).toBe('gpt-4o-2024-08-06');
    expect(result.mustUseFullModel).toBe(true);
    expect(result.reasonCodes).toContain('safety_relevant');
    expect(result.reasonCodes).toContain('medical_uncertainty');
  });

  it('keeps the provider-selected versioned full model in the shared proxy allowlist', () => {
    expect(MINIMAL_GPT_PROXY_ALLOWED_MODELS).toContain('gpt-4o-2024-08-06');
  });

  it('accepts the exact versioned full-model contract that previously returned Railway 400', () => {
    const validation = validateMinimalGptProxyRequest({
      contractVersion: 'minimal_gpt_proxy_v1',
      requestId: 'p0-cold-turkey-test',
      persona: 'elias',
      model: 'gpt-4o-2024-08-06',
      systemPrompt: 'Safety-focused test prompt.',
      messages: [{ role: 'user', content: DEVICE_MESSAGE }],
      maxTokens: 2000,
      temperature: 0.4,
      topP: 1,
      store: false,
      metadata: {
        clientBuildVersion: 'test',
        promptBuildVersion: 'test',
      },
    }, {
      allowedModels: [...MINIMAL_GPT_PROXY_ALLOWED_MODELS],
      maxAllowedTokens: 4000,
      minTemperature: 0,
      maxTemperature: 1,
      minTopP: 0,
      maxTopP: 1,
    });

    expect(validation).toEqual({ valid: true, errors: [] });
  });

  it('returns a Dutch medical safety response instead of debug text when the GPT call fails', () => {
    const response = buildMedicalSafetyFailureResponse({
      message: DEVICE_MESSAGE,
      locale: 'nl',
      medicalUncertainty: true,
      safetyRelevant: true,
    });

    expect(response).toContain('kan gevaarlijk zijn');
    expect(response).toContain('arts');
    expect(response).not.toContain('[DEBUG]');
  });

  it('supports the configured English and French user languages', () => {
    const english = buildMedicalSafetyFailureResponse({
      message: 'Can I suddenly stop heavy drinking without a doctor?',
      locale: 'en',
      medicalUncertainty: true,
      safetyRelevant: true,
    });
    const french = buildMedicalSafetyFailureResponse({
      message: "Puis-je arrêter brutalement l'alcool sans médecin ?",
      locale: 'fr',
      medicalUncertainty: true,
      safetyRelevant: true,
    });

    expect(english).toContain('can be dangerous');
    expect(french).toContain('peut être dangereux');
  });

  it('does not replace unrelated technical failures with a medical message', () => {
    const response = buildMedicalSafetyFailureResponse({
      message: 'Waarom werkt de export niet?',
      locale: 'nl',
      medicalUncertainty: false,
      safetyRelevant: false,
    });

    expect(response).toBeNull();
  });
});
