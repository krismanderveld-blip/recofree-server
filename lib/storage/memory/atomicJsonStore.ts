/**
 * Canonical JSON persistence boundary.
 *
 * Sensitive RecoFree stores are always routed through SessionMemoryCache and
 * AES-GCM storage. Read-modify-write mutations are serialized per key so
 * concurrent extraction, chat and refresh updates cannot overwrite each other.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SessionMemoryCache } from "@/lib/crypto/session-memory-cache";
import { isSensitiveStorageKey } from "@/lib/crypto/storage-encryption";

function isEncryptedMemoryKey(key: string): boolean {
  return key.startsWith("recofree_memory/") && !key.endsWith("/logs.dat");
}

function isSensitiveCoreKey(key: string): boolean {
  return isSensitiveStorageKey(key) && !isEncryptedMemoryKey(key);
}

function isEncryptedKey(key: string): boolean {
  return isEncryptedMemoryKey(key) || isSensitiveCoreKey(key);
}

const mutationQueues = new Map<string, Promise<void>>();

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = isEncryptedKey(key)
      ? await SessionMemoryCache.get(key)
      : await AsyncStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  const serialized = JSON.stringify(value);
  if (isSensitiveCoreKey(key)) {
    await SessionMemoryCache.setPersisted(key, serialized);
    return;
  }
  if (isEncryptedMemoryKey(key)) {
    await SessionMemoryCache.set(key, serialized);
    return;
  }
  await AsyncStorage.setItem(key, serialized);
}

/**
 * Serialize read-modify-write operations for one key. The mutator receives the
 * latest committed value and its result is encrypted before the next queued
 * mutation starts.
 */
export async function updateJson<T>(
  key: string,
  mutator: (current: T | null) => T,
): Promise<T> {
  const previous = mutationQueues.get(key) ?? Promise.resolve();
  let resolveResult!: (value: T) => void;
  let rejectResult!: (reason?: unknown) => void;
  const result = new Promise<T>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });

  const queued = previous
    .catch(() => undefined)
    .then(async () => {
      try {
        const next = mutator(await readJson<T>(key));
        await writeJson(key, next);
        resolveResult(next);
      } catch (error) {
        rejectResult(error);
      }
    });

  mutationQueues.set(key, queued);
  void queued.finally(() => {
    if (mutationQueues.get(key) === queued) mutationQueues.delete(key);
  });

  return result;
}

export async function removeJson(key: string): Promise<void> {
  if (isEncryptedKey(key)) {
    await SessionMemoryCache.remove(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}
