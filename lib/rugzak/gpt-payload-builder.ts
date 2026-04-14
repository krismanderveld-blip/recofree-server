/**
 * GPT Payload Builder — LOCAL MODULE
 *
 * Purpose: Build a structured, minimal payload for EVERY GPT call.
 * This replaces the old pattern of "full backpack at session start, nothing at follow-up".
 *
 * EVERY call now gets:
 * - route (elias/kim)
 * - dominant module (1 only)
 * - risk score
 * - current sliders
 * - last 6-10 messages (conversation window)
 * - max 2 triggers (from Backpack Relevance Analyzer)
 * - max 1 core wound
 * - max 1 context line
 * - max 1 relationship anchor
 * - diary summary (last 3 entries, if any)
 *
 * AT SESSION START additionally:
 * - full backpack (life story, intake context)
 * - full userDat (trigger history, mood history, session analyses)
 *
 * Based on: Master Engine Spec V2, Section 18 + Patch 5
 */

import type { Backpack, UserDat, MoodSliders, ChatMessage, DiaryEntry } from '../ai/types';
import type { BackpackRelevanceResult } from './backpack-relevance-analyzer';

// ─── Output Types ──────────────────────────────────────────────

/**
 * The structured payload sent to the server for EVERY GPT call.
 * This is the single source of truth for what GPT receives.
 */
export interface GPTPayload {
  // ── Always present ──
  route: 'elias' | 'kim';
  userName: string;
  dominantModule: string;
  riskScore: number;
  sliders: Record<string, number>;
  conversationWindow: Array<{ role: 'user' | 'assistant'; content: string }>;
  message: string;
  isSessionStart: boolean;

  // ── From Backpack Relevance Analyzer (always present) ──
  selectedTriggers: Array<{ trigger: string; score: number }>;
  coreWound: string | null;
  contextLine: string | null;
  relationshipAnchor: { name: string; role: string } | null;

  // ── Diary (always present, may be empty) ──
  recentDiary: Array<{ content: string; moodTag: string; date: string }>;

  // ── Session metadata ──
  sessionDurationMinutes: number;
  detectedEmotion: string;
  therapeuticStance: string;
  urgency: string;
  startEmotion: string;
  crisisLevel: number;

  // ── Session start only (full context) ──
  backpack?: {
    naam: string;
    userType: 'elias' | 'kim';
    lifeStory: Array<{ id: string; label: string; ageRange: string; content: string }>;
    intakeContext: { startEmotion: string; urgency: string; initialContext: string; intakeDate: string };
    createdAt: string;
  };
  userDat?: {
    totalSessions: number;
    triggerPatterns: Array<{ trigger: string; count: number; firstSeen: string; lastSeen: string }>;
    moodHistory: Array<{ sliders: Record<string, number>; timestamp: string }>;
    moduleUsageSummary: string[];
    lastSessionDate: string | null;
    sessionAnalyses: Array<{
      sessionNumber: number;
      date: string;
      messageCount: number;
      durationMinutes: number;
      dominantEmotion: string;
      themes: string[];
      newTriggers: string[];
      modulesUsed: string[];
      moodDelta: { distressChange: number; resilienceChange: number };
      endRiskLevel: string;
    }>;
  };
  diaryEntries?: Array<{ content: string; moodTag: string; timestamp: string }>;
}

// ─── Builder ───────────────────────────────────────────────────

export interface PayloadBuilderInput {
  message: string;
  backpack: Backpack;
  userDat: UserDat;
  sliders: MoodSliders;
  isSessionStart: boolean;
  dominantModule: string;
  riskScore: number;
  relevance: BackpackRelevanceResult;
  diaryEntries: DiaryEntry[];
  chatHistory: ChatMessage[];
  detectedEmotion: string;
  therapeuticStance: string;
  sessionDurationMinutes: number;
  urgency: string;
  startEmotion: string;
  crisisLevel: number;
}

/**
 * Build the structured GPT payload.
 *
 * This is called BEFORE every GPT request.
 * It ensures every call has the right context — no more blind follow-ups.
 */
export function buildGPTPayload(input: PayloadBuilderInput): GPTPayload {
  const { backpack, userDat, relevance, isSessionStart } = input;

  // ── Conversation window: 6-10 messages ──
  // Use 10 for session start (more context), 6 for follow-ups (save tokens)
  const windowSize = isSessionStart ? 10 : 6;
  const recentHistory = input.chatHistory.slice(-windowSize);
  const conversationWindow = recentHistory.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // ── Diary: last 3 entries ──
  const recentDiary = (input.diaryEntries || [])
    .slice(-3)
    .map((entry) => ({
      content: entry.content,
      moodTag: entry.moodTag,
      date: new Date(entry.timestamp).toLocaleDateString(),
    }));

  // ── Build base payload (always present) ──
  const payload: GPTPayload = {
    route: backpack.userType,
    userName: backpack.naam,
    dominantModule: input.dominantModule,
    riskScore: input.riskScore,
    sliders: { ...input.sliders } as Record<string, number>,
    conversationWindow,
    message: input.message,
    isSessionStart,

    selectedTriggers: relevance.triggers,
    coreWound: relevance.coreWound,
    contextLine: relevance.contextLine,
    relationshipAnchor: relevance.relationshipAnchor
      ? { name: relevance.relationshipAnchor.name, role: relevance.relationshipAnchor.role }
      : null,

    recentDiary,

    sessionDurationMinutes: input.sessionDurationMinutes,
    detectedEmotion: input.detectedEmotion,
    therapeuticStance: input.therapeuticStance,
    urgency: input.urgency,
    startEmotion: input.startEmotion,
    crisisLevel: input.crisisLevel,
  };

  // ── Session start: add full backpack + userDat + diary ──
  if (isSessionStart) {
    payload.backpack = {
      naam: backpack.naam,
      userType: backpack.userType,
      lifeStory: (backpack.sections || []).map((s) => ({
        id: s.id,
        label: s.label,
        ageRange: s.ageRange,
        content: s.content,
      })),
      intakeContext: {
        startEmotion: backpack.intakeContext?.startEmotion || '',
        urgency: backpack.intakeContext?.urgency || 'midden',
        initialContext: backpack.intakeContext?.initialContext || '',
        intakeDate: backpack.intakeContext?.intakeDate || '',
      },
      createdAt: backpack.createdAt || '',
    };

    payload.userDat = {
      totalSessions: userDat.totalSessions || 0,
      triggerPatterns: (userDat.triggerPatterns || []).map((tp) => ({
        trigger: tp.trigger,
        count: tp.count,
        firstSeen: tp.firstSeen,
        lastSeen: tp.lastSeen,
      })),
      moodHistory: (userDat.moodHistory || []).slice(-5).map((mh) => ({
        sliders: { ...mh.sliders } as Record<string, number>,
        timestamp: mh.timestamp,
      })),
      moduleUsageSummary: [...new Set((userDat.moduleUsage || []).map((m) => m.moduleId))],
      lastSessionDate: userDat.lastSessionDate,
      sessionAnalyses: (userDat.sessionAnalyses || []).map((sa) => ({
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
      })),
    };

    if (input.diaryEntries && input.diaryEntries.length > 0) {
      payload.diaryEntries = input.diaryEntries.map((e) => ({
        content: e.content,
        moodTag: e.moodTag,
        timestamp: e.timestamp,
      }));
    }
  }

  return payload;
}
