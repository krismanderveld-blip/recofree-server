import type { AIProvider, AIResult, ChatContext, Backpack, UserDat, MoodSnapshot, TriggerPattern, LifePhaseSection, ModuleUsageRecord, SessionAnalysisRecord } from './types';
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import superjson from 'superjson';

/**
 * OpenAIProvider — Routes through backend tRPC to OpenAI GPT-4o.
 *
 * DUAL-STORE ARCHITECTURE:
 *   App sends BOTH stores in full → Backend builds system prompt → OpenAI GPT-4o → Backend → App
 *
 * TWO SEPARATE DATA SOURCES:
 *   backpack (identity anchor):
 *     - Life story sections (FULL text, NEVER truncated)
 *     - Intake context
 *     - User name, type, creation date
 *     - NEVER auto-modified, NEVER summarized
 *
 *   userDat (session memory):
 *     - Trigger patterns with frequency and history
 *     - Mood history across sessions
 *     - Module usage history
 *     - Session analysis records
 *     - Chat history
 *
 * CRITICAL RULE:
 *   The backpack is the anchor of identity.
 *   If it is reduced or summarized, the system loses consistency and reliability.
 *   This is NOT a token optimization problem. This is a core architectural requirement.
 */
export class OpenAIProvider implements AIProvider {
  async generateResponse(context: ChatContext): Promise<AIResult> {
    try {
      const apiBaseUrl = getApiBaseUrl();

      // SESSION-START ONLY: send backpack + userDat in full.
      // Follow-up messages do NOT re-send them — GPT already has them in the system prompt.
      const isSessionStart = context.isSessionStart;

      const backpackPayload = isSessionStart ? buildBackpackPayload(context.backpack) : null;
      const userDatPayload = isSessionStart ? buildUserDatPayload(context.userDat) : null;

      // Diary entries — sent at session start so Elias/Kim knows what the user wrote
      const diaryPayload = isSessionStart && context.diaryEntries.length > 0
        ? context.diaryEntries.map((e) => ({
            content: e.content,
            moodTag: e.moodTag,
            timestamp: e.timestamp,
          }))
        : null;

      // Build the input payload matching the server's chatInputSchema
      const inputPayload: Record<string, unknown> = {
        userType: context.userType,
        userName: context.userName,
        message: context.currentMessage,
        conversationHistory: context.conversationHistory.slice(-20).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        moodSliders: context.moodSliders as unknown as Record<string, number>,
        activeModules: context.activeModules,
        crisisLevel: context.crisisLevel,
        detectedEmotion: context.detectedEmotion,
        therapeuticStance: context.therapeuticStance,
        sessionDurationMinutes: context.sessionDurationMinutes,
        urgency: context.urgency,
        startEmotion: context.startEmotion,
        isSessionStart,
      };

      // Only include backpack + userDat + diary at session start
      if (backpackPayload) inputPayload.backpack = backpackPayload;
      if (userDatPayload) inputPayload.userDat = userDatPayload;
      if (diaryPayload) inputPayload.diaryEntries = diaryPayload;

      // tRPC mutation via HTTP with superjson serialization
      const serialized = superjson.serialize(inputPayload);

      const token = await Auth.getSessionToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = `${apiBaseUrl}/api/trpc/ai.chat`;

      console.log('[OpenAIProvider] Calling:', url, isSessionStart ? '(SESSION START — full payload)' : '(follow-up — lightweight)');
      if (backpackPayload) {
        console.log('[OpenAIProvider] Backpack sections:', backpackPayload.lifeStory.length);
      }
      if (userDatPayload) {
        console.log('[OpenAIProvider] UserDat triggers:', userDatPayload.triggerPatterns.length);
        console.log('[OpenAIProvider] UserDat sessions:', userDatPayload.totalSessions);
        console.log('[OpenAIProvider] UserDat session analyses:', userDatPayload.sessionAnalyses.length);
      }
      if (diaryPayload) {
        console.log('[OpenAIProvider] Diary entries:', diaryPayload.length);
      }

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
 * Build the BACKPACK payload — identity anchor.
 * Sent in FULL. NEVER truncated, summarized, or compressed.
 */
function buildBackpackPayload(backpack: Backpack) {
  const lifeStory = (backpack.sections || [])
    .filter((s: LifePhaseSection) => s.content && s.content.trim().length > 0)
    .map((s: LifePhaseSection) => ({
      id: s.id,
      label: s.label,
      ageRange: s.ageRange,
      content: s.content, // FULL content — NEVER truncated
    }));

  return {
    naam: backpack.naam,
    userType: backpack.userType,
    lifeStory,
    intakeContext: {
      startEmotion: backpack.intakeContext?.startEmotion || '',
      urgency: backpack.intakeContext?.urgency || 'midden',
      initialContext: backpack.intakeContext?.initialContext || '',
      intakeDate: backpack.intakeContext?.intakeDate || '',
    },
    createdAt: backpack.createdAt || '',
  };
}

/**
 * Build the USERDAT payload — dynamic session memory.
 * Sent in FULL. Contains all accumulated session data.
 */
function buildUserDatPayload(userDat: UserDat) {
  const triggerPatterns = (userDat.triggerPatterns || []).map((tp: TriggerPattern) => ({
    trigger: tp.trigger,
    count: tp.count,
    firstSeen: tp.firstSeen,
    lastSeen: tp.lastSeen,
  }));

  // Full mood history — no truncation
  const moodHistory = (userDat.moodHistory || []).map((ms: MoodSnapshot) => ({
    sliders: ms.sliders as unknown as Record<string, number>,
    timestamp: ms.timestamp,
  }));

  const moduleUsageSummary = [...new Set(
    (userDat.moduleUsage || []).map((mu: ModuleUsageRecord) => mu.moduleId)
  )];

  // Session analyses — the growing memory of past sessions
  const sessionAnalyses = (userDat.sessionAnalyses || []).map((sa: SessionAnalysisRecord) => ({
    sessionNumber: sa.sessionNumber,
    date: sa.date,
    messageCount: sa.messageCount,
    durationMinutes: sa.durationMinutes,
    dominantEmotion: sa.dominantEmotion,
    themes: sa.themes,
    newTriggers: sa.newTriggers,
    modulesUsed: sa.modulesUsed,
    moodDelta: sa.moodDelta,
    endRiskLevel: sa.endRiskLevel,
  }));

  return {
    totalSessions: userDat.totalSessions || 0,
    triggerPatterns,
    moodHistory,
    moduleUsageSummary,
    lastSessionDate: userDat.lastSessionDate || null,
    sessionAnalyses,
  };
}
