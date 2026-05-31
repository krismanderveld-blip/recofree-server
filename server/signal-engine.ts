/**
 * Signal Engine Server Endpoint
 *
 * Lightweight GPT-4o-mini proxy for the LocalSignalEngine preprocessing tasks.
 * Handles three small classification tasks: signal detection, relevance scoring,
 * and context summarization.
 *
 * Model: gpt-4o-mini always (never gpt-4o)
 * Max tokens: 150
 * Temperature: 0 (deterministic)
 */

import type { Request, Response, Express } from 'express';

export function registerSignalEngineRoute(app: Express): void {
  app.post('/api/signal-engine', async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Missing or invalid prompt' });
        return;
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
        return;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a classification assistant. Return only the requested format. No explanations.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 150,
          temperature: 0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SignalEngine] OpenAI error:', response.status, errorText);
        res.status(502).json({ error: `OpenAI error: ${response.status}` });
        return;
      }

      const data = await response.json();
      const result = data.choices?.[0]?.message?.content ?? '';

      res.json({ result });
    } catch (error) {
      console.error('[SignalEngine] Error:', error);
      res.status(500).json({ error: 'Internal signal engine error' });
    }
  });
}
