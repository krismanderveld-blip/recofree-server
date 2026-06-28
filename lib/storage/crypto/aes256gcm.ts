/**
 * AES-256-GCM encryption/decryption for logs.dat.
 * Uses @noble/ciphers (pure JS, works on all platforms including React Native).
 */
import type { RecoFreePersona } from "@/lib/types/memory/memoryCore.types";
import type { LogsDatEncryptedEnvelope } from "@/lib/types/memory/logsDat.types";
import {
  getOrCreateLocalEncryptionKey,
  uint8ArrayToBase64,
  base64ToUint8Array,
  generateRandomBytes,
} from "./secureKeyStore";
import { gcm } from '@noble/ciphers/aes.js';
import { LocalDeviceTimeService } from "@/lib/core/time";

/**
 * Encrypt a JSON-serializable value with AES-256-GCM.
 * Returns an encrypted envelope suitable for storage.
 */
export async function encryptJsonAes256Gcm<T>(
  keyAlias: string,
  persona: RecoFreePersona,
  value: T
): Promise<LogsDatEncryptedEnvelope> {
  const keyBytes = await getOrCreateLocalEncryptionKey(keyAlias);
  const plaintext = JSON.stringify(value);
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // 96-bit random IV (never reuse with same key)
  const iv = generateRandomBytes(12);

  // Encrypt using @noble/ciphers (pure JS, no Web Crypto needed)
  const cipher = gcm(keyBytes, iv);
  const ciphertextWithTag = cipher.encrypt(data);

  // @noble/ciphers appends 16-byte auth tag at the end
  const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - 16);
  const authTag = ciphertextWithTag.slice(ciphertextWithTag.length - 16);

  const now = LocalDeviceTimeService.now().utcIso;

  return {
    schemaVersion: "logs.dat.encrypted.v2",
    persona,
    encryption: {
      algorithm: "AES-256-GCM",
      keyAlias,
      ivBase64: uint8ArrayToBase64(iv),
      authTagBase64: uint8ArrayToBase64(authTag),
      createdAt: now,
    },
    ciphertextBase64: uint8ArrayToBase64(ciphertext),
    updatedAt: now,
  };
}

/**
 * Decrypt an AES-256-GCM encrypted envelope back to JSON.
 */
export async function decryptJsonAes256Gcm<T>(
  envelope: LogsDatEncryptedEnvelope
): Promise<T> {
  const keyBytes = await getOrCreateLocalEncryptionKey(envelope.encryption.keyAlias);
  const iv = base64ToUint8Array(envelope.encryption.ivBase64);
  const ciphertext = base64ToUint8Array(envelope.ciphertextBase64);
  const authTag = base64ToUint8Array(envelope.encryption.authTagBase64);

  // Reconstruct combined buffer (ciphertext + authTag) for @noble/ciphers
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  // Decrypt using @noble/ciphers (pure JS, no Web Crypto needed)
  const decipher = gcm(keyBytes, iv);
  const plaintextBytes = decipher.decrypt(combined);

  const decoder = new TextDecoder();
  const plaintext = decoder.decode(plaintextBytes);
  return JSON.parse(plaintext) as T;
}
