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

import { getApiBaseUrl } from '@/constants/oauth';

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
  locale: 'nl' | 'en' | 'fr' = 'nl'
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

  // Non-NL: call server to translate to Dutch via gpt-4o-mini
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    console.warn('[pre-translate] No API base URL — fallback to original');
    return {
      originalText: rawInput,
      processedText: trimmed,
      detectedLanguage: locale,
      wasTranslated: false,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(`${apiBaseUrl}/api/pre-translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed, locale }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[pre-translate] Server error ${response.status} — fallback to original`);
      return {
        originalText: rawInput,
        processedText: trimmed,
        detectedLanguage: locale,
        wasTranslated: false,
      };
    }

    const data = await response.json();

    if (data.wasTranslated && data.translatedText) {
      console.log(`[pre-translate] input: "${trimmed}" → NL: "${data.translatedText}"`);
      return {
        originalText: rawInput,
        processedText: data.translatedText,
        detectedLanguage: locale,
        wasTranslated: true,
      };
    }

    // Server returned but didn't translate (e.g., error fallback on server side)
    return {
      originalText: rawInput,
      processedText: data.translatedText || trimmed,
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
  apiBaseUrl: string
): Promise<PreprocessedInput> {
  return preprocessInput(rawInput, 'fr');
}
