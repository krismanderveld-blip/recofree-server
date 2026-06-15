/**
 * Crypto layer for RecoFree Encrypted Export/Import.
 * Uses WebCrypto API (available in React Native via expo-crypto polyfill and web).
 */

import type { RecoFreeEncryptedExportEnvelope } from '../types/exportEnvelope.types';
import type { RecoFreeExportPlaintextPayload } from '../types/exportPayload.types';
import { buildExportAad } from './exportImportAad';
import { stableStringify } from '@/lib/utils/json/stableStringify';
import {
  RECOFREE_EXPORT_FILE_MAGIC,
  RECOFREE_EXPORT_ENVELOPE_VERSION,
} from '../version/exportImportVersion';

// ─── Constants ───────────────────────────────────────────────────────────────

export const EXPORT_KDF_ALGORITHM = "PBKDF2";
export const EXPORT_KDF_HASH = "SHA-256";
export const EXPORT_KDF_ITERATIONS = 250000;
export const EXPORT_KEY_LENGTH_BITS = 256;
export const EXPORT_SALT_LENGTH_BYTES = 32;

export const EXPORT_ENCRYPTION_ALGORITHM = "AES-256-GCM";
export const EXPORT_IV_LENGTH_BYTES = 12;
export const EXPORT_AUTH_TAG_LENGTH_BITS = 128;

// ─── Base64 Helpers ──────────────────────────────────────────────────────────

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Random Generation ───────────────────────────────────────────────────────

export function generateExportSaltBytes(): Uint8Array {
  const salt = new Uint8Array(EXPORT_SALT_LENGTH_BYTES);
  crypto.getRandomValues(salt);
  return salt;
}

export function generateExportIvBytes(): Uint8Array {
  const iv = new Uint8Array(EXPORT_IV_LENGTH_BYTES);
  crypto.getRandomValues(iv);
  return iv;
}

// ─── SHA-256 ─────────────────────────────────────────────────────────────────

export async function sha256Base64(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return encodeBase64(new Uint8Array(hashBuffer));
}

// ─── Key Derivation ──────────────────────────────────────────────────────────

export async function deriveExportKeyFromPassword(input: {
  password: string;
  saltBytes: Uint8Array;
  iterations: number;
}): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(input.password).buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: input.saltBytes.buffer as ArrayBuffer,
      iterations: input.iterations,
      hash: EXPORT_KDF_HASH,
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: EXPORT_KEY_LENGTH_BITS,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── Encrypt ─────────────────────────────────────────────────────────────────

export async function encryptExportPayload(input: {
  plaintextPayload: RecoFreeExportPlaintextPayload;
  password: string;
  appVersion: string;
  nowIso: string;
}): Promise<RecoFreeEncryptedExportEnvelope> {
  const { plaintextPayload, password, appVersion, nowIso } = input;

  const saltBytes = generateExportSaltBytes();
  const ivBytes = generateExportIvBytes();

  const key = await deriveExportKeyFromPassword({
    password,
    saltBytes,
    iterations: EXPORT_KDF_ITERATIONS,
  });

  const aad = buildExportAad({
    fileMagic: RECOFREE_EXPORT_FILE_MAGIC,
    envelopeVersion: RECOFREE_EXPORT_ENVELOPE_VERSION,
    createdAt: nowIso,
    appExportedVersion: appVersion,
  });

  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(stableStringify(plaintextPayload));

  const ciphertextWithTag = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes.buffer as ArrayBuffer,
      additionalData: aad.buffer as ArrayBuffer,
      tagLength: EXPORT_AUTH_TAG_LENGTH_BITS,
    },
    key,
    plaintextBytes.buffer as ArrayBuffer
  );

  // AES-GCM appends auth tag at the end of ciphertext
  const ciphertextWithTagArray = new Uint8Array(ciphertextWithTag);
  const tagLengthBytes = EXPORT_AUTH_TAG_LENGTH_BITS / 8;
  const ciphertext = ciphertextWithTagArray.slice(0, ciphertextWithTagArray.length - tagLengthBytes);
  const authTag = ciphertextWithTagArray.slice(ciphertextWithTagArray.length - tagLengthBytes);

  return {
    fileMagic: RECOFREE_EXPORT_FILE_MAGIC,
    envelopeVersion: RECOFREE_EXPORT_ENVELOPE_VERSION,
    appMinVersion: "1.0.0",
    appExportedVersion: appVersion,
    createdAt: nowIso,
    kdf: {
      algorithm: EXPORT_KDF_ALGORITHM,
      hash: EXPORT_KDF_HASH,
      iterations: EXPORT_KDF_ITERATIONS,
      saltBase64: encodeBase64(saltBytes),
      keyLengthBits: EXPORT_KEY_LENGTH_BITS,
    },
    encryption: {
      algorithm: EXPORT_ENCRYPTION_ALGORITHM,
      ivBase64: encodeBase64(ivBytes),
      ivLengthBits: 96,
      authTagLengthBits: EXPORT_AUTH_TAG_LENGTH_BITS,
    },
    payload: {
      ciphertextBase64: encodeBase64(ciphertext),
      authTagBase64: encodeBase64(authTag),
    },
  };
}

// ─── Decrypt ─────────────────────────────────────────────────────────────────

export async function decryptExportEnvelope(input: {
  envelope: RecoFreeEncryptedExportEnvelope;
  password: string;
}): Promise<RecoFreeExportPlaintextPayload> {
  const { envelope, password } = input;

  const saltBytes = decodeBase64(envelope.kdf.saltBase64);
  const ivBytes = decodeBase64(envelope.encryption.ivBase64);
  const ciphertext = decodeBase64(envelope.payload.ciphertextBase64);
  const authTag = decodeBase64(envelope.payload.authTagBase64);

  const key = await deriveExportKeyFromPassword({
    password,
    saltBytes,
    iterations: envelope.kdf.iterations,
  });

  const aad = buildExportAad({
    fileMagic: envelope.fileMagic,
    envelopeVersion: envelope.envelopeVersion,
    createdAt: envelope.createdAt,
    appExportedVersion: envelope.appExportedVersion,
  });

  // Reconstruct ciphertext + authTag for WebCrypto
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes.buffer as ArrayBuffer,
      additionalData: aad.buffer as ArrayBuffer,
      tagLength: EXPORT_AUTH_TAG_LENGTH_BITS,
    },
    key,
    combined.buffer as ArrayBuffer
  );

  const decoder = new TextDecoder();
  const plaintextJson = decoder.decode(plaintextBuffer);
  return JSON.parse(plaintextJson) as RecoFreeExportPlaintextPayload;
}
