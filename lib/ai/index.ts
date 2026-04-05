import type { AIProvider } from './types';
import { MockAIProvider } from './mock-provider';
import { OpenAIProvider } from './openai-provider';

export type { AIProvider, AIResult, ChatContext, ChatMessage, MoodSliders, Rugzak, UserType } from './types';

/**
 * AI Provider Factory
 *
 * Creates the appropriate AI provider based on configuration.
 * Default: MockAIProvider (for UI/flow testing)
 * Production: OpenAIProvider (routes through backend)
 *
 * Toggle via: USE_MOCK_AI environment variable or explicit parameter.
 */

const USE_MOCK = true; // Set to false when backend is ready

let providerInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    if (USE_MOCK) {
      providerInstance = new MockAIProvider();
    } else {
      // Replace with actual backend URL when ready
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://recofree-api.app';
      providerInstance = new OpenAIProvider(apiBaseUrl);
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
