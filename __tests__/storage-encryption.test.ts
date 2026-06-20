/**
 * Targeted tests for AES-256-GCM storage encryption.
 * Validates: encrypt/decrypt round-trip, migration, SENSITIVE_KEYS coverage,
 * memory store key detection in atomicJsonStore.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock expo-secure-store
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  AFTER_FIRST_UNLOCK: 6,
}));

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

// Mock react-native Platform
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

describe('storage-encryption', () => {
  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  });

  it('writeEncrypted produces RF_ENC_V1: prefix', async () => {
    const { writeEncrypted } = await import('@/lib/crypto/storage-encryption');
    await writeEncrypted('@recofree_userdat', JSON.stringify({ name: 'Kris' }));

    const stored = mockStorage['@recofree_userdat'];
    expect(stored).toBeDefined();
    expect(stored.startsWith('RF_ENC_V1:')).toBe(true);
  });

  it('readEncrypted decrypts correctly', async () => {
    const { writeEncrypted, readEncrypted } = await import('@/lib/crypto/storage-encryption');
    const original = JSON.stringify({ triggers: ['alcohol', 'stress'], sessions: 5 });
    await writeEncrypted('@recofree_diary', original);

    const decrypted = await readEncrypted('@recofree_diary');
    expect(decrypted).toBe(original);
  });

  it('readEncrypted migrates legacy plain JSON on read', async () => {
    const { readEncrypted } = await import('@/lib/crypto/storage-encryption');
    const plainJson = JSON.stringify({ legacy: true });
    mockStorage['@recofree_backpack'] = plainJson;

    const result = await readEncrypted('@recofree_backpack');
    expect(result).toBe(plainJson);

    // After read, the stored value should now be encrypted
    const stored = mockStorage['@recofree_backpack'];
    expect(stored.startsWith('RF_ENC_V1:')).toBe(true);
  });

  it('SENSITIVE_KEYS contains all 7 expected keys', async () => {
    const { SENSITIVE_KEYS } = await import('@/lib/crypto/storage-encryption');
    expect(SENSITIVE_KEYS).toContain('@recofree_userdat');
    expect(SENSITIVE_KEYS).toContain('@recofree_backpack');
    expect(SENSITIVE_KEYS).toContain('@recofree_diary');
    expect(SENSITIVE_KEYS).toContain('@recofree_projection_elias');
    expect(SENSITIVE_KEYS).toContain('@recofree_projection_kim');
    expect(SENSITIVE_KEYS).toContain('@recofree_extracted_entities');
    expect(SENSITIVE_KEYS).toContain('@vsp_backpack_profile');
    expect(SENSITIVE_KEYS.length).toBe(7);
  });

  it('MEMORY_STORE_KEYS contains all 6 persona memory keys', async () => {
    const { MEMORY_STORE_KEYS } = await import('@/lib/crypto/storage-encryption');
    expect(MEMORY_STORE_KEYS).toContain('recofree_memory/elias/user.dat');
    expect(MEMORY_STORE_KEYS).toContain('recofree_memory/elias/state.dat');
    expect(MEMORY_STORE_KEYS).toContain('recofree_memory/elias/projections.dat');
    expect(MEMORY_STORE_KEYS).toContain('recofree_memory/kim/user.dat');
    expect(MEMORY_STORE_KEYS).toContain('recofree_memory/kim/state.dat');
    expect(MEMORY_STORE_KEYS).toContain('recofree_memory/kim/projections.dat');
    expect(MEMORY_STORE_KEYS.length).toBe(6);
  });

  it('migrateAllToEncrypted encrypts plain JSON keys', async () => {
    const { migrateAllToEncrypted } = await import('@/lib/crypto/storage-encryption');
    mockStorage['@recofree_userdat'] = JSON.stringify({ name: 'test' });
    mockStorage['@recofree_diary'] = JSON.stringify([{ entry: 'dag 1' }]);

    const result = await migrateAllToEncrypted();
    expect(result.migrated).toContain('@recofree_userdat');
    expect(result.migrated).toContain('@recofree_diary');

    // Verify encrypted
    expect(mockStorage['@recofree_userdat'].startsWith('RF_ENC_V1:')).toBe(true);
    expect(mockStorage['@recofree_diary'].startsWith('RF_ENC_V1:')).toBe(true);
  });

  it('migrateAllToEncrypted skips already-encrypted keys', async () => {
    const { writeEncrypted, migrateAllToEncrypted } = await import('@/lib/crypto/storage-encryption');
    await writeEncrypted('@recofree_userdat', JSON.stringify({ name: 'test' }));

    const result = await migrateAllToEncrypted();
    expect(result.alreadyEncrypted).toContain('@recofree_userdat');
    expect(result.migrated).not.toContain('@recofree_userdat');
  });

  it('migrateAllToEncrypted reports missing keys', async () => {
    const { migrateAllToEncrypted } = await import('@/lib/crypto/storage-encryption');
    const result = await migrateAllToEncrypted();
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.missing).toContain('@recofree_userdat');
  });

  it('isKeyEncrypted returns correct status', async () => {
    const { writeEncrypted, isKeyEncrypted } = await import('@/lib/crypto/storage-encryption');
    await writeEncrypted('@recofree_userdat', 'test');

    expect(await isKeyEncrypted('@recofree_userdat')).toBe(true);
    expect(await isKeyEncrypted('@nonexistent')).toBe(false);

    mockStorage['@recofree_backpack'] = '{"plain": true}';
    expect(await isKeyEncrypted('@recofree_backpack')).toBe(false);
  });
});

describe('atomicJsonStore encryption routing', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  });

  it('encrypts memory store keys (user.dat, state.dat, projections.dat)', async () => {
    const { writeJson, readJson } = await import('@/lib/storage/memory/atomicJsonStore');
    const testData = { persona: 'elias', triggers: ['stress'] };

    await writeJson('recofree_memory/elias/user.dat', testData);
    const stored = mockStorage['recofree_memory/elias/user.dat'];
    expect(stored.startsWith('RF_ENC_V1:')).toBe(true);

    const retrieved = await readJson('recofree_memory/elias/user.dat');
    expect(retrieved).toEqual(testData);
  });

  it('does NOT encrypt logs.dat (has own encryption)', async () => {
    const { writeJson } = await import('@/lib/storage/memory/atomicJsonStore');
    const testData = { schemaVersion: 'logs.dat.encrypted.v2' };

    await writeJson('recofree_memory/elias/logs.dat', testData);
    const stored = mockStorage['recofree_memory/elias/logs.dat'];
    // Should be plain JSON, not encrypted by our layer
    expect(stored.startsWith('RF_ENC_V1:')).toBe(false);
    expect(JSON.parse(stored)).toEqual(testData);
  });

  it('encrypts Kim persona memory keys too', async () => {
    const { writeJson, readJson } = await import('@/lib/storage/memory/atomicJsonStore');
    const testData = { persona: 'kim', mood: { stress: 7 } };

    await writeJson('recofree_memory/kim/state.dat', testData);
    const stored = mockStorage['recofree_memory/kim/state.dat'];
    expect(stored.startsWith('RF_ENC_V1:')).toBe(true);

    const retrieved = await readJson('recofree_memory/kim/state.dat');
    expect(retrieved).toEqual(testData);
  });

  it('does NOT encrypt non-memory keys', async () => {
    const { writeJson } = await import('@/lib/storage/memory/atomicJsonStore');
    const testData = { hash: 'abc123' };

    await writeJson('@recofree_backpack_hash', testData);
    const stored = mockStorage['@recofree_backpack_hash'];
    expect(stored.startsWith('RF_ENC_V1:')).toBe(false);
    expect(JSON.parse(stored)).toEqual(testData);
  });
});
