/**
 * Nano-Interpret Proxy — Thin Server Endpoint
 * POST /api/nano-interpret
 *
 * Receives { userMessage, persona } from the client,
 * calls runNanoInterpret (OpenAI gpt-4.1-nano), and returns the result.
 *
 * No engine logic — just the nano interpretation call.
 * The client uses the result to feed into its local selectDominantState.
 */

import type { Express, Request, Response } from 'express';
import { runNanoInterpret, resolveModuleFromThemes } from './engine/nano-interpret';

export function registerNanoInterpretRoute(app: Express): void {
  app.post('/api/nano-interpret', async (req: Request, res: Response) => {
    try {
      const { userMessage, persona } = req.body || {};

      if (!userMessage || typeof userMessage !== 'string') {
        res.status(400).json({ success: false, error: 'userMessage is required' });
        return;
      }

      if (!persona || !['elias', 'kim'].includes(persona)) {
        res.status(400).json({ success: false, error: 'persona must be "elias" or "kim"' });
        return;
      }

      const nanoResult = await runNanoInterpret({ userMessage, persona });
      const moduleResolution = resolveModuleFromThemes(nanoResult.themes, persona);

      res.json({
        success: true,
        translatedNL: nanoResult.translatedNL,
        intent: nanoResult.intent,
        themes: nanoResult.themes,
        resolvedModule: moduleResolution.moduleId,
        matchedTheme: moduleResolution.matchedTheme,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[NanoInterpretProxy] Error:', message);

      if (message.includes('OPENAI_API_KEY')) {
        res.status(503).json({ success: false, error: 'API key not configured' });
        return;
      }

      res.status(500).json({ success: false, error: message });
    }
  });
}
