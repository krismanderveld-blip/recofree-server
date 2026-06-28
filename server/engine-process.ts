/**
 * ══════════════════════════════════════════════════════════════════════════
 * /api/engine-process — SERVER ENGINE ENDPOINT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Contract:
 *   - Client sends CanonicalEngineInput (validated by Zod schema).
 *   - Server processes through engine pipeline.
 *   - Server returns EngineProcessResponse (stateAnalysis + dominantState).
 *   - Server does NOT persist any personal data (transit-only).
 *   - Server does NOT use Node Date for user-facing time (uses deviceTimeContext).
 *   - OpenAI calls use store:false.
 *
 * Session cache:
 *   - Server maintains an in-memory session cache (per sessionId).
 *   - Cache holds: buffer state, zone score, module history for the session.
 *   - Cache expires after 30 minutes of inactivity.
 *   - Cache is NEVER persisted to disk or database.
 */

import { z } from "zod";

// ─── Import server-safe engine modules ───────────────────────────────
import { analyzeStateServer } from './engine/state-analyzer-server';
import type { StateAnalysis } from './engine/state-analyzer-server';

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
});

export type EngineProcessInput = z.infer<typeof engineProcessInputSchema>;

// ─── Session Cache ────────────────────────────────────────────────────

interface SessionCacheEntry {
  sessionId: string;
  lastAccess: number;
  /** Buffer state (zone, emotion, triggers, etc.) */
  zoneScore: number;
  zoneColor: string;
  emotionalState: string;
  usedModules: string[];
  messageCount: number;
  /** Dominant state from last turn */
  lastDominantModule: string | null;
}

const SESSION_CACHE = new Map<string, SessionCacheEntry>();
const SESSION_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get or create a session cache entry.
 */
export function getEngineSessionCache(sessionId: string): SessionCacheEntry {
  const existing = SESSION_CACHE.get(sessionId);
  if (existing) {
    existing.lastAccess = Date.now();
    return existing;
  }
  const entry: SessionCacheEntry = {
    sessionId,
    lastAccess: Date.now(),
    zoneScore: 0,
    zoneColor: 'GREEN',
    emotionalState: 'stable',
    usedModules: [],
    messageCount: 0,
    lastDominantModule: null,
  };
  SESSION_CACHE.set(sessionId, entry);
  return entry;
}

/**
 * Evict expired session cache entries.
 */
export function evictExpiredSessions(): void {
  const now = Date.now();
  for (const [id, entry] of SESSION_CACHE) {
    if (now - entry.lastAccess > SESSION_CACHE_TTL_MS) {
      SESSION_CACHE.delete(id);
    }
  }
}

// Run eviction every 5 minutes
setInterval(evictExpiredSessions, 5 * 60 * 1000);

// ─── Helper: Reconstruct input for analyzeStateServer ───────────────
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

// ─── Engine Process Handler ───────────────────────────────────────────

export interface EngineProcessResponse {
  /** State analysis result (Phase 3) */
  stateAnalysis: {
    riskLevel: string;
    emotionalState: string;
    moodTrend: string;
    activeTriggers: string[];
    triggerContextActive: boolean;
    patternAccumulation: number;
    tone: string;
    pacing: string;
    suggestionIntensity: number;
    crisisMonitoring: boolean;
    crisisThresholdLowered: boolean;
    priorityModules: string[];
    stateSummary: string;
  };
  /** Dominant state (Phase 4 — null until buffer is ported) */
  dominantState: null;
  /** Server engine version for shadow comparison */
  engineVersion: string;
  /** Processing latency in ms */
  latencyMs: number;
}

/**
 * Process an engine request.
 *
 * Phase progression:
 *   - Checkpoint A: state-analyzer (active) + dominant-state-selector (stub — needs buffer)
 *   - Checkpoint B: buffer + loopblocker + regulation + crisis
 *   - Checkpoint C: signal/VSP/past-reference/GPT
 *   - Checkpoint D: state patch roundtrip
 */
export async function processEngineRequest(input: EngineProcessInput): Promise<EngineProcessResponse> {
  const startMs = Date.now();

  // Derive sessionId from deviceTimeContext (stable per session)
  const sessionId = `${input.userName}_${input.deviceTimeContext.sessionStartedAtDeviceIso}`;
  const cache = getEngineSessionCache(sessionId);
  cache.messageCount = input.messageCount;
  cache.usedModules = input.usedModules;

  // ── Step 1: State Analysis ──────────────────────────────────────
  const analysisInput = buildAnalysisInput(input);
  const stateAnalysis: StateAnalysis = analyzeStateServer(analysisInput, input.message);

  // Update cache with analysis results
  cache.emotionalState = stateAnalysis.emotionalState;
  cache.zoneScore = stateAnalysis.suggestionIntensity; // proxy for zone score

  // ── Step 2: Dominant State Selection ────────────────────────────
  // selectDominantState requires a full BufferState (session-stateful).
  // Buffer porting is Phase 5-6. For now, return null.
  // The shadow comparison will mark this as "not_compared" for dominantState.
  const dominantState = null;

  const latencyMs = Date.now() - startMs;

  return {
    stateAnalysis,
    dominantState,
    engineVersion: 'server-v0.2.0-checkpoint-a',
    latencyMs,
  };
}

// ─── Route Registration ─────────────────────────────────────────────

import type { Express } from 'express';

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
