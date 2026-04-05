import type { AIProvider, AIResult, ChatContext } from './types';

/**
 * OpenAIProvider - Routes through backend to OpenAI GPT-4o.
 *
 * ARCHITECTURE:
 *   App → Backend (Elias/Kim Logic Layer) → OpenAI GPT-4o → Backend → App
 *
 * The backend is responsible for:
 *   - Building the system prompt with Elias/Kim directives
 *   - Including full state context (rugzak, modules, emotional trajectory)
 *   - Applying constraints from the logic layer
 *   - Verifying the LLM response against therapeutic rules
 *   - Updating state after response generation
 *
 * Advisory emotion signals returned here are from the LLM and are
 * NOT authoritative. The backend's Elias/Kim logic layer is the
 * single source of truth for emotion detection and state.
 */
export class OpenAIProvider implements AIProvider {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async generateResponse(context: ChatContext): Promise<AIResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userType: context.userType,
          userName: context.userName,
          message: context.currentMessage,
          conversationHistory: context.conversationHistory.slice(-10),
          moodSliders: context.moodSliders,
          rugzak: context.rugzak,
          activeModules: context.activeModules,
          crisisLevel: context.crisisLevel,
          detectedEmotion: context.detectedEmotion,
          therapeuticStance: context.therapeuticStance,
          sessionDurationMinutes: context.sessionDurationMinutes,
          urgency: context.urgency,
          startEmotion: context.startEmotion,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        response: data.response,
        advisoryEmotion: data.advisoryEmotion,
        advisoryConfidence: data.advisoryConfidence,
      };
    } catch (error) {
      console.error('OpenAI Provider error:', error);
      return {
        response: "Something went wrong with the connection. I'm still here — please try again.",
        advisoryEmotion: undefined,
        advisoryConfidence: undefined,
      };
    }
  }
}
