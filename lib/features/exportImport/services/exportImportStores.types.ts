/**
 * Store interfaces for RecoFree Export/Import.
 * Each store must implement export (read all) and replace (write all) methods.
 */

export interface ExportableUserDatStore {
  exportAllPersonas(): Promise<{ elias?: unknown | null; kim?: unknown | null }>;
  replaceAllPersonas(data: { elias?: unknown | null; kim?: unknown | null }): Promise<void>;
}

export interface ExportableStateDatStore {
  exportAllPersonas(): Promise<{ elias?: unknown | null; kim?: unknown | null }>;
  replaceAllPersonas(data: { elias?: unknown | null; kim?: unknown | null }): Promise<void>;
}

export interface ExportableProjectionsDatStore {
  exportAllPersonas(): Promise<{ elias?: unknown | null; kim?: unknown | null }>;
  replaceAllPersonas(data: { elias?: unknown | null; kim?: unknown | null }): Promise<void>;
}

export interface ExportableLogsDatStore {
  exportAllPersonasRaw(): Promise<{ elias?: unknown | null; kim?: unknown | null }>;
  replaceAllPersonasRaw(data: { elias?: unknown | null; kim?: unknown | null }): Promise<void>;
}

export interface ExportableDiaryStore {
  exportAllPersonas(): Promise<{ elias?: unknown[]; kim?: unknown[] }>;
  replaceAllPersonas(data: { elias?: unknown[]; kim?: unknown[] }): Promise<void>;
}

export interface ExportableGratitudeStore {
  exportAllPersonas(): Promise<{ elias?: unknown[]; kim?: unknown[] }>;
  replaceAllPersonas(data: { elias?: unknown[]; kim?: unknown[] }): Promise<void>;
}

export interface ExportableBackpackStore {
  exportAllPersonas(): Promise<{ elias?: unknown | null; kim?: unknown | null }>;
  replaceAllPersonas(data: { elias?: unknown | null; kim?: unknown | null }): Promise<void>;
}

export interface ExportImportStores {
  userDatStore: ExportableUserDatStore;
  stateDatStore: ExportableStateDatStore;
  projectionsDatStore: ExportableProjectionsDatStore;
  logsDatStore: ExportableLogsDatStore;
  diaryStore: ExportableDiaryStore;
  gratitudeStore: ExportableGratitudeStore;
  backpackStore: ExportableBackpackStore;
}
