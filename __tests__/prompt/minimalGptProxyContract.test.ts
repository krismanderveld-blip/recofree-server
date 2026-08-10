import { describe, it, expect } from 'vitest';
import {
  validateMinimalGptProxyRequest,
  type MinimalGptProxyValidationOptions,
} from '../../lib/ai/prompt/minimal-gpt-proxy-contract';

// ─── Test Options ────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: MinimalGptProxyValidationOptions = {
  allowedModels: ['gpt-4o', 'gpt-4o-mini'],
  maxAllowedTokens: 4096,
  minTemperature: 0,
  maxTemperature: 2,
  minTopP: 0,
  maxTopP: 1,
};

// ─── Valid Request Template ──────────────────────────────────────────────────

function makeValidKimRequest() {
  return {
    contractVersion: 'minimal_gpt_proxy_v1',
    requestId: 'req-001',
    persona: 'kim',
    model: 'gpt-4o',
    systemPrompt: 'Je bent Kim, een relatietherapeut.',
    messages: [{ role: 'user', content: 'Hoe gaat het met mij?' }],
    maxTokens: 900,
    temperature: 0.7,
    topP: 0.9,
    store: false,
    metadata: {
      clientBuildVersion: '1.2.63',
      promptBuildVersion: 'client_mirror_v1',
    },
  };
}

function makeValidEliasRequest() {
  return {
    contractVersion: 'minimal_gpt_proxy_v1',
    requestId: 'req-002',
    persona: 'elias',
    model: 'gpt-4o-mini',
    systemPrompt: 'Je bent Elias, een herstelcoach.',
    messages: [{ role: 'user', content: 'Ik heb trek in een drankje.' }],
    maxTokens: 500,
    temperature: 0.6,
    topP: 0.95,
    store: false,
    metadata: {
      clientBuildVersion: '1.2.63',
      promptBuildVersion: 'client_mirror_v1',
      clinicalDebugId: 'debug-123',
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('FASE 4A: Minimal GPT Proxy Contract Validator', () => {

  // Test 1: accepteert geldig Kim request
  it('1. accepts valid Kim request', () => {
    const result = validateMinimalGptProxyRequest(makeValidKimRequest(), DEFAULT_OPTIONS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Test 2: accepteert geldig Elias request
  it('2. accepts valid Elias request', () => {
    const result = validateMinimalGptProxyRequest(makeValidEliasRequest(), DEFAULT_OPTIONS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Test 3: weigert store:true
  it('3. rejects store:true', () => {
    const req = { ...makeValidKimRequest(), store: true };
    const result = validateMinimalGptProxyRequest(req, DEFAULT_OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('store must be exactly false');
  });

  // Test 4: weigert ontbrekende systemPrompt
  it('4. rejects empty systemPrompt', () => {
    const req = { ...makeValidKimRequest(), systemPrompt: '' };
    const result = validateMinimalGptProxyRequest(req, DEFAULT_OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('systemPrompt'))).toBe(true);
  });

  // Test 5: weigert lege messages
  it('5. rejects empty messages array', () => {
    const req = { ...makeValidKimRequest(), messages: [] };
    const result = validateMinimalGptProxyRequest(req, DEFAULT_OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('messages'))).toBe(true);
  });

  // Test 6: weigert onbekende persona
  it('6. rejects unknown persona', () => {
    const req = { ...makeValidKimRequest(), persona: 'unknown' };
    const result = validateMinimalGptProxyRequest(req, DEFAULT_OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('persona'))).toBe(true);
  });

  // Test 7: weigert model buiten allowlist
  it('7. rejects model not in allowlist', () => {
    const req = { ...makeValidKimRequest(), model: 'gpt-3.5-turbo' };
    const result = validateMinimalGptProxyRequest(req, DEFAULT_OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('allowlist'))).toBe(true);
  });

  // Test 8: weigert maxTokens boven limiet
  it('8. rejects maxTokens above limit', () => {
    const req = { ...makeValidKimRequest(), maxTokens: 5000 };
    const result = validateMinimalGptProxyRequest(req, DEFAULT_OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('maxTokens'))).toBe(true);
  });

  // Test 9: weigert temperature buiten limiet
  it('9. rejects temperature outside range', () => {
    const req = { ...makeValidKimRequest(), temperature: 3.0 };
    const result = validateMinimalGptProxyRequest(req, DEFAULT_OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('temperature'))).toBe(true);
  });

  // Test 10: weigert topP buiten limiet
  it('10. rejects topP outside range', () => {
    const req = { ...makeValidKimRequest(), topP: 1.5 };
    const result = validateMinimalGptProxyRequest(req, DEFAULT_OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('topP'))).toBe(true);
  });

  // Test 11: weigert verkeerde contractVersion
  it('11. rejects wrong contractVersion', () => {
    const req = { ...makeValidKimRequest(), contractVersion: 'v2' };
    const result = validateMinimalGptProxyRequest(req, DEFAULT_OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('contractVersion'))).toBe(true);
  });

  // Test 12: weigert message met lege content
  it('12. rejects message with empty content', () => {
    const req = { ...makeValidKimRequest(), messages: [{ role: 'user', content: '' }] };
    const result = validateMinimalGptProxyRequest(req, DEFAULT_OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('content'))).toBe(true);
  });

  // Test 13: weigert ontbrekende metadata
  it('13. rejects missing metadata', () => {
    const req = { ...makeValidKimRequest() } as Record<string, unknown>;
    delete req.metadata;
    const result = validateMinimalGptProxyRequest(req, DEFAULT_OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('metadata'))).toBe(true);
  });

  // Test 14: weigert lege clientBuildVersion
  it('14. rejects empty clientBuildVersion', () => {
    const req = {
      ...makeValidKimRequest(),
      metadata: { clientBuildVersion: '', promptBuildVersion: 'v1' },
    };
    const result = validateMinimalGptProxyRequest(req, DEFAULT_OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('clientBuildVersion'))).toBe(true);
  });

  // Test 15: weigert lege promptBuildVersion
  it('15. rejects empty promptBuildVersion', () => {
    const req = {
      ...makeValidKimRequest(),
      metadata: { clientBuildVersion: '1.0', promptBuildVersion: '' },
    };
    const result = validateMinimalGptProxyRequest(req, DEFAULT_OPTIONS);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('promptBuildVersion'))).toBe(true);
  });

  // Test 16: validator doet geen mutation van request object
  it('16. validator does not mutate the request object', () => {
    const req = makeValidKimRequest();
    const frozen = JSON.stringify(req);
    validateMinimalGptProxyRequest(req, DEFAULT_OPTIONS);
    expect(JSON.stringify(req)).toBe(frozen);
  });
});
