import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');

describe('standalone signing handover contract', () => {
  it('keeps signing credentials and credential manifests out of Git', () => {
    const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    expect(gitignore).toContain('*.jks');
    expect(gitignore).toContain('credentials.json');
    expect(gitignore).toContain('android/keystores/');
    expect(gitignore).toContain('ios/certs/');
  });

  it('never generates a key and verifies both signer digest and stable package ID', () => {
    const script = fs.readFileSync(path.join(root, 'scripts/verify-android-signing-handover.sh'), 'utf8');
    expect(script).toContain('apksigner verify --print-certs');
    expect(script).toContain('certificate SHA-256 digest');
    expect(script).toContain('space.manus.recofree.app.t20260405113127');
    expect(script).toContain('SIGNING_IDENTITY_MISMATCH');
    expect(script).not.toMatch(/keytool\s+-genkey/);
  });

  it('documents the exact credential export and update-compatibility proof', () => {
    const doc = fs.readFileSync(path.join(root, 'docs/architecture/STANDALONE_SIGNING_AND_BUILD_HANDOVER.md'), 'utf8');
    expect(doc).toContain('eas credentials -p android');
    expect(doc).toContain('apksigner verify --print-certs');
    expect(doc).toContain('SIGNING_HANDOVER_PENDING');
    expect(doc).toContain('Er wordt geen nieuwe signingkey gegenereerd');
  });
});
