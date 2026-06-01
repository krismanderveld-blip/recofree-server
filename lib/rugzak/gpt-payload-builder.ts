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

import type { Backpack, UserDat, MoodSliders, ChatMessage, DiaryEntry, StageOfChange } from '../ai/types';
import type { BackpackRelevanceResult } from './backpack-relevance-analyzer';
import type { RelationalPatternResult } from './relational-pattern-analyzer';
import { ELIAS_DEFAULT_STAGE } from '../engine/elias/stage-of-change';
import { sanitizeSliders } from '../engine/shared/slider-sanitize';

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

  // ── Stage of Change (always present) ──
  stageOfChange: StageOfChange;

  // ── From Backpack Relevance Analyzer (always present) ──
  selectedTriggers: Array<{ trigger: string; score: number }>;
  coreWound: string | null;
  contextLine: string | null;
  relationshipAnchor: { name: string; role: string; roleEN?: string } | null;

  // ── From Relational Pattern Analyzer (always present) ──
  relationalPattern: { pattern: string; schema: string; confidence: number } | null;

  // ── Diary (always present, may be empty) ──
  recentDiary: Array<{ content: string; moodTag: string; date: string }>;

  // ── Session metadata ──
  sessionDurationMinutes: number;
  detectedEmotion: string;
  therapeuticStance: string;
  urgency: string;
  startEmotion: string;
  crisisLevel: number;

  // ── User-controlled guidance depth ──
  guidanceDepth?: 'light' | 'normal' | 'deep';

  // ── Regulation result (from regulation layer, per message) ──
  regulationResult?: {
    action: string;
    intervention: string | null;
    gptInstruction: string | null;
    zone: string;
    effectiveDepth: string;
    wasSoftened: boolean;
    wasSkipped: boolean;
  };

  // ── Routed engine directive (Elias OR Kim, from orchestration routing) ──
  engineDirective?: {
    engine: 'elias' | 'kim';
    zoneLevel: string;
    zoneLabel: string;
    impact: Record<string, string>;
  };

  // ── Intervention continuity (Elias only, zone-linked therapeutic memory) ──
  interventionContinuity?: string;

  // ── Projection layer (future-facing fears/hopes/goals) ──
  projectionContext?: string;
  projectionDeepening?: string;

  // ── STOA engine (Elias only, Stoic session injection) ──
  stoaContext?: string;

  // ── Schema/Mode engine (deterministic intervention context) ──
  schemaModeContext?: string;
  actContext?: string;
  cgtContext?: string;
  dgtContext?: string;
  mbtContext?: string;

  // ── Buffer snapshot (from pipeline, per message) ──
  bufferSnapshot?: {
    zoneScore: number;
    zoneColor: string;
    liveIntent: string;
    intensityTrajectory: string;
    currentEmotion: string;
    responseDirection: string;
    currentRelationshipAnchor: string;
    messageCount: number;
    dominantState: {
      dominantModule: string;
      dominantTrigger: string;
      dominantDirection: string;
      dominantTone: string;
      riskScore: number;
      selectionReason: string;
      sourceLayer: string;
    } | null;
  };

  // ── Session start only (full context) ──
  backpack?: {
    naam: string;
    userType: 'elias' | 'kim';
    lifeStory: Array<{ id: string; label: string; ageRange: string; content: string }>;
    intakeContext: { stageOfChange: string; startEmotion: string; urgency: string; initialContext: string; intakeDate: string };
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
  relationalPattern?: RelationalPatternResult;
  /** Buffer snapshot from pipeline (injected per message) */
  bufferSnapshot?: import('./short-term-memory-buffer').BufferSnapshot;
  /** User-controlled guidance depth */
  guidanceDepth?: 'light' | 'normal' | 'deep';
  /** Regulation result from regulation layer */
  regulationResult?: {
    action: string;
    intervention: string | null;
    gptInstruction: string | null;
    zone: string;
    effectiveDepth: string;
    wasSoftened: boolean;
    wasSkipped: boolean;
  };
  /** Routed engine directive from orchestration (Elias OR Kim) */
  engineDirective?: import('../engine/orchestration').EngineDirective;
  /** Intervention continuity context string (Elias only, from intervention-continuity layer) */
  interventionContinuity?: string;
  /** Projection layer context (future-facing fears/hopes/goals) */
  projectionContext?: string;
  /** Projection deepening directive (instruction for GPT to explore projections) */
  projectionDeepening?: string;
  /** STOA engine injection block (Elias only, Stoic session) */
  stoaContext?: string;
  /** Schema/Mode engine: compact intervention context from deterministic detection */
  schemaModeContext?: string;
  actContext?: string;
  cgtContext?: string;
  dgtContext?: string;
  mbtContext?: string;
}

// ─── Conversation History Optimisation (Patch N Step 5) ──────

/**
 * PATCH N STEP 5: ConversationHistory Optimisation
 *
 * Rules:
 * - Max 6 messages sent to GPT (save tokens)
 * - ALWAYS keep: last user message + last assistant message
 * - ALWAYS keep: 1 emotionally relevant message (highest intensity)
 * - Summarize oldest messages beyond the window into a single context line
 * - Session start gets 10 messages (more context needed)
 *
 * Selection priority:
 * 1. Last user + assistant pair (most recent exchange)
 * 2. 1 emotionally relevant message (highest intensity keywords)
 * 3. Fill remaining slots with most recent messages
 * 4. Oldest dropped messages → summarized into 1 context line
 */

const EMOTION_KEYWORDS = [
  // High intensity
  'suicide', 'kill', 'die', 'dead', 'hurt', 'cutting', 'overdose',
  'crisis', 'panic', 'terrified', 'hopeless', 'worthless',
  // Medium intensity
  'craving', 'relapse', 'drunk', 'high', 'using', 'withdrawal',
  'angry', 'rage', 'furious', 'desperate', 'breakdown',
  'crying', 'sobbing', 'screaming', 'shaking',
  // Emotional depth
  'abandoned', 'betrayed', 'abused', 'trauma', 'shame', 'guilt',
  'lonely', 'isolated', 'rejected', 'afraid', 'scared',
];

function computeEmotionalIntensity(content: string): number {
  const lower = content.toLowerCase();
  let score = 0;
  for (const keyword of EMOTION_KEYWORDS) {
    if (lower.includes(keyword)) score++;
  }
  // Exclamation marks and ALL CAPS boost intensity
  const exclamations = (content.match(/!/g) || []).length;
  score += Math.min(exclamations, 3);
  const capsWords = (content.match(/\b[A-Z]{3,}\b/g) || []).length;
  score += Math.min(capsWords, 2);
  return score;
}

function buildOptimisedConversationWindow(
  chatHistory: ChatMessage[],
  isSessionStart: boolean,
): Array<{ role: 'user' | 'assistant'; content: string; isSummary?: boolean }> {
  const maxMessages = isSessionStart ? 10 : 6;

  // If history fits within window, no optimisation needed
  if (chatHistory.length <= maxMessages) {
    return chatHistory.map((msg) => ({ role: msg.role, content: msg.content }));
  }

  // Step 1: Identify the last user + assistant pair (always kept)
  const lastMessages = chatHistory.slice(-2);
  const remainingPool = chatHistory.slice(0, -2);

  // Step 2: Find the most emotionally relevant message from the pool
  let bestEmotionalMsg: ChatMessage | null = null;
  let bestEmotionalScore = 0;
  let bestEmotionalIdx = -1;

  for (let i = 0; i < remainingPool.length; i++) {
    if (remainingPool[i].role !== 'user') continue;
    const score = computeEmotionalIntensity(remainingPool[i].content);
    if (score > bestEmotionalScore) {
      bestEmotionalScore = score;
      bestEmotionalMsg = remainingPool[i];
      bestEmotionalIdx = i;
    }
  }

  // Step 3: Fill remaining slots with most recent messages
  const reservedSlots = 2 + (bestEmotionalMsg ? 1 : 0); // last pair + emotional
  const fillSlots = maxMessages - reservedSlots;

  // Get the most recent messages from the pool (excluding the emotional one)
  const fillPool = remainingPool.filter((_, i) => i !== bestEmotionalIdx);
  const filledMessages = fillPool.slice(-fillSlots);

  // Step 4: Summarize dropped messages
  const keptIndices = new Set<number>();
  // Mark filled messages
  for (const fm of filledMessages) {
    const idx = remainingPool.indexOf(fm);
    if (idx >= 0) keptIndices.add(idx);
  }
  if (bestEmotionalIdx >= 0) keptIndices.add(bestEmotionalIdx);

  const droppedMessages = remainingPool.filter((_, i) => !keptIndices.has(i));

  const result: Array<{ role: 'user' | 'assistant'; content: string; isSummary?: boolean }> = [];

  // Add summary of dropped messages (if any)
  if (droppedMessages.length > 0) {
    const userDropped = droppedMessages.filter((m) => m.role === 'user');
    const themes: string[] = [];
    for (const msg of userDropped) {
      const lower = msg.content.toLowerCase();
      if (/crav|relapse|drink|using|substance/.test(lower)) themes.push('craving/substance');
      if (/sad|depress|hopeless|down|low/.test(lower)) themes.push('low mood');
      if (/angry|frustrat|rage|annoy/.test(lower)) themes.push('anger/frustration');
      if (/anxi|panic|worry|stress|nervous/.test(lower)) themes.push('anxiety/stress');
      if (/family|parent|mother|father|partner/.test(lower)) themes.push('relationships');
      if (/work|job|boss|career/.test(lower)) themes.push('work');
      if (/sleep|tired|exhaust|insomnia/.test(lower)) themes.push('sleep');
      if (/guilt|shame|regret/.test(lower)) themes.push('guilt/shame');
    }
    const uniqueThemes = [...new Set(themes)];
    const summaryText = uniqueThemes.length > 0
      ? `[Earlier in this conversation (${droppedMessages.length} messages summarized): User discussed ${uniqueThemes.join(', ')}.]`
      : `[Earlier in this conversation: ${droppedMessages.length} messages exchanged.]`;
    result.push({ role: 'assistant', content: summaryText, isSummary: true });
  }

  // Add filled messages (in chronological order)
  for (const msg of filledMessages) {
    result.push({ role: msg.role, content: msg.content });
  }

  // Add emotional message (if not already in filled)
  if (bestEmotionalMsg && !filledMessages.includes(bestEmotionalMsg)) {
    // Insert before the last pair but after filled messages
    result.push({ role: bestEmotionalMsg.role, content: bestEmotionalMsg.content });
  }

  // Add last pair
  for (const msg of lastMessages) {
    result.push({ role: msg.role, content: msg.content });
  }

  return result;
}

/**
 * Build the structured GPT payload.
 *
 * This is called BEFORE every GPT request.
 * It ensures every call has the right context — no more blind follow-ups.
 *
 * PATCH N STEP 5: Uses optimised conversation window (max 6, summary, emotional retention).
 */
export function buildGPTPayload(input: PayloadBuilderInput): GPTPayload {
  const { backpack, userDat, relevance, isSessionStart } = input;

  // ── Conversation window: optimised (Patch N Step 5) ──
  const conversationWindow = buildOptimisedConversationWindow(
    input.chatHistory,
    isSessionStart,
  );

  // ── Diary: last 3 entries ──
  const recentDiary = (input.diaryEntries || [])
    .slice(-3)
    .map((entry) => ({
      content: entry.content,
      moodTag: entry.moodTag,
      date: new Date(entry.timestamp).toLocaleDateString(),
    }));

  // ── Build base payload (always present) ──
  // Guard against NaN values that would fail server-side Zod validation
  const safeNumber = (val: unknown, fallback: number = 0): number => {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  };

  const payload: GPTPayload = {
    route: backpack.userType,
    userName: backpack.naam,
    dominantModule: input.dominantModule || 'E01',
    riskScore: safeNumber(input.riskScore, 0),
    sliders: (() => { const s = sanitizeSliders(input.sliders as unknown as Record<string, unknown>); delete s.vspScore; return s; })(),
    conversationWindow,
    message: input.message,
    isSessionStart,

    selectedTriggers: relevance.triggers,
    coreWound: relevance.coreWound,
    contextLine: relevance.contextLine,
    stageOfChange: userDat.stageOfChange || ELIAS_DEFAULT_STAGE,

    relationshipAnchor: relevance.relationshipAnchor
      ? { name: relevance.relationshipAnchor.name, role: relevance.relationshipAnchor.role, roleEN: relevance.relationshipAnchor.roleEN }
      : null,

    relationalPattern: input.relationalPattern?.detectedPattern
      ? { pattern: input.relationalPattern.detectedPattern, schema: input.relationalPattern.linkedSchema || '', confidence: input.relationalPattern.confidence }
      : null,

    recentDiary,

    sessionDurationMinutes: safeNumber(input.sessionDurationMinutes, 0),
    detectedEmotion: input.detectedEmotion ?? 'unknown',
    therapeuticStance: input.therapeuticStance ?? 'supportive',
    urgency: input.urgency ?? 'low',
    startEmotion: input.startEmotion ?? 'unknown',
    crisisLevel: safeNumber(input.crisisLevel, 0),
  };

  // ── Guidance depth (user-controlled) ──
  payload.guidanceDepth = input.guidanceDepth ?? 'normal';

  // ── Regulation result (from regulation layer) ──
  if (input.regulationResult) {
    payload.regulationResult = input.regulationResult;
  }

  // ── Engine directive (from orchestration routing) ──
  if (input.engineDirective) {
    payload.engineDirective = {
      engine: input.engineDirective.engine,
      zoneLevel: input.engineDirective.zoneLevel,
      zoneLabel: input.engineDirective.zoneLabel,
      impact: { ...input.engineDirective.impact } as Record<string, string>,
    };
  }

  // ── Intervention continuity (Elias only, zone-linked therapeutic memory) ──
  if (input.interventionContinuity) {
    payload.interventionContinuity = input.interventionContinuity;
  }

  // ── Projection layer (future-facing fears/hopes/goals) ──
  if (input.projectionContext) {
    payload.projectionContext = input.projectionContext;
  }
  if (input.projectionDeepening) {
    payload.projectionDeepening = input.projectionDeepening;
  }

  // ── STOA engine (Elias only, Stoic session injection) ──
  if (input.stoaContext) {
    payload.stoaContext = input.stoaContext;
  }

  // ── Schema/Mode engine context ──
  if (input.schemaModeContext) {
    payload.schemaModeContext = input.schemaModeContext;
  }
  if (input.actContext) {
    payload.actContext = input.actContext;
  }
  if (input.cgtContext) {
    payload.cgtContext = input.cgtContext;
  }
  if (input.dgtContext) {
    payload.dgtContext = input.dgtContext;
  }
  if (input.mbtContext) {
    payload.mbtContext = input.mbtContext;
  }

  // ── Buffer snapshot (from pipeline, per message) ──
  if (input.bufferSnapshot) {
    const snap = input.bufferSnapshot;
    payload.bufferSnapshot = {
      zoneScore: safeNumber(snap.zoneScore, 0),
      zoneColor: snap.zoneColor || 'GREEN',
      liveIntent: snap.liveIntent || 'unknown',
      intensityTrajectory: snap.intensityTrajectory || 'stable',
      currentEmotion: snap.currentEmotion || 'neutral',
      responseDirection: snap.responseDirection || 'supportive',
      currentRelationshipAnchor: snap.currentRelationshipAnchor || '',
      messageCount: safeNumber(snap.messageCount, 0),
      dominantState: snap.dominantState ? {
        ...snap.dominantState,
        riskScore: safeNumber(snap.dominantState.riskScore, 0),
      } : null,
    };
  }

  // ── Session start: add full backpack + userDat + diary ──
  if (isSessionStart) {
    payload.backpack = {
      naam: backpack.naam || '',
      userType: backpack.userType || 'elias',
      lifeStory: (backpack.sections || []).map((s) => ({
        id: s.id,
        label: s.label,
        ageRange: s.ageRange,
        content: s.content,
      })),
      intakeContext: {
        stageOfChange: backpack.intakeContext?.stageOfChange || ELIAS_DEFAULT_STAGE,
        startEmotion: backpack.intakeContext?.startEmotion || '',
        urgency: backpack.intakeContext?.urgency || 'midden',
        initialContext: backpack.intakeContext?.initialContext || '',
        intakeDate: backpack.intakeContext?.intakeDate || '',
      },
      createdAt: backpack.createdAt || new Date().toISOString(),
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
        sliders: (() => { const s = sanitizeSliders(mh.sliders as unknown as Record<string, unknown>); delete s.vspScore; return s; })(),
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
