import { afterAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const previousApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

// Reproduce the exact failing build condition from the device: the build
// environment injects a Manus deployment URL before oauth.ts is imported.
process.env.EXPO_PUBLIC_API_BASE_URL = 'https://recobase-vhsxu5ua.manus.space';

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

import {
  API_BASE_URL,
  getApiBaseUrl,
  PRODUCTION_API_URL,
  resolveApiBaseUrl,
} from '@/constants/oauth';

afterAll(() => {
  if (previousApiBaseUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  } else {
    process.env.EXPO_PUBLIC_API_BASE_URL = previousApiBaseUrl;
  }
});

describe('P0 Railway-only native API routing guard', () => {
  it('has the corrected Railway build variable', () => {
    expect(API_BASE_URL).toBe(PRODUCTION_API_URL);
  });

  it('ignores a simulated Manus deployment override on Android', () => {
    expect(resolveApiBaseUrl({
      platform: 'android',
      apiBaseUrl: 'https://recobase-vhsxu5ua.manus.space',
    })).toBe(PRODUCTION_API_URL);
  });

  it('ignores a simulated Manus sandbox override on iOS', () => {
    expect(resolveApiBaseUrl({
      platform: 'ios',
      apiBaseUrl: 'https://3000-sandbox.us2.manus.computer',
    })).toBe(PRODUCTION_API_URL);
  });

  it('ignores a Manus deployment override on hosted web', () => {
    expect(resolveApiBaseUrl({
      platform: 'web',
      apiBaseUrl: 'https://recobase-vhsxu5ua.manus.space',
      webLocation: {
        protocol: 'https:',
        hostname: '8081-preview.us2.manus.computer',
      },
    })).toBe(PRODUCTION_API_URL);
  });

  it('never returns a Manus production or sandbox domain on native', () => {
    expect(getApiBaseUrl()).not.toMatch(/manus\.(space|computer|com|im|ai)/i);
  });

  it('builds the minimal-proxy endpoint on Railway', () => {
    expect(`${getApiBaseUrl()}/api/minimal-gpt-proxy`).toBe(
      'https://railwayappdashboard-production.up.railway.app/api/minimal-gpt-proxy',
    );
  });

  it('reaches the Railway health endpoint selected by the production URL', async () => {
    const response = await fetch(`${PRODUCTION_API_URL}/api/health`);
    expect(response.ok).toBe(true);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true });
  }, 15_000);

  it('keeps the native guard before any API_BASE_URL return branch', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'constants/oauth.ts'),
      'utf8',
    );
    const nativeGuard = source.indexOf('if (platform !== "web")');
    const injectedUrlBranch = source.indexOf('if (apiBaseUrl && apiBaseUrl.startsWith("http"))');

    expect(nativeGuard).toBeGreaterThan(-1);
    expect(injectedUrlBranch).toBeGreaterThan(-1);
    expect(nativeGuard).toBeLessThan(injectedUrlBranch);
  });

  it('keeps the active extraction LLM direct-OpenAI-only', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'server/_core/llm.ts'),
      'utf8',
    );
    const providerSection = source.split('// ── Provider Resolution')[1] ?? '';

    expect(providerSection).toContain('https://api.openai.com/v1/chat/completions');
    expect(providerSection).toContain('store: false');
    expect(providerSection).not.toContain('forge.manus');
    expect(providerSection).not.toContain("provider: 'forge'");
  });

  it('keeps the active minimal route derived from getApiBaseUrl', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/ai/openai-provider.ts'),
      'utf8',
    );
    expect(source).toContain('const apiBaseUrl = getApiBaseUrl();');
    expect(source).toContain('const minimalProxyUrl = `${apiBaseUrl}/api/minimal-gpt-proxy`;');
  });
});
