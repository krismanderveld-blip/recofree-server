/**
 * Atomic JSON store using AsyncStorage.
 * Provides read/write with basic error handling.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Read a JSON value from AsyncStorage.
 * Returns null if key doesn't exist or parse fails.
 */
export async function readJson<T>(key: string): Promise<T | null> {
  try {
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
  await AsyncStorage.setItem(key, serialized);
}

/**
 * Remove a key from AsyncStorage.
 */
export async function removeJson(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}
