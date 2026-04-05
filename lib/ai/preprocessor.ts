/**
 * Input Preprocessor
 *
 * Handles language detection and translation of user input before
 * it reaches the Elias/Kim logic layer.
 *
 * Pipeline:
 *   Raw user input (any language)
 *     → Detect language
 *     → Translate to English (if needed)
 *     → Return English text for processing
 *
 * Mock phase: pass-through (assumes English input)
 * Backend phase: real detection + translation via OpenAI
 */

export interface PreprocessedInput {
  /** The original raw input from the user */
  originalText: string;
  /** The English-translated text for processing */
  processedText: string;
  /** Detected input language (ISO 639-1 code) */
  detectedLanguage: string;
  /** Whether translation was applied */
  wasTranslated: boolean;
}

/**
 * Preprocess user input: detect language and translate to English.
 *
 * In mock mode, this is a pass-through that assumes English.
 * When the backend is connected, this will call the translation API.
 */
export async function preprocessInput(rawInput: string): Promise<PreprocessedInput> {
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return {
      originalText: rawInput,
      processedText: '',
      detectedLanguage: 'en',
      wasTranslated: false,
    };
  }

  // Mock phase: simple heuristic language detection
  const detectedLanguage = detectLanguageHeuristic(trimmed);

  if (detectedLanguage === 'en') {
    return {
      originalText: rawInput,
      processedText: trimmed,
      detectedLanguage: 'en',
      wasTranslated: false,
    };
  }

  // Non-English detected in mock mode: pass through as-is
  // In production, this will call the backend translation endpoint
  // POST /api/translate { text, targetLanguage: 'en' }
  return {
    originalText: rawInput,
    processedText: trimmed, // Pass-through in mock mode
    detectedLanguage,
    wasTranslated: false, // Will be true when real translation is active
  };
}

/**
 * Backend-powered preprocessing (for production use).
 * Calls the backend API to detect language and translate.
 */
export async function preprocessInputViaBackend(
  rawInput: string,
  apiBaseUrl: string
): Promise<PreprocessedInput> {
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return {
      originalText: rawInput,
      processedText: '',
      detectedLanguage: 'en',
      wasTranslated: false,
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/preprocess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
    });

    if (!response.ok) {
      throw new Error(`Preprocess API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      originalText: rawInput,
      processedText: data.translatedText || trimmed,
      detectedLanguage: data.detectedLanguage || 'en',
      wasTranslated: data.wasTranslated || false,
    };
  } catch (error) {
    console.error('Preprocessing error, falling back to raw input:', error);
    return {
      originalText: rawInput,
      processedText: trimmed,
      detectedLanguage: 'unknown',
      wasTranslated: false,
    };
  }
}

/**
 * Simple heuristic language detection based on character ranges.
 * This is a rough approximation for the mock phase only.
 */
function detectLanguageHeuristic(text: string): string {
  // Check for non-Latin scripts first
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
  if (/[\uac00-\ud7af]/.test(text)) return 'ko';
  if (/[\u0600-\u06ff]/.test(text)) return 'ar';
  if (/[\u0400-\u04ff]/.test(text)) return 'ru';

  // For Latin-script languages, check common Dutch/German/French patterns
  const lowerText = text.toLowerCase();
  const dutchPatterns = /\b(ik|het|een|dat|niet|maar|ook|wel|nog|als|naar|voor|bij|uit|aan|heb|ben|kan|wil|zou|mijn|dit|die|deze|geen)\b/;
  if (dutchPatterns.test(lowerText)) return 'nl';

  const germanPatterns = /\b(ich|das|ein|nicht|aber|auch|noch|als|nach|für|bei|aus|hab|bin|kann|will|mein|dies|kein)\b/;
  if (germanPatterns.test(lowerText)) return 'de';

  const frenchPatterns = /\b(je|le|la|les|un|une|pas|mais|aussi|encore|pour|avec|dans|suis|peux|veux|mon|cette)\b/;
  if (frenchPatterns.test(lowerText)) return 'fr';

  const spanishPatterns = /\b(yo|el|la|los|un|una|no|pero|también|para|con|en|soy|puedo|quiero|mi|este|esta)\b/;
  if (spanishPatterns.test(lowerText)) return 'es';

  // Default to English
  return 'en';
}
