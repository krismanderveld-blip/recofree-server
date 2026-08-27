import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Wide-range pre-APK build and failure-boundary guards', () => {
  it('uses the Railway production build variable', () => {
    expect(process.env.EXPO_PUBLIC_API_BASE_URL).toBe(
      'https://railwayappdashboard-production.up.railway.app',
    );
  });

  it('version-controls all required client-first flags in every EAS profile', () => {
    const eas = JSON.parse(read('eas.json'));
    for (const profile of ['development', 'preview', 'production']) {
      expect(eas.build[profile].env.EXPO_PUBLIC_API_BASE_URL).toBe(
        'https://railwayappdashboard-production.up.railway.app',
      );
      for (const flag of [
        'EXPO_PUBLIC_ENABLE_MINIMAL_GPT_PROXY',
        'EXPO_PUBLIC_ENABLE_CLINICAL_MEMORY_DISTILLATION',
        'EXPO_PUBLIC_ENABLE_CORE_EPISTEMIC_ENGINE',
        'EXPO_PUBLIC_ENABLE_EPISTEMIC_MODEL_ROUTING',
        'EXPO_PUBLIC_ENABLE_NANO_INTERPRET',
      ]) {
        expect(eas.build[profile].env[flag]).toBe('true');
      }
    }
  });

  it('keeps dual Android ABI packaging', () => {
    const appConfig = read('app.config.ts');
    expect(appConfig).toContain('buildArchs: ["armeabi-v7a", "arm64-v8a"]');
  });

  it('keeps an internal preview build profile for APK testing', () => {
    const eas = JSON.parse(read('eas.json'));
    expect(eas.build.preview.distribution).toBe('internal');
  });

  it('contains no Manus URL in active API/GPT runtime files', () => {
    const activeFiles = [
      'constants/oauth.ts',
      'lib/ai/openai-provider.ts',
      'lib/backpack-extractor/client.ts',
      'lib/backpack-analysis/schema-mode-trigger.ts',
      'server/minimal-gpt-proxy.ts',
      'server/_core/llm.ts',
      'server/engine/nano-interpret.ts',
    ];
    const activeSource = activeFiles.map(read).join('\n');
    expect(activeSource).not.toMatch(/https?:\/\/[^"\s]*manus\.(space|computer|com|im|ai)/i);
  });

  it('keeps active extraction direct-OpenAI-only', () => {
    const source = read('server/_core/llm.ts');
    expect(source).toContain('https://api.openai.com/v1/chat/completions');
    expect(source).toContain('store: false');
    expect(source).not.toContain('forge.manus');
    expect(source).not.toMatch(/provider:\s*['"]forge['"]/);
  });

  it('derives the active minimal route from getApiBaseUrl', () => {
    const source = read('lib/ai/openai-provider.ts');
    expect(source).toContain('const minimalProxyUrl = `${apiBaseUrl}/api/minimal-gpt-proxy`;');
    expect(source).toContain('response: minimalData.text');
    expect(source).not.toContain('/api/gpt-proxy');
    expect(source).not.toContain('/api/trpc/ai.chat');
    expect(source).not.toContain('EXPO_PUBLIC_ENABLE_MINIMAL_GPT_PROXY');
  });

  it('has all seven wide-range layer labels in the gate runner', () => {
    const source = read('scripts/wide-range-pre-apk-gate.sh');
    for (const label of [
      'Native client / Android / build configuration',
      'Deterministic engine and routing',
      'Memory and local storage',
      'Prompts, safety and clinical contracts',
      'Railway, minimal proxy and provider isolation',
      'UI, i18n and export',
      'Release-gate and failure-boundary infrastructure',
    ]) {
      expect(source).toContain(label);
    }
  });

  it('does not equate local tests with device verification', () => {
    const wideGate = read('scripts/wide-range-pre-apk-gate.sh');
    expect(wideGate).toContain('APK BUILD ELIGIBLE: YES');
    expect(wideGate).toContain('DEVICE VERIFIED: NO');
  });
});
