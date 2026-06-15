/**
 * Hook that provides ExportImportStores interface backed by the real AsyncStorage stores.
 * Adapts the per-persona stores and legacy AsyncStorage keys to the export/import interface.
 */

import { useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExportImportStores } from '../services/exportImportStores.types';

// AsyncStorage keys used by the app
const USERDAT_KEY_PREFIX = 'recofree_memory/';
const LEGACY_USERDAT_KEY = '@recofree_userdat';
const LEGACY_BACKPACK_KEY = '@recofree_backpack';
const DIARY_KEY = '@recofree_diary';

// Memory store keys
function getUserDatKey(persona: string) { return `recofree_memory/${persona}/user.dat`; }
function getStateDatKey(persona: string) { return `recofree_memory/${persona}/state.dat`; }
function getProjectionsDatKey(persona: string) { return `recofree_memory/${persona}/projections.dat`; }
function getLogsDatKey(persona: string) { return `recofree_memory/${persona}/logs.dat`; }

async function readJson(key: string): Promise<unknown | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  if (value === null || value === undefined) {
    await AsyncStorage.removeItem(key);
  } else {
    await AsyncStorage.setItem(key, JSON.stringify(value));
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
      async replaceAllPersonas(data) {
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
  }), []);
}
