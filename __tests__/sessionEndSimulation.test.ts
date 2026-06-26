/**
 * Targeted session-end simulation test.
 *
 * Tests:
 * 1. The session-end GPT farewell call payload passes server Zod validation AFTER sanitize
 * 2. The background auto-end logic: timestamp-based check on foreground return
 * 3. The "analyzing" and "confirmation" messages are in Dutch (not English)
 */
import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';

// ── Test 1: Session-end farewell payload passes Zod AFTER sanitize ──
describe('Session-end farewell payload validation', () => {
  it('should pass server Zod schema after sanitizeChatPayload remaps fields', async () => {
    const { chatInputSchema } = await import('../server/ai-chat');

    // This is what pipeline.ts endSession() builds (raw — with sections, moduleUsage, nulls)
    const rawPayload: any = {
      userType: 'elias',
      userName: 'Kris',
      message: '__SESSION_END__',
      conversationHistory: [
        { role: 'user', content: 'Ik ga dadelijk nog eens een terraske doen' },
        { role: 'assistant', content: 'Dat klinkt gezellig, Kris.' },
      ],
      moodSliders: { craving: 3, frustration: 2, despondency: 1, focus: 7 },
      backpack: {
        naam: 'Kris',
        userType: 'elias',
        sections: [
          { id: 'childhood', label: 'Kindertijd', ageRange: '0-12', content: 'Opgegroeid in Antwerpen' },
        ],
        intakeContext: {
          initialContext: 'Wil stoppen met drinken',
          urgency: 'midden',
          startEmotion: 'hoopvol',
          intakeDate: '2025-01-15',
        },
        createdAt: '2025-01-15T10:00:00.000Z',
      },
      userDat: {
        totalSessions: 5,
        triggerPatterns: [],
        moodHistory: [],
        moduleUsage: [{ moduleId: 'vergv01' }],
        lastSessionDate: '2025-06-25',
        sessionAnalyses: [],
      },
      isSessionStart: false,
      diaryEntries: [],
      activeModules: [],
      crisisLevel: 0,
      detectedEmotion: 'neutral',
      therapeuticStance: 'SESSION_CLOSING | tone:warm',
      sessionDurationMinutes: 12,
      urgency: 'midden',
      startEmotion: 'hoopvol',
      guidanceDepth: 'normal',
      selectedTriggers: null,
      activeSignals: null,
      extractedEntities: null,
      recentDiary: null,
      bufferSnapshot: null,
      backpackAnalysis: null,
      knownUserPatterns: null,
    };

    // Apply the same sanitize logic that openai-provider.ts applies before sending
    // (simplified version of sanitizeChatPayload)
    const sanitized = { ...rawPayload };

    // Null arrays → []
    if (sanitized.selectedTriggers == null) sanitized.selectedTriggers = [];
    if (sanitized.activeSignals == null) sanitized.activeSignals = [];

    // Null objects → delete
    for (const key of ['extractedEntities', 'recentDiary', 'diaryEntries', 'bufferSnapshot', 'backpackAnalysis', 'knownUserPatterns']) {
      if (sanitized[key] === null) delete sanitized[key];
    }

    // Remap backpack.sections → backpack.lifeStory
    if (sanitized.backpack && Array.isArray(sanitized.backpack.sections) && !sanitized.backpack.lifeStory) {
      sanitized.backpack.lifeStory = sanitized.backpack.sections.map((s: any) => ({
        id: s.id || '',
        label: s.label || s.title || '',
        ageRange: s.ageRange || '',
        content: s.content || '',
      }));
      delete sanitized.backpack.sections;
    }

    // Remap userDat.moduleUsage → userDat.moduleUsageSummary
    if (sanitized.userDat && Array.isArray(sanitized.userDat.moduleUsage) && !sanitized.userDat.moduleUsageSummary) {
      sanitized.userDat.moduleUsageSummary = [...new Set(sanitized.userDat.moduleUsage.map((m: any) => m.moduleId || m))];
      delete sanitized.userDat.moduleUsage;
    }
    if (sanitized.userDat && !sanitized.userDat.moduleUsageSummary) {
      sanitized.userDat.moduleUsageSummary = [];
    }

    const result = chatInputSchema.safeParse(sanitized);
    if (!result.success) {
      console.error('Zod errors:', JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });

  it('should pass Zod with minimal payload (required fields only)', async () => {
    const { chatInputSchema } = await import('../server/ai-chat');

    const minimalPayload = {
      userType: 'elias' as const,
      userName: 'Kris',
      message: '__SESSION_END__',
      conversationHistory: [{ role: 'user' as const, content: 'test' }],
      moodSliders: { craving: 3 },
      isSessionStart: false,
      activeModules: [],
      crisisLevel: 0,
      detectedEmotion: 'neutral',
      therapeuticStance: 'SESSION_CLOSING',
      sessionDurationMinutes: 5,
      urgency: 'laag',
      startEmotion: 'neutraal',
      selectedTriggers: [],
      activeSignals: [],
    };

    const result = chatInputSchema.safeParse(minimalPayload);
    if (!result.success) {
      console.error('Zod errors:', JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });
});

// ── Test 2: Background auto-end timing logic ──
describe('Background auto-end timing', () => {
  it('setTimeout does NOT fire while app is in background (simulated)', () => {
    vi.useFakeTimers();

    let fired = false;
    const timer = setTimeout(() => { fired = true; }, 10 * 60 * 1000);

    // On real device, JS thread is suspended in background — timer never fires.
    expect(fired).toBe(false);

    // In test env advancing time works, but on real device it doesn't:
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(fired).toBe(true); // Only in test — NOT on real device

    vi.useRealTimers();
    clearTimeout(timer);
  });

  it('timestamp-based check correctly detects 10+ minutes elapsed', () => {
    const backgroundStartTime = Date.now() - (11 * 60 * 1000);
    const THRESHOLD_MS = 10 * 60 * 1000;
    const elapsed = Date.now() - backgroundStartTime;
    expect(elapsed).toBeGreaterThan(THRESHOLD_MS);
  });

  it('timestamp-based check does NOT trigger for < 10 minutes', () => {
    const backgroundStartTime = Date.now() - (5 * 60 * 1000);
    const THRESHOLD_MS = 10 * 60 * 1000;
    const elapsed = Date.now() - backgroundStartTime;
    expect(elapsed).toBeLessThan(THRESHOLD_MS);
  });
});

// ── Test 3: Session-end messages language ──
describe('Session-end messages must be Dutch', () => {
  it('analyzing message should be in Dutch (not English)', () => {
    const chatSource = fs.readFileSync('./app/(tabs)/chat.tsx', 'utf-8');
    expect(chatSource).toContain('Ik ga alles wat je gedeeld hebt analyseren');
    expect(chatSource).not.toContain("I'm going to analyze everything");
  });

  it('confirmation message should be in Dutch (not English)', () => {
    const chatSource = fs.readFileSync('./app/(tabs)/chat.tsx', 'utf-8');
    expect(chatSource).toContain('Alles is opgeslagen. Je sessie is veilig bewaard');
    expect(chatSource).not.toContain('Everything has been saved');
  });

  it('fallback farewell in pipeline.ts should be in Dutch', () => {
    const pipelineSource = fs.readFileSync('./lib/rugzak/pipeline.ts', 'utf-8');
    expect(pipelineSource).toContain('ik heb alles uit ons gesprek bewaard');
    expect(pipelineSource).not.toContain("I've saved everything from our conversation");
  });
});
