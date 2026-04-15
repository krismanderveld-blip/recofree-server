import type { AIProvider, AIResult, ChatContext } from './types';
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import superjson from 'superjson';
import { analyzeBackpackRelevance } from '@/lib/rugzak/backpack-relevance-analyzer';
import { buildGPTPayload } from '@/lib/rugzak/gpt-payload-builder';
import { detectRelationalAnchor, extractRelationalAnchors } from '@/lib/rugzak/relational-anchor-detector';
import { analyzeRelationalPatterns } from '@/lib/rugzak/relational-pattern-analyzer';

/**
 * OpenAIProvider — Routes through backend tRPC to OpenAI.
 *
 * PATCH N: SESSION_INIT / LIVE_MESSAGE split.
 *
 *   SESSION_INIT (sent ONCE at session start, cached locally):
 *     coreWound, relationshipAnchor, relationalPattern, contextLine,
 *     userProfileSummary, recentDiarySummary, backpack, userDat, diaryEntries
 *
 *   LIVE_MESSAGE (sent per message, dynamic only):
 *     message, conversationHistory, moodSliders, selectedTriggers,
 *     dominantModule, stageOfChange, urgency, riskScore, crisisLevel
 *
 *   Static fields are NEVER resent per message.
 */

// ── Session Init Cache (local, per session) ──
// Stores the static payload from SESSION_INIT so we don't resend it.
let cachedSessionInit: Record<string, unknown> | null = null;

/** Clear the session init cache (call on session end or new session) */
export function clearSessionInitCache(): void {
  cachedSessionInit = null;
  console.log('[OpenAIProvider] Session init cache cleared');
}

/** Check if session init has been sent */
export function hasSessionInit(): boolean {
  return cachedSessionInit !== null;
}

export class OpenAIProvider implements AIProvider {
  async generateResponse(context: ChatContext): Promise<AIResult> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const isSessionStart = context.isSessionStart;

      // ── STEP 1: Local Analysis (runs EVERY call) ──
      const dominantModule = context.activeModules[0] || 'E02';

      const sliders = { ...context.moodSliders } as Record<string, number>;
      const sliderValues = Object.values(sliders);
      const avgDistress = sliderValues.length > 0
        ? sliderValues.reduce((a, b) => a + b, 0) / sliderValues.length
        : 0;
      const riskScore = Math.min(10, context.crisisLevel * 3 + Math.round(avgDistress));

      // Backpack Relevance Analyzer (local, every call)
      const relevance = analyzeBackpackRelevance(
        context.currentMessage,
        context.backpack,
        context.userDat,
        context.moodSliders,
        dominantModule,
      );

      // Relational Anchor Detection (local, every call)
      const allAnchors = extractRelationalAnchors(context.backpack);
      const anchorResult = detectRelationalAnchor(
        context.currentMessage,
        context.backpack,
      );
      if (anchorResult.selectedAnchor) {
        relevance.relationshipAnchor = {
          name: anchorResult.selectedAnchor.name,
          role: anchorResult.selectedAnchor.role,
          roleEN: anchorResult.selectedAnchor.roleEN,
          score: anchorResult.selectedScore,
        };
      }

      // Relational Pattern Analysis (local, every call)
      const relationalPattern = analyzeRelationalPatterns(
        context.currentMessage,
        context.backpack,
        context.userDat,
        allAnchors,
      );

      // ── STEP 2: Build GPT Payload (local structure) ──
      const gptPayload = buildGPTPayload({
        message: context.currentMessage,
        backpack: context.backpack,
        userDat: context.userDat,
        sliders: context.moodSliders,
        isSessionStart,
        dominantModule,
        riskScore,
        relevance,
        diaryEntries: context.diaryEntries,
        chatHistory: context.conversationHistory,
        detectedEmotion: context.detectedEmotion,
        therapeuticStance: context.therapeuticStance,
        sessionDurationMinutes: context.sessionDurationMinutes,
        urgency: context.urgency,
        startEmotion: context.startEmotion,
        crisisLevel: context.crisisLevel,
        relationalPattern,
        bufferSnapshot: context.bufferSnapshot,
        guidanceDepth: context.guidanceDepth ?? 'normal',
        regulationResult: context.regulationResult,
      });

      // ── STEP 3: Build server payload based on SESSION_INIT / LIVE_MESSAGE split ──
      let inputPayload: Record<string, unknown>;

      if (isSessionStart) {
        // ═══════════════════════════════════════════════════════
        // SESSION_INIT: Full payload, sent ONCE. Cached locally.
        // ═══════════════════════════════════════════════════════
        inputPayload = {
          // Identity
          userType: gptPayload.route,
          userName: gptPayload.userName,
          isSessionStart: true,

          // Live message data (also included at session start)
          message: gptPayload.message,
          conversationHistory: gptPayload.conversationWindow,
          moodSliders: gptPayload.sliders,
          activeModules: [gptPayload.dominantModule],
          crisisLevel: gptPayload.crisisLevel,
          detectedEmotion: gptPayload.detectedEmotion,
          therapeuticStance: gptPayload.therapeuticStance,
          sessionDurationMinutes: gptPayload.sessionDurationMinutes,
          urgency: gptPayload.urgency,
          startEmotion: gptPayload.startEmotion,
          dominantModule: gptPayload.dominantModule,
          riskScore: gptPayload.riskScore,
          stageOfChange: gptPayload.stageOfChange,

          // Static context (SESSION_INIT only — NOT resent per message)
          selectedTriggers: gptPayload.selectedTriggers,
          coreWound: gptPayload.coreWound,
          contextLine: gptPayload.contextLine,
          relationshipAnchor: gptPayload.relationshipAnchor,
          relationalPattern: gptPayload.relationalPattern,
          recentDiary: gptPayload.recentDiary,

          // Buffer snapshot (live session state from pipeline)
          bufferSnapshot: gptPayload.bufferSnapshot ?? null,

          // User-controlled guidance depth
          guidanceDepth: gptPayload.guidanceDepth ?? 'normal',

          // Regulation result (from regulation layer)
          regulationResult: gptPayload.regulationResult ?? null,

          // Full data (SESSION_INIT only)
          backpack: gptPayload.backpack,
          userDat: gptPayload.userDat,
          diaryEntries: gptPayload.diaryEntries,
        };

        // Cache the static fields locally so we don't resend them
        cachedSessionInit = {
          userType: gptPayload.route,
          userName: gptPayload.userName,
          coreWound: gptPayload.coreWound,
          contextLine: gptPayload.contextLine,
          relationshipAnchor: gptPayload.relationshipAnchor,
          relationalPattern: gptPayload.relationalPattern,
          recentDiary: gptPayload.recentDiary,
          stageOfChange: gptPayload.stageOfChange,
        };

        console.log('[OpenAIProvider] SESSION_INIT: Full payload sent + cached locally');

      } else {
        // ═══════════════════════════════════════════════════════
        // LIVE_MESSAGE: Dynamic data only. No static fields.
        // ═══════════════════════════════════════════════════════
        inputPayload = {
          // Identity (always needed for routing)
          userType: gptPayload.route,
          userName: gptPayload.userName,
          isSessionStart: false,

          // Dynamic live data (changes per message)
          message: gptPayload.message,
          conversationHistory: gptPayload.conversationWindow,
          moodSliders: gptPayload.sliders,
          activeModules: [gptPayload.dominantModule],
          crisisLevel: gptPayload.crisisLevel,
          detectedEmotion: gptPayload.detectedEmotion,
          therapeuticStance: gptPayload.therapeuticStance,
          sessionDurationMinutes: gptPayload.sessionDurationMinutes,
          urgency: gptPayload.urgency,
          startEmotion: gptPayload.startEmotion,
          dominantModule: gptPayload.dominantModule,
          riskScore: gptPayload.riskScore,
          stageOfChange: gptPayload.stageOfChange,

          // Live-selected triggers (re-analyzed per message from buffer)
          selectedTriggers: gptPayload.selectedTriggers,

          // Buffer snapshot (live session state from pipeline)
          bufferSnapshot: gptPayload.bufferSnapshot ?? null,

          // User-controlled guidance depth
          guidanceDepth: gptPayload.guidanceDepth ?? 'normal',

          // Regulation result (from regulation layer)
          regulationResult: gptPayload.regulationResult ?? null,

          // NO backpack, NO userDat, NO diaryEntries, NO coreWound,
          // NO contextLine, NO relationshipAnchor, NO relationalPattern
          // These were sent at SESSION_INIT and cached server-side.
        };

        console.log('[OpenAIProvider] LIVE_MESSAGE: Dynamic payload only (no static fields)');
      }

      // ── STEP 4: Send to server ──
      const serialized = superjson.serialize(inputPayload);
      const token = await Auth.getSessionToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = `${apiBaseUrl}/api/trpc/ai.chat`;

      // Logging
      console.log('[OpenAIProvider] Calling:', url, isSessionStart ? '(SESSION_INIT)' : '(LIVE_MESSAGE)');
      console.log('[OpenAIProvider] Dominant module:', gptPayload.dominantModule);
      console.log('[OpenAIProvider] Risk score:', gptPayload.riskScore);
      console.log('[OpenAIProvider] Selected triggers:', gptPayload.selectedTriggers.map(t => t.trigger).join(', ') || 'none');
      console.log('[OpenAIProvider] Conversation window:', gptPayload.conversationWindow.length, 'messages');
      if (gptPayload.bufferSnapshot) {
        console.log(`[OpenAIProvider] Buffer snapshot: zone=${gptPayload.bufferSnapshot.zoneColor}(${gptPayload.bufferSnapshot.zoneScore}), intent=${gptPayload.bufferSnapshot.liveIntent}, direction=${gptPayload.bufferSnapshot.responseDirection}`);
      }
      if (isSessionStart && gptPayload.backpack) {
        console.log('[OpenAIProvider] Full backpack included (SESSION_INIT)');
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

      // Log token usage
      if (result?.tokenUsage) {
        console.log(`[CostControl] Call tokens: ${result.tokenUsage.promptTokens} prompt + ${result.tokenUsage.completionTokens} completion = ${result.tokenUsage.totalTokens} total`);
      }

      return {
        response: result?.response ?? "Something went wrong. I'm still here \u2014 please try again.",
        advisoryEmotion: result?.advisoryEmotion,
        advisoryConfidence: result?.advisoryConfidence,
        tokenUsage: result?.tokenUsage,
      };
    } catch (error) {
      console.error('[OpenAIProvider] Error:', error);
      return {
        response: "Something went wrong with the connection. I'm still here \u2014 please try again.",
        advisoryEmotion: undefined,
        advisoryConfidence: undefined,
        tokenUsage: undefined,
      };
    }
  }
}
