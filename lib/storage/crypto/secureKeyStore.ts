/**
 * Secure key storage for AES-256-GCM encryption.
 * Uses Expo SecureStore on native, falls back to in-memory for web/tests.
 */
import { Platform } from "react-native";

let SecureStore: any = null;

async function loadSecureStore() {
  if (Platform.OS === "web") return null;
  try {
    SecureStore = await import("expo-secure-store");
    return SecureStore;
  } catch {
    return null;
  }
}

// In-memory fallback for web/test environments
const memoryStore = new Map<string, string>();

/**
 * Get or create a 256-bit encryption key for the given alias.
 * Key is stored securely on device via SecureStore.
 */
export async function getOrCreateLocalEncryptionKey(keyAlias: string): Promise<Uint8Array> {
  const store = await loadSecureStore();

  if (store) {
    // Native: use SecureStore
    const existing = await store.getItemAsync(keyAlias);
    if (existing) {
      return base64ToUint8Array(existing);
    }
    // Generate new 256-bit key
    const key = generateRandomBytes(32);
    const keyBase64 = uint8ArrayToBase64(key);
    await store.setItemAsync(keyAlias, keyBase64);
    return key;
  }

  // Web/test fallback: in-memory
  const existing = memoryStore.get(keyAlias);
  if (existing) {
    return base64ToUint8Array(existing);
  }
  const key = generateRandomBytes(32);
  const keyBase64 = uint8ArrayToBase64(key);
  memoryStore.set(keyAlias, keyBase64);
  return key;
}

/**
 * Generate random bytes using crypto API or fallback.
 */
function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export { generateRandomBytes };
