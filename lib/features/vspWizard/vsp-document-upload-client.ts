/**
 * VSP Document Upload Client
 *
 * Picks a document (PDF, DOCX, TXT) from the device, reads its text content,
 * sends minimized text through the generic minimal proxy, and returns a VspStructuredPlan.
 *
 * Gracefully handles:
 * - Incomplete documents (zones left empty)
 * - Cancellation by user
 * - Network/server errors
 * - Web platform (FileSystem not available → uses fetch for blob reading)
 */
import * as DocumentPicker from 'expo-document-picker';
import { callMinimalProxyJson } from '@/lib/ai/minimal-proxy-client';
import type { VspStructuredPlan } from '@/lib/ai/types';
import { LocalDeviceTimeService } from "@/lib/core/time";
import { extractLocalDocumentText } from '@/lib/features/document/local-document-text';
import { minimizeAnalysisText } from '@/lib/privacy/analysis-text-minimizer';

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
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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

    // 3. Send to server for GPT parsing
    const vspPlan = await parseVspDocumentText(documentText);
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
 * TXT and DOCX are extracted locally. Raw files never leave the device.
 */
async function readDocumentText(asset: DocumentPicker.DocumentPickerAsset): Promise<string | null> {
  const { uri, mimeType, name } = asset;
  return extractLocalDocumentText({ uri, mimeType, name });
}

/**
 * Send document text to server for GPT-based VSP extraction
 */
export async function parseVspDocumentText(documentText: string): Promise<VspStructuredPlan | null> {
  try {
    const analysisText = minimizeAnalysisText(documentText).text;
    console.log(`[VspUpload] Sending minimized text through minimal proxy (${analysisText.length} chars)`);
    const parsed = await callMinimalProxyJson<Record<string, any>>({
      persona: 'elias',
      systemPrompt: `Extract a personal safety plan (VSP) into JSON. Only copy explicitly written content; never diagnose, infer or add advice. Preserve the user's wording. Return zones green, yellow, orange, red, purple; each with signals, whatHelps, anchorSentence. Also return triggers with trigger/counterThought, recoveryRules, mainAnchorSentence. Missing fields must be empty strings or empty arrays.`,
      messages: [{ role: 'user', content: analysisText }],
      model: 'gpt-4o-2024-08-06',
      maxTokens: 4000,
      temperature: 0,
      promptBuildVersion: 'vsp-document-extraction-client-v2',
    });
    const emptyZone = { signals: '', whatHelps: '', anchorSentence: '' };
    const zone = (value: unknown) => {
      const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
      return {
        signals: typeof raw.signals === 'string' ? raw.signals : '',
        whatHelps: typeof raw.whatHelps === 'string' ? raw.whatHelps : '',
        anchorSentence: typeof raw.anchorSentence === 'string' ? raw.anchorSentence : '',
      };
    };
    const zones = parsed.zones && typeof parsed.zones === 'object' ? parsed.zones as Record<string, unknown> : {};
    return {
      zones: {
        green: { ...emptyZone, ...zone(zones.green) },
        yellow: { ...emptyZone, ...zone(zones.yellow) },
        orange: { ...emptyZone, ...zone(zones.orange) },
        red: { ...emptyZone, ...zone(zones.red) },
        purple: { ...emptyZone, ...zone(zones.purple) },
      },
      triggers: Array.isArray(parsed.triggers)
        ? parsed.triggers.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
            .map((item) => ({ trigger: String(item.trigger ?? ''), counterThought: String(item.counterThought ?? '') }))
            .filter((item) => item.trigger || item.counterThought)
        : [],
      recoveryRules: Array.isArray(parsed.recoveryRules)
        ? parsed.recoveryRules.map(String).map((item) => item.trim()).filter(Boolean)
        : [],
      mainAnchorSentence: typeof parsed.mainAnchorSentence === 'string' ? parsed.mainAnchorSentence : '',
      lastUpdated: LocalDeviceTimeService.now().utcIso,
    };
  } catch (err) {
    console.error('[VspUpload] minimal-proxy parse error:', err);
    return null;
  }
}
