/**
 * Input Preprocessor — Pre-Translate Step
 *
 * SAFETY-CRITICAL: Translates FR/EN user messages to Dutch (NL) BEFORE
 * the pipeline's detection layers (trigger matching, zone detection,
 * crisis detection, SignalEngine). Without this, a French user writing
 * about crisis or craving would NOT be detected by the NL-based logic.
 *
 * Pipeline:
 *   Raw user input (any language)
 *     → If locale === 'nl': skip (no API call, no latency)
 *     → If locale !== 'nl': call server /api/pre-translate (gpt-4o-mini)
 *     → Return NL text for all detection layers
 *
 * Fallback: On ANY error, pass through the original text unchanged.
 * A crisis message must NEVER be dropped or blocked.
 */

import { callMinimalProxy } from '@/lib/ai/minimal-proxy-client';

export interface PreprocessedInput {
  /** The original raw input from the user */
  originalText: string;
  /** The NL-translated text for processing (all detection runs on this) */
  processedText: string;
  /** Detected/specified input language */
  detectedLanguage: string;
  /** Whether translation was applied */
  wasTranslated: boolean;
}

/**
 * Preprocess user input: translate to Dutch if locale !== 'nl'.
 *
 * @param rawInput - The raw user message
 * @param locale - The user's selected app language ('nl' | 'en' | 'fr')
 */
export async function preprocessInput(
  rawInput: string,
  locale: 'nl' | 'en' | 'fr' = 'nl',
  persona: 'elias' | 'kim' = 'elias',
): Promise<PreprocessedInput> {
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return {
      originalText: rawInput,
      processedText: '',
      detectedLanguage: locale,
      wasTranslated: false,
    };
  }

  // NL users: skip entirely — no API call, no latency cost
  if (locale === 'nl') {
    console.log('[pre-translate] skipped (nl)');
    return {
      originalText: rawInput,
      processedText: trimmed,
      detectedLanguage: 'nl',
      wasTranslated: false,
    };
  }

  // Non-NL: call Railway to translate to Dutch via gpt-4o-mini
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const result = await callMinimalProxy({
      persona,
      systemPrompt: `Translate the user's ${locale === 'fr' ? 'French' : 'English'} message to Dutch. Preserve exact meaning, urgency, negation, substance-use language and crisis language. Return only the Dutch translation, with no explanation or labels.`,
      messages: [{ role: 'user', content: trimmed }],
      model: 'gpt-4o-mini',
      maxTokens: 400,
      temperature: 0,
      promptBuildVersion: 'pre-translate-client-v2',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const translatedText = result.text.trim();
    if (translatedText) {
      console.log(`[pre-translate] input: "${trimmed}" → NL: "${translatedText}"`);
      return {
        originalText: rawInput,
        processedText: translatedText,
        detectedLanguage: locale,
        wasTranslated: true,
      };
    }

    return {
      originalText: rawInput,
      processedText: trimmed,
      detectedLanguage: locale,
      wasTranslated: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[pre-translate] Exception: ${errorMessage} — fallback to original`);
    // FALLBACK: never drop the message — pass through original
    return {
      originalText: rawInput,
      processedText: trimmed,
      detectedLanguage: locale,
      wasTranslated: false,
    };
  }
}

/**
 * @deprecated Use preprocessInput with locale parameter instead.
 * Kept for backward compatibility.
 */
export async function preprocessInputViaBackend(
  rawInput: string,
  _apiBaseUrl: string
): Promise<PreprocessedInput> {
  return preprocessInput(rawInput, 'fr');
}
