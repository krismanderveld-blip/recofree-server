/**
 * Backpack Document Upload Client
 *
 * Picks a document (DOCX, TXT) from the device, reads its text content,
 * sends minimized text through the generic minimal proxy, and returns structured
 * backpack data ready for review.
 *
 * Extracts TXT/DOCX locally and sends only bounded analysis text for parsing.
 */
import * as DocumentPicker from 'expo-document-picker';
import { callMinimalProxyJson } from '@/lib/ai/minimal-proxy-client';
import { getCurrentLanguage } from '@/lib/i18n';
import { extractLocalDocumentText } from '@/lib/features/document/local-document-text';
import { minimizeAnalysisText } from '@/lib/privacy/analysis-text-minimizer';

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
export async function pickAndParseBackpackDocument(personaHint: 'elias' | 'kim' = 'elias'): Promise<BackpackUploadResult> {
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
    console.log(`[BackpackUpload] Picked: ${asset.name} (${asset.mimeType}, ${asset.size} bytes)`);

    // 2. Read file content as text
    const documentText = await readDocumentText(asset);
    if (!documentText || documentText.trim().length < 20) {
      return { success: false, error: 'The document contains too little text to process.' };
    }

    console.log(`[BackpackUpload] Text extracted, length=${documentText.length}`);

    // 3. Send to server for GPT parsing
    const backpackData = await parseBackpackDocumentText(documentText, personaHint);
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
 * Read supported text locally. Raw files never leave the device.
 */
async function readDocumentText(asset: DocumentPicker.DocumentPickerAsset): Promise<string | null> {
  const { uri, mimeType, name } = asset;
  return extractLocalDocumentText({ uri, mimeType, name });
}

/**
 * Send document text to server for GPT-based backpack extraction
 */
export async function parseBackpackDocumentText(
  documentText: string,
  personaHint: 'elias' | 'kim',
): Promise<BackpackExtractedData | null> {
  try {
    const analysisText = minimizeAnalysisText(documentText).text;
    const language = getCurrentLanguage();
    const languageName = language === 'fr' ? 'French' : language === 'en' ? 'English' : 'Dutch';
    console.log(`[BackpackUpload] Sending minimized text through minimal proxy (${analysisText.length} chars)`);
    const parsed = await callMinimalProxyJson<Record<string, any>>({
      persona: personaHint,
      systemPrompt: `Extract an explicitly written life story into RecoFree Backpack JSON. Never diagnose, infer missing content, or mix narrator roles. Preserve original wording. Persona hint is ${personaHint}; only change userType when the document explicitly shows the narrator is the other role. Added labels must use ${languageName}. Return naam, userType, sections(childhood, adolescence, adulthood, family, themes), kimSections(my_story, the_relationship, the_impact, my_boundaries, my_strength), intakeContext(startEmotion, urgency, initialContext, stageOfChange). Missing fields are empty strings.`,
      messages: [{ role: 'user', content: analysisText }],
      model: 'gpt-4o-2024-08-06',
      maxTokens: 8000,
      temperature: 0,
      promptBuildVersion: 'backpack-document-extraction-client-v2',
    });
    const stringValue = (value: unknown) => typeof value === 'string' ? value : '';
    const sections = parsed.sections && typeof parsed.sections === 'object' ? parsed.sections : {};
    const kimSections = parsed.kimSections && typeof parsed.kimSections === 'object' ? parsed.kimSections : {};
    const intake = parsed.intakeContext && typeof parsed.intakeContext === 'object' ? parsed.intakeContext : {};
    const urgency = ['laag', 'midden', 'hoog'].includes(intake.urgency) ? intake.urgency : 'midden';
    return {
      naam: stringValue(parsed.naam),
      userType: parsed.userType === 'kim' || parsed.userType === 'elias' ? parsed.userType : personaHint,
      sections: {
        childhood: stringValue(sections.childhood), adolescence: stringValue(sections.adolescence),
        adulthood: stringValue(sections.adulthood), family: stringValue(sections.family), themes: stringValue(sections.themes),
      },
      kimSections: {
        my_story: stringValue(kimSections.my_story), the_relationship: stringValue(kimSections.the_relationship),
        the_impact: stringValue(kimSections.the_impact), my_boundaries: stringValue(kimSections.my_boundaries),
        my_strength: stringValue(kimSections.my_strength),
      },
      intakeContext: {
        startEmotion: stringValue(intake.startEmotion), urgency,
        initialContext: stringValue(intake.initialContext), stageOfChange: stringValue(intake.stageOfChange) || 'contemplation',
      },
    };
  } catch (err) {
    console.error('[BackpackUpload] minimal-proxy parse error:', err);
    return null;
  }
}
