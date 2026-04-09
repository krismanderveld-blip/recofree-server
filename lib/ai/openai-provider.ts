import type { AIProvider, AIResult, ChatContext, Rugzak, MoodSnapshot, TriggerPattern, LifePhaseSection, ModuleUsageRecord } from './types';
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import superjson from 'superjson';

/**
 * OpenAIProvider - Routes through backend tRPC to OpenAI GPT-4o.
 *
 * ARCHITECTURE:
 *   App → Backend (tRPC ai.chat) → OpenAI GPT-4o → Backend → App
 *
 * The FULL rugzak is sent to the backend so GPT-4o has complete access to:
 *   - Life story sections (childhood, adolescence, adulthood, family, themes)
 *   - All trigger patterns with frequency and history
 *   - Mood history across sessions
 *   - Module usage history
 *   - Intake context (start emotion, urgency, initial context)
 *
 * The rugzak IS the user's persistent memory. Without it, the AI cannot
 * know the user's personal history, relationships, or patterns.
 */
export class OpenAIProvider implements AIProvider {
  async generateResponse(context: ChatContext): Promise<AIResult> {
    try {
      const apiBaseUrl = getApiBaseUrl();

      // Build the FULL rugzak context — this is the user's personal memory
      const rugzakFull = buildFullRugzakPayload(context.rugzak);

      // Build the input payload matching the server's chatInputSchema
      const inputPayload = {
        userType: context.userType,
        userName: context.userName,
        message: context.currentMessage,
        conversationHistory: context.conversationHistory.slice(-20).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        moodSliders: context.moodSliders as unknown as Record<string, number>,
        rugzakFull,
        activeModules: context.activeModules,
        crisisLevel: context.crisisLevel,
        detectedEmotion: context.detectedEmotion,
        therapeuticStance: context.therapeuticStance,
        sessionDurationMinutes: context.sessionDurationMinutes,
        urgency: context.urgency,
        startEmotion: context.startEmotion,
      };

      // tRPC mutation via HTTP: POST to /api/trpc/ai.chat
      // The server uses superjson transformer, so we must wrap the input
      // in the superjson format that tRPC expects.
      const serialized = superjson.serialize(inputPayload);

      // Get auth token for native platforms
      const token = await Auth.getSessionToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // tRPC single mutation endpoint (not batch)
      const url = `${apiBaseUrl}/api/trpc/ai.chat`;

      console.log('[OpenAIProvider] Calling:', url);
      console.log('[OpenAIProvider] Life story sections:', rugzakFull.lifeStory.length);
      console.log('[OpenAIProvider] Trigger patterns:', rugzakFull.triggerPatterns.length);

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

      // tRPC response format: { result: { data: { json: ..., meta: ... } } }
      let result: any;
      if (data?.result?.data) {
        try {
          result = superjson.deserialize(data.result.data);
        } catch {
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
 * Build the FULL rugzak payload for the backend.
 *
 * The rugzak is the user's persistent personal memory.
 * We send EVERYTHING the AI needs to know the user:
 * - Life story sections (full text, not truncated)
 * - All trigger patterns with counts and dates
 * - Recent mood history (last 20 snapshots)
 * - Module usage summary
 * - Intake context
 */
function buildFullRugzakPayload(rugzak: Rugzak) {
  // Life story sections — send FULL content, not truncated
  const lifeStory = (rugzak.sections || [])
    .filter((s: LifePhaseSection) => s.content && s.content.trim().length > 0)
    .map((s: LifePhaseSection) => ({
      id: s.id,
      label: s.label,
      ageRange: s.ageRange,
      content: s.content, // FULL content, no truncation
    }));

  // Trigger patterns — send full details
  const triggerPatterns = (rugzak.triggerPatterns || []).map((tp: TriggerPattern) => ({
    trigger: tp.trigger,
    count: tp.count,
    firstSeen: tp.firstSeen,
    lastSeen: tp.lastSeen,
  }));

  // Mood history — last 20 snapshots for trajectory analysis
  const moodHistory = (rugzak.moodHistory || []).slice(-20).map((ms: MoodSnapshot) => ({
    sliders: ms.sliders as unknown as Record<string, number>,
    timestamp: ms.timestamp,
  }));

  // Module usage — unique module IDs used across sessions
  const moduleUsageSummary = [...new Set(
    (rugzak.moduleUsage || []).map((mu: ModuleUsageRecord) => mu.moduleId)
  )];

  return {
    totalSessions: rugzak.totalSessions || 0,
    lifeStory,
    triggerPatterns,
    moodHistory,
    moduleUsageSummary,
    intakeContext: {
      startEmotion: rugzak.intakeContext?.startEmotion || '',
      urgency: rugzak.intakeContext?.urgency || 'midden',
      initialContext: rugzak.intakeContext?.initialContext || '',
      intakeDate: rugzak.intakeContext?.intakeDate || '',
    },
    lastSessionDate: rugzak.lastSessionDate || null,
    createdAt: rugzak.createdAt || '',
  };
}
