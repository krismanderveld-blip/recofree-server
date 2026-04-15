/**
 * Message Processing Pipeline — DUAL-STORE ARCHITECTURE
 *
 * MANDATORY FLOW (every message):
 * 1. LOAD state (Backpack + UserDat → composed Rugzak)
 * 2. ANALYZE state (StateAnalyzer — rule-based, NOT AI)
 * 3. SELECT modules (rule-based, NOT AI)
 * 4. ADJUST behavior (tone, pacing, intensity — rule-based)
 * 5. CRISIS layer (elevate monitoring, lower threshold if needed)
 * 6. AI GENERATION (AI receives instructions + BOTH stores in full, generates language ONLY)
 * 7. STATE UPDATE (mood adjustment, trigger weights, history log → only userDat changes)
 *
 * AI DOES NOT DECIDE MODULES OR STATE.
 * AI generates language only. System makes decisions.
 *
 * DUAL-STORE RULES:
 * - backpack.json → stable identity, NEVER modified by the pipeline
 * - user.dat → dynamic session memory, updated at step 7
 * - Both are sent in FULL to GPT at step 6 (no compression, no summarization)
 */

import type {
  Rugzak,
  Backpack,
  UserDat,
  ChatMessage,
  ChatContext,
  AIResult,
  AIProvider,
} from '../ai/types';
import { archiveSessionHistory, type ArchivedSession } from './chat-history-manager';
import { composeRugzak } from '../ai/types';
import {
  analyzeState,
  detectInputSignals,
  extractTriggersFromSignals,
  type StateAnalysis,
  type InputSignals,
} from './state-analyzer';
import { updateTriggerPatterns, recordModuleUsage } from './engine';

// ─── Pipeline Result ────────────────────────────────────────────

export interface PipelineResult {
  /** The AI-generated response text */
  response: string;
  /** The state analysis that drove this response */
  analysis: StateAnalysis;
  /** Updated Rugzak after processing (composed view) */
  updatedRugzak: Rugzak;
  /** Updated UserDat after processing (for persistence) */
  updatedUserDat: UserDat;
  /** Crisis level (0 = none, 1 = elevated, 2 = active crisis) */
  crisisLevel: number;
  /** Whether emergency card should be shown */
  showEmergency: boolean;
}

// ─── Pipeline ───────────────────────────────────────────────────

/**
 * Process a single user message through the complete mandatory pipeline.
 *
 * Accepts both stores separately. The backpack is NEVER modified.
 * Only userDat is updated at step 7.
 *
 * For backward compatibility, also accepts a composed Rugzak.
 */
export async function processMessage(
  rugzakOrBackpack: Rugzak | Backpack,
  userMessage: string,
  provider: AIProvider,
  userDat?: UserDat,
  options?: { isSessionStart?: boolean; diaryEntries?: import('../ai/types').DiaryEntry[] }
): Promise<PipelineResult> {
  // Resolve the two stores
  let backpack: Backpack;
  let currentUserDat: UserDat;
  let rugzak: Rugzak;

  if (userDat) {
    // New dual-store path
    backpack = rugzakOrBackpack as Backpack;
    currentUserDat = userDat;
    rugzak = composeRugzak(backpack, currentUserDat);
  } else {
    // Backward compatibility: single Rugzak passed
    rugzak = rugzakOrBackpack as Rugzak;
    backpack = {
      naam: rugzak.naam,
      userType: rugzak.userType,
      sections: rugzak.sections,
      intakeContext: { stageOfChange: 'contemplation' as const, ...rugzak.intakeContext },
      createdAt: rugzak.createdAt,
    };
    currentUserDat = {
      currentMood: rugzak.currentMood,
      moodHistory: rugzak.moodHistory,
      chatHistory: rugzak.chatHistory,
      moduleUsage: rugzak.moduleUsage,
      triggerPatterns: rugzak.triggerPatterns,
      totalSessions: rugzak.totalSessions,
      lastSessionDate: rugzak.lastSessionDate,
      sessionAnalyses: [],
      stageOfChange: 'contemplation' as const,
    };
  }

  // ── STEP 0: MODULE 12 PRE-ANALYSIS FAILSAFE ──
  // AI may NOT respond without sufficient input context.
  // Check: sliders filled + (backpack has content OR diary entries exist)
  const hasSliders = currentUserDat.currentMood &&
    Object.values(currentUserDat.currentMood).some((v) => v !== 0 && v !== 5);
  const hasBackpackContent = backpack.sections &&
    backpack.sections.some((s) => s.content && s.content.trim().length > 10);
  const hasDiary = (options?.diaryEntries ?? []).length > 0;
  const hasTriggerHistory = (currentUserDat.triggerPatterns ?? []).length > 0;
  const hasSessionHistory = (currentUserDat.totalSessions ?? 0) > 0;

  // Module 12: If no meaningful input exists, return a passive response
  const hasMinimalContext = hasSliders || hasBackpackContent || hasDiary || hasTriggerHistory || hasSessionHistory;
  if (!hasMinimalContext) {
    const passiveResponse = backpack.userType === 'elias'
      ? `Ik weet nu nog weinig van je, ${backpack.naam}. Ik wacht tot jij iets deelt. Dan pas kan ik iets dragen. Vul je sliders in, schrijf iets in je dagboek, of deel je verhaal in je rugzak — dan kan ik je beter helpen.`
      : `Hoi ${backpack.naam}. Ik heb nog niet genoeg context om je goed te kunnen helpen. Vul je sliders in of deel iets via je dagboek of rugzak, dan kan ik je gerichter ondersteunen.`;

    const passiveMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    const passiveAiMsg: ChatMessage = {
      id: `msg_${Date.now() + 1}`,
      role: 'assistant',
      content: passiveResponse,
      timestamp: new Date().toISOString(),
    };
    const updatedUserDat: UserDat = {
      ...currentUserDat,
      chatHistory: [...(currentUserDat.chatHistory || []), passiveMsg, passiveAiMsg],
    };
    const updatedRugzak = composeRugzak(backpack, updatedUserDat);
    return {
      response: passiveResponse,
      analysis: analyzeState(rugzak, userMessage),
      updatedRugzak,
      updatedUserDat,
      crisisLevel: 0,
      showEmergency: false,
    };
  }

  // ── STEP 1: LOAD STATE ──
  // Both stores are loaded. Rugzak is the composed view for engine compatibility.

  // ── STEP 2: ANALYZE STATE (NOT AI) ──
  const analysis = analyzeState(rugzak, userMessage);

  // ── STEP 3: SELECT MODULES (RULE-BASED, NOT AI) ──
  // Already done inside analyzeState → analysis.priorityModules

  // ── STEP 4: ADJUST BEHAVIOR (RULE-BASED) ──
  // Already done inside analyzeState → analysis.tone, analysis.pacing, analysis.suggestionIntensity

  // ── STEP 5: CRISIS LAYER ──
  let crisisLevel = 0;
  let showEmergency = false;

  if (analysis.riskLevel === 'critical') {
    crisisLevel = 2;
    showEmergency = true;
  } else if (analysis.riskLevel === 'high') {
    crisisLevel = 2;
    showEmergency = true;
  } else if (analysis.riskLevel === 'moderate') {
    crisisLevel = 1;
  }

  if (analysis.crisisThresholdLowered && crisisLevel === 0 && analysis.riskLevel !== 'low') {
    crisisLevel = 1;
  }

  // ── STEP 6: AI GENERATION ──
  // Send BOTH stores in full. No compression, no summarization.
  const sessionStart = currentUserDat.lastSessionDate ? new Date(currentUserDat.lastSessionDate) : new Date();
  const sessionMinutes = Math.floor((Date.now() - sessionStart.getTime()) / 60000);

  const context: ChatContext = {
    userType: backpack.userType,
    userName: backpack.naam,
    currentMessage: userMessage,
    conversationHistory: currentUserDat.chatHistory || [],
    moodSliders: currentUserDat.currentMood || { stemming: 5, craving: 0, overprikkeling: 0, sociaal: 5 },
    rugzak,
    backpack,
    userDat: currentUserDat,
    isSessionStart: options?.isSessionStart ?? false,
    diaryEntries: options?.diaryEntries ?? [],
    activeModules: [analysis.priorityModules[0] || (backpack.userType === 'elias' ? 'E02' : 'K01')], // Single dominant module (Engine Spec V2)
    crisisLevel,
    detectedEmotion: analysis.emotionalState,
    therapeuticStance: buildTherapeuticStance(analysis),
    sessionDurationMinutes: sessionMinutes,
    urgency: backpack.intakeContext?.urgency ?? 'midden',
    startEmotion: backpack.intakeContext?.startEmotion ?? '',
  };

  let response: string;
  try {
    const result: AIResult = await provider.generateResponse(context);
    response = result.response;
  } catch (error) {
    console.error('AI generation error:', error);
    response = "I'm still here with you. Something went wrong on my end — please try again.";
  }

  // ── STEP 7: STATE UPDATE (POST-RESPONSE) — ONLY userDat changes ──
  let updatedUserDat = { ...currentUserDat };

  // 7a. Add user message to history
  const userMsg: ChatMessage = {
    id: `msg_${Date.now()}`,
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  };
  updatedUserDat = {
    ...updatedUserDat,
    chatHistory: [...(updatedUserDat.chatHistory || []), userMsg],
  };

  // 7b. Add AI response to history
  const aiMsg: ChatMessage = {
    id: `msg_${Date.now() + 1}`,
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString(),
    modulesUsed: analysis.priorityModules,
  };
  updatedUserDat = {
    ...updatedUserDat,
    chatHistory: [...(updatedUserDat.chatHistory || []), aiMsg],
  };

  // 7c. Update trigger patterns (if signals detected)
  const signals = detectInputSignals(userMessage);
  const newTriggers = extractTriggersFromSignals(signals);
  if (newTriggers.length > 0) {
    updatedUserDat = {
      ...updatedUserDat,
      triggerPatterns: updateTriggerPatterns(updatedUserDat.triggerPatterns || [], newTriggers),
    };
  }

  // 7d. Record module usage (via composed rugzak, extract back)
  let tempRugzak = composeRugzak(backpack, updatedUserDat);
  for (const moduleId of analysis.priorityModules) {
    tempRugzak = recordModuleUsage(tempRugzak, moduleId, userMessage.slice(0, 50));
  }
  updatedUserDat = {
    ...updatedUserDat,
    moduleUsage: tempRugzak.moduleUsage,
  };

  // Compose the final rugzak view (backpack unchanged)
  const updatedRugzak = composeRugzak(backpack, updatedUserDat);

  return {
    response,
    analysis,
    updatedRugzak,
    updatedUserDat,
    crisisLevel,
    showEmergency,
  };
}

/**
 * Generate an initial greeting through the pipeline.
 * Uses the same flow but with an empty user message.
 */
export async function generateGreeting(
  rugzakOrBackpack: Rugzak | Backpack,
  provider: AIProvider,
  userDat?: UserDat,
  diaryEntries?: import('../ai/types').DiaryEntry[]
): Promise<PipelineResult> {
  // Resolve the two stores
  let backpack: Backpack;
  let currentUserDat: UserDat;
  let rugzak: Rugzak;

  if (userDat) {
    backpack = rugzakOrBackpack as Backpack;
    currentUserDat = userDat;
    rugzak = composeRugzak(backpack, currentUserDat);
  } else {
    rugzak = rugzakOrBackpack as Rugzak;
    backpack = {
      naam: rugzak.naam,
      userType: rugzak.userType,
      sections: rugzak.sections,
      intakeContext: { stageOfChange: 'contemplation' as const, ...rugzak.intakeContext },
      createdAt: rugzak.createdAt,
    };
    currentUserDat = {
      currentMood: rugzak.currentMood,
      moodHistory: rugzak.moodHistory,
      chatHistory: rugzak.chatHistory,
      moduleUsage: rugzak.moduleUsage,
      triggerPatterns: rugzak.triggerPatterns,
      totalSessions: rugzak.totalSessions,
      lastSessionDate: rugzak.lastSessionDate,
      sessionAnalyses: [],
      stageOfChange: 'contemplation' as const,
    };
  }

  // ── MODULE 12 PRE-ANALYSIS FAILSAFE (greeting) ──
  const hasSliders = currentUserDat.currentMood &&
    Object.values(currentUserDat.currentMood).some((v) => v !== 0 && v !== 5);
  const hasBackpackContent = backpack.sections &&
    backpack.sections.some((s) => s.content && s.content.trim().length > 10);
  const hasDiary = (diaryEntries ?? []).length > 0;
  const hasTriggerHistory = (currentUserDat.triggerPatterns ?? []).length > 0;
  const hasSessionHistory = (currentUserDat.totalSessions ?? 0) > 0;
  const hasMinimalContext = hasSliders || hasBackpackContent || hasDiary || hasTriggerHistory || hasSessionHistory;

  if (!hasMinimalContext) {
    const passiveResponse = backpack.userType === 'elias'
      ? `Hoi ${backpack.naam}. Ik ben er voor je, maar ik weet nu nog weinig van je. Vul je sliders in, schrijf iets in je dagboek, of deel je verhaal in je rugzak — dan kan ik je echt helpen.`
      : `Hoi ${backpack.naam}. Ik ben er. Maar om je goed te kunnen helpen, heb ik meer context nodig. Vul je sliders in of deel iets via je dagboek of rugzak.`;
    const passiveAiMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: passiveResponse,
      timestamp: new Date().toISOString(),
    };
    const updatedUserDat: UserDat = {
      ...currentUserDat,
      chatHistory: [...(currentUserDat.chatHistory || []), passiveAiMsg],
    };
    const updatedRugzak = composeRugzak(backpack, updatedUserDat);
    return {
      response: passiveResponse,
      analysis: analyzeState(rugzak, ''),
      updatedRugzak,
      updatedUserDat,
      crisisLevel: 0,
      showEmergency: false,
    };
  }

  const analysis = analyzeState(rugzak, '');

  const sessionStart = currentUserDat.lastSessionDate ? new Date(currentUserDat.lastSessionDate) : new Date();
  const sessionMinutes = Math.floor((Date.now() - sessionStart.getTime()) / 60000);

  const context: ChatContext = {
    userType: backpack.userType,
    userName: backpack.naam,
    currentMessage: '',
    conversationHistory: currentUserDat.chatHistory || [],
    moodSliders: currentUserDat.currentMood || { stemming: 5, craving: 0, overprikkeling: 0, sociaal: 5 },
    rugzak,
    backpack,
    userDat: currentUserDat,
    isSessionStart: true,
    diaryEntries: diaryEntries ?? [],
    activeModules: [analysis.priorityModules[0] || (backpack.userType === 'elias' ? 'E02' : 'K01')], // Single dominant module (Engine Spec V2)
    crisisLevel: 0,
    detectedEmotion: analysis.emotionalState,
    therapeuticStance: buildTherapeuticStance(analysis),
    sessionDurationMinutes: sessionMinutes,
    urgency: backpack.intakeContext?.urgency ?? 'midden',
    startEmotion: backpack.intakeContext?.startEmotion ?? '',
  };

  let response: string;
  try {
    const result = await provider.generateResponse(context);
    response = result.response;
  } catch (error) {
    console.error('Greeting generation error:', error);
    const name = backpack.naam;
    response = backpack.userType === 'elias'
      ? `Hey ${name}, glad you're here. How are you feeling today?`
      : `Hello ${name}, good that you're taking some time for yourself.`;
  }

  // Add greeting to userDat history
  const aiMsg: ChatMessage = {
    id: `msg_${Date.now()}`,
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString(),
    modulesUsed: analysis.priorityModules,
  };

  const updatedUserDat: UserDat = {
    ...currentUserDat,
    chatHistory: [...(currentUserDat.chatHistory || []), aiMsg],
  };

  const updatedRugzak = composeRugzak(backpack, updatedUserDat);

  return {
    response,
    analysis,
    updatedRugzak,
    updatedUserDat,
    crisisLevel: 0,
    showEmergency: false,
  };
}

// ─── Session End Pipeline ──────────────────────────────────────

/**
 * Session-end analysis result.
 */
export interface SessionEndResult {
  /** Farewell message from Elias/Kim */
  farewell: string;
  /** Session summary (mood trends, themes, triggers detected) */
  sessionSummary: SessionSummary;
  /** Updated Rugzak after session-end analysis (composed view) */
  updatedRugzak: Rugzak;
  /** Updated UserDat after session-end analysis (for persistence) */
  updatedUserDat: UserDat;
}

export interface SessionSummary {
  messageCount: number;
  durationMinutes: number;
  dominantEmotion: string;
  themes: string[];
  newTriggers: string[];
  modulesUsed: string[];
  moodDelta: {
    distressChange: number;
    resilienceChange: number;
  };
  endRiskLevel: string;
}

/**
 * End a chat session.
 *
 * DUAL-STORE RULES:
 * - Backpack is NEVER modified
 * - Only UserDat is updated (triggers, mood snapshot, session count, analysis record)
 * - Both are sent in full to GPT for the farewell message
 */
export async function endSession(
  rugzakOrBackpack: Rugzak | Backpack,
  provider: AIProvider,
  userDat?: UserDat
): Promise<SessionEndResult> {
  // Resolve the two stores
  let backpack: Backpack;
  let currentUserDat: UserDat;
  let rugzak: Rugzak;

  if (userDat) {
    backpack = rugzakOrBackpack as Backpack;
    currentUserDat = userDat;
    rugzak = composeRugzak(backpack, currentUserDat);
  } else {
    rugzak = rugzakOrBackpack as Rugzak;
    backpack = {
      naam: rugzak.naam,
      userType: rugzak.userType,
      sections: rugzak.sections,
      intakeContext: { stageOfChange: 'contemplation' as const, ...rugzak.intakeContext },
      createdAt: rugzak.createdAt,
    };
    currentUserDat = {
      currentMood: rugzak.currentMood,
      moodHistory: rugzak.moodHistory,
      chatHistory: rugzak.chatHistory,
      moduleUsage: rugzak.moduleUsage,
      triggerPatterns: rugzak.triggerPatterns,
      totalSessions: rugzak.totalSessions,
      lastSessionDate: rugzak.lastSessionDate,
      sessionAnalyses: [],
      stageOfChange: 'contemplation' as const,
    };
  }

  // ── STEP 1: Analyze the full session ──
  const sessionMessages = currentUserDat.chatHistory || [];
  const sessionStart = currentUserDat.lastSessionDate ? new Date(currentUserDat.lastSessionDate) : new Date();
  const durationMinutes = Math.floor((Date.now() - sessionStart.getTime()) / 60000);

  const userMessages = sessionMessages.filter((m) => m.role === 'user');
  const allUserText = userMessages.map((m) => m.content).join(' ');
  const signals = detectInputSignals(allUserText);
  const themes = extractThemes(signals, allUserText);
  const newTriggers = extractTriggersFromSignals(signals);

  const modulesUsed = [...new Set(
    sessionMessages
      .filter((m) => m.modulesUsed && m.modulesUsed.length > 0)
      .flatMap((m) => m.modulesUsed!)
  )];

  const endAnalysis = analyzeState(rugzak, '');
  const dominantEmotion = endAnalysis.emotionalState;

  // Compute mood delta
  const moodHistory = currentUserDat.moodHistory || [];
  let distressChange = 0;
  let resilienceChange = 0;
  if (moodHistory.length >= 2) {
    const firstSliders = moodHistory[0].sliders;
    const lastSliders = moodHistory[moodHistory.length - 1].sliders;
    const userType = backpack.userType;
    const firstDistress = userType === 'elias'
      ? (((firstSliders as any).craving ?? 0) + ((firstSliders as any).frustration ?? 0) + ((firstSliders as any).despondency ?? 0)) / 3
      : (((firstSliders as any).stress ?? 0) + ((firstSliders as any).boundaryFatigue ?? 0) + ((firstSliders as any).emotionalBurden ?? 0)) / 3;
    const lastDistress = userType === 'elias'
      ? (((lastSliders as any).craving ?? 0) + ((lastSliders as any).frustration ?? 0) + ((lastSliders as any).despondency ?? 0)) / 3
      : (((lastSliders as any).stress ?? 0) + ((lastSliders as any).boundaryFatigue ?? 0) + ((lastSliders as any).emotionalBurden ?? 0)) / 3;
    distressChange = lastDistress - firstDistress;
    const firstResilience = userType === 'elias' ? ((firstSliders as any).focus ?? 5) : ((firstSliders as any).selfCare ?? 5);
    const lastResilience = userType === 'elias' ? ((lastSliders as any).focus ?? 5) : ((lastSliders as any).selfCare ?? 5);
    resilienceChange = lastResilience - firstResilience;
  }

  const sessionSummary: SessionSummary = {
    messageCount: sessionMessages.length,
    durationMinutes,
    dominantEmotion,
    themes,
    newTriggers,
    modulesUsed,
    moodDelta: { distressChange, resilienceChange },
    endRiskLevel: endAnalysis.riskLevel,
  };

  // ── STEP 2: Generate farewell through AI (send BOTH stores in full) ──
  const context: ChatContext = {
    userType: backpack.userType,
    userName: backpack.naam,
    currentMessage: '__SESSION_END__',
    conversationHistory: currentUserDat.chatHistory || [],
    moodSliders: currentUserDat.currentMood || { craving: 0, frustration: 0, despondency: 0, focus: 5 } as any,
    rugzak,
    backpack,
    userDat: currentUserDat,
    isSessionStart: false,
    diaryEntries: [],
    activeModules: [],
    crisisLevel: 0,
    detectedEmotion: dominantEmotion,
    therapeuticStance: `SESSION_CLOSING | tone:warm | Summarize session briefly. Acknowledge what user shared. Confirm session is saved. Encourage them gently.`,
    sessionDurationMinutes: durationMinutes,
    urgency: backpack.intakeContext?.urgency ?? 'midden',
    startEmotion: backpack.intakeContext?.startEmotion ?? '',
  };

  let farewell: string;
  try {
    const result = await provider.generateResponse(context);
    farewell = result.response;
  } catch (error) {
    console.error('Farewell generation error:', error);
    const name = backpack.naam;
    farewell = backpack.userType === 'elias'
      ? `${name}, I've saved everything from our conversation. You showed real courage today. Take care of yourself, and I'll be here whenever you need me.`
      : `${name}, I've saved everything from our conversation. What you're doing for your loved one matters. Take care of yourself too, and I'll be here when you're ready.`;
  }

  // ── STEP 3: Update UserDat ONLY (backpack is NEVER modified) ──
  const farewellMsg: ChatMessage = {
    id: `msg_${Date.now()}`,
    role: 'assistant',
    content: farewell,
    timestamp: new Date().toISOString(),
  };

  let updatedUserDat: UserDat = {
    ...currentUserDat,
    chatHistory: [...(currentUserDat.chatHistory || []), farewellMsg],
  };

  // Update trigger patterns
  if (newTriggers.length > 0) {
    updatedUserDat = {
      ...updatedUserDat,
      triggerPatterns: updateTriggerPatterns(updatedUserDat.triggerPatterns || [], newTriggers),
    };
  }

  // Record mood snapshot at session end
  if (updatedUserDat.currentMood) {
    const snapshot = {
      timestamp: new Date().toISOString(),
      sliders: { ...updatedUserDat.currentMood },
    };
    updatedUserDat = {
      ...updatedUserDat,
      moodHistory: [...(updatedUserDat.moodHistory || []), snapshot],
    };
  }

  // Add session analysis record to userDat
  const analysisRecord = {
    sessionNumber: currentUserDat.totalSessions,
    date: new Date().toISOString(),
    messageCount: sessionSummary.messageCount,
    durationMinutes: sessionSummary.durationMinutes,
    dominantEmotion: sessionSummary.dominantEmotion,
    themes: sessionSummary.themes,
    newTriggers: sessionSummary.newTriggers,
    modulesUsed: sessionSummary.modulesUsed,
    moodDelta: sessionSummary.moodDelta,
    endRiskLevel: sessionSummary.endRiskLevel,
  };
  updatedUserDat = {
    ...updatedUserDat,
    sessionAnalyses: [...(updatedUserDat.sessionAnalyses || []), analysisRecord],
  };

  // ── STEP 4: Archive old chat history to prevent unbounded growth ──
  const archived = archiveSessionHistory(
    updatedUserDat.chatHistory || [],
    (updatedUserDat as any).archivedSessions || [],
    currentUserDat.totalSessions,
  );
  updatedUserDat = {
    ...updatedUserDat,
    chatHistory: archived.activeMessages,
  };
  (updatedUserDat as any).archivedSessions = archived.archivedSessions;
  console.log(`[ChatHistoryManager] Active: ${archived.activeMessages.length} messages, Archived: ${archived.archivedSessions.length} sessions`);

  // Compose the final rugzak view (backpack unchanged)
  const updatedRugzak = composeRugzak(backpack, updatedUserDat);

  return {
    farewell,
    sessionSummary,
    updatedRugzak,
    updatedUserDat,
  };
}

/**
 * Extract conversation themes from input signals and text.
 */
function extractThemes(signals: InputSignals, text: string): string[] {
  const themes: string[] = [];
  if (signals.cravingMention) themes.push('craving');
  if (signals.isolationSignal) themes.push('isolation');
  if (signals.hopelessness) themes.push('hopelessness');
  if (signals.dissociation) themes.push('dissociation');
  if (signals.positiveSignal) themes.push('positive_progress');
  if (signals.passiveSuicidal || signals.activeSuicidal) themes.push('suicidal_ideation');
  if (signals.selfHarm) themes.push('self_harm');

  const lower = text.toLowerCase();
  if (/\b(family|parent|mother|father|sibling|brother|sister)\b/.test(lower)) themes.push('family');
  if (/\b(work|job|boss|colleague|career)\b/.test(lower)) themes.push('work');
  if (/\b(relationship|partner|spouse|boyfriend|girlfriend)\b/.test(lower)) themes.push('relationships');
  if (/\b(sleep|insomnia|nightmare|tired|exhausted)\b/.test(lower)) themes.push('sleep');
  if (/\b(anger|angry|rage|furious|frustrated)\b/.test(lower)) themes.push('anger');
  if (/\b(guilt|shame|ashamed|regret)\b/.test(lower)) themes.push('guilt_shame');

  return [...new Set(themes)];
}

// ─── Helper: Build therapeutic stance string for AI prompt ──────

function buildTherapeuticStance(analysis: StateAnalysis): string {
  const parts: string[] = [];

  switch (analysis.tone) {
    case 'crisis':
      parts.push('TONE: CRISIS. Be calm, present, and direct. Do not ask exploratory questions. Acknowledge pain immediately. Offer safety resources.');
      break;
    case 'grounding':
      parts.push('TONE: GROUNDING + DIRECTIVE. Be direct and structured. Name what you observe from the sliders. Do NOT ask open-ended questions like "what\'s on your mind?" — instead, reflect what the data shows and offer a concrete grounding technique or coping step. Keep it short and actionable.');
      break;
    case 'assertive':
      parts.push('TONE: ASSERTIVE. Be honest and gently confrontational. Point out patterns you notice. Push toward action, but with compassion.');
      break;
    case 'warm':
      parts.push('TONE: WARM. Be empathetic and open. Create space for the user to share. Use reflective listening.');
      break;
  }

  if (analysis.pacing === 'very_slow') {
    parts.push('PACING: VERY SLOW. Use 1-2 short sentences max. No lists. No multiple questions. One thought at a time.');
  } else if (analysis.pacing === 'slower') {
    parts.push('PACING: SLOWER. Use shorter sentences. Max 2-3 sentences. Allow space for reflection.');
  } else {
    parts.push('PACING: NORMAL. 2-4 sentences. Natural conversational flow.');
  }

  if (analysis.suggestionIntensity >= 8) {
    parts.push('QUESTIONS: MINIMAL (0-1). Be directive. State observations, offer techniques. Do not ask "how are you feeling" — the sliders already tell you.');
  } else if (analysis.suggestionIntensity >= 6) {
    parts.push('QUESTIONS: LIMITED (max 1). Combine observation with one focused question.');
  } else if (analysis.suggestionIntensity <= 3) {
    parts.push('QUESTIONS: OPEN. Listen more than suggest. Let the user lead.');
  }

  if (analysis.emotionalState === 'depleted' || analysis.emotionalState === 'crisis') {
    parts.push('REFLECTION: SHARP. Name the distress directly. "I can see your craving is very high and you\'re struggling." Do not sugarcoat.');
  } else if (analysis.emotionalState === 'vulnerable') {
    parts.push('REFLECTION: MODERATE. Acknowledge difficulty but also note any strengths visible in the data.');
  } else {
    parts.push('REFLECTION: LIGHT. Explore gently. The user seems relatively stable.');
  }

  if (analysis.crisisMonitoring) {
    parts.push('CRISIS MONITORING ACTIVE. Watch for passive signals. Do not ignore hopelessness or withdrawal cues. Lower threshold for suggesting professional help.');
  }

  parts.push(`[STATE: ${analysis.stateSummary}]`);

  return parts.join(' | ');
}
