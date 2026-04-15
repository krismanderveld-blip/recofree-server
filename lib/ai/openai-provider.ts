import type { AIProvider, AIResult, ChatContext, Backpack, UserDat, MoodSnapshot, TriggerPattern, LifePhaseSection, ModuleUsageRecord, SessionAnalysisRecord } from './types';
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import superjson from 'superjson';
import { analyzeBackpackRelevance } from '@/lib/rugzak/backpack-relevance-analyzer';
import { buildGPTPayload, type GPTPayload } from '@/lib/rugzak/gpt-payload-builder';
import { detectRelationalAnchor, extractRelationalAnchors } from '@/lib/rugzak/relational-anchor-detector';
import { analyzeRelationalPatterns } from '@/lib/rugzak/relational-pattern-analyzer';

/**
 * OpenAIProvider — Routes through backend tRPC to OpenAI GPT-4o.
 *
 * NEW ARCHITECTURE (Engine Spec V2):
 *   EVERY call gets a structured payload with relevant context.
 *   No more "full at session start, blind at follow-up".
 *
 *   Session start: full backpack + userDat + diary + relevance analysis
 *   Follow-up: relevance analysis + selected triggers/wound/context/anchor + sliders + 6 messages
 *
 *   GPT always knows who the user is and what's relevant right now.
 */
export class OpenAIProvider implements AIProvider {
  async generateResponse(context: ChatContext): Promise<AIResult> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const isSessionStart = context.isSessionStart;

      // ── STEP 1: Backpack Relevance Analysis (LOCAL, every call) ──
      // Select the single dominant module (first from priorityModules)
      const dominantModule = context.activeModules[0] || 'E02';

      // Compute risk score from crisis level + slider distress
      const sliders = { ...context.moodSliders } as Record<string, number>;
      const sliderValues = Object.values(sliders);
      const avgDistress = sliderValues.length > 0
        ? sliderValues.reduce((a, b) => a + b, 0) / sliderValues.length
        : 0;
      const riskScore = Math.min(10, context.crisisLevel * 3 + Math.round(avgDistress));

      // Run the Backpack Relevance Analyzer
      const relevance = analyzeBackpackRelevance(
        context.currentMessage,
        context.backpack,
        context.userDat,
        context.moodSliders,
        dominantModule,
      );

      // ── STEP 1b: Relational Anchor Detection (LOCAL, every call) ──
      const allAnchors = extractRelationalAnchors(context.backpack);
      const anchorResult = detectRelationalAnchor(
        context.currentMessage,
        context.backpack,
      );
      // Override relevance anchor with the dedicated detector's result (more accurate)
      if (anchorResult.selectedAnchor) {
        relevance.relationshipAnchor = {
          name: anchorResult.selectedAnchor.name,
          role: anchorResult.selectedAnchor.role,
          roleEN: anchorResult.selectedAnchor.roleEN,
          score: anchorResult.selectedScore,
        };
      }

      // ── STEP 1c: Relational Pattern Analysis (LOCAL, every call) ──
      const relationalPattern = analyzeRelationalPatterns(
        context.currentMessage,
        context.backpack,
        context.userDat,
        allAnchors,
      );

      // ── STEP 2: Build the structured GPT Payload ──
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
      });

      // ── STEP 3: Build the server input payload ──
      // The server receives the FULL structured payload.
      // It uses this to build the system prompt for GPT.
      const inputPayload: Record<string, unknown> = {
        userType: gptPayload.route,
        userName: gptPayload.userName,
        message: gptPayload.message,
        conversationHistory: gptPayload.conversationWindow,
        moodSliders: gptPayload.sliders,
        activeModules: [gptPayload.dominantModule], // Single dominant module
        crisisLevel: gptPayload.crisisLevel,
        detectedEmotion: gptPayload.detectedEmotion,
        therapeuticStance: gptPayload.therapeuticStance,
        sessionDurationMinutes: gptPayload.sessionDurationMinutes,
        urgency: gptPayload.urgency,
        startEmotion: gptPayload.startEmotion,
        isSessionStart,

        // NEW: Always send relevance context (every call)
        selectedTriggers: gptPayload.selectedTriggers,
        coreWound: gptPayload.coreWound,
        contextLine: gptPayload.contextLine,
        relationshipAnchor: gptPayload.relationshipAnchor,
        recentDiary: gptPayload.recentDiary,
        riskScore: gptPayload.riskScore,
        dominantModule: gptPayload.dominantModule,

        // Step 2: Stage of Change + Relational Pattern
        stageOfChange: gptPayload.stageOfChange,
        relationalPattern: gptPayload.relationalPattern,
      };

      // Session start: also include full backpack + userDat + diary
      if (gptPayload.backpack) inputPayload.backpack = gptPayload.backpack;
      if (gptPayload.userDat) inputPayload.userDat = gptPayload.userDat;
      if (gptPayload.diaryEntries) inputPayload.diaryEntries = gptPayload.diaryEntries;

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

      console.log('[OpenAIProvider] Calling:', url, isSessionStart ? '(SESSION START)' : '(FOLLOW-UP)');
      console.log('[OpenAIProvider] Dominant module:', gptPayload.dominantModule);
      console.log('[OpenAIProvider] Risk score:', gptPayload.riskScore);
      console.log('[OpenAIProvider] Selected triggers:', gptPayload.selectedTriggers.map(t => t.trigger).join(', ') || 'none');
      console.log('[OpenAIProvider] Core wound:', gptPayload.coreWound || 'none');
      console.log('[OpenAIProvider] Context line:', gptPayload.contextLine ? 'yes' : 'none');
      console.log('[OpenAIProvider] Relationship anchor:', gptPayload.relationshipAnchor?.name || 'none');
      console.log('[OpenAIProvider] Conversation window:', gptPayload.conversationWindow.length, 'messages');
      console.log('[OpenAIProvider] Recent diary:', gptPayload.recentDiary.length, 'entries');
      if (gptPayload.backpack) {
        console.log('[OpenAIProvider] Full backpack included (session start)');
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

      // Log token usage from server
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
