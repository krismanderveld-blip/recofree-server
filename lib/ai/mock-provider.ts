import type { AIProvider, AIResult, ChatContext } from './types';

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
      "I see the craving is strong. That's not failure — it's a signal. Can you name where it's coming from?",
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

  private kimResponses: Record<string, string[]> = {
    greeting: [
      "Hello, glad you're here. How are you doing — not the other person, but you?",
      "Welcome. I'd like to know how you're really doing.",
      "Good that you're taking some time for yourself. What's on your mind?",
    ],
    lowMood: [
      "It sounds like you're carrying a lot. That's understandable, but it's important to look after yourself too.",
      "I notice it's heavy. As someone close to the situation, you sometimes forget that you matter too. How are you taking care of yourself?",
      "You don't have to be strong for everyone. What do you need right now?",
    ],
    boundary: [
      "Setting boundaries might feel like rejection, but it's actually self-protection. What could be a first step?",
      "You can't save someone who doesn't want to save themselves. That's not giving up — it's accepting reality.",
      "It's okay to say: 'I can't carry this anymore.' That's not weakness, that's honesty.",
    ],
    enabling: [
      "I notice you're taking over a lot. Do you know the difference between helping and enabling?",
      "Sometimes the best help you can give is to step back. How does that idea feel to you?",
    ],
    crisis: [
      "I hear that things are really difficult. You matter in this story too. Let's look at what you need right now.",
      "It's okay to ask for help for yourself. You don't have to do this alone.",
    ],
    general: [
      "Thank you for sharing that. How does this affect your daily life?",
      "That sounds challenging. What are you doing right now to take care of yourself?",
      "I hear you. Let's look at what you can influence in this situation.",
      "That's an honest answer. Would you like to talk more about it?",
    ],
  };

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
    // Low mood slider
    else if (context.moodSliders.stemming <= 3) {
      category = 'lowMood';
      advisoryEmotion = 'sadness';
    }
    // High craving (Elias only)
    else if (context.userType === 'elias' && context.moodSliders.craving >= 7) {
      category = 'highCraving';
      advisoryEmotion = 'craving';
    }
    // Boundary topics (Kim only)
    else if (context.userType === 'kim' && this.detectBoundaryTopic(context.currentMessage)) {
      category = 'boundary';
      advisoryEmotion = 'frustration';
    }
    // Enabling patterns (Kim only)
    else if (context.userType === 'kim' && this.detectEnablingPattern(context.currentMessage)) {
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

  private detectBoundaryTopic(message: string): boolean {
    const keywords = ['boundary', 'boundaries', 'too much', 'can\'t anymore', 'stop', 'enough', 'my space', 'limit'];
    return keywords.some((kw) => message.toLowerCase().includes(kw));
  }

  private detectEnablingPattern(message: string): boolean {
    const keywords = ['i do everything', 'i help', 'i save', 'i fix', 'for him', 'for her', 'take over', 'cover for'];
    return keywords.some((kw) => message.toLowerCase().includes(kw));
  }

  private detectReflectionTrigger(message: string): boolean {
    const keywords = ['why', 'pattern', 'always', 'keep doing', 'same thing', 'don\'t understand', 'don\'t get'];
    return keywords.some((kw) => message.toLowerCase().includes(kw));
  }
}
