/**
 * BackpackEntityExtractor — Server Client
 *
 * Calls the server-side extraction endpoint via direct fetch (same pattern as openai-provider).
 * Used by the extractor orchestrator when backpack content has changed.
 */

import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import type { ExtractedEntities } from './types';

interface ExtractionInput {
  userName: string;
  userType: 'elias' | 'kim';
  sections: Array<{ id: string; label: string; content: string }>;
  kimSections?: { my_story: string; the_relationship: string; the_impact: string; my_boundaries: string; my_strength: string };
  intakeContext: string;
  sourceHash: string;
}

/**
 * Call the server-side backpack extraction endpoint.
 * Returns ExtractedEntities on success, null on failure.
 * Non-blocking — failures are logged but don't crash the app.
 */
export async function callExtractionEndpoint(input: ExtractionInput): Promise<ExtractedEntities | null> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const token = await Auth.getSessionToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${apiBaseUrl}/api/trpc/ai.extractEntities`;

    console.log('[BackpackExtractor] Calling extraction endpoint:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        json: input,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BackpackExtractor] Server error:', response.status, errorText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    const result = data?.result?.data?.json;

    if (result?.success && result?.entities) {
      console.log('[BackpackExtractor] Extraction successful');
      return result.entities as ExtractedEntities;
    }

    console.warn('[BackpackExtractor] Unexpected response format:', JSON.stringify(data).substring(0, 200));
    return null;
  } catch (error) {
    console.error('[BackpackExtractor] Network error:', error);
    return null;
  }
}
