/**
 * Hook that provides ExportImportStores interface backed by the real AsyncStorage stores.
 * Adapts the per-persona stores and legacy AsyncStorage keys to the export/import interface.
 *
 * IMPORTANT: This adapter must stay in sync with the at-rest encryption layer.
 * Memory store keys (recofree_memory/{persona}/user.dat, state.dat, projections.dat)
 * are encrypted via RF_ENC_V1 and must be read/written through readEncrypted/writeEncrypted.
 * logs.dat has its own encryption envelope and is stored as plain JSON in AsyncStorage
 * (the envelope itself is the encrypted format).
 */

import { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readEncrypted, writeEncrypted, removeEncrypted, SENSITIVE_KEYS, MEMORY_STORE_KEYS } from '@/lib/crypto/storage-encryption';
import type { ExportImportStores } from '../services/exportImportStores.types';

// AsyncStorage keys used by the app
const LEGACY_USERDAT_KEY = '@recofree_userdat';
const LEGACY_BACKPACK_KEY = '@recofree_backpack';
const DIARY_KEY = '@recofree_diary';
const ELIAS_PROJECTION_KEY = '@recofree_projection_elias';
const KIM_PROJECTION_KEY = '@recofree_projection_kim';
const EMERGENCY_CONTACTS_KEY = 'emergencyContacts';
const BACKPACK_HASH_KEY = '@recofree_backpack_hash';
const EXTRACTED_ENTITIES_KEY = '@recofree_extracted_entities';
const VSP_PROFILE_KEY = '@vsp_backpack_profile';
const VSP_HASH_KEY = '@vsp_backpack_hash';

// Memory store keys
function getUserDatKey(persona: string) { return `recofree_memory/${persona}/user.dat`; }
function getStateDatKey(persona: string) { return `recofree_memory/${persona}/state.dat`; }
function getProjectionsDatKey(persona: string) { return `recofree_memory/${persona}/projections.dat`; }
function getLogsDatKey(persona: string) { return `recofree_memory/${persona}/logs.dat`; }

/**
 * FIX #1: Check both SENSITIVE_KEYS and MEMORY_STORE_KEYS to determine if a key
 * needs to go through the encrypted storage layer.
 * logs.dat is NOT in either list (it has its own envelope encryption).
 */
function isKeyEncrypted(key: string): boolean {
  return (
    (SENSITIVE_KEYS as readonly string[]).includes(key) ||
    (MEMORY_STORE_KEYS as readonly string[]).includes(key)
  );
}

/**
 * Read a JSON value from storage, routing through encrypted layer when needed.
 * Returns null if key doesn't exist or parse fails.
 */
async function readJson(key: string): Promise<unknown | null> {
  try {
    const raw = isKeyEncrypted(key)
      ? await readEncrypted(key)
      : await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * Write a JSON value to storage, routing through encrypted layer when needed.
 */
async function writeJson(key: string, value: unknown): Promise<void> {
  if (value === null || value === undefined) {
    if (isKeyEncrypted(key)) {
      await removeEncrypted(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  } else {
    if (isKeyEncrypted(key)) {
      await writeEncrypted(key, JSON.stringify(value));
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    }
  }
}

/**
 * FIX #2: Safe read that returns a sentinel marker when a key exists but cannot be read.
 * This prevents the pre-import snapshot from containing null for keys that actually
 * have data (e.g. encrypted data that failed to decrypt). The snapshot uses this to
 * distinguish "key genuinely empty" from "key exists but read failed".
 */
const SNAPSHOT_READ_FAILED = Symbol('SNAPSHOT_READ_FAILED');
type SnapshotValue = unknown | null | typeof SNAPSHOT_READ_FAILED;

async function readJsonForSnapshot(key: string): Promise<SnapshotValue> {
  try {
    const raw = isKeyEncrypted(key)
      ? await readEncrypted(key)
      : await AsyncStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch {
    // Key exists but read/decrypt/parse failed — check if key actually has data
    try {
      const exists = await AsyncStorage.getItem(key);
      if (exists !== null) {
        // Key has data we can't read — mark as failed so rollback preserves it
        return SNAPSHOT_READ_FAILED;
      }
    } catch { /* ignore */ }
    return null;
  }
}

/**
 * FIX #2 continued: Safe write for rollback that skips keys marked as SNAPSHOT_READ_FAILED.
 * If the snapshot value is SNAPSHOT_READ_FAILED, we do NOT overwrite the key — the original
 * encrypted data is still in AsyncStorage and must be preserved.
 */
async function writeJsonForRollback(key: string, value: SnapshotValue): Promise<void> {
  if (value === SNAPSHOT_READ_FAILED) {
    // Original data exists but couldn't be read — do NOT overwrite, preserve as-is
    return;
  }
  await writeJson(key, value);
}

/**
 * Build the store adapter (shared between hook and non-hook versions).
 */
function buildStoresAdapter(): ExportImportStores {
  return {
    userDatStore: {
      async exportAllPersonas() {
        const [elias, kim, legacy] = await Promise.all([
          readJson(getUserDatKey('elias')),
          readJson(getUserDatKey('kim')),
          readJson(LEGACY_USERDAT_KEY),
        ]);
        return { elias: elias ?? legacy ?? null, kim: kim ?? null };
      },
      async replaceAllPersonas(data) {
        await Promise.all([
          writeJson(getUserDatKey('elias'), data.elias),
          writeJson(getUserDatKey('kim'), data.kim),
          writeJson(LEGACY_USERDAT_KEY, data.elias ?? data.kim),
        ]);
      },
    },
    stateDatStore: {
      async exportAllPersonas() {
        const [elias, kim] = await Promise.all([
          readJson(getStateDatKey('elias')),
          readJson(getStateDatKey('kim')),
        ]);
        return { elias: elias ?? null, kim: kim ?? null };
      },
      async replaceAllPersonas(data) {
        await Promise.all([
          writeJson(getStateDatKey('elias'), data.elias),
          writeJson(getStateDatKey('kim'), data.kim),
        ]);
      },
    },
    projectionsDatStore: {
      async exportAllPersonas() {
        const [elias, kim] = await Promise.all([
          readJson(getProjectionsDatKey('elias')),
          readJson(getProjectionsDatKey('kim')),
        ]);
        return { elias: elias ?? null, kim: kim ?? null };
      },
      async replaceAllPersonas(data) {
        await Promise.all([
          writeJson(getProjectionsDatKey('elias'), data.elias),
          writeJson(getProjectionsDatKey('kim'), data.kim),
        ]);
      },
    },
    logsDatStore: {
      /**
       * FIX #3: logs.dat uses its own encryption envelope (logs.dat.encrypted.v2).
       * The export reads the raw encrypted envelope object from AsyncStorage.
       * The import writes it back as-is — no RF_ENC_V1 layer needed.
       * This is correct because logs.dat keys are excluded from isKeyEncrypted().
       */
      async exportAllPersonasRaw() {
        const [elias, kim] = await Promise.all([
          readJson(getLogsDatKey('elias')),
          readJson(getLogsDatKey('kim')),
        ]);
        return { elias: elias ?? null, kim: kim ?? null };
      },
      async replaceAllPersonasRaw(data) {
        await Promise.all([
          writeJson(getLogsDatKey('elias'), data.elias),
          writeJson(getLogsDatKey('kim'), data.kim),
        ]);
      },
    },
    diaryStore: {
      async exportAllPersonas() {
        const entries = await readJson(DIARY_KEY);
        const arr = Array.isArray(entries) ? entries : [];
        return { elias: arr, kim: [] };
      },
      async replaceAllPersonas(data) {
        const entries = data.elias ?? data.kim ?? [];
        await writeJson(DIARY_KEY, entries);
      },
    },
    gratitudeStore: {
      async exportAllPersonas() {
        const entries = await readJson(DIARY_KEY);
        const arr = Array.isArray(entries) ? entries : [];
        const gratitudeEntries = arr.filter((e: any) => e?.gratitude);
        return { elias: gratitudeEntries, kim: [] };
      },
      async replaceAllPersonas(_data) {
        // Gratitude is part of diary entries — handled by diaryStore.replaceAllPersonas
      },
    },
    backpackStore: {
      async exportAllPersonas() {
        const backpack = await readJson(LEGACY_BACKPACK_KEY);
        return { elias: backpack ?? null, kim: null };
      },
      async replaceAllPersonas(data) {
        await writeJson(LEGACY_BACKPACK_KEY, data.elias ?? data.kim ?? null);
      },
    },

    // ─── Persona Projection Store ────────────────────────────────────────────

    personaProjectionStore: {
      async exportAllPersonas() {
        const [elias, kim] = await Promise.all([
          readJson(ELIAS_PROJECTION_KEY),
          readJson(KIM_PROJECTION_KEY),
        ]);
        return { elias: elias ?? null, kim: kim ?? null };
      },
      async replaceAllPersonas(data) {
        await Promise.all([
          writeJson(ELIAS_PROJECTION_KEY, data.elias),
          writeJson(KIM_PROJECTION_KEY, data.kim),
        ]);
      },
    },

    // ─── Emergency Contacts Store ────────────────────────────────────────────

    emergencyContactsStore: {
      async exportAll() {
        const contacts = await readJson(EMERGENCY_CONTACTS_KEY);
        return Array.isArray(contacts) ? contacts : [];
      },
      async replaceAll(data) {
        await writeJson(EMERGENCY_CONTACTS_KEY, Array.isArray(data) ? data : []);
      },
    },

    // ─── Derived Cache Store ─────────────────────────────────────────────────

    derivedCacheStore: {
      async exportAll() {
        const [backpackHash, extractedEntities, vspProfile, vspHash] = await Promise.all([
          readJson(BACKPACK_HASH_KEY),
          readJson(EXTRACTED_ENTITIES_KEY),
          readJson(VSP_PROFILE_KEY),
          readJson(VSP_HASH_KEY),
        ]);
        return { backpackHash: backpackHash ?? null, extractedEntities: extractedEntities ?? null, vspProfile: vspProfile ?? null, vspHash: vspHash ?? null };
      },
      async replaceAll(data) {
        await Promise.all([
          writeJson(BACKPACK_HASH_KEY, data.backpackHash),
          writeJson(EXTRACTED_ENTITIES_KEY, data.extractedEntities),
          writeJson(VSP_PROFILE_KEY, (data as any).vspProfile),
          writeJson(VSP_HASH_KEY, (data as any).vspHash),
        ]);
      },
    },
  };
}

export function useExportImportStores(): ExportImportStores {
  return useMemo<ExportImportStores>(() => buildStoresAdapter(), []);
}

/**
 * Non-hook version of the stores adapter.
 * Use this outside of React components (e.g. in intake import flow).
 */
export function createExportImportStoresAdapter(): ExportImportStores {
  return buildStoresAdapter();
}

// ─── Safe Snapshot API (FIX #2) ─────────────────────────────────────────────
// These are used by importStagingService for pre-import snapshots and rollback.
// They ensure that a failed import NEVER wipes existing data.

export interface SafePreImportSnapshot {
  keys: Array<{ key: string; value: SnapshotValue }>;
}

/**
 * Create a safe pre-import snapshot of ALL sensitive keys.
 * Unlike the store-based snapshot, this captures raw key-value pairs
 * and marks unreadable keys as SNAPSHOT_READ_FAILED to prevent data loss.
 */
export async function createSafePreImportSnapshot(): Promise<SafePreImportSnapshot> {
  // All keys that could be affected by import
  const allKeys = [
    getUserDatKey('elias'), getUserDatKey('kim'),
    getStateDatKey('elias'), getStateDatKey('kim'),
    getProjectionsDatKey('elias'), getProjectionsDatKey('kim'),
    getLogsDatKey('elias'), getLogsDatKey('kim'),
    LEGACY_USERDAT_KEY, LEGACY_BACKPACK_KEY, DIARY_KEY,
    ELIAS_PROJECTION_KEY, KIM_PROJECTION_KEY,
    EMERGENCY_CONTACTS_KEY, BACKPACK_HASH_KEY,
    EXTRACTED_ENTITIES_KEY, VSP_PROFILE_KEY, VSP_HASH_KEY,
  ];

  const entries = await Promise.all(
    allKeys.map(async (key) => ({
      key,
      value: await readJsonForSnapshot(key),
    }))
  );

  return { keys: entries };
}

/**
 * Restore a safe pre-import snapshot.
 * Keys marked as SNAPSHOT_READ_FAILED are NOT overwritten — their original
 * encrypted data remains intact in AsyncStorage.
 */
export async function restoreSafePreImportSnapshot(snapshot: SafePreImportSnapshot): Promise<void> {
  await Promise.all(
    snapshot.keys.map(({ key, value }) => writeJsonForRollback(key, value))
  );
}
