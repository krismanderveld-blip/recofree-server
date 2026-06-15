/**
 * Session Greeting Engine — Server Endpoint
 * POST /api/session-greeting
 * 
 * Accepts a system prompt from the client-side engine and generates a greeting via GPT-4o.
 * Model: gpt-4o, store: false, max_tokens: 150, temperature: 0.7
 */

import type { Express, Request, Response } from 'express';

export function registerSessionGreetingRoute(app: Express): void {
  app.post('/api/session-greeting', async (req: Request, res: Response) => {
    try {
      const { systemPrompt, userName } = req.body;

      if (!systemPrompt || typeof systemPrompt !== 'string') {
        res.status(400).json({ error: 'systemPrompt is required and must be a string' });
        return;
      }
      if (!userName || typeof userName !== 'string') {
        res.status(400).json({ error: 'userName is required and must be a string' });
        return;
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
        return;
      }

      console.log(`[SessionGreeting] Generating greeting for userName="${userName}", promptLength=${systemPrompt.length}`);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          store: false,
          temperature: 0.7,
          max_tokens: 150,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Genereer een persoonlijke begroeting voor ${userName}.` },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SessionGreeting] OpenAI error:', response.status, errorText);
        res.status(502).json({ error: `OpenAI error: ${response.status}` });
        return;
      }

      const data = await response.json() as any;
      const greeting = data.choices?.[0]?.message?.content?.trim();

      if (!greeting) {
        console.error('[SessionGreeting] No content in response');
        res.status(502).json({ error: 'No greeting in GPT response' });
        return;
      }

      console.log(`[SessionGreeting] Success: "${greeting.slice(0, 60)}..."`);

      res.json({
        success: true,
        greeting,
      });
    } catch (error) {
      console.error('[SessionGreeting] Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
