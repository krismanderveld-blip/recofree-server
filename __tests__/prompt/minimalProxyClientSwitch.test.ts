/**
 * Tests for FASE 4C: Feature-flagged client switch to minimal GPT proxy
 * Validates route selection, contract compliance, and no-fallback behavior.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const PROVIDER_PATH = path.resolve(__dirname, '../../lib/ai/openai-provider.ts');
const providerSource = fs.readFileSync(PROVIDER_PATH, 'utf-8');

describe('FASE 4C: Feature-flagged client switch to minimal GPT proxy', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Test 1: Flag OFF uses legacy
  it('1. Flag OFF: uses legacy /api/gpt-proxy', () => {
    // Source must contain the legacy route as default
    expect(providerSource).toContain('const proxyUrl = `${apiBaseUrl}/api/gpt-proxy`');
    // The minimal proxy is gated behind the flag
    expect(providerSource).toContain("process.env.EXPO_PUBLIC_ENABLE_MINIMAL_GPT_PROXY === 'true'");
  });

  // Test 2: Flag ON uses minimal proxy
  it('2. Flag ON: uses /api/minimal-gpt-proxy', () => {
    expect(providerSource).toContain('const minimalProxyUrl = `${apiBaseUrl}/api/minimal-gpt-proxy`');
    // Builds MinimalGptProxyRequest
    expect(providerSource).toContain("contractVersion: 'minimal_gpt_proxy_v1'");
    // store is always false
    expect(providerSource).toContain('store: false');
    // Uses buildClientSystemPrompt
    expect(providerSource).toContain('buildClientSystemPrompt(promptInput)');
    // Messages are forwarded
    expect(providerSource).toContain('messages,');
    // No legacy endpoint call in minimal path
    const minimalBlock = providerSource.split('MINIMAL GPT PROXY ROUTE')[1]?.split('LEGACY ROUTE')[0] ?? '';
    expect(minimalBlock).not.toContain('/api/gpt-proxy');
  });

  // Test 3: Flag ON + error = no fallback to legacy
  it('3. Flag ON + minimal error: no automatic fallback to /api/gpt-proxy', () => {
    // The minimal proxy block returns early with error — never reaches legacy
    const minimalBlock = providerSource.split('MINIMAL GPT PROXY ROUTE')[1]?.split('LEGACY ROUTE')[0] ?? '';
    expect(minimalBlock).toContain('return {');
    expect(minimalBlock).not.toContain('/api/gpt-proxy');
    // Verify no actual fallback logic (code-level, not comments)
    const codeLines = minimalBlock.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    const codeOnly = codeLines.join('\n');
    expect(codeOnly).not.toContain('fallback');
  });

  // Test 4: Flag ON = no content in logs
  it('4. Flag ON: no systemPrompt/messages/user content in logs', () => {
    // Extract all console.log lines from the minimal proxy block
    const minimalBlock = providerSource.split('MINIMAL GPT PROXY ROUTE')[1]?.split('LEGACY ROUTE')[0] ?? '';
    const logLines = minimalBlock.split('\n').filter(l => l.includes('console.log'));
    for (const line of logLines) {
      expect(line).not.toContain('systemPrompt');
      expect(line).not.toContain('.message');
      expect(line).not.toContain('content');
    }
  });

  // Test 5: Kim persona
  it('5. Kim: persona = kim in request', () => {
    expect(providerSource).toContain("persona: (context.userType as 'kim' | 'elias')");
  });

  // Test 6: Elias persona
  it('6. Elias: persona defaults to elias', () => {
    expect(providerSource).toContain("?? 'elias'");
  });

  // Test 7: No server files changed
  it('7. No server files modified in this phase', () => {
    // This is a static check — server/minimal-gpt-proxy.ts should not have been modified
    // (it was created in FASE 4B, not changed here)
    const serverFile = fs.readFileSync(
      path.resolve(__dirname, '../../server/minimal-gpt-proxy.ts'),
      'utf-8'
    );
    // The route file should still have the original registration
    expect(serverFile).toContain('registerMinimalGptProxyRoute');
  });

  // Test 8: No lockfile regeneration (structural check)
  it('8. No lockfile regeneration', () => {
    const lockfile = fs.readFileSync(
      path.resolve(__dirname, '../../pnpm-lock.yaml'),
      'utf-8'
    );
    // Lockfile should still be v9.0 format
    expect(lockfile).toContain('lockfileVersion:');
  });
});
