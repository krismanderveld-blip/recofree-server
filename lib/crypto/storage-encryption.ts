/**
 * AES-256-GCM at-rest encryption for all sensitive AsyncStorage data.
 *
 * Architecture:
 * - Encryption key (256-bit) stored in expo-secure-store (native keychain/keystore)
 * - Each write generates a fresh 12-byte IV (prepended to ciphertext)
 * - Magic prefix "RF_ENC_V1:" distinguishes encrypted from legacy plain JSON
 * - Migration: on read, if data starts with '{' or '[', it's legacy plain JSON →
 *   transparently decrypt (passthrough) and re-encrypt on next write
 *
 * Uses @noble/ciphers (already installed for export/import feature).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { gcm } from '@noble/ciphers/aes.js';
import { Platform } from 'react-native';

// ─── Constants ──────────────────────────────────────────────────────────────

const ENCRYPTION_KEY_ALIAS = 'recofree_storage_aes256_key';
const MAGIC_PREFIX = 'RF_ENC_V1:';
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32; // 256 bits

// ─── Key Management ─────────────────────────────────────────────────────────

let cachedKey: Uint8Array | null = null;

/**
 * Generate cryptographically secure random bytes.
 * Uses expo-crypto on native, Web Crypto API on web.
 */
function getSecureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  try {
    const ExpoCrypto = require('expo-crypto');
    if (ExpoCrypto && typeof ExpoCrypto.getRandomValues === 'function') {
      ExpoCrypto.getRandomValues(bytes);
      return bytes;
    }
  } catch { /* fallback below */ }

  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  // Last resort (should never happen in production)
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/**
 * Encode Uint8Array to base64 string.
 */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode base64 string to Uint8Array.
 */
function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Get or generate the AES-256 encryption key from secure storage.
 * On web, falls back to localStorage (less secure but functional for dev).
 */
async function getOrCreateKey(): Promise<Uint8Array> {
  if (cachedKey) return cachedKey;

  let keyBase64: string | null = null;

  if (Platform.OS === 'web') {
    // Web fallback: localStorage (dev/testing only)
    keyBase64 = typeof window !== 'undefined'
      ? window.localStorage.getItem(ENCRYPTION_KEY_ALIAS)
      : null;
    if (!keyBase64) {
      const newKey = getSecureRandomBytes(KEY_LENGTH_BYTES);
      keyBase64 = toBase64(newKey);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ENCRYPTION_KEY_ALIAS, keyBase64);
      }
    }
  } else {
    // Native: expo-secure-store (keychain/keystore)
    keyBase64 = await SecureStore.getItemAsync(ENCRYPTION_KEY_ALIAS);
    if (!keyBase64) {
      const newKey = getSecureRandomBytes(KEY_LENGTH_BYTES);
      keyBase64 = toBase64(newKey);
      await SecureStore.setItemAsync(ENCRYPTION_KEY_ALIAS, keyBase64, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    }
  }

  cachedKey = fromBase64(keyBase64);
  return cachedKey;
}

// ─── Encrypt / Decrypt Primitives ───────────────────────────────────────────

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns: "RF_ENC_V1:" + base64(IV + ciphertext + authTag)
 */
async function encrypt(plaintext: string): Promise<string> {
  const key = await getOrCreateKey();
  const iv = getSecureRandomBytes(IV_LENGTH_BYTES);
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  const cipher = gcm(key, iv);
  const ciphertextWithTag = cipher.encrypt(plaintextBytes);

  // Combine: IV (12) + ciphertextWithTag (variable)
  const combined = new Uint8Array(IV_LENGTH_BYTES + ciphertextWithTag.length);
  combined.set(iv, 0);
  combined.set(ciphertextWithTag, IV_LENGTH_BYTES);

  return MAGIC_PREFIX + toBase64(combined);
}

/**
 * Decrypt a string produced by encrypt().
 * Expects: "RF_ENC_V1:" + base64(IV + ciphertext + authTag)
 */
async function decrypt(encrypted: string): Promise<string> {
  const key = await getOrCreateKey();
  const base64Data = encrypted.slice(MAGIC_PREFIX.length);
  const combined = fromBase64(base64Data);

  const iv = combined.slice(0, IV_LENGTH_BYTES);
  const ciphertextWithTag = combined.slice(IV_LENGTH_BYTES);

  const decipher = gcm(key, iv);
  const plaintextBytes = decipher.decrypt(ciphertextWithTag);

  const decoder = new TextDecoder();
  return decoder.decode(plaintextBytes);
}

/**
 * Check if a stored value is encrypted (has our magic prefix).
 */
function isEncrypted(value: string): boolean {
  return value.startsWith(MAGIC_PREFIX);
}

// ─── Public API: Encrypted AsyncStorage ─────────────────────────────────────

/**
 * List of all sensitive AsyncStorage keys that must be encrypted.
 */
export const SENSITIVE_KEYS = [
  '@recofree_userdat',
  '@recofree_backpack',
  '@recofree_diary',
  '@recofree_projection_elias',
  '@recofree_projection_kim',
  '@recofree_extracted_entities',
  '@vsp_backpack_profile',
] as const;

/**
 * Memory store keys that are also encrypted (via atomicJsonStore).
 * These use a pattern-based approach: recofree_memory/{persona}/{layer}.dat
 * logs.dat is excluded (has its own encryption envelope).
 */
export const MEMORY_STORE_KEYS = [
  'recofree_memory/elias/user.dat',
  'recofree_memory/elias/state.dat',
  'recofree_memory/elias/projections.dat',
  'recofree_memory/kim/user.dat',
  'recofree_memory/kim/state.dat',
  'recofree_memory/kim/projections.dat',
] as const;

export type SensitiveKey = typeof SENSITIVE_KEYS[number];

/**
 * Read and decrypt a sensitive key from AsyncStorage.
 * Handles migration: if data is plain JSON, returns it as-is (will be encrypted on next write).
 * Returns null if key doesn't exist.
 */
export async function readEncrypted(key: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;

  if (isEncrypted(raw)) {
    return await decrypt(raw);
  }

  // Legacy plain JSON detected — return as-is, migration happens on next write
  // Also trigger background migration (encrypt and save back)
  try {
    const encrypted = await encrypt(raw);
    await AsyncStorage.setItem(key, encrypted);
  } catch {
    // Migration failed silently — data is still readable, will retry next time
  }

  return raw;
}

/**
 * Encrypt and write a value to a sensitive AsyncStorage key.
 */
export async function writeEncrypted(key: string, value: string): Promise<void> {
  const encrypted = await encrypt(value);
  await AsyncStorage.setItem(key, encrypted);
}

/**
 * Remove a sensitive key from AsyncStorage.
 */
export async function removeEncrypted(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

/**
 * Check if a key currently holds encrypted data (for diagnostics).
 */
export async function isKeyEncrypted(key: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return false;
  return isEncrypted(raw);
}

/**
 * Force-migrate all sensitive keys to encrypted format.
 * Call this once at app startup to ensure all legacy data is encrypted.
 */
export async function migrateAllToEncrypted(): Promise<{ migrated: string[]; alreadyEncrypted: string[]; missing: string[] }> {
  const result = { migrated: [] as string[], alreadyEncrypted: [] as string[], missing: [] as string[] };

  // Migrate both legacy sensitive keys and memory store keys
  const allKeysToMigrate: readonly string[] = [...SENSITIVE_KEYS, ...MEMORY_STORE_KEYS];

  for (const key of allKeysToMigrate) {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) {
      result.missing.push(key);
      continue;
    }
    if (isEncrypted(raw)) {
      result.alreadyEncrypted.push(key);
      continue;
    }
    // Plain JSON — encrypt it
    try {
      const encrypted = await encrypt(raw);
      await AsyncStorage.setItem(key, encrypted);
      result.migrated.push(key);
    } catch (e) {
      console.error(`[StorageEncryption] Failed to migrate key: ${key}`, e);
    }
  }

  return result;
}
