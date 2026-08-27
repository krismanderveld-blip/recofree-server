import { describe, expect, it, vi } from 'vitest';

const proxyJsonMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai/minimal-proxy-client', () => ({ callMinimalProxyJson: proxyJsonMock }));

import { callBackpackAnalysis } from '@/lib/backpack-analysis/client';

describe('client-built backpack schema/mode analysis', () => {
  it('uses the full minimal-proxy model with persona and bounded normalized output', async () => {
    proxyJsonMock.mockResolvedValueOnce({
      schemas: [{ name: 'verlating', confidence: 2, evidence: 'kort bewijs' }],
      modi: [{ name: 'kwetsbare kind', confidence: 0.7, evidence: 'kort' }],
      triggers: ['stress'], coreBeliefs: ['ik ben alleen'], copingPatterns: ['vermijden'],
    });
    const result = await callBackpackAnalysis('account-name', 'Een begrensd verhaal over stress en herstel.', 'elias');
    expect(result?.schemas[0].confidence).toBe(1);
    expect(result?.analysisVersion).toBe(1);
    expect(proxyJsonMock).toHaveBeenCalledWith(expect.objectContaining({
      persona: 'elias', model: 'gpt-4o-2024-08-06', promptBuildVersion: 'backpack-schema-mode-analysis-client-v2',
    }));
    expect(JSON.stringify(proxyJsonMock.mock.calls[0][0])).not.toContain('account-name');
  });

  it('returns null on proxy failure without blocking the UI', async () => {
    proxyJsonMock.mockRejectedValueOnce(new Error('offline'));
    await expect(callBackpackAnalysis('id', 'voldoende lange tekst voor analyse', 'kim')).resolves.toBeNull();
  });
});
