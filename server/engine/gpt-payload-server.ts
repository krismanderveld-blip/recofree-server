/**
 * GPT Payload Builder — SERVER-SAFE VERSION
 *
 * This is a thin wrapper around the client-side buildGPTPayload logic,
 * with LocalDeviceTimeService replaced by deviceTimeContext from the request.
 *
 * Instead of duplicating the full 800-line payload builder, we:
 * 1. Import the pure functions that ARE safe (sanitizeSliders, ELIAS_DEFAULT_STAGE)
 * 2. Inline the conversation window optimization (pure logic)
 * 3. Replace LocalDeviceTimeService.now().epochMs with deviceTimeContext or Date.now()
 *
 * The server already has buildSystemPrompt + generateAIResponse in ai-chat.ts.
 * This module bridges: CanonicalEngineInput → ChatRequestInput (what ai-chat expects).
 */

import { ELIAS_DEFAULT_STAGE } from '../../lib/engine/elias/stage-of-change';
import { sanitizeSliders } from '../../lib/engine/shared/slider-sanitize';
import type { CanonicalEngineInput } from '../../lib/migration/engine-input.types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ServerGPTPayload {
  // Identity
  userType: 'elias' | 'kim';
  userName: string;
  isSessionStart: boolean;
  // Message
  message: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  moodSliders: Record<string, number>;
  // Module/risk
  activeModules: string[];
  dominantModule: string;
  riskScore: number;
  crisisLevel: number;
  isCrisis: boolean;
  // State
  detectedEmotion: string;
  therapeuticStance: string;
  sessionDurationMinutes: number;
  urgency: string;
  startEmotion: string;
  stageOfChange: string;
  // Triggers
  selectedTriggers: Array<{ trigger: string; score: number }>;
  // Guidance
  guidanceDepth: 'light' | 'normal' | 'deep';
  // VSP
  vspLevel: string | null;
  // Buffer
  bufferSnapshot: {
    zone: string;
    emotionalDirection: string;
    liveIntent: string;
    dominantState: string;
  } | null;
  // Regulation
  regulationResult: {
    action: string;
    intervention: string | null;
    gptInstruction: string | null;
    zone: string;
    effectiveDepth: string;
    wasSoftened: boolean;
    wasSkipped: boolean;
  } | null;
  // Engine directive
  engineDirective: {
    engine: 'elias' | 'kim';
    zoneLevel: string;
    zoneLabel: string;
    impact: Record<string, string>;
  } | null;
  // Loopblocker
  loopDetected: {
    active: true;
    theme: string;
    sessionCount: number;
    instruction: string;
  } | null;
  // Context strings (all optional)
  interventionContinuity: string | null;
  projectionContext: string | null;
  projectionDeepening: string | null;
  stoaContext: string | null;
  schemaModeContext: string | null;
  actContext: string | null;
  cgtContext: string | null;
  dgtContext: string | null;
  mbtContext: string | null;
  vspInsightContext: string | null;
  // Session start only
  backpack: unknown | null;
  userDat: unknown | null;
  diaryEntries: unknown | null;
  // Locale
  locale: string;
  // Clinical mode
  clinicalModeActive: boolean;
}

// ─── Conversation Window Optimization ────────────────────────────────────────

const EMOTION_KEYWORDS = [
  'suicide', 'kill', 'die', 'dead', 'hurt', 'cutting', 'overdose',
  'crisis', 'panic', 'terrified', 'hopeless', 'worthless',
  'craving', 'relapse', 'drunk', 'high', 'using', 'withdrawal',
  'angry', 'rage', 'furious', 'desperate', 'breakdown',
  'crying', 'sobbing', 'screaming', 'shaking',
  'abandoned', 'betrayed', 'abused', 'trauma', 'shame', 'guilt',
  'lonely', 'isolated', 'rejected', 'afraid', 'scared',
];

function computeEmotionalIntensity(content: string): number {
  const lower = content.toLowerCase();
  let score = 0;
  for (const keyword of EMOTION_KEYWORDS) {
    if (lower.includes(keyword)) score++;
  }
  const exclamations = (content.match(/!/g) || []).length;
  score += Math.min(exclamations, 3);
  const capsWords = (content.match(/\b[A-Z]{3,}\b/g) || []).length;
  score += Math.min(capsWords, 2);
  return score;
}

function buildOptimisedConversationWindow(
  chatHistory: Array<{ role: string; content: string }>,
  isSessionStart: boolean,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  // Optimised: last 10 messages + summary + crisis retention + token truncation
  const RECENT_WINDOW = 10;
  const MAX_MSG_TOKENS = 200; // ~800 chars per message max
  const maxMessages = isSessionStart ? 14 : RECENT_WINDOW;

  if (chatHistory.length <= maxMessages) {
    return chatHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: truncateMessage(msg.content, MAX_MSG_TOKENS),
    }));
  }

  const recentMessages = chatHistory.slice(-RECENT_WINDOW);
  const earlierMessages = chatHistory.slice(0, -RECENT_WINDOW);

  // Preserve crisis messages (emotional intensity >= 3)
  const crisisMessages: (typeof chatHistory)[0][] = [];
  const nonCrisisEarlier: (typeof chatHistory)[0][] = [];
  for (const msg of earlierMessages) {
    if (msg.role === 'user' && computeEmotionalIntensity(msg.content) >= 3) {
      crisisMessages.push(msg);
    } else {
      nonCrisisEarlier.push(msg);
    }
  }
  const retainedCrisis = crisisMessages.slice(-3);

  // Find most emotionally relevant non-crisis message
  let bestEmotionalMsg: (typeof chatHistory)[0] | null = null;
  let bestEmotionalScore = 0;
  for (const msg of nonCrisisEarlier) {
    if (msg.role !== 'user') continue;
    const score = computeEmotionalIntensity(msg.content);
    if (score > bestEmotionalScore) {
      bestEmotionalScore = score;
      bestEmotionalMsg = msg;
    }
  }

  const droppedMessages = bestEmotionalMsg
    ? nonCrisisEarlier.filter((m) => m !== bestEmotionalMsg)
    : nonCrisisEarlier;

  const result: Array<{ role: 'user' | 'assistant'; content: string }> = [];

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
    result.push({ role: 'assistant', content: summaryText });
  }

  // Add retained crisis messages
  for (const msg of retainedCrisis) {
    result.push({ role: msg.role as 'user' | 'assistant', content: truncateMessage(msg.content, MAX_MSG_TOKENS) });
  }

  if (bestEmotionalMsg && bestEmotionalScore > 0) {
    result.push({ role: bestEmotionalMsg.role as 'user' | 'assistant', content: truncateMessage(bestEmotionalMsg.content, MAX_MSG_TOKENS) });
  }

  for (const msg of recentMessages) {
    result.push({ role: msg.role as 'user' | 'assistant', content: truncateMessage(msg.content, MAX_MSG_TOKENS) });
  }

  return result;
}

function truncateMessage(content: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars - 3) + '...';
}

// ─── Main Builder ────────────────────────────────────────────────────────────

/**
 * Build a ChatRequestInput-compatible payload from CanonicalEngineInput + engine results.
 * This replaces the client-side buildGPTPayload + payload assembly in openai-provider.ts.
 */
export function buildServerGPTPayload(
  input: CanonicalEngineInput,
  engineResults: {
    dominantModule: string;
    riskScore: number;
    crisisLevel: number;
    isCrisis: boolean;
    detectedEmotion: string;
    therapeuticStance: string;
    urgency: string;
    bufferSnapshot?: {
      zoneScore: number;
      zoneColor: string;
      liveIntent: string;
      dominantState: string;
    } | null;
    regulationResult?: {
      action: string;
      intervention: string | null;
      gptInstruction: string | null;
      zone: string;
      effectiveDepth: string;
      wasSoftened: boolean;
      wasSkipped: boolean;
    } | null;
    engineDirective?: {
      engine: 'elias' | 'kim';
      zoneLevel: string;
      zoneLabel: string;
      impact: Record<string, string>;
    } | null;
    loopDetected?: {
      active: true;
      theme: string;
      sessionCount: number;
      instruction: string;
    } | null;
    vspInsightContext?: string | null;
    signalContextSummary?: string | null;
  },
): ServerGPTPayload {
  // Sanitize sliders
  const sliders = sanitizeSliders(input.moodSliders as unknown as Record<string, unknown>);
  delete (sliders as Record<string, unknown>).vspScore;

  // Build conversation window
  const conversationWindow = buildOptimisedConversationWindow(
    input.conversationHistory,
    input.isSessionStart,
  );

  // Determine session duration from deviceTimeContext
  const sessionStartMs = new Date(input.deviceTimeContext.sessionStartedAtDeviceIso).getTime();
  const nowMs = new Date(input.deviceTimeContext.deviceNowIso).getTime();
  const sessionDurationMinutes = Math.max(0, Math.floor((nowMs - sessionStartMs) / 60000));

  // Build selected triggers from userDatSummary
  const selectedTriggers = (input.userDatSummary?.triggerPatterns || [])
    .slice(0, 2)
    .map(tp => ({ trigger: tp.trigger, score: tp.frequency }));

  return {
    userType: input.userType,
    userName: input.userName,
    isSessionStart: input.isSessionStart,
    message: input.message,
    conversationHistory: conversationWindow,
    moodSliders: sliders,
    activeModules: [engineResults.dominantModule],
    dominantModule: engineResults.dominantModule,
    riskScore: engineResults.riskScore,
    crisisLevel: engineResults.crisisLevel,
    isCrisis: engineResults.isCrisis,
    detectedEmotion: engineResults.detectedEmotion,
    therapeuticStance: engineResults.therapeuticStance,
    sessionDurationMinutes,
    urgency: engineResults.urgency,
    startEmotion: engineResults.detectedEmotion, // first message emotion
    stageOfChange: input.userDatSummary?.stageOfChange || ELIAS_DEFAULT_STAGE,
    selectedTriggers,
    guidanceDepth: (input.guidanceDepth as 'light' | 'normal' | 'deep') || 'normal',
    vspLevel: input.vspSection?.level || null,
    bufferSnapshot: engineResults.bufferSnapshot ? {
      zone: engineResults.bufferSnapshot.zoneColor,
      emotionalDirection: 'stable',
      liveIntent: engineResults.bufferSnapshot.liveIntent,
      dominantState: engineResults.bufferSnapshot.dominantState,
    } : null,
    regulationResult: engineResults.regulationResult || null,
    engineDirective: engineResults.engineDirective || null,
    loopDetected: engineResults.loopDetected || null,
    interventionContinuity: null,
    projectionContext: null,
    projectionDeepening: null,
    stoaContext: null,
    schemaModeContext: null,
    actContext: null,
    cgtContext: null,
    dgtContext: null,
    mbtContext: null,
    vspInsightContext: engineResults.vspInsightContext || null,
    backpack: null, // Will be populated for session start in future phases
    userDat: null,
    diaryEntries: null,
    locale: input.locale,
    clinicalModeActive: input.clinicalModeActive,
  };
}
