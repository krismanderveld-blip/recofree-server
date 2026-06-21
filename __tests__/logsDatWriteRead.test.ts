/**
 * Verification test: logs.dat write + read end-to-end.
 * Confirms that sessionLifecycle.endSession() writes to logs.dat
 * and that the greeting path can read it back.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AsyncStorage
const mockStorage = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
  },
}));

// Mock expo-secure-store (not available in test env)
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(() => Promise.resolve(null)),
  setItemAsync: vi.fn(() => Promise.resolve()),
  AFTER_FIRST_UNLOCK: 1,
}));

// Mock storage-encryption to pass through (no actual encryption in test)
vi.mock("@/lib/crypto/storage-encryption", () => ({
  readEncrypted: vi.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  writeEncrypted: vi.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeEncrypted: vi.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
}));

// Mock the AES-256-GCM encryption to just pass through JSON
vi.mock("@/lib/storage/crypto/aes256gcm", () => ({
  encryptJsonAes256Gcm: vi.fn(async (_keyAlias: string, persona: string, value: any) => {
    // Return a fake envelope that stores plaintext as base64
    const json = JSON.stringify(value);
    const base64 = Buffer.from(json).toString("base64");
    return {
      schemaVersion: "logs.dat.encrypted.v2",
      persona,
      encryption: {
        algorithm: "AES-256-GCM",
        keyAlias: _keyAlias,
        ivBase64: "dGVzdGl2MTIzNDU2",
        authTagBase64: "dGVzdHRhZzEyMzQ1Njc4",
        createdAt: new Date().toISOString(),
      },
      ciphertextBase64: base64,
      updatedAt: new Date().toISOString(),
    };
  }),
  decryptJsonAes256Gcm: vi.fn(async (envelope: any) => {
    const json = Buffer.from(envelope.ciphertextBase64, "base64").toString("utf-8");
    return JSON.parse(json);
  }),
}));

// Mock fetch for generateSessionSummary GPT call
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: false,
    status: 503,
  } as Response)
);

// Mock debug logger
vi.mock("@/lib/debug/session-logger", () => ({
  logDebugEvent: vi.fn(),
}));

// Mock react-native Platform
vi.mock("react-native", () => ({
  Platform: { OS: "web" },
}));

import { createSessionLifecycleManager } from "@/lib/pipeline/memory/sessionLifecycle";
import { createLogsDatStore } from "@/lib/storage/memory/logsDatStore";

describe("logs.dat write + read verification", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("endSession writes a session summary to logs.dat that can be read back", async () => {
    const manager = createSessionLifecycleManager();

    // 1. Start session (initializes buffer)
    await manager.startSession("elias", "test-session-001", "local_user", "http://localhost:3000");

    // 2. Add messages to buffer (simulate a conversation)
    const stores = manager.getStores();
    const buffer = stores.sessionBufferStore.getBuffer();
    expect(buffer).not.toBeNull();

    stores.sessionBufferStore.appendMessage(buffer!, {
      turnId: "turn_1",
      role: "user",
      text: "Ik voel me vandaag gespannen",
      timestampIso: new Date().toISOString(),
    });
    const buf2 = stores.sessionBufferStore.getBuffer()!;
    stores.sessionBufferStore.appendMessage(buf2, {
      turnId: "turn_1",
      role: "assistant",
      text: "Dat klinkt zwaar. Kun je me meer vertellen?",
      timestampIso: new Date().toISOString(),
    });

    // 3. End session (should write to logs.dat even if GPT fails)
    const endResult = await manager.endSession("elias", "http://localhost:3000");

    expect(endResult.summarized).toBe(true);
    expect(endResult.sessionId).toBe("test-session-001");
    expect(endResult.error).toBeUndefined();

    // 4. Verify logs.dat now has 1 session
    const logsDatStore = createLogsDatStore();
    const logsDat = await logsDatStore.load("elias");

    expect(logsDat.sessions.length).toBe(1);
    expect(logsDat.sessions[0].sessionId).toBe("test-session-001");
    expect(logsDat.sessions[0].persona).toBe("elias");
    expect(logsDat.sessions[0].compressedNarrative).toBeTruthy();
    expect(logsDat.sessions[0].summarySchemaVersion).toBe("session_summary.v1");

    // 5. Verify greeting path can read it back
    const logsDatForGreeting = await stores.logsDatStore.load("elias");
    expect(logsDatForGreeting.sessions.length).toBe(1);
    const lastSession = logsDatForGreeting.sessions[0];
    expect(lastSession.compressedNarrative).toBeTruthy();
    expect(lastSession.discussedTopics).toBeInstanceOf(Array);
  });

  it("endSession returns error when buffer is empty (no startSession called)", async () => {
    const manager = createSessionLifecycleManager();

    // Don't call startSession — buffer is null
    const endResult = await manager.endSession("elias", "http://localhost:3000");

    expect(endResult.summarized).toBe(false);
    expect(endResult.error).toBe("no active buffer");
  });

  it("multiple sessions accumulate in logs.dat", async () => {
    const manager = createSessionLifecycleManager();

    // Session 1
    await manager.startSession("elias", "session-A", "local_user", "http://localhost:3000");
    const stores = manager.getStores();
    const buf1 = stores.sessionBufferStore.getBuffer()!;
    stores.sessionBufferStore.appendMessage(buf1, {
      turnId: "t1",
      role: "user",
      text: "Eerste sessie bericht",
      timestampIso: new Date().toISOString(),
    });
    await manager.endSession("elias", "http://localhost:3000");

    // Session 2
    await manager.startSession("elias", "session-B", "local_user", "http://localhost:3000");
    const buf2 = stores.sessionBufferStore.getBuffer()!;
    stores.sessionBufferStore.appendMessage(buf2, {
      turnId: "t2",
      role: "user",
      text: "Tweede sessie bericht",
      timestampIso: new Date().toISOString(),
    });
    await manager.endSession("elias", "http://localhost:3000");

    // Verify both sessions are in logs.dat
    const logsDat = await stores.logsDatStore.load("elias");
    expect(logsDat.sessions.length).toBe(2);
    expect(logsDat.sessions[0].sessionId).toBe("session-A");
    expect(logsDat.sessions[1].sessionId).toBe("session-B");
  });
});
