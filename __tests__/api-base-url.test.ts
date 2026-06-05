import { describe, it, expect } from 'vitest';

describe('EXPO_PUBLIC_API_BASE_URL', () => {
  it('should be set to the Railway production domain', () => {
    const url = process.env.EXPO_PUBLIC_API_BASE_URL;
    expect(url).toBeDefined();
    expect(url).toBe('https://railwayappdashboard-production.up.railway.app');
  });

  it('should not point to a sandbox URL', () => {
    const url = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
    expect(url).not.toContain('3000-');
    expect(url).not.toContain('.us2.manus.computer');
    expect(url).not.toContain('.us1.manus.computer');
    expect(url).not.toContain('manus.space');
  });

  it('should be a valid HTTPS URL', () => {
    const url = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
    expect(url.startsWith('https://')).toBe(true);
    expect(url.endsWith('/')).toBe(false); // No trailing slash
  });

  it('should reach the Railway health endpoint', async () => {
    const url = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
    const res = await fetch(`${url}/api/health`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});
