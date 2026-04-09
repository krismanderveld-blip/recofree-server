import type { AIProvider, AIResult, ChatContext, Rugzak } from './types';
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import superjson from 'superjson';

/**
 * OpenAIProvider - Routes through backend tRPC to OpenAI GPT-4o.
 *
 * ARCHITECTURE:
 *   App → Backend (tRPC ai.chat) → OpenAI GPT-4o → Backend → App
 *
 * Uses the same URL + superjson transformer as the tRPC client to ensure
 * consistent serialization. Calls the tRPC mutation endpoint directly via
 * HTTP to avoid needing React context (this is used outside components).
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
 */
export class OpenAIProvider implements AIProvider {
  async generateResponse(context: ChatContext): Promise<AIResult> {
    try {
      const apiBaseUrl = getApiBaseUrl();

      // Build a rugzak summary (don't send the entire rugzak to save bandwidth)
      const rugzakSummary = buildRugzakSummary(context.rugzak);

      // Build the input payload
      const inputPayload = {
        userType: context.userType,
        userName: context.userName,
        message: context.currentMessage,
        conversationHistory: context.conversationHistory.slice(-20).map((m) => ({
          role: m.role as 'user' | 'assistant',
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
      };

      // Use superjson to serialize (matching the tRPC client's transformer)
      const serialized = superjson.serialize(inputPayload);

      // Get auth token for native platforms
      const token = await Auth.getSessionToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // tRPC batch mutation format: POST to /api/trpc/ai.chat
      // The body must be wrapped in the tRPC batch format
      const url = `${apiBaseUrl}/api/trpc/ai.chat`;

      console.log('[OpenAIProvider] Calling:', url);
      console.log('[OpenAIProvider] API base URL:', apiBaseUrl || '(empty)');

      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(serialized),
      });

      console.log('[OpenAIProvider] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OpenAIProvider] Backend error:', response.status, errorText);
        throw new Error(`Backend API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[OpenAIProvider] Raw response keys:', Object.keys(data));

      // tRPC response format: { result: { data: { json: ..., meta: ... } } }
      // With superjson, the actual data is in result.data.json and needs deserialization
      let result: any;
      if (data?.result?.data) {
        try {
          result = superjson.deserialize(data.result.data);
        } catch {
          // Fallback: try direct json access
          result = data.result.data.json ?? data.result.data;
        }
      } else {
        result = data;
      }

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
