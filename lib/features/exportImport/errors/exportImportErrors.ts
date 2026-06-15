/**
 * Error types for RecoFree Export/Import.
 */

export type ExportImportErrorCode =
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_MISMATCH"
  | "FILE_READ_FAILED"
  | "INVALID_FILE_MAGIC"
  | "INVALID_ENVELOPE"
  | "UNSUPPORTED_VERSION"
  | "WRONG_PASSWORD_OR_CORRUPT_FILE"
  | "PAYLOAD_INTEGRITY_FAILED"
  | "VALIDATION_FAILED"
  | "IMPORT_COMMIT_FAILED"
  | "EXPORT_FAILED"
  | "UNKNOWN_ERROR";

const ERROR_MESSAGES: Record<ExportImportErrorCode, string> = {
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
  PASSWORD_MISMATCH: "Passwords do not match.",
  FILE_READ_FAILED: "Could not read the selected file.",
  INVALID_FILE_MAGIC: "This is not a valid RecoFree export file.",
  INVALID_ENVELOPE: "This backup file is not valid.",
  UNSUPPORTED_VERSION: "This backup was created with a version this app cannot import yet.",
  WRONG_PASSWORD_OR_CORRUPT_FILE: "The password is incorrect or the file is damaged.",
  PAYLOAD_INTEGRITY_FAILED: "The backup could not be verified.",
  VALIDATION_FAILED: "This backup file is not a valid RecoFree export.",
  IMPORT_COMMIT_FAILED: "Import failed. Your existing data was kept.",
  EXPORT_FAILED: "Encrypted export could not be created.",
  UNKNOWN_ERROR: "Something went wrong.",
};

export class ExportImportError extends Error {
  code: ExportImportErrorCode;
  safeMessage: string;

  constructor(code: ExportImportErrorCode, safeMessage?: string) {
    const msg = safeMessage ?? ERROR_MESSAGES[code] ?? "Something went wrong.";
    super(msg);
    this.code = code;
    this.safeMessage = msg;
    this.name = "ExportImportError";
  }
}

export function getSafeErrorMessage(code: ExportImportErrorCode): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.UNKNOWN_ERROR;
}
