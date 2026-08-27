import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');

describe('standalone release gate contract', () => {
  it('builds and scans a readable Android production bundle', () => {
    const source = fs.readFileSync(path.join(root, 'scripts/standalone-apk-railway-gate.sh'), 'utf8');
    expect(source).toContain('expo export');
    expect(source).toContain('--platform android');
    expect(source).toContain('--no-bytecode');
    expect(source).toContain('api.manus.im');
    expect(source).toContain('/api/gpt-proxy');
    expect(source).toContain('/api/trpc');
    expect(source).toContain('/api/client/session');
    expect(source).toContain('/api/minimal-gpt-proxy');
  });

  it('is a mandatory release-gate step and checks only active store:false paths', () => {
    const source = fs.readFileSync(path.join(root, 'scripts/release-gate.sh'), 'utf8');
    expect(source).toContain('standalone-apk-railway-gate.sh');
    expect(source).toContain('lib/ai/minimal-proxy-client.ts');
    expect(source).not.toContain('store:false (llm/nano/legacy frozen)');
  });
});
