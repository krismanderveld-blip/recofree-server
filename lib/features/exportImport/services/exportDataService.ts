/**
 * Export Data Service for RecoFree Encrypted Export/Import.
 * Creates an encrypted .recofree export file from local stores.
 */

import type { RecoFreeEncryptedExportEnvelope } from '../types/exportEnvelope.types';
import type {
  RecoFreeExportPlaintextPayload,
  RecoFreeExportData,
  RecoFreePersonaExportBundle,
  RecoFreeSharedExportBundle,
  ExportScopeMetadata,
  ExportPayloadIntegrity,
  ExportPersonaDatasetCounts,
  ExportSourceDeviceMetadata,
} from '../types/exportPayload.types';
import { encryptExportPayload, sha256Base64 } from '../crypto/exportImportCrypto';
import { RECOFREE_EXPORT_PAYLOAD_VERSION } from '../version/exportImportVersion';
import { ExportImportError } from '../errors/exportImportErrors';
import { stableStringify } from '@/lib/utils/json/stableStringify';
import type { ExportImportStores } from './exportImportStores.types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EncryptedExportResult {
  fileName: string;
  fileExtension: ".recofree";
  envelope: RecoFreeEncryptedExportEnvelope;
  envelopeJson: string;
  byteSize: number;
  createdAt: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function createEncryptedRecoFreeExport(input: {
  password: string;
  nowIso: string;
  appVersion: string;
  platform: "ios" | "android" | "web" | "unknown";
  expoSdkVersion: string;
  stores: ExportImportStores;
}): Promise<EncryptedExportResult> {
  const { password, nowIso, appVersion, platform, expoSdkVersion, stores } = input;

  if (password.length < 8) {
    throw new ExportImportError("PASSWORD_TOO_SHORT");
  }

  try {
    // 1. Read all data from stores (including new stores)
    const [
      userDatAll,
      stateDatAll,
      projectionsDatAll,
      logsDatAll,
      diaryAll,
      gratitudeAll,
      backpackAll,
      personaProjectionAll,
      emergencyContacts,
      derivedCaches,
    ] = await Promise.all([
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

    // 2. Build persona bundles
    const personas: RecoFreeExportData['personas'] = {};
    const hasElias = !!(userDatAll.elias || stateDatAll.elias || backpackAll.elias);
    const hasKim = !!(userDatAll.kim || stateDatAll.kim || backpackAll.kim);

    if (hasElias) {
      personas.elias = buildPersonaBundle(
        'elias',
        userDatAll.elias, stateDatAll.elias, projectionsDatAll.elias, logsDatAll.elias,
        diaryAll.elias ?? [], gratitudeAll.elias ?? [], backpackAll.elias,
        personaProjectionAll.elias,
      );
    }
    if (hasKim) {
      personas.kim = buildPersonaBundle(
        'kim',
        userDatAll.kim, stateDatAll.kim, projectionsDatAll.kim, logsDatAll.kim,
        diaryAll.kim ?? [], gratitudeAll.kim ?? [], backpackAll.kim,
        personaProjectionAll.kim,
      );
    }

    // 3. Build shared bundle
    const shared: RecoFreeSharedExportBundle = {
      emergencyContacts: emergencyContacts ?? [],
      derivedCaches: {
        backpackHash: derivedCaches.backpackHash ?? null,
        extractedEntities: derivedCaches.extractedEntities ?? null,
      },
    };

    // 4. Build scope metadata
    const exportScope: ExportScopeMetadata = {
      includesUserDat: true,
      includesStateDat: true,
      includesProjectionsDat: true,
      includesLogsDat: true,
      includesDiaryEntries: true,
      includesGratitudeEntries: true,
      includesBackpackData: true,
      includesEliasPersona: hasElias,
      includesKimPersona: hasKim,
      includesPersonaProjections: true,
      includesEmergencyContacts: true,
      includesDerivedCaches: true,
    };

    // 5. Build source device metadata
    const sourceDevice: ExportSourceDeviceMetadata = {
      platform,
      expoSdkVersion,
    };

    // 6. Build integrity (without hash first)
    const datasetCounts: ExportPayloadIntegrity['datasetCounts'] = {};
    if (personas.elias) datasetCounts.elias = buildDatasetCounts(personas.elias);
    if (personas.kim) datasetCounts.kim = buildDatasetCounts(personas.kim);

    // 7. Build payload without integrity hash
    const payloadWithoutHash: Omit<RecoFreeExportPlaintextPayload, 'integrity'> & { integrity: Omit<ExportPayloadIntegrity, 'plaintextSha256Base64'> & { plaintextSha256Base64: string } } = {
      payloadVersion: RECOFREE_EXPORT_PAYLOAD_VERSION,
      createdAt: nowIso,
      appVersion,
      sourceDevice,
      exportScope,
      data: { personas, shared },
      integrity: {
        plaintextSha256Base64: "",
        datasetCounts,
      },
    };

    // 8. Compute hash over payload with empty hash field
    const hashInput = stableStringify(payloadWithoutHash);
    const plaintextSha256Base64 = await sha256Base64(hashInput);

    // 9. Build final payload
    const plaintextPayload: RecoFreeExportPlaintextPayload = {
      ...payloadWithoutHash,
      integrity: {
        plaintextSha256Base64,
        datasetCounts,
      },
    };

    // 10. Encrypt
    const envelope = await encryptExportPayload({
      plaintextPayload,
      password,
      appVersion,
      nowIso,
    });

    // 11. Serialize
    const envelopeJson = JSON.stringify(envelope);
    const fileName = createRecoFreeExportFileName(nowIso);

    return {
      fileName,
      fileExtension: ".recofree",
      envelope,
      envelopeJson,
      byteSize: new TextEncoder().encode(envelopeJson).length,
      createdAt: nowIso,
    };
  } catch (err) {
    if (err instanceof ExportImportError) throw err;
    throw new ExportImportError("EXPORT_FAILED");
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function createRecoFreeExportFileName(nowIso: string): string {
  const d = new Date(nowIso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `recofree-export-${date}-${time}.recofree`;
}

export function buildRecoFreeExportPlaintextPayload(
  data: RecoFreeExportData,
  meta: { nowIso: string; appVersion: string; platform: "ios" | "android" | "web" | "unknown"; expoSdkVersion: string },
  integrityHash: string
): RecoFreeExportPlaintextPayload {
  const datasetCounts: ExportPayloadIntegrity['datasetCounts'] = {};
  if (data.personas.elias) datasetCounts.elias = buildDatasetCounts(data.personas.elias);
  if (data.personas.kim) datasetCounts.kim = buildDatasetCounts(data.personas.kim);

  return {
    payloadVersion: RECOFREE_EXPORT_PAYLOAD_VERSION,
    createdAt: meta.nowIso,
    appVersion: meta.appVersion,
    sourceDevice: { platform: meta.platform, expoSdkVersion: meta.expoSdkVersion },
    exportScope: {
      includesUserDat: true,
      includesStateDat: true,
      includesProjectionsDat: true,
      includesLogsDat: true,
      includesDiaryEntries: true,
      includesGratitudeEntries: true,
      includesBackpackData: true,
      includesEliasPersona: !!data.personas.elias,
      includesKimPersona: !!data.personas.kim,
      includesPersonaProjections: true,
      includesEmergencyContacts: true,
      includesDerivedCaches: true,
    },
    data,
    integrity: { plaintextSha256Base64: integrityHash, datasetCounts },
  };
}

function buildPersonaBundle(
  persona: "elias" | "kim",
  userDat: unknown | null | undefined,
  stateDat: unknown | null | undefined,
  projectionsDat: unknown | null | undefined,
  logsDat: unknown | null | undefined,
  diaryEntries: unknown[],
  gratitudeEntries: unknown[],
  backpackData: unknown | null | undefined,
  personaProjection: unknown | null | undefined,
): RecoFreePersonaExportBundle {
  return {
    persona,
    userDat: userDat ?? null,
    stateDat: stateDat ?? null,
    projectionsDat: projectionsDat ?? null,
    logsDat: logsDat ?? null,
    diaryEntries: diaryEntries ?? [],
    gratitudeEntries: gratitudeEntries ?? [],
    backpackData: backpackData ?? null,
    personaProjection: personaProjection ?? null,
  };
}

function buildDatasetCounts(bundle: RecoFreePersonaExportBundle): ExportPersonaDatasetCounts {
  return {
    diaryEntries: bundle.diaryEntries.length,
    gratitudeEntries: bundle.gratitudeEntries.length,
    hasUserDat: bundle.userDat !== null,
    hasStateDat: bundle.stateDat !== null,
    hasProjectionsDat: bundle.projectionsDat !== null,
    hasLogsDat: bundle.logsDat !== null,
    hasBackpackData: bundle.backpackData !== null,
    hasPersonaProjection: bundle.personaProjection !== null,
  };
}
