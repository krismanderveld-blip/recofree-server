/**
 * Debug Prompt Endpoint — DEV MODE ONLY
 * Returns the full system prompt that would be sent to GPT for a given session.
 * 
 * GET /api/debug/prompt
 * Returns: { systemPrompt, relationshipMap, sessionCache, messageCount }
 * 
 * POST /api/debug/prompt
 * Body: ChatRequestInput (same as ai.chat)
 * Returns: { systemPrompt } — builds and returns the full prompt without calling GPT
 */
import type { Express } from 'express';
import { buildSystemPrompt, chatInputSchema } from './ai-chat';

// Module-level reference to the session cache (imported via getter)
let getSessionCacheRef: (() => any) | null = null;

export function setSessionCacheGetter(getter: () => any) {
  getSessionCacheRef = getter;
}

export function registerDebugPromptRoute(app: Express) {
  // Only register in development
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  // GET: Return current session cache state (lightweight)
  app.get('/api/debug/prompt', (_req, res) => {
    const cache = getSessionCacheRef?.();
    if (!cache) {
      res.json({
        status: 'no_session',
        message: 'No active session cache. Start a session first.',
      });
      return;
    }

    res.json({
      status: 'active',
      messageCount: cache.messageCount,
      relationshipMap: cache.relationshipMap || '(empty)',
      lifeStorySummary: cache.lifeStorySummary ? cache.lifeStorySummary.substring(0, 500) + '...' : '(empty)',
      structuredMemory: cache.structuredMemory ? cache.structuredMemory.substring(0, 500) + '...' : '(empty)',
      sessionAnalysesSummary: cache.sessionAnalysesSummary ? cache.sessionAnalysesSummary.substring(0, 500) + '...' : '(empty)',
      diaryMemory: cache.diaryMemory ? cache.diaryMemory.substring(0, 300) + '...' : '(empty)',
      cachedAt: cache.cachedAt,
    });
  });

  // POST: Build and return the full system prompt for given input
  app.post('/api/debug/prompt', (req, res) => {
    try {
      const parsed = chatInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid input',
          details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        });
        return;
      }

      const systemPrompt = buildSystemPrompt(parsed.data as any);

      res.json({
        status: 'ok',
        systemPrompt,
        promptLength: systemPrompt.length,
        estimatedTokens: Math.ceil(systemPrompt.length / 4),
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'Failed to build prompt',
        message: err.message,
      });
    }
  });

  console.log('[debug] /api/debug/prompt endpoint registered (dev mode only)');
}
