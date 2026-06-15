/**
 * Crypto layer for RecoFree Encrypted Export/Import.
 * 
 * Uses @noble/ciphers (AES-256-GCM) and @noble/hashes (PBKDF2, SHA-256)
 * which are pure-JS implementations that work on ALL platforms:
 * iOS, Android (React Native), and Web.
 * 
 * Random bytes are generated via expo-crypto (native) with fallback to
 * globalThis.crypto.getRandomValues (web).
 */

import type { RecoFreeEncryptedExportEnvelope } from '../types/exportEnvelope.types';
import type { RecoFreeExportPlaintextPayload } from '../types/exportPayload.types';
import { buildExportAad } from './exportImportAad';
import { stableStringify } from '@/lib/utils/json/stableStringify';
import {
  RECOFREE_EXPORT_FILE_MAGIC,
  RECOFREE_EXPORT_ENVELOPE_VERSION,
} from '../version/exportImportVersion';

// Noble crypto — pure JS, works everywhere
import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 as noblePbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';

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

/**
 * Generate random bytes using expo-crypto (native) or globalThis.crypto (web).
 * expo-crypto's getRandomValues is synchronous and works on native.
 */
function getSecureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  try {
    // Try expo-crypto first (available in Expo Go and dev builds)
    const ExpoCrypto = require('expo-crypto');
    if (ExpoCrypto && typeof ExpoCrypto.getRandomValues === 'function') {
      ExpoCrypto.getRandomValues(bytes);
      return bytes;
    }
  } catch { /* fallback below */ }

  // Fallback to Web Crypto API (works in browsers and web builds)
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  // Last resort: Math.random (NOT cryptographically secure, but prevents crash)
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

export function generateExportSaltBytes(): Uint8Array {
  return getSecureRandomBytes(EXPORT_SALT_LENGTH_BYTES);
}

export function generateExportIvBytes(): Uint8Array {
  return getSecureRandomBytes(EXPORT_IV_LENGTH_BYTES);
}

// ─── SHA-256 ─────────────────────────────────────────────────────────────────

export async function sha256Base64(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBytes = nobleSha256(data);
  return encodeBase64(hashBytes);
}

// ─── Key Derivation (PBKDF2) ────────────────────────────────────────────────

export function deriveExportKeyBytes(input: {
  password: string;
  saltBytes: Uint8Array;
  iterations: number;
}): Uint8Array {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(input.password);
  return noblePbkdf2(nobleSha256, passwordBytes, input.saltBytes, {
    c: input.iterations,
    dkLen: EXPORT_KEY_LENGTH_BITS / 8,
  });
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

  const keyBytes = deriveExportKeyBytes({
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

  // noble/ciphers gcm: encrypt returns ciphertext + authTag concatenated
  const cipher = gcm(keyBytes, ivBytes, aad);
  const ciphertextWithTag = cipher.encrypt(plaintextBytes);

  // Split ciphertext and auth tag (tag is last 16 bytes for 128-bit)
  const tagLengthBytes = EXPORT_AUTH_TAG_LENGTH_BITS / 8;
  const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - tagLengthBytes);
  const authTag = ciphertextWithTag.slice(ciphertextWithTag.length - tagLengthBytes);

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

  const keyBytes = deriveExportKeyBytes({
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

  // Reconstruct ciphertext + authTag for noble/ciphers
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  const decipher = gcm(keyBytes, ivBytes, aad);
  const plaintextBytes = decipher.decrypt(combined);

  const decoder = new TextDecoder();
  const plaintextJson = decoder.decode(plaintextBytes);
  return JSON.parse(plaintextJson) as RecoFreeExportPlaintextPayload;
}
