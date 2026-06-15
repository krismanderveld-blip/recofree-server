/**
 * Version constants and compatibility checks for RecoFree Export/Import.
 */

export const RECOFREE_EXPORT_FILE_MAGIC = "RECOFREE_EXPORT" as const;
export const RECOFREE_EXPORT_ENVELOPE_VERSION = "1.0.0" as const;
export const RECOFREE_EXPORT_PAYLOAD_VERSION = "recofree.export.payload.v1" as const;

export function isSupportedEnvelopeVersion(version: string): boolean {
  return version === RECOFREE_EXPORT_ENVELOPE_VERSION;
}

export function isSupportedPayloadVersion(version: string): boolean {
  return version === RECOFREE_EXPORT_PAYLOAD_VERSION;
}
