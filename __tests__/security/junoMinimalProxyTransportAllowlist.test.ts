import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  MINIMAL_GPT_PROXY_ALLOWED_MODELS,
  MINIMAL_GPT_PROXY_ALLOWED_PERSONAS,
  validateMinimalGptProxyRequest,
  type MinimalGptPersona,
  type MinimalGptProxyRequest,
  type MinimalGptProxyValidationOptions,
} from '@/lib/ai/prompt/minimal-gpt-proxy-contract';

const options: MinimalGptProxyValidationOptions = {
  allowedModels: [...MINIMAL_GPT_PROXY_ALLOWED_MODELS],
  allowedPersonas: [...MINIMAL_GPT_PROXY_ALLOWED_PERSONAS],
  maxAllowedTokens: 4000,
  minTemperature: 0,
  maxTemperature: 1,
  minTopP: 0,
  maxTopP: 1,
};

function requestFor(persona: MinimalGptPersona): MinimalGptProxyRequest {
  return {
    contractVersion: 'minimal_gpt_proxy_v1',
    requestId: `transport-${persona}`,
    persona,
    model: 'gpt-4o-mini',
    systemPrompt: 'Client-built test prompt.',
    messages: [{ role: 'user', content: 'Transport test.' }],
    maxTokens: 100,
    temperature: 0.2,
    topP: 1,
    store: false,
    metadata: {
      clientBuildVersion: 'test',
      promptBuildVersion: 'transport_allowlist_test_v1',
    },
  };
}

describe('Juno minimal-proxy transport allowlist exception', () => {
  it.each(['elias', 'kim', 'juno'] as const)('%s remains a valid transport persona', (persona) => {
    expect(validateMinimalGptProxyRequest(requestFor(persona), options)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('passes juno through as juno without Elias/Kim mapping', () => {
    const request = requestFor('juno');
    expect(request.persona).toBe('juno');
    expect(JSON.parse(JSON.stringify(request)).persona).toBe('juno');
  });

  it('rejects an unknown persona', () => {
    const invalid = { ...requestFor('juno'), persona: 'unknown' };
    const result = validateMinimalGptProxyRequest(invalid, options);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('persona must be one of: elias, kim, juno');
  });

  it('still requires store:false for every persona', () => {
    const invalid = { ...requestFor('juno'), store: true };
    const result = validateMinimalGptProxyRequest(invalid, options);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('store must be exactly false');
  });

  it('keeps the Railway implementation stateless and free of persona routing or clinical logic', () => {
    const serverSource = fs.readFileSync(
      path.join(process.cwd(), 'server/minimal-gpt-proxy.ts'),
      'utf8',
    );
    const executableSource = serverSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    expect(serverSource).toContain('allowedPersonas: [...MINIMAL_GPT_PROXY_ALLOWED_PERSONAS]');
    expect(serverSource).toContain('store: false');
    expect(executableSource).not.toMatch(/juno\s*(?:=>|:)\s*(?:['"]elias|['"]kim)/i);
    expect(executableSource).not.toMatch(/persona\s*===\s*['"]juno['"]/i);
    expect(executableSource).not.toMatch(
      /\b(?:buildSystemPrompt|ClinicalCtx|SessionMemoryCache|UserDat|Backpack)\b/,
    );
  });
});
