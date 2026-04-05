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

// ─── Helper: Build therapeutic stance string for AI prompt ──────

function buildTherapeuticStance(analysis: StateAnalysis): string {
  const parts: string[] = [];

  // Tone
  parts.push(`tone:${analysis.tone}`);

  // Pacing
  if (analysis.pacing === 'very_slow') {
    parts.push('Use short sentences. Pause between thoughts. Be very gentle.');
  } else if (analysis.pacing === 'slower') {
    parts.push('Use shorter sentences. Allow space for reflection.');
  }

  // Intensity
  if (analysis.suggestionIntensity >= 7) {
    parts.push('Be slightly more directive. Offer concrete suggestions.');
  } else if (analysis.suggestionIntensity <= 3) {
    parts.push('Be gentle. Listen more than suggest.');
  }

  // Crisis
  if (analysis.crisisMonitoring) {
    parts.push('CRISIS MONITORING ACTIVE. Do not ignore passive signals.');
  }

  // State summary
  parts.push(`[${analysis.stateSummary}]`);

  return parts.join(' | ');
}
