/**
 * SessionMemoryCache — Session-based encryption timing.
 *
 * Instead of decrypt/encrypt per message, this cache:
 * 1. Decrypts all memory layers ONCE at app-open (unlock)
 * 2. Serves reads/writes from in-memory during the session
 * 3. Encrypts and flushes to storage on:
 *    - 10 minutes of inactivity
 *    - App going to background/closing
 *    - Explicit lock() call
 *
 * Data lives ONLY in app memory (never written unencrypted to disk).
 * Persona separation is preserved — each persona has its own cache slot.
 */

import { readEncrypted, writeEncrypted, removeEncrypted } from './storage-encryption';
import { AppState, type AppStateStatus } from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CacheKey = string;

interface CacheEntry {
  value: string;
  dirty: boolean;
}

type CacheState = 'locked' | 'unlocking' | 'unlocked';

// ─── Constants ──────────────────────────────────────────────────────────────

const INACTIVITY_FLUSH_MS = 10 * 60 * 1000; // 10 minutes

// ─── Singleton ──────────────────────────────────────────────────────────────

class SessionMemoryCacheImpl {
  private store = new Map<CacheKey, CacheEntry>();
  private state: CacheState = 'locked';
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivityMs: number = Date.now();
  private appStateSubscription: { remove: () => void } | null = null;
  private registeredKeys: Set<CacheKey> = new Set();
  private unlockPromise: Promise<void> | null = null;

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register keys that should be managed by this cache.
   * Call this at app startup before unlock().
   */
  registerKeys(keys: CacheKey[]): void {
    for (const key of keys) {
      this.registeredKeys.add(key);
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Decrypt all registered keys from storage into memory.
   * Call once at app-open or after biometric unlock.
   * Safe to call multiple times — subsequent calls are no-ops if already unlocked.
   */
  async unlock(): Promise<void> {
    if (this.state === 'unlocked') return;
    if (this.state === 'unlocking' && this.unlockPromise) {
      await this.unlockPromise;
      return;
    }

    this.state = 'unlocking';
    this.unlockPromise = this._doUnlock();
    await this.unlockPromise;
    this.unlockPromise = null;
  }

  private async _doUnlock(): Promise<void> {
    // Decrypt all registered keys in parallel
    const entries = await Promise.all(
      Array.from(this.registeredKeys).map(async (key) => {
        try {
          const value = await readEncrypted(key);
          return { key, value };
        } catch (error) {
          console.warn(`[SessionMemoryCache] Failed to decrypt key "${key}":`, error);
          return { key, value: null };
        }
      })
    );

    // Populate in-memory store
    for (const { key, value } of entries) {
      if (value !== null) {
        this.store.set(key, { value, dirty: false });
      }
    }

    this.state = 'unlocked';
    this.lastActivityMs = Date.now();
    this.startInactivityTimer();
    this.startAppStateListener();

    console.log(`[SessionMemoryCache] Unlocked ${this.store.size}/${this.registeredKeys.size} keys into memory`);
  }

  /**
   * Flush all dirty entries to encrypted storage, then clear memory.
   * Call when the user logs out or the app is being terminated.
   */
  async lock(): Promise<void> {
    if (this.state === 'locked') return;

    await this.flush();
    this.store.clear();
    this.state = 'locked';
    this.stopInactivityTimer();
    this.stopAppStateListener();

    console.log('[SessionMemoryCache] Locked — memory cleared');
  }

  /**
   * Encrypt and write all dirty entries to storage.
   * Does NOT clear memory — cache remains usable after flush.
   */
  async flush(): Promise<void> {
    if (this.state !== 'unlocked') return;

    const dirtyEntries = Array.from(this.store.entries())
      .filter(([, entry]) => entry.dirty);

    if (dirtyEntries.length === 0) return;

    await Promise.all(
      dirtyEntries.map(async ([key, entry]) => {
        try {
          await writeEncrypted(key, entry.value);
          entry.dirty = false;
        } catch (error) {
          console.error(`[SessionMemoryCache] Failed to flush key "${key}":`, error);
        }
      })
    );

    console.log(`[SessionMemoryCache] Flushed ${dirtyEntries.length} dirty entries to encrypted storage`);
  }

  // ── Read/Write ────────────────────────────────────────────────────────────

  /**
   * Read a value from the in-memory cache.
   * Returns null if key doesn't exist or cache is locked.
   * Falls back to direct encrypted read if cache is locked (backward compat).
   */
  async get(key: CacheKey): Promise<string | null> {
    this.touchActivity();

    if (this.state === 'unlocked') {
      const entry = this.store.get(key);
      return entry?.value ?? null;
    }

    // Fallback: if cache is locked, read directly (backward compat during transition)
    console.warn(`[SessionMemoryCache] get("${key}") called while locked — falling back to direct read`);
    return await readEncrypted(key);
  }

  /**
   * Write a value to the in-memory cache (marks as dirty).
   * The value will be encrypted and flushed on the next flush/lock cycle.
   */
  async set(key: CacheKey, value: string): Promise<void> {
    this.touchActivity();

    if (this.state === 'unlocked') {
      this.store.set(key, { value, dirty: true });
      return;
    }

    // Fallback: if cache is locked, write directly (backward compat during transition)
    console.warn(`[SessionMemoryCache] set("${key}") called while locked — falling back to direct write`);
    await writeEncrypted(key, value);
  }

  /**
   * Remove a key from cache and storage.
   */
  async remove(key: CacheKey): Promise<void> {
    this.store.delete(key);
    await removeEncrypted(key);
  }

  // ── Status ────────────────────────────────────────────────────────────────

  isUnlocked(): boolean {
    return this.state === 'unlocked';
  }

  hasDirtyEntries(): boolean {
    return Array.from(this.store.values()).some(e => e.dirty);
  }

  // ── Inactivity Timer ──────────────────────────────────────────────────────

  private touchActivity(): void {
    this.lastActivityMs = Date.now();
    // Reset inactivity timer on every read/write
    this.restartInactivityTimer();
  }

  private startInactivityTimer(): void {
    this.stopInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      this.onInactivityTimeout();
    }, INACTIVITY_FLUSH_MS);
  }

  private restartInactivityTimer(): void {
    if (this.state !== 'unlocked') return;
    this.startInactivityTimer();
  }

  private stopInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private async onInactivityTimeout(): Promise<void> {
    console.log('[SessionMemoryCache] 10min inactivity — flushing to encrypted storage');
    await this.flush();
    // Don't lock — just flush. User might come back.
    // Restart timer for next inactivity window.
    this.startInactivityTimer();
  }

  // ── AppState Listener ─────────────────────────────────────────────────────

  private startAppStateListener(): void {
    this.stopAppStateListener();
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private stopAppStateListener(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  private handleAppStateChange = async (nextState: AppStateStatus): Promise<void> => {
    if (nextState === 'background' || nextState === 'inactive') {
      // App going to background or being closed — flush immediately
      console.log(`[SessionMemoryCache] App state → ${nextState} — flushing to encrypted storage`);
      await this.flush();
    } else if (nextState === 'active') {
      // App returning to foreground — restart inactivity timer
      this.touchActivity();
    }
  };
}

// ─── Export Singleton ───────────────────────────────────────────────────────

export const SessionMemoryCache = new SessionMemoryCacheImpl();
