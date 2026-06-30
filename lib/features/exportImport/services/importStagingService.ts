/**
 * Import Staging Service for RecoFree Encrypted Export/Import.
 * Validates and stages imported data before replacing local data.
 *
 * NOTE: Pre-import snapshot and rollback are now handled by the safe snapshot API
 * in useExportImportStores.ts (createSafePreImportSnapshot / restoreSafePreImportSnapshot).
 * The old store-based snapshot functions are kept for backward compatibility but
 * are no longer used by importDataService.
 */

import type { RecoFreeExportPlaintextPayload, RecoFreePersonaExportBundle } from '../types/exportPayload.types';
import type { ImportStagingPackage, ImportValidationResult } from '../types/importResult.types';
import type { ExportImportStores } from './exportImportStores.types';
import { isSupportedPayloadVersion } from '../version/exportImportVersion';
import { LocalDeviceTimeService } from '@/lib/core/time';

// ─── Build Staging Package ───────────────────────────────────────────────────

export async function buildImportStagingPackage(input: {
  payload: RecoFreeExportPlaintextPayload;
}): Promise<ImportStagingPackage> {
  const { payload } = input;
  return {
    payloadVersion: payload.payloadVersion,
    personas: payload.data.personas,
    shared: payload.data.shared ?? { emergencyContacts: [], derivedCaches: { backpackHash: null, extractedEntities: null, vspProfile: null, vspHash: null } },
    integrity: payload.integrity,
  };
}

// ─── Validate Staging Package ────────────────────────────────────────────────

export async function validateImportStagingPackage(input: {
  stagingPackage: ImportStagingPackage;
  currentAppVersion: string;
}): Promise<ImportValidationResult> {
  const { stagingPackage } = input;
  const errors: string[] = [];

  // Check payload version
  if (!isSupportedPayloadVersion(stagingPackage.payloadVersion)) {
    return { valid: false, status: "UNSUPPORTED_VERSION", errors: [`Unsupported payload version: ${stagingPackage.payloadVersion}`] };
  }

  // Check at least one persona exists
  if (!stagingPackage.personas.elias && !stagingPackage.personas.kim) {
    errors.push("No persona data found in staging package.");
  }

  // Validate persona bundles
  if (stagingPackage.personas.elias) {
    validatePersonaBundle(stagingPackage.personas.elias, 'elias', errors);
  }
  if (stagingPackage.personas.kim) {
    validatePersonaBundle(stagingPackage.personas.kim, 'kim', errors);
  }

  if (errors.length > 0) {
    return { valid: false, status: "VALIDATION_FAILED", errors };
  }

  return { valid: true, status: "VALID", errors: [] };
}

// ─── Replace Local Data ──────────────────────────────────────────────────────

export async function replaceLocalDataFromStaging(input: {
  stagingPackage: ImportStagingPackage;
  stores: ExportImportStores;
}): Promise<void> {
  const { stagingPackage, stores } = input;
  const elias = stagingPackage.personas.elias;
  const kim = stagingPackage.personas.kim;

  await stores.userDatStore.replaceAllPersonas({
    elias: elias?.userDat ?? null,
    kim: kim?.userDat ?? null,
  });

  await stores.stateDatStore.replaceAllPersonas({
    elias: elias?.stateDat ?? null,
    kim: kim?.stateDat ?? null,
  });

  await stores.projectionsDatStore.replaceAllPersonas({
    elias: elias?.projectionsDat ?? null,
    kim: kim?.projectionsDat ?? null,
  });

  // If old export has no logsDat but userDat has sessionAnalyses, build logsDat from them
  const elisasLogsDat = elias?.logsDat ?? buildLogsDatFromSessionAnalyses(elias?.userDat, 'elias');
  const kimsLogsDat = kim?.logsDat ?? buildLogsDatFromSessionAnalyses(kim?.userDat, 'kim');

  await stores.logsDatStore.replaceAllPersonasRaw({
    elias: elisasLogsDat,
    kim: kimsLogsDat,
  });

  await stores.diaryStore.replaceAllPersonas({
    elias: elias?.diaryEntries ?? [],
    kim: kim?.diaryEntries ?? [],
  });

  await stores.gratitudeStore.replaceAllPersonas({
    elias: elias?.gratitudeEntries ?? [],
    kim: kim?.gratitudeEntries ?? [],
  });

  await stores.backpackStore.replaceAllPersonas({
    elias: elias?.backpackData ?? null,
    kim: kim?.backpackData ?? null,
  });

  // Persona projections
  await stores.personaProjectionStore.replaceAllPersonas({
    elias: elias?.personaProjection ?? null,
    kim: kim?.personaProjection ?? null,
  });

  // Emergency contacts
  const emergencyContacts = stagingPackage.shared?.emergencyContacts ?? [];
  await stores.emergencyContactsStore.replaceAll(emergencyContacts);

  // Derived caches (includes VSP profile and hash)
  const derivedCaches = stagingPackage.shared?.derivedCaches ?? { backpackHash: null, extractedEntities: null, vspProfile: null, vspHash: null };
  await stores.derivedCacheStore.replaceAll(derivedCaches);

  // Day structure (document, completion, bell-state, streaks-enabled)
  if (stagingPackage.shared?.dayStructure) {
    await stores.dayStructureStore.replaceAll(stagingPackage.shared.dayStructure);
  }

  // App preferences (language, country)
  if (stagingPackage.shared?.appPreferences) {
    await stores.appPreferencesStore.replaceAll(stagingPackage.shared.appPreferences);
  }
}

// ─── Legacy Pre-Import Snapshot (kept for backward compatibility) ────────────
// NOTE: importDataService now uses createSafePreImportSnapshot instead.

export async function createPreImportSnapshot(stores: ExportImportStores): Promise<PreImportSnapshot> {
  const [userDat, stateDat, projectionsDat, logsDat, diary, gratitude, backpack, personaProjection, emergencyContacts, derivedCaches] = await Promise.all([
    stores.userDatStore.exportAllPersonas(),
    stores.stateDatStore.exportAllPersonas(),
    stores.projectionsDatStore.exportAllPersonas(),
    stores.logsDatStore.exportAllPersonasRaw(),
    stores.diaryStore.exportAllPersonas(),
    stores.gratitudeStore.exportAllPersonas(),
    stores.backpackStore.exportAllPersonas(),
    stores.personaProjectionStore.exportAllPersonas(),
    stores.emergencyContactsStore.exportAll(),
    stores.derivedCacheStore.exportAll(),
  ]);

  return { userDat, stateDat, projectionsDat, logsDat, diary, gratitude, backpack, personaProjection, emergencyContacts, derivedCaches };
}

export interface PreImportSnapshot {
  userDat: { elias?: unknown | null; kim?: unknown | null };
  stateDat: { elias?: unknown | null; kim?: unknown | null };
  projectionsDat: { elias?: unknown | null; kim?: unknown | null };
  logsDat: { elias?: unknown | null; kim?: unknown | null };
  diary: { elias?: unknown[]; kim?: unknown[] };
  gratitude: { elias?: unknown[]; kim?: unknown[] };
  backpack: { elias?: unknown | null; kim?: unknown | null };
  personaProjection: { elias?: unknown | null; kim?: unknown | null };
  emergencyContacts: unknown[];
  derivedCaches: { backpackHash?: unknown | null; extractedEntities?: unknown | null };
}

export async function restorePreImportSnapshot(snapshot: PreImportSnapshot, stores: ExportImportStores): Promise<void> {
  await stores.userDatStore.replaceAllPersonas(snapshot.userDat);
  await stores.stateDatStore.replaceAllPersonas(snapshot.stateDat);
  await stores.projectionsDatStore.replaceAllPersonas(snapshot.projectionsDat);
  await stores.logsDatStore.replaceAllPersonasRaw(snapshot.logsDat);
  await stores.diaryStore.replaceAllPersonas(snapshot.diary);
  await stores.gratitudeStore.replaceAllPersonas(snapshot.gratitude);
  await stores.backpackStore.replaceAllPersonas(snapshot.backpack);
  await stores.personaProjectionStore.replaceAllPersonas(snapshot.personaProjection);
  await stores.emergencyContactsStore.replaceAll(snapshot.emergencyContacts);
  await stores.derivedCacheStore.replaceAll(snapshot.derivedCaches);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validatePersonaBundle(bundle: RecoFreePersonaExportBundle, persona: string, errors: string[]): void {
  if (!bundle.persona || bundle.persona !== persona) {
    errors.push(`Persona mismatch: expected ${persona}, got ${bundle.persona}`);
  }
  if (!Array.isArray(bundle.diaryEntries)) {
    errors.push(`${persona}.diaryEntries is not an array`);
  }
  if (!Array.isArray(bundle.gratitudeEntries)) {
    errors.push(`${persona}.gratitudeEntries is not an array`);
  }
  // userDat key must exist (can be null)
  if (!('userDat' in bundle)) {
    errors.push(`${persona} missing userDat key`);
  }
}

/**
 * Build a minimal logsDat structure from legacy sessionAnalyses in userDat.
 * Used when importing old exports that have no logsDat but do have sessionAnalyses.
 * Returns null if no sessionAnalyses are available.
 */
function buildLogsDatFromSessionAnalyses(userDat: unknown | null | undefined, persona: string): unknown | null {
  if (!userDat || typeof userDat !== 'object') return null;
  const ud = userDat as Record<string, unknown>;
  const analyses = ud.sessionAnalyses as Array<Record<string, unknown>> | undefined;
  if (!analyses || !Array.isArray(analyses) || analyses.length === 0) return null;

  const sessions = analyses.map((a, i) => ({
    summaryId: `imported_${persona}_${i}_${LocalDeviceTimeService.now().epochMs}`,
    sessionId: `legacy_imported_${i}`,
    persona,
    startedAt: (a.date as string) || LocalDeviceTimeService.now().utcIso,
    endedAt: (a.date as string) || LocalDeviceTimeService.now().utcIso,
    createdAt: LocalDeviceTimeService.now().utcIso,
    summaryModel: "migration",
    summarySchemaVersion: "session_summary.v1",
    compressedNarrative: buildImportNarrative(a),
    discussedTopics: ((a.themes as string[]) || []).slice(0, 5),
    emotionalThemes: a.dominantEmotion ? [{ label: a.dominantEmotion, intensity: 0.6 }] : [],
    breakthroughs: [],
    relapseOrRiskEvents: [{ eventType: "none", description: "", severity: 0 }],
    openEndpoints: [],
    extractedCandidates: { fears: [], hopes: [], triggers: [], schemaTendencies: [], modeTendencies: [] },
    moduleTrace: ((a.modulesUsed as string[]) || []).map((m: string) => ({ moduleId: m, responseMode: "default", count: 1 })),
    zoneTrace: [],
    inputTokenEstimate: 0,
    outputTokenEstimate: 0,
  }));

  return {
    persona,
    schemaVersion: "logs.dat.v1",
    createdAt: LocalDeviceTimeService.now().utcIso,
    updatedAt: LocalDeviceTimeService.now().utcIso,
    sessions,
  };
}

function buildImportNarrative(a: Record<string, unknown>): string {
  const parts: string[] = [];
  if (a.messageCount) parts.push(`${a.messageCount} berichten`);
  if (a.durationMinutes) parts.push(`${a.durationMinutes} min`);
  if (a.dominantEmotion) parts.push(`Emotie: ${a.dominantEmotion}`);
  if (a.themes && Array.isArray(a.themes)) parts.push(`Thema's: ${(a.themes as string[]).join(', ')}`);
  return parts.length > 0 ? parts.join('. ') + '.' : 'Gemigreerde sessie.';
}
