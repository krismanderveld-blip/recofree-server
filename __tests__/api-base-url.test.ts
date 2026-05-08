import { describe, it, expect } from 'vitest';

describe('EXPO_PUBLIC_API_BASE_URL', () => {
  it('should be set to the production domain', () => {
    const url = process.env.EXPO_PUBLIC_API_BASE_URL;
    expect(url).toBeDefined();
    expect(url).toBe('https://recobase-vhsxu5ua.manus.space');
  });

  it('should not point to a sandbox URL', () => {
    const url = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
    expect(url).not.toContain('3000-');
    expect(url).not.toContain('.us2.manus.computer');
    expect(url).not.toContain('.us1.manus.computer');
  });

  it('should be a valid HTTPS URL', () => {
    const url = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
    expect(url.startsWith('https://')).toBe(true);
    expect(url.endsWith('/')).toBe(false); // No trailing slash
  });
});
