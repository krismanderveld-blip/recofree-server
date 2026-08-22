import { describe, expect, it, vi } from 'vitest';

import {
  createVspExportDocument,
  saveVspExportLocally,
  shareVspExport,
  type VspLocalSaveAdapter,
  type VspShareAdapter,
} from '@/lib/features/vspInsight/vspInsightFileExport';

describe('VSP Insight file export', () => {
  const document = createVspExportDocument(
    'persoonlijk overzicht',
    'elias',
    '2026-08-22T06:15:30.123Z',
  );

  it('creates a deterministic, filesystem-safe filename', () => {
    expect(document.fileName).toBe(
      'recofree-inzichtprofiel-elias-2026-08-22T06-15-30-123Z.txt',
    );
    expect(document.mimeType).toBe('text/plain');
    expect(document.uti).toBe('public.plain-text');
  });

  it('keeps the generated content unchanged', () => {
    expect(document.content).toBe('persoonlijk overzicht');
  });

  it('uses the Kim persona in a Kim export filename', () => {
    const kim = createVspExportDocument('kim overzicht', 'kim', '2026-08-22T00:00:00Z');
    expect(kim.fileName).toContain('recofree-inzichtprofiel-kim-');
  });

  it('returns saved only after the chosen directory adapter wrote the file', async () => {
    const chooseDirectoryAndWrite = vi.fn().mockResolvedValue('content://downloads/file.txt');
    const adapter: VspLocalSaveAdapter = { chooseDirectoryAndWrite };

    const result = await saveVspExportLocally(document, adapter);

    expect(chooseDirectoryAndWrite).toHaveBeenCalledOnce();
    expect(chooseDirectoryAndWrite).toHaveBeenCalledWith(document);
    expect(result).toEqual({
      status: 'saved',
      uri: 'content://downloads/file.txt',
      fileName: document.fileName,
    });
  });

  it('treats directory-picker cancellation as cancellation, not success', async () => {
    const adapter: VspLocalSaveAdapter = {
      chooseDirectoryAndWrite: vi.fn().mockResolvedValue(null),
    };

    await expect(saveVspExportLocally(document, adapter)).resolves.toEqual({
      status: 'cancelled',
      fileName: document.fileName,
    });
  });

  it('propagates local write failures to the UI error handler', async () => {
    const adapter: VspLocalSaveAdapter = {
      chooseDirectoryAndWrite: vi.fn().mockRejectedValue(new Error('disk full')),
    };

    await expect(saveVspExportLocally(document, adapter)).rejects.toThrow('disk full');
  });

  it('does not create or share a temp file when sharing is unavailable', async () => {
    const adapter: VspShareAdapter = {
      isAvailable: vi.fn().mockResolvedValue(false),
      writeTemporary: vi.fn(),
      share: vi.fn(),
    };

    const result = await shareVspExport(document, adapter, 'Deel met behandelaar');

    expect(result).toEqual({ status: 'unavailable', fileName: document.fileName });
    expect(adapter.writeTemporary).not.toHaveBeenCalled();
    expect(adapter.share).not.toHaveBeenCalled();
  });

  it('writes a temporary file before opening the share sheet', async () => {
    const callOrder: string[] = [];
    const adapter: VspShareAdapter = {
      isAvailable: vi.fn(async () => true),
      writeTemporary: vi.fn(async () => {
        callOrder.push('write');
        return 'file:///cache/profile.txt';
      }),
      share: vi.fn(async () => {
        callOrder.push('share');
      }),
    };

    const result = await shareVspExport(document, adapter, 'Deel met behandelaar');

    expect(callOrder).toEqual(['write', 'share']);
    expect(adapter.share).toHaveBeenCalledWith(
      'file:///cache/profile.txt',
      document,
      'Deel met behandelaar',
    );
    expect(result).toEqual({ status: 'shared', fileName: document.fileName });
  });

  it('propagates share-sheet failures to the UI error handler', async () => {
    const adapter: VspShareAdapter = {
      isAvailable: vi.fn().mockResolvedValue(true),
      writeTemporary: vi.fn().mockResolvedValue('file:///cache/profile.txt'),
      share: vi.fn().mockRejectedValue(new Error('share failed')),
    };

    await expect(shareVspExport(document, adapter, 'Delen')).rejects.toThrow('share failed');
  });

  it('never requires a backend or network callback', async () => {
    const adapter: VspLocalSaveAdapter = {
      chooseDirectoryAndWrite: vi.fn().mockResolvedValue('file:///chosen/profile.txt'),
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await saveVspExportLocally(document, adapter);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
