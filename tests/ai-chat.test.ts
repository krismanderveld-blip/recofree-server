/**
 * Tests for server-side AI chat endpoint.
 *
 * Tests the system prompt builder, input validation, and OpenAI integration.
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
  rugzakSummary: {
    totalSessions: 2,
    triggerPatterns: ['stress', 'loneliness'],
    lifePhaseSummary: 'Childhood: Grew up in a small town.',
    intakeContext: {
      startEmotion: 'anxious',
      urgency: 'midden',
      initialContext: 'Struggling with alcohol',
    },
  },
  activeModules: ['E05'],
  crisisLevel: 0,
  detectedEmotion: 'anxiety',
  therapeuticStance: 'tone:warm | Be gentle. Listen more than suggest.',
  sessionDurationMinutes: 5,
  urgency: 'midden',
  startEmotion: 'anxious',
};

// ─── Schema Validation Tests ──────────────────────────────────────

describe('AI Chat Input Schema', () => {
  it('should validate a correct Elias input', () => {
    const result = chatInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should validate a correct Kim input', () => {
    const kimInput = {
      ...validInput,
      userType: 'kim',
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
});

// ─── OpenAI Integration Test ──────────────────────────────────────

describe('AI Chat OpenAI Integration', () => {
  it('should generate a response from GPT-4o', async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('Skipping OpenAI integration test: OPENAI_API_KEY not set');
      return;
    }

    const result = await generateAIResponse(validInput);

    expect(result.response).toBeDefined();
    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(10);
    // Should address the user by name or respond to their anxiety
    // (we can't predict exact content, but it should be non-empty)
    console.log('[Test] GPT-4o response:', result.response);
  }, 30000);

  it('should handle session end message', async () => {
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
