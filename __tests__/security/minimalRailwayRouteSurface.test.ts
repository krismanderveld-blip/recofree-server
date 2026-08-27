import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('minimal Railway production route surface', () => {
  const source = readFileSync(resolve(process.cwd(), 'server/_core/index.ts'), 'utf8');

  it('registers only client session and minimal GPT proxy under /api', () => {
    expect(source).toContain('registerRailwayClientSessionRoute(app)');
    expect(source).toContain('registerMinimalGptProxyRoute(app)');
    expect(source).toContain('ROUTE_NOT_AVAILABLE');
  });

  it.each([
    'registerOAuthRoutes(app)', 'registerSignalEngineRoute(app)', 'registerPreTranslateRoute(app)',
    'registerBackpackAnalysisRoute(app)', 'registerVspBackpackAnalysisRoute(app)',
    'registerVspDocumentParseRoute(app)', 'registerBackpackDocumentParseRoute(app)',
    'registerSessionGreetingRoute(app)', 'registerEngineProcessRoute(app)',
    'registerGptProxyRoute(app)', 'registerNanoInterpretRoute(app)',
    'registerDebugPromptRoute(app)', 'createExpressMiddleware({',
  ])('does not register frozen production route %s', (registration) => {
    expect(source).not.toContain(registration);
  });
});
