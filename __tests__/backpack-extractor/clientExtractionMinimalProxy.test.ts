import { describe, expect, it, vi } from 'vitest';

const proxyJsonMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai/minimal-proxy-client', () => ({ callMinimalProxyJson: proxyJsonMock }));

import { buildClientExtractionPrompt, extractEntitiesClient } from '@/lib/backpack-extractor/client-extraction';

const request = {
  userName: 'TestGebruiker', userType: 'elias' as const,
  sections: [{ id: 'current', label: 'Nu', content: 'Mijn zoon Jules helpt mij nuchter te blijven.' }],
  intakeContext: '',
};

describe('client-built backpack entity extraction', () => {
  it('builds a bounded persona-specific prompt without the account name', () => {
    const prompt = buildClientExtractionPrompt(request);
    expect(prompt).toContain('Jules');
    expect(prompt).not.toContain('TestGebruiker');
    expect(prompt).toContain('Do not diagnose');
  });

  it('calls only the minimal proxy and validates the result', async () => {
    proxyJsonMock.mockResolvedValueOnce({
      persons: [{ name: 'Jules', relationship: 'son', relationshipNL: 'zoon', emotionalValence: 'positive' }],
      events: [], patterns: [], contexts: [],
    });
    const result = await extractEntitiesClient(request, 'hash-1');
    expect(result?.persons[0]).toMatchObject({ name: 'Jules', relationshipNL: 'zoon', emotionalValence: 'positive' });
    expect(result?.sourceHash).toBe('hash-1');
    expect(proxyJsonMock).toHaveBeenCalledWith(expect.objectContaining({
      persona: 'elias', promptBuildVersion: 'backpack-entity-extraction-client-v2',
    }));
  });

  it('fails non-blockingly on malformed proxy output', async () => {
    proxyJsonMock.mockRejectedValueOnce(new Error('invalid_json'));
    await expect(extractEntitiesClient(request, 'hash-2')).resolves.toBeNull();
  });
});
