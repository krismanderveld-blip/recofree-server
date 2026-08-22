export interface VspExportDocument {
  fileName: string;
  content: string;
  mimeType: 'text/plain';
  uti: 'public.plain-text';
}

export interface VspLocalSaveAdapter {
  chooseDirectoryAndWrite(document: VspExportDocument): Promise<string | null>;
}

export interface VspShareAdapter {
  isAvailable(): Promise<boolean>;
  writeTemporary(document: VspExportDocument): Promise<string>;
  share(uri: string, document: VspExportDocument, dialogTitle: string): Promise<void>;
}

export type VspLocalSaveResult =
  | { status: 'saved'; uri: string; fileName: string }
  | { status: 'cancelled'; fileName: string };

export type VspShareResult =
  | { status: 'shared'; fileName: string }
  | { status: 'unavailable'; fileName: string };

function safeTimestamp(iso: string): string {
  const parsed = new Date(iso);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return date.toISOString().replace(/[:.]/g, '-');
}

export function createVspExportDocument(
  content: string,
  persona: 'elias' | 'kim',
  exportedAt: string,
): VspExportDocument {
  return {
    fileName: `recofree-inzichtprofiel-${persona}-${safeTimestamp(exportedAt)}.txt`,
    content,
    mimeType: 'text/plain',
    uti: 'public.plain-text',
  };
}

export async function saveVspExportLocally(
  document: VspExportDocument,
  adapter: VspLocalSaveAdapter,
): Promise<VspLocalSaveResult> {
  const uri = await adapter.chooseDirectoryAndWrite(document);
  if (!uri) return { status: 'cancelled', fileName: document.fileName };
  return { status: 'saved', uri, fileName: document.fileName };
}

export async function shareVspExport(
  document: VspExportDocument,
  adapter: VspShareAdapter,
  dialogTitle: string,
): Promise<VspShareResult> {
  if (!(await adapter.isAvailable())) {
    return { status: 'unavailable', fileName: document.fileName };
  }
  const uri = await adapter.writeTemporary(document);
  await adapter.share(uri, document, dialogTitle);
  return { status: 'shared', fileName: document.fileName };
}
