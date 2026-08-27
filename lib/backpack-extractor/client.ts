/**
 * BackpackEntityExtractor — Client-built minimal-proxy extraction
 *
 * Calls the server-side extraction endpoint via direct fetch (same pattern as openai-provider).
 * Used by the extractor orchestrator when backpack content has changed.
 */

import type { ExtractedEntities } from './types';
import { extractEntitiesClient } from './client-extraction';

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
    const entities = await extractEntitiesClient(input, input.sourceHash);
    if (entities) {
      console.log('[BackpackExtractor] Extraction successful');
      return entities;
    }
    return null;
  } catch (error) {
    console.error('[BackpackExtractor] Network error:', error);
    return null;
  }
}
