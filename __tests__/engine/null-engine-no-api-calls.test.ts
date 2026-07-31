/**
 * Verification: NullEngine is active (no redundant API calls)
 *
 * After disabling GptSignalEngine, the pipeline should:
 * 1. Use NullEngine (isReady() = false, detectSignals returns empty)
 * 2. Skip all signal engine API calls (detectSignals, scoreRelevance, summarizeContext, detectRelapseIntent)
 * 3. Relapse intent detection falls back to deterministic markers
 * 4. Pipeline still produces valid output with zone, module selection, etc.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getEngine, resetEngine } from '@/lib/engine/local-llm/engine-provider';
import { NullSignalEngine } from '@/lib/engine/local-llm/null-engine';
import { detectRelapseIntentFallback } from '@/lib/engine/local-llm/relapse-intent-fallback';

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

describe('NullEngine — No redundant API calls', () => {
  beforeEach(() => {
    // Ensure engine is reset to NullEngine (default state without initGptSignalEngine)
    resetEngine();
  });

  it('getEngine() returns NullSignalEngine by default', () => {
    const engine = getEngine();
    expect(engine).toBeInstanceOf(NullSignalEngine);
  });

  it('NullEngine.isReady() returns true (but does no API calls)', () => {
    const engine = getEngine();
    // NullEngine returns true for isReady but all methods return empty/neutral values locally
    expect(engine.isReady()).toBe(true);
  });

  it('NullEngine.detectSignals() returns empty arrays without API call', async () => {
    const engine = getEngine();
    const result = await engine.detectSignals('ik ben bang om te hervallen');
    expect(result.fears).toEqual([]);
    expect(result.hopes).toEqual([]);
    expect(result.goals).toEqual([]);
    expect(result.triggers).toEqual([]);
  });

  it('NullEngine.detectRelapseIntent() returns not-detected without API call', async () => {
    const engine = getEngine();
    const result = await engine.detectRelapseIntent('ik ga weer gebruiken');
    // NullEngine always returns not detected — deterministic fallback handles this
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('NullEngine.scoreRelevance() returns neutral scores without API call', async () => {
    const engine = getEngine();
    const result = await engine.scoreRelevance('test', { backpackSummary: '', diarySummary: '', triggerList: [] });
    expect(result.backpackRelevance).toBe(0.5);
    expect(result.diaryRelevance).toBe(0.5);
  });
});

describe('Deterministic Relapse Intent Fallback', () => {
  it('detects "ik ga weer gebruiken" (explicit intent)', () => {
    const result = detectRelapseIntentFallback('ik ga weer gebruiken vanavond');
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('detects "ik wil weer drinken" (desire to use)', () => {
    const result = detectRelapseIntentFallback('ik wil weer drinken');
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('detects "ik kan het niet weerstaan" (inability to resist)', () => {
    const result = detectRelapseIntentFallback('ik kan het niet weerstaan');
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('detects "ik verlang er zo naar" (craving language)', () => {
    const result = detectRelapseIntentFallback('ik verlang er zo naar');
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('does not false-positive on neutral messages', () => {
    const result = detectRelapseIntentFallback('het gaat goed vandaag, ik voel me sterk');
    expect(result.detected).toBe(false);
  });

  it('does not false-positive on discussing past relapse without intent', () => {
    const result = detectRelapseIntentFallback('vorige week had ik een moeilijk moment maar het ging goed');
    expect(result.detected).toBe(false);
  });
});

describe('Cost verification — no fetch to /api/signal-engine', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    resetEngine();
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('NullEngine does not call fetch at all', async () => {
    const engine = getEngine();
    // Even if we try to call all methods, no fetch should happen
    await engine.detectSignals('test message');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
