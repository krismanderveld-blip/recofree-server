/**
 * Export/Import migrations — V1 has no migrations.
 */

import type { RecoFreeExportPlaintextPayload } from '../types/exportPayload.types';

export interface ExportImportMigration {
  fromPayloadVersion: string;
  toPayloadVersion: string;
  migrate(payload: unknown): RecoFreeExportPlaintextPayload;
}

/** No migrations for V1 */
export const EXPORT_IMPORT_MIGRATIONS: ExportImportMigration[] = [];
