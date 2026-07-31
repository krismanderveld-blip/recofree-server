/**
 * Integration test: Quiet close (back-button / tab-switch) writes a full
 * session summary to logs.dat — NOT just an incremental_ entry.
 *
 * This proves the fix for the bug where leaving chat via back-button
 * resulted in only an incomplete incremental_ entry in logs.dat.
 *
 * Strategy:
 * 1. Start a session via the lifecycle manager
 * 2. Append several messages to the buffer (simulating a real chat)
 * 3. Call lifecycleManager.endSession() with chatHistory fallback
 *    (this is what closeSessionQuietly does internally)
 * 4. Verify logs.dat contains a full summary (not incremental_)
 * 5. Verify the concurrency lock prevents double-writes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSessionLifecycleManager } from '@/lib/pipeline/memory/sessionLifecycle';
import { createLogsDatStore } from '@/lib/storage/memory/logsDatStore';
import { createSessionBufferStore } from '@/lib/storage/memory/sessionBufferStore';
import { createUserDatStore } from '@/lib/storage/memory/userDatStore';
import { createStateDatStore } from '@/lib/storage/memory/stateDatStore';
import { createProjectionsDatStore } from '@/lib/storage/memory/projectionsDatStore';
import { resetSessionCloseLock } from '@/lib/pipeline/memory/unifiedSessionEndWriter';
import type { RecoFreePersona } from '@/lib/types/memory/memoryCore.types';

// Mock the GPT summarization endpoint — dynamically returns the correct sessionId
vi.mock('@/lib/pipeline/memory/sessionEndSummarizer', () => ({
  generateSessionSummary: vi.fn().mockImplementation(async ({ sessionId }: { sessionId: string }) => ({
    summary: {
      summaryId: `gpt_summary_${sessionId}`,
      sessionId,
      persona: 'kim',
      startedAt: new Date(Date.now() - 1800000).toISOString(),
      endedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      summaryModel: 'gpt-4o-mini',
      summarySchemaVersion: 'session_summary.v1',
      compressedNarrative: 'De gebruiker sprak over triggers en coping-strategieën. Er was een doorbraak rond het herkennen van vermijdingspatronen.',
      discussedTopics: ['triggers', 'coping', 'vermijding'],
      emotionalThemes: [{ label: 'opluchting', intensity: 0.7 }],
      breakthroughs: [{ description: 'Herkenning vermijdingspatroon', significance: 0.8 }],
      relapseOrRiskEvents: [{ eventType: 'none', description: '', severity: 0 }],
      openEndpoints: [{ label: 'Verdieping coping-strategieën', category: 'follow_up' }],
      extractedCandidates: { fears: ['terugval'], hopes: ['controle'], triggers: ['stress'], schemaTendencies: [], modeTendencies: [] },
      moduleTrace: ['psychoeducatie'],
      zoneTrace: ['green'],
      inputTokenEstimate: 1200,
      outputTokenEstimate: 400,
    },
  })),
}));

describe('Quiet close writes full summary to logs.dat', () => {
  const persona: RecoFreePersona = 'kim';
  const apiBase = 'http://localhost:3000';

  let lifecycleManager: ReturnType<typeof createSessionLifecycleManager>;
  let logsDatStore: ReturnType<typeof createLogsDatStore>;

  beforeEach(() => {
    // Reset concurrency lock between tests
    resetSessionCloseLock();

    logsDatStore = createLogsDatStore();
    const sessionBufferStore = createSessionBufferStore();
    const userDatStore = createUserDatStore();
    const stateDatStore = createStateDatStore();
    const projectionsDatStore = createProjectionsDatStore();

    lifecycleManager = createSessionLifecycleManager();
  });

  it('writes a GPT-summarized entry (not incremental_) after quiet close', async () => {
    // 1. Start session
    const sessionId = 'test_session_quiet';
    await lifecycleManager.startSession(persona, sessionId, 'test_user', apiBase);

    // 2. Append messages to buffer (simulating chat turns)
    const buffer = lifecycleManager.getStores().sessionBufferStore.getBuffer()!;
    lifecycleManager.getStores().sessionBufferStore.appendMessage(buffer, {
      turnId: 'turn_1',
      role: 'user',
      text: 'Ik heb vandaag een trigger gehad op werk',
      timestampIso: '2025-01-15T10:05:00.000Z',
    });
    const buffer2 = lifecycleManager.getStores().sessionBufferStore.getBuffer()!;
    lifecycleManager.getStores().sessionBufferStore.appendMessage(buffer2, {
      turnId: 'turn_1',
      role: 'assistant',
      text: 'Dat klinkt uitdagend. Kun je vertellen wat er precies gebeurde?',
      timestampIso: '2025-01-15T10:05:30.000Z',
    });
    const buffer3 = lifecycleManager.getStores().sessionBufferStore.getBuffer()!;
    lifecycleManager.getStores().sessionBufferStore.appendMessage(buffer3, {
      turnId: 'turn_2',
      role: 'user',
      text: 'Mijn collega bood me een drankje aan en ik voelde de drang',
      timestampIso: '2025-01-15T10:10:00.000Z',
    });

    // 3. Call endSession with chatHistory fallback (same as closeSessionQuietly)
    const chatHistoryFallback = [
      { role: 'user', content: 'Ik heb vandaag een trigger gehad op werk', timestamp: '2025-01-15T10:05:00.000Z' },
      { role: 'assistant', content: 'Dat klinkt uitdagend. Kun je vertellen wat er precies gebeurde?', timestamp: '2025-01-15T10:05:30.000Z' },
      { role: 'user', content: 'Mijn collega bood me een drankje aan en ik voelde de drang', timestamp: '2025-01-15T10:10:00.000Z' },
    ];

    const result = await lifecycleManager.endSession(persona, apiBase, chatHistoryFallback);

    // 4. Verify result indicates GPT summarization
    expect(result.summarized).toBe(true);
    expect(result.sessionId).toBe(sessionId);

    // 5. Verify logs.dat has the full summary (not incremental_)
    const logsDat = await logsDatStore.load(persona);
    expect(logsDat.sessions.length).toBeGreaterThanOrEqual(1);

    const lastSession = logsDat.sessions[logsDat.sessions.length - 1];
    // Key assertion: summaryId should NOT start with 'incremental_'
    expect(lastSession.summaryId).not.toMatch(/^incremental_/);
    // Should have real GPT content
    expect(lastSession.compressedNarrative).toContain('triggers');
    expect(lastSession.discussedTopics).toContain('coping');
    expect(lastSession.emotionalThemes.length).toBeGreaterThan(0);
    expect(lastSession.openEndpoints.length).toBeGreaterThan(0);
  });

  it('falls back to buffer summary when GPT times out (simulating quiet close timeout)', async () => {
    // Override mock to simulate timeout
    const { generateSessionSummary } = await import('@/lib/pipeline/memory/sessionEndSummarizer');
    (generateSessionSummary as any).mockRejectedValueOnce(new Error('quiet_close_timeout'));

    // Start session and add messages
    const sessionId = 'test_session_timeout';
    await lifecycleManager.startSession(persona, sessionId, 'test_user', apiBase);
    const buffer = lifecycleManager.getStores().sessionBufferStore.getBuffer()!;
    lifecycleManager.getStores().sessionBufferStore.appendMessage(buffer, {
      turnId: 'turn_1',
      role: 'user',
      text: 'Vandaag was moeilijk',
      timestampIso: '2025-01-15T10:05:00.000Z',
    });
    const buffer2 = lifecycleManager.getStores().sessionBufferStore.getBuffer()!;
    lifecycleManager.getStores().sessionBufferStore.appendMessage(buffer2, {
      turnId: 'turn_1',
      role: 'assistant',
      text: 'Ik hoor je. Vertel me meer.',
      timestampIso: '2025-01-15T10:05:30.000Z',
    });

    const chatHistoryFallback = [
      { role: 'user', content: 'Vandaag was moeilijk', timestamp: '2025-01-15T10:05:00.000Z' },
      { role: 'assistant', content: 'Ik hoor je. Vertel me meer.', timestamp: '2025-01-15T10:05:30.000Z' },
    ];

    const result = await lifecycleManager.endSession(persona, apiBase, chatHistoryFallback);

    // GPT failed, so summarized should be false (buffer fallback used)
    expect(result.summarized).toBe(false);
    expect(result.sessionId).toBe(sessionId);

    // Verify logs.dat still has an entry (buffer fallback, NOT incremental_)
    const logsDat = await logsDatStore.load(persona);
    expect(logsDat.sessions.length).toBeGreaterThanOrEqual(1);

    const lastSession = logsDat.sessions[logsDat.sessions.length - 1];
    // Buffer fallback should still have a proper summaryId (not incremental_)
    expect(lastSession.summaryId).not.toMatch(/^incremental_/);
    // Should have narrative from buffer messages
    expect(lastSession.compressedNarrative.length).toBeGreaterThan(0);
  });

  it('concurrency lock prevents double-write when back-button and blur both fire simultaneously', async () => {
    // Start session
    const sessionId = 'test_session_double';
    await lifecycleManager.startSession(persona, sessionId, 'test_user', apiBase);
    const buffer = lifecycleManager.getStores().sessionBufferStore.getBuffer()!;
    lifecycleManager.getStores().sessionBufferStore.appendMessage(buffer, {
      turnId: 'turn_1',
      role: 'user',
      text: 'Test bericht',
      timestampIso: '2025-01-15T10:05:00.000Z',
    });

    const chatHistory = [
      { role: 'user', content: 'Test bericht', timestamp: '2025-01-15T10:05:00.000Z' },
    ];

    // Simulate both firing at the same time (race condition)
    // Both calls start before either completes, so both see the buffer
    const [result1, result2] = await Promise.all([
      lifecycleManager.endSession(persona, apiBase, chatHistory),
      lifecycleManager.endSession(persona, apiBase, chatHistory),
    ]);

    // At least one should succeed with the original sessionId
    const successResults = [result1, result2].filter(r => r.sessionId === sessionId);
    expect(successResults.length).toBeGreaterThanOrEqual(1);

    // The second call should either:
    // - Return already_closed (if buffer was cleared before it ran)
    // - Return with a recovered session (if buffer was null but chatHistory was used)
    // Either way: no crash, no data loss
    expect(result1.sessionId).toBeDefined();
    expect(result2.sessionId).toBeDefined();

    // Verify logs.dat has entries (at least one full summary for the original session)
    const logsDat = await logsDatStore.load(persona);
    const originalSessions = logsDat.sessions.filter(s => s.sessionId === sessionId);
    expect(originalSessions.length).toBe(1);
    // The original session should have a proper summary (not incremental_)
    expect(originalSessions[0].summaryId).not.toMatch(/^incremental_/);
  });
});
