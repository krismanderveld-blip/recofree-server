import { beforeEach, describe, expect, it, vi } from 'vitest';

const callMinimalProxyJson = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai/minimal-proxy-client', () => ({ callMinimalProxyJson }));

import { callVspBackpackAnalysis } from '@/lib/backpack-extractor/vsp-backpack-client';

describe('VSP Backpack minimal-proxy client', () => {
  beforeEach(() => callMinimalProxyJson.mockReset());

  it('uses the generic Elias minimal proxy and normalizes all five zones', async () => {
    callMinimalProxyJson.mockResolvedValue({
      green: [' rustig '], yellow: ['spanning'], orange: ['isoleren'], red: ['sterke drang'], purple: ['terugval'], extra: ['ignored'],
    });
    const result = await callVspBackpackAnalysis({ themesContent: 'GROEN rustig; ROOD sterke drang', sourceHash: 'hash-1' });
    expect(callMinimalProxyJson).toHaveBeenCalledWith(expect.objectContaining({
      persona: 'elias', model: 'gpt-4o-mini', temperature: 0, promptBuildVersion: 'vsp-backpack-profile-v2-client',
    }));
    expect(result).toMatchObject({ green: ['rustig'], red: ['sterke drang'], purple: ['terugval'], sourceHash: 'hash-1' });
  });

  it('fails safely when the proxy output is invalid', async () => {
    callMinimalProxyJson.mockResolvedValue(null);
    await expect(callVspBackpackAnalysis({ themesContent: 'tekst', sourceHash: 'hash-2' })).resolves.toBeNull();
  });
});
