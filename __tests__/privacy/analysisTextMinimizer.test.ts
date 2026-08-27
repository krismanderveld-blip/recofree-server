import { describe, expect, it, vi } from 'vitest';
import type { Backpack } from '@/lib/ai/types';
import { minimizeAnalysisText } from '@/lib/privacy/analysis-text-minimizer';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@/lib/crypto/storage-encryption', () => ({
  readEncrypted: vi.fn(() => Promise.resolve(null)),
  writeEncrypted: vi.fn(() => Promise.resolve()),
}));

import { forceExtract } from '@/lib/backpack-extractor/extractor';
import { extractLocalDocumentText } from '@/lib/features/document/local-document-text';

function makeBackpack(): Backpack {
  return {
    naam: 'Echte Naam',
    userType: 'elias',
    sections: [{
      id: 'childhood',
      label: 'Jeugd',
      ageRange: '6-12',
      prompt: '',
      content: `Contact test@example.com of +32 470 12 34 56. Geboren 22/09/1980. ${'betekenisvolle context '.repeat(500)}`,
      lastUpdated: null,
    }],
    intakeContext: {
      stageOfChange: 'contemplation',
      startEmotion: '',
      urgency: 'midden',
      initialContext: 'Start op 2026-08-27; mail intake@example.com.',
      intakeDate: '2026-08-27',
    },
    createdAt: '2026-08-27T00:00:00.000Z',
  };
}

describe('Analysis text privacy boundary', () => {
  it('redacts direct contact data, exact dates and secrets', () => {
    const result = minimizeAnalysisText(
      'Mail me@example.com, bel +32 470 12 34 56, datum 22/09/1980, token=abcdefghijklmnopqrstuvwxyz.',
    );
    expect(result.text).not.toContain('me@example.com');
    expect(result.text).not.toContain('470 12 34 56');
    expect(result.text).not.toContain('22/09/1980');
    expect(result.text).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(result.redactions).toBeGreaterThanOrEqual(4);
  });

  it('enforces a deterministic maximum analysis length', () => {
    const result = minimizeAnalysisText('x'.repeat(500), 120);
    expect(result.text).toHaveLength(120);
    expect(result.truncated).toBe(true);
  });

  it('forceExtract sends generic identity and bounded redacted fragments only', async () => {
    type ExtractionInput = Parameters<Parameters<typeof forceExtract>[1]>[0];
    const callExtraction = vi.fn(async (_input: ExtractionInput) => null);
    await forceExtract(makeBackpack(), callExtraction);

    expect(callExtraction).toHaveBeenCalledTimes(1);
    const payload = callExtraction.mock.calls[0]![0];
    expect(payload.userName).toBe('Gebruiker');
    expect(JSON.stringify(payload)).not.toContain('Echte Naam');
    expect(JSON.stringify(payload)).not.toContain('test@example.com');
    expect(JSON.stringify(payload)).not.toContain('22/09/1980');
    expect(payload.sections[0].content.length).toBeLessThanOrEqual(6_000);
    expect(payload.intakeContext.length).toBeLessThanOrEqual(1_500);
  });

  it('does not misclassify PDF as a locally parsed DOCX/TXT document', async () => {
    await expect(extractLocalDocumentText({
      uri: 'file:///private/plan.pdf',
      name: 'plan.pdf',
      mimeType: 'application/pdf',
    })).resolves.toBeNull();
  });
});
