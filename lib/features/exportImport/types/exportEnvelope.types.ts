/**
 * Encrypted export envelope types for RecoFree Export/Import.
 */

export interface RecoFreeEncryptedExportEnvelope {
  fileMagic: "RECOFREE_EXPORT";
  envelopeVersion: "1.0.0";
  appMinVersion: string;
  appExportedVersion: string;
  createdAt: string;
  kdf: ExportKeyDerivationMetadata;
  encryption: ExportEncryptionMetadata;
  payload: {
    ciphertextBase64: string;
    authTagBase64: string;
  };
}

export interface ExportKeyDerivationMetadata {
  algorithm: "PBKDF2";
  hash: "SHA-256";
  iterations: number;
  saltBase64: string;
  keyLengthBits: 256;
}

export interface ExportEncryptionMetadata {
  algorithm: "AES-256-GCM";
  ivBase64: string;
  ivLengthBits: 96;
  authTagLengthBits: 128;
}
