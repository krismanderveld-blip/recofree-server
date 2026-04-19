import type { AIProvider, AIResult, ChatContext } from './types';
import { detectKimBoundaryTopic, detectKimEnablingPattern } from '../engine/kim/relational-signals';
import { KIM_MOCK_RESPONSES } from '../engine/kim/mock-responses';
import { isKimLowMood } from '../engine/kim/slider-interpretation';

/**
 * MockAIProvider - Hardcoded realistic responses for UI/flow testing.
 *
 * Returns contextually appropriate mock responses based on:
 * - User type (Elias or Kim route)
 * - Crisis level
 * - Mood slider values
 *
 * Advisory emotion signals are included to simulate what a real
 * LLM might return, but these are NOT authoritative.
 */
export class MockAIProvider implements AIProvider {
  private eliasResponses: Record<string, string[]> = {
    greeting: [
      "Hey, glad you're here. How are you feeling right now?",
      "Welcome back. I'm here, take your time.",
      "Good that you stopped by. What's on your mind?",
    ],
    lowMood: [
      "I notice things are heavy today. That's okay. Want to tell me what's going on?",
      "It sounds like you're having a tough day. Sometimes it helps to just sit with what you feel, without trying to change it.",
      "I hear you. It doesn't have to get better right away. Let's look at what's here right now.",
    ],
    highCraving: [
      "I see the craving is strong. That's not failure \u2014 it's a signal. Can you name where it's coming from?",
      "The urge is there. That's okay to feel. Let's look at what's underneath it.",
      "Craving feels like a wave. It rises, it peaks, but it also passes. What do you need right now?",
    ],
    crisis: [
      "I notice things are really hard right now. You're not alone in this. Want to tell me what's happening?",
      "What you're feeling is real and it's allowed to be there. I'm here. Let's look at what you need right now.",
    ],
    reflection: [
      "What you're saying touches on something important. Can you tell me more about that?",
      "I notice this is weighing on you. What would it mean if you could just feel this without having to do anything with it?",
      "That sounds like a pattern you recognize. When did you first notice this?",
    ],
    general: [
      "Thank you for sharing that. What makes you think about this right now?",
      "I'm listening. Feel free to continue.",
      "That sounds important. Would you like to go deeper into that?",
      "I hear what you're saying. How does that feel for you?",
    ],
  };

  private kimResponses: Record<string, string[]> = { ...KIM_MOCK_RESPONSES } as Record<string, string[]>;

  async generateResponse(context: ChatContext): Promise<AIResult> {
    // Simulate network delay (200-600ms)
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 400));

    const responses = context.userType === 'elias' ? this.eliasResponses : this.kimResponses;
    let category: string;
    let advisoryEmotion: string | undefined;

    // Crisis takes priority
    if (context.crisisLevel >= 2) {
      category = 'crisis';
      advisoryEmotion = 'distress';
    }
    // First message or empty history → greeting
    else if (context.conversationHistory.length === 0) {
      category = 'greeting';
      advisoryEmotion = 'neutral';
    }
    // Low mood slider — Elias: despondency >= 4, Kim: delegated to isKimLowMood (emotionalBurden >= 4)
    else if ((context.moodSliders as any).despondency >= 4 || (context.userType === 'kim' && isKimLowMood(context.moodSliders))) {
      category = 'lowMood';
      advisoryEmotion = 'sadness';
    }
    // High craving (Elias only)
    else if (context.userType === 'elias' && (context.moodSliders as any).craving >= 5) {
      category = 'highCraving';
      advisoryEmotion = 'craving';
    }
    // Boundary topics (Kim only) — delegated to Kim engine
    else if (context.userType === 'kim' && detectKimBoundaryTopic(context.currentMessage)) {
      category = 'boundary';
      advisoryEmotion = 'frustration';
    }
    // Enabling patterns (Kim only) — delegated to Kim engine
    else if (context.userType === 'kim' && detectKimEnablingPattern(context.currentMessage)) {
      category = 'enabling';
      advisoryEmotion = 'concern';
    }
    // Reflection triggers
    else if (this.detectReflectionTrigger(context.currentMessage) && context.userType === 'elias') {
      category = 'reflection';
      advisoryEmotion = 'contemplation';
    }
    // Default
    else {
      category = 'general';
      advisoryEmotion = 'neutral';
    }

    const pool = responses[category] || responses.general;
    const response = pool[Math.floor(Math.random() * pool.length)];

    return {
      response,
      advisoryEmotion,
      advisoryConfidence: 0.6 + Math.random() * 0.3,
    };
  }

  private detectReflectionTrigger(message: string): boolean {
    const keywords = ['why', 'pattern', 'always', 'keep doing', 'same thing', 'don\'t understand', 'don\'t get'];
    return keywords.some((kw) => message.toLowerCase().includes(kw));
  }
}
