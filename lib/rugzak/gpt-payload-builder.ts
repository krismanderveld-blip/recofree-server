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
 * - last 20 messages (recency-weighted conversation window)
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
import { LocalDeviceTimeService } from "@/lib/core/time";

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
  ko1Context?: string;
  k05Context?: string;
  k02Context?: string;
  k04Context?: string;
  k04s4Context?: string;
  k06Context?: string;
  k01Context?: string;
  k03Context?: string;
  sw01Context?: string;
  sto01Context?: string;
  kst01Context?: string;
  kdl01Context?: string;
  kbr01Context?: string;
  ksc01Context?: string;
  vergv01Context?: string;
  igh01Context?: string;
  agc01Context?: string;
  hwk01Context?: string;
  fale01Context?: string;
  verg01Context?: string;
  rouw01Context?: string;
  iden01Context?: string;
  zink01Context?: string;
  terv01Context?: string;
  mi02Context?: string;
  slaap01EliasContext?: string;
  slaap01KimContext?: string;
  bedr01Context?: string;
  vetr01Context?: string;
  gasl01Context?: string;
  cdp01Context?: string;
  rnw01Context?: string;
  par01Context?: string;
  fin01Context?: string;
  iso01Context?: string;
  /** PsychoEducation continuity context (WILSKRACHT01/AUTOPILOT01, Elias only) */
  psychoEducationContext?: string;
  /** Steunpilaren continuity context (PAAL01, Elias only) */
  steunpilarenContext?: string;
  /** Self-acceptance cluster continuity context (BLIK01/ONTK01/IKST01/COEX01, Elias only) */
  selfAcceptanceContext?: string;
  /** Kim pattern support continuity context (PAAL-K01/BEHE-K01/AANP-K01/CODEP-K01, Kim only) */
  kimPatternSupportContext?: string;

  // ── Loopblocker: cross-session repeating pattern directive ──
  loopDetected?: {
    active: true;
    theme: string;
    sessionCount: number;
    instruction: string;
  };

  // ── Language Recovery: diminishing negative intensity ──
  languageRecovery?: {
    detected: true;
    theme: string;
    delta: number;
    instruction: string;
  };

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
    kimBackpack?: {
      my_story: string;
      the_relationship: string;
      the_impact: string;
      my_boundaries: string;
      my_strength: string;
    };
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
  /** Structured entities extracted from backpack (persons, events, patterns, contexts). Sent instead of full backpack when backpack hasn't changed. */
  extractedEntities?: import('../backpack-extractor/types').ExtractedEntities;
  /** Whether backpack content changed since last extraction (triggers full backpack resend) */
  backpackChanged?: boolean;
  /** context.dat: distilled compact context that replaces full backpack/userDat/diary at SESSION_INIT */
  contextDat?: string;
  /** Deepening fragments: targeted raw-layer fragments for gaps detected by nano */
  deepeningBlock?: string;
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
  /** LOOPBLOCKER: cross-session repeating pattern directive for GPT */
  loopDetected?: {
    active: true;
    theme: string;
    sessionCount: number;
    instruction: string;
  };
  /** LANGUAGE_RECOVERY: diminishing negative intensity detected in user language */
  languageRecovery?: {
    detected: true;
    theme: string;
    delta: number;
    instruction: string;
  };
  /** STOA engine injection block (Elias only, Stoic session) */
  stoaContext?: string;
  /** Schema/Mode engine: compact intervention context from deterministic detection */
  schemaModeContext?: string;
  actContext?: string;
  cgtContext?: string;
  dgtContext?: string;
  mbtContext?: string;
  ko1Context?: string;
  k05Context?: string;
  k02Context?: string;
  k04Context?: string;
  k04s4Context?: string;
  k06Context?: string;
  k01Context?: string;
  k03Context?: string;
  sw01Context?: string;
  sto01Context?: string;
  kst01Context?: string;
  kdl01Context?: string;
  kbr01Context?: string;
  ksc01Context?: string;
  vergv01Context?: string;
  igh01Context?: string;
  agc01Context?: string;
  hwk01Context?: string;
  fale01Context?: string;
  verg01Context?: string;
  rouw01Context?: string;
  iden01Context?: string;
  zink01Context?: string;
  terv01Context?: string;
  mi02Context?: string;
  slaap01EliasContext?: string;
  slaap01KimContext?: string;
  bedr01Context?: string;
  vetr01Context?: string;
  gasl01Context?: string;
  cdp01Context?: string;
  rnw01Context?: string;
  par01Context?: string;
  fin01Context?: string;
  iso01Context?: string;
  /** PsychoEducation continuity context (WILSKRACHT01/AUTOPILOT01, Elias only) */
  psychoEducationContext?: string;
  /** Steunpilaren continuity context (PAAL01, Elias only) */
  steunpilarenContext?: string;
  /** Self-acceptance cluster continuity context (BLIK01/ONTK01/IKST01/COEX01, Elias only) */
  selfAcceptanceContext?: string;
  /** Kim pattern support continuity context (PAAL-K01/BEHE-K01/AANP-K01/CODEP-K01, Kim only) */
  kimPatternSupportContext?: string;
  /** Structured entities extracted from backpack (if available, sent instead of full backpack) */
  extractedEntities?: import('../backpack-extractor/types').ExtractedEntities;
  /** Whether backpack changed since last extraction (forces full backpack resend) */
  backpackChanged?: boolean;
  /** context.dat: serialized distilled context (replaces full layers at SESSION_INIT) */
  contextDatSerialized?: string;
  /** Deepening fragments: targeted raw-layer fragments for gaps detected by nano */
  deepeningBlock?: string;
}

// ─── Conversation History Optimisation (Patch N Step 5) ─────────────────────
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
  // ── Optimised window: last 10 messages in full + summary + crisis/emotional retention ──
  // Reduced from 20 to 10 recent messages to save ~1-2k tokens per turn.
  // Crisis messages are NEVER summarized — they're always preserved in full.
  const RECENT_WINDOW = 10;
  const MAX_MSG_TOKENS = 200; // ~800 chars per message max
  const maxMessages = isSessionStart ? 14 : RECENT_WINDOW;

  // If history fits within window, just truncate long messages
  if (chatHistory.length <= maxMessages) {
    return chatHistory.map((msg) => ({
      role: msg.role,
      content: truncateMessage(msg.content, MAX_MSG_TOKENS),
    }));
  }

  // ── Split: recent (last 10) vs. earlier ──
  const recentMessages = chatHistory.slice(-RECENT_WINDOW);
  const earlierMessages = chatHistory.slice(0, -RECENT_WINDOW);

  // ── Preserve ALL crisis messages from earlier pool (never summarize) ──
  const crisisMessages: ChatMessage[] = [];
  const nonCrisisEarlier: ChatMessage[] = [];
  for (const msg of earlierMessages) {
    if (msg.role === 'user' && computeEmotionalIntensity(msg.content) >= 3) {
      crisisMessages.push(msg);
    } else {
      nonCrisisEarlier.push(msg);
    }
  }
  // Cap crisis messages at 3 to prevent unbounded growth
  const retainedCrisis = crisisMessages.slice(-3);

  // ── Find most emotionally relevant non-crisis message ──
  let bestEmotionalMsg: ChatMessage | null = null;
  let bestEmotionalScore = 0;
  for (const msg of nonCrisisEarlier) {
    if (msg.role !== 'user') continue;
    const score = computeEmotionalIntensity(msg.content);
    if (score > bestEmotionalScore) {
      bestEmotionalScore = score;
      bestEmotionalMsg = msg;
    }
  }

  // ── Build thematic summary of dropped messages ──
  const droppedMessages = bestEmotionalMsg
    ? nonCrisisEarlier.filter((m) => m !== bestEmotionalMsg)
    : nonCrisisEarlier;

  const result: Array<{ role: 'user' | 'assistant'; content: string; isSummary?: boolean }> = [];

  if (droppedMessages.length > 0) {
    const userDropped = droppedMessages.filter((m) => m.role === 'user');
    const assistantDropped = droppedMessages.filter((m) => m.role === 'assistant');
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
    // Extract key assistant interventions (questions, techniques mentioned)
    const interventions: string[] = [];
    for (const msg of assistantDropped) {
      const lower = msg.content.toLowerCase();
      if (/schema|modus|mode/.test(lower)) interventions.push('schema/mode work');
      if (/oefening|exercise|technique/.test(lower)) interventions.push('technique offered');
      if (/veilig|safe|grounding/.test(lower)) interventions.push('grounding/safety');
      if (/vraag|question|what.*feel|hoe.*voel/.test(lower)) interventions.push('reflective questioning');
    }
    const uniqueThemes = [...new Set(themes)];
    const uniqueInterventions = [...new Set(interventions)].slice(0, 3);

    let summaryText = uniqueThemes.length > 0
      ? `[Earlier (${droppedMessages.length} msgs): User themes: ${uniqueThemes.join(', ')}.`
      : `[Earlier: ${droppedMessages.length} messages exchanged.`;
    if (uniqueInterventions.length > 0) {
      summaryText += ` Interventions: ${uniqueInterventions.join(', ')}.`;
    }
    summaryText += ' Prioritize recent messages for continuity.]';
    result.push({ role: 'assistant', content: summaryText, isSummary: true });
  }

  // Add retained crisis messages (always preserved, truncated to MAX_MSG_TOKENS)
  for (const msg of retainedCrisis) {
    result.push({ role: msg.role, content: truncateMessage(msg.content, MAX_MSG_TOKENS) });
  }

  // Add the most emotionally salient non-crisis message (if found)
  if (bestEmotionalMsg && bestEmotionalScore > 0) {
    result.push({ role: bestEmotionalMsg.role, content: truncateMessage(bestEmotionalMsg.content, MAX_MSG_TOKENS) });
  }

  // ── Add last 10 recent messages (truncated to MAX_MSG_TOKENS each) ──
  for (const msg of recentMessages) {
    result.push({ role: msg.role, content: truncateMessage(msg.content, MAX_MSG_TOKENS) });
  }

  return result;
}

/**
 * Truncate a message to approximately maxTokens (~4 chars per token).
 * Preserves the beginning and adds ellipsis if truncated.
 */
function truncateMessage(content: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars - 3) + '...';
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

  // ── Diary: last 3 entries (with time-aware labels) ──
  const nowMs = LocalDeviceTimeService.now().epochMs;
  const recentDiary = (input.diaryEntries || [])
    .slice(-3)
    .map((entry) => {
      const entryTs = new Date(entry.timestamp).getTime();
      const hoursAgo = Math.floor((nowMs - entryTs) / (1000 * 60 * 60));
      const timeLabel = hoursAgo < 1 ? 'net geschreven' : hoursAgo < 24 ? `${hoursAgo}u geleden (vandaag)` : hoursAgo < 48 ? 'gisteren' : `${Math.floor(hoursAgo / 24)} dagen geleden`;
      const dateStr = new Date(entry.timestamp).toLocaleDateString();
      return {
        content: entry.content,
        moodTag: entry.moodTag,
        date: `${dateStr} (⏰ ${timeLabel})`,
      };
    });

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

  // ── LOOPBLOCKER: Inject cross-session repeating pattern directive ──
  if (input.loopDetected) {
    payload.loopDetected = input.loopDetected;
  }

  // ── LANGUAGE_RECOVERY: Inject diminishing negative intensity directive ──
  if (input.languageRecovery) {
    payload.languageRecovery = input.languageRecovery;
  }

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
  if (input.ko1Context) {
    payload.ko1Context = input.ko1Context;
  }
  if (input.k05Context) {
    payload.k05Context = input.k05Context;
  }
  if (input.k02Context) {
    payload.k02Context = input.k02Context;
  }
  if (input.k04Context) {
    payload.k04Context = input.k04Context;
  }
  if (input.k04s4Context) {
    payload.k04s4Context = input.k04s4Context;
  }
  if (input.k06Context) {
    payload.k06Context = input.k06Context;
  }
  if (input.k01Context) {
    payload.k01Context = input.k01Context;
  }
  if (input.k03Context) {
    payload.k03Context = input.k03Context;
  }
  if (input.sw01Context) {
    payload.sw01Context = input.sw01Context;
  }
  if (input.sto01Context) {
    payload.sto01Context = input.sto01Context;
  }
  if (input.kst01Context) {
    payload.kst01Context = input.kst01Context;
  }
  if (input.kdl01Context) {
    payload.kdl01Context = input.kdl01Context;
  }
  if (input.kbr01Context) {
    payload.kbr01Context = input.kbr01Context;
  }
  if (input.ksc01Context) {
    payload.ksc01Context = input.ksc01Context;
  }
  if (input.vergv01Context) {
    payload.vergv01Context = input.vergv01Context;
  }
  if (input.igh01Context) {
    payload.igh01Context = input.igh01Context;
  }
  if (input.agc01Context) {
    payload.agc01Context = input.agc01Context;
  }
  if (input.hwk01Context) {
    payload.hwk01Context = input.hwk01Context;
  }
  if (input.fale01Context) {
    payload.fale01Context = input.fale01Context;
  }
  if (input.verg01Context) {
    payload.verg01Context = input.verg01Context;
  }
  if (input.rouw01Context) {
    payload.rouw01Context = input.rouw01Context;
  }
  if (input.iden01Context) {
    payload.iden01Context = input.iden01Context;
  }
  if (input.zink01Context) {
    payload.zink01Context = input.zink01Context;
  }
  if (input.terv01Context) {
    payload.terv01Context = input.terv01Context;
  }
  if (input.mi02Context) {
    payload.mi02Context = input.mi02Context;
  }
  if (input.slaap01EliasContext) {
    payload.slaap01EliasContext = input.slaap01EliasContext;
  }
  if (input.slaap01KimContext) {
    payload.slaap01KimContext = input.slaap01KimContext;
  }
  if (input.bedr01Context) {
    payload.bedr01Context = input.bedr01Context;
  }
  if (input.vetr01Context) {
    payload.vetr01Context = input.vetr01Context;
  }
  if (input.gasl01Context) {
    payload.gasl01Context = input.gasl01Context;
  }
  if (input.cdp01Context) {
    payload.cdp01Context = input.cdp01Context;
  }
  if (input.rnw01Context) {
    payload.rnw01Context = input.rnw01Context;
  }
  if (input.par01Context) {
    payload.par01Context = input.par01Context;
  }
  if (input.fin01Context) {
    payload.fin01Context = input.fin01Context;
  }
  if (input.iso01Context) {
    payload.iso01Context = input.iso01Context;
  }
  if (input.psychoEducationContext) {
    payload.psychoEducationContext = input.psychoEducationContext;
  }
  if (input.steunpilarenContext) {
    payload.steunpilarenContext = input.steunpilarenContext;
  }
  if (input.selfAcceptanceContext) {
    payload.selfAcceptanceContext = input.selfAcceptanceContext;
  }
  if (input.kimPatternSupportContext) {
    payload.kimPatternSupportContext = input.kimPatternSupportContext;
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

  // ── Session start: add backpack context + userDat + diary ──
  // SESSION_INIT payload: use context.dat (distilled) when available, otherwise full raw layers
  if (isSessionStart) {
    if (input.contextDatSerialized) {
      // ── context.dat mode: compact distilled context replaces full layers ──
      payload.contextDat = input.contextDatSerialized;
      if (input.deepeningBlock) {
        payload.deepeningBlock = input.deepeningBlock;
      }
      // Minimal identity (needed for persona routing)
      payload.backpack = {
        naam: backpack.naam || '',
        userType: backpack.userType || 'elias',
        lifeStory: [],
        intakeContext: {
          stageOfChange: backpack.intakeContext?.stageOfChange || ELIAS_DEFAULT_STAGE,
          startEmotion: backpack.intakeContext?.startEmotion || '',
          urgency: backpack.intakeContext?.urgency || 'midden',
          initialContext: '',
          intakeDate: backpack.intakeContext?.intakeDate || '',
        },
        createdAt: backpack.createdAt || LocalDeviceTimeService.now().utcIso,
      };
      payload.backpackChanged = false;
      payload.userDat = {
        totalSessions: userDat.totalSessions || 0,
        triggerPatterns: [],
        moodHistory: [],
        moduleUsageSummary: [...new Set((userDat.moduleUsage || []).map((m) => m.moduleId))],
        lastSessionDate: userDat.lastSessionDate,
        sessionAnalyses: [],
      };
    } else {
      // ── Full payload mode (fallback when context.dat distillation failed) ──
      payload.backpack = {
        naam: backpack.naam || '',
        userType: backpack.userType || 'elias',
        lifeStory: (backpack.sections || []).map((s) => ({
          id: s.id,
          label: s.label,
          ageRange: s.ageRange,
          content: s.content,
        })),
        ...(backpack.kimBackpack ? { kimBackpack: backpack.kimBackpack } : {}),
        intakeContext: {
          stageOfChange: backpack.intakeContext?.stageOfChange || ELIAS_DEFAULT_STAGE,
          startEmotion: backpack.intakeContext?.startEmotion || '',
          urgency: backpack.intakeContext?.urgency || 'midden',
          initialContext: backpack.intakeContext?.initialContext || '',
          intakeDate: backpack.intakeContext?.intakeDate || '',
        },
        createdAt: backpack.createdAt || LocalDeviceTimeService.now().utcIso,
      };
      payload.backpackChanged = true;
      if (input.extractedEntities && input.extractedEntities.persons.length > 0) {
        payload.extractedEntities = input.extractedEntities;
      }

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
  }

  return payload;
}
