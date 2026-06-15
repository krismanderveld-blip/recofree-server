/**
 * RecoFree Encrypted Export/Import — barrel exports.
 */

// Types
export type { RecoFreeEncryptedExportEnvelope, ExportKeyDerivationMetadata, ExportEncryptionMetadata } from './types/exportEnvelope.types';
export type { RecoFreeExportPlaintextPayload, RecoFreeExportData, RecoFreePersonaExportBundle, ExportScopeMetadata, ExportPayloadIntegrity, ExportPersonaDatasetCounts, ExportSourceDeviceMetadata } from './types/exportPayload.types';
export type { ImportRecoFreeResult, ImportStagingPackage, ImportValidationResult, PickedRecoFreeBackupFile } from './types/importResult.types';
export type { ExportImportStores, ExportableUserDatStore, ExportableStateDatStore, ExportableProjectionsDatStore, ExportableLogsDatStore, ExportableDiaryStore, ExportableGratitudeStore, ExportableBackpackStore } from './services/exportImportStores.types';

// Crypto
export { encryptExportPayload, decryptExportEnvelope, deriveExportKeyBytes, generateExportSaltBytes, generateExportIvBytes, encodeBase64, decodeBase64, sha256Base64 } from './crypto/exportImportCrypto';
export { buildExportAad } from './crypto/exportImportAad';

// Services
export { createEncryptedRecoFreeExport, createRecoFreeExportFileName, buildRecoFreeExportPlaintextPayload } from './services/exportDataService';
export type { EncryptedExportResult } from './services/exportDataService';
export { importEncryptedRecoFreeBackup, parseRecoFreeExportEnvelope, validateRecoFreeExportEnvelope, validateRecoFreeExportPayload } from './services/importDataService';
export { buildImportStagingPackage, validateImportStagingPackage, replaceLocalDataFromStaging, createPreImportSnapshot, restorePreImportSnapshot } from './services/importStagingService';

// Version
export { RECOFREE_EXPORT_FILE_MAGIC, RECOFREE_EXPORT_ENVELOPE_VERSION, RECOFREE_EXPORT_PAYLOAD_VERSION, isSupportedEnvelopeVersion, isSupportedPayloadVersion } from './version/exportImportVersion';

// Errors
export { ExportImportError, getSafeErrorMessage } from './errors/exportImportErrors';
export type { ExportImportErrorCode } from './errors/exportImportErrors';

// File picker
export { pickRecoFreeBackupFile } from './filePicker/exportImportFilePicker';
