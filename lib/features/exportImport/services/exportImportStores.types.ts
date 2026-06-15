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

// ─── NEW: Persona Projection Stores ─────────────────────────────────────────

export interface ExportablePersonaProjectionStore {
  exportAllPersonas(): Promise<{ elias?: unknown | null; kim?: unknown | null }>;
  replaceAllPersonas(data: { elias?: unknown | null; kim?: unknown | null }): Promise<void>;
}

// ─── NEW: Emergency Contacts Store ──────────────────────────────────────────

export interface ExportableEmergencyContactsStore {
  exportAll(): Promise<unknown[]>;
  replaceAll(data: unknown[]): Promise<void>;
}

// ─── NEW: Derived/Cache Stores ──────────────────────────────────────────────

export interface ExportableDerivedCacheStore {
  exportAll(): Promise<{ backpackHash?: unknown | null; extractedEntities?: unknown | null }>;
  replaceAll(data: { backpackHash?: unknown | null; extractedEntities?: unknown | null }): Promise<void>;
}

// ─── Main Interface ─────────────────────────────────────────────────────────

export interface ExportImportStores {
  userDatStore: ExportableUserDatStore;
  stateDatStore: ExportableStateDatStore;
  projectionsDatStore: ExportableProjectionsDatStore;
  logsDatStore: ExportableLogsDatStore;
  diaryStore: ExportableDiaryStore;
  gratitudeStore: ExportableGratitudeStore;
  backpackStore: ExportableBackpackStore;
  // NEW stores
  personaProjectionStore: ExportablePersonaProjectionStore;
  emergencyContactsStore: ExportableEmergencyContactsStore;
  derivedCacheStore: ExportableDerivedCacheStore;
}
