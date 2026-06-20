/**
 * Hook that provides ExportImportStores interface backed by the real AsyncStorage stores.
 * Adapts the per-persona stores and legacy AsyncStorage keys to the export/import interface.
 */

import { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readEncrypted, writeEncrypted, removeEncrypted, SENSITIVE_KEYS } from '@/lib/crypto/storage-encryption';
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

async function readJson(key: string): Promise<unknown | null> {
  try {
    const isSensitive = (SENSITIVE_KEYS as readonly string[]).includes(key);
    const raw = isSensitive
      ? await readEncrypted(key)
      : await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  const isSensitive = (SENSITIVE_KEYS as readonly string[]).includes(key);
  if (value === null || value === undefined) {
    if (isSensitive) {
      await removeEncrypted(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  } else {
    if (isSensitive) {
      await writeEncrypted(key, JSON.stringify(value));
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    }
  }
}

export function useExportImportStores(): ExportImportStores {
  return useMemo<ExportImportStores>(() => ({
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
        // Diary entries are stored under a single key, persona is determined by app state
        const entries = await readJson(DIARY_KEY);
        const arr = Array.isArray(entries) ? entries : [];
        // All diary entries are from the active persona (elias by default)
        return { elias: arr, kim: [] };
      },
      async replaceAllPersonas(data) {
        const entries = data.elias ?? data.kim ?? [];
        await writeJson(DIARY_KEY, entries);
      },
    },
    gratitudeStore: {
      async exportAllPersonas() {
        // Gratitude is embedded in diary entries as sub-objects
        const entries = await readJson(DIARY_KEY);
        const arr = Array.isArray(entries) ? entries : [];
        const gratitudeEntries = arr.filter((e: any) => e?.gratitude);
        return { elias: gratitudeEntries, kim: [] };
      },
      async replaceAllPersonas(_data) {
        // Gratitude is part of diary entries — handled by diaryStore.replaceAllPersonas
        // This is a no-op to avoid double-writing
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

    // ─── NEW: Persona Projection Store ────────────────────────────────────────

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

    // ─── NEW: Emergency Contacts Store ────────────────────────────────────────

    emergencyContactsStore: {
      async exportAll() {
        const contacts = await readJson(EMERGENCY_CONTACTS_KEY);
        return Array.isArray(contacts) ? contacts : [];
      },
      async replaceAll(data) {
        await writeJson(EMERGENCY_CONTACTS_KEY, Array.isArray(data) ? data : []);
      },
    },

    // ─── NEW: Derived Cache Store ─────────────────────────────────────────────

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
  }), []);
}

/**
 * Non-hook version of the stores adapter.
 * Use this outside of React components (e.g. in intake import flow).
 */
export function createExportImportStoresAdapter(): ExportImportStores {
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
        const [elias, kim] = await Promise.all([readJson(getStateDatKey('elias')), readJson(getStateDatKey('kim'))]);
        return { elias: elias ?? null, kim: kim ?? null };
      },
      async replaceAllPersonas(data) {
        await Promise.all([writeJson(getStateDatKey('elias'), data.elias), writeJson(getStateDatKey('kim'), data.kim)]);
      },
    },
    projectionsDatStore: {
      async exportAllPersonas() {
        const [elias, kim] = await Promise.all([readJson(getProjectionsDatKey('elias')), readJson(getProjectionsDatKey('kim'))]);
        return { elias: elias ?? null, kim: kim ?? null };
      },
      async replaceAllPersonas(data) {
        await Promise.all([writeJson(getProjectionsDatKey('elias'), data.elias), writeJson(getProjectionsDatKey('kim'), data.kim)]);
      },
    },
    logsDatStore: {
      async exportAllPersonasRaw() {
        const [elias, kim] = await Promise.all([readJson(getLogsDatKey('elias')), readJson(getLogsDatKey('kim'))]);
        return { elias: elias ?? null, kim: kim ?? null };
      },
      async replaceAllPersonasRaw(data) {
        await Promise.all([writeJson(getLogsDatKey('elias'), data.elias), writeJson(getLogsDatKey('kim'), data.kim)]);
      },
    },
    diaryStore: {
      async exportAllPersonas() {
        const entries = await readJson(DIARY_KEY);
        const arr = Array.isArray(entries) ? entries : [];
        return { elias: arr, kim: [] };
      },
      async replaceAllPersonas(data) {
        await writeJson(DIARY_KEY, data.elias ?? data.kim ?? []);
      },
    },
    gratitudeStore: {
      async exportAllPersonas() {
        const entries = await readJson(DIARY_KEY);
        const arr = Array.isArray(entries) ? entries : [];
        return { elias: arr.filter((e: any) => e?.gratitude), kim: [] };
      },
      async replaceAllPersonas(_data) { /* no-op */ },
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
    personaProjectionStore: {
      async exportAllPersonas() {
        const [elias, kim] = await Promise.all([readJson(ELIAS_PROJECTION_KEY), readJson(KIM_PROJECTION_KEY)]);
        return { elias: elias ?? null, kim: kim ?? null };
      },
      async replaceAllPersonas(data) {
        await Promise.all([writeJson(ELIAS_PROJECTION_KEY, data.elias), writeJson(KIM_PROJECTION_KEY, data.kim)]);
      },
    },
    emergencyContactsStore: {
      async exportAll() {
        const contacts = await readJson(EMERGENCY_CONTACTS_KEY);
        return Array.isArray(contacts) ? contacts : [];
      },
      async replaceAll(data) {
        await writeJson(EMERGENCY_CONTACTS_KEY, Array.isArray(data) ? data : []);
      },
    },
    derivedCacheStore: {
      async exportAll() {
        const [backpackHash, extractedEntities, vspProfile, vspHash] = await Promise.all([readJson(BACKPACK_HASH_KEY), readJson(EXTRACTED_ENTITIES_KEY), readJson(VSP_PROFILE_KEY), readJson(VSP_HASH_KEY)]);
        return { backpackHash: backpackHash ?? null, extractedEntities: extractedEntities ?? null, vspProfile: vspProfile ?? null, vspHash: vspHash ?? null };
      },
      async replaceAll(data) {
        await Promise.all([writeJson(BACKPACK_HASH_KEY, data.backpackHash), writeJson(EXTRACTED_ENTITIES_KEY, data.extractedEntities), writeJson(VSP_PROFILE_KEY, (data as any).vspProfile), writeJson(VSP_HASH_KEY, (data as any).vspHash)]);
      },
    },
  };
}
