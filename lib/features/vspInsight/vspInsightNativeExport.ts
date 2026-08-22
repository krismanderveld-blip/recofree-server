import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type {
  VspLocalSaveAdapter,
  VspShareAdapter,
} from './vspInsightFileExport';

function isUserCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /cancel|cancelled|canceled|dismiss|user.*close/i.test(message);
}

export const nativeVspLocalSaveAdapter: VspLocalSaveAdapter = {
  async chooseDirectoryAndWrite(document) {
    try {
      const directory = await Directory.pickDirectoryAsync();
      const file = directory.createFile(document.fileName, document.mimeType);
      file.write(document.content);
      return file.uri;
    } catch (error) {
      if (isUserCancellation(error)) return null;
      throw error;
    }
  },
};

export const nativeVspShareAdapter: VspShareAdapter = {
  isAvailable: () => Sharing.isAvailableAsync(),
  async writeTemporary(document) {
    const file = new File(Paths.cache, document.fileName);
    file.create({ overwrite: true, intermediates: true });
    file.write(document.content);
    return file.uri;
  },
  share: (uri, document, dialogTitle) =>
    Sharing.shareAsync(uri, {
      mimeType: document.mimeType,
      UTI: document.uti,
      dialogTitle,
    }),
};
