/**
 * Projection Persistence Tests
 *
 * Tests for AsyncStorage-backed persistence of projection state
 * (local within-device memory). Covers:
 * 1. Load returns empty projection when key doesn't exist
 * 2. Save then load returns same data
 * 3. Load failure (corrupted data) returns empty projection gracefully
 * 4. Decay is applied before save at session end
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock AsyncStorage ─────────────────────────────────────────
const mockStorage: Record<string, string> = {};

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => mockStorage[key] ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: vi.fn(async (key: string) => {
      delete mockStorage[key];
    }),
  },
}));

import {
  loadEliasProjection,
  saveEliasProjection,
  loadAndRestoreEliasProjection,
  resetProjectionState,
  getProjectionState,
  detectProjectionSignals,
  applyProjectionDecay,
  resetSessionTracking,
} from '../lib/engine/elias/projection';

import type { EliasProjection } from '../lib/engine/elias/projection';

import {
  loadKimProjection,
  saveKimProjection,
  loadAndRestoreKimProjection,
  resetKimProjectionState,
  getKimProjectionState,
  detectKimProjectionSignals,
  applyKimProjectionDecay,
} from '../lib/engine/kim/projection';

import type { KimProjection } from '../lib/engine/kim/projection';

// ═══════════════════════════════════════════════════════════════
// 1. LOAD RETURNS EMPTY WHEN KEY DOESN'T EXIST
// ═══════════════════════════════════════════════════════════════

describe('Projection Persistence — Load Empty', () => {
  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    resetProjectionState();
    resetSessionTracking();
    resetKimProjectionState();
  });

  it('Elias: loadEliasProjection returns empty projection when key does not exist', async () => {
    const result = await loadEliasProjection();
    expect(result.userType).toBe('elias');
    expect(result.entries).toEqual([]);
    expect(result.sessionSignalCount).toBe(0);
    expect(typeof result.lastUpdatedAt).toBe('string');
  });

  it('Kim: loadKimProjection returns empty projection when key does not exist', async () => {
    const result = await loadKimProjection();
    expect(result.userType).toBe('kim');
    expect(result.entries).toEqual([]);
    expect(result.sessionSignalCount).toBe(0);
    expect(typeof result.lastUpdatedAt).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. SAVE THEN LOAD RETURNS SAME DATA
// ═══════════════════════════════════════════════════════════════

describe('Projection Persistence — Save/Load Roundtrip', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    resetProjectionState();
    resetSessionTracking();
    resetKimProjectionState();
  });

  it('Elias: save then load returns same projection data', async () => {
    const projection: EliasProjection = {
      userType: 'elias',
      entries: [
        {
          id: 'proj_test_001',
          category: 'fear',
          content: 'Fear of relapse',
          source: 'chat_signal',
          strength: 'moderate',
          decayScore: 60,
          firstSeenAt: '2025-01-01T00:00:00.000Z',
          lastReinforcedAt: '2025-01-02T00:00:00.000Z',
          reinforcementCount: 3,
          isUserConfirmed: false,
          isActive: true,
        },
      ],
      lastUpdatedAt: '2025-01-02T00:00:00.000Z',
      sessionSignalCount: 5,
    };

    await saveEliasProjection(projection);
    const loaded = await loadEliasProjection();

    expect(loaded.userType).toBe('elias');
    expect(loaded.entries).toHaveLength(1);
    expect(loaded.entries[0].id).toBe('proj_test_001');
    expect(loaded.entries[0].content).toBe('Fear of relapse');
    expect(loaded.entries[0].decayScore).toBe(60);
    expect(loaded.entries[0].strength).toBe('moderate');
    expect(loaded.lastUpdatedAt).toBe('2025-01-02T00:00:00.000Z');
  });

  it('Kim: save then load returns same projection data', async () => {
    const projection: KimProjection = {
      userType: 'kim',
      entries: [
        {
          id: 'kproj_test_001',
          category: 'hope',
          content: 'Hope for more autonomy',
          source: 'slider_signal',
          strength: 'strong',
          decayScore: 80,
          firstSeenAt: '2025-01-01T00:00:00.000Z',
          lastReinforcedAt: '2025-01-03T00:00:00.000Z',
          reinforcementCount: 5,
          isUserConfirmed: true,
          isActive: true,
        },
      ],
      lastUpdatedAt: '2025-01-03T00:00:00.000Z',
      sessionSignalCount: 8,
    };

    await saveKimProjection(projection);
    const loaded = await loadKimProjection();

    expect(loaded.userType).toBe('kim');
    expect(loaded.entries).toHaveLength(1);
    expect(loaded.entries[0].id).toBe('kproj_test_001');
    expect(loaded.entries[0].content).toBe('Hope for more autonomy');
    expect(loaded.entries[0].decayScore).toBe(80);
    expect(loaded.entries[0].isUserConfirmed).toBe(true);
    expect(loaded.lastUpdatedAt).toBe('2025-01-03T00:00:00.000Z');
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. CORRUPTED DATA RETURNS EMPTY PROJECTION GRACEFULLY
// ═══════════════════════════════════════════════════════════════

describe('Projection Persistence — Corrupted Data', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    resetProjectionState();
    resetSessionTracking();
    resetKimProjectionState();
  });

  it('Elias: corrupted JSON returns empty projection without crashing', async () => {
    mockStorage['@recofree_projection_elias'] = 'not valid json {{{';
    const result = await loadEliasProjection();
    expect(result.userType).toBe('elias');
    expect(result.entries).toEqual([]);
  });

  it('Elias: wrong shape returns empty projection without crashing', async () => {
    mockStorage['@recofree_projection_elias'] = JSON.stringify({
      userType: 'elias',
      // Missing entries array
      lastUpdatedAt: '2025-01-01T00:00:00.000Z',
    });
    const result = await loadEliasProjection();
    expect(result.userType).toBe('elias');
    expect(result.entries).toEqual([]);
  });

  it('Kim: corrupted JSON returns empty projection without crashing', async () => {
    mockStorage['@recofree_projection_kim'] = '{{invalid json!!';
    const result = await loadKimProjection();
    expect(result.userType).toBe('kim');
    expect(result.entries).toEqual([]);
  });

  it('Kim: wrong userType returns empty projection without crashing', async () => {
    mockStorage['@recofree_projection_kim'] = JSON.stringify({
      userType: 'elias', // Wrong type for Kim
      entries: [],
      lastUpdatedAt: '2025-01-01T00:00:00.000Z',
    });
    const result = await loadKimProjection();
    expect(result.userType).toBe('kim');
    expect(result.entries).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. DECAY IS APPLIED BEFORE SAVE AT SESSION END
// ═══════════════════════════════════════════════════════════════

describe('Projection Persistence — Decay Before Save', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    resetProjectionState();
    resetSessionTracking();
    resetKimProjectionState();
  });

  it('Elias: applyProjectionDecay persists decayed state to AsyncStorage', async () => {
    // Create an entry via signal detection
    detectProjectionSignals({
      message: 'I am afraid of relapse',
      distressScore: 8,
      resilienceScore: 2,
      vspLevel: 'ROOD',
      zoneImproved: false,
      consecutiveGreenSessions: 0,
    });

    const stateBefore = getProjectionState();
    expect(stateBefore.entries.length).toBeGreaterThan(0);

    // Apply decay at session end (this should also save)
    resetSessionTracking();
    const sessionEnd = new Date().toISOString();
    const result = await applyProjectionDecay(sessionEnd);

    // Verify it was saved to storage
    expect(mockStorage['@recofree_projection_elias']).toBeDefined();
    const savedData = JSON.parse(mockStorage['@recofree_projection_elias']);
    expect(savedData.userType).toBe('elias');
    expect(savedData.lastUpdatedAt).toBe(sessionEnd);
    // Entries should reflect decayed state
    if (savedData.entries.length > 0) {
      expect(savedData.entries[0].decayScore).toBeLessThanOrEqual(stateBefore.entries[0].decayScore);
    }
  });

  it('Kim: applyKimProjectionDecay persists decayed state to AsyncStorage', async () => {
    // Create an entry via signal detection
    detectKimProjectionSignals({
      message: 'I feel like I have no control',
      distressScore: 8,
      resilienceScore: 2,
      eigenRegieScore: 20,
      consecutiveHighRegieSessions: 0,
      zoneImproved: false,
    });

    const stateBefore = getKimProjectionState();
    expect(stateBefore.entries.length).toBeGreaterThan(0);

    // Apply decay at session end (this should also save)
    const sessionEnd = new Date().toISOString();
    const result = await applyKimProjectionDecay(sessionEnd);

    // Verify it was saved to storage
    expect(mockStorage['@recofree_projection_kim']).toBeDefined();
    const savedData = JSON.parse(mockStorage['@recofree_projection_kim']);
    expect(savedData.userType).toBe('kim');
    expect(savedData.lastUpdatedAt).toBe(sessionEnd);
    // Entries should reflect decayed state
    if (savedData.entries.length > 0) {
      expect(savedData.entries[0].decayScore).toBeLessThanOrEqual(stateBefore.entries[0].decayScore);
    }
  });

  it('Elias: loadAndRestoreEliasProjection restores persisted entries', async () => {
    // Save some data
    const projection: EliasProjection = {
      userType: 'elias',
      entries: [
        {
          id: 'proj_persist_001',
          category: 'goal',
          content: 'Want to stay sober for a year',
          source: 'user_explicit',
          strength: 'strong',
          decayScore: 90,
          firstSeenAt: '2025-01-01T00:00:00.000Z',
          lastReinforcedAt: '2025-01-05T00:00:00.000Z',
          reinforcementCount: 4,
          isUserConfirmed: true,
          isActive: true,
        },
      ],
      lastUpdatedAt: '2025-01-05T00:00:00.000Z',
      sessionSignalCount: 10,
    };
    await saveEliasProjection(projection);

    // Now simulate session start
    await loadAndRestoreEliasProjection();

    const state = getProjectionState();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].id).toBe('proj_persist_001');
    expect(state.entries[0].content).toBe('Want to stay sober for a year');
    // Session signal count should be reset to 0
    expect(state.sessionSignalCount).toBe(0);
  });
});
