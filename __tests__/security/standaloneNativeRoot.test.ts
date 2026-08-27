import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('standalone native root', () => {
  const root = readFileSync(resolve(process.cwd(), 'app/_layout.tsx'), 'utf8');
  const callback = readFileSync(resolve(process.cwd(), 'app/oauth/callback.tsx'), 'utf8');
  const oauth = readFileSync(resolve(process.cwd(), 'constants/oauth.ts'), 'utf8');
  const config = readFileSync(resolve(process.cwd(), 'app.config.ts'), 'utf8');

  it('does not initialize Manus runtime, tRPC, React Query or OAuth in the app root', () => {
    expect(root).not.toMatch(/manus-runtime|createTRPCClient|trpc\.Provider|QueryClientProvider|oauth\/callback/);
    expect(callback).not.toMatch(/_core\/auth|_core\/api|getSessionToken|exchangeOAuthCode/);
  });

  it('does not import the deprecated server-engine migration barrel into the chat pipeline', () => {
    const pipeline = readFileSync(resolve(process.cwd(), 'lib/rugzak/pipeline.ts'), 'utf8');
    expect(pipeline).not.toMatch(/from ['"]@\/lib\/migration['"]|isServerEngineActive\(/);
    expect(pipeline).toContain('SERVER_ENGINE_DISABLED = false');
  });

  it('contains no external OAuth/owner/logo URL metadata', () => {
    expect(oauth).not.toMatch(/OAUTH_PORTAL_URL|OWNER_OPEN_ID|OWNER_NAME|api\.manus\.im/);
    expect(config).not.toMatch(/cloudfront\.net|schemeFromBundleId/);
    expect(config).toContain('scheme: "recofree"');
  });

  it('preserves the existing installed package identifier', () => {
    expect(config).toContain('space.manus.recofree.app.t20260405113127');
  });
});
