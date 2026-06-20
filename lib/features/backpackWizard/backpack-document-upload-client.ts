/**
 * Backpack Document Upload Client
 *
 * Picks a document (DOCX, TXT) from the device, reads its text content,
 * sends it to the server for GPT-based extraction, and returns structured
 * backpack data ready for review.
 *
 * Reuses the existing /api/vsp/extract-text endpoint for DOCX→text conversion
 * and calls /api/backpack/parse-document for GPT extraction.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';

export interface BackpackExtractedData {
  naam: string;
  userType: 'elias' | 'kim';
  sections: {
    childhood: string;
    adolescence: string;
    adulthood: string;
    family: string;
    themes: string;
  };
  kimSections: {
    my_story: string;
    the_relationship: string;
    the_impact: string;
    my_boundaries: string;
    my_strength: string;
  };
  intakeContext: {
    startEmotion: string;
    urgency: 'laag' | 'midden' | 'hoog';
    initialContext: string;
    stageOfChange: string;
  };
}

export interface BackpackUploadResult {
  success: boolean;
  data?: BackpackExtractedData;
  error?: string;
  cancelled?: boolean;
}

/**
 * Opens the document picker, reads the file, sends text to server for parsing.
 * Returns structured backpack data on success.
 */
export async function pickAndParseBackpackDocument(): Promise<BackpackUploadResult> {
  try {
    // 1. Pick document
    const result = await DocumentPicker.getDocumentAsync({
      type: [
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
    console.log(`[BackpackUpload] Picked: ${asset.name} (${asset.mimeType}, ${asset.size} bytes)`);

    // 2. Read file content as text
    const documentText = await readDocumentText(asset);
    if (!documentText || documentText.trim().length < 20) {
      return { success: false, error: 'The document contains too little text to process.' };
    }

    console.log(`[BackpackUpload] Text extracted, length=${documentText.length}`);

    // 3. Send to server for GPT parsing
    const backpackData = await sendForParsing(documentText);
    if (!backpackData) {
      return { success: false, error: 'The document could not be processed by GPT. Please try again.' };
    }

    return { success: true, data: backpackData };
  } catch (error: any) {
    console.error('[BackpackUpload] Error:', error);
    return { success: false, error: error.message || 'Something went wrong during upload.' };
  }
}

/**
 * Read text content from a picked document asset.
 * For .txt files: read directly.
 * For .docx: upload to server for text extraction (mammoth).
 */
async function readDocumentText(asset: DocumentPicker.DocumentPickerAsset): Promise<string | null> {
  const { uri, mimeType, name } = asset;

  // For plain text files, read directly
  if (mimeType === 'text/plain' || name.endsWith('.txt')) {
    return await readTextFile(uri);
  }

  // For DOCX: send the raw file to the server for text extraction
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
    console.error('[BackpackUpload] Text extraction failed:', response.status);
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
    const FileSystem = await import('expo-file-system/legacy');
    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return content;
  } catch (err) {
    console.error('[BackpackUpload] readTextFile error:', err);
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
          const base64 = result.split(',')[1] || result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    const FileSystem = await import('expo-file-system/legacy');
    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return content;
  } catch (err) {
    console.error('[BackpackUpload] readFileAsBase64 error:', err);
    return null;
  }
}

/**
 * Send document text to server for GPT-based backpack extraction
 */
async function sendForParsing(documentText: string): Promise<BackpackExtractedData | null> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const token = await Auth.getSessionToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    console.log(`[BackpackUpload] Sending ${documentText.length} chars to ${apiBaseUrl}/api/backpack/parse-document`);

    const response = await fetch(`${apiBaseUrl}/api/backpack/parse-document`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ documentText }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'no body');
      console.error(`[BackpackUpload] Parse failed: HTTP ${response.status} — ${errBody.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    if (!data.success || !data.backpackData) {
      console.error('[BackpackUpload] Server returned no backpackData');
      return null;
    }

    return data.backpackData as BackpackExtractedData;
  } catch (err) {
    console.error('[BackpackUpload] sendForParsing error:', err);
    return null;
  }
}
