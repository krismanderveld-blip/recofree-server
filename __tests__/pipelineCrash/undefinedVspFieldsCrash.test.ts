/**
 * Targeted crash test: Pipeline with undefined/missing VSP fields.
 *
 * Scenario: User has a partially filled VSP section (some zones undefined,
 * some fields missing). First message after V3 greeting.
 *
 * This tests the hypothesis that 'undefined is not a function' could be
 * caused by accessing .trim(), .length, .map() on undefined VSP fields.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock expo-haptics
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

import { processMessage, resetSessionState } from '@/lib/rugzak/pipeline';
import type { Backpack, UserDat } from '@/lib/ai/types';

describe('Pipeline with undefined VSP fields', () => {
  beforeEach(() => {
    resetSessionState();
  });

  const mockProvider = {
    generateResponse: vi.fn().mockResolvedValue({
      response: 'Test response from AI',
      model: 'gpt-4o-mini',
      tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    }),
  };

  const baseBackpack: Backpack = {
    naam: 'TestUser',
    userType: 'elias',
    sections: [],
    intakeContext: { urgency: 'midden', startEmotion: '' },
    vspSection: {
      zones: {
        green: { signals: ['goed slapen'], whatHelps: ['wandelen'], anchorSentence: 'Ik ben oké' },
        yellow: undefined as any, // UNDEFINED zone — should not crash
        orange: { signals: undefined as any, whatHelps: [], anchorSentence: '' }, // undefined signals
        red: { signals: [], whatHelps: undefined as any, anchorSentence: undefined as any }, // undefined whatHelps + anchorSentence
        purple: undefined as any, // UNDEFINED zone
      },
      triggers: [
        { trigger: 'stress', counterThought: 'dit gaat voorbij' },
        { trigger: undefined as any, counterThought: undefined as any }, // undefined trigger fields
      ],
      recoveryRules: ['vroeg slapen', undefined as any], // undefined in array
      mainAnchorSentence: undefined as any, // undefined main anchor
    },
  } as any;

  const baseUserDat: UserDat = {
    chatHistory: [
      { id: 'msg_1', role: 'assistant', content: 'Hey TestUser, welkom terug.', timestamp: new Date().toISOString() },
    ],
    currentMood: {
      craving: 3,
      frustration: 2,
      despondency: 1,
      focus: 7,
      vsp: 'GROEN',
    },
    totalSessions: 5,
    lastSessionDate: new Date().toISOString().slice(0, 10),
    guidanceDepth: 'normal',
  } as any;

  it('T_VSP_01: should NOT crash with undefined VSP zone entries', async () => {
    const result = await processMessage(baseBackpack, 'Hoe gaat het vandaag?', mockProvider as any, baseUserDat, {
      isSessionStart: false,
      diaryEntries: [],
    });
    expect(result).toBeDefined();
    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(0);
  });

  it('T_VSP_02: should NOT crash with completely empty vspSection', async () => {
    const emptyVspBackpack = {
      ...baseBackpack,
      vspSection: {
        zones: {},
        triggers: [],
        recoveryRules: [],
        mainAnchorSentence: '',
      },
    };
    const result = await processMessage(emptyVspBackpack as any, 'Ik voel me goed', mockProvider as any, baseUserDat, {
      isSessionStart: false,
      diaryEntries: [],
    });
    expect(result).toBeDefined();
    expect(typeof result.response).toBe('string');
  });

  it('T_VSP_03: should NOT crash with null vspSection', async () => {
    const nullVspBackpack = {
      ...baseBackpack,
      vspSection: null,
    };
    const result = await processMessage(nullVspBackpack as any, 'Alles is rustig', mockProvider as any, baseUserDat, {
      isSessionStart: false,
      diaryEntries: [],
    });
    expect(result).toBeDefined();
    expect(typeof result.response).toBe('string');
  });

  it('T_VSP_04: should NOT crash with undefined vspSection', async () => {
    const undefinedVspBackpack = {
      ...baseBackpack,
      vspSection: undefined,
    };
    const result = await processMessage(undefinedVspBackpack as any, 'Gewoon een dagje thuis', mockProvider as any, baseUserDat, {
      isSessionStart: false,
      diaryEntries: [],
    });
    expect(result).toBeDefined();
    expect(typeof result.response).toBe('string');
  });

  it('T_VSP_05: should NOT crash when triggers array contains null entries', async () => {
    const nullTriggersBackpack = {
      ...baseBackpack,
      vspSection: {
        zones: { green: { signals: ['test'], whatHelps: ['test'], anchorSentence: 'test' } },
        triggers: [null, undefined, { trigger: 'valid', counterThought: 'valid' }],
        recoveryRules: [null, 'valid rule', undefined],
        mainAnchorSentence: 'Ik kan dit',
      },
    };
    const result = await processMessage(nullTriggersBackpack as any, 'Ik heb trek', mockProvider as any, baseUserDat, {
      isSessionStart: false,
      diaryEntries: [],
    });
    expect(result).toBeDefined();
    expect(typeof result.response).toBe('string');
  });
});
