import type { AIProvider } from './types';
import { MockAIProvider } from './mock-provider';
import { OpenAIProvider } from './openai-provider';

export type { AIProvider, AIResult, ChatContext, ChatMessage, MoodSliders, Rugzak, UserType } from './types';

/**
 * AI Provider Factory
 *
 * Creates the appropriate AI provider based on configuration.
 * Default: OpenAIProvider (routes through backend to GPT-4o)
 * Fallback: MockAIProvider (for offline UI/flow testing)
 *
 * Toggle via: USE_MOCK_AI flag below.
 */

const USE_MOCK = false; // Set to true for offline testing without backend

let providerInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    if (USE_MOCK) {
      providerInstance = new MockAIProvider();
    } else {
      providerInstance = new OpenAIProvider();
    }
  }
  return providerInstance;
}

/**
 * Reset the provider instance (useful for testing or switching providers)
 */
export function resetAIProvider(): void {
  providerInstance = null;
}
