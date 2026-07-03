/**
 * nano-interpret-client.ts — Client-side nano-interpret caller
 *
 * Calls the Railway /api/nano-interpret proxy to get semantic interpretation
 * of the user message (themes, intent, resolvedModule) from gpt-4.1-nano.
 *
 * Used in the client pipeline BEFORE selectDominantState() to replace
 * keyword-based module detection with semantic understanding.
 */

import { getApiBaseUrl } from '@/constants/oauth';

export interface ClientNanoInterpretResult {
  translatedNL: string;
  intent: string;
  themes: string[];
  resolvedModule: string | null;
  matchedTheme: string | null;
}

/**
 * Call the nano-interpret proxy on Railway.
 * Returns null on failure (caller should fall back to keyword matching).
 * Timeout: 8s (nano is fast, but Railway cold starts can add latency).
 */
export async function callNanoInterpret(
  userMessage: string,
  persona: 'elias' | 'kim',
): Promise<ClientNanoInterpretResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/nano-interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage, persona }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[NanoInterpretClient] Proxy returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.success) {
      console.warn('[NanoInterpretClient] Proxy returned success=false:', data.error);
      return null;
    }

    return {
      translatedNL: data.translatedNL ?? userMessage,
      intent: data.intent ?? 'exploring',
      themes: Array.isArray(data.themes) ? data.themes : [],
      resolvedModule: data.resolvedModule ?? null,
      matchedTheme: data.matchedTheme ?? null,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn('[NanoInterpretClient] Timeout (8s) — falling back to keyword matching');
    } else {
      console.warn('[NanoInterpretClient] Error:', err.message ?? err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
