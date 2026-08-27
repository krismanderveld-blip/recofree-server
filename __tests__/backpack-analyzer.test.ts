import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Backpack, UserDat } from '@/lib/ai/types';

// Mock the Auth module and getApiBaseUrl before importing the trigger
vi.mock('@/lib/_core/auth', () => ({
  getSessionToken: vi.fn().mockResolvedValue('mock-token'),
}));
vi.mock('@/constants/oauth', () => ({
  getApiBaseUrl: vi.fn().mockReturnValue('http://localhost:3000'),
}));
vi.mock('@/lib/ai/minimal-proxy-client', () => ({
  callMinimalProxyJson: async () => {
    const response = await globalThis.fetch('/api/minimal-gpt-proxy', { method: 'POST' });
    if (!response.ok) throw new Error(`http_${response.status}`);
    const data = await response.json();
    return data?.result?.data?.json?.analysis ?? data;
  },
}));

// We test the merge logic by importing the trigger module
// The actual server call is mocked via fetch
import { triggerBackpackAnalysisIfNeeded } from '@/lib/backpack-analysis/schema-mode-trigger';

// Helper to create a minimal Elias backpack
function makeEliasBackpack(sections: Array<{ id: string; content: string; lastUpdated: string | null }>): Backpack {
  return {
    naam: 'TestElias',
    userType: 'elias',
    sections: sections.map(s => ({
      id: s.id as any,
      label: s.id,
      ageRange: '0-12',
      prompt: '',
      content: s.content,
      lastUpdated: s.lastUpdated,
    })),
    intakeContext: {
      stageOfChange: 'contemplation',
      startEmotion: '',
      urgency: 'midden',
      initialContext: '',
      intakeDate: '2026-01-01',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

// Helper to create a minimal Kim backpack
function makeKimBackpack(kimSections: Record<string, string>): Backpack {
  return {
    naam: 'TestKim',
    userType: 'kim',
    sections: [],
    kimBackpack: {
      my_story: kimSections.my_story || '',
      the_relationship: kimSections.the_relationship || '',
      the_impact: kimSections.the_impact || '',
      my_boundaries: kimSections.my_boundaries || '',
      my_strength: kimSections.my_strength || '',
    },
    intakeContext: {
      stageOfChange: undefined as any,
      startEmotion: '',
      urgency: 'midden',
      initialContext: '',
      intakeDate: '2026-01-01',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

// Helper to create a minimal UserDat
function makeUserDat(overrides: Partial<UserDat> = {}): UserDat {
  return {
    userName: 'Test',
    userType: 'elias',
    totalSessions: 1,
    currentMood: { craving: 0, frustration: 0, despondency: 0, focus: 5, vsp: null, vspScore: null },
    moodHistory: [],
    chatHistory: [],
    moduleUsage: [],
    triggerPatterns: [],
    schemaTendencies: [],
    modeTendencies: [],
    backpackAnalysisTimestamps: {},
    ...overrides,
  } as UserDat;
}

describe('BackpackAnalyzer — triggerBackpackAnalysisIfNeeded', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Change detection', () => {
    it('returns null when no sections have content', async () => {
      const backpack = makeEliasBackpack([
        { id: 'childhood', content: '', lastUpdated: null },
      ]);
      const userDat = makeUserDat();
      const result = await triggerBackpackAnalysisIfNeeded(backpack, userDat);
      expect(result).toBeNull();
    });

    it('returns null when sections have not been updated', async () => {
      const backpack = makeEliasBackpack([
        { id: 'childhood', content: 'Some content here that is long enough', lastUpdated: null },
      ]);
      const userDat = makeUserDat();
      const result = await triggerBackpackAnalysisIfNeeded(backpack, userDat);
      // lastUpdated is null, so nothing to analyze
      expect(result).toBeNull();
    });

    it('returns null when section was already analyzed at same timestamp', async () => {
      const timestamp = '2026-06-01T10:00:00.000Z';
      const backpack = makeEliasBackpack([
        { id: 'childhood', content: 'Ik ben opgegroeid in een klein dorp in Limburg met mijn ouders', lastUpdated: timestamp },
      ]);
      const userDat = makeUserDat({
        backpackAnalysisTimestamps: { childhood: timestamp },
      });
      const result = await triggerBackpackAnalysisIfNeeded(backpack, userDat);
      expect(result).toBeNull();
    });

    it('detects changed section when lastUpdated > analysis timestamp', async () => {
      const backpack = makeEliasBackpack([
        { id: 'childhood', content: 'Ik ben opgegroeid in een klein dorp in Limburg met mijn ouders en twee broers', lastUpdated: '2026-06-15T10:00:00.000Z' },
      ]);
      const userDat = makeUserDat({
        backpackAnalysisTimestamps: { childhood: '2026-06-01T10:00:00.000Z' },
      });

      // Mock fetch to return a successful analysis
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: {
            data: {
              json: {
                success: true,
                analysis: {
                  schemas: [
                    { schemaId: 'emotional_deprivation', domain: 'Disconnection & Rejection', confidence: 0.7, evidence: 'opgegroeid in klein dorp', sourceSectionId: 'childhood' },
                  ],
                  modes: [
                    { modeId: 'vulnerable_child', confidence: 0.6, evidence: 'ouders en twee broers', sourceSectionId: 'childhood' },
                  ],
                  analysisTimestamp: '2026-06-15T12:00:00.000Z',
                  analyzedSectionIds: ['childhood'],
                },
              },
            },
          },
        }),
      });

      const result = await triggerBackpackAnalysisIfNeeded(backpack, userDat);
      expect(result).not.toBeNull();
      expect(result!.analyzedSectionIds).toContain('childhood');
      expect(result!.updatedUserDat.schemaTendencies!.length).toBeGreaterThan(0);
      expect(result!.updatedUserDat.modeTendencies!.length).toBeGreaterThan(0);
      const analyzedAt = result!.updatedUserDat.backpackAnalysisTimestamps!['childhood'];
      expect(Date.parse(analyzedAt)).toBeGreaterThan(Date.parse('2026-06-15T10:00:00.000Z'));
    });

    it('detects Kim sections that have never been analyzed', async () => {
      const backpack = makeKimBackpack({
        my_story: 'Mijn partner is al vijf jaar verslaafd aan alcohol en ik weet niet meer wat ik moet doen',
        the_relationship: '',
        the_impact: '',
        my_boundaries: '',
        my_strength: '',
      });
      const userDat = makeUserDat({ backpackAnalysisTimestamps: {} });

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: {
            data: {
              json: {
                success: true,
                analysis: {
                  schemas: [
                    { schemaId: 'self_sacrifice', domain: 'Other-Directedness', confidence: 0.8, evidence: 'weet niet meer wat ik moet doen', sourceSectionId: 'my_story' },
                  ],
                  modes: [
                    { modeId: 'compliant_surrenderer', confidence: 0.65, evidence: 'vijf jaar verslaafd', sourceSectionId: 'my_story' },
                  ],
                  analysisTimestamp: '2026-06-15T12:00:00.000Z',
                  analyzedSectionIds: ['my_story'],
                },
              },
            },
          },
        }),
      });

      const result = await triggerBackpackAnalysisIfNeeded(backpack, userDat);
      expect(result).not.toBeNull();
      expect(result!.analyzedSectionIds).toContain('my_story');
      expect(result!.updatedUserDat.schemaTendencies![0].schemaId).toBe('self_sacrifice');
      expect(result!.updatedUserDat.modeTendencies![0].modeId).toBe('compliant_surrenderer');
    });
  });

  describe('Merge logic', () => {
    it('merges new schemas with existing schemaTendencies using moving average', async () => {
      const backpack = makeEliasBackpack([
        { id: 'childhood', content: 'Ik voelde me altijd alleen en onbegrepen door mijn ouders', lastUpdated: '2026-06-15T10:00:00.000Z' },
      ]);
      const userDat = makeUserDat({
        backpackAnalysisTimestamps: { childhood: '2026-06-01T10:00:00.000Z' },
        schemaTendencies: [
          {
            schemaId: 'emotional_deprivation',
            domain: 'Disconnection & Rejection',
            frequency: 3,
            lastSeen: '2026-06-01T10:00:00.000Z',
            copingStyle: null,
            firstDetectedAt: '2026-05-01T10:00:00.000Z',
            lastUpdatedAt: '2026-06-01T10:00:00.000Z',
            confidence: 0.6,
          },
        ],
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: {
            data: {
              json: {
                success: true,
                analysis: {
                  schemas: [
                    { schemaId: 'emotional_deprivation', domain: 'Disconnection & Rejection', confidence: 0.85, evidence: 'alleen en onbegrepen', sourceSectionId: 'childhood' },
                  ],
                  modes: [],
                  analysisTimestamp: '2026-06-15T12:00:00.000Z',
                  analyzedSectionIds: ['childhood'],
                },
              },
            },
          },
        }),
      });

      const result = await triggerBackpackAnalysisIfNeeded(backpack, userDat);
      expect(result).not.toBeNull();

      const schema = result!.updatedUserDat.schemaTendencies![0];
      expect(schema.schemaId).toBe('emotional_deprivation');
      expect(schema.frequency).toBe(4); // 3 + 1
      // Moving average: 0.6 * 0.6 + 0.85 * 0.4 = 0.36 + 0.34 = 0.70
      expect(schema.confidence).toBeCloseTo(0.7, 1);
      // firstDetectedAt should NOT change
      expect(schema.firstDetectedAt).toBe('2026-05-01T10:00:00.000Z');
    });

    it('auto-confirms schemas when freq>=5 AND confidence>=0.7', async () => {
      const backpack = makeEliasBackpack([
        { id: 'childhood', content: 'Ik voelde me altijd alleen en onbegrepen door mijn ouders', lastUpdated: '2026-06-15T10:00:00.000Z' },
      ]);
      const userDat = makeUserDat({
        backpackAnalysisTimestamps: { childhood: '2026-06-01T10:00:00.000Z' },
        schemaTendencies: [
          {
            schemaId: 'emotional_deprivation',
            domain: 'Disconnection & Rejection',
            frequency: 4, // Will become 5 after merge
            lastSeen: '2026-06-01T10:00:00.000Z',
            copingStyle: null,
            firstDetectedAt: '2026-05-01T10:00:00.000Z',
            lastUpdatedAt: '2026-06-01T10:00:00.000Z',
            confidence: 0.75, // Already high
          },
        ],
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: {
            data: {
              json: {
                success: true,
                analysis: {
                  schemas: [
                    { schemaId: 'emotional_deprivation', domain: 'Disconnection & Rejection', confidence: 0.9, evidence: 'alleen en onbegrepen', sourceSectionId: 'childhood' },
                  ],
                  modes: [],
                  analysisTimestamp: '2026-06-15T12:00:00.000Z',
                  analyzedSectionIds: ['childhood'],
                },
              },
            },
          },
        }),
      });

      const result = await triggerBackpackAnalysisIfNeeded(backpack, userDat);
      expect(result).not.toBeNull();

      const schema = result!.updatedUserDat.schemaTendencies![0];
      expect(schema.frequency).toBe(5);
      expect(schema.confirmed).toBe(true);
      expect(schema.confirmedAt).toBeDefined();
    });

    it('does not overwrite firstDetectedAt on existing tendencies', async () => {
      const originalFirstDetected = '2026-01-15T08:00:00.000Z';
      const backpack = makeEliasBackpack([
        { id: 'childhood', content: 'Ik voelde me altijd alleen en onbegrepen door mijn ouders', lastUpdated: '2026-06-15T10:00:00.000Z' },
      ]);
      const userDat = makeUserDat({
        backpackAnalysisTimestamps: { childhood: '2026-06-01T10:00:00.000Z' },
        modeTendencies: [
          {
            modeId: 'vulnerable_child',
            frequency: 2,
            lastSeen: '2026-06-01T10:00:00.000Z',
            effectiveInterventions: ['grounding'],
            firstDetectedAt: originalFirstDetected,
            lastUpdatedAt: '2026-06-01T10:00:00.000Z',
            confidence: 0.5,
          },
        ],
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          result: {
            data: {
              json: {
                success: true,
                analysis: {
                  schemas: [],
                  modes: [
                    { modeId: 'vulnerable_child', confidence: 0.7, evidence: 'alleen en onbegrepen', sourceSectionId: 'childhood' },
                  ],
                  analysisTimestamp: '2026-06-15T12:00:00.000Z',
                  analyzedSectionIds: ['childhood'],
                },
              },
            },
          },
        }),
      });

      const result = await triggerBackpackAnalysisIfNeeded(backpack, userDat);
      expect(result).not.toBeNull();

      const mode = result!.updatedUserDat.modeTendencies![0];
      expect(mode.firstDetectedAt).toBe(originalFirstDetected);
      expect(mode.frequency).toBe(3);
    });
  });

  describe('Error handling', () => {
    it('returns null when server returns error', async () => {
      const backpack = makeEliasBackpack([
        { id: 'childhood', content: 'Ik ben opgegroeid in een klein dorp in Limburg met mijn ouders', lastUpdated: '2026-06-15T10:00:00.000Z' },
      ]);
      const userDat = makeUserDat({
        backpackAnalysisTimestamps: {},
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await triggerBackpackAnalysisIfNeeded(backpack, userDat);
      expect(result).toBeNull();
    });

    it('returns null when network fails', async () => {
      const backpack = makeEliasBackpack([
        { id: 'childhood', content: 'Ik ben opgegroeid in een klein dorp in Limburg met mijn ouders', lastUpdated: '2026-06-15T10:00:00.000Z' },
      ]);
      const userDat = makeUserDat({
        backpackAnalysisTimestamps: {},
      });

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await triggerBackpackAnalysisIfNeeded(backpack, userDat);
      expect(result).toBeNull();
    });
  });
});
