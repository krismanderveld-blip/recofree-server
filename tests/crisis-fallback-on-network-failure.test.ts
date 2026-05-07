/**
 * Integration Test: crisis-fallback-on-network-failure
 *
 * Verifies that when the OpenAI fetch call fails (network error or HTTP error)
 * and crisisLevel >= 1, the system returns a static crisis-fallback response
 * containing emergency numbers (113, 112) instead of throwing a generic error.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateAIResponse } from '../server/ai-chat';

// ─── Minimal valid input with crisisLevel >= 1 ──────────────────────

const crisisInput = {
  userType: 'elias' as const,
  userName: 'CrisisUser',
  message: 'I do not want to be here anymore',
  conversationHistory: [
    { role: 'assistant' as const, content: 'Hey CrisisUser, I am here for you.' },
  ],
  moodSliders: { craving: 8, frustration: 9, despondency: 9, focus: 1 },
  activeModules: ['E01'],
  crisisLevel: 2,
  detectedEmotion: 'despair',
  therapeuticStance: 'tone:grounding | Direct and safe.',
  sessionDurationMinutes: 2,
  urgency: 'high',
  startEmotion: 'despair',
  isSessionStart: false,
};

// ─── Tests ──────────────────────────────────────────────────────────

describe('crisis-fallback-on-network-failure', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns static crisis-fallback with 113 and 112 on network error (fetch throws)', async () => {
    // Mock fetch to simulate a network failure (e.g., DNS resolution failure, timeout)
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error: ECONNREFUSED'));

    const result = await generateAIResponse(crisisInput);

    // Should NOT throw — should return a static fallback
    expect(result).toBeDefined();
    expect(result.response).toContain('113');
    expect(result.response).toContain('112');
    expect(result.response).not.toContain('Something went wrong');
    expect(result.response).not.toContain('try again');
    // Confidence should be 0 (no AI was involved)
    expect(result.advisoryConfidence).toBe(0);
    // Token usage should be undefined (no API call succeeded)
    expect(result.tokenUsage).toBeUndefined();
  });

  it('returns static crisis-fallback with 113 and 112 on HTTP error (500)', async () => {
    // Mock fetch to simulate an HTTP 500 from OpenAI
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as Response);

    const result = await generateAIResponse(crisisInput);

    // Should NOT throw — should return a static fallback
    expect(result).toBeDefined();
    expect(result.response).toContain('113');
    expect(result.response).toContain('112');
    expect(result.response).not.toContain('Something went wrong');
    // Should be in English
    expect(result.response).toContain('do not feel safe');
    expect(result.advisoryConfidence).toBe(0);
    expect(result.tokenUsage).toBeUndefined();
  });

  it('returns static crisis-fallback on HTTP 429 (rate limit) with crisisLevel=1', async () => {
    // Mock fetch to simulate rate limiting
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    } as Response);

    const result = await generateAIResponse({ ...crisisInput, crisisLevel: 1 });

    expect(result).toBeDefined();
    expect(result.response).toContain('113');
    expect(result.response).toContain('112');
    expect(result.advisoryConfidence).toBe(0);
  });

  it('still throws on network error when crisisLevel=0 (non-crisis)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error: ECONNREFUSED'));

    await expect(
      generateAIResponse({ ...crisisInput, crisisLevel: 0 })
    ).rejects.toThrow();
  });

  it('still throws on HTTP error when crisisLevel=0 (non-crisis)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as Response);

    await expect(
      generateAIResponse({ ...crisisInput, crisisLevel: 0 })
    ).rejects.toThrow('OpenAI API error: 500');
  });
});
