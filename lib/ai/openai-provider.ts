import type { AIProvider, AIResult, ChatContext } from './types';
import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from '@/lib/_core/auth';
import superjson from 'superjson';
import { analyzeBackpackRelevance } from '@/lib/rugzak/backpack-relevance-analyzer';
import { buildGPTPayload } from '@/lib/rugzak/gpt-payload-builder';
import { detectRelationalAnchor, extractRelationalAnchors } from '@/lib/rugzak/relational-anchor-detector';
import { analyzeRelationalPatterns } from '@/lib/rugzak/relational-pattern-analyzer';
import { ELIAS_DEFAULT_MODULE } from '@/lib/engine/elias/module-catalog';

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
  const now = Date.now();
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
        diaryEntries: context.diaryEntries,
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

          // Full data (SESSION_INIT only)
          backpack: gptPayload.backpack,
          userDat: gptPayload.userDat,
          diaryEntries: gptPayload.diaryEntries,
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
        };

        console.log('[OpenAIProvider] SESSION_INIT: Full payload sent + cached locally');

      } else {
        // ═══════════════════════════════════════════════════════
        // LIVE_MESSAGE: Dynamic data only. No static fields.
        // ═══════════════════════════════════════════════════════
        inputPayload = {
          // Identity (always needed for routing)
          userType: gptPayload.route,
          userName: gptPayload.userName,
          isSessionStart: false,

          // Dynamic live data (changes per message)
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

          // Live-selected triggers (re-analyzed per message from buffer)
          selectedTriggers: gptPayload.selectedTriggers,

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

          // Signal engine: relevance scores for context gating (threshold 0.3)
          relevanceScores: context.relevanceScores ?? null,
          // Signal engine: compressed context summary (replaces full lifeStorySummary)
          contextSummary: context.contextSummary ?? null,

          // LOOPBLOCKER: cross-session repeating pattern directive
          loopDetected: gptPayload.loopDetected ?? null,

          // LANGUAGE_RECOVERY: diminishing negative intensity directive
          languageRecovery: gptPayload.languageRecovery ?? null,

          // Clinical Mode (easter egg)
          clinicalModeActive: context.userDat?.clinicalModeActive ?? false,

          // Active signals for clinical annotation
          activeSignals: buildActiveSignals(context),

          // NO backpack, NO userDat, NO diaryEntries, NO coreWound,
          // NO contextLine, NO relationshipAnchor, NO relationalPattern
          // These were sent at SESSION_INIT and cached server-side.
        };

        console.log('[OpenAIProvider] LIVE_MESSAGE: Dynamic payload only (no static fields)');
      }

      // ── STEP 4: Send to server (with retry for cold starts) ──
      const serialized = superjson.serialize(inputPayload);
      const token = await Auth.getSessionToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = `${apiBaseUrl}/api/trpc/ai.chat`;

      // Logging
      console.log('[OpenAIProvider] Calling:', url, isSessionStart ? '(SESSION_INIT)' : '(LIVE_MESSAGE)');
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

      // Use fetchWithRetry instead of plain fetch for resilience against cold starts
      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(serialized),
      });

      console.log('[OpenAIProvider] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OpenAIProvider] Backend error:', response.status, errorText);
        // Instead of throwing (which gives generic message), return the actual error
        const shortError = errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText;
        return {
          response: `[DEBUG] Server returned ${response.status}.\n\nURL: ${url}\nDetails: ${shortError}\n\nPlease screenshot this and report it.`,
          advisoryEmotion: undefined,
          advisoryConfidence: undefined,
          tokenUsage: undefined,
        };
      }

      const data = await response.json();

      let result: any;
      if (data?.result?.data) {
        try {
          result = superjson.deserialize(data.result.data);
        } catch {
          result = data.result.data.json ?? data.result.data;
        }
      } else {
        result = data;
      }

      if (result?.success === false) {
        console.warn('[OpenAIProvider] Backend returned failure:', result.response);
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
        response: `[DEBUG] Connection failed.\n\nURL: ${apiUrl}/api/trpc/ai.chat\nError: ${errorMessage}\n\nPlease screenshot this and report it.`,
        advisoryEmotion: undefined,
        advisoryConfidence: undefined,
        tokenUsage: undefined,
      };
    }
  }
}
