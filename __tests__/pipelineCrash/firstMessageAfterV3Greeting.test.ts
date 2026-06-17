/**
 * Targeted crash test: "undefined is not a function" after V3 greeting
 *
 * Scenario:
 *   1. V3 greeting engine runs (bypasses generateGreeting in pipeline)
 *   2. User sends first follow-up message
 *   3. processMessage is called with isSessionStart=false
 *   4. Pipeline module-level state (sessionBuffer, etc.) was NEVER initialized
 *      because generateGreeting (which calls resetSessionState + createBuffer) was skipped
 *
 * Expected: processMessage should NOT crash even when called without prior
 * resetSessionState/generateGreeting. It should handle null sessionBuffer gracefully.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

// ─── Mock fetch for SignalEngine ─────────────────────────────────
const originalFetch = globalThis.fetch;
function createMockFetch() {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    if (urlStr.includes('/api/signal-engine')) {
      return new Response(JSON.stringify({
        result: JSON.stringify({ fears: [], hopes: [], goals: [], triggers: [] }),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('/api/ai-chat') || urlStr.includes('/trpc')) {
      return new Response(JSON.stringify({
        result: { json: { response: 'Ik hoor je.', selectedModel: 'gpt-4o-mini', tokenUsage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 } } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not Found', { status: 404 });
  });
}

// ─── Imports (after mocks) ─────────────────────────────────────
import { processMessage, resetSessionState } from '../../lib/rugzak/pipeline';
import { initGptSignalEngine, resetEngine } from '../../lib/engine/local-llm/engine-provider';
import {
  createNewBackpack,
  createNewUserDat,
  type AIProvider,
  type AIResult,
  type ChatContext,
  type Backpack,
  type UserDat,
} from '../../lib/ai/types';

// ─── Fixtures ──────────────────────────────────────────────────
function createEliasBackpack(): Backpack {
  return createNewBackpack({
    userName: 'TestUser',
    userType: 'elias',
    stageOfChange: 'contemplation',
    eigenRegieLevel: null,
    startEmotion: 'neutraal',
    urgency: 'gemiddeld',
    initialContext: 'Ik ben op wandel in Tienen.',
  });
}

function createEliasUserDat(): UserDat {
  const ud = createNewUserDat('elias', 'contemplation');
  (ud.currentMood as any).vsp = 'GROEN';
  (ud.currentMood as any).vspScore = 20;
  (ud.currentMood as any).craving = 2;
  (ud.currentMood as any).frustration = 1;
  (ud.currentMood as any).despondency = 1;
  (ud.currentMood as any).focus = 8;
  return ud;
}

function createMockProvider(): AIProvider {
  return {
    generateResponse: async (context: ChatContext): Promise<AIResult> => ({
      response: 'Fijn dat je buiten bent! Hoe voelt het om even te wandelen?',
      selectedModel: 'gpt-4o-mini',
      tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    }),
  };
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════
describe('Pipeline Crash — First Message After V3 Greeting (no resetSessionState)', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    initGptSignalEngine('http://fake-signal-api');
    globalThis.fetch = createMockFetch() as any;
  });

  afterEach(() => {
    resetEngine();
    globalThis.fetch = originalFetch;
    // Clean up: reset session state after test
    resetSessionState();
  });

  it('CRASH TEST: processMessage does NOT crash when called without prior resetSessionState (V3 greeting path)', async () => {
    // Simulate the V3 greeting path: greeting engine ran successfully,
    // generateGreeting was NEVER called, so resetSessionState() was never invoked.
    // The pipeline module-level sessionBuffer is null (from a previous session or fresh start).
    // DO NOT call resetSessionState() here — that's the whole point of this test.

    const backpack = createEliasBackpack();
    const userDat = createEliasUserDat();
    const provider = createMockProvider();

    // First follow-up message after V3 greeting
    const result = await processMessage(
      backpack,
      'Ik mag op uitstap, ben momenteel op wandel in Tienen, geen grote uitstap hoor, maar gewoon eens buiten is al fijn',
      provider,
      userDat,
      { isSessionStart: false, diaryEntries: [] }
    );

    // Should complete without throwing
    expect(result).toBeDefined();
    expect(result.response).toBeDefined();
    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(0);
  });

  it('CRASH TEST: processMessage works when resetSessionState IS called first (baseline)', async () => {
    // Baseline: this is the normal path where generateGreeting was called
    resetSessionState();

    const backpack = createEliasBackpack();
    const userDat = createEliasUserDat();
    const provider = createMockProvider();

    const result = await processMessage(
      backpack,
      'Ik mag op uitstap, ben momenteel op wandel in Tienen',
      provider,
      userDat,
      { isSessionStart: false, diaryEntries: [] }
    );

    expect(result).toBeDefined();
    expect(result.response).toBeDefined();
    expect(typeof result.response).toBe('string');
  });

  it('CRASH TEST: two consecutive messages without resetSessionState', async () => {
    // Simulates V3 greeting → message 1 → message 2
    // No resetSessionState ever called

    const backpack = createEliasBackpack();
    const userDat = createEliasUserDat();
    const provider = createMockProvider();

    // Message 1
    const result1 = await processMessage(
      backpack,
      'Hallo, ik ben even buiten',
      provider,
      userDat,
      { isSessionStart: false, diaryEntries: [] }
    );
    expect(result1).toBeDefined();
    expect(result1.response).toBeDefined();

    // Message 2 (uses the state from message 1)
    const result2 = await processMessage(
      backpack,
      'Het gaat eigenlijk best goed vandaag',
      provider,
      result1.updatedUserDat,
      { isSessionStart: false, diaryEntries: [] }
    );
    expect(result2).toBeDefined();
    expect(result2.response).toBeDefined();
  });
});
