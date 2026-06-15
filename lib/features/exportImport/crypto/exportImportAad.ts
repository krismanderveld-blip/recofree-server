/**
 * AES-GCM Additional Authenticated Data (AAD) builder for RecoFree Export/Import.
 */

export function buildExportAad(envelopeMetadata: {
  fileMagic: "RECOFREE_EXPORT";
  envelopeVersion: "1.0.0";
  createdAt: string;
  appExportedVersion: string;
}): Uint8Array {
  const aadString = `${envelopeMetadata.fileMagic}|${envelopeMetadata.envelopeVersion}|${envelopeMetadata.createdAt}|${envelopeMetadata.appExportedVersion}`;
  const encoder = new TextEncoder();
  return encoder.encode(aadString);
}
