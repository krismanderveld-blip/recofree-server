/**
 * Dagstructuur Feature — Repository
 *
 * Encrypted persistence layer for DayStructureDocumentV1.
 * Uses the existing AES-256-GCM storage infrastructure.
 */

import { readEncrypted, writeEncrypted, removeEncrypted } from '@/lib/crypto/storage-encryption';
import type { DayStructureDocumentV1 } from './types';
import { STORAGE_KEYS } from './types';
import { createEmptyDocument } from './helpers';
import { validateWeek } from './validation';
import { DayStructureTimeAdapter } from './time-adapter';

// ─── Document Repository ────────────────────────────────────────────────────

/**
 * Load the day structure document from encrypted storage.
 * Returns null if no document exists.
 */
export async function loadDocument(): Promise<DayStructureDocumentV1 | null> {
  try {
    const raw = await readEncrypted(STORAGE_KEYS.DOCUMENT);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DayStructureDocumentV1;

    // Basic version check
    if (parsed.version !== 1) {
      console.warn('[DayStructure] Unknown document version:', parsed.version);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('[DayStructure] Failed to load document:', error);
    return null;
  }
}

/**
 * Save the day structure document to encrypted storage.
 * Updates lastEditedAt and timezoneAtLastPlanning automatically.
 */
export async function saveDocument(document: DayStructureDocumentV1): Promise<void> {
  const updated: DayStructureDocumentV1 = {
    ...document,
    lastEditedAt: new Date().toISOString(),
    timezoneAtLastPlanning: DayStructureTimeAdapter.getCurrentTimezone(),
  };

  const json = JSON.stringify(updated);
  await writeEncrypted(STORAGE_KEYS.DOCUMENT, json);
}

/**
 * Delete the day structure document from storage.
 */
export async function deleteDocument(): Promise<void> {
  await removeEncrypted(STORAGE_KEYS.DOCUMENT);
}

/**
 * Load or create the document. If none exists, creates an empty one
 * but does NOT persist it (only persisted after wizard completion).
 */
export async function loadOrCreateDocument(): Promise<DayStructureDocumentV1> {
  const existing = await loadDocument();
  if (existing) return existing;
  return createEmptyDocument(DayStructureTimeAdapter.getCurrentTimezone());
}

/**
 * Validate and save a document. Returns validation errors if invalid.
 * On success, saves and returns empty array.
 */
export async function validateAndSave(
  document: DayStructureDocumentV1,
): Promise<{ success: boolean; errors: string[] }> {
  const validationErrors = validateWeek(document.weekSchema);
  if (validationErrors.length > 0) {
    return {
      success: false,
      errors: validationErrors.map((e) => e.messageKey),
    };
  }

  await saveDocument(document);
  return { success: true, errors: [] };
}
