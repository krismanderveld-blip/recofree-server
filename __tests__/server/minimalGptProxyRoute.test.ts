/**
 * Tests for POST /api/minimal-gpt-proxy route
 * Validates contract compliance without requiring actual OpenAI calls.
 */
import { describe, it, expect } from 'vitest';
import { validateMinimalGptProxyRequest } from '../../lib/ai/prompt/minimal-gpt-proxy-contract';
import * as fs from 'fs';
import * as path from 'path';

const VALIDATION_OPTIONS = {
  allowedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
  maxAllowedTokens: 4000,
  minTemperature: 0,
  maxTemperature: 1,
  minTopP: 0,
  maxTopP: 1,
};

function makeValidRequest(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 'minimal_gpt_proxy_v1',
    requestId: 'test-123',
    persona: 'kim',
    model: 'gpt-4o',
    systemPrompt: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hello' }],
    maxTokens: 900,
    temperature: 0.4,
    topP: 1,
    store: false,
    metadata: {
      clientBuildVersion: '1.2.63',
      promptBuildVersion: '3a-mirror',
    },
    ...overrides,
  };
}

describe('POST /api/minimal-gpt-proxy — contract validation', () => {
  it('1. route file registers POST /api/minimal-gpt-proxy', () => {
    const routeFile = fs.readFileSync(
      path.resolve(__dirname, '../../server/minimal-gpt-proxy.ts'),
      'utf-8'
    );
    expect(routeFile).toContain('app.post("/api/minimal-gpt-proxy"');
    expect(routeFile).toContain('registerMinimalGptProxyRoute');
  });

  it('2. invalid store:true is rejected', () => {
    const result = validateMinimalGptProxyRequest(
      makeValidRequest({ store: true }),
      VALIDATION_OPTIONS
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('store'))).toBe(true);
  });

  it('3. empty systemPrompt is rejected', () => {
    const result = validateMinimalGptProxyRequest(
      makeValidRequest({ systemPrompt: '' }),
      VALIDATION_OPTIONS
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('systemPrompt'))).toBe(true);
  });

  it('4. unknown model is rejected', () => {
    const result = validateMinimalGptProxyRequest(
      makeValidRequest({ model: 'gemini-2.5-flash' }),
      VALIDATION_OPTIONS
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('model'))).toBe(true);
  });

  it('5. OpenAI payload contains store:false (static analysis)', () => {
    const routeFile = fs.readFileSync(
      path.resolve(__dirname, '../../server/minimal-gpt-proxy.ts'),
      'utf-8'
    );
    // The payload object must contain store: false
    expect(routeFile).toContain('store: false');
  });

  it('6. OpenAI payload uses client systemPrompt as system message', () => {
    const routeFile = fs.readFileSync(
      path.resolve(__dirname, '../../server/minimal-gpt-proxy.ts'),
      'utf-8'
    );
    expect(routeFile).toContain('{ role: "system", content: request.systemPrompt }');
  });

  it('7. route does NOT call buildSystemPrompt', () => {
    const routeFile = fs.readFileSync(
      path.resolve(__dirname, '../../server/minimal-gpt-proxy.ts'),
      'utf-8'
    );
    const codeLines = routeFile.split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
    const codeOnly = codeLines.join('\n');
    expect(codeOnly).not.toContain('buildSystemPrompt');
  });

  it('8. route does NOT call invokeLLM', () => {
    const routeFile = fs.readFileSync(
      path.resolve(__dirname, '../../server/minimal-gpt-proxy.ts'),
      'utf-8'
    );
    // Check that invokeLLM is not imported or called (ignore comments)
    const codeLines = routeFile.split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
    const codeOnly = codeLines.join('\n');
    expect(codeOnly).not.toContain('invokeLLM');
  });

  it('9. route does NOT use session cache', () => {
    const routeFile = fs.readFileSync(
      path.resolve(__dirname, '../../server/minimal-gpt-proxy.ts'),
      'utf-8'
    );
    const codeLines = routeFile.split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
    const codeOnly = codeLines.join('\n');
    expect(codeOnly).not.toContain('getSessionCache');
    expect(codeOnly).not.toContain('sessionCache');
  });

  it('10. route does NOT log prompt/message content', () => {
    const routeFile = fs.readFileSync(
      path.resolve(__dirname, '../../server/minimal-gpt-proxy.ts'),
      'utf-8'
    );
    // All console.log calls should only contain requestId, status, error, model, tokens, responseLength
    const logLines = routeFile.split('\n').filter(l => l.includes('console.log'));
    for (const line of logLines) {
      expect(line).not.toContain('systemPrompt');
      expect(line).not.toContain('messages');
      expect(line).not.toContain('content');
      expect(line).not.toContain('persona');
    }
  });
});
