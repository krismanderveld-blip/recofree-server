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
});

export type EngineProcessInput = z.infer<typeof engineProcessInputSchema>;

// ─── Session Cache (TTL eviction) ────────────────────────────────────
// Run eviction every 5 minutes
setInterval(cleanExpiredSessions, 5 * 60 * 1000);

// ─── Engine Process Response ─────────────────────────────────────────

export interface EngineProcessResponse {
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
  /** Server engine version for shadow comparison */
  engineVersion: string;
  /** Processing latency in ms */
  latencyMs: number;
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

  const latencyMs = Date.now() - startMs;

  return {
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
    engineVersion: 'server-v0.3.0-checkpoint-b',
    latencyMs,
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
