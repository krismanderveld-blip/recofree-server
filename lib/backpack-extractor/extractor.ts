/**
 * BackpackEntityExtractor — Client-side Orchestrator
 *
 * Coordinates the extraction flow:
 * 1. Compute hash of current backpack content
 * 2. Compare with stored hash (change detection)
 * 3. If changed: call server LLM extraction endpoint
 * 4. Persist extracted entities + new hash to AsyncStorage
 *
 * Called from user-context.tsx on backpack save (updateBackpackSection, updateKimBackpackSection).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { readEncrypted, writeEncrypted } from '@/lib/crypto/storage-encryption';
import { computeBackpackHash, hasBackpackChanged } from './hash';
import type { BackpackHashState, ExtractedEntities } from './types';
import { BACKPACK_HASH_KEY, EXTRACTION_SCHEMA_VERSION as CURRENT_SCHEMA_VERSION } from './types';
import type { Backpack } from '../ai/types';

// ─── Storage Keys ──────────────────────────────────────────────

const EXTRACTED_ENTITIES_KEY = '@recofree_extracted_entities';

// ─── Load/Save Hash State ──────────────────────────────────────

export async function loadBackpackHash(): Promise<BackpackHashState | null> {
  try {
    const json = await AsyncStorage.getItem(BACKPACK_HASH_KEY);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export async function saveBackpackHash(hash: BackpackHashState): Promise<void> {
  await AsyncStorage.setItem(BACKPACK_HASH_KEY, JSON.stringify(hash));
}

// ─── Load/Save Extracted Entities ──────────────────────────────

export async function loadExtractedEntities(): Promise<ExtractedEntities | null> {
  try {
    const json = await readEncrypted(EXTRACTED_ENTITIES_KEY);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export async function saveExtractedEntities(entities: ExtractedEntities): Promise<void> {
  await writeEncrypted(EXTRACTED_ENTITIES_KEY, JSON.stringify(entities));
}

// ─── Main Extraction Orchestrator ──────────────────────────────

/**
 * Check if backpack changed and trigger extraction if needed.
 * Returns the (possibly updated) extracted entities.
 *
 * This is a fire-and-forget operation — if extraction fails,
 * the previous entities remain valid. Never blocks the user.
 *
 * @param backpack - Current backpack state
 * @param trpcClient - tRPC client for calling the extraction endpoint
 * @returns ExtractedEntities (new or cached)
 */
export async function checkAndExtract(
  backpack: Backpack,
  callExtraction: (input: {
    userName: string;
    userType: 'elias' | 'kim';
    sections: Array<{ id: string; label: string; content: string }>;
    kimSections?: { my_story: string; the_relationship: string; the_impact: string; my_boundaries: string; my_strength: string };
    intakeContext: string;
    sourceHash: string;
  }) => Promise<ExtractedEntities | null>,
): Promise<ExtractedEntities | null> {
  try {
    // 1. Compute current hash
    const currentHash = computeBackpackHash(backpack);

    // 2. Load previous hash
    const previousHash = await loadBackpackHash();

    // 3. Check if changed OR schema version outdated
    const cachedEntities = await loadExtractedEntities();
    const schemaOutdated = cachedEntities && cachedEntities.schemaVersion < CURRENT_SCHEMA_VERSION;
    if (!hasBackpackChanged(currentHash, previousHash) && !schemaOutdated) {
      // No change and schema current — return cached entities
      console.log('[BackpackExtractor] No change detected, using cached entities');
      return cachedEntities;
    }
    if (schemaOutdated) {
      console.log(`[BackpackExtractor] Schema outdated (${cachedEntities.schemaVersion} → ${CURRENT_SCHEMA_VERSION}), re-extracting...`);
    }

    console.log('[BackpackExtractor] Change detected, triggering extraction...');

    // 4. Call server extraction
    const sections = backpack.sections.map(s => ({
      id: s.id,
      label: s.label ?? s.id,
      content: s.content,
    }));

    const entities = await callExtraction({
      userName: backpack.naam,
      userType: backpack.userType,
      sections,
      kimSections: backpack.kimBackpack,
      intakeContext: backpack.intakeContext.initialContext,
      sourceHash: currentHash.combinedHash,
    });

    if (entities) {
      // 5. Persist new entities + hash
      await saveExtractedEntities(entities);
      await saveBackpackHash(currentHash);
      console.log('[BackpackExtractor] Extraction complete, persisted');
      return entities;
    }

    // Extraction failed — keep old entities
    return await loadExtractedEntities();
  } catch (error) {
    console.error('[BackpackExtractor] Orchestration error:', error);
    // Non-blocking — return cached entities
    return await loadExtractedEntities();
  }
}

/**
 * Force re-extraction regardless of hash state.
 * Used after initial intake or manual reset.
 */
export async function forceExtract(
  backpack: Backpack,
  callExtraction: (input: {
    userName: string;
    userType: 'elias' | 'kim';
    sections: Array<{ id: string; label: string; content: string }>;
    kimSections?: { my_story: string; the_relationship: string; the_impact: string; my_boundaries: string; my_strength: string };
    intakeContext: string;
    sourceHash: string;
  }) => Promise<ExtractedEntities | null>,
): Promise<ExtractedEntities | null> {
  try {
    const currentHash = computeBackpackHash(backpack);
    const sections = backpack.sections.map(s => ({
      id: s.id,
      label: s.label ?? s.id,
      content: s.content,
    }));

    const entities = await callExtraction({
      userName: backpack.naam,
      userType: backpack.userType,
      sections,
      kimSections: backpack.kimBackpack,
      intakeContext: backpack.intakeContext.initialContext,
      sourceHash: currentHash.combinedHash,
    });

    if (entities) {
      await saveExtractedEntities(entities);
      await saveBackpackHash(currentHash);
      return entities;
    }

    return null;
  } catch (error) {
    console.error('[BackpackExtractor] Force extraction error:', error);
    return null;
  }
}

/**
 * Check if backpack has changed since last extraction (without triggering extraction).
 * Used by the pipeline to decide whether to send full backpack or just entities.
 */
export async function hasBackpackChangedSinceExtraction(backpack: Backpack): Promise<boolean> {
  const currentHash = computeBackpackHash(backpack);
  const previousHash = await loadBackpackHash();
  return hasBackpackChanged(currentHash, previousHash);
}
