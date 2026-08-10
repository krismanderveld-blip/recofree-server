import type { AIProvider, AIResult, ChatContext } from './types';
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
// superjson is dynamically imported only in tRPC fallback path
import { analyzeBackpackRelevance } from '@/lib/rugzak/backpack-relevance-analyzer';
import { buildGPTPayload } from '@/lib/rugzak/gpt-payload-builder';
import { detectRelationalAnchor, extractRelationalAnchors } from '@/lib/rugzak/relational-anchor-detector';
import { analyzeRelationalPatterns } from '@/lib/rugzak/relational-pattern-analyzer';
import { buildSlimLivePayload } from '@/lib/ai/live-message-filter';
import { ELIAS_DEFAULT_MODULE } from '@/lib/engine/elias/module-catalog';
import { LocalDeviceTimeService } from "@/lib/core/time";

/**
 * OpenAIProvider — Routes through backend tRPC to OpenAI.
 *
 * PATCH N: SESSION_INIT / LIVE_MESSAGE split.
 *
 *   SESSION_INIT (sent ONCE at session start, cached locally):
 *     coreWound, relationshipAnchor, relationalPattern, contextLine,
 *     userProfileSummary, recentDiarySummary, backpack, userDat, diaryEntries
 *
 *   LIVE_MESSAGE (sent per message, dynamic only):
 *     message, conversationHistory, moodSliders, selectedTriggers,
 *     dominantModule, stageOfChange, urgency, riskScore, crisisLevel
 *
 *   Static fields are NEVER resent per message.
 *
 * RETRY LOGIC:
 *   After server hibernation (deployed server cold start), the first request
 *   may fail with a network error or 502/503. The provider retries up to 3 times
 *   with exponential backoff (2s, 4s, 8s) to allow the server to wake up.
 */

// ── Session Init Cache (local, per session) ──
// Stores the static payload from SESSION_INIT so we don't resend it.
let cachedSessionInit: Record<string, unknown> | null = null;

/** Clear the session init cache (call on session end or new session) */
export function clearSessionInitCache(): void {
  cachedSessionInit = null;
  console.log('[OpenAIProvider] Session init cache cleared');
}

/** Check if session init has been sent */
export function hasSessionInit(): boolean {
  return cachedSessionInit !== null;
}

// ── Retry Helper ──
// Retries a fetch call with exponential backoff for transient failures
// (network errors, 502, 503, 504 — typical of server cold starts).

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000; // 2s, 4s, 8s

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on server-side transient errors (cold start / gateway timeout)
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        if (attempt < retries) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(`[OpenAIProvider] Server returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[OpenAIProvider] Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${retries}):`, (error as Error).message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error('All retry attempts failed');
}

// ── Server Health Ping ──
// Lightweight ping to wake up the server before the main API call.
// Uses the tRPC health endpoint or a simple GET to trigger cold start.

let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function ensureServerAwake(apiBaseUrl: string): Promise<void> {
  const now = LocalDeviceTimeService.now().epochMs;
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL_MS) {
    return; // Recently checked, skip
  }

  try {
    console.log('[OpenAIProvider] Pinging server to ensure it is awake...');
    const response = await fetch(`${apiBaseUrl}/api/trpc/system.health`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000), // 10s timeout for wake-up
    });
    lastHealthCheck = now;
    console.log(`[OpenAIProvider] Server health: ${response.status}`);
  } catch (error) {
    // Server might be waking up — that's OK, the retry logic will handle it
    console.warn('[OpenAIProvider] Server health ping failed (may be waking up):', (error as Error).message);
    // Still update timestamp to avoid spamming pings
    lastHealthCheck = now;
  }
}

/**
 * Build activeSignals array for clinical annotation.
 * Combines candidateSignals (from GptSignalEngine) with source/memory info.
 * Each signal gets: label (keyword), score (confidence mapped to 0-3), memory (source layer).
 */
function buildActiveSignals(context: ChatContext): Array<{ label: string; score: number; memory: string }> {
  const signals: Array<{ label: string; score: number; memory: string }> = [];
  const cs = context.candidateSignals;

  // Map confidence (0-1) to score (0-3): <0.3 = +1, <0.7 = +2, >=0.7 = +3
  const toScore = (confidence: number): number => {
    if (confidence >= 0.7) return 3;
    if (confidence >= 0.3) return 2;
    return 1;
  };

  // ═══ projections.dat — future-facing signals from GptSignalEngine ═══
  if (cs) {
    for (const f of cs.fears) {
      signals.push({ label: f.keyword, score: toScore(f.confidence), memory: 'projections.dat' });
    }
    for (const h of cs.hopes) {
      signals.push({ label: h.keyword, score: toScore(h.confidence), memory: 'projections.dat' });
    }
    for (const g of cs.goals) {
      signals.push({ label: g.keyword, score: toScore(g.confidence), memory: 'projections.dat' });
    }
  }

  // ═══ user.dat — persistent trigger patterns across sessions ═══
  if (cs) {
    for (const t of cs.triggers) {
      signals.push({ label: t.keyword, score: toScore(t.confidence), memory: 'user.dat' });
    }
  }

  // ═══ state.dat — current mood-based signals from sliders ═══
  // Only emit signals for elevated slider values (threshold: ≥4 out of 10)
  const sliders = context.moodSliders;
  if (sliders && 'craving' in sliders) {
    // Elias sliders: craving, frustration, despondency (high = bad), focus (high = good)
    const elias = sliders as { craving: number; frustration: number; despondency: number; focus: number };
    if (elias.craving >= 4) {
      signals.push({ label: 'craving', score: Math.min(3, Math.ceil(elias.craving / 3)), memory: 'state.dat' });
    }
    if (elias.frustration >= 4) {
      signals.push({ label: 'frustration', score: Math.min(3, Math.ceil(elias.frustration / 3)), memory: 'state.dat' });
    }
    if (elias.despondency >= 4) {
      signals.push({ label: 'despondency', score: Math.min(3, Math.ceil(elias.despondency / 3)), memory: 'state.dat' });
    }
    // Low focus is a signal (inverted: focus ≤ 3 out of 10)
    if (elias.focus <= 3) {
      signals.push({ label: 'low-focus', score: Math.min(3, Math.ceil((10 - elias.focus) / 3)), memory: 'state.dat' });
    }
  } else if (sliders && 'stress' in sliders) {
    // Kim sliders: stress, boundaryFatigue, emotionalBurden (high = bad)
    const kim = sliders as { stress: number; boundaryFatigue: number; emotionalBurden: number };
    if (kim.stress >= 4) {
      signals.push({ label: 'stress', score: Math.min(3, Math.ceil(kim.stress / 3)), memory: 'state.dat' });
    }
    if (kim.boundaryFatigue >= 4) {
      signals.push({ label: 'boundary-fatigue', score: Math.min(3, Math.ceil(kim.boundaryFatigue / 3)), memory: 'state.dat' });
    }
    if (kim.emotionalBurden >= 4) {
      signals.push({ label: 'emotional-burden', score: Math.min(3, Math.ceil(kim.emotionalBurden / 3)), memory: 'state.dat' });
    }
  }

  // ═══ buffer — volatile per-message signals (not persisted) ═══
  const buf = context.bufferSnapshot;
  if (buf) {
    // Zone escalation as a buffer signal
    if (buf.zoneColor === 'ORANGE' || buf.zoneColor === 'RED' || buf.zoneColor === 'PURPLE') {
      const zoneScore = buf.zoneColor === 'PURPLE' ? 3 : buf.zoneColor === 'RED' ? 2 : 1;
      signals.push({ label: `zone-${buf.zoneColor.toLowerCase()}`, score: zoneScore, memory: 'buffer' });
    }
    // Rising intensity trajectory
    if (buf.intensityTrajectory === 'rising') {
      signals.push({ label: 'intensity-rising', score: 2, memory: 'buffer' });
    }
    // Live intent signals (only actionable intents)
    if (buf.liveIntent && buf.liveIntent !== 'neutral') {
      signals.push({ label: `intent-${buf.liveIntent}`, score: 1, memory: 'buffer' });
    }
    // Detected emotion as buffer signal (only strong emotions)
    if (buf.currentEmotion && buf.currentEmotion !== 'neutral' && buf.currentEmotion !== 'unknown' && buf.currentEmotion !== '') {
      signals.push({ label: buf.currentEmotion, score: 1, memory: 'buffer' });
    }
  }

  // ═══ Crisis markers — direct language detection for suicidal ideation ═══
  const latestMessage = context.currentMessage || '';
  const crisisMarkers = [
    "niet meer zijn", "wil er niet meer zijn", "wil niet meer leven",
    "wil dood", "heeft geen zin meer", "ik geef het op",
    "geen uitweg", "beter af zonder mij", "wil stoppen met leven",
    "maak er een einde aan", "wil niet meer wakker worden"
  ];

  if (crisisMarkers.some(marker => latestMessage.toLowerCase().includes(marker))) {
    signals.push({
      label: 'suïcidale ideatie',
      score: 3,
      memory: 'buffer'
    });
  }

  return signals;
}

/**
 * Build compact known user patterns block from userDat.
 * In NORMAL mode: Only CONFIRMED schemas/modes are included (safe to present as known patterns to GPT).
 * In CLINICAL mode: ALL candidates with confidence >= 0.3 are included (clinician needs full picture).
 * Triggers are always included (top 8 by weight/count).
 */
function buildKnownUserPatterns(userDat: ChatContext['userDat'], clinicalMode = false): { schemas: Array<{ name: string; confidence: number }>; modes: Array<{ name: string; confidence: number }>; triggers: string[] } | null {
  if (!userDat) return null;

  let schemas: Array<{ name: string; confidence: number }>;
  let modes: Array<{ name: string; confidence: number }>;

  if (clinicalMode) {
    // CLINICAL MODE: show ALL candidates with confidence >= 0.3 (regardless of confirmed status)
    schemas = (userDat.schemaTendencies || [])
      .filter((s: any) => (s.confidence ?? 0) >= 0.3)
      .sort((a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .map((s: any) => ({ name: s.schemaId, confidence: s.confidence ?? 0 }));

    modes = (userDat.modeTendencies || [])
      .filter((m: any) => (m.confidence ?? 0) >= 0.3)
      .sort((a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .map((m: any) => ({ name: m.modeId, confidence: m.confidence ?? 0 }));
  } else {
    // NORMAL MODE: Only CONFIRMED schemas/modes (confirmed === true) are safe to present
    schemas = (userDat.schemaTendencies || [])
      .filter((s: any) => s.confirmed === true && (s.confidence ?? 0) >= 0.35)
      .map((s: any) => ({ name: s.schemaId, confidence: s.confidence ?? 0 }));

    modes = (userDat.modeTendencies || [])
      .filter((m: any) => m.confirmed === true && (m.confidence ?? 0) >= 0.35)
      .map((m: any) => ({ name: m.modeId, confidence: m.confidence ?? 0 }));
  }

  const triggers = (userDat.triggerPatterns || [])
    .filter((t: any) => t.trigger && typeof t.trigger === 'string')
    .sort((a: any, b: any) => (b.weight ?? b.count ?? 0) - (a.weight ?? a.count ?? 0))
    .slice(0, 8)
    .map((t: any) => t.trigger);

  // Only return if there's something meaningful
  if (schemas.length === 0 && modes.length === 0 && triggers.length === 0) return null;

  return { schemas, modes, triggers };
}

/**
 * Build acknowledged candidates (schemas/modes that have userAcknowledged or clinicalAcknowledged
 * but are NOT yet confirmed). These are presented as "exploratory" patterns in the prompt.
 * Only included in NORMAL mode (clinical mode already shows everything via knownUserPatterns).
 */
function buildAcknowledgedCandidates(userDat: ChatContext['userDat']): { schemas: Array<{ name: string; confidence: number }>; modes: Array<{ name: string; confidence: number }> } | null {
  if (!userDat) return null;
  const schemas = (userDat.schemaTendencies || [])
    .filter((s: any) => !s.confirmed && (s.userAcknowledged || s.clinicalAcknowledged) && (s.confidence ?? 0) >= 0.3)
    .map((s: any) => ({ name: s.schemaId, confidence: s.confidence ?? 0 }));
  const modes = (userDat.modeTendencies || [])
    .filter((m: any) => !m.confirmed && (m.userAcknowledged || m.clinicalAcknowledged) && (m.confidence ?? 0) >= 0.3)
    .map((m: any) => ({ name: m.modeId, confidence: m.confidence ?? 0 }));
  if (schemas.length === 0 && modes.length === 0) return null;
  return { schemas, modes };
}

/**
 * Final-layer sanitization of the chat payload before sending to server.
 * Ensures all `triggers` arrays (in knownUserPatterns, backpackAnalysis, selectedTriggers)
 * contain only valid values that pass Zod validation.
 */
function sanitizeChatPayload(payload: Record<string, unknown>): Record<string, unknown> {
  // 1. backpackAnalysis.triggers → must be string[]
  if (payload.backpackAnalysis && typeof payload.backpackAnalysis === 'object') {
    const ba = payload.backpackAnalysis as Record<string, unknown>;
    if (Array.isArray(ba.triggers)) {
      ba.triggers = ba.triggers.filter(
        (t: unknown) => t != null && typeof t === 'string' && t !== ''
      );
    }
    // Also sanitize other string arrays in backpackAnalysis
    for (const key of ['coreBeliefs', 'copingPatterns'] as const) {
      if (Array.isArray(ba[key])) {
        (ba as any)[key] = (ba[key] as unknown[]).filter(
          (v: unknown) => v != null && typeof v === 'string'
        );
      }
    }
  }

  // 2. knownUserPatterns.triggers → must be string[]
  if (payload.knownUserPatterns && typeof payload.knownUserPatterns === 'object') {
    const kup = payload.knownUserPatterns as Record<string, unknown>;
    if (Array.isArray(kup.triggers)) {
      kup.triggers = kup.triggers.filter(
        (t: unknown) => t != null && typeof t === 'string' && t !== ''
      );
    }
  }

  // 3. selectedTriggers → must be Array<{ trigger: string, score: number }>
  if (Array.isArray(payload.selectedTriggers)) {
    payload.selectedTriggers = (payload.selectedTriggers as unknown[]).filter(
      (item: unknown) =>
        item != null &&
        typeof item === 'object' &&
        typeof (item as any).trigger === 'string' &&
        (item as any).trigger !== '' &&
        typeof (item as any).score === 'number' &&
        Number.isFinite((item as any).score)
    );
  }

  // 4. Convert null → undefined for ALL optional fields that could receive null
  // This prevents Zod from rejecting null values
  const nullToDeleteFields = [
    'extractedEntities', 'recentDiary', 'diaryEntries',
    'backpack', 'userDat', 'bufferSnapshot',
    'regulationResult', 'engineDirective',
    'knownUserPatterns', 'backpackAnalysis',
  ];
  for (const field of nullToDeleteFields) {
    if (payload[field] === null) {
      delete payload[field];
    }
  }

  // 5. Convert null arrays → empty arrays (selectedTriggers, activeSignals)
  // These are expected as arrays, not null
  const arrayFields = ['selectedTriggers', 'activeSignals'];
  for (const field of arrayFields) {
    if (payload[field] === null || payload[field] === undefined) {
      payload[field] = [];
    }
  }

  // 6. Remap backpack.sections → backpack.lifeStory (server expects lifeStory)
  // The gpt-payload-builder does this for SESSION_INIT, but SESSION_END sends raw backpack
  if (payload.backpack && typeof payload.backpack === 'object') {
    const bp = payload.backpack as Record<string, unknown>;
    if (Array.isArray(bp.sections) && !Array.isArray(bp.lifeStory)) {
      bp.lifeStory = (bp.sections as any[]).map((s: any) => ({
        id: s.id || '',
        label: s.label || '',
        ageRange: s.ageRange || '',
        content: s.content || '',
      }));
      delete bp.sections;
    }
    // Ensure intakeContext has all required fields
    if (bp.intakeContext && typeof bp.intakeContext === 'object') {
      const ic = bp.intakeContext as Record<string, unknown>;
      if (!ic.initialContext && ic.firstContext) {
        ic.initialContext = ic.firstContext;
        delete ic.firstContext;
      }
      ic.startEmotion = ic.startEmotion || '';
      ic.urgency = ic.urgency || 'midden';
      ic.initialContext = ic.initialContext || '';
      ic.intakeDate = ic.intakeDate || '';
    }
  }

  // 7. Remap userDat.moduleUsage → userDat.moduleUsageSummary (server expects moduleUsageSummary)
  if (payload.userDat && typeof payload.userDat === 'object') {
    const ud = payload.userDat as Record<string, unknown>;
    if (Array.isArray(ud.moduleUsage) && !ud.moduleUsageSummary) {
      ud.moduleUsageSummary = [...new Set((ud.moduleUsage as any[]).map((m: any) => m.moduleId || m))];
    }
    // Ensure required arrays exist
    if (!ud.moduleUsageSummary) ud.moduleUsageSummary = [];
  }

  return payload;
}

export class OpenAIProvider implements AIProvider {
  async generateResponse(context: ChatContext): Promise<AIResult> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const isSessionStart = context.isSessionStart;

      // ── STEP 0: Ensure server is awake (lightweight ping) ──
      if (apiBaseUrl) {
        await ensureServerAwake(apiBaseUrl);
      }

      // ── STEP 1: Local Analysis (runs EVERY call) ──
      const dominantModule = context.activeModules[0] || ELIAS_DEFAULT_MODULE;

      const sliders = { ...context.moodSliders } as Record<string, unknown>;
      // Filter to only finite numbers (excludes vsp string, NaN, undefined)
      const sliderValues = Object.values(sliders).filter(
        (v): v is number => typeof v === 'number' && Number.isFinite(v)
      );
      const avgDistress = sliderValues.length > 0
        ? sliderValues.reduce((a, b) => a + b, 0) / sliderValues.length
        : 0;
      const riskScore = Math.min(10, (context.crisisLevel || 0) * 3 + Math.round(avgDistress));

      // Backpack Relevance Analyzer (local, every call)
      const relevance = analyzeBackpackRelevance(
        context.currentMessage,
        context.backpack,
        context.userDat,
        context.moodSliders,
        dominantModule,
      );

      // Relational Anchor Detection (local, every call)
      const allAnchors = extractRelationalAnchors(context.backpack);
      const anchorResult = detectRelationalAnchor(
        context.currentMessage,
        context.backpack,
      );
      if (anchorResult.selectedAnchor) {
        relevance.relationshipAnchor = {
          name: anchorResult.selectedAnchor.name,
          role: anchorResult.selectedAnchor.role,
          roleEN: anchorResult.selectedAnchor.roleEN,
          score: anchorResult.selectedScore,
        };
      }

      // Relational Pattern Analysis (local, every call)
      const relationalPattern = analyzeRelationalPatterns(
        context.currentMessage,
        context.backpack,
        context.userDat,
        allAnchors,
      );

      // ── STEP 2: Build GPT Payload (local structure) ──
      const gptPayload = buildGPTPayload({
        message: context.currentMessage,
        backpack: context.backpack,
        userDat: context.userDat,
        sliders: context.moodSliders,
        isSessionStart,
        dominantModule,
        riskScore,
        relevance,
        diaryEntries: context.diaryEntries?.map(e => ({ id: e.id, content: e.content, moodTag: e.moodTag, timestamp: e.timestamp, gratitude: e.gratitude })) ?? [],
        chatHistory: context.conversationHistory,
        detectedEmotion: context.detectedEmotion,
        therapeuticStance: context.therapeuticStance,
        sessionDurationMinutes: context.sessionDurationMinutes,
        urgency: context.urgency,
        startEmotion: context.startEmotion,
        crisisLevel: context.crisisLevel,
        relationalPattern,
        bufferSnapshot: context.bufferSnapshot,
        guidanceDepth: context.guidanceDepth ?? 'normal',
        regulationResult: context.regulationResult,
        engineDirective: context.engineDirective,
        interventionContinuity: context.interventionContinuity,
        projectionContext: context.projectionContext,
        projectionDeepening: context.projectionDeepening,
        stoaContext: context.stoaContext,
        schemaModeContext: context.schemaModeContext,
        actContext: context.actContext,
        cgtContext: context.cgtContext,
        dgtContext: context.dgtContext,
        mbtContext: context.mbtContext,
        ko1Context: context.ko1Context,
        k05Context: context.k05Context,
        k02Context: context.k02Context,
        k04Context: context.k04Context,
        k04s4Context: context.k04s4Context,
        k06Context: context.k06Context,
        k01Context: context.k01Context,
        k03Context: context.k03Context,
        sw01Context: context.sw01Context,
        sto01Context: context.sto01Context,
        vergv01Context: context.vergv01Context,
        igh01Context: context.igh01Context,
        agc01Context: context.agc01Context,
        hwk01Context: context.hwk01Context,
        fale01Context: context.fale01Context,
        verg01Context: context.verg01Context,
        rouw01Context: context.rouw01Context,
        iden01Context: context.iden01Context,
        zink01Context: context.zink01Context,
        terv01Context: context.terv01Context,
        mi02Context: context.mi02Context,
        slaap01EliasContext: context.slaap01EliasContext,
        slaap01KimContext: context.slaap01KimContext,
        bedr01Context: context.bedr01Context,
        vetr01Context: context.vetr01Context,
        gasl01Context: context.gasl01Context,
        cdp01Context: context.cdp01Context,
        rnw01Context: context.rnw01Context,
        par01Context: context.par01Context,
        fin01Context: context.fin01Context,
        iso01Context: context.iso01Context,
        relapseClusterContext: context.relapseClusterContext,
        dangerChildContext: context.dangerChildContext,
        relationalDynamicsContext: context.relationalDynamicsContext,
        emotionalLossContext: context.emotionalLossContext,
        stoaKContext: context.stoaKContext,
        vspInsightContext: context.vspInsightContext,
        vspBackpackProfile: context.vspBackpackProfile,
        vspStructuredSection: context.vspStructuredSection,
        extractedEntities: context.extractedEntities,
        backpackChanged: context.backpackChanged,
        contextDatSerialized: context.contextDatSerialized,
        deepeningBlock: context.deepeningBlock,
      });

      // ── STEP 3: Build server payload based on SESSION_INIT / LIVE_MESSAGE split ──
      let inputPayload: Record<string, unknown>;

      if (isSessionStart) {
        // ═══════════════════════════════════════════════════════
        // SESSION_INIT: Full payload, sent ONCE. Cached locally.
        // ═══════════════════════════════════════════════════════
        inputPayload = {
          // Identity
          userType: gptPayload.route,
          userName: gptPayload.userName,
          isSessionStart: true,

          // Live message data (also included at session start)
          message: gptPayload.message,
          conversationHistory: gptPayload.conversationWindow,
          moodSliders: gptPayload.sliders,
          activeModules: [gptPayload.dominantModule],
          crisisLevel: gptPayload.crisisLevel,
          isCrisis: context.isCrisis ?? false,
          vspLevel: context.vspLevel ?? null,
          detectedEmotion: gptPayload.detectedEmotion,
          therapeuticStance: gptPayload.therapeuticStance,
          sessionDurationMinutes: gptPayload.sessionDurationMinutes,
          urgency: gptPayload.urgency,
          startEmotion: gptPayload.startEmotion,
          dominantModule: gptPayload.dominantModule,
          riskScore: gptPayload.riskScore,
          stageOfChange: gptPayload.stageOfChange,
          // Relapse/slip signal (Elias only — from userDatSummary)
          recentRelapseEvent: (gptPayload as any).userDatSummary?.recentRelapseEvent ?? null,
          preventionPlan: (gptPayload as any).userDatSummary?.preventionPlan ?? null,
          // Eigen Regie (Kim only — zone, meaning, impact directives)
          eigenRegieContext: context.eigenRegieContext ?? null,
          // KERP01: Eigen Regie Plan (Kim only — zone-specific signals, helps, anchors, triggers, boundary rules)
          eigenRegiePlanContext: context.eigenRegiePlanContext ?? null,

          // Static context (SESSION_INIT only — NOT resent per message)
          selectedTriggers: gptPayload.selectedTriggers,
          coreWound: gptPayload.coreWound,
          contextLine: gptPayload.contextLine,
          relationshipAnchor: gptPayload.relationshipAnchor,
          relationalPattern: gptPayload.relationalPattern,
          recentDiary: gptPayload.recentDiary,

          // Buffer snapshot (live session state from pipeline)
          bufferSnapshot: gptPayload.bufferSnapshot ?? null,

          // User-controlled guidance depth
          guidanceDepth: gptPayload.guidanceDepth ?? 'normal',

          // Regulation result (from regulation layer)
          regulationResult: gptPayload.regulationResult ?? null,

          // Engine directive (from orchestration routing)
          engineDirective: gptPayload.engineDirective ?? null,

          // Intervention continuity (Elias only, zone-linked therapeutic memory)
          interventionContinuity: gptPayload.interventionContinuity ?? null,

          // Projection layer (future-facing fears/hopes/goals)
          projectionContext: gptPayload.projectionContext ?? null,
          projectionDeepening: gptPayload.projectionDeepening ?? null,

          // STOA engine (Elias only, Stoic session injection)
          stoaContext: gptPayload.stoaContext ?? null,

          // Schema/Mode engine (deterministic intervention context)
          schemaModeContext: gptPayload.schemaModeContext ?? null,
          // ACT engine (values-based intervention context)
          actContext: gptPayload.actContext ?? null,
          // CBT/CGT engine (cognitive distortion intervention context)
          cgtContext: gptPayload.cgtContext ?? null,
          // DGT/DBT engine (emotional/behavioral signal intervention context)
          dgtContext: gptPayload.dgtContext ?? null,
          // MBT++ engine (mentalizing state + response mode)
          mbtContext: gptPayload.mbtContext ?? null,
          // KO1 Recognition & Validation (Kim only)
          ko1Context: gptPayload.ko1Context ?? null,
          // K05 Communication Skills (Kim only)
          k05Context: gptPayload.k05Context ?? null,
          k02Context: gptPayload.k02Context ?? null,
          k04Context: gptPayload.k04Context ?? null,
          k04s4Context: gptPayload.k04s4Context ?? null,
          k06Context: gptPayload.k06Context ?? null,
          // K01 Boundary Setting (Kim only)
          k01Context: gptPayload.k01Context ?? null,
          // K03 Self-Care With Shadow Layer (Elias + Kim)
          k03Context: gptPayload.k03Context ?? null,
          // SW01 Shadow Work (Elias only)
          sw01Context: gptPayload.sw01Context ?? null,
          // STO01 Stoicism Integration (Elias only)
          sto01Context: gptPayload.sto01Context ?? null,
          // VERGV01/IGH01/AGC01/HWK01 Advanced Modules
          vergv01Context: gptPayload.vergv01Context ?? null,
          igh01Context: gptPayload.igh01Context ?? null,
          agc01Context: gptPayload.agc01Context ?? null,
          hwk01Context: gptPayload.hwk01Context ?? null,
          fale01Context: gptPayload.fale01Context ?? null,
          verg01Context: gptPayload.verg01Context ?? null,
          rouw01Context: gptPayload.rouw01Context ?? null,
          iden01Context: gptPayload.iden01Context ?? null,
          zink01Context: gptPayload.zink01Context ?? null,
          terv01Context: gptPayload.terv01Context ?? null,
          mi02Context: gptPayload.mi02Context ?? null,
          slaap01EliasContext: gptPayload.slaap01EliasContext ?? null,
          slaap01KimContext: gptPayload.slaap01KimContext ?? null,
          bedr01Context: gptPayload.bedr01Context ?? null,
          vetr01Context: gptPayload.vetr01Context ?? null,
          gasl01Context: gptPayload.gasl01Context ?? null,
          cdp01Context: gptPayload.cdp01Context ?? null,
          rnw01Context: gptPayload.rnw01Context ?? null,
          par01Context: gptPayload.par01Context ?? null,
          fin01Context: gptPayload.fin01Context ?? null,
          iso01Context: gptPayload.iso01Context ?? null,
          // Kim cluster contexts
          relapseClusterContext: gptPayload.relapseClusterContext ?? null,
          dangerChildContext: gptPayload.dangerChildContext ?? null,
          relationalDynamicsContext: gptPayload.relationalDynamicsContext ?? null,
          emotionalLossContext: gptPayload.emotionalLossContext ?? null,
          stoaKContext: gptPayload.stoaKContext ?? null,
          // VSP Insight System (MI/MBT/DGT framework selection, store:false)
          vspInsightContext: gptPayload.vspInsightContext ?? null,
          // VSP Backpack Profile (LLM-analyzed zone signals from recurringThemes, Elias only)
          vspBackpackProfile: (gptPayload as any).vspBackpackProfile ?? null,
          // VSP Structured Section (user's own per-zone signals, whatHelps, anchorSentence, Elias only)
          vspStructuredSection: (gptPayload as any).vspStructuredSection ?? null,

          // LOOPBLOCKER: cross-session repeating pattern directive
          loopDetected: gptPayload.loopDetected ?? null,

          // LANGUAGE_RECOVERY: diminishing negative intensity directive
          languageRecovery: gptPayload.languageRecovery ?? null,

          // Clinical Mode (easter egg)
          clinicalModeActive: context.userDat?.clinicalModeActive ?? false,

          // Backpack empty flag (for greeting tone adaptation)
          backpackEmpty: context.backpackEmpty ?? false,

          // Active signals for clinical annotation
          activeSignals: buildActiveSignals(context),

          // Structured entities (compact backpack memory)
          extractedEntities: gptPayload.extractedEntities ?? null,
          backpackChanged: gptPayload.backpackChanged ?? false,

          // DIST01: Distillation context (persons, life context, signals from continuous extraction)
          distillationContext: context.distillationContext ?? null,

          // Backpack deep analysis (schemas, modes, triggers from GPT-4o)
          backpackAnalysis: context.userDat?.backpackAnalysis ?? null,

          // Known user patterns (compact, every turn) — in clinical mode, show ALL candidates
          knownUserPatterns: buildKnownUserPatterns(context.userDat, context.userDat?.clinicalModeActive ?? false),
          // Acknowledged candidates (exploratory — user/clinical ack'd but not yet confirmed)
          acknowledgedCandidates: buildAcknowledgedCandidates(context.userDat),

          // PsychoEducation/Steunpilaren/SelfAcceptance/KimPattern contexts (SESSION_INIT — cached server-side)
          psychoEducationContext: gptPayload.psychoEducationContext ?? null,
          steunpilarenContext: gptPayload.steunpilarenContext ?? null,
          selfAcceptanceContext: gptPayload.selfAcceptanceContext ?? null,
          kimPatternSupportContext: gptPayload.kimPatternSupportContext ?? null,

          // Full data (SESSION_INIT only) — context.dat is ADDITIVE, memory layers always sent in full
          backpack: gptPayload.backpack,
          userDat: gptPayload.userDat,
          diaryEntries: gptPayload.diaryEntries,
          ...(gptPayload.contextDat
            ? {
                contextDat: gptPayload.contextDat,
                deepeningBlock: gptPayload.deepeningBlock ?? null,
              }
            : {}),

          // PRE-BUILT PROMPT BLOCKS (local pipeline → server as pure proxy)
          personLookupBlock: context.personLookupBlock ?? null,
          lifeContextBlock: context.lifeContextBlock ?? null,
          prebuiltStructuredMemory: context.prebuiltStructuredMemory ?? null,
          prebuiltSessionHistory: context.prebuiltSessionHistory ?? null,

          // User-selected app language (from i18n provider)
          locale: context.locale ?? null,
        };

        // Cache the static fields locally so we don't resend them
        cachedSessionInit = {
          userType: gptPayload.route,
          userName: gptPayload.userName,
          coreWound: gptPayload.coreWound,
          contextLine: gptPayload.contextLine,
          relationshipAnchor: gptPayload.relationshipAnchor,
          relationalPattern: gptPayload.relationalPattern,
                    recentDiary: gptPayload.recentDiary,
          stageOfChange: gptPayload.stageOfChange,
          recentRelapseEvent: (gptPayload as any).userDatSummary?.recentRelapseEvent ?? null,
          preventionPlan: (gptPayload as any).userDatSummary?.preventionPlan ?? null,
        };
        console.log('[OpenAIProvider] SESSION_INIT: Full payload sent + cached locally');

      } else {
        // ═══════════════════════════════════════════════════════
        // LIVE_MESSAGE: Slim payload — only active/relevant fields per turn.
        // Inactive module contexts (null/undefined) are OMITTED entirely.
        // ═══════════════════════════════════════════════════════
        const { payload: slimPayload, stats: slimStats } = buildSlimLivePayload(
          gptPayload,
          context,
          { buildActiveSignals, buildKnownUserPatterns },
        );
        inputPayload = slimPayload;

        console.log(`[OpenAIProvider] LIVE_MESSAGE SLIM: ${slimStats.totalFieldsAfter} fields sent (${slimStats.droppedNullFields} null fields omitted)`);
        if (slimStats.activeContextFields.length > 0) {
          console.log(`[OpenAIProvider] Active context: ${slimStats.activeContextFields.join(', ')}`);
        }
      }

      // ── STEP 4: Send to server via /api/gpt-proxy (plain JSON, no tRPC envelope) ──
      // ── STEP 3.5: CLIENT PROMPT MIRROR (debug only, behind feature flag) ──
      // Builds a client-side mirror prompt for debug comparison.
      // Does NOT replace the active GPT route. Does NOT send to OpenAI.
      let clientPromptMirrorDebug: {
        enabled: boolean;
        promptBuildVersion?: string;
        estimatedPromptSize?: number;
        budgetWarnings?: string[];
        includedSections?: string[];
        omittedSections?: string[];
        effectiveDepth?: string;
        maxFormulationMode?: string;
        mirrorBuildError?: string;
      } = { enabled: false };

      try {
        const mirrorEnabled = process.env.EXPO_PUBLIC_ENABLE_CLIENT_PROMPT_MIRROR === 'true';
        if (mirrorEnabled) {
          const { buildClientSystemPrompt } = require('./prompt/client-system-prompt-builder');
          const mirrorInput = {
            persona: context.userType as 'kim' | 'elias',
            userName: context.userName,
            selectedModule: dominantModule,
            crisisLevel: context.crisisLevel ?? 0,
            safetyLevel: (context.crisisLevel ?? 0) >= 2 ? 'crisis' : 'none',
            relationalStanceDirective: context.relationalStanceFilter ?? undefined,
            effectiveDepth: (context as any).effectiveDepth ?? undefined,
            maxFormulationMode: (context as any).maxFormulationMode ?? undefined,
            userGuidanceDepth: context.guidanceDepth ?? 'normal',
            regulationInstruction: context.regulationResult?.gptInstruction ?? undefined,
            interventionContinuityBlock: context.interventionContinuity ?? undefined,
            engineDirective: context.engineDirective ?? undefined,
            contextSummary: context.contextSummary ?? undefined,
            contextDatSerialized: context.contextDatSerialized ?? undefined,
            deepeningBlock: context.deepeningBlock ?? undefined,
            projectionContext: context.projectionContext ?? undefined,
            moodSliders: context.moodSliders,
            vspLevel: context.vspLevel ?? undefined,
            relapseIntentDetected: context.relapseIntent?.detected ?? false,
            sessionDurationMinutes: context.sessionDurationMinutes ?? 0,
          };

          const mirrorResult = buildClientSystemPrompt(mirrorInput);
          clientPromptMirrorDebug = {
            enabled: true,
            promptBuildVersion: mirrorResult.promptBuildVersion,
            estimatedPromptSize: mirrorResult.estimatedPromptSize,
            budgetWarnings: mirrorResult.budgetWarnings,
            includedSections: mirrorResult.debug?.includedSections,
            omittedSections: mirrorResult.debug?.omittedSections,
            effectiveDepth: mirrorResult.debug?.effectiveDepth,
            maxFormulationMode: mirrorResult.debug?.maxFormulationMode,
          };

          console.log(`[OpenAIProvider] CLIENT PROMPT MIRROR: version=${mirrorResult.promptBuildVersion} size=${mirrorResult.estimatedPromptSize} sections=${mirrorResult.debug?.includedSections?.join(',')}`);
        }
      } catch (mirrorError) {
        // Mirror failure is non-blocking — legacy route continues
        clientPromptMirrorDebug = {
          enabled: true,
          mirrorBuildError: (mirrorError as Error)?.message ?? 'Unknown mirror build error',
        };
        console.warn('[OpenAIProvider] CLIENT PROMPT MIRROR failed (non-blocking):', (mirrorError as Error)?.message);
      }

      // Final sanitization: ensure all triggers arrays are clean before Zod validation
      const sanitizedPayload = sanitizeChatPayload(inputPayload as Record<string, unknown>);

      // Serialize loopDetected and languageRecovery to strings if they are objects
      // (server Zod expects string | null, client builds objects)
      if (sanitizedPayload.loopDetected && typeof sanitizedPayload.loopDetected === 'object') {
        sanitizedPayload.loopDetected = (sanitizedPayload.loopDetected as any).instruction ?? JSON.stringify(sanitizedPayload.loopDetected);
      }
      if (sanitizedPayload.languageRecovery && typeof sanitizedPayload.languageRecovery === 'object') {
        sanitizedPayload.languageRecovery = (sanitizedPayload.languageRecovery as any).instruction ?? JSON.stringify(sanitizedPayload.languageRecovery);
      }

      const token = await Auth.getSessionToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Primary: /api/gpt-proxy (plain JSON, works on Railway)
      const proxyUrl = `${apiBaseUrl}/api/gpt-proxy`;

      // Logging
      console.log('[OpenAIProvider] Calling:', proxyUrl, isSessionStart ? '(SESSION_INIT)' : '(LIVE_MESSAGE)');
      console.log('[OpenAIProvider] Dominant module:', gptPayload.dominantModule);
      console.log('[OpenAIProvider] Risk score:', gptPayload.riskScore);
      console.log('[OpenAIProvider] Selected triggers:', gptPayload.selectedTriggers.map(t => t.trigger).join(', ') || 'none');
      console.log('[OpenAIProvider] Conversation window:', gptPayload.conversationWindow.length, 'messages');
      if (gptPayload.bufferSnapshot) {
        console.log(`[OpenAIProvider] Buffer snapshot: zone=${gptPayload.bufferSnapshot.zoneColor}(${gptPayload.bufferSnapshot.zoneScore}), intent=${gptPayload.bufferSnapshot.liveIntent}, direction=${gptPayload.bufferSnapshot.responseDirection}`);
      }
      if (isSessionStart && gptPayload.backpack) {
        console.log('[OpenAIProvider] Full backpack included (SESSION_INIT)');
      }

      // Use fetchWithRetry for resilience against cold starts
      let response: globalThis.Response;
      let usedProxy = true;
      try {
        response = await fetchWithRetry(proxyUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(sanitizedPayload),
        });
      } catch (proxyError) {
        // Proxy unreachable — fallback to tRPC route (sandbox dev server)
        console.warn('[OpenAIProvider] /api/gpt-proxy failed, falling back to tRPC:', (proxyError as Error)?.message);
        usedProxy = false;
        const superjson = await import('superjson');
        const serialized = superjson.default.serialize(sanitizedPayload);
        const trpcUrl = `${apiBaseUrl}/api/trpc/ai.chat`;
        response = await fetchWithRetry(trpcUrl, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(serialized),
        });
      }

      console.log('[OpenAIProvider] Response status:', response.status, usedProxy ? '(gpt-proxy)' : '(tRPC fallback)');

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OpenAIProvider] Backend error:', response.status, errorText);
        const shortError = errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText;
        const usedUrl = usedProxy ? proxyUrl : `${apiBaseUrl}/api/trpc/ai.chat`;
        return {
          response: `[DEBUG] Server returned ${response.status}.\n\nURL: ${usedUrl}\nDetails: ${shortError}\n\nPlease screenshot this and report it.`,
          advisoryEmotion: undefined,
          advisoryConfidence: undefined,
          tokenUsage: undefined,
        };
      }

      const data = await response.json();

      let result: any;
      if (usedProxy) {
        // /api/gpt-proxy returns plain JSON: { success, response, tokenUsage, selectedModel }
        result = data;
      } else {
        // tRPC returns envelope: { result: { data: superjson } }
        if (data?.result?.data) {
          try {
            const superjson = await import('superjson');
            result = superjson.default.deserialize(data.result.data);
          } catch {
            result = data.result.data.json ?? data.result.data;
          }
        } else {
          result = data;
        }
      }

      if (result?.success === false) {
        console.warn('[OpenAIProvider] Backend returned failure:', result.error || result.response);
      }

      // Log token usage
      if (result?.tokenUsage) {
        console.log(`[CostControl] Call tokens: ${result.tokenUsage.promptTokens} prompt + ${result.tokenUsage.completionTokens} completion = ${result.tokenUsage.totalTokens} total`);
      }

      return {
        response: result?.response ?? "Something went wrong. I'm still here — please try again.",
        advisoryEmotion: result?.advisoryEmotion,
        advisoryConfidence: result?.advisoryConfidence,
        tokenUsage: result?.tokenUsage,
        selectedModel: result?.selectedModel,
      };
    } catch (error) {
      console.error('[OpenAIProvider] Error after retries:', error);

      // Show the actual error + URL so we can debug on device
      const errorMessage = (error as Error)?.message ?? 'Unknown error';
      const apiUrl = getApiBaseUrl();

      return {
        response: `[DEBUG] Connection failed.\n\nURL: ${apiUrl}/api/gpt-proxy\nError: ${errorMessage}\n\nPlease screenshot this and report it.`,
        advisoryEmotion: undefined,
        advisoryConfidence: undefined,
        tokenUsage: undefined,
      };
    }
  }
}
