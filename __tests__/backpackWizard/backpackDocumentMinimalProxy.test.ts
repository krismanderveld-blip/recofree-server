import { describe, expect, it, vi } from 'vitest';

const proxyJsonMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai/minimal-proxy-client', () => ({ callMinimalProxyJson: proxyJsonMock }));
vi.mock('@/lib/i18n', () => ({ getCurrentLanguage: () => 'nl' }));

import { parseBackpackDocumentText } from '@/lib/features/backpackWizard/backpack-document-upload-client';

describe('Backpack document client-built minimal proxy', () => {
  it('preserves Kim persona and normalizes all required sections', async () => {
    proxyJsonMock.mockResolvedValueOnce({
      naam: 'Test', userType: 'kim', sections: {},
      kimSections: { my_story: 'Mijn eigen verhaal', the_relationship: 'Onze relatie' },
      intakeContext: { urgency: 'hoog' },
    });
    const result = await parseBackpackDocumentText('Ik ben naaste en beschrijf mijn eigen verhaal en onze relatie.', 'kim');
    expect(result?.userType).toBe('kim');
    expect(result?.kimSections.my_story).toBe('Mijn eigen verhaal');
    expect(result?.sections.childhood).toBe('');
    expect(result?.intakeContext.urgency).toBe('hoog');
    expect(proxyJsonMock).toHaveBeenCalledWith(expect.objectContaining({
      persona: 'kim', promptBuildVersion: 'backpack-document-extraction-client-v2',
    }));
  });

  it('keeps the explicit persona hint when output omits userType', async () => {
    proxyJsonMock.mockResolvedValueOnce({ sections: {}, kimSections: {}, intakeContext: {} });
    expect((await parseBackpackDocumentText('voldoende lange expliciete levensverhaaltekst', 'elias'))?.userType).toBe('elias');
  });
});
