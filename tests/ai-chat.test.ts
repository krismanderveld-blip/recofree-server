/**
 * Tests for server-side AI chat endpoint — DUAL-STORE ARCHITECTURE.
 *
 * Tests the system prompt builder, input validation, and OpenAI integration.
 *
 * TWO SEPARATE DATA SOURCES:
 *   backpack → stable identity (life story, intake, name, type)
 *   userDat  → dynamic session memory (triggers, mood, sessions, analyses)
 */
import { describe, it, expect } from 'vitest';
import { chatInputSchema, generateAIResponse } from '../server/ai-chat';

// ─── Test Input ───────────────────────────────────────────────────

const validInput = {
  userType: 'elias' as const,
  userName: 'TestUser',
  message: 'I feel anxious today',
  conversationHistory: [
    { role: 'assistant' as const, content: 'Hey TestUser, how are you feeling?' },
  ],
  moodSliders: { craving: 3, frustration: 4, despondency: 2, focus: 6 },
  backpack: {
    naam: 'TestUser',
    userType: 'elias' as const,
    lifeStory: [
      {
        id: 'childhood',
        label: 'Kindertijd',
        ageRange: '0-12 jaar',
        content: 'Grew up in a small town. Parents divorced when I was 8. Felt lonely at school.',
      },
      {
        id: 'adolescence',
        label: 'Puberteit',
        ageRange: '12-18 jaar',
        content: 'Started drinking at 15. Had a close friend named Marco who helped me through tough times.',
      },
    ],
    intakeContext: {
      startEmotion: 'anxious',
      urgency: 'midden',
      initialContext: 'Struggling with alcohol',
      intakeDate: '2025-01-01',
    },
    createdAt: '2025-01-01',
  },
  userDat: {
    totalSessions: 2,
    triggerPatterns: [
      { trigger: 'stress', count: 5, firstSeen: '2025-01-01', lastSeen: '2025-03-15' },
      { trigger: 'loneliness', count: 3, firstSeen: '2025-01-10', lastSeen: '2025-03-20' },
    ],
    moodHistory: [
      { sliders: { craving: 5, frustration: 6, despondency: 4, focus: 3 }, timestamp: '2025-03-18' },
      { sliders: { craving: 3, frustration: 4, despondency: 2, focus: 6 }, timestamp: '2025-03-20' },
    ],
    moduleUsageSummary: ['E05', 'E02'],
    lastSessionDate: '2025-03-20',
    sessionAnalyses: [
      {
        sessionNumber: 1,
        date: '2025-03-18',
        messageCount: 8,
        durationMinutes: 15,
        dominantEmotion: 'anxiety',
        themes: ['craving', 'isolation'],
        newTriggers: ['stress'],
        modulesUsed: ['E05'],
        moodDelta: { distressChange: -1.5, resilienceChange: 1.0 },
        endRiskLevel: 'moderate',
      },
    ],
  },
  activeModules: ['E05'],
  crisisLevel: 0,
  detectedEmotion: 'anxiety',
  therapeuticStance: 'tone:warm | Be gentle. Listen more than suggest.',
  sessionDurationMinutes: 5,
  urgency: 'midden',
  startEmotion: 'anxious',
  isSessionStart: true,
};

// ─── Schema Validation Tests ──────────────────────────────────────

describe('AI Chat Input Schema (Dual-Store)', () => {
  it('should validate a correct Elias input with backpack + userDat', () => {
    const result = chatInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should validate a correct Kim input', () => {
    const kimInput = {
      ...validInput,
      userType: 'kim',
      backpack: {
        ...validInput.backpack,
        userType: 'kim' as const,
      },
      moodSliders: { stress: 5, boundaryFatigue: 3, emotionalBurden: 4, selfCare: 6 },
      activeModules: ['K01'],
    };
    const result = chatInputSchema.safeParse(kimInput);
    expect(result.success).toBe(true);
  });

  it('should reject invalid userType', () => {
    const badInput = { ...validInput, userType: 'unknown' };
    const result = chatInputSchema.safeParse(badInput);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const badInput = { userType: 'elias', message: 'hello' };
    const result = chatInputSchema.safeParse(badInput);
    expect(result.success).toBe(false);
  });

  it('should accept empty conversation history', () => {
    const input = { ...validInput, conversationHistory: [] };
    const result = chatInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept session end message', () => {
    const input = { ...validInput, message: '__SESSION_END__' };
    const result = chatInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate backpack with empty life story', () => {
    const input = {
      ...validInput,
      backpack: {
        ...validInput.backpack,
        lifeStory: [],
      },
    };
    const result = chatInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate backpack with full life story (all 5 sections)', () => {
    const input = {
      ...validInput,
      backpack: {
        ...validInput.backpack,
        lifeStory: [
          { id: 'childhood', label: 'Kindertijd', ageRange: '0-12', content: 'Long story about childhood...' },
          { id: 'adolescence', label: 'Puberteit', ageRange: '12-18', content: 'Teenage years were hard...' },
          { id: 'adulthood', label: 'Volwassenheid', ageRange: '18+', content: 'Adult life and recovery...' },
          { id: 'family', label: 'Familie', ageRange: 'n.v.t.', content: 'Family dynamics and relationships...' },
          { id: 'themes', label: 'Rode draden', ageRange: 'n.v.t.', content: 'Recurring themes and patterns...' },
        ],
      },
    };
    const result = chatInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate userDat with empty session data', () => {
    const input = {
      ...validInput,
      userDat: {
        totalSessions: 0,
        triggerPatterns: [],
        moodHistory: [],
        moduleUsageSummary: [],
        lastSessionDate: null,
        sessionAnalyses: [],
      },
    };
    const result = chatInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should validate userDat with multiple session analyses', () => {
    const input = {
      ...validInput,
      userDat: {
        ...validInput.userDat,
        sessionAnalyses: [
          {
            sessionNumber: 1,
            date: '2025-03-18',
            messageCount: 8,
            durationMinutes: 15,
            dominantEmotion: 'anxiety',
            themes: ['craving'],
            newTriggers: ['stress'],
            modulesUsed: ['E05'],
            moodDelta: { distressChange: -1.5, resilienceChange: 1.0 },
            endRiskLevel: 'moderate',
          },
          {
            sessionNumber: 2,
            date: '2025-03-20',
            messageCount: 12,
            durationMinutes: 25,
            dominantEmotion: 'hopeful',
            themes: ['positive_progress', 'family'],
            newTriggers: [],
            modulesUsed: ['E02', 'E05'],
            moodDelta: { distressChange: -2.0, resilienceChange: 2.5 },
            endRiskLevel: 'low',
          },
        ],
      },
    };
    const result = chatInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept input without backpack (follow-up message)', () => {
    const { backpack, ...noBackpack } = validInput;
    const result = chatInputSchema.safeParse({ ...noBackpack, isSessionStart: false });
    expect(result.success).toBe(true);
  });

  it('should accept input without userDat (follow-up message)', () => {
    const { userDat, ...noUserDat } = validInput;
    const result = chatInputSchema.safeParse({ ...noUserDat, isSessionStart: false });
    expect(result.success).toBe(true);
  });

  it('should accept diary entries at session start', () => {
    const input = {
      ...validInput,
      diaryEntries: [
        { content: 'Felt grateful for a walk in the park today.', moodTag: 'Grateful', timestamp: '2025-03-19T10:00:00Z' },
        { content: 'Had a tough conversation with my brother.', moodTag: 'Sad', timestamp: '2025-03-20T14:30:00Z' },
      ],
    };
    const result = chatInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept input without diary entries', () => {
    const result = chatInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    // diaryEntries is optional, not present in validInput
  });

  it('should default isSessionStart to false when not provided', () => {
    const { isSessionStart, ...noFlag } = validInput;
    const result = chatInputSchema.safeParse(noFlag);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isSessionStart).toBe(false);
    }
  });
});

// ─── OpenAI Integration Test ──────────────────────────────────────

describe('AI Chat OpenAI Integration (Dual-Store)', () => {
  it('should generate a response from GPT-4o using backpack + userDat', async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('Skipping OpenAI integration test: OPENAI_API_KEY not set');
      return;
    }

    const result = await generateAIResponse(validInput);

    expect(result.response).toBeDefined();
    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(10);
    console.log('[Test] GPT-4o response:', result.response);
  }, 30000);

  it('should handle session end message with dual-store context', async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('Skipping OpenAI integration test: OPENAI_API_KEY not set');
      return;
    }

    const sessionEndInput = {
      ...validInput,
      message: '__SESSION_END__',
      conversationHistory: [
        { role: 'assistant' as const, content: 'Hey TestUser, how are you feeling?' },
        { role: 'user' as const, content: 'I feel anxious today' },
        { role: 'assistant' as const, content: 'I hear you. That anxiety is real and valid.' },
      ],
    };

    const result = await generateAIResponse(sessionEndInput);

    expect(result.response).toBeDefined();
    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(10);
    console.log('[Test] GPT-4o farewell:', result.response);
  }, 30000);
});
