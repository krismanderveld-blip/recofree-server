import { Platform } from 'react-native';
import * as mammoth from 'mammoth/mammoth.browser';

export interface LocalDocumentAsset {
  uri: string;
  name: string;
  mimeType?: string | null;
}

async function readArrayBuffer(asset: LocalDocumentAsset): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    return response.arrayBuffer();
  }
  const { File } = await import('expo-file-system');
  return new File(asset.uri).arrayBuffer();
}

async function readText(asset: LocalDocumentAsset): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    return response.text();
  }
  const { File } = await import('expo-file-system');
  return new File(asset.uri).text();
}

/**
 * Extract supported text locally. Binary files never leave the device here.
 * Legacy DOC and PDF require a separate parser and are intentionally not
 * treated as locally supported formats.
 */
export async function extractLocalDocumentText(asset: LocalDocumentAsset): Promise<string | null> {
  const lowerName = asset.name.toLowerCase();
  if (asset.mimeType === 'text/plain' || lowerName.endsWith('.txt')) {
    return (await readText(asset)).trim();
  }
  if (
    asset.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerName.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ arrayBuffer: await readArrayBuffer(asset) });
    return result.value.trim();
  }
  return null;
}
