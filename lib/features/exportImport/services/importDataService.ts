/**
 * Import Data Service for RecoFree Encrypted Export/Import.
 * Decrypts, validates, stages, and replaces local data from a .recofree file.
 */

import type { RecoFreeEncryptedExportEnvelope } from '../types/exportEnvelope.types';
import type { ImportRecoFreeResult } from '../types/importResult.types';
import type { ExportImportStores } from './exportImportStores.types';
import { decryptExportEnvelope, sha256Base64 } from '../crypto/exportImportCrypto';
import { stableStringify } from '@/lib/utils/json/stableStringify';
import {
  RECOFREE_EXPORT_FILE_MAGIC,
  isSupportedEnvelopeVersion,
  isSupportedPayloadVersion,
} from '../version/exportImportVersion';
import { ExportImportError } from '../errors/exportImportErrors';
import {
  buildImportStagingPackage,
  validateImportStagingPackage,
  replaceLocalDataFromStaging,
} from './importStagingService';
import {
  createSafePreImportSnapshot,
  restoreSafePreImportSnapshot,
} from '../hooks/useExportImportStores';
import { logImportDiag } from '@/lib/debug/import-diagnostics';

// ─── Public API ──────────────────────────────────────────────────────────────

export async function importEncryptedRecoFreeBackup(input: {
  envelopeJson: string;
  password: string;
  currentAppVersion: string;
  stores: ExportImportStores;
}): Promise<ImportRecoFreeResult> {
  const { envelopeJson, password, currentAppVersion, stores } = input;
  const nowIso = new Date().toISOString();

  // 1. Parse envelope
  let envelope: RecoFreeEncryptedExportEnvelope;
  try {
    envelope = JSON.parse(envelopeJson);
  } catch {
    return { status: "FILE_READ_FAILED", importedAt: nowIso, replacedExistingData: false, errorMessage: "Could not read the selected file." };
  }

  // 2. Validate envelope shape
  const envelopeValidation = validateRecoFreeExportEnvelope(envelope);
  if (!envelopeValidation.valid) {
    return { status: envelopeValidation.status as ImportRecoFreeResult['status'], importedAt: nowIso, replacedExistingData: false, errorMessage: envelopeValidation.error };
  }

  // 3. Decrypt
  let payload;
  try {
    payload = await decryptExportEnvelope({ envelope, password });
  } catch {
    return { status: "WRONG_PASSWORD_OR_CORRUPT_FILE", importedAt: nowIso, replacedExistingData: false, errorMessage: "The password is incorrect or the file is damaged." };
  }

  // 4. Validate payload version
  if (!isSupportedPayloadVersion(payload.payloadVersion)) {
    return { status: "UNSUPPORTED_VERSION", importedAt: nowIso, replacedExistingData: false, errorMessage: "This backup was created with a version this app cannot import yet." };
  }

  // 5. Validate integrity hash
  const integrityValid = await validatePayloadIntegrity(payload);
  if (!integrityValid) {
    return { status: "VALIDATION_FAILED", importedAt: nowIso, replacedExistingData: false, errorMessage: "The backup could not be verified." };
  }

  // 6. Build staging
  const stagingPackage = await buildImportStagingPackage({ payload });

  // 7. Validate staging
  const stagingValidation = await validateImportStagingPackage({ stagingPackage, currentAppVersion });
  if (!stagingValidation.valid) {
    const status = stagingValidation.status === "UNSUPPORTED_VERSION" ? "UNSUPPORTED_VERSION" : "VALIDATION_FAILED";
    return { status, importedAt: nowIso, replacedExistingData: false, errorMessage: stagingValidation.errors.join("; ") };
  }

  // 8. Create SAFE pre-import snapshot for rollback (FIX #2)
  logImportDiag('Creating pre-import snapshot', 'INFO');
  const safeSnapshot = await createSafePreImportSnapshot();
  logImportDiag('Snapshot created', 'OK', `${safeSnapshot.keys.length} keys captured`);

  // 9. Replace local data
  logImportDiag('Writing imported data to storage', 'INFO');
  try {
    await replaceLocalDataFromStaging({ stagingPackage, stores });
    logImportDiag('All data written to storage', 'OK');
  } catch (replaceErr: any) {
    logImportDiag('Write to storage FAILED', 'FAIL', replaceErr?.message ?? 'unknown');
    // Attempt safe rollback — keys marked SNAPSHOT_READ_FAILED are preserved as-is
    try {
      await restoreSafePreImportSnapshot(safeSnapshot);
      logImportDiag('Rollback completed', 'OK');
    } catch (rollbackErr: any) {
      logImportDiag('Rollback also failed', 'FAIL', rollbackErr?.message ?? 'unknown');
    }
    return { status: "IMPORT_COMMIT_FAILED", importedAt: nowIso, replacedExistingData: false, errorMessage: `Import failed at write step: ${replaceErr?.message}. Your existing data was kept.` };
  }

  logImportDiag('Import complete — returning SUCCESS', 'OK');
  return {
    status: "SUCCESS",
    importedAt: nowIso,
    replacedExistingData: true,
    restoredDatasets: payload.integrity.datasetCounts,
  };
}

// ─── Envelope Validation ─────────────────────────────────────────────────────

export function parseRecoFreeExportEnvelope(json: string): RecoFreeEncryptedExportEnvelope | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function validateRecoFreeExportEnvelope(envelope: unknown): { valid: boolean; status: string; error?: string } {
  if (!envelope || typeof envelope !== 'object') {
    return { valid: false, status: "VALIDATION_FAILED", error: "Invalid envelope structure." };
  }

  const env = envelope as Record<string, unknown>;

  if (env.fileMagic !== RECOFREE_EXPORT_FILE_MAGIC) {
    return { valid: false, status: "VALIDATION_FAILED", error: "This is not a valid RecoFree export file." };
  }

  if (!isSupportedEnvelopeVersion(env.envelopeVersion as string)) {
    return { valid: false, status: "UNSUPPORTED_VERSION", error: "This backup was created with a version this app cannot import yet." };
  }

  if (!env.kdf || !env.encryption || !env.payload) {
    return { valid: false, status: "VALIDATION_FAILED", error: "This backup file is not valid." };
  }

  return { valid: true, status: "VALID" };
}

export function validateRecoFreeExportPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return !!(p.payloadVersion && p.data && p.integrity);
}

// ─── Integrity Validation ────────────────────────────────────────────────────

async function validatePayloadIntegrity(payload: import('../types/exportPayload.types').RecoFreeExportPlaintextPayload): Promise<boolean> {
  const storedHash = payload.integrity.plaintextSha256Base64;

  // Rebuild payload with empty hash to compute expected hash
  const payloadForHash = {
    ...payload,
    integrity: {
      ...payload.integrity,
      plaintextSha256Base64: "",
    },
  };

  const computedHash = await sha256Base64(stableStringify(payloadForHash));
  return computedHash === storedHash;
}
