/**
 * VSP Document Upload Client
 *
 * Picks a document (PDF, DOCX, TXT) from the device, reads its text content,
 * sends it to the server for GPT-based extraction, and returns a VspStructuredPlan.
 *
 * Gracefully handles:
 * - Incomplete documents (zones left empty)
 * - Cancellation by user
 * - Network/server errors
 * - Web platform (FileSystem not available → uses fetch for blob reading)
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import type { VspStructuredPlan } from '@/lib/ai/types';
import { LocalDeviceTimeService } from "@/lib/core/time";

export interface VspUploadResult {
  success: boolean;
  vspPlan?: VspStructuredPlan;
  error?: string;
  cancelled?: boolean;
}

/**
 * Opens the document picker, reads the file, sends text to server for parsing.
 * Returns a VspStructuredPlan on success.
 */
export async function pickAndParseVspDocument(): Promise<VspUploadResult> {
  try {
    // 1. Pick document
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
      ],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, cancelled: true };
    }

    const asset = result.assets[0];
    console.log(`[VspUpload] Picked: ${asset.name} (${asset.mimeType}, ${asset.size} bytes)`);

    // 2. Read file content as text
    const documentText = await readDocumentText(asset);
    if (!documentText || documentText.trim().length < 20) {
      return { success: false, error: 'Het document bevat te weinig tekst om te verwerken.' };
    }

    console.log(`[VspUpload] Text extracted successfully, length=${documentText.length}`);
    console.log(`[VspUpload] Preview: ${documentText.slice(0, 150).replace(/\n/g, ' | ')}`);

    // 3. Send to server for GPT parsing
    const vspPlan = await sendForParsing(documentText);
    if (!vspPlan) {
      return { success: false, error: 'Het document kon niet verwerkt worden door GPT. Probeer het opnieuw.' };
    }

    // Log what was extracted
    const filledZones = Object.entries(vspPlan.zones || {}).filter(
      ([_, z]: [string, any]) => z && (z.signals || z.whatHelps || z.anchorSentence)
    ).length;
    console.log(`[VspUpload] GPT extraction complete: ${filledZones}/5 zones filled, ${vspPlan.triggers?.length ?? 0} triggers`);

    return { success: true, vspPlan };
  } catch (error: any) {
    console.error('[VspUpload] Error:', error);
    return { success: false, error: error.message || 'Er ging iets mis bij het uploaden.' };
  }
}

/**
 * Read text content from a picked document asset.
 * For .txt files: read directly.
 * For .docx/.pdf: upload to server for text extraction (server-side).
 */
async function readDocumentText(asset: DocumentPicker.DocumentPickerAsset): Promise<string | null> {
  const { uri, mimeType, name } = asset;

  // For plain text files, read directly
  if (mimeType === 'text/plain' || name.endsWith('.txt')) {
    return await readTextFile(uri);
  }

  // For DOCX/PDF: send the raw file to the server for text extraction
  // We'll send it as base64 to avoid multipart complexity
  const base64Content = await readFileAsBase64(uri);
  if (!base64Content) return null;

  const apiBaseUrl = getApiBaseUrl();
  const token = await Auth.getSessionToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${apiBaseUrl}/api/vsp/extract-text`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ base64Content, mimeType, fileName: name }),
  });

  if (!response.ok) {
    console.error('[VspUpload] Text extraction failed:', response.status);
    return null;
  }

  const data = await response.json();
  return data.text || null;
}

/**
 * Read a text file from URI
 */
async function readTextFile(uri: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      return await response.text();
    }
    // Native: use expo-file-system (legacy API for EncodingType)
    const FileSystem = await import('expo-file-system/legacy');
    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return content;
  } catch (err) {
    console.error('[VspUpload] readTextFile error:', err);
    return null;
  }
}

/**
 * Read a file as base64 from URI
 */
async function readFileAsBase64(uri: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Strip data:...;base64, prefix
          const base64 = result.split(',')[1] || result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    // Native: use expo-file-system (legacy API for EncodingType)
    const FileSystem = await import('expo-file-system/legacy');
    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return content;
  } catch (err) {
    console.error('[VspUpload] readFileAsBase64 error:', err);
    return null;
  }
}

/**
 * Send document text to server for GPT-based VSP extraction
 */
async function sendForParsing(documentText: string): Promise<VspStructuredPlan | null> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const token = await Auth.getSessionToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    console.log(`[VspUpload] Sending ${documentText.length} chars to ${apiBaseUrl}/api/vsp/parse-document`);

    const response = await fetch(`${apiBaseUrl}/api/vsp/parse-document`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ documentText }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'no body');
      console.error(`[VspUpload] Parse failed: HTTP ${response.status} — ${errBody.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    console.log(`[VspUpload] Server response: success=${data.success}, hasVspPlan=${!!data.vspPlan}`);

    if (!data.success || !data.vspPlan) {
      console.error('[VspUpload] Server returned no vspPlan:', JSON.stringify(data).slice(0, 300));
      return null;
    }

    // Add lastUpdated timestamp
    return {
      ...data.vspPlan,
      lastUpdated: LocalDeviceTimeService.now().utcIso,
    } as VspStructuredPlan;
  } catch (err) {
    console.error('[VspUpload] sendForParsing error:', err);
    return null;
  }
}
