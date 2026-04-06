import type { AIProvider, AIResult, ChatContext, Rugzak } from './types';
import { getApiBaseUrl } from '@/constants/oauth';

/**
 * OpenAIProvider - Routes through backend tRPC to OpenAI GPT-4o.
 *
 * ARCHITECTURE:
 *   App → Backend (tRPC ai.chat) → OpenAI GPT-4o → Backend → App
 *
 * The backend is responsible for:
 *   - Building the system prompt with Elias/Kim directives
 *   - Including full state context (rugzak summary, modules, emotional trajectory)
 *   - Calling OpenAI GPT-4o with the assembled messages
 *   - Returning the response to the app
 *
 * The app's Elias/Kim logic layer remains the source of truth for:
 *   - Module selection, crisis detection, state management
 *   - The server only generates language based on instructions
 *
 * Advisory emotion signals returned here are from the LLM and are
 * NOT authoritative. The backend's Elias/Kim logic layer is the
 * single source of truth for emotion detection and state.
 */
export class OpenAIProvider implements AIProvider {
  async generateResponse(context: ChatContext): Promise<AIResult> {
    try {
      const apiBaseUrl = getApiBaseUrl();

      // Build a rugzak summary (don't send the entire rugzak to save bandwidth)
      const rugzakSummary = buildRugzakSummary(context.rugzak);

      // Call the backend tRPC endpoint via direct HTTP (batch format)
      const response = await fetch(`${apiBaseUrl}/api/trpc/ai.chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          json: {
            userType: context.userType,
            userName: context.userName,
            message: context.currentMessage,
            conversationHistory: context.conversationHistory.slice(-20).map((m) => ({
              role: m.role,
              content: m.content,
            })),
            moodSliders: context.moodSliders as unknown as Record<string, number>,
            rugzakSummary,
            activeModules: context.activeModules,
            crisisLevel: context.crisisLevel,
            detectedEmotion: context.detectedEmotion,
            therapeuticStance: context.therapeuticStance,
            sessionDurationMinutes: context.sessionDurationMinutes,
            urgency: context.urgency,
            startEmotion: context.startEmotion,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OpenAIProvider] Backend error:', response.status, errorText);
        throw new Error(`Backend API error: ${response.status}`);
      }

      const data = await response.json();

      // tRPC mutation response format: { result: { data: { json: ... } } }
      const result = data?.result?.data?.json ?? data?.result?.data ?? data;

      if (result?.success === false) {
        console.warn('[OpenAIProvider] Backend returned failure:', result.response);
      }

      return {
        response: result?.response ?? "Something went wrong. I'm still here — please try again.",
        advisoryEmotion: result?.advisoryEmotion,
        advisoryConfidence: result?.advisoryConfidence,
      };
    } catch (error) {
      console.error('[OpenAIProvider] Error:', error);
      return {
        response: "Something went wrong with the connection. I'm still here — please try again.",
        advisoryEmotion: undefined,
        advisoryConfidence: undefined,
      };
    }
  }
}

/**
 * Build a compact summary of the Rugzak for the backend.
 * We don't send the entire Rugzak (which includes full chat history)
 * to avoid excessive payload size. The conversation history is sent separately.
 */
function buildRugzakSummary(rugzak: Rugzak): {
  totalSessions: number;
  triggerPatterns: string[];
  lifePhaseSummary: string;
  intakeContext: {
    startEmotion: string;
    urgency: string;
    initialContext: string;
  };
} {
  // Extract trigger pattern names
  const triggerPatterns = (rugzak.triggerPatterns || []).map((tp) => tp.trigger);

  // Build a brief life-phase summary from non-empty sections
  const lifePhaseParts = (rugzak.sections || [])
    .filter((s) => s.content && s.content.trim().length > 0)
    .map((s) => `${s.label}: ${s.content.slice(0, 200)}`)
    .join(' | ');
  const lifePhaseSummary = lifePhaseParts || '';

  return {
    totalSessions: rugzak.totalSessions || 0,
    triggerPatterns,
    lifePhaseSummary,
    intakeContext: {
      startEmotion: rugzak.intakeContext?.startEmotion || '',
      urgency: rugzak.intakeContext?.urgency || 'midden',
      initialContext: rugzak.intakeContext?.initialContext || '',
    },
  };
}
