/**
 * Import result types for RecoFree Export/Import.
 */

import type { ExportPersonaDatasetCounts } from './exportPayload.types';

export interface ImportRecoFreeResult {
  status:
    | "SUCCESS"
    | "WRONG_PASSWORD_OR_CORRUPT_FILE"
    | "UNSUPPORTED_VERSION"
    | "VALIDATION_FAILED"
    | "FILE_READ_FAILED"
    | "IMPORT_COMMIT_FAILED";
  importedAt: string;
  replacedExistingData: boolean;
  restoredDatasets?: {
    elias?: ExportPersonaDatasetCounts;
    kim?: ExportPersonaDatasetCounts;
  };
  errorMessage?: string;
}

export interface ImportStagingPackage {
  payloadVersion: "recofree.export.payload.v1";
  personas: {
    elias?: import('./exportPayload.types').RecoFreePersonaExportBundle;
    kim?: import('./exportPayload.types').RecoFreePersonaExportBundle;
  };
  shared?: import('./exportPayload.types').RecoFreeSharedExportBundle;
  integrity: import('./exportPayload.types').ExportPayloadIntegrity;
}

export interface ImportValidationResult {
  valid: boolean;
  status: "VALID" | "UNSUPPORTED_VERSION" | "VALIDATION_FAILED";
  errors: string[];
}

export interface PickedRecoFreeBackupFile {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
}
