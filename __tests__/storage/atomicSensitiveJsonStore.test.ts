import { beforeEach, describe, expect, it, vi } from 'vitest';

const { disk, cache, asyncSetItem, setPersisted } = vi.hoisted(() => {
  const disk: Record<string, string> = {};
  const cache: Record<string, string> = {};
  const asyncSetItem = vi.fn((key: string, value: string) => {
    disk[key] = value;
    return Promise.resolve();
  });
  const setPersisted = vi.fn((key: string, value: string) => {
    cache[key] = value;
    disk[key] = `RF_ENC_V1:test-envelope-for:${key}`;
    return Promise.resolve();
  });
  return { disk, cache, asyncSetItem, setPersisted };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(disk[key] ?? null)),
    setItem: asyncSetItem,
    removeItem: vi.fn((key: string) => { delete disk[key]; return Promise.resolve(); }),
  },
}));

vi.mock('@/lib/crypto/session-memory-cache', () => ({
  SessionMemoryCache: {
    get: vi.fn((key: string) => Promise.resolve(cache[key] ?? null)),
    set: vi.fn((key: string, value: string) => { cache[key] = value; return Promise.resolve(); }),
    setPersisted,
    remove: vi.fn((key: string) => { delete cache[key]; delete disk[key]; return Promise.resolve(); }),
  },
}));

import { readJson, updateJson, writeJson } from '@/lib/storage/memory/atomicJsonStore';

describe('Atomic sensitive JSON store', () => {
  beforeEach(() => {
    Object.keys(disk).forEach((key) => delete disk[key]);
    Object.keys(cache).forEach((key) => delete cache[key]);
    asyncSetItem.mockClear();
    setPersisted.mockClear();
  });

  it('writes user.dat only through the encrypted persistent boundary', async () => {
    await writeJson('@recofree_userdat', { schemas: ['a'] });

    expect(setPersisted).toHaveBeenCalledTimes(1);
    expect(asyncSetItem).not.toHaveBeenCalled();
    expect(disk['@recofree_userdat']).toMatch(/^RF_ENC_V1:/);
    await expect(readJson('@recofree_userdat')).resolves.toEqual({ schemas: ['a'] });
  });

  it('serializes concurrent read-modify-write updates without losing fields', async () => {
    cache['@recofree_userdat'] = JSON.stringify({ stable: true });

    await Promise.all([
      updateJson<Record<string, unknown>>('@recofree_userdat', (current) => ({
        ...(current ?? {}),
        extractedEntities: { persons: 1 },
      })),
      updateJson<Record<string, unknown>>('@recofree_userdat', (current) => ({
        ...(current ?? {}),
        schemas: ['abandonment'],
      })),
    ]);

    await expect(readJson('@recofree_userdat')).resolves.toEqual({
      stable: true,
      extractedEntities: { persons: 1 },
      schemas: ['abandonment'],
    });
    expect(setPersisted).toHaveBeenCalledTimes(2);
    expect(asyncSetItem).not.toHaveBeenCalled();
  });

  it('keeps non-sensitive preferences in normal AsyncStorage', async () => {
    await writeJson('@recofree_language', 'nl');
    expect(asyncSetItem).toHaveBeenCalledWith('@recofree_language', '"nl"');
    expect(setPersisted).not.toHaveBeenCalled();
  });
});
