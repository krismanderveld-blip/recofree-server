import { describe, expect, it, vi } from 'vitest';

const proxyJsonMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai/minimal-proxy-client', () => ({ callMinimalProxyJson: proxyJsonMock }));

import { parseVspDocumentText } from '@/lib/features/vspWizard/vsp-document-upload-client';

describe('VSP document client-built minimal proxy', () => {
  it('normalizes incomplete explicit document content into five safe zones', async () => {
    proxyJsonMock.mockResolvedValueOnce({
      zones: { green: { signals: 'rust', whatHelps: 'wandelen', anchorSentence: 'Ik blijf hier.' } },
      triggers: [{ trigger: 'stress', counterThought: 'Ik kan pauzeren.' }],
    });
    const result = await parseVspDocumentText('GROEN: rust. Wat helpt: wandelen. Mijn zin: Ik blijf hier.');
    expect(result?.zones.green.signals).toBe('rust');
    expect(result?.zones.red.signals).toBe('');
    expect(result?.triggers[0].trigger).toBe('stress');
    expect(proxyJsonMock).toHaveBeenCalledWith(expect.objectContaining({
      persona: 'elias', promptBuildVersion: 'vsp-document-extraction-client-v2',
    }));
  });

  it('returns null on invalid/offline proxy output', async () => {
    proxyJsonMock.mockRejectedValueOnce(new Error('offline'));
    await expect(parseVspDocumentText('voldoende lange tekst voor een VSP-document')).resolves.toBeNull();
  });
});
