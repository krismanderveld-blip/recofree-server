import type { AIProvider, AIResult, ChatContext } from './types';
import { detectKimBoundaryTopic, detectKimEnablingPattern } from '../engine/kim/relational-signals';
import { KIM_MOCK_RESPONSES } from '../engine/kim/mock-responses';
import { isKimLowMood } from '../engine/kim/slider-interpretation';
import { ELIAS_MOCK_RESPONSES } from '../engine/elias/module-catalog';
import { isEliasLowMood, isEliasHighCraving } from '../engine/elias/slider-interpretation';
import { detectEliasReflectionTrigger } from '../engine/elias/state-logic';

/**
 * MockAIProvider - Hardcoded realistic responses for UI/flow testing.
 *
 * Returns contextually appropriate mock responses based on:
 * - User type (Elias or Kim route)
 * - Crisis level
 * - Mood slider values
 *
 * All detection logic and thresholds are imported from the respective engines.
 * This file contains NO inline thresholds or decision logic.
 */
export class MockAIProvider implements AIProvider {
  private eliasResponses: Record<string, string[]> = { ...ELIAS_MOCK_RESPONSES };
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
    // Low mood — Elias: delegated to isEliasLowMood, Kim: delegated to isKimLowMood
    else if (
      (context.userType === 'elias' && isEliasLowMood(context.moodSliders)) ||
      (context.userType === 'kim' && isKimLowMood(context.moodSliders))
    ) {
      category = 'lowMood';
      advisoryEmotion = 'sadness';
    }
    // High craving (Elias only) — delegated to isEliasHighCraving
    else if (context.userType === 'elias' && isEliasHighCraving(context.moodSliders)) {
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
    // Reflection triggers (Elias only) — delegated to Elias engine
    else if (context.userType === 'elias' && detectEliasReflectionTrigger(context.currentMessage)) {
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
}
