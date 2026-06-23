/**
 * Pre-Translate Server Endpoint
 *
 * SAFETY-CRITICAL: Translates FR/EN user messages to Dutch (NL) BEFORE
 * all detection layers (trigger matching, zone detection, crisis detection,
 * SignalEngine). Without this, a French user writing about crisis or craving
 * would NOT be detected by the NL-based detection logic.
 *
 * Model: gpt-4o-mini (fast, cheap, sufficient for literal translation)
 * Temperature: 0 (deterministic, no creative interpretation)
 * Max tokens: 500 (user messages are typically short)
 *
 * Fallback: On ANY error, returns the original text unchanged.
 * A crisis message must NEVER be dropped or blocked.
 */
import type { Request, Response, Express } from 'express';

const PRE_TRANSLATE_SYSTEM_PROMPT =
  'Translate the following user message to Dutch. ' +
  'Preserve meaning, tone, and emotional intensity exactly. ' +
  'Do not interpret, soften, or add anything. ' +
  'Translate proper names literally. ' +
  'Output only the translation.';

export function registerPreTranslateRoute(app: Express): void {
  app.post('/api/pre-translate', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { text, locale } = req.body;

    // Validation
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Missing or invalid text' });
      return;
    }

    // Skip translation for Dutch — no API call needed
    if (locale === 'nl') {
      console.log('[pre-translate] skipped (nl)');
      res.json({
        translatedText: text,
        originalText: text,
        wasTranslated: false,
        locale: 'nl',
      });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Fallback: pass through original text, never block
      console.error('[pre-translate] OPENAI_API_KEY not configured — fallback to original');
      res.json({
        translatedText: text,
        originalText: text,
        wasTranslated: false,
        error: 'API key not configured',
      });
      return;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          store: false,
          messages: [
            { role: 'system', content: PRE_TRANSLATE_SYSTEM_PROMPT },
            { role: 'user', content: text },
          ],
          max_tokens: 500,
          temperature: 0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[pre-translate] OpenAI error ${response.status}: ${errorText} — fallback to original`);
        // FALLBACK: never drop the message
        res.json({
          translatedText: text,
          originalText: text,
          wasTranslated: false,
          error: `OpenAI ${response.status}`,
        });
        return;
      }

      const data = await response.json();
      const translatedText = data.choices?.[0]?.message?.content?.trim() || text;
      const elapsed = Date.now() - startTime;

      // Debug trace
      console.log(`[pre-translate] input: "${text}" → NL: "${translatedText}" (${elapsed}ms, locale=${locale || 'unknown'})`);

      res.json({
        translatedText,
        originalText: text,
        wasTranslated: true,
        locale: locale || 'unknown',
        elapsedMs: elapsed,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[pre-translate] Exception: ${errorMessage} — fallback to original`);
      // FALLBACK: never drop the message
      res.json({
        translatedText: text,
        originalText: text,
        wasTranslated: false,
        error: errorMessage,
      });
    }
  });
}
