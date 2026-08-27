/** Production fail-closed provider and build-contract tests. */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const PROVIDER_PATH = path.resolve(__dirname, '../../lib/ai/openai-provider.ts');
const providerSource = fs.readFileSync(PROVIDER_PATH, 'utf-8');
const architectureSource = fs.readFileSync(
  path.resolve(__dirname, '../../lib/config/client-first-architecture.ts'),
  'utf-8',
);
const appConfigSource = fs.readFileSync(path.resolve(__dirname, '../../app.config.ts'), 'utf-8');
const eas = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../eas.json'), 'utf-8'));
const productionBlock = providerSource.split('PRODUCTION ROUTE:')[1]?.split('} catch (error)')[0] ?? '';

describe('Production provider is fail-closed to Railway minimal proxy', () => {
  it('1. has no runtime flag or legacy chat route', () => {
    expect(providerSource).not.toContain('EXPO_PUBLIC_ENABLE_MINIMAL_GPT_PROXY');
    expect(providerSource).not.toContain('/api/gpt-proxy');
    expect(providerSource).not.toContain('/api/trpc/ai.chat');
    expect(providerSource).toContain('/api/minimal-gpt-proxy');
  });

  it('2. builds only the versioned minimal request with store=false', () => {
    expect(productionBlock).toContain('const minimalProxyUrl = `${apiBaseUrl}/api/minimal-gpt-proxy`');
    expect(providerSource).toContain("contractVersion: 'minimal_gpt_proxy_v1'");
    expect(providerSource).toContain('store: false');
    expect(providerSource).toContain('buildClientSystemPrompt(promptInput)');
    expect(providerSource).toContain('messages,');
  });

  it('3. returns the established safe local response on proxy failure', () => {
    expect(productionBlock).toContain('buildMedicalSafetyFailureResponse');
    expect(productionBlock).toContain('buildProviderFailureResponse');
    expect(productionBlock).not.toContain('/api/gpt-proxy');
    expect(productionBlock).not.toContain('/api/trpc/ai.chat');
  });

  it('4. logs no prompt or message content', () => {
    const logLines = productionBlock.split('\n').filter(l => l.includes('console.log'));
    for (const line of logLines) {
      expect(line).not.toContain('systemPrompt');
      expect(line).not.toContain('.message');
      expect(line).not.toContain('content');
    }
  });

  it('5. preserves Kim/Elias persona and Elias default', () => {
    expect(providerSource).toContain("persona: (context.userType as 'kim' | 'elias')");
    expect(providerSource).toContain("?? 'elias'");
  });

  it('6. version-controls the production client-first architecture', () => {
    expect(architectureSource).toContain('minimalGptProxy: true');
    expect(architectureSource).toContain('clinicalMemoryDistillation: true');
    expect(architectureSource).toContain('coreEpistemicEngine: true');
    expect(architectureSource).toContain('epistemicModelRouting: true');
    expect(architectureSource).toContain('serverEngine: false');
    expect(appConfigSource).toContain('clientFirstArchitecture');
  });

  it('7. pins every EAS profile to Railway and all required flags', () => {
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

  it('8. keeps the existing lockfile format', () => {
    const lockfile = fs.readFileSync(
      path.resolve(__dirname, '../../pnpm-lock.yaml'),
      'utf-8'
    );
    expect(lockfile).toContain('lockfileVersion:');
  });
});
