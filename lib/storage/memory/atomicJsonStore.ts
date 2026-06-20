/**
 * Atomic JSON store using AsyncStorage.
 * Provides read/write with basic error handling.
 *
 * Memory store keys (recofree_memory/{persona}/*.dat) are sensitive and
 * routed through AES-256-GCM encrypted storage automatically.
 * Exception: logs.dat has its own dedicated encryption layer (encrypted envelope),
 * so it is NOT double-encrypted here.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readEncrypted, writeEncrypted, removeEncrypted } from "@/lib/crypto/storage-encryption";

/**
 * Memory store keys that should be encrypted at the storage layer.
 * logs.dat is excluded because it has its own encryption envelope.
 */
function isEncryptedMemoryKey(key: string): boolean {
  return (
    key.startsWith("recofree_memory/") &&
    !key.endsWith("/logs.dat")
  );
}

/**
 * Read a JSON value from AsyncStorage.
 * Returns null if key doesn't exist or parse fails.
 */
export async function readJson<T>(key: string): Promise<T | null> {
  try {
    if (isEncryptedMemoryKey(key)) {
      const raw = await readEncrypted(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    }
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Write a JSON value to AsyncStorage atomically.
 */
export async function writeJson<T>(key: string, value: T): Promise<void> {
  const serialized = JSON.stringify(value);
  if (isEncryptedMemoryKey(key)) {
    await writeEncrypted(key, serialized);
  } else {
    await AsyncStorage.setItem(key, serialized);
  }
}

/**
 * Remove a key from AsyncStorage.
 */
export async function removeJson(key: string): Promise<void> {
  if (isEncryptedMemoryKey(key)) {
    await removeEncrypted(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}
