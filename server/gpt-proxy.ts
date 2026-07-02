/**
 * GPT Proxy — Thin Server Endpoint
 * POST /api/gpt-proxy
 *
 * Receives the full ChatRequestInput payload from the client (already normalized),
 * validates it with chatInputSchema, calls generateAIResponse (OpenAI), and returns
 * { response, tokenUsage, selectedModel }.
 *
 * No engine logic, no state management, no format adapters.
 * The client runs the full engine locally and sends the ready-to-use payload.
 */

import type { Express, Request, Response } from 'express';
import { chatInputSchema, generateAIResponse } from './ai-chat';

export function registerGptProxyRoute(app: Express): void {
  app.post('/api/gpt-proxy', async (req: Request, res: Response) => {
    try {
      const body = req.body;

      if (!body || typeof body !== 'object') {
        res.status(400).json({ success: false, error: 'Request body is required' });
        return;
      }

      // Validate with chatInputSchema (passthrough allows extra fields)
      const parseResult = chatInputSchema.safeParse(body);
      if (!parseResult.success) {
        const errors = parseResult.error.issues.slice(0, 5).map((e: any) => `${(e.path || []).join('.')}: ${e.message}`);
        console.error('[GptProxy] Validation failed:', errors);
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors,
        });
        return;
      }

      const input = parseResult.data as any;
      console.log(`[GptProxy] Processing request: userType=${input.userType}, userName=${input.userName}, module=${input.dominantModule}, isSessionStart=${input.isSessionStart}`);

      // Call generateAIResponse (handles model selection, prompt building, OpenAI call)
      const result = await generateAIResponse(input);

      console.log(`[GptProxy] Response generated: model=${result.selectedModel}, tokens=${result.tokenUsage?.totalTokens ?? 'unknown'}, responseLength=${result.response.length}`);

      res.json({
        success: true,
        response: result.response,
        advisoryEmotion: result.advisoryEmotion ?? null,
        advisoryConfidence: result.advisoryConfidence ?? null,
        tokenUsage: result.tokenUsage ?? null,
        selectedModel: result.selectedModel ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[GptProxy] Error:', message);

      // Distinguish between missing API key and other errors
      if (message.includes('OPENAI_API_KEY')) {
        res.status(500).json({ success: false, error: 'OPENAI_API_KEY not configured' });
      } else {
        res.status(502).json({ success: false, error: message });
      }
    }
  });
}
