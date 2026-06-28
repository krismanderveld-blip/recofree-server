/**
 * ══════════════════════════════════════════════════════════════════════════
 * /api/engine-process — SERVER ENGINE ENDPOINT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Contract:
 *   - Client sends CanonicalEngineInput (validated by Zod schema).
 *   - Server processes through engine pipeline.
 *   - Server returns EngineProcessResponse (stateAnalysis + buffer + regulation + dominantState).
 *   - Server does NOT persist any personal data (transit-only).
 *   - Server does NOT use Node Date for user-facing time (uses deviceTimeContext).
 *   - OpenAI calls use store:false.
 *
 * Session cache:
 *   - Server maintains an in-memory session cache (per sessionId).
 *   - Cache holds: BufferState for the session.
 *   - Cache expires after 30 minutes of inactivity.
 *   - Cache is NEVER persisted to disk or database.
 */

import { z } from "zod";
import type { Express } from 'express';

// ─── Import server-safe engine modules ───────────────────────────────
import { analyzeStateServer } from './engine/state-analyzer-server';
import type { StateAnalysis } from './engine/state-analyzer-server';
import {
  getSessionBuffer,
  setSessionBuffer,
  updateBufferServer,
  cleanExpiredSessions,
} from './engine/buffer-server';
import type { BufferState, ZoneColor } from './engine/buffer-server';
import { checkLoopblock, checkMidSessionReEval, applyLoopblockToBuffer } from './engine/loopblocker-server';
import {
  applyRegulation,
  applyDecayServer,
  applyDecayToBufferServer,
  requiresPreRegulation,
} from './engine/regulation-server';
import type { RegulationResult, DecayResult } from './engine/regulation-server';
import { runSignalEngine } from './engine/signal-engine-server';
import type { SignalEngineResult } from './engine/signal-engine-server';
import { runVspInsightServer } from './engine/vsp-insight-server';
import type { VspInsightServerResult } from './engine/vsp-insight-server';
import { searchPastReferencesServer } from './engine/past-reference-server';
import type { PastReferenceSearchResult } from './engine/past-reference-server';

// ─── Zod Schemas ──────────────────────────────────────────────────────

const deviceTimeContextSchema = z.object({
  deviceNowIso: z.string(),
  timeZone: z.string(),
  timezoneOffsetMinutes: z.number(),
  localDate: z.string(),
  localTime: z.string(),
  greetingDaypart: z.enum(['morning', 'afternoon', 'evening', 'night']),
  cycleTimestamp: z.string(),
  sessionStartedAtDeviceIso: z.string(),
});

const vspSectionSchema = z.object({
  level: z.enum(['GROEN', 'LICHTGROEN', 'GEEL', 'ORANJE', 'ROOD', 'PAARS']),
  score: z.number(),
  signals: z.string().optional(),
  whatHelps: z.string().optional(),
  anchorPhrase: z.string().optional(),
});

const moodSlidersSchema = z.record(z.string(), z.union([z.number(), z.null()]).optional());

const conversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string().optional(),
});

const logsSessionSchema = z.object({
  sessionId: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  compressedNarrative: z.string(),
  discussedTopics: z.array(z.string()),
  emotionalThemes: z.array(z.string()),
  openEndpoints: z.array(z.string()),
  moduleTrace: z.array(z.object({ moduleId: z.string(), count: z.number() })),
  zoneTrace: z.array(z.object({ zone: z.string(), count: z.number() })),
});

const userDatSummarySchema = z.object({
  totalSessions: z.number(),
  lastSessionDate: z.string().nullable(),
  currentMood: moodSlidersSchema,
  moodHistory: z.array(z.object({
    date: z.string(),
    sliders: moodSlidersSchema,
  })),
  triggerPatterns: z.array(z.object({
    trigger: z.string(),
    frequency: z.number(),
    lastSeen: z.string(),
  })),
  moduleUsage: z.array(z.object({
    moduleId: z.string(),
    count: z.number(),
    lastUsed: z.string(),
  })),
  stageOfChange: z.string(),
  clinicalModeActive: z.boolean(),
  guidanceDepth: z.string().optional(),
  schemaTendencies: z.array(z.object({
    domain: z.string(),
    confidence: z.number(),
  })).optional(),
  eigenRegieHistory: z.array(z.object({
    value: z.number(),
    timestamp: z.string(),
  })).optional(),
});

export const engineProcessInputSchema = z.object({
  requestType: z.enum(['process_message', 'session_start', 'session_end', 'greeting']),
  userType: z.enum(['elias', 'kim']),
  userName: z.string(),
  locale: z.enum(['nl', 'en', 'fr']),
  country: z.enum(['NL', 'BE', 'FR', 'UK', 'US']),
  guidanceDepth: z.string(),
  clinicalModeActive: z.boolean(),
  message: z.string(),
  conversationHistory: z.array(conversationMessageSchema),
  moodSliders: moodSlidersSchema,
  isSessionStart: z.boolean(),
  vspSection: vspSectionSchema.nullable(),
  logsSessions: z.array(logsSessionSchema),
  userDatSummary: userDatSummarySchema,
  usedModules: z.array(z.string()),
  previousZoneScore: z.number(),
  messageCount: z.number(),
  deviceTimeContext: deviceTimeContextSchema,
  /** Last assistant message for anti-repetition detection */
  previousAssistantMessage: z.string().nullable().optional(),
  /** Whether to include GPT response (full pipeline mode) */
  includeGPTResponse: z.boolean().optional(),
  /** Backpack data for session start (passed to GPT) */
  backpack: z.any().nullable().optional(),
  /** UserDat for session start (passed to GPT) */
  userDat: z.any().nullable().optional(),
  /** Diary entries for session start (passed to GPT) */
  diaryEntries: z.any().nullable().optional(),
});

export type EngineProcessInput = z.infer<typeof engineProcessInputSchema>;

// ─── Session Cache (TTL eviction) ────────────────────────────────────
// Run eviction every 5 minutes
setInterval(cleanExpiredSessions, 5 * 60 * 1000);

// ─── Engine Process Response ─────────────────────────────────────────

export interface EngineProcessResponse {
  /** Session identity for idempotency */
  sessionId: string;
  /** Turn identity for idempotency */
  turnId: string;
  /** State patches for client to write locally (ordered: safety → sessionState → memory → logs → greetingCycle) */
  statePatches: {
    safety: {
      crisisLevel: number;
      riskLevel: string;
      showEmergency: boolean;
      relapseIntentLog: { confidence: number; markers: string[]; timestamp: string } | null;
    };
    sessionState: {
      zoneScore: number;
      zoneColor: string;
      emotionalState: string;
      dominantModule: string;
      usedModules: string[];
      regulationAction: string;
      regulationWasSoftened: boolean;
      responseDirection: string;
    };
    memory: {
      triggerPatterns: Array<{ trigger: string; frequency: number; lastSeen: string }> | null;
      moduleUsage: Array<{ moduleId: string; count: number; lastUsed: string }> | null;
      vspInsight: { framework: string; discrepancy: boolean } | null;
      pastReferenceUse: { referenced: boolean; context: string } | null;
    };
    logs: {
      sessionEventSummary: string;
      moduleActivationSummary: string;
    };
    greetingCycle: {
      lastSessionDate: string;
      cycleTimestamp: string;
      sessionStartedAtDeviceIso: string;
    };
  };
  /** State analysis result */
  stateAnalysis: StateAnalysis;
  /** Buffer state after processing */
  bufferState: {
    currentZoneScore: number;
    currentZoneColor: ZoneColor;
    currentEmotion: string;
    currentIntent: string;
    currentTriggerGuess: string;
    messageCount: number;
    usedModules: string[];
    intensityTrajectory: string;
    responseDirection: string;
  };
  /** Loopblock result */
  loopblock: {
    isBlocked: boolean;
    blockedModule: string | null;
    reason: string | null;
  };
  /** Regulation result */
  regulation: {
    action: string;
    intervention: string | null;
    requiresRegulationTone: boolean;
    gptInstruction: string | null;
    zone: ZoneColor;
    effectiveDepth: string;
    wasSoftened: boolean;
    wasSkipped: boolean;
  };
  /** Decay result */
  decay: {
    newZoneScore: number;
    newZoneColor: ZoneColor;
    decayApplied: number;
    activeDecayTypes: string[];
    reason: string;
  };
  /** Mid-session re-eval result */
  midSessionReEval: {
    shouldReEval: boolean;
    reason: string | null;
  };
  /** Signal engine result (fears, hopes, goals, triggers, relapse intent) */
  signalEngine: SignalEngineResult | null;
  /** VSP Insight Layer result */
  vspInsight: VspInsightServerResult | null;
  /** Past-reference search result */
  pastReference: PastReferenceSearchResult | null;
  /** Server engine version for shadow comparison */
  engineVersion: string;
  /** Processing latency in ms */
  latencyMs: number;
  /** GPT response (only when includeGPTResponse=true) */
  gptResponse?: {
    response: string;
    advisoryEmotion?: string;
    advisoryConfidence?: number;
    tokenUsage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    selectedModel?: string;
  } | null;
}

// ─── Helper: Build input for state analyzer ──────────────────────────
function buildAnalysisInput(input: EngineProcessInput) {
  const userType = input.userType as 'elias' | 'kim';
  const summary = input.userDatSummary;
  const moodSliders = (input.moodSliders || {}) as any;

  const moodHistory = (summary?.moodHistory || []).map(m => ({
    sliders: m.sliders as any,
    timestamp: m.date,
  }));

  const triggerPatterns = (summary?.triggerPatterns || []).map(t => ({
    trigger: t.trigger,
    count: t.frequency,
    firstSeen: t.lastSeen,
    lastSeen: t.lastSeen,
  }));

  return {
    userType,
    currentMood: moodSliders,
    moodHistory,
    triggerPatterns,
    totalSessions: summary?.totalSessions || 0,
    createdAt: '',
  };
}

// ─── Engine Process Handler ──────────────────────────────────────────

/**
 * Process an engine request through the full pipeline:
 *   1. State Analysis (risk, emotion, triggers)
 *   2. Buffer Update (session state, zone, trajectory)
 *   3. Decay (time, response, overshoot correction)
 *   4. Loopblock (module repetition prevention)
 *   5. Regulation (zone → action → micro-intervention)
 *   6. Mid-session re-eval (should we re-evaluate module?)
 */
export async function processEngineRequest(input: EngineProcessInput): Promise<EngineProcessResponse> {
  const startMs = Date.now();

  // Derive sessionId from user + session start time (stable per session)
  const sessionId = `${input.userName}_${input.deviceTimeContext.sessionStartedAtDeviceIso}`;

  // ── Step 1: State Analysis ──────────────────────────────────────
  const analysisInput = buildAnalysisInput(input);
  const stateAnalysis: StateAnalysis = analyzeStateServer(analysisInput, input.message);

  // ── Step 2: Buffer Update ───────────────────────────────────────
  // Get or create the session buffer
  let buffer = getSessionBuffer(sessionId);

  // Build conversation history as ChatMessage[]
  const allMessages = input.conversationHistory.map((m, i) => ({
    id: `msg-${i}`,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    timestamp: m.timestamp || input.deviceTimeContext.deviceNowIso,
  }));

  // Update buffer with new message data
  buffer = updateBufferServer(
    buffer,
    input.message,
    allMessages,
    input.moodSliders as any,
    input.userType as any,
  );

  // Save updated buffer back to session cache
  setSessionBuffer(sessionId, buffer);

  // ── Step 3: Decay ──────────────────────────────────────────────
  const decayResult: DecayResult = applyDecayServer(buffer);
  buffer = applyDecayToBufferServer(buffer, decayResult);

  // ── Step 4: Loopblock ──────────────────────────────────────────
  const proposedModule = input.usedModules[input.usedModules.length - 1] || 'default';
  const loopblockResult = checkLoopblock(buffer, proposedModule, input.usedModules);
  if (!loopblockResult.isBlocked) {
    buffer = applyLoopblockToBuffer(buffer, proposedModule);
    setSessionBuffer(sessionId, buffer);
  }

  // ── Step 5: Regulation ─────────────────────────────────────────
  const regulationResult: RegulationResult = applyRegulation(
    buffer.currentZoneColor,
    (input.guidanceDepth as 'light' | 'normal' | 'deep') || 'normal',
    input.previousAssistantMessage || null,
  );

  // ── Step 6: Mid-session Re-eval ────────────────────────────────
  const previousZoneColor = (input.previousZoneScore <= 20 ? 'GREEN' :
    input.previousZoneScore <= 40 ? 'YELLOW' :
    input.previousZoneScore <= 60 ? 'ORANGE' :
    input.previousZoneScore <= 80 ? 'RED' : 'PURPLE') as ZoneColor;
  const midSessionReEval = checkMidSessionReEval(previousZoneColor, buffer.currentZoneColor, buffer);

  // ── Step 7: Signal Engine (parallel, non-blocking) ────────────
  let signalResult: SignalEngineResult | null = null;
  try {
    signalResult = await runSignalEngine(
      input.message,
      input.userType,
      {
        zone: buffer.currentZoneColor,
        vspOrEigenRegie: input.vspSection?.level ?? null,
        keySliders: input.moodSliders as Record<string, unknown>,
        userType: input.userType,
      },
      {
        backpackSummary: input.userDatSummary?.stageOfChange || '',
        diarySummary: '',
        triggerList: input.userDatSummary?.triggerPatterns?.map(t => t.trigger) || [],
      },
      {
        backpackSections: input.userDatSummary?.stageOfChange || '',
        recentSessionThemes: input.logsSessions?.[0]?.emotionalThemes?.join(', ') || '',
      },
    );
  } catch { /* signal engine failure is non-fatal */ }

  // ── Step 8: VSP Insight Layer ──────────────────────────────────
  let vspInsightResult: VspInsightServerResult | null = null;
  if (input.vspSection) {
    try {
      vspInsightResult = runVspInsightServer({
        persona: input.userType,
        userMessage: input.message,
        recentMessages: input.conversationHistory.slice(-5).map(m => m.content),
        moodSliders: {
          craving: (input.moodSliders as any)?.craving ?? 0,
          frustration: (input.moodSliders as any)?.frustration ?? 0,
          despondency: (input.moodSliders as any)?.despondency ?? 0,
          focus: (input.moodSliders as any)?.focus ?? 5,
        },
        selfReportedZone: input.vspSection.level,
        sessionTurnCount: buffer.messageCount,
        safetyCore: {
          finalZone: buffer.currentZoneColor === 'GREEN' ? 'GROEN' :
            buffer.currentZoneColor === 'YELLOW' ? 'GEEL' :
            buffer.currentZoneColor === 'ORANGE' ? 'ORANJE' :
            buffer.currentZoneColor === 'RED' ? 'ROOD' : 'PAARS',
          userReportedZone: input.vspSection.level,
          safetyOverrideActive: stateAnalysis.riskLevel === 'critical',
          crisisDetected: stateAnalysis.riskLevel === 'critical',
          relapseIntentDetected: signalResult?.relapseIntent?.detected ?? false,
          modelRoutingDecision: stateAnalysis.riskLevel === 'critical' ? 'gpt-4o' : 'gpt-4o-mini',
          activeSafetyModuleId: null,
        },
        profile: null,
      });
    } catch { /* VSP insight failure is non-fatal */ }
  }

  // ── Step 9: Past-Reference Search ─────────────────────────────
  let pastReferenceResult: PastReferenceSearchResult | null = null;
  if (input.message.length > 5 && input.logsSessions.length > 0) {
    try {
      pastReferenceResult = searchPastReferencesServer(
        input.message,
        input.logsSessions as any,
        {
          triggerPatterns: input.userDatSummary?.triggerPatterns?.map(t => ({
            trigger: t.trigger,
            context: undefined,
            lastSeen: t.lastSeen,
          })) || [],
          schemaTendencies: input.userDatSummary?.schemaTendencies?.map(s => ({
            schema: s.domain,
            evidence: undefined,
          })) || [],
        },
      );
    } catch { /* past-reference failure is non-fatal */ }
  }

  // ── Step 10: GPT Response (optional, full pipeline mode) ────────
  let gptResponse: EngineProcessResponse['gptResponse'] = null;
  if (input.includeGPTResponse) {
    try {
      const { generateAIResponse } = await import('./ai-chat');

      // Build ChatRequestInput from engine results
      const chatInput: any = {
        userType: input.userType,
        userName: input.userName,
        isSessionStart: input.isSessionStart,
        message: input.message,
        conversationHistory: input.conversationHistory.map(m => ({ role: m.role, content: m.content })),
        moodSliders: input.moodSliders,
        activeModules: [loopblockResult.isBlocked ? 'default' : (input.usedModules[input.usedModules.length - 1] || 'default')],
        dominantModule: loopblockResult.isBlocked ? 'default' : (input.usedModules[input.usedModules.length - 1] || 'default'),
        riskScore: stateAnalysis.riskLevel === 'critical' ? 90 : stateAnalysis.riskLevel === 'high' ? 60 : stateAnalysis.riskLevel === 'moderate' ? 30 : 5,
        crisisLevel: stateAnalysis.riskLevel === 'critical' ? 3 : stateAnalysis.riskLevel === 'high' ? 2 : 0,
        isCrisis: stateAnalysis.riskLevel === 'critical',
        detectedEmotion: stateAnalysis.emotionalState || 'neutral',
        therapeuticStance: stateAnalysis.tone || 'warm',
        sessionDurationMinutes: Math.max(0, Math.floor((Date.now() - new Date(input.deviceTimeContext.sessionStartedAtDeviceIso).getTime()) / 60000)),
        urgency: stateAnalysis.riskLevel === 'critical' ? 'high' : stateAnalysis.riskLevel === 'high' ? 'medium' : 'low',
        startEmotion: stateAnalysis.emotionalState || 'neutral',
        stageOfChange: input.userDatSummary?.stageOfChange || 'contemplation',
        selectedTriggers: stateAnalysis.activeTriggers?.map(t => ({ trigger: t, score: 0.8 })) || [],
        guidanceDepth: (input.guidanceDepth as 'light' | 'normal' | 'deep') || 'normal',
        vspLevel: input.vspSection?.level || null,
        bufferSnapshot: {
          zone: buffer.currentZoneColor,
          emotionalDirection: buffer.responseDirection || 'stable',
          liveIntent: buffer.currentIntent || 'neutral',
          dominantState: buffer.currentEmotion || 'neutral',
        },
        regulationResult: {
          action: regulationResult.action,
          intervention: regulationResult.intervention,
          gptInstruction: regulationResult.gptInstruction,
          zone: regulationResult.zone,
          effectiveDepth: regulationResult.effectiveDepth,
          wasSoftened: regulationResult.wasSoftened,
          wasSkipped: regulationResult.wasSkipped,
        },
        loopDetected: loopblockResult.isBlocked ? {
          active: true,
          theme: loopblockResult.blockedModules[0] || '',
          sessionCount: 2,
          instruction: loopblockResult.reason,
        } : null,
        // Signal engine context
        relevanceScores: signalResult?.relevanceScores || null,
        contextSummary: signalResult?.contextSummary || null,
        // VSP insight
        vspInsightContext: vspInsightResult?.insightContext || null,
        // Past reference
        pastReferenceContext: pastReferenceResult?.matchedReferences?.map(r => r.narrative).join(' | ') || null,
        // Clinical mode
        clinicalModeActive: input.clinicalModeActive,
        // Locale
        locale: input.locale,
        // Session start data
        backpack: input.backpack || null,
        userDat: input.userDat || null,
        diaryEntries: input.diaryEntries || null,
      };

      gptResponse = await generateAIResponse(chatInput);
    } catch (err: any) {
      console.error('[engine-process] GPT call failed:', err.message);
      gptResponse = null;
    }
  }

  const latencyMs = Date.now() - startMs;

  // ── Build State Patches ──────────────────────────────────────────
  const turnId = `${sessionId}_turn_${buffer.messageCount}`;
  const nowIso = input.deviceTimeContext.deviceNowIso;

  const statePatches = {
    safety: {
      crisisLevel: stateAnalysis.riskLevel === 'critical' ? 3 : stateAnalysis.riskLevel === 'high' ? 2 : stateAnalysis.riskLevel === 'moderate' ? 1 : 0,
      riskLevel: stateAnalysis.riskLevel,
      showEmergency: stateAnalysis.riskLevel === 'critical',
      relapseIntentLog: signalResult?.relapseIntent?.detected
        ? { confidence: signalResult.relapseIntent.confidence, markers: signalResult.relapseIntent.markers || [], timestamp: nowIso }
        : null,
    },
    sessionState: {
      zoneScore: buffer.currentZoneScore,
      zoneColor: buffer.currentZoneColor,
      emotionalState: stateAnalysis.emotionalState,
      dominantModule: loopblockResult.isBlocked ? 'default' : (input.usedModules[input.usedModules.length - 1] || 'default'),
      usedModules: buffer.usedModules,
      regulationAction: regulationResult.action,
      regulationWasSoftened: regulationResult.wasSoftened,
      responseDirection: buffer.responseDirection,
    },
    memory: {
      triggerPatterns: signalResult?.triggers?.length
        ? signalResult.triggers.map(t => ({ trigger: t.trigger || t.name || '', frequency: 1, lastSeen: nowIso }))
        : null,
      moduleUsage: buffer.usedModules.length
        ? buffer.usedModules.map(m => ({ moduleId: m, count: 1, lastUsed: nowIso }))
        : null,
      vspInsight: vspInsightResult
        ? { framework: vspInsightResult.selectedFramework || 'none', discrepancy: vspInsightResult.discrepancyDetected || false }
        : null,
      pastReferenceUse: pastReferenceResult?.matchedReferences?.length
        ? { referenced: true, context: pastReferenceResult.matchedReferences[0].narrative }
        : null,
    },
    logs: {
      sessionEventSummary: `Turn ${buffer.messageCount}: ${stateAnalysis.emotionalState} | zone=${buffer.currentZoneColor} | risk=${stateAnalysis.riskLevel}`,
      moduleActivationSummary: buffer.usedModules.join(', ') || 'none',
    },
    greetingCycle: {
      lastSessionDate: input.deviceTimeContext.localDate,
      cycleTimestamp: input.deviceTimeContext.cycleTimestamp,
      sessionStartedAtDeviceIso: input.deviceTimeContext.sessionStartedAtDeviceIso,
    },
  };

  return {
    sessionId,
    turnId,
    statePatches,
    stateAnalysis,
    bufferState: {
      currentZoneScore: buffer.currentZoneScore,
      currentZoneColor: buffer.currentZoneColor,
      currentEmotion: buffer.currentEmotion,
      currentIntent: buffer.currentIntent,
      currentTriggerGuess: buffer.currentTriggerGuess,
      messageCount: buffer.messageCount,
      usedModules: buffer.usedModules,
      intensityTrajectory: buffer.intensityTrajectory,
      responseDirection: buffer.responseDirection,
    },
    loopblock: {
      isBlocked: loopblockResult.isBlocked,
      blockedModule: loopblockResult.blockedModules[0] || null,
      reason: loopblockResult.reason,
    },
    regulation: {
      action: regulationResult.action,
      intervention: regulationResult.intervention,
      requiresRegulationTone: regulationResult.requiresRegulationTone,
      gptInstruction: regulationResult.gptInstruction,
      zone: regulationResult.zone,
      effectiveDepth: regulationResult.effectiveDepth,
      wasSoftened: regulationResult.wasSoftened,
      wasSkipped: regulationResult.wasSkipped,
    },
    decay: {
      newZoneScore: decayResult.newZoneScore,
      newZoneColor: decayResult.newZoneColor,
      decayApplied: decayResult.decayApplied,
      activeDecayTypes: decayResult.activeDecayTypes,
      reason: decayResult.reason,
    },
    midSessionReEval: {
      shouldReEval: midSessionReEval.reEvalTriggered,
      reason: midSessionReEval.clearedModules.length > 0
        ? `Cleared modules: ${midSessionReEval.clearedModules.join(', ')}`
        : null,
    },
    signalEngine: signalResult,
    vspInsight: vspInsightResult,
    pastReference: pastReferenceResult,
    engineVersion: 'server-v0.6.0-checkpoint-e',
    latencyMs,
    gptResponse,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function mapRiskToIntent(riskLevel: string): 'crisis' | 'venting' | 'neutral' {
  if (riskLevel === 'critical' || riskLevel === 'high') return 'crisis';
  if (riskLevel === 'moderate') return 'venting';
  return 'neutral';
}

function computeZoneDelta(analysis: StateAnalysis): number {
  // Map risk level to zone score delta
  switch (analysis.riskLevel) {
    case 'critical': return 40;
    case 'high': return 25;
    case 'moderate': return 10;
    case 'low': return 0;
    default: return 0;
  }
}

function extractTopic(message: string): string {
  // Simple topic extraction: first 50 chars, trimmed
  return message.slice(0, 50).trim();
}

// ─── Route Registration ─────────────────────────────────────────────

export function registerEngineProcessRoute(app: Express): void {
  app.post('/api/engine-process', async (req, res) => {
    try {
      const parseResult = engineProcessInputSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'INVALID_INPUT',
          details: parseResult.error.issues.slice(0, 5),
        });
      }
      const result = await processEngineRequest(parseResult.data);
      return res.json(result);
    } catch (error: any) {
      console.error('[engine-process] Error:', error.message);
      return res.status(500).json({
        error: 'PROCESSING_ERROR',
        message: error.message,
      });
    }
  });
}
