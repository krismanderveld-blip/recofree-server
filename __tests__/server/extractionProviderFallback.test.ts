import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ENV before importing
const mockEnv = {
  forgeApiKey: '',
  forgeApiUrl: '',
  openaiApiKey: '',
  appId: '',
  cookieSecret: '',
  databaseUrl: '',
  oAuthServerUrl: '',
  ownerOpenId: '',
  isProduction: false,
};

vi.mock('@/server/_core/env', () => ({
  ENV: mockEnv,
}));

describe('Extraction Provider — Railway direct OpenAI only', () => {
  beforeEach(() => {
    mockEnv.forgeApiKey = '';
    mockEnv.forgeApiUrl = '';
    mockEnv.openaiApiKey = '';
  });

  it('1. Forge key without OpenAI key is ignored', async () => {
    mockEnv.forgeApiKey = 'forge-test-key-123';
    mockEnv.forgeApiUrl = 'https://forge.example.com';
    const { resolveProvider } = await import('@/server/_core/llm');
    const result = resolveProvider();
    expect(result.provider).toBe('none');
    expect(result.apiUrl).toBe('');
    expect(result.apiKey).toBe('');
  });

  it('2. OPENAI_API_KEY present → uses direct OpenAI', async () => {
    mockEnv.forgeApiKey = '';
    mockEnv.openaiApiKey = 'sk-test-openai-key';
    const { resolveProvider } = await import('@/server/_core/llm');
    const result = resolveProvider();
    expect(result.provider).toBe('openai');
    expect(result.apiUrl).toBe('https://api.openai.com/v1/chat/completions');
    expect(result.apiKey).toBe('sk-test-openai-key');
  });

  it('3. OpenAI missing → structured failure, provider=none', async () => {
    mockEnv.forgeApiKey = '';
    mockEnv.openaiApiKey = '';
    const { resolveProvider } = await import('@/server/_core/llm');
    const result = resolveProvider();
    expect(result.provider).toBe('none');
    expect(result.apiUrl).toBe('');
    expect(result.apiKey).toBe('');
  });

  it('4. assertApiKey throws structured error when no provider', async () => {
    mockEnv.forgeApiKey = '';
    mockEnv.openaiApiKey = '';
    // Re-import to get fresh module
    const llm = await import('@/server/_core/llm');
    await expect(llm.invokeLLM({ messages: [] })).rejects.toThrow('LLM_PROVIDER_MISSING');
  });

  it('5. Forge key with whitespace does not affect OpenAI', async () => {
    mockEnv.forgeApiKey = '   ';
    mockEnv.openaiApiKey = 'sk-real-key';
    const { resolveProvider } = await import('@/server/_core/llm');
    const result = resolveProvider();
    expect(result.provider).toBe('openai');
  });

  it('6. Both keys present → still uses OpenAI', async () => {
    mockEnv.forgeApiKey = 'forge-key';
    mockEnv.forgeApiUrl = 'https://forge.test.com';
    mockEnv.openaiApiKey = 'sk-openai-key';
    const { resolveProvider } = await import('@/server/_core/llm');
    const result = resolveProvider();
    expect(result.provider).toBe('openai');
    expect(result.apiUrl).toBe('https://api.openai.com/v1/chat/completions');
    expect(result.apiKey).toBe('sk-openai-key');
  });

  it('7. OpenAI fallback URL is always api.openai.com', async () => {
    mockEnv.forgeApiKey = '';
    mockEnv.openaiApiKey = 'sk-key';
    const { resolveProvider } = await import('@/server/_core/llm');
    const result = resolveProvider();
    expect(result.apiUrl).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('8. ExtractionDebugStatus type has required fields', async () => {
    const { resolveProvider } = await import('@/server/_core/llm');
    const result = resolveProvider();
    // Type check: provider is one of the expected values
    expect(['openai', 'none']).toContain(result.provider);
    expect(typeof result.apiUrl).toBe('string');
    expect(typeof result.apiKey).toBe('string');
  });
});
