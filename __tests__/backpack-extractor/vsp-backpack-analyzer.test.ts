/**
 * Tests for VSP Backpack Analyzer
 * 
 * Covers:
 * - checkAndAnalyzeVspProfile: hash-based change detection, caching, fallback
 * - loadCachedVspProfile: AsyncStorage read
 * - buildVspProfileContextBlock: prompt block formatting
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; return Promise.resolve(); }),
    removeItem: vi.fn((key: string) => { delete mockStorage[key]; return Promise.resolve(); }),
  },
}));

import {
  checkAndAnalyzeVspProfile,
  loadCachedVspProfile,
  buildVspProfileContextBlock,
  type VspBackpackProfileCached,
} from '../../lib/backpack-extractor/vsp-backpack-analyzer';

describe('VSP Backpack Analyzer', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.clearAllMocks();
  });

  describe('buildVspProfileContextBlock', () => {
    it('returns empty string when no zones have signals', () => {
      const result = buildVspProfileContextBlock({
        green: [],
        yellow: [],
        orange: [],
        red: [],
        purple: [],
      });
      expect(result).toBe('');
    });

    it('builds block with all zones populated', () => {
      const result = buildVspProfileContextBlock({
        green: ['sport', 'wandelen'],
        yellow: ['slaapproblemen', 'piekeren'],
        orange: ['isolatie'],
        red: ['craving', 'gebruik overwegen'],
        purple: ['suïcidale gedachten'],
      });
      expect(result).toContain('GREEN signals: sport; wandelen');
      expect(result).toContain('YELLOW signals: slaapproblemen; piekeren');
      expect(result).toContain('ORANGE signals: isolatie');
      expect(result).toContain('RED signals: craving; gebruik overwegen');
      expect(result).toContain('PURPLE signals: suïcidale gedachten');
      expect(result).toContain('Use this profile to understand');
    });

    it('only includes zones that have content', () => {
      const result = buildVspProfileContextBlock({
        green: ['sport'],
        yellow: [],
        orange: ['isolatie'],
        red: [],
        purple: [],
      });
      expect(result).toContain('GREEN signals: sport');
      expect(result).not.toContain('YELLOW');
      expect(result).toContain('ORANGE signals: isolatie');
      expect(result).not.toContain('RED');
      expect(result).not.toContain('PURPLE');
    });
  });

  describe('loadCachedVspProfile', () => {
    it('returns null when nothing cached', async () => {
      const result = await loadCachedVspProfile();
      expect(result).toBeNull();
    });

    it('returns parsed profile from AsyncStorage', async () => {
      const cached: VspBackpackProfileCached = {
        green: ['sport'],
        yellow: ['piekeren'],
        orange: [],
        red: [],
        purple: [],
        contextBlock: 'test block',
        analyzedAt: '2025-01-01T00:00:00.000Z',
        sourceHash: 'abc12345',
      };
      mockStorage['@vsp_backpack_profile'] = JSON.stringify(cached);
      const result = await loadCachedVspProfile();
      expect(result).toEqual(cached);
    });
  });

  describe('checkAndAnalyzeVspProfile', () => {
    const mockCallAnalysis = vi.fn();

    it('returns null for empty/short themes', async () => {
      const result = await checkAndAnalyzeVspProfile(null, mockCallAnalysis);
      expect(result).toBeNull();
      expect(mockCallAnalysis).not.toHaveBeenCalled();
    });

    it('returns null for themes shorter than 20 chars', async () => {
      const result = await checkAndAnalyzeVspProfile('short', mockCallAnalysis);
      expect(result).toBeNull();
    });

    it('returns cached contextBlock when hash unchanged', async () => {
      const themes = 'This is a recurring theme about isolation and craving patterns';
      // Compute hash manually (djb2)
      let hash = 5381;
      const trimmed = themes.trim();
      for (let i = 0; i < trimmed.length; i++) {
        hash = ((hash << 5) + hash) + trimmed.charCodeAt(i);
        hash = hash & hash;
      }
      const hashStr = (hash >>> 0).toString(16).padStart(8, '0');

      // Pre-populate cache with matching hash
      mockStorage['@vsp_backpack_hash'] = hashStr;
      const cached: VspBackpackProfileCached = {
        green: ['sport'],
        yellow: ['isolatie'],
        orange: [],
        red: ['craving'],
        purple: [],
        contextBlock: 'cached context block',
        analyzedAt: '2025-01-01T00:00:00.000Z',
        sourceHash: hashStr,
      };
      mockStorage['@vsp_backpack_profile'] = JSON.stringify(cached);

      const result = await checkAndAnalyzeVspProfile(themes, mockCallAnalysis);
      expect(result).toBe('cached context block');
      expect(mockCallAnalysis).not.toHaveBeenCalled();
    });

    it('calls analysis when hash changed and caches result', async () => {
      const themes = 'This is a new recurring theme about different patterns and behaviors';
      mockStorage['@vsp_backpack_hash'] = 'old_hash_value';

      const analysisResult: VspBackpackProfileCached = {
        green: ['wandelen', 'meditatie'],
        yellow: ['slaapproblemen'],
        orange: ['vermijding'],
        red: [],
        purple: [],
        contextBlock: 'new analysis block',
        analyzedAt: '2025-06-01T00:00:00.000Z',
        sourceHash: 'new_hash',
      };
      mockCallAnalysis.mockResolvedValue(analysisResult);

      const result = await checkAndAnalyzeVspProfile(themes, mockCallAnalysis);
      expect(result).toBe('new analysis block');
      expect(mockCallAnalysis).toHaveBeenCalledWith(expect.objectContaining({
        themesContent: themes.trim(),
      }));
      // Verify it was cached
      expect(mockStorage['@vsp_backpack_profile']).toBeDefined();
      const parsed = JSON.parse(mockStorage['@vsp_backpack_profile']);
      expect(parsed.contextBlock).toBe('new analysis block');
    });

    it('falls back to cached profile when analysis returns null', async () => {
      const themes = 'This is a recurring theme that triggers analysis but fails';
      mockStorage['@vsp_backpack_hash'] = 'different_hash';
      const cached: VspBackpackProfileCached = {
        green: ['sport'],
        yellow: [],
        orange: [],
        red: [],
        purple: [],
        contextBlock: 'fallback block',
        analyzedAt: '2025-01-01T00:00:00.000Z',
        sourceHash: 'old',
      };
      mockStorage['@vsp_backpack_profile'] = JSON.stringify(cached);
      mockCallAnalysis.mockResolvedValue(null);

      const result = await checkAndAnalyzeVspProfile(themes, mockCallAnalysis);
      expect(result).toBe('fallback block');
    });

    it('falls back to cached profile when analysis throws', async () => {
      const themes = 'This is a recurring theme that triggers analysis but throws error';
      mockStorage['@vsp_backpack_hash'] = 'different_hash';
      const cached: VspBackpackProfileCached = {
        green: ['sport'],
        yellow: [],
        orange: [],
        red: [],
        purple: [],
        contextBlock: 'error fallback block',
        analyzedAt: '2025-01-01T00:00:00.000Z',
        sourceHash: 'old',
      };
      mockStorage['@vsp_backpack_profile'] = JSON.stringify(cached);
      mockCallAnalysis.mockRejectedValue(new Error('Network error'));

      const result = await checkAndAnalyzeVspProfile(themes, mockCallAnalysis);
      expect(result).toBe('error fallback block');
    });

    it('calls analysis on first run (no previous hash)', async () => {
      const themes = 'This is a brand new recurring theme about recovery and progress';
      const analysisResult: VspBackpackProfileCached = {
        green: ['herstel'],
        yellow: [],
        orange: [],
        red: [],
        purple: [],
        contextBlock: 'first run block',
        analyzedAt: '2025-06-01T00:00:00.000Z',
        sourceHash: 'first',
      };
      mockCallAnalysis.mockResolvedValue(analysisResult);

      const result = await checkAndAnalyzeVspProfile(themes, mockCallAnalysis);
      expect(result).toBe('first run block');
      expect(mockCallAnalysis).toHaveBeenCalled();
    });
  });
});
