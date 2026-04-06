/**
 * Message Processing Pipeline
 *
 * MANDATORY FLOW (every message):
 * 1. LOAD state (Rugzak)
 * 2. ANALYZE state (StateAnalyzer — rule-based, NOT AI)
 * 3. SELECT modules (rule-based, NOT AI)
 * 4. ADJUST behavior (tone, pacing, intensity — rule-based)
 * 5. CRISIS layer (elevate monitoring, lower threshold if needed)
 * 6. AI GENERATION (AI receives instructions, generates language ONLY)
 * 7. STATE UPDATE (mood adjustment, trigger weights, history log)
 *
 * AI DOES NOT DECIDE MODULES OR STATE.
 * AI generates language only. System makes decisions.
 */

import type {
  Rugzak,
  ChatMessage,
  ChatContext,
  AIResult,
  AIProvider,
} from '../ai/types';
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
  /** Updated Rugzak after processing */
  updatedRugzak: Rugzak;
  /** Crisis level (0 = none, 1 = elevated, 2 = active crisis) */
  crisisLevel: number;
  /** Whether emergency card should be shown */
  showEmergency: boolean;
}

// ─── Pipeline ───────────────────────────────────────────────────

/**
 * Process a single user message through the complete mandatory pipeline.
 *
 * This function orchestrates the entire flow. No step can be skipped.
 * AI is called exactly once, at step 6, with full instructions from steps 1-5.
 */
export async function processMessage(
  rugzak: Rugzak,
  userMessage: string,
  provider: AIProvider
): Promise<PipelineResult> {
  // ── STEP 1: LOAD STATE ──
  // Rugzak is passed in — it was loaded from AsyncStorage before this call.
  // All state lives in the Rugzak: mood, craving, stimuli, social, history, triggers.

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

  // Lower threshold if pattern accumulation is high
  if (analysis.crisisThresholdLowered && crisisLevel === 0 && analysis.riskLevel !== 'low') {
    crisisLevel = 1;
  }

  // ── STEP 6: AI GENERATION ──
  // Build the context with ALL system decisions baked in.
  // AI receives instructions — it generates language ONLY.

  const sessionStart = rugzak.lastSessionDate ? new Date(rugzak.lastSessionDate) : new Date();
  const sessionMinutes = Math.floor((Date.now() - sessionStart.getTime()) / 60000);

  const context: ChatContext = {
    userType: rugzak.userType,
    userName: rugzak.naam,
    currentMessage: userMessage,
    conversationHistory: rugzak.chatHistory || [],
    moodSliders: rugzak.currentMood || { stemming: 5, craving: 0, overprikkeling: 0, sociaal: 5 },
    rugzak,
    activeModules: analysis.priorityModules,
    crisisLevel,
    detectedEmotion: analysis.emotionalState,
    therapeuticStance: buildTherapeuticStance(analysis),
    sessionDurationMinutes: sessionMinutes,
    urgency: rugzak.intakeContext?.urgency ?? 'midden',
    startEmotion: rugzak.intakeContext?.startEmotion ?? '',
  };

  let response: string;
  try {
    const result: AIResult = await provider.generateResponse(context);
    response = result.response;
    // Note: result.advisoryEmotion and result.advisoryConfidence are IGNORED.
    // The system (StateAnalyzer) already determined the emotional state.
  } catch (error) {
    console.error('AI generation error:', error);
    response = "I'm still here with you. Something went wrong on my end — please try again.";
  }

  // ── STEP 7: STATE UPDATE (POST-RESPONSE) ──
  let updatedRugzak = { ...rugzak };

  // 7a. Add user message to history
  const userMsg: ChatMessage = {
    id: `msg_${Date.now()}`,
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString(),
  };
  updatedRugzak = {
    ...updatedRugzak,
    chatHistory: [...(updatedRugzak.chatHistory || []), userMsg],
  };

  // 7b. Add AI response to history
  const aiMsg: ChatMessage = {
    id: `msg_${Date.now() + 1}`,
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString(),
    modulesUsed: analysis.priorityModules,
  };
  updatedRugzak = {
    ...updatedRugzak,
    chatHistory: [...(updatedRugzak.chatHistory || []), aiMsg],
  };

  // 7c. Update trigger patterns (if signals detected)
  const signals = detectInputSignals(userMessage);
  const newTriggers = extractTriggersFromSignals(signals);
  if (newTriggers.length > 0) {
    updatedRugzak = {
      ...updatedRugzak,
      triggerPatterns: updateTriggerPatterns(updatedRugzak.triggerPatterns || [], newTriggers),
    };
  }

  // 7d. Record module usage
  for (const moduleId of analysis.priorityModules) {
    updatedRugzak = recordModuleUsage(updatedRugzak, moduleId, userMessage.slice(0, 50));
  }

  return {
    response,
    analysis,
    updatedRugzak,
    crisisLevel,
    showEmergency,
  };
}

/**
 * Generate an initial greeting through the pipeline.
 * Uses the same flow but with an empty user message.
 */
export async function generateGreeting(
  rugzak: Rugzak,
  provider: AIProvider
): Promise<PipelineResult> {
  // For greeting, we analyze state with empty input
  const analysis = analyzeState(rugzak, '');

  const sessionStart = rugzak.lastSessionDate ? new Date(rugzak.lastSessionDate) : new Date();
  const sessionMinutes = Math.floor((Date.now() - sessionStart.getTime()) / 60000);

  const context: ChatContext = {
    userType: rugzak.userType,
    userName: rugzak.naam,
    currentMessage: '', // Empty for greeting
    conversationHistory: rugzak.chatHistory || [],
    moodSliders: rugzak.currentMood || { stemming: 5, craving: 0, overprikkeling: 0, sociaal: 5 },
    rugzak,
    activeModules: analysis.priorityModules,
    crisisLevel: 0,
    detectedEmotion: analysis.emotionalState,
    therapeuticStance: buildTherapeuticStance(analysis),
    sessionDurationMinutes: sessionMinutes,
    urgency: rugzak.intakeContext?.urgency ?? 'midden',
    startEmotion: rugzak.intakeContext?.startEmotion ?? '',
  };

  let response: string;
  try {
    const result = await provider.generateResponse(context);
    response = result.response;
  } catch (error) {
    console.error('Greeting generation error:', error);
    const name = rugzak.naam;
    response = rugzak.userType === 'elias'
      ? `Hey ${name}, glad you're here. How are you feeling today?`
      : `Hello ${name}, good that you're taking some time for yourself.`;
  }

  // Add greeting to history
  const aiMsg: ChatMessage = {
    id: `msg_${Date.now()}`,
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString(),
    modulesUsed: analysis.priorityModules,
  };

  const updatedRugzak: Rugzak = {
    ...rugzak,
    chatHistory: [...(rugzak.chatHistory || []), aiMsg],
  };

  return {
    response,
    analysis,
    updatedRugzak,
    crisisLevel: 0,
    showEmergency: false,
  };
}

// ─── Session End Pipeline ──────────────────────────────────────

/**
 * Session-end analysis result.
 * Contains the full analysis of the session for local storage.
 */
export interface SessionEndResult {
  /** Farewell message from Elias/Kim */
  farewell: string;
  /** Session summary (mood trends, themes, triggers detected) */
  sessionSummary: SessionSummary;
  /** Updated Rugzak after session-end analysis */
  updatedRugzak: Rugzak;
}

export interface SessionSummary {
  /** Number of messages exchanged */
  messageCount: number;
  /** Session duration in minutes */
  durationMinutes: number;
  /** Dominant emotional tone of the session */
  dominantEmotion: string;
  /** Themes detected in conversation */
  themes: string[];
  /** New triggers detected this session */
  newTriggers: string[];
  /** Modules activated during session */
  modulesUsed: string[];
  /** Mood change: start vs end */
  moodDelta: {
    distressChange: number; // positive = worse, negative = better
    resilienceChange: number; // positive = better, negative = worse
  };
  /** Risk level at session end */
  endRiskLevel: string;
}

/**
 * End a chat session.
 *
 * This function:
 * 1. Analyzes the full session (chat content, mood, triggers, rugzak)
 * 2. Updates the Rugzak with session summary
 * 3. Generates a farewell message through the AI provider
 * 4. Persists the updated state
 *
 * This is the ONLY correct way to end a session.
 */
export async function endSession(
  rugzak: Rugzak,
  provider: AIProvider
): Promise<SessionEndResult> {
  // ── STEP 1: Analyze the full session ──
  const sessionMessages = rugzak.chatHistory || [];
  const sessionStart = rugzak.lastSessionDate ? new Date(rugzak.lastSessionDate) : new Date();
  const durationMinutes = Math.floor((Date.now() - sessionStart.getTime()) / 60000);

  // Detect themes from all user messages in this session
  const userMessages = sessionMessages.filter((m) => m.role === 'user');
  const allUserText = userMessages.map((m) => m.content).join(' ');
  const signals = detectInputSignals(allUserText);
  const themes = extractThemes(signals, allUserText);
  const newTriggers = extractTriggersFromSignals(signals);

  // Collect all modules used in this session
  const modulesUsed = [...new Set(
    sessionMessages
      .filter((m) => m.modulesUsed && m.modulesUsed.length > 0)
      .flatMap((m) => m.modulesUsed!)
  )];

  // Determine dominant emotion
  const endAnalysis = analyzeState(rugzak, '');
  const dominantEmotion = endAnalysis.emotionalState;

  // Compute mood delta (approximate: compare first half vs second half of mood history)
  const moodHistory = rugzak.moodHistory || [];
  let distressChange = 0;
  let resilienceChange = 0;
  if (moodHistory.length >= 2) {
    const firstSliders = moodHistory[0].sliders;
    const lastSliders = moodHistory[moodHistory.length - 1].sliders;
    const userType = rugzak.userType;
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

  // ── STEP 2: Generate farewell through AI ──
  const context: ChatContext = {
    userType: rugzak.userType,
    userName: rugzak.naam,
    currentMessage: '__SESSION_END__',
    conversationHistory: rugzak.chatHistory || [],
    moodSliders: rugzak.currentMood || { craving: 0, frustration: 0, despondency: 0, focus: 5 } as any,
    rugzak,
    activeModules: [],
    crisisLevel: 0,
    detectedEmotion: dominantEmotion,
    therapeuticStance: `SESSION_CLOSING | tone:warm | Summarize session briefly. Acknowledge what user shared. Confirm session is saved. Encourage them gently.`,
    sessionDurationMinutes: durationMinutes,
    urgency: rugzak.intakeContext?.urgency ?? 'midden',
    startEmotion: rugzak.intakeContext?.startEmotion ?? '',
  };

  let farewell: string;
  try {
    const result = await provider.generateResponse(context);
    farewell = result.response;
  } catch (error) {
    console.error('Farewell generation error:', error);
    const name = rugzak.naam;
    farewell = rugzak.userType === 'elias'
      ? `${name}, I've saved everything from our conversation. You showed real courage today. Take care of yourself, and I'll be here whenever you need me.`
      : `${name}, I've saved everything from our conversation. What you're doing for your loved one matters. Take care of yourself too, and I'll be here when you're ready.`;
  }

  // ── STEP 3: Update Rugzak ──
  // Add farewell message to history
  const farewellMsg: ChatMessage = {
    id: `msg_${Date.now()}`,
    role: 'assistant',
    content: farewell,
    timestamp: new Date().toISOString(),
  };

  let updatedRugzak: Rugzak = {
    ...rugzak,
    chatHistory: [...(rugzak.chatHistory || []), farewellMsg],
  };

  // Update trigger patterns
  if (newTriggers.length > 0) {
    updatedRugzak = {
      ...updatedRugzak,
      triggerPatterns: updateTriggerPatterns(updatedRugzak.triggerPatterns || [], newTriggers),
    };
  }

  // Record mood snapshot at session end
  if (updatedRugzak.currentMood) {
    const snapshot = {
      timestamp: new Date().toISOString(),
      sliders: { ...updatedRugzak.currentMood },
    };
    updatedRugzak = {
      ...updatedRugzak,
      moodHistory: [...(updatedRugzak.moodHistory || []), snapshot],
    };
  }

  return {
    farewell,
    sessionSummary,
    updatedRugzak,
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

  // Additional keyword-based themes
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

  // ── TONE INSTRUCTIONS ──
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

  // ── PACING INSTRUCTIONS ──
  if (analysis.pacing === 'very_slow') {
    parts.push('PACING: VERY SLOW. Use 1-2 short sentences max. No lists. No multiple questions. One thought at a time.');
  } else if (analysis.pacing === 'slower') {
    parts.push('PACING: SLOWER. Use shorter sentences. Max 2-3 sentences. Allow space for reflection.');
  } else {
    parts.push('PACING: NORMAL. 2-4 sentences. Natural conversational flow.');
  }

  // ── QUESTION LIMIT ──
  if (analysis.suggestionIntensity >= 8) {
    parts.push('QUESTIONS: MINIMAL (0-1). Be directive. State observations, offer techniques. Do not ask "how are you feeling" — the sliders already tell you.');
  } else if (analysis.suggestionIntensity >= 6) {
    parts.push('QUESTIONS: LIMITED (max 1). Combine observation with one focused question.');
  } else if (analysis.suggestionIntensity <= 3) {
    parts.push('QUESTIONS: OPEN. Listen more than suggest. Let the user lead.');
  }

  // ── REFLECTION DEPTH ──
  if (analysis.emotionalState === 'depleted' || analysis.emotionalState === 'crisis') {
    parts.push('REFLECTION: SHARP. Name the distress directly. "I can see your craving is very high and you\'re struggling." Do not sugarcoat.');
  } else if (analysis.emotionalState === 'vulnerable') {
    parts.push('REFLECTION: MODERATE. Acknowledge difficulty but also note any strengths visible in the data.');
  } else {
    parts.push('REFLECTION: LIGHT. Explore gently. The user seems relatively stable.');
  }

  // ── CRISIS MONITORING ──
  if (analysis.crisisMonitoring) {
    parts.push('CRISIS MONITORING ACTIVE. Watch for passive signals. Do not ignore hopelessness or withdrawal cues. Lower threshold for suggesting professional help.');
  }

  // ── STATE SUMMARY (for AI context) ──
  parts.push(`[STATE: ${analysis.stateSummary}]`);

  return parts.join(' | ');
}
