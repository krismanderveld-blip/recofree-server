/**
 * File picker for RecoFree Export/Import.
 * Uses expo-document-picker to select .recofree backup files.
 * 
 * IMPORTANT: Dynamic import to avoid crash on APK builds compiled before this package was added.
 */

import type { PickedRecoFreeBackupFile } from '../types/importResult.types';

export async function pickRecoFreeBackupFile(): Promise<PickedRecoFreeBackupFile | null> {
  try {
    const DocumentPicker = await import('expo-document-picker');
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/octet-stream',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.name,
      size: asset.size ?? undefined,
      mimeType: asset.mimeType ?? undefined,
    };
  } catch {
    return null;
  }
}
