/**
 * ══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE — TWO-LAYER DECISION MODEL (Phase 4 Canon)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * LAYER 1 — ENGINE (this pipeline + local modules):
 *   Deterministic:
 *     - Zone detection, crisis handling, regulation
 *     - Module routing (Elias/Kim module catalogs)
 *     - Buffer management, decay, dominant state selection
 *   SignalEngine (GPT-4o-mini, 3s timeout):
 *     - Semantic signal detection → candidateSignals (fears/hopes/goals/triggers)
 *     - Relevance scoring → backpackRelevance, diaryRelevance (threshold 0.3)
 *     - Context summarization → contextSummary (LIVE_MESSAGE only)
 *   Together: ONE decision layer. Never calls GPT directly for decisions.
 *
 * LAYER 2 — GPT-4o/mini (server/ai-chat.ts):
 *   - Receives engine decisions as INSTRUCTIONS (not suggestions)
 *   - Formulates therapeutic language — nothing else
 *   - Cannot override module selection, zone, or regulation
 *
 * FLOW PER MESSAGE:
 *   Engine decides → GPT formulates → Pipeline stores
 *
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Message Processing Pipeline — DUAL-PROCESSING FLOW
 *
 * INTERNAL DUAL-PROCESSING (per message):
 *
 *   PRE-GPT (local, deterministic + SignalEngine):
 *     1. Apply trigger decay to PREVIOUS buffer state (before new message merges)
 *     2. Update ShortTermMemoryBuffer with new message
 *     3. Apply RegulationDecayEngine zone decay
 *     4. Select DominantState (pre-GPT decision variable)
 *     5. Build stable BufferSnapshot for GPT payload
 *     5c. SignalEngine: detectSignals + scoreRelevance + summarizeContext (non-blocking, 3s timeout)
 *     6. Feed dominant state + buffer snapshot into ChatContext → ONE GPT call
 *
 *   POST-GPT (local, no second GPT call):
 *     7. Update internal stored state (no reselection of dominantState)
 *     8. Concrete pattern marking (repeat counter, threshold >=3, cooldown)
 *     9. Consolidated logging (model, dominant state, triggers, tokens, promotions)
 *
 *   SESSION-END:
 *     10. Ranked promotion evaluation (by score, not FCFS), apply top 5
 *
 * RULES:
 *   - ZERO second GPT calls per message (SignalEngine is pre-GPT, non-blocking)
 *   - Buffer is primary source; user.dat influences weighting only
 *   - Full buffer NEVER goes to GPT — only BufferSnapshot
 *   - Backpack + userDat NEVER sent per follow-up message
 *   - AI generates language ONLY. System makes decisions.
 *   - relevanceScores gate context injection: < 0.3 → skip (saves tokens)
 *   - contextSummary replaces full lifeStorySummary for LIVE_MESSAGE calls
 *
 * DUAL-STORE RULES:
 *   - backpack.json → stable identity, NEVER modified by the pipeline
 *   - user.dat → dynamic session memory, updated only at session end (promotions)
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
import { processFeedbackLoop } from '../engine/feedback-loop';
import { mergePersons } from '../engine/signal-router';
import { loadCachedVspProfile } from '../backpack-extractor/vsp-backpack-analyzer';
import { parseEngineResponse } from '../engine/signal-parser';
import {
  updateBuffer,
  createBuffer,
  getBufferSnapshot,
  scoreToZone,
  type BufferState,
  type BufferSnapshot,
} from './short-term-memory-buffer';
import { logDebugEvent } from '../debug/session-logger';
import { selectDominantState, type DominantState } from './dominant-state-selector';
import { applyDecay, applyDecayToBuffer, type DecayResult } from './regulation-decay-engine';
import { analyzeBackpackRelevance, resetTriggerDecay, parseVspProfileFromBackpack } from './backpack-relevance-analyzer';
import { evaluatePromotions, applyPromotions, type PromotionCandidate, type PromotionResult } from './userdat-promotion';
import { recordCallCost, resetSessionCost, estimateTokens, type TokenUsage } from './cost-control';
import { applyRegulation, type RegulationResult, type ZoneColor } from './regulation-layer';
import { createEliasDecision, type EliasDecision } from '../engine/elias/decision-layer';
import { createKimDecision, type KimDecision } from '../engine/kim/decision-layer';
import { routeEngineDirective, type EngineDirective } from '../engine/orchestration';
import type { CrisisAssessment } from '../crisis/detector';
import { kimDistressScore, kimResilienceScore } from '../engine/kim/slider-interpretation';
import { KIM_DEFAULT_MODULE } from '../engine/kim/module-catalog';
import { eliasDistressScore, eliasResilienceScore, ELIAS_DEFAULT_MOOD } from '../engine/elias/slider-interpretation';
import { ELIAS_DEFAULT_MODULE } from '../engine/elias/module-catalog';
import { ELIAS_DEFAULT_STAGE } from '../engine/elias/stage-of-change';
import {
  evaluateInterventionContinuity,
  updateInterventionAfterResponse,
  resetInterventionState,
  buildInterventionContext,
  type InterventionState,
} from '../engine/elias/intervention-continuity';
import {
  resetProjectionState,
  getProjectionState,
  loadProjectionState,
  resetSessionTracking as resetProjectionSessionTracking,
  applyProjectionDecay,
  type ProjectionEntry,
} from '../engine/elias/projection';
import {
  resetKimProjectionState,
  applyKimProjectionDecay,
} from '../engine/kim/projection';
import {
  runProjectionLayer,
  resetDeepeningState,
  checkDeflectionInResponse,
  type ProjectionResult,
} from './projection-layer';
import { sanitizeSliders } from '../engine/shared/slider-sanitize';
import { buildTraceBlock, type EngineTraceInput, type PipelineStepStatus } from '../debug/engine-trace';
import { getEngine } from '../engine/local-llm/engine-provider';
import { detectRelapseIntentFallback, detectKimRelapseIntentFallback } from '../engine/local-llm/relapse-intent-fallback';
import { computeEliasImpact } from '../engine/elias/vsp-impact';
import {
  selectStoaSession,
  resetStoaSessionState,
  getStoaSessionState,
  type StoaEngineResult,
} from '../engine/elias/stoa-engine';
import { routeRetp, type RetpRouterResult } from '../engine/elias/retp-router';
import {
  runSchemaModeEngine,
  resetSchemaModeSessionState,
  getSessionActivatedModes,
  getSessionActivatedSchemas,
} from '../engine/shared/schema-mode-router';
import type { SchemaModeEngineResult, ModeId, SchemaId } from '../engine/shared/schema-mode-types';
import {
  routeACTEngine,
  resetACTSessionState,
  getSessionACTProcessesUsed,
} from '../engine/shared/act-router';
import type { ACTEngineResult, ACTProgress } from '../engine/shared/act-types';
import { createDefaultACTProgress } from '../engine/shared/act-types';
import {
  routeCBTEngine,
  resetCBTSessionState,
  getSessionCBTProcessesUsed,
} from '../engine/shared/cgt-router';
import type { CBTEngineResult, CBTProgress } from '../engine/shared/cgt-types';
import { createDefaultCBTProgress } from '../engine/shared/cgt-types';
import {
  routeDGTEngine,
  resetDGTSessionState,
  getSessionDGTProcessesUsed,
} from '../engine/shared/dbt-router';
import type { DGTEngineResult, DGTProgress } from '../engine/shared/dbt-types';
import { createDefaultDGTProgress } from '../engine/shared/dbt-types';
import {
  routeMBTEngine,
  resetMBTSessionState,
  getSessionMBTProcessesUsed,
} from '../engine/shared/mbt-router';
import type { MBTEngineResult, MBTProgress } from '../engine/shared/mbt-types';
import { createDefaultMBTProgress } from '../engine/shared/mbt-types';
import {
  routeKO1Engine,
  resetKO1SessionState,
  getSessionKO1PatternsUsed,
  createDefaultKO1Progress,
} from '../engine/kim/ko1-recognition';
import type { KO1EngineResult, KO1Progress } from '../engine/kim/ko1-recognition';
import {
  routeK05Engine,
  resetK05SessionState,
  getSessionK05ModesUsed,
  createDefaultK05Progress,
} from '../engine/kim/k05-communication';
import type { K05EngineResult, K05Progress } from '../engine/kim/k05-communication';
import {
  routeK02Engine,
  resetK02SessionState,
  getSessionK02FlagsUsed,
  getSessionK02InterventionStates,
  createDefaultK02Progress,
} from '../engine/kim/k02-enabling-awareness';
import type { K02EngineResult, K02Progress } from '../engine/kim/k02-enabling-awareness';
import {
  detectK04EmotionalState,
  routeK04Engine,
  resetK04SessionState,
  updateK04Progress,
} from '../engine/kim/k04-emotional-regulation';
import type { K04RoutingResult, K04Progress } from '../engine/kim/k04-emotional-regulation';
import {
  detectK04S4State,
  routeK04S4Engine,
  resetK04S4SessionState,
  updateK04S4Progress,
} from '../engine/kim/k04-betrayal-trust';
import type { K04S4RoutingResult, K04S4Progress } from '../engine/kim/k04-betrayal-trust';
import {
  detectK06State,
  routeK06Engine,
  resetK06SessionState,
  updateK06Progress,
} from '../engine/kim/k06-self-care';
import type { K06RoutingResult, K06Progress } from '../engine/kim/k06-self-care';
import {
  detectK01BoundaryState,
  routeK01Engine,
  resetK01SessionState,
  updateK01Progress,
  createDefaultK01Progress,
} from '../engine/kim/k01-boundary-setting';
import type { K01RoutingResult, K01Progress } from '../engine/kim/k01-boundary-setting';
import {
  detectK03State,
  routeK03Engine,
  resetK03SessionState,
  updateK03Progress,
  createDefaultK03Progress,
} from '../engine/kim/k03-self-care';
import type { K03RoutingResult, K03Progress } from '../engine/kim/k03-self-care';
import { runKimAdvancedModules } from '../engine/kim/kim-advanced-modules';
import type { KimAdvancedModulesResult } from '../engine/kim/kim-advanced-modules';
import {
  detectShadowSignals,
  buildShadowSignal,
  hasShadowMarkers,
  routeZuchtShadow,
  computeSW01Directive,
  resetSW01SessionState,
  updateSW01SessionState,
  updateSW01Progress,
} from '../engine/elias/shadow';
import type { SW01EngineResult, SW01Progress } from '../engine/elias/shadow';
import { createDefaultSW01Progress } from '../engine/elias/shadow';
import {
  hasSTO01Markers,
  detectSTO01TriggerMarkers,
  detectSTO01SafetyFlags,
  evaluateSTO01,
  resetSTO01SessionState,
  updateSTO01SessionState,
  getSTO01SessionState,
  updateSTO01Progress,
  createDefaultSTO01Progress,
} from '../engine/elias/stoicism';
import type { STO01Output, STO01Progress } from '../engine/elias/stoicism';
import { runEliasAdvancedModules, hasAdvancedModuleMarkers } from '../engine/elias/advanced-modules';
import type { EliasAdvancedModulesResult } from '../engine/elias/advanced-modules';
import { runEliasAdvancedModulesP2, hasAdvancedModuleP2Markers } from '../engine/elias/advanced-modules-p2';
import type { EliasAdvancedP2Result } from '../engine/elias/advanced-modules-p2';
import { runEliasAdvancedModulesP3 } from '../engine/elias/advanced-modules-p3';
import type { EliasAdvancedP3Result } from '../engine/elias/advanced-modules-p3';
import { runEliasAdvancedP4 } from '../engine/elias/advanced-modules-p4';
import type { EliasP4Result } from '../engine/elias/advanced-modules-p4';
import { runKimSLAAP01 } from '../engine/kim/kim-slaap01-module';
import type { KimSLAAP01Result } from '../engine/kim/kim-slaap01-module';
import { runKimAdvancedP2 } from '../engine/kim/kim-advanced-modules-p2';
import type { KimAdvancedP2Result } from '../engine/kim/kim-advanced-modules-p2';
import { runKimAdvancedP3 } from '../engine/kim/kim-advanced-modules-p3';
import type { KimAdvancedP3Result } from '../engine/kim/kim-advanced-modules-p3';
import { runKimAdvancedP4 } from '../engine/kim/kim-advanced-modules-p4';
import type { KimAdvancedP4Result } from '../engine/kim/kim-advanced-modules-p4';
import { runKimAdvancedP5 } from '../engine/kim/kim-advanced-modules-p5';
import type { KimAdvancedP5Result } from '../engine/kim/kim-advanced-modules-p5';
import { runKimAdvancedP6 } from '../engine/kim/kim-advanced-modules-p6';
import type { KimAdvancedP6Result } from '../engine/kim/kim-advanced-modules-p6';
import { runKimAdvancedP7 } from '../engine/kim/kim-advanced-modules-p7';
import type { KimAdvancedP7Result } from '../engine/kim/kim-advanced-modules-p7';
import { runKimAdvancedModulesP8 } from '../engine/kim/kim-advanced-modules-p8';
import type { KimP8Result } from '../engine/kim/kim-advanced-modules-p8';
import { runKimAdvancedP9 } from '../engine/kim/kim-advanced-modules-p9';
import type { KimP9Result } from '../engine/kim/kim-advanced-modules-p9';
import { runKimAdvancedP10 } from '../engine/kim/kim-advanced-modules-p10';
import type { KimP10Result } from '../engine/kim/kim-advanced-modules-p10';
import { detectISO01Signals } from '../engine/elias/short-module-detector';
import {
  evaluateModuleMemoryRepeat,
  buildModuleMemoryPromptContext,
  createDefaultModuleMemoryState,
} from '../engine/shared/module-memory-cross-session';
import type { ModuleMemoryState, ModuleMemoryDecisionResult, ModuleMemoryPromptContext } from '../engine/shared/module-memory-cross-session';
import {
  getEliasModuleMemorySessionState,
  resetEliasModuleMemorySessionState,
  recordEliasModuleActivation,
  setEliasModuleMemoryDecision,
  buildEliasModuleMemoryPatch,
  applyEliasModuleMemoryPatch,
} from '../engine/elias/elias-module-memory';
import {
  getKimModuleMemorySessionState,
  resetKimModuleMemorySessionState,
  recordKimModuleActivation,
  setKimModuleMemoryDecision,
  buildKimModuleMemoryPatch,
  applyKimModuleMemoryPatch,
} from '../engine/kim/kim-module-memory';
import { applyAutoConfirmation, detectUserAcknowledgment, detectClinicalAcknowledgment, applyUserAcknowledgment, applyClinicalAcknowledgment } from '../engine/shared/tendency-confirmation';
import { runVspInsightLayer, type VspInsightPipelineResult } from '../../src/features/vspInsight/vspInsightPipelineLayer';
import { runVspIntakeAdapters } from '../../src/features/vspInsight/vspIntakeAdapters';
import { detectWilskracht01 } from '../../src/modules/elias/WILSKRACHT01/detector';
import { detectAutopilot01 } from '../../src/modules/elias/AUTOPILOT01/detector';
import type { EliasPsychoEducationRuntimeInput, EliasPsychoEducationDetectionResult } from '../../src/types/eliasPsychoEducation.types';
import type { PsychoEducationActivation } from '../types/memory/memoryCore.types';
import { searchPastReferences } from '../pipeline/memory/pastReferenceSearch';
import { buildDetectionBundle, runMemoryWriteBack, getSessionLifecycleManager, type PipelineResultForMemory } from '../pipeline/memory/memoryIntegration';
import { LocalDeviceTimeService } from "@/lib/core/time";
import { isServerEngineActive, callServerEngine, type ServerEngineCallInput } from '@/lib/migration';
import { getApiBaseUrl } from '@/constants/oauth';
import { callNanoInterpret, type ClientNanoInterpretResult } from '@/lib/pipeline/nano-interpret-client';

// ─── Pattern Marking (post-GPT local state) ─────────────────

/**
 * Concrete pattern signal tracked per message.
 * Accumulates across the session; only promoted to user.dat at session end
 * if threshold is reached.
 */
export interface PatternSignal {
  /** The signal/trigger/pattern identifier */
  signal: string;
  /** Number of times this pattern was observed in this session */
  repeatCount: number;
  /** Timestamp of first observation */
  firstSeen: string;
  /** Timestamp of last observation */
  lastSeen: string;
  /** Whether this signal was already promoted in a previous session */
  previouslyPromoted: boolean;
  /** Cooldown: earliest time this signal can be promoted again */
  cooldownUntil: string | null;
}

/** Promotion threshold: pattern must repeat >= 3 times (local within-device memory) */
const PROMOTION_THRESHOLD = 3;
/** Cooldown: same pattern cannot be promoted again within 24 hours */
const PROMOTION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ─── Session-level state (module-scoped, resets per session) ──

let sessionBuffer: BufferState | null = null;
let sessionPatternSignals: PatternSignal[] = [];
let sessionDominantState: DominantState | null = null;
let sessionWasCrisis = false;
let sessionDominantModuleChanged = false;
let sessionInitialModule: string | null = null;
let sessionRelationalConfidence = 0;
let sessionLastRegulationResult: RegulationResult | null = null;
let sessionEliasDecision: EliasDecision | null = null;
let sessionKimDecision: KimDecision | null = null;

/**
 * Reset all session-level state. Call at session start.
 */
export function resetSessionState(): void {
  sessionBuffer = null;
  sessionPatternSignals = [];
  sessionDominantState = null;
  sessionWasCrisis = false;
  sessionDominantModuleChanged = false;
  sessionInitialModule = null;
  sessionRelationalConfidence = 0;
  sessionLastRegulationResult = null;
  sessionEliasDecision = null;
  sessionKimDecision = null;
  resetTriggerDecay();
  resetSessionCost();
  resetInterventionState();
  resetProjectionState();
  resetKimProjectionState();
  resetProjectionSessionTracking();
  resetDeepeningState();
  resetStoaSessionState();
  resetSchemaModeSessionState();
  resetACTSessionState();
  resetCBTSessionState();
  resetDGTSessionState();
  resetMBTSessionState();
  resetKO1SessionState();
  resetK05SessionState();
  resetK02SessionState();
  resetK04SessionState();
  resetK04S4SessionState();
  resetK06SessionState();
  resetK01SessionState();
  resetK03SessionState();
  resetSW01SessionState();
  resetSTO01SessionState();
  resetEliasModuleMemorySessionState();
  resetKimModuleMemorySessionState();
}

// ─── Pipeline Result ────────────────────────────────────────────

export interface PipelineResult {
  /** The AI-generated response text */
  response: string;
  /** The state analysis that drove this response */
  analysis?: StateAnalysis;
  /** Updated Rugzak after processing (composed view) */
  updatedRugzak?: Rugzak;
  /** Updated UserDat after processing (for persistence) */
  updatedUserDat: UserDat;
  /** Crisis level (0 = none, 1 = elevated, 2 = active crisis) */
  crisisLevel: number;
  /** Whether emergency card should be shown */
  showEmergency: boolean;
  /** Pre-GPT dominant state used for this response */
  dominantState?: DominantState;
  /** Active module activations from P2/P3/P4 with confidence and mode */
  moduleActivations: { id: string; confidence: number; mode: string }[];
  /** K06 stabilization status */
  k06Status: string;
  /** Whether crisis protocol is currently active */
  crisisProtocolActive: boolean;
  /** Buffer snapshot sent to GPT */
  bufferSnapshot?: BufferSnapshot;
  /** Post-GPT log entry */
  messageLog?: MessageLog;
  /**
   * Pipeline status. Defaults to 'OK' for normal flow.
   * 'BLOCKED_PRECHAT_REQUIRED' = VSP not submitted, chat cannot start.
   * 'CRISIS_MODE' = PAARS/severity 5, crisis directive issued.
   */
  status?: 'OK' | 'BLOCKED_PRECHAT_REQUIRED' | 'CRISIS_MODE';
  /** Whether pipeline was blocked (VSP not submitted). */
  isBlocked?: boolean;
  /** Reason for blocking. */
  blockReason?: string;
  /** Full engine trace data for debug logging */
  traceData?: import('@/lib/debug/engine-trace').EngineTraceInput;
  /** Raw candidate signals from SignalEngine (fears/hopes/goals/triggers) */
  candidateSignals?: { fears: any[]; hopes: any[]; goals: any[]; triggers: any[] } | null;
  /** Raw schema/mode detection result */
  schemaModeResult?: { activated: boolean; modeDecision: any; schemaDecision: any } | null;
  /** PsychoEducation activation result (WILSKRACHT01/AUTOPILOT01) */
  psychoEducationActivation?: PsychoEducationActivation | null;
  /** Steunpilaren activation result (PAAL01) */
  paal01Activation?: { moduleId: 'PAAL01'; triggerContext: string; confidence: number; matchedMarkers: string[] } | null;
  /** Self-acceptance cluster activation (BLIK01/ONTK01/IKST01/COEX01) */
  selfAcceptanceActivation?: { moduleId: 'BLIK01' | 'ONTK01' | 'IKST01' | 'COEX01'; confidence: number; matchedMarkers: string[]; interventionType: string; patternType?: string } | null;
  kimPatternSupportActivation?: { moduleId: 'PAAL-K01' | 'BEHE-K01' | 'AANP-K01' | 'CODEP-K01'; confidence: number; matchedMarkers: string[]; interventionType: string } | null;
}

/** Consolidated log entry for each message exchange */
export interface MessageLog {
  timestamp: string;
  messageIndex: number;
  preGPT: {
    triggerDecayApplied: boolean;
    zoneDecay: { applied: number; types: string[]; reason: string };
    dominantState: DominantState;
    selectedTriggers: Array<{ trigger: string; score: number }>;
    bufferZoneScore: number;
    bufferZoneColor: string;
    regulation: {
      action: string;
      zone: string;
      effectiveDepth: string;
      wasSoftened: boolean;
      wasSkipped: boolean;
      hasIntervention: boolean;
    };
  };
  gpt: {
    selectedModel?: string;
    tokenUsage?: TokenUsage;
    responseLength: number;
  };
  postGPT: {
    updatedZoneScore: number;
    updatedZoneColor: string;
    patternSignalsMarked: string[];
    promotionCandidates: number;
    promotionDecisions: string[];
  };
}

// ─── Pipeline ───────────────────────────────────────────────────

/**
 * Process a single user message through the complete dual-processing pipeline.
 *
 * PRE-GPT: decay → buffer update → zone decay → dominant state → snapshot → GPT
 * POST-GPT: state update → pattern marking → logging
 *
 * ZERO second GPT calls. All state updates are local.
 */
export async function processMessage(
  rugzakOrBackpack: Rugzak | Backpack,
  userMessage: string,
  provider: AIProvider,
  userDat?: UserDat,
  options?: { isSessionStart?: boolean; diaryEntries?: import('../ai/types').DiaryEntry[]; logsSessions?: import('../types/memory/logsDat.types').SessionLogSummary[]; locale?: 'nl' | 'en' | 'fr'; country?: 'NL' | 'BE' | 'FR' | 'UK' | 'US'; dayStructureContext?: string | null }
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
      intakeContext: { stageOfChange: ELIAS_DEFAULT_STAGE, ...rugzak.intakeContext },
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
      stageOfChange: ELIAS_DEFAULT_STAGE,
      gratitudeStreak: 0,
      lastGratitudeDate: null,
      sobrietyDate: null,
      lastMilestoneShown: null,
      clinicalModeActive: false,
      consecutiveSessionsWithoutEngagement: 0,
    };
  }

  const isSessionStart = options?.isSessionStart ?? false;

  // ── STEP 0: CONTEXT AWARENESS (non-blocking) ──
  // Pipeline NEVER blocks. If context is minimal, we still proceed to GPT
  // but flag it so the system prompt can adapt tone accordingly.
  const hasSliders = currentUserDat.currentMood &&
    Object.values(currentUserDat.currentMood).some((v) => typeof v === 'number' && v !== 0 && v !== 5);
  const hasBackpackContent = backpack.sections &&
    backpack.sections.some((s) => s.content && s.content.trim().length > 10);
  const hasDiary = (options?.diaryEntries ?? []).length > 0;
  const hasTriggerHistory = (currentUserDat.triggerPatterns ?? []).length > 0;
  const hasSessionHistory = (currentUserDat.totalSessions ?? 0) > 0;
  const hasVsp = backpack.userType === 'elias' && currentUserDat.currentMood && 'vsp' in currentUserDat.currentMood && (currentUserDat.currentMood as import('../ai/types').EliasMoodSliders).vsp != null;
  const hasEigenRegie = backpack.userType === 'kim' && currentUserDat.currentMood && 'eigenRegie' in currentUserDat.currentMood && (currentUserDat.currentMood as import('../ai/types').KimMoodSliders).eigenRegie != null;
  const hasMinimalContext = hasSliders || hasBackpackContent || hasDiary || hasTriggerHistory || hasSessionHistory || hasVsp || hasEigenRegie;
  // Note: hasMinimalContext is used downstream for tone adaptation but NEVER blocks the pipeline.

  // ══════════════════════════════════════════════════════════════
  // SERVER-LED ENGINE (Checkpoint G)
  // When server engine is active, skip the entire client pipeline.
  // The server does: buffer, decay, dominant state, regulation, signal engine, GPT.
  // On failure: graceful degradation to client pipeline below.
  // ══════════════════════════════════════════════════════════════
  let serverNanoInterpretData: any = null;
  if (isServerEngineActive()) {
    try {
      // Build conversation history (last 20 messages)
      const conversationHistory = (currentUserDat.chatHistory || []).slice(-20).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Build mood sliders payload
      const moodSliders: Record<string, number | null> = {};
      if (currentUserDat.currentMood) {
        for (const [key, val] of Object.entries(currentUserDat.currentMood)) {
          moodSliders[key] = typeof val === 'number' ? val : null;
        }
      }

      // Build VSP section for Elias
      const vspSection = backpack.userType === 'elias' && currentUserDat.currentMood && 'vsp' in currentUserDat.currentMood
        ? {
            level: (currentUserDat.currentMood as any).vsp ?? 'GROEN',
            score: (currentUserDat.currentMood as any).vspScore ?? 0,
            lastUpdated: LocalDeviceTimeService.now().utcIso,
            source: 'slider' as const,
          }
        : null;

      // Build logs sessions (last 5)
      const logsSessions = (options?.logsSessions ?? []).slice(-5).map(s => ({
        sessionId: (s as any).sessionId ?? 'unknown',
        startedAt: (s as any).startedAt ?? (s as any).createdAt ?? '',
        endedAt: (s as any).endedAt ?? '',
        compressedNarrative: (s as any).compressedNarrative ?? '',
        discussedTopics: (s as any).discussedTopics ?? [],
        emotionalThemes: (s as any).emotionalThemes ?? [],
        openEndpoints: (s as any).openEndpoints ?? [],
        moduleTrace: (s as any).moduleTrace ?? [],
        zoneTrace: (s as any).zoneTrace ?? [],
      }));

      // Build server engine input
      const serverInput: ServerEngineCallInput = {
        persona: backpack.userType as 'elias' | 'kim',
        userName: backpack.naam || 'Gebruiker',
        locale: options?.locale ?? 'nl',
        country: options?.country ?? 'BE',
        guidanceDepth: (backpack.intakeContext as any)?.guidanceDepth ?? 'normal',
        clinicalModeActive: currentUserDat.clinicalModeActive ?? false,
        localUserId: 'local_user',
        userMessage,
        conversationHistory,
        moodSliders,
        isSessionStart,
        vspSection,
        logsSessions,
        userDatSummary: {
          totalSessions: currentUserDat.totalSessions ?? 0,
          lastSessionDate: currentUserDat.lastSessionDate ?? null,
          currentMood: moodSliders,
          moodHistory: (currentUserDat.moodHistory ?? []).slice(-7).map(m => ({
            date: (m as any).date ?? '',
            sliders: (m as any).sliders ?? {},
          })),
          triggerPatterns: (currentUserDat.triggerPatterns ?? []).slice(0, 10).map(t => ({
            trigger: t.trigger,
            frequency: (t as any).frequency ?? t.count ?? 1,
            lastSeen: (t as any).lastSeen ?? '',
          })),
          moduleUsage: (currentUserDat.moduleUsage ?? []).slice(0, 10).map(m => ({
            moduleId: m.moduleId,
            count: m.count,
            lastUsed: (m as any).lastUsed ?? '',
          })),
          stageOfChange: currentUserDat.stageOfChange ?? backpack.intakeContext?.stageOfChange ?? 'contemplation',
          clinicalModeActive: currentUserDat.clinicalModeActive ?? false,
          guidanceDepth: (currentUserDat as any).guidanceDepth ?? (backpack.intakeContext as any)?.guidanceDepth ?? 'normal',
        },
        usedModules: sessionBuffer?.usedModules ?? [],
        previousZoneScore: sessionBuffer?.currentZoneScore ?? 0,
        messageCount: sessionBuffer?.messageCount ?? 0,
        sessionStartedAtIso: LocalDeviceTimeService.now().utcIso,
        apiBaseUrl: getApiBaseUrl(),
        backpack: backpack,
        userDat: currentUserDat,
        diaryEntries: options?.diaryEntries ?? [],
        dayStructureContext: options?.dayStructureContext ?? null,
      };

      const serverResult = await callServerEngine(serverInput);

      // Store server nanoInterpret for use in client pipeline trace (even if GPT response is null)
      if (serverResult.success && serverResult.nanoInterpret) {
        serverNanoInterpretData = serverResult.nanoInterpret;
      }

      // Apply server patches whenever server succeeds (regardless of GPT response)
      if (serverResult.success && serverResult.patches) {
        const p = serverResult.patches;
        if (p.sessionState) {
          if (sessionBuffer) {
            sessionBuffer.currentZoneScore = p.sessionState.zoneScore;
            sessionBuffer.currentZoneColor = p.sessionState.zoneColor as any;
            sessionBuffer.usedModules = p.sessionState.usedModules;
            sessionBuffer.messageCount = (sessionBuffer.messageCount ?? 0) + 1;
          }
          sessionDominantState = {
            dominantModule: p.sessionState.dominantModule,
            dominantTrigger: '',
            dominantDirection: (p.sessionState.responseDirection || 'reflect') as any,
            dominantTone: 'warm',
            riskScore: p.safety?.crisisLevel ? p.safety.crisisLevel * 30 : 0,
            selectionReason: 'server-engine',
            sourceLayer: 'default',
          };
        }
      }

      if (serverResult.success && serverResult.responseText) {
        const finalResponseText = serverResult.responseText;
        // Build updated chatHistory with user + AI messages
        const nowIso = LocalDeviceTimeService.now().utcIso;
        const userMsg: ChatMessage = {
          id: `msg_user_${Date.now()}`,
          role: 'user',
          content: userMessage,
          timestamp: nowIso,
        };
        const aiMsg: ChatMessage = {
          id: `msg_ai_${Date.now() + 1}`,
          role: 'assistant',
          content: finalResponseText,
          timestamp: nowIso,
        };
        const updatedChatHistory = [...(currentUserDat.chatHistory || []), userMsg, aiMsg];
        const updatedUserDat: UserDat = {
          ...currentUserDat,
          chatHistory: updatedChatHistory,
        };

        // Apply state patches from server
        if (serverResult.patches) {
          const p = serverResult.patches;
          if (p.sessionState) {
            if (sessionBuffer) {
              sessionBuffer.currentZoneScore = p.sessionState.zoneScore;
              sessionBuffer.currentZoneColor = p.sessionState.zoneColor as any;
              sessionBuffer.usedModules = p.sessionState.usedModules;
              sessionBuffer.messageCount = (sessionBuffer.messageCount ?? 0) + 1;
            }
            sessionDominantState = {
              dominantModule: p.sessionState.dominantModule,
              dominantTrigger: '',
              dominantDirection: (p.sessionState.responseDirection || 'reflect') as any,
              dominantTone: 'warm',
              riskScore: p.safety?.crisisLevel ? p.safety.crisisLevel * 30 : 0,
              selectionReason: 'server-engine',
              sourceLayer: 'default',
            };
          }
        }

        const crisisLevel = serverResult.patches?.safety?.crisisLevel ?? 0;
        const showEmergency = serverResult.patches?.safety?.showEmergency ?? false;

        // ── MEMORY WRITE-BACK (per-turn) ──────────────────────────────────
        // Routes server detections (fears/hopes/triggers/zone/module) to
        // user.dat / state.dat / projections.dat via the existing write-back system.
        let memoryWriteBackChangedFields: string[] = [];
        try {
          const lifecycleMgr = getSessionLifecycleManager();
          const memStores = lifecycleMgr.getStores();
          const persona = backpack.userType as 'elias' | 'kim';
          const memUserDat = await memStores.userDatStore.load(persona, 'local_user');
          const memStateDat = await memStores.stateDatStore.load(persona);
          const memProjectionsDat = await memStores.projectionsDatStore.load(persona);
          const memBuffer = memStores.sessionBufferStore.getBuffer();

          // Build PipelineResultForMemory from server detections
          const pipelineResultForMemory: PipelineResultForMemory = {
            userMessage,
            persona,
            sessionId: serverResult.sessionId || `session_${Date.now()}`,
            localUserId: 'local_user',
            candidateSignals: serverResult.signalDetections
              ? {
                  fears: serverResult.signalDetections.fears.map(f => ({ label: f.keyword, confidence: f.confidence })),
                  hopes: serverResult.signalDetections.hopes.map(h => ({ label: h.keyword, confidence: h.confidence })),
                  goals: [],
                  triggers: serverResult.signalDetections.triggers.map(t => ({ label: t.keyword, confidence: t.confidence, triggerType: 'craving' })),
                }
              : null,
            schemaModeResult: null, // Not available server-side (schema/mode engine is client-only)
            bufferSnapshot: serverResult.patches?.sessionState
              ? { zoneColor: serverResult.patches.sessionState.zoneColor, zoneScore: serverResult.patches.sessionState.zoneScore }
              : null,
            activeModule: serverResult.patches?.sessionState?.dominantModule
              ? { moduleId: serverResult.patches.sessionState.dominantModule, confidence: 0.9, responseMode: serverResult.patches.sessionState.regulationAction || 'reflect' }
              : null,
            moodSliders: moodSliders as Record<string, number> | null,
          };

          // Build detection bundle and run write-back
          const detectionBundle = buildDetectionBundle(pipelineResultForMemory);
          const currentSnapshot = { userDat: memUserDat, stateDat: memStateDat, projectionsDat: memProjectionsDat, sessionBuffer: memBuffer };
          const writeBackOutput = runMemoryWriteBack(detectionBundle, currentSnapshot);

          // Persist updated stores
          if (writeBackOutput.commitResult.writtenPatches.length > 0) {
            await memStores.userDatStore.save(writeBackOutput.updatedStores.userDat);
            await memStores.stateDatStore.save(writeBackOutput.updatedStores.stateDat);
            await memStores.projectionsDatStore.save(writeBackOutput.updatedStores.projectionsDat);
          }

          // Capture changed fields for debug output
          memoryWriteBackChangedFields = writeBackOutput.commitResult.changedFields;

          // Append turn snapshot to session buffer
          if (memBuffer) {
            memStores.sessionBufferStore.appendTurnSnapshot(memBuffer, {
              turnId: serverResult.turnId || `turn_${Date.now()}`,
              timestampIso: nowIso,
              inputHash: userMessage.slice(0, 20),
              outputHash: (serverResult.responseText || '').slice(0, 20),
              detectedCounts: {
                fears: detectionBundle.fears.length,
                hopes: detectionBundle.hopes.length,
                triggers: detectionBundle.triggers.length,
                schemaTendencies: detectionBundle.schemaTendencies.length,
                modeTendencies: detectionBundle.modeTendencies.length,
              },
              changedFields: memoryWriteBackChangedFields,
            });
          }

          console.log(`[Pipeline/Server] Memory write-back: ${writeBackOutput.commitResult.writtenPatches.length} patches written, fields=[${memoryWriteBackChangedFields.join(', ')}]`);
        } catch (memErr) {
          // Non-critical: pipeline continues even if write-back fails
          console.warn('[Pipeline/Server] Memory write-back failed (non-critical):', memErr);
        }

        // ── Build trace block for server mode ──────────────────────────────
        const serverTraceData: import('@/lib/debug/engine-trace').EngineTraceInput = {
          messageIndex: sessionBuffer?.messageCount ?? 1,
          timestamp: nowIso,
          userMessage,
          pipelineSteps: [
            { step: '1. ServerEngine', status: 'passed' as const, reason: `latency=${serverResult.latencyMs}ms` },
            { step: '2. MemoryWriteBack', status: memoryWriteBackChangedFields.length > 0 ? 'passed' as const : 'skipped' as const, reason: `fields=${memoryWriteBackChangedFields.length}` },
          ],
          zoneDecision: {
            vspInput: null,
            vspSeverity: null,
            computedZone: serverResult.patches?.sessionState?.zoneColor ?? 'GREEN',
            computedSeverity: serverResult.patches?.sessionState?.zoneScore ?? 0,
            finalZone: serverResult.patches?.sessionState?.zoneColor ?? 'GREEN',
            source: 'server-engine',
            reason: 'server-led zone decision',
            isBlocked: false,
            isCrisis: crisisLevel >= 2,
          },
          regulation: {
            action: serverResult.patches?.sessionState?.regulationAction ?? 'none',
            effectiveDepth: 'normal',
            userDepth: 'normal',
            wasSoftened: serverResult.patches?.sessionState?.regulationWasSoftened ?? false,
            wasSkipped: false,
            gptInstruction: null,
            resolvedZoneInput: serverResult.patches?.sessionState?.zoneColor ?? 'GREEN',
            isFallbackZone: false,
          },
          moduleSelection: {
            dominantModule: serverResult.patches?.sessionState?.dominantModule ?? 'E01',
            reason: 'server-engine',
            activeModules: serverResult.patches?.sessionState?.usedModules ?? [],
          },
          modelRouting: {
            selectedModel: 'server-engine',
            riskScore: crisisLevel * 30,
            crisisLevel,
            routingReason: 'server-led',
          },
          interventionContinuity: null,
          projectionEntries: [],
          nanoInterpret: serverResult.nanoInterpret ?? null,
          memory: {
            totalSessions: currentUserDat.totalSessions ?? 0,
            triggerPatterns: (currentUserDat.triggerPatterns || []).map(t => ({ trigger: t.trigger, count: (t as any).count ?? (t as any).frequency ?? 1 })),
            moduleUsage: (currentUserDat.moduleUsage || []).map(m => ({ moduleId: m.moduleId, count: (m as any).count ?? (m as any).usageCount ?? 1 })),
            changedUserDatFields: memoryWriteBackChangedFields.filter(f => f.startsWith('user.')),
            sliders: (currentUserDat.currentMood || {}) as unknown as Record<string, string | number>,
            changedStateFields: memoryWriteBackChangedFields.filter(f => f.startsWith('state.')),
            bufferZone: serverResult.patches?.sessionState?.zoneColor ?? 'GREEN',
            bufferEmotionalDirection: serverResult.patches?.sessionState?.responseDirection ?? 'reflect',
            bufferLiveIntent: serverResult.patches?.sessionState?.emotionalState ?? '',
            bufferDominantState: `${serverResult.patches?.sessionState?.dominantModule ?? 'E01'} (server)`,
          },
          contextDat: null,
          payload: {
            isSessionStart,
            fieldsIncluded: ['serverEngine', 'signalDetections', 'statePatches', 'memoryWriteBack'],
            promptBlocks: { serverMode: 'true', memoryWriteBack: memoryWriteBackChangedFields.length > 0 ? 'yes' : 'no' },
            estimatedTokens: 0,
            usedModel: 'server-engine',
          },
          tokens: null,
          routeStatus: [
            { step: 'server-engine', route: 'sandbox' as const, status: 'succes' as const, detail: 'full server engine path' },
          ],
        };
        buildTraceBlock(serverTraceData);

        // Build MessageLog for chat.tsx debug panel
        const serverMessageLog: MessageLog = {
          timestamp: nowIso,
          messageIndex: sessionBuffer?.messageCount ?? 1,
          preGPT: {
            triggerDecayApplied: false,
            zoneDecay: { applied: 0, types: [], reason: 'server-led' },
            dominantState: sessionDominantState ?? {
              dominantModule: 'E01',
              dominantTrigger: '',
              dominantDirection: 'reflect',
              dominantTone: 'warm',
              riskScore: 0,
              selectionReason: 'server-engine',
              sourceLayer: 'default',
            },
            selectedTriggers: [],
            bufferZoneScore: serverResult.patches?.sessionState?.zoneScore ?? 0,
            bufferZoneColor: serverResult.patches?.sessionState?.zoneColor ?? 'GREEN',
            regulation: {
              action: serverResult.patches?.sessionState?.regulationAction ?? 'none',
              zone: serverResult.patches?.sessionState?.zoneColor ?? 'GREEN',
              effectiveDepth: 'normal',
              wasSoftened: serverResult.patches?.sessionState?.regulationWasSoftened ?? false,
              wasSkipped: false,
              hasIntervention: false,
            },
          },
          gpt: {
            selectedModel: 'server-engine',
            responseLength: (serverResult.responseText || '').length,
          },
          postGPT: {
            updatedZoneScore: serverResult.patches?.sessionState?.zoneScore ?? 0,
            updatedZoneColor: serverResult.patches?.sessionState?.zoneColor ?? 'GREEN',
            patternSignalsMarked: [],
            promotionCandidates: 0,
            promotionDecisions: [],
          },
        };

        return {
          response: finalResponseText,
          updatedUserDat,
          updatedRugzak: composeRugzak(backpack, updatedUserDat),
          crisisLevel,
          showEmergency,
          dominantState: sessionDominantState ?? undefined,
          moduleActivations: [],
          k06Status: 'NOT_RUN',
          crisisProtocolActive: crisisLevel >= 2,
          status: crisisLevel >= 2 ? 'CRISIS_MODE' : 'OK',
          isBlocked: false,
          candidateSignals: null,
          schemaModeResult: null,
          psychoEducationActivation: null,
          paal01Activation: null,
          selfAcceptanceActivation: null,
          kimPatternSupportActivation: null,
          messageLog: serverMessageLog,
        };
      }

      // Server call succeeded but no GPT response, or failed entirely — fall through to client pipeline
      // serverNanoInterpretData is preserved for use in the client pipeline trace below
      if (!serverResult.success) {
        console.warn('[Pipeline] Server engine call failed, falling back to client pipeline:', serverResult.error);
      } else {
        console.log('[Pipeline] Server engine OK but no GPT response — using client pipeline with server nanoInterpret');
      }
    } catch (serverErr) {
      console.warn('[Pipeline] Server engine exception, falling back to client pipeline:', serverErr);
    }
  }


  // ══════════════════════════════════════════════════════════════
  // PRE-GPT FLOW (all local, deterministic)
  // ══════════════════════════════════════════════════════════════

  // ── PRE-GPT STEP 1: Apply trigger decay to PREVIOUS buffer state ──
  // Decay runs on the old state BEFORE the new message is merged.
  // This prevents new matches from resetting/distorting decay too early.
  const triggerDecayApplied = sessionBuffer !== null && sessionBuffer.messageCount > 0;
  // Note: trigger decay is module-level state in backpack-relevance-analyzer.
  // It runs automatically inside scoreTrigger() when analyzeBackpackRelevance is called.
  // We call it here on the PREVIOUS buffer's trigger guess to advance decay counters
  // BEFORE the new message updates the buffer.
  if (triggerDecayApplied && sessionBuffer) {
    // Pre-advance decay counters for all known triggers by running a "dry" relevance pass
    // on the previous buffer state. This ensures decay is computed on the old state.
    analyzeBackpackRelevance(
      '', // empty message = no new matches, only decay advances
      backpack,
      currentUserDat,
      currentUserDat.currentMood || (ELIAS_DEFAULT_MOOD as any),
      sessionDominantState?.dominantModule || (backpack.userType === 'elias' ? ELIAS_DEFAULT_MODULE : KIM_DEFAULT_MODULE),
    );
  }

  // ── PRE-GPT STEP 2: Update ShortTermMemoryBuffer with new message ──
  // Buffer update happens AFTER decay, so new message data merges into decayed state.
  const allMessages = [...(currentUserDat.chatHistory || []), {
    id: `msg_${LocalDeviceTimeService.now().epochMs}`,
    role: 'user' as const,
    content: userMessage,
    timestamp: LocalDeviceTimeService.now().utcIso,
  }];
  const previousZoneColor = sessionBuffer?.currentZoneColor ?? null;
  sessionBuffer = updateBuffer(
    sessionBuffer,
    userMessage,
    allMessages,
    currentUserDat.currentMood || (ELIAS_DEFAULT_MOOD as any),
    backpack.userType,
  );

  // ── Zone shift detection (debug logging) ──
  if (previousZoneColor && previousZoneColor !== sessionBuffer.currentZoneColor) {
    logDebugEvent('zone_shift', {
      from: previousZoneColor,
      to: sessionBuffer.currentZoneColor,
      reason: `score ${sessionBuffer.previousZoneScore} → ${sessionBuffer.currentZoneScore}`,
    });
  }

  // ── PRE-GPT STEP 3: Apply RegulationDecayEngine zone decay ──
  // Zone decay runs AFTER buffer update (uses new zone score context).
  const zoneDecayResult: DecayResult = applyDecay(sessionBuffer);
  if (zoneDecayResult.decayApplied !== 0) {
    sessionBuffer = applyDecayToBuffer(sessionBuffer, zoneDecayResult);
  }

  // ── PRE-GPT STEP 3b: Language Recovery Analysis ──
  // Detects diminishing negative intensity in user language (NOT positive statements).
  // If detected, reduces the corresponding projection signal score by 0.5.
  const languageRecoveryResult = analyzeLanguageRecovery(userMessage, backpack.userType);
  if (languageRecoveryResult.detected) {
    console.log(`[Pipeline] LANGUAGE_RECOVERY: theme="${languageRecoveryResult.theme}", delta=${languageRecoveryResult.delta}`);
  }

  // ── PRE-GPT STEP 4: Analyze state + Select DominantState ──
  const analysis = analyzeState(rugzak, userMessage);

  // Run backpack relevance with the ACTUAL new message (after decay was pre-advanced)
  const relevance = analyzeBackpackRelevance(
    userMessage,
    backpack,
    currentUserDat,
    currentUserDat.currentMood || (ELIAS_DEFAULT_MOOD as any),
    analysis.priorityModules[0] || (backpack.userType === 'elias' ? ELIAS_DEFAULT_MODULE : KIM_DEFAULT_MODULE),
  );

  // ── PRE-GPT STEP 3b: Nano-Interpret pre-call (semantic module selection via Railway proxy) ──
  // Calls gpt-4.1-nano to interpret the user message semantically.
  // On success: overrides the dominant module from selectDominantState.
  // On failure: falls back to keyword-based detection (existing behavior).
  let clientNanoResult: ClientNanoInterpretResult | null = null;
  const isCrisisForNano = sessionBuffer?.currentZoneColor === 'PURPLE' || sessionBuffer?.currentIntent === 'crisis';
  if (!isCrisisForNano) {
    clientNanoResult = await callNanoInterpret(userMessage, backpack.userType as 'elias' | 'kim');
    if (clientNanoResult) {
      console.log(`[Pipeline] NANO-INTERPRET: resolvedModule=${clientNanoResult.resolvedModule}, matchedTheme=${clientNanoResult.matchedTheme}, intent=${clientNanoResult.intent}, themes=[${clientNanoResult.themes.join(', ')}]`);
      // Store for trace
      serverNanoInterpretData = clientNanoResult;
    } else {
      console.warn('[Pipeline] NANO-INTERPRET: unavailable, falling back to keyword matching');
    }
  } else {
    console.log('[Pipeline] NANO-INTERPRET: skipped (crisis mode)');
  }

  // Select dominant state (pre-GPT decision variable — NOT reselected after GPT)
  // Build VSP context for module selection: active zone + what helps for that zone
  const earlyMood = currentUserDat.currentMood || (ELIAS_DEFAULT_MOOD as any);
  const earlyVspLevel: string | null = backpack.userType === 'elias' && 'vsp' in earlyMood
    ? (earlyMood as import('../ai/types').EliasMoodSliders).vsp
    : null;
  let vspWhatHelps: string | null = null;
  if (earlyVspLevel && backpack.vspSection?.zones) {
    const zoneMap: Record<string, keyof typeof backpack.vspSection.zones> = {
      'GROEN': 'green', 'GREEN': 'green',
      'GEEL': 'yellow', 'YELLOW': 'yellow',
      'ORANJE': 'orange', 'ORANGE': 'orange',
      'ROOD': 'red', 'RED': 'red',
      'PAARS': 'purple', 'PURPLE': 'purple',
    };
    const zoneKey = zoneMap[earlyVspLevel.toUpperCase()];
    if (zoneKey && backpack.vspSection.zones[zoneKey]) {
      vspWhatHelps = backpack.vspSection.zones[zoneKey].whatHelps || null;
    }
  }

  let preGPTDominantState = selectDominantState(
    sessionBuffer,
    analysis,
    currentUserDat.currentMood || (ELIAS_DEFAULT_MOOD as any),
    backpack.userType,
    currentUserDat.triggerPatterns || [],
    analysis.priorityModules,
    backpack.userType === 'elias' ? { vspLevel: earlyVspLevel, whatHelps: vspWhatHelps, userMessage } : undefined,
    clientNanoResult ?? undefined,
  );


  // ── LOOPBLOCKER: Per-session module repetition detection ──
  // If the selected module was already used in this session (and it's not a crisis),
  // try to select the next available module from the priority list.
  const usedModules = sessionBuffer.usedModules ?? [];
  if (
    usedModules.includes(preGPTDominantState.dominantModule) &&
    preGPTDominantState.sourceLayer !== 'crisis'
  ) {
    const allModules = backpack.userType === 'elias'
      ? ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08']
      : ['K01', 'K02', 'K03', 'K04', 'K05', 'K06'];
    const availableFromPriority = analysis.priorityModules.filter(
      (m) => !usedModules.includes(m)
    );
    const fallback = allModules.find(
      (m) => !usedModules.includes(m)
    );
    const alternativeModule = availableFromPriority[0] || fallback || preGPTDominantState.dominantModule;
    if (alternativeModule !== preGPTDominantState.dominantModule) {
      console.log(`[Pipeline] LOOPBLOCKER: Module "${preGPTDominantState.dominantModule}" already used in session. Switching to "${alternativeModule}"`);
      preGPTDominantState = {
        ...preGPTDominantState,
        dominantModule: alternativeModule,
        selectionReason: `Loopblocker: "${preGPTDominantState.dominantModule}" already used → fallback to "${alternativeModule}"`,
      };
    }
  }

  // ── MID-SESSION RE-EVALUATION: Dynamic module switching based on conversation progression ──
  // After 3+ messages, check if the user's intensity trajectory warrants a module switch.
  // This allows therapy approach to evolve as the conversation progresses.
  if (sessionBuffer.messageCount >= 3 && backpack.userType === 'elias') {
    const trajectory = sessionBuffer.intensityTrajectory;
    const currentModule = preGPTDominantState.dominantModule;
    const isGroundingModule = ['E05', 'E01', 'E_CRISIS'].includes(currentModule);
    const isExplorationModule = ['E02', 'E03', 'E04', 'E06', 'E07', 'E08'].includes(currentModule);

    // User is stabilizing (falling intensity) → switch from grounding to deeper exploration
    if (trajectory === 'falling' && isGroundingModule && currentModule !== 'E_CRISIS') {
      const deeperModules = ['E02', 'E04', 'E06', 'E08'].filter(m => !usedModules.includes(m));
      if (deeperModules.length > 0) {
        const newModule = deeperModules[0];
        console.log(`[Pipeline] MID-SESSION RE-EVAL: Trajectory falling + grounding module → switching to deeper module "${newModule}"`);
        preGPTDominantState = {
          ...preGPTDominantState,
          dominantModule: newModule,
          selectionReason: `Mid-session re-eval: user stabilizing (trajectory=falling), switching from grounding (${currentModule}) to exploration (${newModule})`,
        };
      }
    }
    // User is escalating (rising intensity) → switch from exploration to grounding/stabilization
    else if (trajectory === 'rising' && isExplorationModule) {
      const groundingModules = ['E05', 'E01'].filter(m => !usedModules.includes(m));
      const newModule = groundingModules[0] || 'E05'; // E05 (Mindfulness & Grounding) as fallback
      console.log(`[Pipeline] MID-SESSION RE-EVAL: Trajectory rising + exploration module → switching to grounding "${newModule}"`);
      preGPTDominantState = {
        ...preGPTDominantState,
        dominantModule: newModule,
        selectionReason: `Mid-session re-eval: user escalating (trajectory=rising), switching from exploration (${currentModule}) to grounding (${newModule})`,
      };
    }
  }

  sessionDominantState = preGPTDominantState;

  // Track module changes for promotion evaluation
  if (sessionInitialModule === null) {
    sessionInitialModule = preGPTDominantState.dominantModule;
  } else if (preGPTDominantState.dominantModule !== sessionInitialModule) {
    sessionDominantModuleChanged = true;
  }

  // ── PRE-GPT STEP 5: Build stable BufferSnapshot ──
  const dominantStateForSnapshot = {
    dominantModule: preGPTDominantState.dominantModule,
    dominantTrigger: preGPTDominantState.dominantTrigger,
    dominantDirection: preGPTDominantState.dominantDirection,
    dominantTone: preGPTDominantState.dominantTone,
    riskScore: preGPTDominantState.riskScore,
    selectionReason: preGPTDominantState.selectionReason,
    sourceLayer: preGPTDominantState.sourceLayer,
  };
  const bufferSnapshot = getBufferSnapshot(
    sessionBuffer,
    dominantStateForSnapshot,
    relevance.triggers,
  );

  // ── PRE-GPT STEP 5b: Regulation Layer (moved below — runs after engine decision) ──
  const userGuidanceDepth = currentUserDat.guidanceDepth ?? 'normal';

  // ── PRE-GPT STEP 5d: Projection Layer (signal detection + injection) ──
  // Runs after backpack-relevance-analyzer (5c), before GPT call.
  // Detects future-facing signals (fears, hopes, goals) from message + sliders.
  const currentMood = currentUserDat.currentMood || (ELIAS_DEFAULT_MOOD as any);
  const vspLevel: string | null = backpack.userType === 'elias' && 'vsp' in currentMood
    ? (currentMood as import('../ai/types').EliasMoodSliders).vsp
    : null;
  const eigenRegieScore: number | null = backpack.userType === 'kim' && 'eigenRegie' in currentMood
    ? (currentMood as import('../ai/types').KimMoodSliders).eigenRegie
    : null;
  const distressScore = backpack.userType === 'elias'
    ? eliasDistressScore(currentMood as any)
    : kimDistressScore(currentMood as any);
  const resilienceScore = backpack.userType === 'elias'
    ? eliasResilienceScore(currentMood as any)
    : kimResilienceScore(currentMood as any);
  // Zone improvement: compare current zone score with previous (lower = improved)
  const zoneImproved = sessionBuffer.previousZoneScore > sessionBuffer.currentZoneScore;
  // Consecutive green sessions: count from session analyses
  const recentAnalyses = currentUserDat.sessionAnalyses || [];
  let consecutiveGreenSessions = 0;
  for (let i = recentAnalyses.length - 1; i >= 0; i--) {
    if ((recentAnalyses[i] as any).endZoneColor === 'GREEN' || (recentAnalyses[i] as any).endZoneColor === 'GROEN') {
      consecutiveGreenSessions++;
    } else break;
  }
  // Consecutive high Eigen Regie sessions (Kim only)
  let consecutiveHighRegieSessions = 0;
  if (backpack.userType === 'kim') {
    for (let i = recentAnalyses.length - 1; i >= 0; i--) {
      if ((recentAnalyses[i] as any).endEigenRegieScore > 70) {
        consecutiveHighRegieSessions++;
      } else break;
    }
  }

  const projectionResult: ProjectionResult = runProjectionLayer({
    userType: backpack.userType,
    message: userMessage,
    dominantModule: preGPTDominantState.dominantModule,
    vspLevel,
    distressScore,
    resilienceScore,
    consecutiveGreenSessions,
    zoneImproved,
    eigenRegieScore,
    consecutiveHighRegieSessions,
  });

  if (projectionResult.hasActiveEntries || projectionResult.newEntriesCount > 0) {
    console.log(`[Pipeline] Projection: active=${projectionResult.hasActiveEntries}, new=${projectionResult.newEntriesCount}, deepening=${!!projectionResult.deepeningDirective}`);
  }

  // ── PRE-GPT STEP 5e1: RETP Router (Elias only, emotion→intervention routing) ──
  // NOTE: RETP runs before Schema/Mode, so activeMode uses previous session's dominant mode if available
  let retpResult: RetpRouterResult = { activated: false, primaryEmotion: null, themes: [], suggestedStoaSessionIds: [], reason: 'not_elias' };
  if (backpack.userType === 'elias') {
    retpResult = routeRetp({
      message: userMessage,
      zoneColor: sessionBuffer.currentZoneColor.toUpperCase(),
      crisisLevel: analysis.riskLevel === 'critical' || analysis.riskLevel === 'high' ? 2 : analysis.riskLevel === 'moderate' ? 1 : 0,
      emotionalState: analysis.emotionalState,
      activeMode: (currentUserDat.modeTendencies ?? []).length > 0
        ? currentUserDat.modeTendencies![0].modeId
        : null,
      distressScore,
      candidateSignals: undefined,
    });
    if (retpResult.activated) {
      console.log(`[Pipeline] RETP: emotion=${retpResult.primaryEmotion} | stoaSuggestions=[${retpResult.suggestedStoaSessionIds.join(',')}]`);
    }
  }

  // ── PRE-GPT STEP 5e2: STOA Engine (Elias only, deterministic) ──
  let stoaResult: StoaEngineResult = { activated: false, selectedSession: null, injectionBlock: null, reason: 'not_elias' };
  if (backpack.userType === 'elias') {
    const activeProjections: Array<{ category: string; content: string; strength: number }> = (() => {
      try {
        const ps = getProjectionState();
        return ps.entries.filter((e: ProjectionEntry) => e.isActive).map((e: ProjectionEntry) => ({
          category: e.category as string,
          content: e.content,
          strength: e.strength as unknown as number,
        }));
      } catch { return []; }
    })();

    stoaResult = selectStoaSession({
      message: userMessage,
      zoneColor: sessionBuffer.currentZoneColor.toUpperCase(),
      vspLevel,
      dominantModule: preGPTDominantState.dominantModule,
      distressScore,
      activeProjections,
      candidateSignals: undefined, // Will be filled after signal engine if available
      retpSuggestedSessionIds: retpResult.suggestedStoaSessionIds,
      stoaSessionsUsed: currentUserDat.stoaSessionsUsed ?? [],
      currentSessionNumber: currentUserDat.totalSessions ?? 0,
    });

    if (stoaResult.activated) {
      console.log(`[Pipeline] STOA: session=${stoaResult.selectedSession?.id} | reason=${stoaResult.reason}`);
    }
  }

  // ── PRE-GPT STEP 5f: Schema/Mode Engine (deterministic, both user types) ──
  let schemaModeResult: SchemaModeEngineResult = {
    modeDecision: { acceptedModes: [], rejectedModes: [], dominantMode: null, modeConflict: false, reason: 'not_run', promptSummary: '' },
    schemaDecision: { acceptedSchemas: [], rejectedSchemas: [], dominantSchema: null, dominantDomain: null, safeToExplore: true, promptSummary: '' },
    promptInjection: '',
    activated: false,
    sessionActivatedModes: [],
    sessionActivatedSchemas: [],
  };
  {
    const smActiveProjections: Array<{ category: string; content: string; strength: number }> = (() => {
      try {
        const ps = getProjectionState();
        return ps.entries.filter((e: ProjectionEntry) => e.isActive).map((e: ProjectionEntry) => ({
          category: e.category as string,
          content: e.content,
          strength: e.strength as unknown as number,
        }));
      } catch { return []; }
    })();

    schemaModeResult = runSchemaModeEngine({
      message: userMessage,
      userType: backpack.userType,
      zoneColor: sessionBuffer.currentZoneColor.toUpperCase(),
      vspLevel: vspLevel ?? null,
      sliders: currentUserDat.currentMood as unknown as Record<string, number>,
      activeProjections: smActiveProjections,
      modeTendencies: (currentUserDat.modeTendencies ?? []).map((t: any) => ({ modeId: t.modeId, frequency: t.observationCount ?? t.frequency ?? 0, lastSeen: t.lastSeenAt ?? t.lastSeen ?? '' })),
      schemaTendencies: (currentUserDat.schemaTendencies ?? []).map((t: any) => ({ schemaId: t.schemaId, frequency: t.observationCount ?? t.frequency ?? 0, lastSeen: t.lastSeenAt ?? t.lastSeen ?? '' })),
      isCrisis: analysis.riskLevel === 'critical' || analysis.riskLevel === 'high',
      messageCount: sessionBuffer.messageCount,
    });

    if (schemaModeResult.activated) {
      console.log(`[Pipeline] SchemaMode: dominant_mode=${schemaModeResult.modeDecision.dominantMode} | dominant_schema=${schemaModeResult.schemaDecision.dominantSchema} | safe=${schemaModeResult.schemaDecision.safeToExplore}`);
    }
  }

  // ── PRE-GPT STEP 5f.2: Schema/Mode Acknowledgment Detection ──
  {
    // Check if user message acknowledges a schema/mode that was presented last turn
    const lastMode = sessionBuffer.lastPresentedMode;
    const lastSchema = sessionBuffer.lastPresentedSchema;
    if ((lastMode || lastSchema) && detectUserAcknowledgment(userMessage)) {
      const now = new Date().toISOString();
      if (lastMode && currentUserDat.modeTendencies) {
        const { tendencies: updatedModes, result: ackResult } = applyUserAcknowledgment(
          currentUserDat.modeTendencies as any,
          'modeId',
          lastMode,
          now,
        );
        if (ackResult?.newlyAcknowledged) {
          currentUserDat = { ...currentUserDat, modeTendencies: updatedModes as any };
          console.log(`[Pipeline] UserAck: mode=${lastMode} | triggered_confirm=${ackResult.triggeredConfirmation}`);
        }
      }
      if (lastSchema && currentUserDat.schemaTendencies) {
        const { tendencies: updatedSchemas, result: ackResult } = applyUserAcknowledgment(
          currentUserDat.schemaTendencies as any,
          'schemaId',
          lastSchema,
          now,
        );
        if (ackResult?.newlyAcknowledged) {
          currentUserDat = { ...currentUserDat, schemaTendencies: updatedSchemas as any };
          console.log(`[Pipeline] UserAck: schema=${lastSchema} | triggered_confirm=${ackResult.triggeredConfirmation}`);
        }
      }
    }
    // Clinical mode acknowledgment
    if ((currentUserDat as any).clinicalModeActive && detectClinicalAcknowledgment(userMessage)) {
      const now = new Date().toISOString();
      const activeMode = schemaModeResult.modeDecision.dominantMode;
      const activeSchema = schemaModeResult.schemaDecision.dominantSchema;
      if (activeMode && currentUserDat.modeTendencies) {
        const { tendencies: updatedModes, result: ackResult } = applyClinicalAcknowledgment(
          currentUserDat.modeTendencies as any,
          'modeId',
          activeMode,
          now,
        );
        if (ackResult?.newlyAcknowledged) {
          currentUserDat = { ...currentUserDat, modeTendencies: updatedModes as any };
          console.log(`[Pipeline] ClinicalAck: mode=${activeMode} | triggered_confirm=${ackResult.triggeredConfirmation}`);
        }
      }
      if (activeSchema && currentUserDat.schemaTendencies) {
        const { tendencies: updatedSchemas, result: ackResult } = applyClinicalAcknowledgment(
          currentUserDat.schemaTendencies as any,
          'schemaId',
          activeSchema,
          now,
        );
        if (ackResult?.newlyAcknowledged) {
          currentUserDat = { ...currentUserDat, schemaTendencies: updatedSchemas as any };
          console.log(`[Pipeline] ClinicalAck: schema=${activeSchema} | triggered_confirm=${ackResult.triggeredConfirmation}`);
        }
      }
    }
    // Update buffer with current turn's presented mode/schema for next-turn detection
    sessionBuffer = {
      ...sessionBuffer,
      lastPresentedMode: schemaModeResult.modeDecision.dominantMode ?? null,
      lastPresentedSchema: schemaModeResult.schemaDecision.dominantSchema ?? null,
    };
  }
  // ── PRE-GPT STEP 5g: ACT Engine (deterministic, both user types) ──
  let actResult: ACTEngineResult = {
    decision: {
      acceptedACTCandidates: [],
      rejectedACTCandidates: [],
      dominantProcess: null,
      dominantSignal: null,
      safeToUseACT: false,
      reason: 'not_run',
      promptSummary: '',
    },
    promptBlock: '',
    activated: false,
  };
  {
    const actCrisisLevel = analysis.riskLevel === 'critical' || analysis.riskLevel === 'high' ? 2 : analysis.riskLevel === 'moderate' ? 1 : 0;
    const actProgress: ACTProgress = (currentUserDat.actProgress as unknown as ACTProgress) ?? createDefaultACTProgress();

    actResult = routeACTEngine({
      userMessage,
      userType: backpack.userType,
      vspLevel: vspLevel ?? 'GROEN',
      eigenRegieScore: backpack.userType === 'kim' ? (currentUserDat.currentMood as any)?.eigenRegie ?? null : null,
      crisisLevel: actCrisisLevel,
      resolvedZone: sessionBuffer.currentZoneColor.toUpperCase(),
      distressScore: distressScore ?? 0,
      activeMode: schemaModeResult.modeDecision.dominantMode,
      activeSchema: schemaModeResult.schemaDecision.dominantSchema,
      candidateSignals: [],
      activeProjections: (() => {
        try {
          const ps = getProjectionState();
          return ps.entries.filter((e: ProjectionEntry) => e.isActive).map((e: ProjectionEntry) => e.content);
        } catch { return []; }
      })(),
      stageOfChange: currentUserDat.stageOfChange ?? 'CONTEMPLATION',
      guidanceDepth: (typeof currentUserDat.guidanceDepth === 'number' ? currentUserDat.guidanceDepth : 2) as number,
    }, actProgress);

    if (actResult.activated) {
      console.log(`[Pipeline] ACT: process=${actResult.decision.dominantProcess} | signal=${actResult.decision.dominantSignal} | reason=${actResult.decision.reason}`);
    }

    // Self-compassion micro-layer: always active at crisisLevel >= 2, even if ACT is suppressed
    if (actCrisisLevel >= 2 && !actResult.activated) {
      const selfCompassionFallback = [
        '\n═══ SELF-COMPASSION MICRO-LAYER (crisis fallback) ═══',
        'ACT is suppressed due to crisis level, but self-compassion remains active.',
        'Apply ONE of these in your response:',
        '- Acknowledge suffering without judgment ("This is a moment of suffering")',
        '- Normalize the experience ("Anyone in this situation would struggle")',
        '- Offer gentle presence ("You don\'t have to fix this right now")',
        'Keep it to ONE sentence. No analysis. No questions.',
        '═══ END SELF-COMPASSION MICRO-LAYER ═══',
      ].join('\n');
      actResult = {
        ...actResult,
        promptBlock: selfCompassionFallback,
        activated: true,
        decision: {
          ...actResult.decision,
          dominantProcess: 'SELF_AS_CONTEXT' as any,
          reason: 'crisis_fallback_self_compassion',
        },
      };
      console.log(`[Pipeline] ACT: self-compassion micro-layer injected (crisis fallback)`);
    }
  }

  // ── PRE-GPT STEP 5h: CBT/CGT Engine (deterministic, both user types) ──
  let cbtResult: CBTEngineResult = {
    decision: {
      acceptedCBTCandidates: [],
      rejectedCBTCandidates: [],
      dominantProcess: null,
      dominantSignal: null,
      dominantDistortion: null,
      safeToUseCBT: false,
      reason: 'not_run',
      promptSummary: '',
    },
    promptBlock: '',
    activated: false,
  };
  {
    const cbtCrisisLevel = analysis.riskLevel === 'critical' || analysis.riskLevel === 'high' ? 2 : analysis.riskLevel === 'moderate' ? 1 : 0;
    const cbtProgress: CBTProgress = (currentUserDat.cgtProgress as unknown as CBTProgress) ?? createDefaultCBTProgress();

    cbtResult = routeCBTEngine({
      userMessage,
      userType: backpack.userType,
      vspLevel: vspLevel ?? 'GROEN',
      eigenRegieScore: backpack.userType === 'kim' ? (currentUserDat.currentMood as any)?.eigenRegie ?? null : null,
      crisisLevel: cbtCrisisLevel,
      resolvedZone: sessionBuffer.currentZoneColor.toUpperCase(),
      distressScore: distressScore ?? 0,
      activeMode: schemaModeResult.modeDecision.dominantMode,
      activeSchema: schemaModeResult.schemaDecision.dominantSchema,
      activeACTProcess: actResult.decision.dominantProcess,
      activeProjections: (() => {
        try {
          const ps = getProjectionState();
          return ps.entries.filter((e: ProjectionEntry) => e.isActive).map((e: ProjectionEntry) => e.content);
        } catch { return []; }
      })(),
      stageOfChange: currentUserDat.stageOfChange ?? 'CONTEMPLATION',
      guidanceDepth: (typeof currentUserDat.guidanceDepth === 'number' ? currentUserDat.guidanceDepth : 2) as number,
    }, cbtProgress);

    if (cbtResult.activated) {
      console.log(`[Pipeline] CBT: process=${cbtResult.decision.dominantProcess} | signal=${cbtResult.decision.dominantSignal} | distortion=${cbtResult.decision.dominantDistortion} | reason=${cbtResult.decision.reason}`);
    }
  }

  // ── PRE-GPT STEP 5i: DGT/DBT Engine (deterministic, both user types) ──
  let dgtResult: DGTEngineResult = {
    decision: {
      acceptedDGTCandidates: [],
      rejectedDGTCandidates: [],
      dominantProcess: null,
      dominantSignal: null,
      selectedSkill: null,
      validationLevel: 'L5_NORMALIZATION',
      escalationStage: 'CALM',
      safeToUseDGT: false,
      ektPhase: null,
      reason: 'not_run',
      promptSummary: '',
    },
    promptBlock: '',
    activated: false,
  };
  {
    const dgtCrisisLevel = analysis.riskLevel === 'critical' || analysis.riskLevel === 'high' ? 2 : analysis.riskLevel === 'moderate' ? 1 : 0;
    const dgtProgress: DGTProgress = (currentUserDat.dgtProgress as unknown as DGTProgress) ?? createDefaultDGTProgress();

    dgtResult = routeDGTEngine({
      userMessage,
      userType: backpack.userType as 'elias' | 'kim',
      vspLevel: sessionBuffer.currentZoneColor.toUpperCase(),
      eigenRegieScore: backpack.userType === 'kim' ? (currentUserDat.currentMood as any)?.eigenRegie ?? null : null,
      crisisLevel: dgtCrisisLevel,
      resolvedZone: sessionBuffer.currentZoneColor.toUpperCase(),
      distressScore: (currentUserDat.currentMood as any)?.distress ?? 5,
      activeMode: schemaModeResult.modeDecision.dominantMode,
      activeSchema: schemaModeResult.schemaDecision.dominantSchema,
      activeACTProcess: actResult.decision.dominantProcess,
      activeCBTProcess: cbtResult.decision.dominantProcess,
      activeProjections: [],
      stageOfChange: (currentUserDat as any).stageOfChange ?? 'contemplation',
      guidanceDepth: (typeof currentUserDat.guidanceDepth === 'number' ? currentUserDat.guidanceDepth : 2) as number,
    }, dgtProgress);

    if (dgtResult.activated) {
      console.log(`[Pipeline] DGT: process=${dgtResult.decision.dominantProcess} | signal=${dgtResult.decision.dominantSignal} | skill=${dgtResult.decision.selectedSkill} | validation=${dgtResult.decision.validationLevel} | escalation=${dgtResult.decision.escalationStage} | reason=${dgtResult.decision.reason}`);
    }
  }

  // ── PRE-GPT STEP 5j: MBT++ Engine (deterministic, both user types) ──
  let mbtResult: MBTEngineResult = {
    decision: {
      acceptedMBTCandidates: [],
      rejectedMBTCandidates: [],
      dominantProcess: null,
      dominantSignal: null,
      detectedState: 'M0_STABLE_MENTALIZING',
      responseMode: 'REFLECT',
      safeToUseMBT: false,
      reason: 'not_run',
      promptSummary: '',
    },
    promptBlock: '',
    activated: false,
  };
  {
    const mbtCrisisLevel = analysis.riskLevel === 'critical' || analysis.riskLevel === 'high' ? 2 : analysis.riskLevel === 'moderate' ? 1 : 0;
    const mbtProgress: MBTProgress = (currentUserDat.mbtProgress as unknown as MBTProgress) ?? createDefaultMBTProgress();

    mbtResult = routeMBTEngine({
      userMessage,
      userType: backpack.userType as 'elias' | 'kim',
      vspLevel: sessionBuffer.currentZoneColor.toUpperCase(),
      eigenRegieScore: backpack.userType === 'kim' ? (currentUserDat.currentMood as any)?.eigenRegie ?? null : null,
      crisisLevel: mbtCrisisLevel,
      resolvedZone: sessionBuffer.currentZoneColor.toUpperCase(),
      distressScore: (currentUserDat.currentMood as any)?.distress ?? 5,
      activeMode: schemaModeResult.modeDecision.dominantMode,
      activeSchema: schemaModeResult.schemaDecision.dominantSchema,
      activeACTProcess: actResult.decision.dominantProcess,
      activeCBTProcess: cbtResult.decision.dominantProcess,
      activeDGTProcess: dgtResult.decision.dominantProcess,
      stageOfChange: (currentUserDat as any).stageOfChange ?? 'contemplation',
      guidanceDepth: (typeof currentUserDat.guidanceDepth === 'number' ? currentUserDat.guidanceDepth : 2) as number,
    }, mbtProgress);

    if (mbtResult.activated) {
      console.log(`[Pipeline] MBT: state=${mbtResult.decision.detectedState} | mode=${mbtResult.decision.responseMode} | process=${mbtResult.decision.dominantProcess} | signal=${mbtResult.decision.dominantSignal} | reason=${mbtResult.decision.reason}`);
    }
  }

  // ── PRE-GPT STEP 5k: KO1 Recognition & Validation (Kim only) ──
  let k05Result: K05EngineResult = {
    activated: false,
    decision: {
      activated: false,
      communicationMode: 'FRAMEWORK_GUIDE',
      dominantContext: null,
      timingAssessment: 'NEUTRAL',
      reason: 'not_run',
      intoxicationBlock: false,
      frameworkSuggested: false,
    },
    promptBlock: null,
  };
  let ko1Result: KO1EngineResult = {
    activated: false,
    decision: {
      activated: false,
      validationLevel: 'L1_PRESENCE',
      responseMode: 'RECOGNITION_FIRST',
      dominantPattern: null,
      reason: 'not_run',
      julesRuleActive: false,
      boundaryOverride: false,
    },
    promptBlock: null,
  };
  let k02Result: K02EngineResult = {
    activated: false,
    decision: {
      activated: false,
      interventionState: 'SOFT_AWARENESS',
      dominantFlag: null,
      awarenessLevel: 'none',
      boundaryReadiness: 'none',
      routeRecommendation: 'stay_k02',
      reason: 'not_run',
    },
    promptBlock: null,
  };
  let k04Result: K04RoutingResult = {
    activated: false,
    responseMode: 'none',
    selectedMicrotool: null,
    primaryState: 'none',
    severity: 'mild',
    failsafeActive: false,
    doNots: [],
    promptBlock: null,
  };
  let k04s4Result: K04S4RoutingResult = {
    activated: false,
    responseMode: 'none',
    primaryState: 'none',
    severity: 'mild',
    failsafeActive: false,
    doNots: [],
    promptBlock: null,
  };
  let k06Result: K06RoutingResult = {
    activated: false,
    responseMode: 'none',
    primaryState: 'none',
    guiltType: 'none',
    severity: 'mild',
    sustainabilityLevel: 'sustainable',
    failsafeActive: false,
    doNots: [],
    promptBlock: null,
  };
  let k01Result: K01RoutingResult = {
    activated: false,
    interventionType: 'boundary_education',
    primaryState: 'none',
    severity: 'mild',
    collapseRisk: false,
    boundaryStatement: null,
    doNots: [],
    promptBlock: null,
  };
  let kimAdvancedResult: KimAdvancedModulesResult = {
    kst01Active: false, kdl01Active: false, kbr01Active: false, ksc01Active: false,
    kst01PromptBlock: null, kdl01PromptBlock: null, kbr01PromptBlock: null, ksc01PromptBlock: null,
    routeTarget: 'NO_MODULE', kst01StoragePatch: {}, kdl01StoragePatch: {}, kbr01StoragePatch: {}, ksc01StoragePatch: {},
  };
  if (backpack.userType === 'kim') {
    const ko1Progress: KO1Progress = (currentUserDat as any).ko1Progress ?? createDefaultKO1Progress();
    const frustrationScore = (currentUserDat.currentMood as any)?.frustration ?? 3;
    const hasChildren = !!(currentUserDat as any).hasChildren;

    ko1Result = routeKO1Engine({
      message: userMessage,
      userType: backpack.userType,
      vspLevel: sessionBuffer.currentZoneColor.toUpperCase(),
      crisisLevel: analysis.riskLevel === 'critical' || analysis.riskLevel === 'high' ? 2 : analysis.riskLevel === 'moderate' ? 1 : 0,
      frustrationScore,
      eigenRegieScore: (currentUserDat.currentMood as any)?.eigenRegie ?? null,
      hasChildren,
      sessionMessageCount: sessionBuffer.messageCount,
    }, ko1Progress);

    if (ko1Result.activated) {
      console.log(`[Pipeline] KO1: pattern=${ko1Result.decision.dominantPattern} | level=${ko1Result.decision.validationLevel} | mode=${ko1Result.decision.responseMode} | jules=${ko1Result.decision.julesRuleActive} | boundary=${ko1Result.decision.boundaryOverride}`);
    }

    // ── STEP 5l: K05 Communication Skills (Kim only) ──
    const k05Progress: K05Progress = (currentUserDat as any).k05Progress ?? createDefaultK05Progress();

    k05Result = routeK05Engine({
      message: userMessage,
      userType: backpack.userType,
      vspLevel: sessionBuffer.currentZoneColor.toUpperCase(),
      crisisLevel: analysis.riskLevel === 'critical' || analysis.riskLevel === 'high' ? 2 : analysis.riskLevel === 'moderate' ? 1 : 0,
      frustrationScore,
      eigenRegieScore: (currentUserDat.currentMood as any)?.eigenRegie ?? null,
      sessionMessageCount: sessionBuffer.messageCount,
    }, k05Progress);

    if (k05Result.activated) {
      console.log(`[Pipeline] K05: context=${k05Result.decision.dominantContext} | mode=${k05Result.decision.communicationMode} | timing=${k05Result.decision.timingAssessment} | intoxBlock=${k05Result.decision.intoxicationBlock}`);
    }

    // ── STEP 5m: K02 Enabling Awareness (Kim only) ──
    const k02Progress: K02Progress = (currentUserDat as any).k02Progress ?? createDefaultK02Progress();

    k02Result = routeK02Engine({
      message: userMessage,
      userType: backpack.userType,
      eigenRegieScore: (currentUserDat.currentMood as any)?.eigenRegie ?? null,
      crisisLevel: analysis.riskLevel === 'critical' || analysis.riskLevel === 'high' ? 2 : analysis.riskLevel === 'moderate' ? 1 : 0,
      stressScore: frustrationScore,
      boundaryFatigueScore: Math.min(10, frustrationScore + (sessionBuffer.messageCount > 10 ? 2 : 0)),
      emotionalBurdenScore: Math.min(10, frustrationScore + (analysis.riskLevel === 'moderate' ? 2 : analysis.riskLevel === 'high' ? 4 : 0)),
      sessionMessageCount: sessionBuffer.messageCount,
    }, k02Progress);

    if (k02Result.activated) {
      console.log(`[Pipeline] K02: flag=${k02Result.decision.dominantFlag} | state=${k02Result.decision.interventionState} | route=${k02Result.decision.routeRecommendation}`);
    }

    // ── Step 5n: K04 Emotional Regulation for Caregivers (Kim only) ──
    const k04Detection = detectK04EmotionalState(userMessage, sessionBuffer.recentMessages.slice(-3).map(m => m.content));
    const k04Progress: K04Progress | undefined = (currentUserDat as any).k04Progress;
    k04Result = routeK04Engine(k04Detection, k04Progress);

    if (k04Result.activated) {
      console.log(`[Pipeline] K04: state=${k04Result.primaryState} | severity=${k04Result.severity} | mode=${k04Result.responseMode} | microtool=${k04Result.selectedMicrotool}`);
    }

    // ── Step 5o: K04-S4 Betrayal, Trust, Hope & Self-Protection (Kim only) ──
    const k04s4Detection = detectK04S4State(userMessage, sessionBuffer.recentMessages.slice(-3).map(m => m.content));
    const k04s4Progress: K04S4Progress | undefined = (currentUserDat as any).k04s4Progress;
    k04s4Result = routeK04S4Engine(k04s4Detection, k04s4Progress);

    if (k04s4Result.activated) {
      console.log(`[Pipeline] K04-S4: state=${k04s4Result.primaryState} | severity=${k04s4Result.severity} | mode=${k04s4Result.responseMode}`);
    }

    // ── Step 5p: K06 Self-Care & Sustainable Support (Kim only) ──
    const k06Detection = detectK06State(userMessage, sessionBuffer.recentMessages.slice(-3).map(m => m.content));
    const k06Progress: K06Progress | undefined = (currentUserDat as any).k06Progress;
    k06Result = routeK06Engine(k06Detection, k06Progress);

    if (k06Result.activated) {
      console.log(`[Pipeline] K06: state=${k06Result.primaryState} | severity=${k06Result.severity} | mode=${k06Result.responseMode} | sustainability=${k06Result.sustainabilityLevel}`);
    }

    // ── Step 5p2: Kim Advanced Modules (KST01 → KDL01/KBR01/KSC01) ──
    kimAdvancedResult = runKimAdvancedModules({
      userType: backpack.userType as 'elias' | 'kim',
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      crisisLevel: analysis.riskLevel === 'critical' || analysis.riskLevel === 'high' ? 2 : analysis.riskLevel === 'moderate' ? 1 : 0,
      k06SafetyGate: k06Result.activated ? 'cleared' : 'not_run',
      stabilizationStatus: k06Result.activated ? 'stable' : 'unknown',
      caregiverShameLevel: (currentUserDat.currentMood as any)?.caregiverShame ?? 0,
      guiltLevel: (currentUserDat.currentMood as any)?.guilt ?? 0,
      boundaryReadinessLevel: (currentUserDat.currentMood as any)?.boundaryReadiness ?? 0,
      selfLossLevel: (currentUserDat.currentMood as any)?.selfLoss ?? 0,
      angerShameLevel: (currentUserDat.currentMood as any)?.angerShame ?? 0,
      restGuiltLevel: (currentUserDat.currentMood as any)?.restGuilt ?? 0,
      kst01Storage: (currentUserDat as any).kst01Storage,
      kdl01Storage: (currentUserDat as any).kdl01Storage,
      kbr01Storage: (currentUserDat as any).kbr01Storage,
      ksc01Storage: (currentUserDat as any).ksc01Storage,
    });

    if (kimAdvancedResult.kst01Active || kimAdvancedResult.kdl01Active || kimAdvancedResult.kbr01Active || kimAdvancedResult.ksc01Active) {
      console.log(`[Pipeline] KimAdvanced: KST01=${kimAdvancedResult.kst01Active} | KDL01=${kimAdvancedResult.kdl01Active} | KBR01=${kimAdvancedResult.kbr01Active} | KSC01=${kimAdvancedResult.ksc01Active} | route=${kimAdvancedResult.routeTarget}`);
    }

    // ── Step 5q: K01 Boundary Setting (Kim only, default module) ──
    const k01Detection = detectK01BoundaryState(userMessage, sessionBuffer.recentMessages.slice(-3).map(m => m.content));
    const k01Progress: K01Progress | undefined = (currentUserDat as any).k01Progress;
    const boundaryFatigueSlider = (currentUserDat.currentMood as any)?.boundaryFatigue ?? 3;
    k01Result = routeK01Engine(k01Detection, boundaryFatigueSlider, k01Progress);

    if (k01Result.activated) {
      console.log(`[Pipeline] K01: state=${k01Result.primaryState} | severity=${k01Result.severity} | intervention=${k01Result.interventionType} | collapse=${k01Result.collapseRisk}`);
    }
  }

  // ── Step 5r: K03 Self-Care With Shadow Layer (Elias + Kim) ──
  let k03Result: K03RoutingResult = {
    activated: false,
    interventionMode: 'none',
    responseLevel: 'level_1',
    severity: 'low',
    ektPhase: 'none',
    primaryShadowPart: 'none',
    doNots: [],
    promptBlock: null,
  };
  const selfCareSlider = (currentUserDat.currentMood as any)?.selfCare ?? 5;
  if (selfCareSlider <= 3) {
    const cravingValue = (currentUserDat.currentMood as any)?.craving ?? 0;
    const moodValue = (currentUserDat.currentMood as any)?.mood ?? 5;
    const k03Detection = detectK03State(
      userMessage,
      selfCareSlider,
      cravingValue,
      moodValue,
      sessionBuffer.recentMessages.slice(-3).map(m => m.content),
    );
    const k03Progress: K03Progress | undefined = (currentUserDat as any).k03Progress;
    k03Result = routeK03Engine(k03Detection, k03Progress, backpack.userType as 'elias' | 'kim');

    if (k03Result.activated) {
      console.log(`[Pipeline] K03: mode=${k03Result.interventionMode} | level=${k03Result.responseLevel} | severity=${k03Result.severity} | shadow=${k03Result.primaryShadowPart} | ekt=${k03Result.ektPhase}`);
    }
  }

  // ── Step 5e3: SW01 Shadow Work (Elias only) ──
  let sw01Result: SW01EngineResult = {
    active: false,
    confidence: 0,
    signals: [],
    zuchtState: { zucht_value: 0, zucht_color: 'green', allowed_depth: 'reflection', intervention_style: 'warm_direct' },
    interventionMode: 'journal_prompt',
    activeLoop: null,
    projectionActive: false,
    promptBlock: '',
    journalPrompt: '',
  };
  if (backpack.userType === 'elias' && hasShadowMarkers(userMessage)) {
    // Map zone score (0-100) to zucht value (0-10): higher zone = higher zucht
    const zuchtValue = Math.round(sessionBuffer.currentZoneScore / 10);
    const zuchtState = routeZuchtShadow(zuchtValue);
    const detection = detectShadowSignals(
      userMessage,
      'chat',
      zuchtValue >= 8,
      [] // behavioural flags from future detection
    );
    const signal = buildShadowSignal(detection, 'chat', zuchtValue);
    const signals = signal ? [signal] : [];
    const hasRelapsed = (currentUserDat as any).relapseActive === true;

    if (detection.confidence >= 0.4) {
      sw01Result = computeSW01Directive(signals, zuchtState, userMessage, hasRelapsed);
      updateSW01SessionState(sw01Result);
      console.log(`[Pipeline] SW01: mode=${sw01Result.interventionMode} | confidence=${sw01Result.confidence.toFixed(2)} | loop=${sw01Result.activeLoop?.loop_id ?? 'none'} | projection=${sw01Result.projectionActive}`);
    }
  }

  // ── Step 5e4: STO01 Stoicism Integration (Elias only, after SW01) ──
  let sto01Result: STO01Output = {
    routingDecision: { activate: false, reason: 'Not evaluated' },
    generatedInstruction: {
      moduleId: 'STO01',
      active: false,
      selectedPrinciples: [],
      selectedIntervention: null,
      gptPromptBlock: '',
      forbiddenOutputs: [],
      requiredResponsePattern: [],
      safetyOverride: false,
    },
    pipelineContinue: true,
    nextPipelineStep: 'GENERAL_RESPONSE_SYNTHESIS',
  };
  if (backpack.userType === 'elias' && hasSTO01Markers(userMessage)) {
    const triggerMarkers = detectSTO01TriggerMarkers(userMessage);
    const safetyFlags = detectSTO01SafetyFlags(userMessage);
    const hasRelapsed = (currentUserDat as any).relapseActive === true;

    const sto01Input = {
      moduleId: 'STO01' as const,
      pipelinePosition: '5e4' as const,
      userInput: userMessage,
      language: 'en',
      triggerMarkers,
      safety: safetyFlags,
      recoveryContext: {
        userRole: 'person_in_recovery' as const,
        recentRelapse: hasRelapsed,
        externalConflictPresent: triggerMarkers.externalCauseFixation,
        caregiverImpactPresent: false,
      },
      shadowWorkContext: {
        sw01Executed: sw01Result.active,
        projectionDetected: sw01Result.projectionActive,
        avoidanceDetected: false,
        intellectualizationDetected: false,
        shameCoreActivated: false,
        shadowWorkRecommendedButNotPrimary: sw01Result.active && sw01Result.confidence < 0.6,
      },
    };

    sto01Result = evaluateSTO01(sto01Input);

    if (sto01Result.generatedInstruction.active) {
      const decision = sto01Result.routingDecision;
      updateSTO01SessionState(
        decision.primaryPrinciple!,
        decision.interventionType!,
        decision.activationStrength!,
      );
      console.log(`[Pipeline] STO01: principle=${decision.primaryPrinciple} | intervention=${decision.interventionType} | strength=${decision.activationStrength}`);
    }
  }

  // ── Step 5e5: Elias Advanced Modules (VERGV01 / IGH01 / AGC01 / HWK01) ──
  let eliasAdvancedResult: EliasAdvancedModulesResult = {
    vergv01Active: false, igh01Active: false, agc01Active: false, hwk01Active: false,
    vergv01PromptBlock: null, igh01PromptBlock: null, agc01PromptBlock: null, hwk01PromptBlock: null,
    primaryModule: 'NONE', confidence: 0,
  };
  if (hasAdvancedModuleMarkers(userMessage)) {
    eliasAdvancedResult = runEliasAdvancedModules({
      userType: backpack.userType as 'elias' | 'kim',
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      crisisLevel: analysis.riskLevel === 'critical' || analysis.riskLevel === 'high' ? 2 : analysis.riskLevel === 'moderate' ? 1 : 0,
      intakeCompleted: !!(backpack as any).intake?.startEmotion,
      shameLevel: (currentUserDat.currentMood as any)?.shame ?? 0,
      guiltLevel: (currentUserDat.currentMood as any)?.guilt ?? 0,
      hopelessnessLevel: (currentUserDat.currentMood as any)?.hopelessness ?? 0,
      relapseActive: (currentUserDat as any).relapseActive === true,
    });
  }

  // ── Step 5e6: Elias Advanced Modules P2 (FALE01 / VERG01 / ROUW01 / IDEN01 / ZINK01) ──
  let eliasAdvancedP2Result: EliasAdvancedP2Result = {
    fale01Active: false, verg01Active: false, rouw01Active: false, iden01Active: false, zink01Active: false,
    fale01PromptBlock: null, verg01PromptBlock: null, rouw01PromptBlock: null, iden01PromptBlock: null, zink01PromptBlock: null,
    primaryModule: 'NONE', confidence: 0,
  };
  if (hasAdvancedModuleP2Markers(userMessage)) {
    eliasAdvancedP2Result = runEliasAdvancedModulesP2({
      userType: backpack.userType as 'elias' | 'kim',
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      crisisLevel: analysis.riskLevel === 'critical' || analysis.riskLevel === 'high' ? 2 : analysis.riskLevel === 'moderate' ? 1 : 0,
      intakeCompleted: !!(backpack as any).intake?.startEmotion,
      relapseActive: (currentUserDat as any).relapseActive === true,
      shameLevel: (currentUserDat.currentMood as any)?.shame ?? 0,
      guiltLevel: (currentUserDat.currentMood as any)?.guilt ?? 0,
      griefLevel: (currentUserDat.currentMood as any)?.grief ?? 0,
    });
  }

  // ── PRE-GPT STEP 5e7: Elias Advanced Modules P3 (TERV01 + MI02) ──
  let eliasAdvancedP3Result: EliasAdvancedP3Result = {
    terv01Active: false, mi02Active: false,
    terv01PromptBlock: null, mi02PromptBlock: null,
    primaryModule: 'NONE', confidence: 0, responseMode: null,
  };
  if (backpack.userType === 'elias' && !!(backpack as any).intake?.startEmotion) {
    eliasAdvancedP3Result = runEliasAdvancedModulesP3({
      userType: backpack.userType as 'elias' | 'kim',
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      crisisLevel: analysis.riskLevel === 'critical' || analysis.riskLevel === 'high' ? 2 : analysis.riskLevel === 'moderate' ? 1 : 0,
      intakeCompleted: !!(backpack as any).intake?.startEmotion,
      currentZone: (currentUserDat as any).currentZone ?? 'UNKNOWN',
      previousZone: (currentUserDat as any).previousZone ?? 'UNKNOWN',
      previousSessionEnded: (currentUserDat as any).previousSessionEnded ?? false,
      previousSessionId: (currentUserDat as any).previousSessionId ?? null,
      stabilizationCompleted: (currentUserDat as any).stabilizationCompleted ?? false,
      relapseConfirmed: (currentUserDat as any).relapseActive === true,
      relapseLikely: (currentUserDat as any).relapseLikely === true,
      userRegulationLevel: (currentUserDat as any).regulationLevel ?? 0.5,
      shameIntensity: (currentUserDat.currentMood as any)?.shame ?? 0,
      medicalRisk: (currentUserDat as any).medicalRisk ?? 0,
      safetyRisk: analysis.riskLevel === 'critical' ? 0.9 : analysis.riskLevel === 'high' ? 0.7 : 0.1,
      chainDataCompleteness: (currentUserDat as any).chainDataCompleteness ?? 0,
      triggerKnown: (currentUserDat as any).triggerKnown ?? false,
      thoughtKnown: (currentUserDat as any).thoughtKnown ?? false,
      feelingKnown: (currentUserDat as any).feelingKnown ?? false,
      behaviorKnown: (currentUserDat as any).behaviorKnown ?? false,
      usePointKnown: (currentUserDat as any).usePointKnown ?? false,
      directAmbivalenceMarker: (currentUserDat as any).directAmbivalenceMarker ?? false,
      changeTalkPresent: (currentUserDat as any).changeTalkPresent ?? false,
      sustainTalkPresent: (currentUserDat as any).sustainTalkPresent ?? false,
      adviceResistance: (currentUserDat as any).adviceResistance ?? false,
      externalMotivationDominant: (currentUserDat as any).externalMotivationDominant ?? false,
      readinessScoreAvailable: (currentUserDat as any).readinessScore != null,
      readinessScore: (currentUserDat as any).readinessScore,
      sessionMixedSignalsCount: (currentUserDat as any).sessionMixedSignalsCount ?? 0,
      mi01PreviouslyActive: (currentUserDat as any).mi01PreviouslyActive ?? false,
      cravingIntensity: (currentUserDat.currentMood as any)?.craving ?? 0,
    });
  }

  // ── STEP 5e8: Elias Advanced P4 — SLAAP01 ──
  let eliasP4Result: EliasP4Result = {
    slaap01Active: false,
    slaap01Context: null,
    slaap01ResponseMode: null,
    slaap01RouteNext: null,
    slaap01StoragePatch: null,
  };
  if (backpack.userType === 'elias' && !!(backpack as any).intake?.startEmotion) {
    eliasP4Result = runEliasAdvancedP4({
      persona: 'elias',
      intakeCompleted: true,
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      language: (currentUserDat as any).detectedLanguage ?? 'nl',
      detectedMarkers: (currentUserDat as any).detectedMarkers ?? [],
      crisisProtocolStatus: analysis.riskLevel === 'critical' ? 'ACTIVE' : analysis.riskLevel === 'high' ? 'MONITOR' : 'CLEAR',
      medicalRisk: (currentUserDat as any).medicalRisk ?? 0,
      safetyRisk: analysis.riskLevel === 'critical' ? 0.9 : analysis.riskLevel === 'high' ? 0.7 : 0.1,
      sleepProblemDetected: (currentUserDat as any).sleepProblemDetected ?? false,
      sleepAnxietyDetected: (currentUserDat as any).sleepAnxietyDetected ?? false,
      nightCravingDetected: (currentUserDat as any).nightCravingDetected ?? false,
      cravingIntensity: (currentUserDat.currentMood as any)?.craving ?? 0,
      fatigueRelapseTriggerDetected: (currentUserDat as any).fatigueRelapseTriggerDetected ?? false,
      withdrawalSleepConcern: (currentUserDat as any).withdrawalSleepConcern ?? false,
      withdrawalRisk: (currentUserDat as any).withdrawalRisk ?? 0,
      paarsZoneActive: (currentUserDat as any).currentZone === 'PAARS',
      relapseRecentlyOccurred: (currentUserDat as any).relapseActive === true,
      timestampIso: LocalDeviceTimeService.now().utcIso,
    });
  }

  // ── STEP 5e8a2: Elias PsychoEducation (WILSKRACHT01/AUTOPILOT01) ──
  let psychoEducationActivation: PsychoEducationActivation | null = null;
  if (backpack.userType === 'elias' && !!(backpack as any).intake?.startEmotion) {
    const recentTexts = sessionBuffer.recentMessages.slice(-3).map(m => m.content);
    const cravingSlider = (currentUserDat.currentMood as any)?.craving ?? null;
    const peRuntimeInput: EliasPsychoEducationRuntimeInput = {
      persona: 'elias',
      intakeCompleted: true,
      latestUserMessage: userMessage,
      recentMessages: recentTexts,
      language: ((currentUserDat as any).detectedLanguage ?? 'nl') as 'nl' | 'en' | 'mixed' | 'unknown',
      detectedMarkers: (currentUserDat as any).detectedMarkers ?? [],
      crisisProtocolActive: analysis.riskLevel === 'critical' || analysis.riskLevel === 'high',
      suicideSelfHarmDetected: analysis.riskLevel === 'critical',
      acuteDangerDetected: analysis.riskLevel === 'critical',
      severeIntoxicationDetected: false,
      relapseIntentDetected: (currentUserDat as any).relapseActive === true,
      cravingDetected: typeof cravingSlider === 'number' && cravingSlider >= 4,
      relapseRecentlyOccurred: (currentUserDat as any).relapseActive === true,
      selfBlameDetected: /(?:mijn schuld|eigen schuld|ik ben zwak|gefaald|had sterker|my fault|i.?m weak|failed)/i.test(userMessage),
      willpowerLanguageDetected: /(?:wilskracht|doorzettingsvermogen|karakter|discipline|willpower|self.?control)/i.test(userMessage),
      autopilotLanguageDetected: /(?:autopilot|automatisch|vanzelf|zonder na te denken|automatic|without thinking)/i.test(userMessage),
      triggerExposureDetected: /(?:trigger|uitlokker|prikkel|cue|aanzet)/i.test(userMessage),
      approachBiasLanguageDetected: /(?:trok.*naar|bewoog.*richting|drawn to|pulled toward|approach)/i.test(userMessage),
      attentionalBiasLanguageDetected: /(?:kon.*niet.*stoppen.*kijken|ogen.*gericht|aandacht.*getrokken|couldn.?t.*stop.*looking|eyes.*drawn)/i.test(userMessage),
      conditionedTriggerLanguageDetected: /(?:altijd.*als|elke.*keer|zodra.*dan|whenever|every.*time.*then)/i.test(userMessage),
      vspZone: (sessionBuffer.currentZoneColor?.toUpperCase() ?? 'UNKNOWN') as 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS' | 'UNKNOWN',
      cravingSliderValue: cravingSlider,
      timestampIso: LocalDeviceTimeService.now().utcIso,
      sessionId: `session_${LocalDeviceTimeService.now().epochMs}`,
      turnId: `turn_${LocalDeviceTimeService.now().epochMs}`,
      existingMemoryHints: [],
    };

    // Try WILSKRACHT01 first (self-blame/willpower), then AUTOPILOT01 (craving/trigger)
    const wilskrachtResult = detectWilskracht01(peRuntimeInput);
    const autopilotResult = detectAutopilot01(peRuntimeInput);

    // Pick the one with higher confidence if both are active
    let activeResult: EliasPsychoEducationDetectionResult | null = null;
    if (wilskrachtResult.activationStatus === 'ACTIVE' && autopilotResult.activationStatus === 'ACTIVE') {
      activeResult = wilskrachtResult.confidenceScore >= autopilotResult.confidenceScore ? wilskrachtResult : autopilotResult;
    } else if (wilskrachtResult.activationStatus === 'ACTIVE') {
      activeResult = wilskrachtResult;
    } else if (autopilotResult.activationStatus === 'ACTIVE') {
      activeResult = autopilotResult;
    }

    if (activeResult) {
      const isCrisisOverride = analysis.riskLevel === 'critical' || analysis.riskLevel === 'high';
      psychoEducationActivation = {
        moduleId: activeResult.moduleId as 'WILSKRACHT01' | 'AUTOPILOT01',
        detectedMarkers: activeResult.matchedMarkers,
        activationConfidence: activeResult.confidenceScore,
        responseMode: isCrisisOverride ? 'CONTINUITY_ONLY' : 'FULL_PSYCHOEDUCATION',
        crisisOverride: isCrisisOverride,
        memoryHints: null,
      };
      console.log(`[Pipeline] PsychoEducation: module=${activeResult.moduleId} confidence=${activeResult.confidenceScore} mode=${activeResult.responseMode}`);
    }
  }

  // ── STEP 5e8a3: Elias Steunpilaren (PAAL01) ──
  let paal01Activation: { moduleId: 'PAAL01'; triggerContext: string; confidence: number; matchedMarkers: string[] } | null = null;
  if (backpack.userType === 'elias' && !!(backpack as any).intake?.startEmotion) {
    const { detectPaal01 } = require('@/src/modules/elias/PAAL01/paal01.detector');
    const currentZoneLabel = (sessionBuffer.currentZoneColor?.toUpperCase() ?? 'UNKNOWN') as 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS' | 'UNKNOWN';
    const storedPilaren = (currentUserDat as any).steunpilaren ?? [];
    const balkInit = (currentUserDat as any).balkmetafoor?.initialized === true;
    const paal01Input = {
      persona: 'elias' as const,
      intakeCompleted: true,
      userId: `user_${LocalDeviceTimeService.now().epochMs}`,
      sessionId: `session_${LocalDeviceTimeService.now().epochMs}`,
      turnId: `turn_${LocalDeviceTimeService.now().epochMs}`,
      turnIndex: sessionBuffer.recentMessages.length,
      timestampIso: LocalDeviceTimeService.now().utcIso,
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      language: ((currentUserDat as any).detectedLanguage ?? 'nl') as 'nl' | 'en' | 'fr' | 'mixed' | 'unknown',
      currentZone: currentZoneLabel,
      crisisDetected: analysis.riskLevel === 'critical' || analysis.riskLevel === 'high',
      suicideSelfHarmDetected: analysis.riskLevel === 'critical',
      acuteDangerDetected: analysis.riskLevel === 'critical',
      relapseIntentDetected: (currentUserDat as any).relapseActive === true,
      severeIntoxicationDetected: false,
      medicalEmergencyDetected: false,
      activeGroundingNeeded: (currentUserDat as any).activeGroundingNeeded === true,
      stabilizedEnoughForReflection: currentZoneLabel === 'GROEN' || currentZoneLabel === 'GEEL',
      existingPillarsCount: storedPilaren.length,
      existingBalanceItemsCount: ((currentUserDat as any).balkmetafoor?.draaglast?.length ?? 0) + ((currentUserDat as any).balkmetafoor?.draagkracht?.length ?? 0),
      profileFeatureFirstUse: !balkInit && ((currentUserDat as any).paal01UsageCount ?? 0) === 0,
      hasRecentDifficultMomentResolved: (currentUserDat as any).hasRecentDifficultMomentResolved === true,
      existingEliasSteunpilarenHints: {
        storedSteunpilaren: storedPilaren,
        lastActivatedAt: (currentUserDat as any).paal01LastActivatedAt ?? null,
        moduleUsageCount: (currentUserDat as any).paal01UsageCount ?? 0,
        recentLogSafeSummaries: (currentUserDat as any).paal01RecentLogs ?? [],
        balkmetafoorEntries: {
          draaglast: (currentUserDat as any).balkmetafoor?.draaglast?.map((e: any) => e.text) ?? [],
          draagkracht: (currentUserDat as any).balkmetafoor?.draagkracht?.map((e: any) => e.text) ?? [],
        },
      },
      sessionsSinceLastPaal01: (currentUserDat as any).sessionsSinceLastPaal01 ?? 0,
      balkmetafoorInitialized: balkInit,
    };
    const paal01Result = detectPaal01(paal01Input);
    if (paal01Result.activationStatus === 'ACTIVE') {
      paal01Activation = {
        moduleId: 'PAAL01',
        triggerContext: paal01Result.triggerContext,
        confidence: paal01Result.confidenceScore,
        matchedMarkers: paal01Result.matchedMarkers,
      };
      console.log(`[Pipeline] PAAL01: trigger=${paal01Result.triggerContext} confidence=${paal01Result.confidenceScore}`);
    }
  }

  // ── STEP 5e8a4: Elias Self-Acceptance Cluster (BLIK01/ONTK01/IKST01/COEX01) ──
  let selfAcceptanceActivation: { moduleId: 'BLIK01' | 'ONTK01' | 'IKST01' | 'COEX01'; confidence: number; matchedMarkers: string[]; interventionType: string; patternType?: string } | null = null;
  if (backpack.userType === 'elias' && !!(backpack as any).intake?.startEmotion) {
    const { detectBlik01 } = require('@/src/modules/elias/BLIK01/blik01.detector');
    const { detectOntk01 } = require('@/src/modules/elias/ONTK01/ontk01.detector');
    const { detectIkst01 } = require('@/src/modules/elias/IKST01/ikst01.detector');
    const { detectCoex01 } = require('@/src/modules/elias/COEX01/coex01.detector');
    const sacZone = (sessionBuffer.currentZoneColor?.toUpperCase() ?? 'UNKNOWN') as 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS' | 'UNKNOWN';
    const sacInput = {
      persona: 'elias' as const,
      intakeCompleted: true,
      userId: `user_${LocalDeviceTimeService.now().epochMs}`,
      sessionId: `session_${LocalDeviceTimeService.now().epochMs}`,
      turnId: `turn_${LocalDeviceTimeService.now().epochMs}`,
      turnIndex: sessionBuffer.recentMessages.length,
      timestampIso: LocalDeviceTimeService.now().utcIso,
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      language: ((currentUserDat as any).detectedLanguage ?? 'nl') as 'nl' | 'en' | 'fr' | 'mixed' | 'unknown',
      currentZone: sacZone,
      crisisDetected: analysis.riskLevel === 'critical' || analysis.riskLevel === 'high',
      suicideSelfHarmDetected: analysis.riskLevel === 'critical',
      acuteDangerDetected: analysis.riskLevel === 'critical',
      relapseIntentDetected: (currentUserDat as any).relapseActive === true,
      severeIntoxicationDetected: false,
      medicalEmergencyDetected: false,
      stabilizedEnoughForReflection: sacZone === 'GROEN' || sacZone === 'GEEL',
      paal01Available: paal01Activation !== null,
      paal01KnownSupportPillars: ((currentUserDat as any).steunpilaren ?? []).map((p: any) => ({ pillarId: p.id || p.pillarId || 'unknown', label: p.label || p.text || '', category: p.category || 'other' })),
      existingEliasMemoryHints: {
        recentSafeLogSummaries: (currentUserDat as any).recentSafeLogSummaries ?? [],
        learnedPatterns: (currentUserDat as any).learnedPatterns ?? [],
      },
    };

    const blik01Result = detectBlik01(sacInput);
    const ontk01Result = detectOntk01(sacInput);
    const ikst01Result = detectIkst01(sacInput);
    const coex01Result = detectCoex01(sacInput);

    // Pick highest confidence active module
    const candidates = [
      blik01Result.activationStatus === 'ACTIVE' ? blik01Result : null,
      ontk01Result.activationStatus === 'ACTIVE' ? ontk01Result : null,
      ikst01Result.activationStatus === 'ACTIVE' ? ikst01Result : null,
      coex01Result.activationStatus === 'ACTIVE' ? coex01Result : null,
    ].filter(Boolean) as Array<{ moduleId: string; confidenceScore: number; matchedMarkers: string[]; selectedInterventionType: string; patternType?: string }>;

    if (candidates.length > 0) {
      const best = candidates.sort((a, b) => b.confidenceScore - a.confidenceScore)[0];
      selfAcceptanceActivation = {
        moduleId: best.moduleId as 'BLIK01' | 'ONTK01' | 'IKST01' | 'COEX01',
        confidence: best.confidenceScore,
        matchedMarkers: best.matchedMarkers,
        interventionType: best.selectedInterventionType,
        patternType: best.patternType,
      };
      console.log(`[Pipeline] SelfAcceptance: module=${best.moduleId} confidence=${best.confidenceScore} intervention=${best.selectedInterventionType}`);
    }
  }

  // ── STEP 5e8a5: Kim Pattern Support (PAAL-K01, BEHE-K01, AANP-K01, CODEP-K01) ──
  let kimPatternSupportActivation: { moduleId: 'PAAL-K01' | 'BEHE-K01' | 'AANP-K01' | 'CODEP-K01'; confidence: number; matchedMarkers: string[]; interventionType: string } | null = null;
  if (backpack.userType === 'kim' && !!(backpack as any).intake?.startEmotion) {
    const { detectPaalK01 } = require('@/src/modules/kim/PAAL-K01/paalK01.detector');
    const { detectBeheK01 } = require('@/src/modules/kim/BEHE-K01/beheK01.detector');
    const { detectAanpK01 } = require('@/src/modules/kim/AANP-K01/aanpK01.detector');
    const { detectCodepK01 } = require('@/src/modules/kim/CODEP-K01/codepK01.detector');
    const kimZone = (sessionBuffer.currentZoneColor?.toUpperCase() ?? 'UNKNOWN') as 'GROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS' | 'UNKNOWN';
    const kimPatternInput = {
      persona: 'kim' as const,
      intakeCompleted: true,
      userId: `user_${LocalDeviceTimeService.now().epochMs}`,
      sessionId: `session_${LocalDeviceTimeService.now().epochMs}`,
      turnId: `turn_${LocalDeviceTimeService.now().epochMs}`,
      turnIndex: sessionBuffer.recentMessages.length,
      timestampIso: LocalDeviceTimeService.now().utcIso,
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      language: ((currentUserDat as any).detectedLanguage ?? 'nl') as 'nl' | 'en' | 'fr' | 'mixed' | 'unknown',
      currentKimZone: kimZone,
      crisisDetected: analysis.riskLevel === 'critical' || analysis.riskLevel === 'high',
      selfHarmOrSuicideDetected: analysis.riskLevel === 'critical',
      acuteDangerDetected: analysis.riskLevel === 'critical',
      childDangerDetected: (currentUserDat as any).childDangerDetected === true,
      activeRelapseCrisisDetected: (currentUserDat as any).relapseActive === true,
      domesticViolenceOrAbuseDetected: (currentUserDat as any).domesticViolenceDetected === true,
      stabilizedEnoughForReflection: kimZone === 'GROEN' || kimZone === 'GEEL',
      existingKimMemoryHints: {
        activeSupportPillarIds: ((currentUserDat as any).kimSteunpilaren ?? []).map((p: any) => p.id || 'unknown'),
        activeControlPatternIds: ((currentUserDat as any).kimControlPatterns ?? []).map((p: any) => p.id || 'unknown'),
        activeAdaptationPatternIds: ((currentUserDat as any).kimAdaptationPatterns ?? []).map((p: any) => p.id || 'unknown'),
        activeCodepPatternIds: ((currentUserDat as any).kimCodepPatterns ?? []).map((p: any) => p.id || 'unknown'),
        recentSafeLogSummaries: (currentUserDat as any).recentSafeLogSummaries ?? [],
      },
    };

    const paalK01Result = detectPaalK01(kimPatternInput);
    const beheK01Result = detectBeheK01(kimPatternInput);
    const aanpK01Result = detectAanpK01(kimPatternInput);
    const codepK01Result = detectCodepK01(kimPatternInput);

    const kimCandidates = [
      paalK01Result.activationStatus === 'ACTIVE' ? paalK01Result : null,
      beheK01Result.activationStatus === 'ACTIVE' ? beheK01Result : null,
      aanpK01Result.activationStatus === 'ACTIVE' ? aanpK01Result : null,
      codepK01Result.activationStatus === 'ACTIVE' ? codepK01Result : null,
    ].filter(Boolean) as Array<{ moduleId: string; confidenceScore: number; matchedMarkers: string[]; selectedInterventionType: string }>;

    if (kimCandidates.length > 0) {
      const best = kimCandidates.sort((a, b) => b.confidenceScore - a.confidenceScore)[0];
      kimPatternSupportActivation = {
        moduleId: best.moduleId as 'PAAL-K01' | 'BEHE-K01' | 'AANP-K01' | 'CODEP-K01',
        confidence: best.confidenceScore,
        matchedMarkers: best.matchedMarkers,
        interventionType: best.selectedInterventionType,
      };
      console.log(`[Pipeline] KimPatternSupport: module=${best.moduleId} confidence=${best.confidenceScore} intervention=${best.selectedInterventionType}`);
    }
  }

  // ── STEP 5e8b: Kim SLAAP01 ──
  let kimSlaap01Result: KimSLAAP01Result = {
    slaap01Active: false,
    slaap01Context: null,
    slaap01ResponseMode: null,
    slaap01RouteNext: null,
    slaap01StoragePatch: null,
  };
  if (backpack.userType === 'kim' && !!(backpack as any).intake?.startEmotion) {
    kimSlaap01Result = runKimSLAAP01({
      persona: 'kim',
      intakeCompleted: true,
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      language: (currentUserDat as any).detectedLanguage ?? 'nl',
      detectedMarkers: (currentUserDat as any).detectedMarkers ?? [],
      crisisProtocolStatus: analysis.riskLevel === 'critical' ? 'ACTIVE' : analysis.riskLevel === 'high' ? 'MONITOR' : 'CLEAR',
      medicalRisk: (currentUserDat as any).medicalRisk ?? 0,
      safetyRisk: analysis.riskLevel === 'critical' ? 0.9 : analysis.riskLevel === 'high' ? 0.7 : 0.1,
      sleepProblemDetected: (currentUserDat as any).sleepProblemDetected ?? false,
      sleepAnxietyDetected: (currentUserDat as any).sleepAnxietyDetected ?? false,
      nightVigilanceDetected: (currentUserDat as any).nightVigilanceDetected ?? false,
      sleepGuiltDetected: (currentUserDat as any).sleepGuiltDetected ?? false,
      fatigueBoundaryTriggerDetected: (currentUserDat as any).fatigueBoundaryTriggerDetected ?? false,
      boundaryFatigueIntensity: (currentUserDat.currentMood as any)?.boundaryFatigue ?? 0,
      caregiverStressIntensity: (currentUserDat.currentMood as any)?.stress ?? 0,
      acuteHouseholdSafetyRisk: (currentUserDat as any).acuteHouseholdSafetyRisk ?? false,
      timestampIso: LocalDeviceTimeService.now().utcIso,
    });
  }

  // ── STEP 5e8c: Kim P7 (Danger/Child Cluster: GEVAAR-K01/KIND-K01) ──
  // HIGHEST priority — when active, overrides P2-P6.
  let kimAdvancedP7Result: KimAdvancedP7Result = {
    dangerChildContext: null,
    activeModule: null,
    routeNext: 'NO_MODULE',
    overridesLowerModules: false,
    safetyFilterFn: null,
    memoryPatch: null,
    crisisNumbersToShow: [],
  };
  if (backpack.userType === 'kim' && !!(backpack as any).intake?.startEmotion) {
    kimAdvancedP7Result = runKimAdvancedP7({
      intakeCompleted: true,
      persona: 'kim',
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      language: (currentUserDat as any).detectedLanguage ?? 'nl',
      sessionId: sessionId ?? 'unknown',
      turnId: `turn-${LocalDeviceTimeService.now().epochMs}`,
      immediateDanger: analysis.riskLevel === 'critical',
      childPresentOrAffected: (currentUserDat as any).childrenInvolved ?? false,
      aggressionDetected: (currentUserDat as any).aggressionDetected ?? false,
      drunkDrivingDetected: (currentUserDat as any).drunkDrivingDetected ?? false,
      disappearanceDetected: (currentUserDat as any).disappearanceDetected ?? false,
      overdoseOrMedicalDangerDetected: (currentUserDat as any).overdoseOrMedicalDangerDetected ?? false,
      selfHarmThreatByLovedOneDetected: (currentUserDat as any).selfHarmThreatByLovedOneDetected ?? false,
      domesticViolenceOrAbuseDetected: (currentUserDat as any).domesticViolenceOrAbuseDetected ?? false,
      policeRelevantButNot112: (currentUserDat as any).policeRelevantButNot112 ?? false,
      childMaltreatmentOrNeglectDetected: (currentUserDat as any).childMaltreatmentOrNeglectDetected ?? false,
      childParentificationRiskDetected: (currentUserDat as any).childParentificationRiskDetected ?? false,
      timestampIso: LocalDeviceTimeService.now().utcIso,
    });
  }

  // ── STEP 5e8b: Kim P6 (Relapse Cluster: HERV-K01/NAHERV-K01/CRISIS-K01) ──
  // Highest priority among Kim advanced modules — when active, overrides P2-P5.
  let kimAdvancedP6Result: KimAdvancedP6Result = {
    relapseClusterContext: null,
    activeModule: null,
    routeNext: 'NO_MODULE',
    overridesLowerModules: false,
    safetyFilterFn: null,
    memoryPatch: null,
  };
  if (backpack.userType === 'kim' && !!(backpack as any).intake?.startEmotion) {
    kimAdvancedP6Result = runKimAdvancedP6({
      intakeCompleted: true,
      persona: 'kim',
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      language: (currentUserDat as any).detectedLanguage ?? 'nl',
      sessionId: sessionId ?? 'unknown',
      turnId: `turn-${LocalDeviceTimeService.now().epochMs}`,
      caregiverState: (currentUserDat as any).caregiverState ?? 'unknown',
      safetyRiskLevel: analysis.riskLevel === 'critical' ? 'IMMEDIATE' : analysis.riskLevel === 'high' ? 'HIGH' : 'NONE',
      vspZone: (currentUserDat as any).vspZone ?? 'GROEN',
      riskLevel: analysis.riskLevel as 'low' | 'moderate' | 'high' | 'critical',
      explicitAcuteDanger: analysis.riskLevel === 'critical',
      explicitSelfHarmRiskLovedOne: false,
      explicitSelfHarmRiskCaregiver: false,
      explicitViolenceRisk: false,
      explicitMedicalEmergency: false,
      explicitDisappearance: false,
      explicitImpairedDrivingRisk: false,
      explicitChildSafetyRisk: false,
      timestampIso: LocalDeviceTimeService.now().utcIso,
    });
  }

  // ── STEP 5e9a: Kim P8 (Relational Dynamics: ROL-K01/VETR02-K/LEUGEN-K01) ──
  // Reflective modules. Lower priority than acute clusters (P6/P7).
  let kimP8Result: KimP8Result = {
    active: false,
    moduleId: null,
    detectionResult: null,
    payload: null,
    memoryPatch: null,
    promptContext: null,
  };
  if (backpack.userType === 'kim' && !!(backpack as any).intake?.startEmotion && !kimAdvancedP6Result.overridesLowerModules && !kimAdvancedP7Result.active) {
    kimP8Result = runKimAdvancedModulesP8({
      intakeCompleted: true,
      persona: 'kim',
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      language: (currentUserDat as any).detectedLanguage ?? 'nl',
      activeRelapseNow: /(?:hij|zij|he|she).*(?:drinkt|gebruikt|drinks|uses).*(?:nu|weer|opnieuw|again|now)/i.test(userMessage),
      postRelapseAftermath: /(?:gisteren|vorige week|yesterday|last week).*(?:gedronken|gebruikt|drank|used)/i.test(userMessage),
      caregiverOverwhelmed: (currentUserDat as any).caregiverOverwhelmed ?? false,
      immediateDanger: analysis.riskLevel === 'critical',
      childPresentOrAffected: (currentUserDat as any).childrenInvolved ?? false,
      aggressionDetected: (currentUserDat as any).aggressionDetected ?? false,
      domesticViolenceOrAbuseDetected: (currentUserDat as any).domesticViolenceOrAbuseDetected ?? false,
      selfHarmOrSuicideDetected: (currentUserDat as any).selfHarmOrSuicideDetected ?? false,
      medicalEmergencyDetected: (currentUserDat as any).overdoseOrMedicalDangerDetected ?? false,
      disappearanceAcuteDangerDetected: (currentUserDat as any).disappearanceDetected ?? false,
      careRoleDroppedOrPaused: /(?:opgenomen|admitted|stabiel|stable|in behandeling|in treatment)/i.test(userMessage),
      lovedOneStableOrAdmitted: /(?:opgenomen|admitted|stabiel|stable|veilig|safe|hulp heeft)/i.test(userMessage),
      suppressedEmotionWaveDetected: /(?:boos|woede|leeg|moe|verdriet|huilen|anger|empty|exhausted|grief|crying)/i.test(userMessage),
      partnerAbsentOrInAdmission: /(?:opgenomen|weg|afwezig|admitted|away|absent|in detox|in behandeling)/i.test(userMessage),
      hypervigilanceDetected: /(?:check|controleer|telefoon|scannen|alert|v[eé]rifier)/i.test(userMessage),
      reexperienceDetected: /(?:herleef|herbeleef|relive|re-experience|revis)/i.test(userMessage),
      chronicLyingDetected: /(?:liegt.*constant|blijft liegen|lies.*constantly|keeps lying|ment.*tout le temps)/i.test(userMessage),
      detectiveRoleDetected: /(?:detective|bewijs|proof|controleer alles|check everything|preuves)/i.test(userMessage),
      betrayalPainDetected: /(?:vertrouw.*niet|trust.*not|confiance.*plus)/i.test(userMessage),
      lovedOneUseContext: /(?:hij|zij|he|she|il|elle)/i.test(userMessage),
      firstPersonUseContext: /\b(ik|I|je)\b.*\b(gebruik|drink|use|consume)\b/i.test(userMessage),
      sessionId: sessionId ?? 'unknown',
      turnId: `turn-${LocalDeviceTimeService.now().epochMs}`,
      timestampIso: LocalDeviceTimeService.now().utcIso,
    });
  }

  // ── STEP 5e9b: Kim P9 (Emotional Loss: HOOP-K01/SCHAAM-K01/ROUW-K01/ISOL-K01) ──
  // Reflective modules. Lower priority than acute clusters (P6/P7) and relational dynamics (P8).
  let kimP9Result: KimP9Result = {
    active: false,
    moduleId: 'NONE',
    detectionResult: null,
    payload: null,
    contextString: '',
  };
  if (backpack.userType === 'kim' && !!(backpack as any).intake?.startEmotion && !kimAdvancedP6Result.overridesLowerModules && !kimAdvancedP7Result.active && !kimP8Result.active) {
    kimP9Result = runKimAdvancedP9({
      message: userMessage,
      persona: 'kim',
      selfHarmOrSuicideDetectedInKim: (currentUserDat as any).selfHarmOrSuicideDetected ?? false,
      immediateDanger: analysis.riskLevel === 'critical',
      dangerOrViolenceDetected: (currentUserDat as any).aggressionDetected ?? false,
      domesticViolenceOrAbuseDetected: (currentUserDat as any).domesticViolenceOrAbuseDetected ?? false,
      aggressionDetected: (currentUserDat as any).aggressionDetected ?? false,
      childPresentOrAffected: (currentUserDat as any).childrenInvolved ?? false,
      activeRelapseNow: /(?:hij|zij|he|she).*(?:drinkt|gebruikt|drinks|uses).*(?:nu|weer|opnieuw|again|now)/i.test(userMessage),
      immediateAftermathActive: /(?:gisteren|vorige week|yesterday|last week).*(?:gedronken|gebruikt|drank|used)/i.test(userMessage),
      enoughIsEnoughDetected: /(?:wanneer is genoeg|when is enough|quand est-ce que [cç]a suffit)/i.test(userMessage),
      hopeExhaustionDetected: /(?:verlies.*hoop|geen hoop|losing hope|no hope|perds.*espoir|plus d'espoir)/i.test(userMessage),
      shameSecrecyDetected: /(?:schaam|verberg|hide|ashamed|honte|cache)/i.test(userMessage),
      socialWithdrawalDetected: /(?:trek.*terug|zie.*niemand|withdraw|see.*no ?one|me retire|ne vois.*personne)/i.test(userMessage),
      ambiguousLossDetected: /(?:mis.*wie.*was|kwijt.*terwijl.*leeft|miss.*used to be|lost.*still alive|deuil.*vivant)/i.test(userMessage),
      lostFutureGriefDetected: /(?:rouw.*toekomst|ander.*leven.*voorgesteld|grieve.*future|imagined.*different|deuil.*avenir)/i.test(userMessage),
      socialIsolationDetected: /(?:ge[ïi]soleerd|niemand meer|alleen.*hiermee|isolated|alone.*with this|isol[ée]|seul.*avec)/i.test(userMessage),
      lossOfOwnContactsDetected: /(?:contacten kwijt|geen sociaal leven|lost.*contacts|no social life|perdu.*contacts|plus de vie sociale)/i.test(userMessage),
      detectedMarkers: [],
    });
  }

  // ── STEP 5e9c: Kim P10 (STOA-K: Stoic Reflective Framework) ──
  // Lowest reflective priority. Below all acute (P6/P7) and all specific reflective (P8/P9).
  // Never both STOA-K and KST01 as primary in one turn.
  let kimP10Result: KimP10Result = {
    active: false,
    moduleId: 'NONE',
    detectionResult: null,
    payload: null,
    memoryPatch: null,
    contextString: '',
  };
  if (backpack.userType === 'kim' && !!(backpack as any).intake?.startEmotion && !kimAdvancedP6Result.overridesLowerModules && !kimAdvancedP7Result.active && !kimP8Result.active && !kimP9Result.active) {
    kimP10Result = runKimAdvancedP10({
      message: userMessage,
      persona: 'kim',
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      language: (currentUserDat as any).detectedLanguage ?? 'nl',
      intakeCompleted: true,
      lovedOneUseContext: (currentUserDat as any).lovedOneUseContext ?? false,
      firstPersonUseContext: (currentUserDat as any).firstPersonUseContext ?? false,
      caregiverOverwhelmed: (currentUserDat as any).caregiverOverwhelmed ?? false,
      immediateDanger: analysis.riskLevel === 'critical',
      childPresentOrAffected: (currentUserDat as any).childrenInvolved ?? false,
      aggressionDetected: (currentUserDat as any).aggressionDetected ?? false,
      domesticViolenceOrAbuseDetected: (currentUserDat as any).domesticViolenceOrAbuseDetected ?? false,
      disappearanceAcuteDangerDetected: (currentUserDat as any).disappearanceAcuteDangerDetected ?? false,
      selfHarmOrSuicideDetected: (currentUserDat as any).selfHarmOrSuicideDetected ?? false,
      medicalEmergencyDetected: (currentUserDat as any).medicalEmergencyDetected ?? false,
      activeRelapseNow: /(?:hij|zij|he|she).*(?:drinkt|gebruikt|drinks|uses).*(?:nu|weer|opnieuw|again|now)/i.test(userMessage),
      specificReflectiveModuleCandidate: null,
    });
  }

  // ── STEP 5e9: Kim P2 (BEDR01/VETR01/GASL01) ──
  let kimAdvancedP2Result: KimAdvancedP2Result = {
    bedr01Context: null,
    vetr01Context: null,
    gasl01Context: null,
    activeModule: null,
    routeNext: 'NO_MODULE',
  };
  if (backpack.userType === 'kim' && !!(backpack as any).intake?.startEmotion && analysis.riskLevel !== 'critical') {
    kimAdvancedP2Result = runKimAdvancedP2({
      intakeCompleted: true,
      persona: 'kim',
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      language: (currentUserDat as any).detectedLanguage ?? 'nl',
      detectedMarkers: (currentUserDat as any).detectedMarkers ?? [],
      crisisProtocolStatus: analysis.riskLevel === 'critical' ? 'ACTIVE' : analysis.riskLevel === 'high' ? 'MONITOR' : 'CLEAR',
      K06StabilizationStatus: (currentUserDat as any).k06StabilizationStatus ?? 'NOT_RUN',
      acuteShockDominant: (currentUserDat as any).acuteShockDominant ?? false,
      discoveryJustHappened: (currentUserDat as any).discoveryJustHappened ?? false,
      bodyDysregulation: (currentUserDat as any).bodyDysregulation ?? false,
      decisionPressure: (currentUserDat as any).decisionPressure ?? false,
      childrenInvolved: (currentUserDat as any).childrenInvolved ?? false,
      safetyRisk: analysis.riskLevel === 'critical' ? 0.9 : analysis.riskLevel === 'high' ? 0.7 : 0.1,
      legalAdviceRequest: (currentUserDat as any).legalAdviceRequest ?? false,
      guiltInnocenceRequest: (currentUserDat as any).guiltInnocenceRequest ?? false,
      trustRepairQuestion: (currentUserDat as any).trustRepairQuestion ?? false,
      forgivenessPressure: (currentUserDat as any).forgivenessPressure ?? false,
      relationshipMeaningQuestion: (currentUserDat as any).relationshipMeaningQuestion ?? false,
      boundaryNeedAfterBetrayal: (currentUserDat as any).boundaryNeedAfterBetrayal ?? false,
      timelinePressure: (currentUserDat as any).timelinePressure ?? false,
      partnerMindReading: (currentUserDat as any).partnerMindReading ?? false,
      selfDoubtDominant: (currentUserDat as any).selfDoubtDominant ?? false,
      realityQuestionDominant: (currentUserDat as any).realityQuestionDominant ?? false,
      darvoPatternDetected: (currentUserDat as any).darvoPatternDetected ?? false,
      informationAsymmetry: (currentUserDat as any).informationAsymmetry ?? false,
      childrenTriangulation: (currentUserDat as any).childrenTriangulation ?? false,
      partnerBlamesCaregiver: (currentUserDat as any).partnerBlamesCaregiver ?? false,
      timestampIso: LocalDeviceTimeService.now().utcIso,
    });
  }

  // ── STEP 5e10: Kim P3 (CDP01/RNW01) ──
  let kimAdvancedP3Result: KimAdvancedP3Result = {
    cdp01Context: null,
    rnw01Context: null,
    activeModule: null,
    routeNext: 'NO_MODULE',
  };
  if (backpack.userType === 'kim' && !!(backpack as any).intake?.startEmotion && analysis.riskLevel !== 'critical') {
    kimAdvancedP3Result = runKimAdvancedP3({
      intakeCompleted: true,
      persona: 'kim',
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      language: (currentUserDat as any).detectedLanguage ?? 'nl',
      detectedMarkers: (currentUserDat as any).detectedMarkers ?? [],
      crisisProtocolStatus: analysis.riskLevel === 'critical' ? 'ACTIVE' : analysis.riskLevel === 'high' ? 'MONITOR' : 'CLEAR',
      K06StabilizationStatus: (currentUserDat as any).k06StabilizationStatus ?? 'NOT_RUN',
      // CDP01 signals
      selfLossPattern: (currentUserDat as any).selfLossPattern ?? false,
      relationalFusion: (currentUserDat as any).relationalFusion ?? false,
      emotionalDependencyOnPartnerState: (currentUserDat as any).emotionalDependencyOnPartnerState ?? false,
      rescueCompulsion: (currentUserDat as any).rescueCompulsion ?? false,
      overResponsibility: (currentUserDat as any).overResponsibility ?? false,
      controlFromFear: (currentUserDat as any).controlFromFear ?? false,
      selfCareGuilt: (currentUserDat as any).selfCareGuilt ?? false,
      identityCollapseWithoutPartner: (currentUserDat as any).identityCollapseWithoutPartner ?? false,
      acuteOverload: (currentUserDat as any).acuteOverload ?? false,
      // RNW01 signals
      missesOldPerson: (currentUserDat as any).missesOldPerson ?? false,
      griefForLivingPerson: (currentUserDat as any).griefForLivingPerson ?? false,
      ambiguousGriefMarker: (currentUserDat as any).ambiguousGriefMarker ?? false,
      falseHopeSeeking: (currentUserDat as any).falseHopeSeeking ?? false,
      acceptancePressure: (currentUserDat as any).acceptancePressure ?? false,
      relationshipAsItWasLost: (currentUserDat as any).relationshipAsItWasLost ?? false,
      guiltAboutGrieving: (currentUserDat as any).guiltAboutGrieving ?? false,
      futureLoss: (currentUserDat as any).futureLoss ?? false,
      acuteFlooding: (currentUserDat as any).acuteFlooding ?? false,
      safetyRisk: analysis.riskLevel === 'critical' ? 0.9 : analysis.riskLevel === 'high' ? 0.7 : 0.1,
      timestampIso: LocalDeviceTimeService.now().utcIso,
    });
  }

  // ── 5e11. Kim Advanced P4 (PAR01/FIN01) ──
  let kimAdvancedP4Result: KimAdvancedP4Result = {
    par01Context: null,
    fin01Context: null,
    activeModule: null,
    routeNext: 'NO_MODULE',
  };
  if (backpack.userType === 'kim' && !!(backpack as any).intake?.startEmotion && analysis.riskLevel !== 'critical') {
    kimAdvancedP4Result = runKimAdvancedP4({
      intakeCompleted: true,
      persona: 'kim',
      latestUserMessage: userMessage,
      recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
      language: (currentUserDat as any).detectedLanguage ?? 'nl',
      crisisProtocolStatus: analysis.riskLevel === 'critical' ? 'ACTIVE' : analysis.riskLevel === 'high' ? 'MONITOR' : 'CLEAR',
      K06StabilizationStatus: (currentUserDat as any).k06StabilizationStatus ?? 'NOT_RUN',
      par01PreviousDetections: (currentUserDat as any).par01Detections ?? [],
      fin01PreviousDetections: (currentUserDat as any).fin01Detections ?? [],
      safetyRisk: analysis.riskLevel === 'critical' ? 0.9 : analysis.riskLevel === 'high' ? 0.7 : 0.1,
      timestampIso: LocalDeviceTimeService.now().utcIso,
      backpackContext: JSON.stringify((backpack as any).sections ?? {}),
    });
  }

  // ── 5e12. Kim Advanced P5 (ISO01) ──
  let kimAdvancedP5Result: KimAdvancedP5Result = {
    iso01Context: null,
    activeModule: null,
    routeNext: 'NO_MODULE',
  };
  if (backpack.userType === 'kim' && !!(backpack as any).intake?.startEmotion && analysis.riskLevel !== 'critical') {
    // Enrich ISO01 signals from short-module-detector keyword/concept matching
    const iso01Concepts = detectISO01Signals(userMessage);
    // Also check recent messages for broader context
    const recentTexts = sessionBuffer.recentMessages.slice(-3).map(m => m.content);
    for (const txt of recentTexts) {
      const additionalConcepts = detectISO01Signals(txt);
      for (const c of additionalConcepts) iso01Concepts.add(c);
    }
    // Also check the generic isolationSignal from state-analyzer
    const iso01InputSignals = detectInputSignals(userMessage);
    const genericIsolation = iso01InputSignals.isolationSignal;

    kimAdvancedP5Result = runKimAdvancedP5({
      intakeCompleted: true,
      persona: 'kim',
      latestUserMessage: userMessage,
      recentMessages: recentTexts,
      language: (currentUserDat as any).detectedLanguage ?? 'nl',
      detectedMarkers: [...iso01Concepts],
      crisisProtocolStatus: analysis.riskLevel === 'critical' ? 'ACTIVE' : analysis.riskLevel === 'high' ? 'MONITOR' : 'CLEAR',
      K06StabilizationStatus: (currentUserDat as any).k06StabilizationStatus ?? 'NOT_RUN',
      socialWithdrawal: iso01Concepts.has('social-withdrawal') || genericIsolation,
      shameAboutTalking: iso01Concepts.has('shame-about-talking'),
      burdenFear: iso01Concepts.has('burden-fear'),
      protectiveIsolation: iso01Concepts.has('protective-isolation'),
      exhaustionIsolation: iso01Concepts.has('exhaustion-isolation'),
      noSocialContact: iso01Concepts.has('no-social-contact') || genericIsolation,
      privacyNeed: iso01Concepts.has('privacy-need'),
      fearOfJudgment: iso01Concepts.has('fear-of-judgment'),
      adviceFatigue: iso01Concepts.has('advice-fatigue'),
      painfulLoneliness: iso01Concepts.has('painful-loneliness') || genericIsolation,
      wantsConnectionButScared: iso01Concepts.has('social-withdrawal') && iso01Concepts.has('painful-loneliness'),
      acuteOverload: analysis.riskLevel === 'high',
      safetyRisk: analysis.riskLevel === 'critical' ? 0.9 : analysis.riskLevel === 'high' ? 0.7 : 0.1,
      timestampIso: LocalDeviceTimeService.now().utcIso,
    });
  }

  // ── PRE-GPT STEP 6: Build ChatContext + ONE GPT call ──
  let crisisLevel = 0;
  let showEmergency = false;

  if (analysis.riskLevel === 'critical') {
    crisisLevel = 2;
    showEmergency = true;
    sessionWasCrisis = true;
  } else if (analysis.riskLevel === 'high') {
    crisisLevel = 2;
    showEmergency = true;
    sessionWasCrisis = true;
  } else if (analysis.riskLevel === 'moderate') {
    crisisLevel = 1;
  }

  if (analysis.crisisThresholdLowered && crisisLevel === 0 && analysis.riskLevel !== 'low') {
    crisisLevel = 1;
  }

  // ── PRE-GPT STEP 6a: Build EliasDecision (aggregation only) ──
  // Compatibility wrapper: construct CrisisAssessment from existing pipeline values
  const crisisAssessment: CrisisAssessment = {
    level: crisisLevel,
    triggers: [],
    recommendedAction:
      crisisLevel === 2 ? 'emergency' :
      crisisLevel === 1 ? 'intervene' :
      'none',
  };

  // ── Decision routing: Elias OR Kim, never both ──
  let elisDecision: EliasDecision | null = null;
  let kimDecision: KimDecision | null = null;

  if (backpack.userType === 'elias') {
    elisDecision = createEliasDecision({
      analysis,
      dominantState: preGPTDominantState,
      crisis: crisisAssessment,
      stageOfChange: backpack.intakeContext?.stageOfChange ?? ELIAS_DEFAULT_STAGE,
      moodSliders: currentUserDat.currentMood || (ELIAS_DEFAULT_MOOD as any),
      currentZoneColor: sessionBuffer.currentZoneColor as ZoneColor,
      currentZoneScore: sessionBuffer.currentZoneScore,
      vspInput: ('vsp' in currentUserDat.currentMood) ? (currentUserDat.currentMood as import('../ai/types').EliasMoodSliders).vsp : null,
    });
  } else {
    kimDecision = createKimDecision({
      analysis,
      dominantState: preGPTDominantState,
      crisis: crisisAssessment,
      moodSliders: currentUserDat.currentMood || (ELIAS_DEFAULT_MOOD as any),
      currentZoneColor: sessionBuffer.currentZoneColor as ZoneColor,
      currentZoneScore: sessionBuffer.currentZoneScore,
      eigenRegieInput: ('eigenRegie' in currentUserDat.currentMood) ? (currentUserDat.currentMood as import('../ai/types').KimMoodSliders).eigenRegie : null,
    });
  }

  sessionEliasDecision = elisDecision;
  sessionKimDecision = kimDecision;

  // ── VSP MISSING FALLBACK (non-blocking) ──
  // If Elias VSP is not submitted, we still proceed but with reduced engine context.
  // The pre-chat thermometer UI handles enforcement; pipeline never blocks.
  if (elisDecision?.isBlocked) {
    // Override: treat as GREEN zone with no impact, proceed to GPT
    elisDecision = {
      ...elisDecision,
      isBlocked: false,
      zone: {
        ...elisDecision.zone,
        resolved: elisDecision.zone.resolved ?? {
          finalSeverity: 0,
          finalZoneLabel: 'GREEN',
          source: 'fallback' as const,
          reason: 'VSP not submitted, proceeding with safe defaults',
          vspLevel: null,
          computedZone: 'GREEN',
          isCrisis: false,
        },
        impact: null,
      },
    };
  }

  // ── Route engine directive: select correct engine output based on userType ──
  const activeDecision = elisDecision ?? kimDecision;

  // ── PRE-GPT STEP 5b: Apply Regulation Layer ──
  // Runs AFTER engine decision so we use the RESOLVED zone (not buffer-computed zone).
  // Elias: use resolved finalZoneLabel. Kim: use engine zone level. Fallback: buffer zone.
  const resolvedZoneForRegulation: ZoneColor = (() => {
    if (elisDecision?.zone.resolved?.finalZoneLabel) {
      // Map Dutch FinalZoneLabel → English ZoneColor
      const labelMap: Record<string, ZoneColor> = {
        'GROEN': 'GREEN', 'GEEL': 'YELLOW', 'ORANJE': 'ORANGE', 'ROOD': 'RED', 'PAARS': 'PURPLE',
      };
      return labelMap[elisDecision.zone.resolved.finalZoneLabel] ?? (sessionBuffer.currentZoneColor as ZoneColor);
    }
    if (kimDecision?.isKimCrisis) {
      // Kim crisis (eigenRegie < 10) → force PURPLE, equivalent to Elias PAARS
      return 'PURPLE';
    }
    if (kimDecision?.zone.engine?.level) {
      // Map Dutch ZoneLevel → English ZoneColor
      const levelMap: Record<string, ZoneColor> = {
        'GROEN': 'GREEN', 'LICHTGROEN': 'GREEN', 'GEEL': 'YELLOW', 'ORANJE': 'ORANGE', 'ROOD': 'RED',
      };
      return levelMap[kimDecision.zone.engine.level] ?? (sessionBuffer.currentZoneColor as ZoneColor);
    }
    // Fallback: buffer-computed zone (pre-engine)
    return sessionBuffer.currentZoneColor as ZoneColor;
  })();

  // Get previous assistant message for anti-repetition safeguard
  const chatHistory = currentUserDat.chatHistory || [];
  const lastAssistantMsg = [...chatHistory].reverse().find(m => m.role === 'assistant');
  const previousAssistantContent = lastAssistantMsg?.content ?? null;

  const regulationResult = applyRegulation(
    resolvedZoneForRegulation,
    userGuidanceDepth,
    previousAssistantContent,
  );

  // Update session tracking for next message's anti-repetition
  sessionLastRegulationResult = regulationResult;

  // Log regulation decision
  if (regulationResult.action !== 'reflect') {
    console.log(`[Pipeline] Regulation: ${regulationResult.action} | zone=${regulationResult.zone} (resolved) | depth=${regulationResult.effectiveDepth} | softened=${regulationResult.wasSoftened} | skipped=${regulationResult.wasSkipped}`);
  }
  const engineDirective: EngineDirective | null = routeEngineDirective({
    userType: backpack.userType,
    eliasZone: (elisDecision?.zone.impact)
      ? { level: elisDecision.zone.computed.level, label: elisDecision.zone.computed.label, impact: elisDecision.zone.impact }
      : null,
    kimZone: kimDecision?.zone.engine
      ? { level: kimDecision.zone.engine.level, label: kimDecision.zone.engine.label, impact: kimDecision.zone.engine.impact }
      : null,
  });

  // ── PRE-GPT STEP 6c: Evaluate Intervention Continuity (Elias only) ──
  // Compare current resolvedZone with linkedZone from previous turn.
  // Zone shifted → re-evaluate intervention. Zone stable → continue same line.
  let interventionContinuity: InterventionState | null = null;
  if (elisDecision && !elisDecision.isBlocked && elisDecision.zone.resolved) {
    interventionContinuity = evaluateInterventionContinuity(
      elisDecision.zone.resolved,
      userMessage,
    );
  }

  // ── PRE-GPT STEP 5c: SignalEngine (non-blocking) ──
  // Calls GptSignalEngine for signal detection + relevance scoring + context summarization.
  // Fault-tolerant: if engine not ready or call fails, empty/neutral results.
  const engine = getEngine();
  let candidateSignals: ChatContext['candidateSignals'] = undefined;
  let relevanceScores: ChatContext['relevanceScores'] = undefined;
  let contextSummary: string | undefined = undefined;
  let signalEngineReady = false;

  try {
    if (engine.isReady()) {
      signalEngineReady = true;
      const backpackSummary = backpack.sections?.map(s => s.content).filter(Boolean).join('; ').slice(0, 200) ?? '';
      const diarySummary = (options?.diaryEntries ?? []).slice(0, 3).map(d => d.content || '').join('; ');
      const [signals, scores] = await Promise.all([
        engine.detectSignals(userMessage, {
          zone: bufferSnapshot?.zoneColor ?? 'unknown',
          vspOrEigenRegie: vspLevel ?? eigenRegieScore,
          keySliders: currentMood as unknown as Record<string, unknown>,
          userType: backpack.userType as 'elias' | 'kim',
          activeProjections: (() => {
            try {
              const ps = getProjectionState();
              return ps.entries.filter((e: ProjectionEntry) => e.isActive).map((e: ProjectionEntry) => ({
                category: e.category,
                content: e.content,
                strength: e.strength,
              }));
            } catch { return []; }
          })(),
        }),
        engine.scoreRelevance(userMessage, {
          backpackSummary,
          diarySummary,
          triggerList: relevance.triggers.map(t => t.trigger),
        }),
      ]);
      candidateSignals = signals;
      relevanceScores = scores;

      // Taak 2: For LIVE_MESSAGE calls, summarize context as replacement for full lifeStorySummary.
      // SESSION_INIT still sends the full backpack — no summarization needed.
      if (!isSessionStart && backpackSummary.length > 0) {
        const recentThemes = (currentUserDat.chatHistory || []).slice(-4)
          .filter(m => m.role === 'user')
          .map(m => m.content)
          .join('; ')
          .slice(0, 200);
        const summary = await engine.summarizeContext({
          backpackSections: backpackSummary,
          recentSessionThemes: recentThemes,
        });
        if (summary.text.length > 0) {
          contextSummary = summary.text;
        }
      }
    }
  } catch (e) {
    // Non-blocking: engine failure does not stop the pipeline
    console.log(`[Pipeline] SignalEngine error (non-blocking): ${(e as Error).message}`);
  }

  // ── PRE-GPT STEP 5d: Relapse Intent Detection ──
  // Dual-path: GptSignalEngine (semantic, language-agnostic) + deterministic fallback (NL/EN/FR markers).
  // If detected with confidence ≥ 0.6 → escalate computed zone to minimum ORANJE.
  let relapseIntentResult: ChatContext['relapseIntent'] = undefined;
  try {
    if (backpack.userType === 'elias' && signalEngineReady) {
      const gptResult = await engine.detectRelapseIntent(userMessage);
      if (gptResult.detected && gptResult.confidence >= 0.6) {
        relapseIntentResult = { detected: true, confidence: gptResult.confidence, source: 'gpt' as const };
      }
    }
  } catch {
    // GPT failed — fall through to deterministic fallback
  }

  // Deterministic fallback: always runs when GPT didn't detect
  if (!relapseIntentResult) {
    if (backpack.userType === 'elias') {
      const fallbackResult = detectRelapseIntentFallback(userMessage);
      if (fallbackResult.detected) {
        relapseIntentResult = { detected: true, confidence: fallbackResult.confidence, source: 'fallback' as const };
      }
    } else if (backpack.userType === 'kim') {
      // Kim-variant: detect loved one reporting their person's relapse intent (third person)
      const kimFallbackResult = detectKimRelapseIntentFallback(userMessage);
      if (kimFallbackResult.detected) {
        relapseIntentResult = { detected: true, confidence: kimFallbackResult.confidence, source: 'fallback' as const };
      }
    }
  }

  // Zone escalation: if relapse intent detected → override elisDecision to minimum ORANJE
  if (relapseIntentResult?.detected && elisDecision && !elisDecision.isBlocked) {
    const currentSeverity = elisDecision.zone.resolved?.finalSeverity ?? 0;
    if (currentSeverity < 3) {
      // Escalate to ORANJE (severity 3)
      const escalatedResolved = {
        ...elisDecision.zone.resolved!,
        finalSeverity: 3 as const,
        finalZoneLabel: 'ORANJE' as const,
        source: 'COMPUTED' as const,
        reason: `RELAPSE_INTENT_ESCALATION (${relapseIntentResult.source}, confidence=${relapseIntentResult.confidence.toFixed(2)})`,
      };
      const escalatedImpact = computeEliasImpact(escalatedResolved as any);
      elisDecision = {
        ...elisDecision,
        zone: {
          ...elisDecision.zone,
          resolved: escalatedResolved as any,
          impact: escalatedImpact,
        },
      };
      console.log(`[Pipeline] RELAPSE_INTENT_ESCALATION: zone escalated to ORANJE (was severity ${currentSeverity}, source=${relapseIntentResult.source})`);
    }
  }

  // ── Persist relapse-intent event to user.dat log (cross-session pattern tracking) ──
  if (relapseIntentResult?.detected) {
    const relapseEvent = {
      timestamp: LocalDeviceTimeService.now().utcIso,
      source: relapseIntentResult.source,
      confidence: relapseIntentResult.confidence,
      sessionNumber: currentUserDat.totalSessions,
      messageSnippet: userMessage.slice(0, 200),
      zoneBeforeEscalation: vspLevel ?? 'GROEN',
      zoneAfterEscalation: elisDecision?.zone.resolved?.finalZoneLabel ?? 'ORANJE',
    };
    currentUserDat = {
      ...currentUserDat,
      relapseIntentLog: [...(currentUserDat.relapseIntentLog ?? []), relapseEvent],
    };
    console.log(`[Pipeline] RELAPSE_INTENT_LOGGED: event #${currentUserDat.relapseIntentLog!.length} persisted to user.dat`);
  }

  const sessionStart = currentUserDat.lastSessionDate ? new Date(currentUserDat.lastSessionDate) : new Date(LocalDeviceTimeService.now().epochMs);
  const sessionMinutes = Math.floor((LocalDeviceTimeService.now().epochMs - sessionStart.getTime()) / 60000);

  // ── STEP 5f: VSP Insight Layer (AFTER safety core, BEFORE GPT call) ──
  // Reads safety core output but NEVER mutates it. store:false.
  const vspInsightResult: VspInsightPipelineResult = runVspInsightLayer({
    persona: backpack.userType as 'elias' | 'kim',
    userMessage,
    recentMessages: sessionBuffer.recentMessages.slice(-3).map(m => m.content),
    moodSliders: {
      craving: (currentUserDat.currentMood as any)?.craving ?? 0,
      frustration: (currentUserDat.currentMood as any)?.frustration ?? 0,
      despondency: (currentUserDat.currentMood as any)?.despondency ?? 0,
      focus: (currentUserDat.currentMood as any)?.focus ?? 5,
    },
    selfReportedZone: (vspLevel ?? 'GROEN') as any,
    sessionTurnCount: sessionBuffer.recentMessages.length,
    safetyCore: {
      finalZone: (elisDecision?.zone.resolved?.finalZoneLabel ?? kimDecision?.resolvedZone ?? vspLevel ?? 'GROEN') as any,
      userReportedZone: (vspLevel ?? 'GROEN') as any,
      safetyOverrideActive: analysis.riskLevel === 'critical',
      crisisDetected: (elisDecision?.zone.resolved?.isCrisis ?? false) || (kimDecision?.isKimCrisis ?? false),
      relapseIntentDetected: relapseIntentResult?.detected ?? false,
      modelRoutingDecision: elisDecision?.recommendedModel ?? kimDecision?.recommendedModel ?? 'gpt-4o-mini',
      activeSafetyModuleId: null,
    },
    profile: null, // Profile loaded from AsyncStorage on device — not available in pipeline
  });

  // ── VSP Backpack Profile: load LLM-analyzed profile from cache (Elias only) ──
  let vspBackpackProfileBlock: string | undefined;
  if (backpack.userType === 'elias') {
    try {
      const cached = await loadCachedVspProfile();
      vspBackpackProfileBlock = cached?.contextBlock || buildVspBackpackProfileBlock(backpack.sections || []);
    } catch {
      // Fallback to local parsing if AsyncStorage unavailable
      vspBackpackProfileBlock = buildVspBackpackProfileBlock(backpack.sections || []);
    }
  }

  // ── PRE-GPT STEP 6b: Past-Reference Search (logs.dat + user.dat) ──
  // Detects when user references something from a previous session and injects relevant context.
  let pastReferenceContext: string | undefined;
  if (options?.logsSessions && options.logsSessions.length > 0) {
    const searchResult = searchPastReferences(
      userMessage,
      options.logsSessions,
      currentUserDat,
    );
    if (searchResult.found && searchResult.contextForGPT) {
      pastReferenceContext = searchResult.contextForGPT;
    }
  }

  // ── CONTEXT.DAT DISTILLATION (first turn only) ────────────────────────────────────
  let contextDatSerialized: string | undefined;
  let deepeningBlock: string | undefined;
  let contextDatObject: import('../pipeline/context-dat-distiller').ContextDat | undefined;
  if (isSessionStart) {
    try {
      const { distillContextDat, serializeContextDatForGPT } = await import('../pipeline/context-dat-distiller');
      const { resolveDeepening, serializeDeepeningForGPT } = await import('../pipeline/context-dat-deepening');
      const { clearDeepeningCache } = await import('../pipeline/deepening-cache');
      clearDeepeningCache(); // Fresh session = fresh cache
      const lifecycleMgr = getSessionLifecycleManager();
      const memStores = lifecycleMgr.getStores();
      const persona = (backpack.userType || 'elias') as 'elias' | 'kim';
      const stateDat = await memStores.stateDatStore.load(persona);
      const projectionsDat = await memStores.projectionsDatStore.load(persona);
      const userDatMemory = await memStores.userDatStore.load(persona, 'local_user');

      const contextDat = distillContextDat({
        backpack,
        userDat: currentUserDat,
        logsDat: options?.logsSessions ? { sessions: options.logsSessions, routingAudit: [] } as any : null,
        stateDat,
        projectionsDat,
        userDatMemory,
        diaryEntries: options?.diaryEntries ?? [],
      });
      contextDatObject = contextDat;
      contextDatSerialized = serializeContextDatForGPT(contextDat);

      // Deepening: targeted fragment retrieval if nano detected gaps
      if (clientNanoResult) {
        const deepeningResult = resolveDeepening({
          contextDat,
          nanoResult: clientNanoResult,
          backpack,
          userDat: currentUserDat,
          logsDat: options?.logsSessions ? { sessions: options.logsSessions, routingAudit: [] } as any : null,
          currentMessage: userMessage,
        });
        if (deepeningResult.triggered) {
          deepeningBlock = serializeDeepeningForGPT(deepeningResult);
        }
      }
    } catch (e) {
      // Graceful fallback: if distillation fails, proceed without context.dat (full payload)
      console.warn('[context.dat] Distillation failed, falling back to full payload:', e);
      contextDatSerialized = undefined;
      deepeningBlock = undefined;
    }
  }

  // ── CLIENT FALLBACK: ChatContext + GPT call (only reached when server-led block above fails) ──
  const context: ChatContext = {
    userType: backpack.userType,
    userName: backpack.naam,
    currentMessage: userMessage,
    conversationHistory: currentUserDat.chatHistory || [],
    moodSliders: currentUserDat.currentMood || (ELIAS_DEFAULT_MOOD as any),
    rugzak,
    backpack,
    userDat: currentUserDat,
    isSessionStart,
    diaryEntries: options?.diaryEntries ?? [],
    contextDatSerialized,
    deepeningBlock,
    activeModules: [activeDecision ? activeDecision.dominantModule : preGPTDominantState.dominantModule],
    crisisLevel: activeDecision ? activeDecision.crisisLevel : crisisLevel,
    isCrisis: (elisDecision?.zone.resolved?.isCrisis ?? false) || (kimDecision?.isKimCrisis ?? false),
    vspLevel: elisDecision?.zone.resolved?.finalZoneLabel ?? vspLevel,
    engineDirective: engineDirective ?? undefined,
    detectedEmotion: analysis.emotionalState,
    therapeuticStance: buildTherapeuticStance(analysis),
    sessionDurationMinutes: sessionMinutes,
    urgency: backpack.intakeContext?.urgency ?? 'midden',
    startEmotion: backpack.intakeContext?.startEmotion ?? '',
    bufferSnapshot,
    guidanceDepth: currentUserDat.guidanceDepth ?? 'normal',
    regulationResult: regulationResult.action !== 'reflect' ? {
      action: regulationResult.action,
      intervention: regulationResult.intervention,
      gptInstruction: regulationResult.gptInstruction,
      zone: regulationResult.zone,
      effectiveDepth: regulationResult.effectiveDepth,
      wasSoftened: regulationResult.wasSoftened,
      wasSkipped: regulationResult.wasSkipped,
    } : undefined,
    interventionContinuity: interventionContinuity
      ? buildInterventionContext(interventionContinuity)
      : undefined,
    projectionContext: projectionResult.injectionBlock ?? undefined,
    projectionDeepening: projectionResult.deepeningDirective ?? undefined,
    candidateSignals,
    relevanceScores,
    contextSummary,
    relapseIntent: relapseIntentResult,
    stoaContext: stoaResult.injectionBlock ?? undefined,
    schemaModeContext: schemaModeResult.promptInjection || undefined,
    actContext: actResult.promptBlock || undefined,
    cgtContext: cbtResult.promptBlock || undefined,
    dgtContext: dgtResult.promptBlock || undefined,
    mbtContext: mbtResult.promptBlock || undefined,
    ko1Context: ko1Result.promptBlock || undefined,
    k05Context: k05Result.promptBlock || undefined,
    k02Context: k02Result.promptBlock || undefined,
    k04Context: k04Result.promptBlock || undefined,
    k04s4Context: k04s4Result.promptBlock || undefined,
    k06Context: k06Result.promptBlock || undefined,
    k01Context: k01Result.promptBlock || undefined,
    k03Context: k03Result.promptBlock || undefined,
    sw01Context: sw01Result.promptBlock || undefined,
    sto01Context: sto01Result.generatedInstruction.gptPromptBlock || undefined,
    kst01Context: kimAdvancedResult.kst01PromptBlock || undefined,
    kdl01Context: kimAdvancedResult.kdl01PromptBlock || undefined,
    kbr01Context: kimAdvancedResult.kbr01PromptBlock || undefined,
    ksc01Context: kimAdvancedResult.ksc01PromptBlock || undefined,
    vergv01Context: eliasAdvancedResult.vergv01PromptBlock || undefined,
    igh01Context: eliasAdvancedResult.igh01PromptBlock || undefined,
    agc01Context: eliasAdvancedResult.agc01PromptBlock || undefined,
    hwk01Context: eliasAdvancedResult.hwk01PromptBlock || undefined,
    fale01Context: eliasAdvancedP2Result.fale01PromptBlock || undefined,
    verg01Context: eliasAdvancedP2Result.verg01PromptBlock || undefined,
    rouw01Context: eliasAdvancedP2Result.rouw01PromptBlock || undefined,
    iden01Context: eliasAdvancedP2Result.iden01PromptBlock || undefined,
    zink01Context: eliasAdvancedP2Result.zink01PromptBlock || undefined,
    terv01Context: eliasAdvancedP3Result.terv01PromptBlock || undefined,
    mi02Context: eliasAdvancedP3Result.mi02PromptBlock || undefined,
    slaap01EliasContext: eliasP4Result.slaap01Context || undefined,
    slaap01KimContext: kimSlaap01Result.slaap01Context || undefined,
    bedr01Context: (kimAdvancedP7Result.overridesLowerModules || kimAdvancedP6Result.overridesLowerModules) ? undefined : (kimAdvancedP2Result.bedr01Context || undefined),
    vetr01Context: (kimAdvancedP7Result.overridesLowerModules || kimAdvancedP6Result.overridesLowerModules) ? undefined : (kimAdvancedP2Result.vetr01Context || undefined),
    gasl01Context: (kimAdvancedP7Result.overridesLowerModules || kimAdvancedP6Result.overridesLowerModules) ? undefined : (kimAdvancedP2Result.gasl01Context || undefined),
    cdp01Context: (kimAdvancedP7Result.overridesLowerModules || kimAdvancedP6Result.overridesLowerModules) ? undefined : (kimAdvancedP3Result.cdp01Context || undefined),
    rnw01Context: (kimAdvancedP7Result.overridesLowerModules || kimAdvancedP6Result.overridesLowerModules) ? undefined : (kimAdvancedP3Result.rnw01Context || undefined),
    par01Context: (kimAdvancedP7Result.overridesLowerModules || kimAdvancedP6Result.overridesLowerModules) ? undefined : (kimAdvancedP4Result.par01Context || undefined),
    fin01Context: (kimAdvancedP7Result.overridesLowerModules || kimAdvancedP6Result.overridesLowerModules) ? undefined : (kimAdvancedP4Result.fin01Context || undefined),
    iso01Context: (kimAdvancedP7Result.overridesLowerModules || kimAdvancedP6Result.overridesLowerModules) ? undefined : (kimAdvancedP5Result.iso01Context || undefined),
    // Kim Relapse Cluster (HERV-K01/NAHERV-K01/CRISIS-K01) — overrides all lower Kim modules when active
    relapseClusterContext: kimAdvancedP7Result.overridesLowerModules ? undefined : (kimAdvancedP6Result.relapseClusterContext || undefined),
    // Kim Danger/Child Cluster (GEVAAR-K01/KIND-K01) — overrides ALL lower Kim modules when active
    dangerChildContext: kimAdvancedP7Result.dangerChildContext || undefined,
    // Kim Relational Dynamics Cluster (ROL-K01/VETR02-K/LEUGEN-K01) — reflective modules below acute
    relationalDynamicsContext: (kimAdvancedP7Result.overridesLowerModules || kimAdvancedP6Result.overridesLowerModules) ? undefined : (kimP8Result.active ? kimP8Result.promptContext || undefined : undefined),
    // Kim Emotional Loss Cluster (HOOP-K01/SCHAAM-K01/ROUW-K01/ISOL-K01) — reflective modules below acute + relational dynamics
    emotionalLossContext: (kimAdvancedP7Result.overridesLowerModules || kimAdvancedP6Result.overridesLowerModules || kimP8Result.active) ? undefined : (kimP9Result.active ? kimP9Result.contextString || undefined : undefined),
    // Kim STOA-K (Stoic Reflective Framework) — lowest reflective priority, suppressed when any higher module active
    stoaKContext: (kimAdvancedP6Result.overridesLowerModules || kimAdvancedP7Result.active || kimP8Result.active || kimP9Result.active) ? undefined : (kimP10Result.active ? kimP10Result.contextString || undefined : undefined),
    // PsychoEducation continuity (WILSKRACHT01/AUTOPILOT01, Elias only)
    psychoEducationContext: psychoEducationActivation && !psychoEducationActivation.crisisOverride
      ? `[PSYCHO-EDUCATIE ${psychoEducationActivation.moduleId}] mode=${psychoEducationActivation.responseMode} confidence=${psychoEducationActivation.activationConfidence.toFixed(2)} markers=[${psychoEducationActivation.detectedMarkers.join(',')}]${psychoEducationActivation.memoryHints ? ' continuity=active' : ''}`
      : undefined,
    // Steunpilaren inventaris (PAAL01, Elias only)
    steunpilarenContext: paal01Activation
      ? `[STEUNPILAREN PAAL01] trigger=${paal01Activation.triggerContext} confidence=${paal01Activation.confidence.toFixed(2)} markers=[${paal01Activation.matchedMarkers.join(',')}]`
      : undefined,
    // Self-acceptance cluster (BLIK01/ONTK01/IKST01/COEX01, Elias only)
    selfAcceptanceContext: selfAcceptanceActivation
      ? `[SELF_ACCEPTANCE ${selfAcceptanceActivation.moduleId}] intervention=${selfAcceptanceActivation.interventionType} confidence=${selfAcceptanceActivation.confidence.toFixed(2)} pattern=${selfAcceptanceActivation.patternType ?? 'unknown'} markers=[${selfAcceptanceActivation.matchedMarkers.join(',')}]`
      : undefined,
    // Kim Pattern Support (PAAL-K01/BEHE-K01/AANP-K01/CODEP-K01, Kim only)
    kimPatternSupportContext: kimPatternSupportActivation
      ? `[KIM_PATTERN_SUPPORT ${kimPatternSupportActivation.moduleId}] intervention=${kimPatternSupportActivation.interventionType} confidence=${kimPatternSupportActivation.confidence.toFixed(2)} markers=[${kimPatternSupportActivation.matchedMarkers.join(',')}]`
      : undefined,
    // VSP Insight System — framework selection (MI/MBT/DGT). Never mutates safety core.
    vspInsightContext: vspInsightResult.active ? vspInsightResult.contextString || undefined : undefined,
    // VSP Backpack Profile — LLM-analyzed from recurringThemes (Elias only, cached in AsyncStorage)
    vspBackpackProfile: vspBackpackProfileBlock,
    // VSP Structured Section — user's own per-zone signals, whatHelps, anchorSentence (Elias only)
    // Pass the current zone so the active zone content is highlighted prominently for GPT
    vspStructuredSection: backpack.userType === 'elias' ? buildVspStructuredBlock(backpack, elisDecision?.zone.resolved?.finalZoneLabel ?? vspLevel) : undefined,
    // Backpack entity extraction: send structured entities instead of full backpack when unchanged
    extractedEntities: currentUserDat.extractedEntities ?? undefined,
    backpackChanged: !currentUserDat.extractedEntities || (currentUserDat.extractedEntities.persons.length === 0),
    // Backpack deep analysis: schema/mode/trigger context from GPT-4o
    backpackAnalysis: currentUserDat.backpackAnalysis ?? undefined,
    // LANGUAGE_RECOVERY: inject recovery directive if detected
    languageRecovery: languageRecoveryResult.detected ? {
      detected: true,
      theme: languageRecoveryResult.theme,
      delta: languageRecoveryResult.delta,
      instruction: `LANGUAGE_RECOVERY_DETECTED: true\nTHEME: "${languageRecoveryResult.theme}"\n\u2192 Erken de vooruitgang subtiel, zonder overdrijven.\n\u2192 Bevestig wat de gebruiker zelf al voelt.`,
    } : undefined,
    // LOOPBLOCKER: inject cross-session loop directive if active
    loopDetected: (() => {
      const patterns: import('../ai/types').RepeatingPattern[] = (currentUserDat as any).repeatingPatterns ?? [];
      const activeLoop = patterns.find((p) => p.sessionCount >= 3 && !p.progressionDetected);
      if (activeLoop) {
        return {
          active: true as const,
          theme: activeLoop.theme,
          sessionCount: activeLoop.sessionCount,
          instruction: `LOOP_DETECTED: true\nLOOP_THEME: "${activeLoop.theme}"\nLOOP_COUNT: ${activeLoop.sessionCount}\n\u2192 Benoem het patroon direct, vraag of de gebruiker dit herkent. Wees eerlijk en compassievol over de herhaling.`,
        };
      }
      return undefined;
    })(),
    // PAST_REFERENCE: inject context from logs.dat/user.dat when user references past events
    pastReferenceContext,
    // Eigen Regie context (Kim only): zone + meaning + impact directives. Replaces stageOfChange for Kim.
    eigenRegieContext: kimDecision?.eigenRegie ? {
      userInput: kimDecision.eigenRegie.userInput,
      engineScore: kimDecision.eigenRegie.engineScore,
      zone: kimDecision.eigenRegie.zone,
      meaning: kimDecision.eigenRegie.meaning,
      impact: {
        primaryDirective: kimDecision.eigenRegie.impact.primaryDirective,
        secondaryDirective: kimDecision.eigenRegie.impact.secondaryDirective,
      },
    } : undefined,
    // User-selected app language (from i18n provider)
    locale: options?.locale,
    // User-selected country (for crisis numbers)
    country: options?.country,
  };

  // ── CLIENT-SIDE GPT CALL (DEPRECATED — server-led is primary) ──
  // This path only executes when the server-led block above fails (graceful degradation).
  // In normal operation, processMessage returns early from the server-led block.
  let response: string;
  let tokenUsage: TokenUsage | undefined;
  let selectedModel: string | undefined;
  if (provider) {
    try {
      const result: AIResult = await provider.generateResponse(context);
      response = result.response;
      tokenUsage = result.tokenUsage;
      selectedModel = result.selectedModel;
    } catch (error) {
      console.error('[Pipeline] CLIENT FALLBACK AI generation error:', error);
      response = "I'm still here with you. Something went wrong on my end — please try again.";
    }
  } else {
    // No provider available and server-led failed — hard fallback
    console.error('[Pipeline] No AI provider available and server-led failed. Returning safe fallback.');
    response = "I'm still here with you. Something went wrong on my end — please try again.";
  }

  // ══════════════════════════════════════════════════════════════
  // POST-GPT FLOW (all local, no second GPT call)
  // ══════════════════════════════════════════════════════════════

  // ── POST-GPT STEP 6.5: Feedback Loop (dual-output parsing) ──
  // Parse engine_signals from LLM response, route to memory layers, enrich buffer.
  const feedbackResult = processFeedbackLoop({
    rawResponse: response,
    bufferState: sessionBuffer,
    currentModuleId: activeDecision ? activeDecision.dominantModule : preGPTDominantState.dominantModule,
    crisisActive: crisisLevel >= 2,
  });
  // Replace response with user-facing text (engine_signals stripped, but clinical preserved for UI)
  response = feedbackResult.clinicalBlock
    ? feedbackResult.userText + `\n\n<clinical>${feedbackResult.clinicalBlock}</clinical>`
    : feedbackResult.userText;
  // Apply buffer enrichment (topics, persons, emotional arc)
  if (feedbackResult.hasData) {
    Object.assign(sessionBuffer, {
      topicHistory: feedbackResult.updatedBuffer.topicHistory,
      personsDiscussed: feedbackResult.updatedBuffer.personsDiscussed,
      emotionalArc: feedbackResult.updatedBuffer.emotionalArc,
      currentTopic: feedbackResult.updatedBuffer.currentTopic,
      moduleSwitchCount: feedbackResult.updatedBuffer.moduleSwitchCount,
      currentModuleMessageCount: feedbackResult.updatedBuffer.currentModuleMessageCount,
    });
  }
  // Log feedback loop result
  if (feedbackResult.signals) {
    console.log(`[Pipeline] FEEDBACK_LOOP: persons=${feedbackResult.routing.personsToStore.length}, triggers=${feedbackResult.routing.triggersToPromote.length}, topic=${feedbackResult.updatedBuffer.currentTopic}, moduleSwitch=${feedbackResult.moduleDecision.shouldSwitch ? feedbackResult.moduleDecision.newModuleId : 'no'}`);
  }

  // ── POST-GPT STEP 6.7: VSP Output Safety Filter ──
  // Audit GPT response for clinical terminology leakage, framework disclosure, etc.
  try {
    const { auditVspOutputSafety, hasHighSeverityViolation } = await import('../../src/features/vspInsight/vspOutputSafetyFilter');
    const safetyAudit = auditVspOutputSafety({
      responseText: feedbackResult.userText,
      clinicalModeActive: currentUserDat.clinicalModeActive ?? false,
      insightState: vspInsightResult.insightState ?? 'REAL_GREEN',
      framework: vspInsightResult.framework ?? 'MI',
      persona: (backpack.userType || 'elias') as 'elias' | 'kim',
    });
    if (safetyAudit.hasViolations) {
      console.warn(`[Pipeline] VSP OUTPUT SAFETY: ${safetyAudit.violationCount} violations (max=${safetyAudit.maxSeverity}): ${safetyAudit.violations.map(v => v.ruleRef).join(', ')}`);
      logDebugEvent('vsp_output_safety', {
        violationCount: safetyAudit.violationCount,
        maxSeverity: safetyAudit.maxSeverity,
        violations: safetyAudit.violations.map(v => ({ rule: v.ruleRef, severity: v.severity, match: v.matchedText })),
        rulesApplied: safetyAudit.rulesApplied,
      });
    }
  } catch (e) {
    // Non-blocking: if safety filter fails, continue without it
    console.warn('[Pipeline] VSP Output Safety filter error (non-blocking):', e);
  }

  // ── POST-GPT STEP 7: Update internal stored state ──
  // We do NOT reselect dominantState. The pre-GPT state is the decision variable.
  // We only update the buffer with the assistant response and adjust internal state.
  let updatedUserDat = { ...currentUserDat };

  // 7a-pre. Apply feedback loop routing to userDat (persons → extractedEntities, triggers → triggerPatterns)
  if (feedbackResult.routing.personsToStore.length > 0 && updatedUserDat.extractedEntities) {
    // Static import used (Metro bundler cannot resolve dynamic require on device)
    const existingPersons = updatedUserDat.extractedEntities.persons || [];
    updatedUserDat = {
      ...updatedUserDat,
      extractedEntities: {
        ...updatedUserDat.extractedEntities,
        persons: mergePersons(existingPersons, feedbackResult.routing.personsToStore),
      },
    };
  }
  if (feedbackResult.routing.triggersToPromote.length > 0) {
    const newTriggerLabels = feedbackResult.routing.triggersToPromote.map(t => t.label);
    updatedUserDat = {
      ...updatedUserDat,
      triggerPatterns: updateTriggerPatterns(updatedUserDat.triggerPatterns || [], newTriggerLabels),
    };
  }

  // 7a. Add user message to history
  const userMsg: ChatMessage = {
    id: `msg_${LocalDeviceTimeService.now().epochMs}`,
    role: 'user',
    content: userMessage,
    timestamp: LocalDeviceTimeService.now().utcIso,
  };
  updatedUserDat = {
    ...updatedUserDat,
    chatHistory: [...(updatedUserDat.chatHistory || []), userMsg],
  };

  // 7b. Add AI response to history
  const aiMsg: ChatMessage = {
    id: `msg_${LocalDeviceTimeService.now().epochMs + 1}`,
    role: 'assistant',
    content: response,
    timestamp: LocalDeviceTimeService.now().utcIso,
    modulesUsed: [activeDecision ? activeDecision.dominantModule : preGPTDominantState.dominantModule],
    clinicalInfo: {
      module: activeDecision ? activeDecision.dominantModule : preGPTDominantState.dominantModule,
      zone: sessionBuffer.currentZoneColor ?? 'unknown',
      model: selectedModel ?? 'unknown',
      regulation: regulationResult.action !== 'reflect' ? `${regulationResult.action} (depth=${regulationResult.effectiveDepth})` : undefined,
      riskScore: preGPTDominantState.riskScore,
      source: preGPTDominantState.sourceLayer,
      triggers: relevance.triggers.length > 0 ? relevance.triggers.map(t => `${t.trigger}(${t.score})`).join(', ') : undefined,
      projection: projectionResult.hasActiveEntries ? `+${projectionResult.newEntriesCount} active (${projectionResult.injectionBlock?.slice(0, 60) ?? ''})` : undefined,
      intervention: interventionContinuity ? `${interventionContinuity.lastInterventionType} (goal=${interventionContinuity.interventionGoal}, turns=${interventionContinuity.turnsActive}, eff=${interventionContinuity.effectivenessScore})` : undefined,
      buffer: `msg#${sessionBuffer.messageCount} zone=${sessionBuffer.currentZoneColor}(${sessionBuffer.currentZoneScore}) intent=${(sessionBuffer as any).liveIntent ?? 'none'}`,
    },
    schemaModeResult: schemaModeResult.activated ? {
      dominantMode: schemaModeResult.modeDecision.dominantMode ?? null,
      dominantSchema: schemaModeResult.schemaDecision.dominantSchema ?? null,
      acceptedModes: schemaModeResult.modeDecision.acceptedModes ?? [],
      acceptedSchemas: schemaModeResult.schemaDecision.acceptedSchemas ?? [],
    } : undefined,
  };
  updatedUserDat = {
    ...updatedUserDat,
    chatHistory: [...(updatedUserDat.chatHistory || []), aiMsg],
  };

  // 7b-ii. POST-GPT: Update Intervention Continuity State (Elias only)
  // Records what Elias actually did this turn so next turn can compare.
  if (elisDecision && !elisDecision.isBlocked && elisDecision.zone.resolved) {
    updateInterventionAfterResponse(
      elisDecision.zone.resolved,
      regulationResult.action,
    );
  }

  // 7b-iii. POST-GPT: Check deflection for projection deepening deactivation
  // If user deflected ("weet niet", "laat maar", etc.), deepening is blocked for session remainder.
  checkDeflectionInResponse(userMessage);

  // 7c. Update trigger patterns from signals (local reinforcement, not promotion)
  const signals = detectInputSignals(userMessage);
  const newTriggers = extractTriggersFromSignals(signals);
  if (newTriggers.length > 0) {
    updatedUserDat = {
      ...updatedUserDat,
      triggerPatterns: updateTriggerPatterns(updatedUserDat.triggerPatterns || [], newTriggers),
    };
  }

  // 7d. Record module usage + update usedModules in buffer (loopblocker)
  let tempRugzak = composeRugzak(backpack, updatedUserDat);
  for (const moduleId of [preGPTDominantState.dominantModule]) {
    tempRugzak = recordModuleUsage(tempRugzak, moduleId, userMessage.slice(0, 50));
  }
  updatedUserDat = {
    ...updatedUserDat,
    moduleUsage: tempRugzak.moduleUsage,
  };
  // Loopblocker: track this module as used in the session buffer
  if (!sessionBuffer.usedModules) {
    sessionBuffer.usedModules = [];
  }
  if (!sessionBuffer.usedModules.includes(preGPTDominantState.dominantModule)) {
    sessionBuffer.usedModules.push(preGPTDominantState.dominantModule);
  }

  // ── POST-GPT STEP 8: Concrete pattern marking ──
  // Mark pattern signals in session-level state.
  // DO NOT immediately write to userDat — buffer holds it.
  const markedPatterns: string[] = [];

  // Mark from detected triggers
  for (const trigger of newTriggers) {
    markPatternSignal(trigger, currentUserDat.triggerPatterns || []);
    markedPatterns.push(trigger);
  }

  // Mark from buffer's trigger guess
  if (sessionBuffer.currentTriggerGuess) {
    markPatternSignal(sessionBuffer.currentTriggerGuess, currentUserDat.triggerPatterns || []);
    if (!markedPatterns.includes(sessionBuffer.currentTriggerGuess)) {
      markedPatterns.push(sessionBuffer.currentTriggerGuess);
    }
  }

  // Mark from dominant state trigger
  if (preGPTDominantState.dominantTrigger && preGPTDominantState.dominantTrigger !== '') {
    markPatternSignal(preGPTDominantState.dominantTrigger, currentUserDat.triggerPatterns || []);
    if (!markedPatterns.includes(preGPTDominantState.dominantTrigger)) {
      markedPatterns.push(preGPTDominantState.dominantTrigger);
    }
  }

  // Check promotion candidates (for logging only — actual promotion at session end)
  const promotionCandidates = sessionPatternSignals.filter(
    (p) => p.repeatCount >= PROMOTION_THRESHOLD && !isInCooldown(p)
  );

  // ── POST-GPT STEP 9: Consolidated logging ──
  const messageLog: MessageLog = {
    timestamp: LocalDeviceTimeService.now().utcIso,
    messageIndex: sessionBuffer.messageCount,
    preGPT: {
      triggerDecayApplied,
      zoneDecay: {
        applied: zoneDecayResult.decayApplied,
        types: zoneDecayResult.activeDecayTypes,
        reason: zoneDecayResult.reason,
      },
      dominantState: preGPTDominantState,
      selectedTriggers: relevance.triggers,
      bufferZoneScore: sessionBuffer.currentZoneScore,
      bufferZoneColor: sessionBuffer.currentZoneColor,
      regulation: {
        action: regulationResult.action,
        zone: regulationResult.zone,
        effectiveDepth: regulationResult.effectiveDepth,
        wasSoftened: regulationResult.wasSoftened,
        wasSkipped: regulationResult.wasSkipped,
        hasIntervention: regulationResult.intervention !== null,
      },
    },
    gpt: {
      selectedModel,
      tokenUsage,
      responseLength: response.length,
    },
    postGPT: {
      updatedZoneScore: sessionBuffer.currentZoneScore,
      updatedZoneColor: sessionBuffer.currentZoneColor,
      patternSignalsMarked: markedPatterns,
      promotionCandidates: promotionCandidates.length,
      promotionDecisions: promotionCandidates.map(
        (p) => `${p.signal}(${p.repeatCount}x, ${p.previouslyPromoted ? 'reinforcement' : 'new'})`
      ),
    },
  };

  // Log to console
  console.log(`[Pipeline] Message #${messageLog.messageIndex} | ${isSessionStart ? 'SESSION_INIT' : 'LIVE_MESSAGE'}`);
  console.log(`[Pipeline] PRE-GPT: decay=${triggerDecayApplied}, zone=${sessionBuffer.currentZoneColor}(${sessionBuffer.currentZoneScore}), zoneDecay=${zoneDecayResult.decayApplied}`);
  console.log(`[Pipeline] PRE-GPT: dominant=${activeDecision ? activeDecision.dominantModule : preGPTDominantState.dominantModule} via ${preGPTDominantState.sourceLayer} | trigger=${preGPTDominantState.dominantTrigger || 'none'} | risk=${preGPTDominantState.riskScore}`);
  if (elisDecision) {
    console.log(`[Pipeline] ELIAS_DECISION: tone=${elisDecision.tone} | pacing=${elisDecision.pacing} | interventionDepth=${elisDecision.interventionDepth} | challengeLevel=${elisDecision.challengeLevel} | zone=${elisDecision.zone.calculated}`);
  }
  if (kimDecision) {
    console.log(`[Pipeline] KIM_DECISION: tone=${kimDecision.tone} | pacing=${kimDecision.pacing} | interventionDepth=${kimDecision.interventionDepth} | challengeLevel=${kimDecision.challengeLevel} | zone=${kimDecision.zone.calculated}`);
  }
  if (engineDirective) {
    console.log(`[Pipeline] ENGINE_DIRECTIVE: engine=${engineDirective.engine} | zone=${engineDirective.zoneLevel} | label=${engineDirective.zoneLabel}`);
  }
  console.log(`[Pipeline] PRE-GPT: triggers=[${relevance.triggers.map(t => `${t.trigger}(${t.score})`).join(', ')}]`);
  if (selectedModel) console.log(`[Pipeline] GPT: model=${selectedModel}`);
  if (tokenUsage) console.log(`[Pipeline] GPT: tokens=${tokenUsage.promptTokens}in+${tokenUsage.completionTokens}out=${tokenUsage.totalTokens}total`);
  if (regulationResult.action !== 'reflect') {
    console.log(`[Pipeline] REGULATION: action=${regulationResult.action}, zone=${regulationResult.zone}, depth=${regulationResult.effectiveDepth}, softened=${regulationResult.wasSoftened}, skipped=${regulationResult.wasSkipped}`);
  }
  console.log(`[Pipeline] POST-GPT: patterns=[${markedPatterns.join(', ')}], promotionCandidates=${promotionCandidates.length}`);

  // Record cost
  if (tokenUsage) {
    recordCallCost(tokenUsage, isSessionStart, preGPTDominantState.dominantModule);
  }

    // Compose the final rugzak view (backpack unchanged)
  const updatedRugzak = composeRugzak(backpack, updatedUserDat);

  // ── MEMORY WRITE-BACK (per-turn, client pipeline) ──────────────────────────
  // Routes pipeline detections (fears/hopes/triggers/schema/mode/zone/module)
  // to user.dat / state.dat / projections.dat via the existing write-back system.
  let clientMemoryChangedFields: string[] = [];
  try {
    const lifecycleMgr = getSessionLifecycleManager();
    const memStores = lifecycleMgr.getStores();
    const persona = backpack.userType as 'elias' | 'kim';
    const memUserDat = await memStores.userDatStore.load(persona, 'local_user');
    const memStateDat = await memStores.stateDatStore.load(persona);
    const memProjectionsDat = await memStores.projectionsDatStore.load(persona);
    const memBuffer = memStores.sessionBufferStore.getBuffer();

    // Build PipelineResultForMemory from client-pipeline detections
    const pipelineResultForMemory: PipelineResultForMemory = {
      userMessage,
      persona,
      sessionId: sessionBuffer.sessionId,
      localUserId: 'local_user',
      candidateSignals: candidateSignals
        ? {
            fears: candidateSignals.fears.map(f => ({ label: f.keyword, confidence: f.confidence })),
            hopes: candidateSignals.hopes.map(h => ({ label: h.keyword, confidence: h.confidence })),
            goals: candidateSignals.goals.map(g => ({ label: g.keyword, confidence: g.confidence })),
            triggers: candidateSignals.triggers.map(t => ({ label: t.keyword, confidence: t.confidence, triggerType: 'craving' })),
          }
        : null,
      schemaModeResult: schemaModeResult.activated
        ? {
            activated: true,
            modeDecision: {
              acceptedModes: schemaModeResult.modeDecision.acceptedModes.map(m => ({ modeId: m.modeId, confidence: m.confidence })),
              dominantMode: schemaModeResult.modeDecision.dominantMode,
            },
            schemaDecision: {
              acceptedSchemas: schemaModeResult.schemaDecision.acceptedSchemas.map(s => ({ schemaId: s.schemaId, confidence: s.confidence, domain: s.domain })),
              dominantSchema: schemaModeResult.schemaDecision.dominantSchema,
              dominantDomain: schemaModeResult.schemaDecision.dominantDomain,
            },
          }
        : null,
      bufferSnapshot: { zoneColor: sessionBuffer.currentZoneColor, zoneScore: sessionBuffer.currentZoneScore },
      activeModule: { moduleId: preGPTDominantState.dominantModule, confidence: 0.9, responseMode: preGPTDominantState.dominantDirection },
      moodSliders: (currentUserDat.currentMood || null) as unknown as Record<string, number> | null,
    };

    // Build detection bundle and run write-back
    const detectionBundle = buildDetectionBundle(pipelineResultForMemory);
    const currentSnapshot = { userDat: memUserDat, stateDat: memStateDat, projectionsDat: memProjectionsDat, sessionBuffer: memBuffer };
    const writeBackOutput = runMemoryWriteBack(detectionBundle, currentSnapshot);

    // Persist updated stores
    if (writeBackOutput.commitResult.writtenPatches.length > 0) {
      await memStores.userDatStore.save(writeBackOutput.updatedStores.userDat);
      await memStores.stateDatStore.save(writeBackOutput.updatedStores.stateDat);
      await memStores.projectionsDatStore.save(writeBackOutput.updatedStores.projectionsDat);
    }

    // Capture changed fields for debug output
    clientMemoryChangedFields = writeBackOutput.commitResult.changedFields;

    // Append turn snapshot to session buffer
    if (memBuffer) {
      memStores.sessionBufferStore.appendTurnSnapshot(memBuffer, {
        turnId: `turn_${sessionBuffer.messageCount}_${Date.now()}`,
        timestampIso: LocalDeviceTimeService.now().utcIso,
        inputHash: userMessage.slice(0, 20),
        outputHash: response.slice(0, 20),
        detectedCounts: {
          fears: detectionBundle.fears.length,
          hopes: detectionBundle.hopes.length,
          triggers: detectionBundle.triggers.length,
          schemaTendencies: detectionBundle.schemaTendencies.length,
          modeTendencies: detectionBundle.modeTendencies.length,
        },
        changedFields: clientMemoryChangedFields,
      });
    }

    console.log(`[Pipeline/Client] Memory write-back: ${writeBackOutput.commitResult.writtenPatches.length} patches written, fields=[${clientMemoryChangedFields.join(', ')}]`);
  } catch (memErr) {
    // Non-critical: pipeline continues even if write-back fails
    console.warn('[Pipeline/Client] Memory write-back failed (non-critical):', memErr);
  }

  // ── Build engine trace data for debug screen ──
  const traceData: EngineTraceInput = {
    messageIndex: sessionBuffer.messageCount,
    timestamp: LocalDeviceTimeService.now().utcIso,
    userMessage,
    pipelineSteps: [
      { step: '1. Trigger decay', status: 'passed', reason: `applied to ${sessionBuffer.messageCount > 1 ? 'previous' : 'initial'} buffer` },
      { step: '2. Buffer update', status: 'passed', reason: `zone=${sessionBuffer.currentZoneColor}, score=${sessionBuffer.currentZoneScore}` },
      { step: '3. Zone decay', status: 'passed', reason: `decayApplied` },
      { step: '4. Dominant state', status: 'passed', reason: `module=${preGPTDominantState.dominantModule}, source=${preGPTDominantState.sourceLayer}` },
      { step: '5a. Buffer snapshot', status: 'passed', reason: `triggers=${relevance.triggers.length}` },
      { step: '5b. Regulation', status: regulationResult.wasSkipped ? 'skipped' : 'passed', reason: `action=${regulationResult.action}, depth=${regulationResult.effectiveDepth}` },
      { step: '5c. SignalEngine', status: signalEngineReady ? 'passed' : 'skipped', reason: signalEngineReady ? `fears=${candidateSignals?.fears.length ?? 0} hopes=${candidateSignals?.hopes.length ?? 0} goals=${candidateSignals?.goals.length ?? 0} triggers=${candidateSignals?.triggers.length ?? 0}` : 'engine not ready' },
      { step: '5d. Projection', status: projectionResult.injectionBlock ? 'passed' : 'skipped', reason: projectionResult.injectionBlock ? 'block injected' : 'no signal' },
      { step: '5e1. RETP', status: retpResult.activated ? 'passed' : 'skipped', reason: retpResult.reason },
      { step: '5e2. STOA', status: stoaResult.activated ? 'passed' : 'skipped', reason: stoaResult.reason },
      { step: '5f. SchemaMode', status: schemaModeResult.activated ? 'passed' : 'skipped', reason: schemaModeResult.modeDecision.reason },
      { step: '5g. ACT', status: actResult.activated ? 'passed' : 'skipped', reason: actResult.decision.reason },
      { step: '5h. CBT', status: cbtResult.activated ? 'passed' : 'skipped', reason: cbtResult.decision.reason },
      { step: '5i. DGT', status: dgtResult.activated ? 'passed' : 'skipped', reason: dgtResult.decision.reason },
      { step: '5j. MBT', status: mbtResult.activated ? 'passed' : 'skipped', reason: mbtResult.decision.reason },
      { step: '5k. KO1', status: ko1Result.activated ? 'passed' : 'skipped', reason: ko1Result.decision.reason },
      { step: '5l. K05', status: k05Result.activated ? 'passed' : 'skipped', reason: k05Result.decision.reason },
      { step: '5m. K02', status: k02Result.activated ? 'passed' : 'skipped', reason: k02Result.decision.reason },
      { step: '5n. K04', status: k04Result.activated ? 'passed' : 'skipped', reason: k04Result.activated ? `state=${k04Result.primaryState}|severity=${k04Result.severity}` : 'no emotional state detected' },
      { step: '5o. K04-S4', status: k04s4Result.activated ? 'passed' : 'skipped', reason: k04s4Result.activated ? `state=${k04s4Result.primaryState}|severity=${k04s4Result.severity}` : 'no betrayal/trust state detected' },
      { step: '5p. K06', status: k06Result.activated ? 'passed' : 'skipped', reason: k06Result.activated ? `state=${k06Result.primaryState}|severity=${k06Result.severity}|sustainability=${k06Result.sustainabilityLevel}` : 'no self-care state detected' },
      { step: '5p2. KimAdvanced', status: (kimAdvancedResult.kst01Active || kimAdvancedResult.kdl01Active || kimAdvancedResult.kbr01Active || kimAdvancedResult.ksc01Active) ? 'passed' : 'skipped', reason: `KST01=${kimAdvancedResult.kst01Active}|KDL01=${kimAdvancedResult.kdl01Active}|KBR01=${kimAdvancedResult.kbr01Active}|KSC01=${kimAdvancedResult.ksc01Active}|route=${kimAdvancedResult.routeTarget}` },
      { step: '5q. K01', status: k01Result.activated ? 'passed' : 'skipped', reason: k01Result.activated ? `state=${k01Result.primaryState}|severity=${k01Result.severity}|intervention=${k01Result.interventionType}|collapse=${k01Result.collapseRisk}` : 'no boundary state detected' },
      { step: '5r. K03', status: k03Result.activated ? 'passed' : 'skipped', reason: k03Result.activated ? `mode=${k03Result.interventionMode}|level=${k03Result.responseLevel}|severity=${k03Result.severity}|shadow=${k03Result.primaryShadowPart}|ekt=${k03Result.ektPhase}` : 'selfCare > 3 or not activated' },
      { step: '5e3. SW01', status: sw01Result.active ? 'passed' : 'skipped', reason: sw01Result.active ? `mode=${sw01Result.interventionMode}|confidence=${sw01Result.confidence.toFixed(2)}|loop=${sw01Result.activeLoop?.loop_id ?? 'none'}|projection=${sw01Result.projectionActive}` : 'no shadow signals detected' },
      { step: '5e4. STO01', status: sto01Result.generatedInstruction.active ? 'passed' : 'skipped', reason: sto01Result.generatedInstruction.active ? `principle=${sto01Result.routingDecision.primaryPrinciple}|intervention=${sto01Result.routingDecision.interventionType}|strength=${sto01Result.routingDecision.activationStrength}` : (sto01Result.routingDecision.reason ?? 'no stoic markers detected') },
      { step: '5e5. EliasAdvanced', status: eliasAdvancedResult.primaryModule !== 'NONE' ? 'passed' : 'skipped', reason: eliasAdvancedResult.primaryModule !== 'NONE' ? `module=${eliasAdvancedResult.primaryModule}|confidence=${eliasAdvancedResult.confidence.toFixed(2)}` : 'no advanced module markers detected' },
      { step: '5e6. EliasAdvancedP2', status: eliasAdvancedP2Result.primaryModule !== 'NONE' ? 'passed' : 'skipped', reason: eliasAdvancedP2Result.primaryModule !== 'NONE' ? `module=${eliasAdvancedP2Result.primaryModule}|confidence=${eliasAdvancedP2Result.confidence.toFixed(2)}` : 'no P2 advanced module markers detected' },
      { step: '5e7. EliasAdvancedP3', status: eliasAdvancedP3Result.primaryModule !== 'NONE' ? 'passed' : 'skipped', reason: eliasAdvancedP3Result.primaryModule !== 'NONE' ? `module=${eliasAdvancedP3Result.primaryModule}|confidence=${eliasAdvancedP3Result.confidence.toFixed(2)}|mode=${eliasAdvancedP3Result.responseMode}` : 'no P3 advanced module activation' },
      { step: '5e8. SLAAP01', status: eliasP4Result.slaap01Active || kimSlaap01Result.slaap01Active ? 'passed' : 'skipped', reason: eliasP4Result.slaap01Active ? `elias|mode=${eliasP4Result.slaap01ResponseMode}` : kimSlaap01Result.slaap01Active ? `kim|mode=${kimSlaap01Result.slaap01ResponseMode}` : 'no SLAAP01 activation' },
      { step: '5e9. Kim P2 (BEDR01/VETR01/GASL01)', status: kimAdvancedP2Result.activeModule ? 'passed' : 'skipped', reason: kimAdvancedP2Result.activeModule ? `kim|module=${kimAdvancedP2Result.activeModule}` : 'no Kim P2 activation' },
      { step: '5e10. Kim P3 (CDP01/RNW01)', status: kimAdvancedP3Result.activeModule ? 'passed' : 'skipped', reason: kimAdvancedP3Result.activeModule ? `kim|module=${kimAdvancedP3Result.activeModule}` : 'no Kim P3 activation' },
      { step: '5e11. Kim P4 (PAR01/FIN01)', status: kimAdvancedP4Result.activeModule ? 'passed' : 'skipped', reason: kimAdvancedP4Result.activeModule ? `kim|module=${kimAdvancedP4Result.activeModule}` : 'no Kim P4 activation' },
      { step: '5e12. Kim P5 (ISO01)', status: kimAdvancedP5Result.activeModule ? 'passed' : 'skipped', reason: kimAdvancedP5Result.activeModule ? `kim|module=${kimAdvancedP5Result.activeModule}` : 'no Kim P5 activation' },
      { step: '5e13. Kim P6 (HERV-K01/NAHERV-K01/CRISIS-K01)', status: kimAdvancedP6Result.activeModule ? 'passed' : 'skipped', reason: kimAdvancedP6Result.activeModule ? `kim|module=${kimAdvancedP6Result.activeModule}|overrides=${kimAdvancedP6Result.overridesLowerModules}` : 'no Relapse Cluster activation' },
      { step: '5e14. Kim P7 (GEVAAR-K01/KIND-K01)', status: kimAdvancedP7Result.activeModule ? 'passed' : 'skipped', reason: kimAdvancedP7Result.activeModule ? `kim|module=${kimAdvancedP7Result.activeModule}|overrides=${kimAdvancedP7Result.overridesLowerModules}|crisis=${kimAdvancedP7Result.crisisNumbersToShow.join(',')}` : 'no Danger/Child Cluster activation' },
      { step: '5e15. Kim P8 (ROL-K01/VETR02-K/LEUGEN-K01)', status: kimP8Result.active ? 'passed' : 'skipped', reason: kimP8Result.active ? `kim|module=${kimP8Result.moduleId}` : 'no Relational Dynamics activation' },
      { step: '5e16. Kim P9 (HOOP-K01/SCHAAM-K01/ROUW-K01/ISOL-K01)', status: kimP9Result.active ? 'passed' : 'skipped', reason: kimP9Result.active ? `kim|module=${kimP9Result.moduleId}` : 'no Emotional Loss activation' },
      { step: '5e17. Kim P10 (STOA-K)', status: kimP10Result.active ? 'passed' : 'skipped', reason: kimP10Result.active ? `kim|module=STOA-K|mode=${kimP10Result.detectionResult?.responseMode}` : 'no STOA-K activation' },
      { step: '6a. Zone decision', status: elisDecision ? 'passed' : 'skipped', reason: elisDecision ? `zone=${elisDecision.zone.computed.label}` : 'kim user' },
      { step: '6b. Engine directive', status: engineDirective ? 'passed' : 'skipped', reason: engineDirective ? `engine=${engineDirective.engine}` : 'none' },
      { step: '6c. Intervention', status: interventionContinuity ? 'passed' : 'skipped', reason: interventionContinuity ? `type=${interventionContinuity.lastInterventionType}` : 'not active' },
      { step: '7. GPT call', status: 'passed', reason: `model=${selectedModel ?? 'unknown'}` },
      { step: '8. Post-GPT update', status: 'passed', reason: `patterns=[${markedPatterns.join(',')}]` },
    ],
    zoneDecision: elisDecision ? {
      vspInput: vspLevel ?? null,
      vspSeverity: ({'GROEN':1,'LICHTGROEN':1,'GEEL':2,'ORANJE':3,'ROOD':4,'PAARS':5} as Record<string,number>)[vspLevel ?? ''] ?? null,
      computedZone: elisDecision.zone.computed.label,
      computedSeverity: ({'GROEN':1,'LICHTGROEN':1,'GEEL':2,'ORANJE':3,'ROOD':4} as Record<string,number>)[elisDecision.zone.computed.level] ?? 0,
      finalZone: elisDecision.zone.resolved?.finalZoneLabel ?? null,
      source: elisDecision.zone.resolved?.source ?? 'computed',
      reason: elisDecision.zone.resolved?.reason ?? '',
      isBlocked: elisDecision.isBlocked,
      isCrisis: elisDecision.zone.resolved?.isCrisis ?? false,
      relapseEscalation: relapseIntentResult?.detected ? {
        detected: true,
        source: relapseIntentResult.source,
        confidence: relapseIntentResult.confidence,
        escalatedTo: 'ORANJE',
        escalatedSeverity: 3,
      } : undefined,
    } : kimDecision ? {
      vspInput: null,
      vspSeverity: null,
      computedZone: kimDecision.zone.engine?.level ?? 'unknown',
      computedSeverity: ({'GROEN':1,'LICHTGROEN':1,'GEEL':2,'ORANJE':3,'ROOD':4} as Record<string,number>)[kimDecision.zone.engine?.level ?? ''] ?? 0,
      finalZone: kimDecision.zone.engine?.level ?? null,
      source: 'kim-engine',
      reason: 'kim-engine-zone',
      isBlocked: false,
      isCrisis: kimDecision.isKimCrisis,
      isKimCrisis: kimDecision.isKimCrisis,
      eigenRegieUserInput: kimDecision.eigenRegie?.userInput ?? null,
    } : null,
    regulation: {
      action: regulationResult.action,
      effectiveDepth: regulationResult.effectiveDepth,
      userDepth: currentUserDat.guidanceDepth ?? 'normal',
      wasSoftened: regulationResult.wasSoftened,
      wasSkipped: regulationResult.wasSkipped,
      gptInstruction: regulationResult.gptInstruction ?? null,
      resolvedZoneInput: resolvedZoneForRegulation,
      isFallbackZone: !elisDecision?.zone.resolved?.finalZoneLabel && !kimDecision?.zone.engine?.level,
    },
    moduleSelection: {
      dominantModule: preGPTDominantState.dominantModule,
      reason: preGPTDominantState.selectionReason,
      activeModules: [preGPTDominantState.dominantModule],
    },
    modelRouting: {
      selectedModel: selectedModel ?? 'unknown',
      riskScore: preGPTDominantState.riskScore,
      crisisLevel,
      finalZoneForRouting: elisDecision?.zone.resolved?.finalZoneLabel ?? kimDecision?.zone.engine?.level ?? undefined,
    },
    interventionContinuity: interventionContinuity ? {
      interventionType: interventionContinuity.lastInterventionType,
      interventionGoal: interventionContinuity.interventionGoal,
      linkedZone: interventionContinuity.linkedZone,
      effectivenessScore: interventionContinuity.effectivenessScore,
      userResponse: interventionContinuity.lastUserResponse,
      turnsActive: interventionContinuity.turnsActive,
      wasReEvaluated: false,
    } : null,
    projectionEntries: (() => {
      try {
        const ps = getProjectionState();
        return ps.entries.filter((e: ProjectionEntry) => e.isActive).map((e: ProjectionEntry) => ({
          category: e.category,
          content: e.content,
          strength: e.strength,
          decayScore: e.decayScore,
          source: e.source,
          action: projectionResult.injectionBlock ? 'injected' : 'stored',
        }));
      } catch { return []; }
    })(),
    nanoInterpret: serverNanoInterpretData ?? null,
    routeStatus: [
      { step: 'nano-interpret', route: 'railway' as const, status: serverNanoInterpretData ? 'succes' as const : 'gefaald' as const, detail: serverNanoInterpretData ? `module=${serverNanoInterpretData.resolvedModule}` : 'fallback naar keyword/backpack' },
      { step: 'gpt-chat', route: 'railway' as const, status: 'succes' as const, detail: `model=${selectedModel ?? 'unknown'}` },
      { step: 'zone-decision', route: 'client' as const, status: elisDecision || kimDecision ? 'succes' as const : 'overgeslagen' as const, detail: elisDecision ? `zone=${elisDecision.zone.computed.label}` : kimDecision ? `kim-engine` : 'geen zone' },
      { step: 'regulation', route: 'client' as const, status: regulationResult.wasSkipped ? 'overgeslagen' as const : 'succes' as const, detail: `action=${regulationResult.action}` },
      { step: 'module-selection', route: 'client' as const, status: 'succes' as const, detail: `module=${preGPTDominantState.dominantModule} (${preGPTDominantState.sourceLayer})` },
      { step: 'projection', route: 'client' as const, status: projectionResult.injectionBlock ? 'succes' as const : 'overgeslagen' as const, detail: projectionResult.injectionBlock ? 'injected' : 'geen actieve entries' },
      { step: 'session-end-summary', route: 'railway' as const, status: 'overgeslagen' as const, detail: 'alleen bij sessie-einde' },
    ],
    memory: {
      totalSessions: currentUserDat.totalSessions ?? 0,
      triggerPatterns: (currentUserDat.triggerPatterns || []).map(t => ({ trigger: t.trigger, count: t.count, weight: t.weight })),
      moduleUsage: (currentUserDat.moduleUsage || []).map((m) => ({ moduleId: m.moduleId, count: m.count || 1 })),
      changedUserDatFields: clientMemoryChangedFields.filter(f => f.startsWith('user.')),
      sliders: (currentUserDat.currentMood || {}) as unknown as Record<string, string | number>,
      changedStateFields: clientMemoryChangedFields.filter(f => f.startsWith('state.')),
      bufferZone: sessionBuffer.currentZoneColor,
      bufferEmotionalDirection: preGPTDominantState.dominantDirection,
      bufferLiveIntent: analysis.emotionalState || '',
      bufferDominantState: `${preGPTDominantState.dominantModule} (${preGPTDominantState.sourceLayer})`,
      backpackAnalysis: currentUserDat.backpackAnalysis ? {
        schemaCount: (currentUserDat.backpackAnalysis as any).schemas?.length ?? 0,
        modiCount: (currentUserDat.backpackAnalysis as any).modi?.length ?? 0,
        triggerCount: (currentUserDat.backpackAnalysis as any).triggers?.length ?? 0,
        analyzedAt: (currentUserDat.backpackAnalysis as any).analyzedAt ?? null,
      } : null,
      schemaTendencies: (currentUserDat.schemaTendencies || []).map((s: any) => ({ schemaId: s.schemaId, confidence: s.confidence ?? 0, last: (s.lastUpdatedAt || s.lastSeen || '').slice(0, 10) || null })),
      modeTendencies: (currentUserDat.modeTendencies || []).map((m: any) => ({ modeId: m.modeId, confidence: m.confidence ?? 0, last: (m.lastUpdatedAt || m.lastSeen || '').slice(0, 10) || null })),
    },
    contextDat: isSessionStart && context.contextDatSerialized ? {
      built: true,
      // FIX: Use the actual ContextDat object fields instead of regex on serialized string.
      // The serializer uses English headers ([SCHEMAS], [MODES], Session 1, etc.) which
      // didn't match the old Dutch regexes (/modus/, /dag/, /sessie/, /projectie/).
      keyFigures: contextDatObject?.keyFigures.length ?? 0,
      schemas: contextDatObject?.schemas.length ?? 0,
      modes: contextDatObject?.modes.length ?? 0,
      trendDays: contextDatObject?.sevenDayTrend.length ?? 0,
      sessionSummaries: contextDatObject?.sessionSummaries.length ?? 0,
      projections: contextDatObject?.activeProjections.length ?? 0,
      contextDatTokens: estimateTokens(context.contextDatSerialized),
      deepeningFragments: context.deepeningBlock ? (context.deepeningBlock.match(/\[DEEPENING/g) || []).length : 0,
      deepeningTokens: context.deepeningBlock ? estimateTokens(context.deepeningBlock) : 0,
      legacyDataDumpTokens: estimateTokens(JSON.stringify({ backpack: context.backpack, userDat: context.userDat, diary: context.diaryEntries })),
    } : null,
    payload: {
      isSessionStart,
      fieldsIncluded: isSessionStart
        ? (context.contextDatSerialized ? ['contextDat', 'deepeningBlock', 'moodSliders', 'bufferSnapshot', 'regulationResult', 'engineDirective'] : ['backpack', 'userDat', 'diaryEntries', 'moodSliders', 'bufferSnapshot', 'regulationResult', 'engineDirective', 'interventionContinuity', 'projectionContext', 'stoaContext'])
        : ['SLIM_LIVE_MESSAGE', 'core(~15)', ...[
            context.regulationResult && 'regulationResult',
            context.engineDirective && 'engineDirective',
            context.interventionContinuity && 'interventionContinuity',
            context.projectionContext && 'projectionContext',
            context.stoaContext && 'stoaContext',
            context.schemaModeContext && 'schemaModeContext',
            context.actContext && 'actContext',
            context.cgtContext && 'cgtContext',
            context.dgtContext && 'dgtContext',
            context.mbtContext && 'mbtContext',
          ].filter(Boolean) as string[]],
      promptBlocks: {
        regulation: regulationResult.action !== 'reflect' ? regulationResult.action : 'skipped',
        engineDirective: engineDirective ? 'yes' : 'no',
        intervention: interventionContinuity ? 'yes' : 'no',
        projection: projectionResult.injectionBlock ? 'yes' : 'no',
        retp: retpResult.activated ? `emotion=${retpResult.primaryEmotion}` : 'no',
        stoa: stoaResult.activated ? 'yes' : 'no',
        schemaMode: schemaModeResult.activated ? 'yes' : 'no',
        act: actResult.activated ? 'yes' : 'no',
        knownPatterns: currentUserDat.schemaTendencies?.some((s: any) => (s.confidence ?? 0) >= 0.35) || currentUserDat.modeTendencies?.some((m: any) => (m.confidence ?? 0) >= 0.35) || (currentUserDat.triggerPatterns?.length ?? 0) > 0 ? 'yes' : 'no',
        backpackAnalysis: currentUserDat.backpackAnalysis ? 'yes' : 'no',
      },
      chatContextJsonTokens: estimateTokens(JSON.stringify(context)),
      usedModel: selectedModel ?? 'unknown',
    },
    tokens: tokenUsage ? {
      promptTokens: tokenUsage.promptTokens,
      completionTokens: tokenUsage.completionTokens,
      totalTokens: tokenUsage.totalTokens,
      // NOTE: promptTokens is the ACTUAL token count from OpenAI for the full prompt
      // (system + user messages). chatContextJsonTokens above is just the ChatContext
      // struct serialized as JSON — a different (larger) number because it includes
      // raw data that gets transformed/filtered before injection into the prompt.
    } : null,
  };

  // Build and store the trace block
  buildTraceBlock(traceData);

  // ── Collect module activations for dashboard ──
  const moduleActivations: { id: string; confidence: number; mode: string }[] = [];
  if (kimAdvancedP2Result.activeModule) {
    const ctx = kimAdvancedP2Result.bedr01Context || kimAdvancedP2Result.vetr01Context || kimAdvancedP2Result.gasl01Context;
    moduleActivations.push({ id: kimAdvancedP2Result.activeModule, confidence: (ctx as any)?.confidence ?? 0.8, mode: (ctx as any)?.mode ?? 'active' });
  }
  if (kimAdvancedP3Result.activeModule) {
    const ctx = kimAdvancedP3Result.cdp01Context || kimAdvancedP3Result.rnw01Context;
    moduleActivations.push({ id: kimAdvancedP3Result.activeModule, confidence: (ctx as any)?.confidence ?? 0.8, mode: (ctx as any)?.mode ?? 'active' });
  }
  if (kimAdvancedP4Result.activeModule) {
    const ctx = kimAdvancedP4Result.par01Context || kimAdvancedP4Result.fin01Context;
    moduleActivations.push({ id: kimAdvancedP4Result.activeModule, confidence: (ctx as any)?.confidence ?? 0.8, mode: (ctx as any)?.mode ?? 'active' });
  }
  if (kimAdvancedP5Result.activeModule) {
    moduleActivations.push({ id: kimAdvancedP5Result.activeModule, confidence: 0.8, mode: 'active' });
  }
  if (kimAdvancedP6Result.activeModule) {
    moduleActivations.push({ id: kimAdvancedP6Result.activeModule, confidence: 0.95, mode: 'active' });
  }
  if (kimAdvancedP7Result.activeModule) {
    moduleActivations.push({ id: kimAdvancedP7Result.activeModule, confidence: 0.98, mode: 'active' });
  }
  const k06Status = (currentUserDat as any).k06StabilizationStatus ?? 'NOT_RUN';
  const crisisProtocolActive = analysis.riskLevel === 'critical' || crisisLevel >= 2;

  return {
    response,
    analysis,
    updatedRugzak,
    updatedUserDat,
    crisisLevel,
    showEmergency,
    dominantState: preGPTDominantState,
    bufferSnapshot,
    messageLog,
    traceData,
    moduleActivations,
    k06Status,
    crisisProtocolActive,
    candidateSignals: candidateSignals ?? null,
    schemaModeResult: schemaModeResult ? {
      activated: schemaModeResult.activated,
      modeDecision: schemaModeResult.modeDecision,
      schemaDecision: schemaModeResult.schemaDecision,
    } : null,
    psychoEducationActivation: psychoEducationActivation ?? null,
    paal01Activation: paal01Activation ?? null,
    selfAcceptanceActivation: selfAcceptanceActivation ?? null,
    kimPatternSupportActivation: kimPatternSupportActivation ?? null,
  };
}


// ─── Pattern Marking Helpers ─────────────────────────────────

/**
 * Mark a pattern signal in session-level state.
 * Increments repeat counter. Does NOT write to userDat.
 */
function markPatternSignal(signal: string, existingTriggers: import('../ai/types').TriggerPattern[]): void {
  const normalized = signal.toLowerCase();
  const existing = sessionPatternSignals.find((p) => p.signal === normalized);
  const now = LocalDeviceTimeService.now().utcIso;

  if (existing) {
    existing.repeatCount++;
    existing.lastSeen = now;
  } else {
    const wasPromoted = existingTriggers.some(
      (t) => t.trigger.toLowerCase() === normalized && t.count >= 2
    );
    sessionPatternSignals.push({
      signal: normalized,
      repeatCount: 1,
      firstSeen: now,
      lastSeen: now,
      previouslyPromoted: wasPromoted,
      cooldownUntil: null,
    });
  }
}

/**
 * Check if a pattern signal is in cooldown (anti-spam).
 * Same pattern cannot be promoted again within 24 hours.
 */
function isInCooldown(signal: PatternSignal): boolean {
  if (!signal.cooldownUntil) return false;
  return new Date(signal.cooldownUntil).getTime() > LocalDeviceTimeService.now().epochMs;
}

// ─── Generate Greeting ──────────────────────────────────────

/**
 * Generate an initial greeting through the pipeline.
 * Uses the same flow but with an empty user message.
 * Initializes the session buffer.
 */
export async function generateGreeting(
  rugzakOrBackpack: Rugzak | Backpack,
  provider: AIProvider,
  userDat?: UserDat,
  diaryEntries?: import('../ai/types').DiaryEntry[],
  options?: { locale?: 'nl' | 'en' | 'fr'; country?: 'NL' | 'BE' | 'FR' | 'UK' | 'US' }
): Promise<PipelineResult> {
  // Reset session state at greeting (session start)
  resetSessionState();

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
      intakeContext: { stageOfChange: ELIAS_DEFAULT_STAGE, ...rugzak.intakeContext },
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
      stageOfChange: ELIAS_DEFAULT_STAGE,
      gratitudeStreak: 0,
      lastGratitudeDate: null,
      sobrietyDate: null,
      lastMilestoneShown: null,
      clinicalModeActive: false,
      consecutiveSessionsWithoutEngagement: 0,
    };
  }

  // ── CONTEXT AWARENESS (greeting, non-blocking) ──
  // Pipeline NEVER blocks at greeting. Proceed to GPT regardless of context level.
  const hasSliders = currentUserDat.currentMood &&
    Object.values(currentUserDat.currentMood).some((v) => typeof v === 'number' && v !== 0 && v !== 5);
  const hasBackpackContent = backpack.sections &&
    backpack.sections.some((s) => s.content && s.content.trim().length > 10);
  const hasDiary = (diaryEntries ?? []).length > 0;
  const hasTriggerHistory = (currentUserDat.triggerPatterns ?? []).length > 0;
  const hasSessionHistory = (currentUserDat.totalSessions ?? 0) > 0;
  const hasVsp = backpack.userType === 'elias' && currentUserDat.currentMood && 'vsp' in currentUserDat.currentMood && (currentUserDat.currentMood as import('../ai/types').EliasMoodSliders).vsp != null;
  const hasEigenRegie = backpack.userType === 'kim' && currentUserDat.currentMood && 'eigenRegie' in currentUserDat.currentMood && (currentUserDat.currentMood as import('../ai/types').KimMoodSliders).eigenRegie != null;
  const hasMinimalContext = hasSliders || hasBackpackContent || hasDiary || hasTriggerHistory || hasSessionHistory || hasVsp || hasEigenRegie;
  // Note: hasMinimalContext is used downstream for tone adaptation but NEVER blocks the greeting.

  // Initialize buffer for session
  sessionBuffer = createBuffer();

  const analysis = analyzeState(rugzak, '');

  const sessionStartDate = currentUserDat.lastSessionDate ? new Date(currentUserDat.lastSessionDate) : new Date(LocalDeviceTimeService.now().epochMs);
  const sessionMinutes = Math.floor((LocalDeviceTimeService.now().epochMs - sessionStartDate.getTime()) / 60000);

  // Determine if backpack is empty (no sections filled)
  const isBackpackEmpty = backpack.userType === 'kim'
    ? !(backpack.kimBackpack && Object.values(backpack.kimBackpack).some((v: any) => v && typeof v === 'string' && v.trim().length > 0))
    : !(backpack.sections && backpack.sections.some((s) => s.content && s.content.trim().length > 0));

  // ── TIMESTAMP-BASED FILTERING ──────────────────────────────────
  // Apply time windows: mood=today, diary=2d, gratitude=2d, rugzak=4d
  const now = LocalDeviceTimeService.now().epochMs;
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
  const todayStart = new Date(LocalDeviceTimeService.now().epochMs); todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  // Filter diary entries: content within 2 days, gratitude within 2 days
  const allDiary = diaryEntries ?? [];
  const recentDiary = allDiary.filter(e => {
    const ts = new Date(e.timestamp).getTime();
    return (now - ts) <= TWO_DAYS_MS;
  });
  // Fallback: if no recent diary, use the most recent entry available
  const filteredDiary = recentDiary.length > 0 ? recentDiary : allDiary.slice(0, 1);

  // Mood sliders: use current (always today's state since user sets them live)
  // Rugzak/backpack: check if updated within 4 days
  const lastSessionTs = currentUserDat.lastSessionDate ? new Date(currentUserDat.lastSessionDate).getTime() : 0;
  const backpackUpdatedRecently = backpack.sections?.some(
    (s) => s.lastUpdated && (now - new Date(s.lastUpdated).getTime()) <= FOUR_DAYS_MS
  ) ?? false;

  // VSP level for greeting context
  const currentMood = currentUserDat.currentMood;
  const vspLevel: string | null = backpack.userType === 'elias' && currentMood && 'vsp' in currentMood
    ? (currentMood as import('../ai/types').EliasMoodSliders).vsp
    : null;

  // ── VSP Intake Adapters: extract signals from intake data at SESSION_INIT ──
  const intakeAdapterResult = runVspIntakeAdapters({
    stageOfChange: backpack.intakeContext?.stageOfChange ?? null,
    intakeDate: (backpack as any).intakeCompletedAt ?? new Date().toISOString(),
    vspZones: backpack.vspSection?.zones ? {
      green: backpack.vspSection.zones.green ? { signals: backpack.vspSection.zones.green.signals || '' } : undefined,
      yellow: backpack.vspSection.zones.yellow ? { signals: backpack.vspSection.zones.yellow.signals || '' } : undefined,
      orange: backpack.vspSection.zones.orange ? { signals: backpack.vspSection.zones.orange.signals || '' } : undefined,
      red: backpack.vspSection.zones.red ? { signals: backpack.vspSection.zones.red.signals || '' } : undefined,
    } : undefined,
    vspLastUpdated: (backpack.vspSection as any)?.lastUpdated ?? null,
    sections: backpack.sections ?? undefined,
    anchorSentences: backpack.vspSection?.zones ? {
      green: backpack.vspSection.zones.green?.anchorSentence,
      yellow: backpack.vspSection.zones.yellow?.anchorSentence,
      orange: backpack.vspSection.zones.orange?.anchorSentence,
      red: backpack.vspSection.zones.red?.anchorSentence,
    } : undefined,
    kimBackpack: backpack.userType === 'kim' ? {
      my_story: (backpack as any).kimSections?.my_story ?? '',
      the_relationship: (backpack as any).kimSections?.the_relationship ?? '',
      the_impact: (backpack as any).kimSections?.the_impact ?? '',
      my_boundaries: (backpack as any).kimSections?.my_boundaries ?? '',
      my_strength: (backpack as any).kimSections?.my_strength ?? '',
    } : undefined,
  });
  console.log(`[Pipeline] VSP Intake Adapters: wheelOfChange=${intakeAdapterResult.wheelOfChange.currentStage}, earlySigns=${intakeAdapterResult.selfReportedEarlySigns.length}, observedSigns=${intakeAdapterResult.observedEarlySigns.length}`);

  // Merge intake adapter results into VspInsightProfile (async, fire-and-forget for greeting speed)
  let greetingVspProfile: import('../../src/features/vspInsight/vspInsightTypes').VspInsightProfile | null = null;
  if (intakeAdapterResult.selfReportedEarlySigns.length > 0 || intakeAdapterResult.observedEarlySigns.length > 0) {
    try {
      const { applyVspInsightProfilePatch } = await import('../../src/features/vspInsight/vspInsightStorage');
      greetingVspProfile = await applyVspInsightProfilePatch(
        'local_user',
        backpack.userType as 'elias' | 'kim',
        {
          profileVersion: 'vsp_insight_profile.v1',
          persona: backpack.userType as 'elias' | 'kim',
          updatedAt: new Date().toISOString(),
          upsertSelfReportedEarlySigns: intakeAdapterResult.selfReportedEarlySigns,
          upsertObservedEarlySigns: intakeAdapterResult.observedEarlySigns,
          upsertPhaseTransitionExamples: [],
          upsertDiscrepancyEvents: [],
        }
      );
      console.log(`[Pipeline] VSP Intake: profile patched with ${intakeAdapterResult.selfReportedEarlySigns.length} self-reported + ${intakeAdapterResult.observedEarlySigns.length} observed signs`);
    } catch (e) {
      console.warn('[Pipeline] VSP Intake profile patch failed (non-blocking):', e);
    }
  }

  // ── VSP Insight Layer for greeting ──
  const greetingVspResult = runVspInsightLayer({
    persona: backpack.userType as 'elias' | 'kim',
    userMessage: '',
    recentMessages: [],
    moodSliders: {
      craving: (currentMood as any)?.craving ?? 0,
      frustration: (currentMood as any)?.frustration ?? 0,
      despondency: (currentMood as any)?.despondency ?? 0,
      focus: (currentMood as any)?.focus ?? 5,
    },
    selfReportedZone: (vspLevel ?? 'GROEN') as any,
    sessionTurnCount: 0,
    safetyCore: {
      finalZone: (vspLevel ?? 'GROEN') as any,
      userReportedZone: (vspLevel ?? 'GROEN') as any,
      safetyOverrideActive: analysis.riskLevel === 'critical',
      crisisDetected: false,
      relapseIntentDetected: false,
      modelRoutingDecision: 'gpt-4o-mini',
      activeSafetyModuleId: null,
    },
    profile: greetingVspProfile,
  });
  // ══════════════════════════════════════════════════════════════
  // SERVER-LED GREETING (same pattern as processMessage server block)
  // ══════════════════════════════════════════════════════════════
  if (isServerEngineActive()) {
    try {
      const serverInput: ServerEngineCallInput = {
        persona: backpack.userType as any,
        userName: backpack.naam,
        locale: (options?.locale || 'nl') as 'nl' | 'en' | 'fr',
        country: (options?.country || 'BE') as 'NL' | 'BE' | 'FR' | 'UK' | 'US',
        guidanceDepth: currentUserDat.guidanceDepth ?? 'normal',
        clinicalModeActive: currentUserDat.clinicalModeActive ?? false,
        localUserId: backpack.naam,
        userMessage: '',
        conversationHistory: [],
        moodSliders: (currentUserDat.currentMood || {}) as any,
        isSessionStart: true,
        vspSection: vspLevel ? { level: vspLevel as 'GROEN' | 'LICHTGROEN' | 'GEEL' | 'ORANJE' | 'ROOD' | 'PAARS', score: 0 } : null,
        logsSessions: [],
        userDatSummary: {
          totalSessions: currentUserDat.totalSessions ?? 0,
          stageOfChange: (currentUserDat as any).stageOfChange ?? 'contemplation',
          sobrietyDate: (currentUserDat as any).sobrietyDate ?? null,
          lastMilestoneShown: (currentUserDat as any).lastMilestoneShown ?? null,
          gratitudeStreak: (currentUserDat as any).gratitudeStreak ?? 0,
          consecutiveSessionsWithoutEngagement: (currentUserDat as any).consecutiveSessionsWithoutEngagement ?? 0,
        } as any,
        usedModules: [],
        previousZoneScore: 0,
        messageCount: 0,
        sessionStartedAtIso: new Date().toISOString(),
        apiBaseUrl: getApiBaseUrl(),
        backpack: backpack,
        userDat: currentUserDat,
        diaryEntries: filteredDiary,
        requestType: 'greeting',
      };

      const serverResult = await callServerEngine(serverInput);

      if (serverResult.success && serverResult.responseText) {
        // Parse engine signals from server greeting
        const parsed = parseEngineResponse(serverResult.responseText);
        const greetingText = parsed.clinicalBlock
          ? parsed.userText + `\n\n<clinical>${parsed.clinicalBlock}</clinical>`
          : parsed.userText;

        const nowIso = LocalDeviceTimeService.now().utcIso;
        const aiMsg: ChatMessage = {
          id: `msg_${LocalDeviceTimeService.now().epochMs}`,
          role: 'assistant',
          content: greetingText,
          timestamp: nowIso,
          modulesUsed: analysis.priorityModules,
        };

        const updatedUserDat: UserDat = {
          ...currentUserDat,
          chatHistory: [...(currentUserDat.chatHistory || []), aiMsg],
        };

        const updatedRugzak = composeRugzak(backpack, updatedUserDat);

        console.log('[Pipeline] SERVER-LED greeting generated successfully');

        return {
          response: greetingText,
          analysis,
          updatedRugzak,
          updatedUserDat,
          crisisLevel: 0,
          showEmergency: false,
          moduleActivations: [],
          k06Status: (updatedUserDat as any).k06StabilizationStatus ?? 'NOT_RUN',
          crisisProtocolActive: false,
        };
      }

      // Server failed — fall through to client greeting
      console.warn('[Pipeline] Server greeting failed, falling back to client:', serverResult.error);
    } catch (greetingErr) {
      console.warn('[Pipeline] Server greeting exception, falling back to client:', greetingErr);
    }
  }

  // ── CLIENT GREETING FALLBACK (deprecated — only runs when server fails) ──
  const context: ChatContext = {
    userType: backpack.userType,
    userName: backpack.naam,
    currentMessage: '',
    // SESSION_START: pass EMPTY conversationHistory so GPT generates a fresh greeting.
    // The full chatHistory is preserved in userDat for context-awareness (diary, triggers, etc.)
    // but NOT sent as conversation messages — otherwise GPT continues from the last session.
    conversationHistory: [],
    moodSliders: currentUserDat.currentMood || (ELIAS_DEFAULT_MOOD as any),
    rugzak,
    backpack,
    userDat: currentUserDat,
    isSessionStart: true,
    diaryEntries: filteredDiary,
    activeModules: [analysis.priorityModules[0] || (backpack.userType === 'elias' ? ELIAS_DEFAULT_MODULE : KIM_DEFAULT_MODULE)],
    crisisLevel: 0,
    detectedEmotion: analysis.emotionalState,
    therapeuticStance: buildTherapeuticStance(analysis),
    sessionDurationMinutes: sessionMinutes,
    urgency: backpack.intakeContext?.urgency ?? 'midden',
    startEmotion: backpack.intakeContext?.startEmotion ?? '',
    guidanceDepth: currentUserDat.guidanceDepth ?? 'normal',
    backpackEmpty: isBackpackEmpty,
    extractedEntities: currentUserDat.extractedEntities ?? undefined,
    backpackChanged: backpackUpdatedRecently || !currentUserDat.extractedEntities || (currentUserDat.extractedEntities.persons.length === 0),
    vspLevel,
    vspInsightContext: greetingVspResult.active ? greetingVspResult.contextString || undefined : undefined,
    locale: options?.locale,
    country: options?.country,
  };

  let response: string;
  try {
    const result = await provider.generateResponse(context);
    // Strip <engine_signals> and <clinical> tags from greeting before displaying
    // Static import used (Metro bundler cannot resolve dynamic import on device)
    const parsed = parseEngineResponse(result.response);
    response = parsed.clinicalBlock
      ? parsed.userText + `\n\n<clinical>${parsed.clinicalBlock}</clinical>`
      : parsed.userText;
  } catch (error) {
    console.error('Greeting generation error:', error);
    const name = backpack.naam;
    response = backpack.userType === 'elias'
      ? `Hey ${name}, glad you're here. How are you feeling today?`
      : `Hello ${name}, good that you're taking some time for yourself.`;
  }

  // Add greeting to userDat history
  const aiMsg: ChatMessage = {
    id: `msg_${LocalDeviceTimeService.now().epochMs}`,
    role: 'assistant',
    content: response,
    timestamp: LocalDeviceTimeService.now().utcIso,
    modulesUsed: analysis.priorityModules,
  };

  const updatedUserDat: UserDat = {
    ...currentUserDat,
    chatHistory: [...(currentUserDat.chatHistory || []), aiMsg],
  };

  const updatedRugzak = composeRugzak(backpack, updatedUserDat);

  console.log('[Pipeline] SESSION_INIT greeting generated, buffer initialized');

  return {
    response,
    analysis,
    updatedRugzak,
    updatedUserDat,
    crisisLevel: 0,
    showEmergency: false,
    moduleActivations: [],
    k06Status: (updatedUserDat as any).k06StabilizationStatus ?? 'NOT_RUN',
    crisisProtocolActive: false,
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
  /** Promotion result from session-end evaluation */
  promotionResult?: PromotionResult;
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
 * SESSION-END FLOW:
 * 1. Analyze the full session
 * 2. Generate farewell through AI (ONE GPT call)
 * 3. Ranked promotion evaluation (by score, not FCFS), apply top 5
 * 4. Update UserDat with promotions + session analysis
 * 5. Archive old chat history
 *
 * DUAL-STORE RULES:
 * - Backpack is NEVER modified
 * - Only UserDat is updated
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
      intakeContext: { stageOfChange: ELIAS_DEFAULT_STAGE, ...rugzak.intakeContext },
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
      stageOfChange: ELIAS_DEFAULT_STAGE,
      gratitudeStreak: 0,
      lastGratitudeDate: null,
      sobrietyDate: null,
      lastMilestoneShown: null,
      clinicalModeActive: false,
      consecutiveSessionsWithoutEngagement: 0,
    };
  }

  // ── STEP 1: Analyze the full session ──
  const sessionMessages = currentUserDat.chatHistory || [];
  const sessionStartDate = currentUserDat.lastSessionDate ? new Date(currentUserDat.lastSessionDate) : new Date(LocalDeviceTimeService.now().epochMs);
  const durationMinutes = Math.floor((LocalDeviceTimeService.now().epochMs - sessionStartDate.getTime()) / 60000);

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
      ? eliasDistressScore(firstSliders as any)
      : kimDistressScore(firstSliders as any);
    const lastDistress = userType === 'elias'
      ? eliasDistressScore(lastSliders as any)
      : kimDistressScore(lastSliders as any);
    distressChange = lastDistress - firstDistress;
    const firstResilience = userType === 'elias' ? eliasResilienceScore(firstSliders as any) : kimResilienceScore(firstSliders as any);
    const lastResilience = userType === 'elias' ? eliasResilienceScore(lastSliders as any) : kimResilienceScore(lastSliders as any);
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

  // ── STEP 2: Generate farewell through AI (ONE GPT call) ──
  const context: ChatContext = {
    userType: backpack.userType,
    userName: backpack.naam,
    currentMessage: '__SESSION_END__',
    conversationHistory: currentUserDat.chatHistory || [],
    moodSliders: currentUserDat.currentMood || (ELIAS_DEFAULT_MOOD as any),
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
    guidanceDepth: currentUserDat.guidanceDepth ?? 'normal',
  };

  let farewell: string;
  try {
    const result = await provider.generateResponse(context);
    farewell = result.response;
  } catch (error) {
    console.error('Farewell generation error:', error);
    const name = backpack.naam;
    farewell = backpack.userType === 'elias'
      ? `${name}, ik heb alles uit ons gesprek bewaard. Je hebt vandaag echte moed getoond. Zorg goed voor jezelf, en ik ben er wanneer je me nodig hebt.`
      : `${name}, ik heb alles uit ons gesprek bewaard. Wat je doet voor je naaste is belangrijk. Zorg ook goed voor jezelf, en ik ben er wanneer je klaar bent.`;
  }

  // ── STEP 3: Ranked promotion evaluation ──
  // Use the session buffer for promotion evaluation.
  // Promotions are ranked by score (confidence + weightDelta), NOT first-come-first-served.
  let promotionResult: PromotionResult | undefined;
  if (sessionBuffer) {
    promotionResult = evaluatePromotions(
      sessionBuffer,
      currentUserDat.triggerPatterns || [],
      sessionWasCrisis,
      sessionDominantModuleChanged,
      sessionRelationalConfidence,
    );

    console.log(`[Pipeline] SESSION_END: ${promotionResult.promotedItems.length} promotions (${promotionResult.rejectedItems.length} rejected, max=${promotionResult.maxReached})`);
    for (const promo of promotionResult.promotedItems) {
      console.log(`[Pipeline]   PROMOTED: ${promo.signal} (${promo.reason}, confidence=${promo.confidence}, weight+=${promo.weightDelta})`);
    }
    for (const rejected of promotionResult.rejectedItems) {
      console.log(`[Pipeline]   REJECTED: ${rejected.signal} (${rejected.reason}, confidence=${rejected.confidence})`);
    }
  }

  // ── STEP 4: Update UserDat ONLY (backpack is NEVER modified) ──
  const farewellMsg: ChatMessage = {
    id: `msg_${LocalDeviceTimeService.now().epochMs}`,
    role: 'assistant',
    content: farewell,
    timestamp: LocalDeviceTimeService.now().utcIso,
  };

  let updatedUserDat: UserDat = {
    ...currentUserDat,
    chatHistory: [...(currentUserDat.chatHistory || []), farewellMsg],
  };

  // Apply ranked promotions to user.dat trigger patterns
  if (promotionResult && promotionResult.promotedItems.length > 0) {
    updatedUserDat = {
      ...updatedUserDat,
      triggerPatterns: applyPromotions(
        updatedUserDat.triggerPatterns || [],
        promotionResult.promotedItems,
      ),
    };
  }

  // ── Projection Decay (session-end) ──
  // Apply decay to projection entries that were not reinforced this session.
  // Runs directly after UserDat promotion, within the same session-end block.
  const sessionEndTimestamp = LocalDeviceTimeService.now().utcIso;
  if (backpack.userType === 'elias') {
    const decayResult = await applyProjectionDecay(sessionEndTimestamp);
    if (decayResult.decayedEntries > 0 || decayResult.removedEntries > 0) {
      console.log(`[Pipeline] Projection decay (Elias): decayed=${decayResult.decayedEntries}, removed=${decayResult.removedEntries}`);
    }
  } else {
    const decayResult = await applyKimProjectionDecay(sessionEndTimestamp);
    if (decayResult.decayedEntries > 0 || decayResult.removedEntries > 0) {
      console.log(`[Pipeline] Projection decay (Kim): decayed=${decayResult.decayedEntries}, removed=${decayResult.removedEntries}`);
    }
  }

  // Update trigger patterns from session-wide signals
  if (newTriggers.length > 0) {
    updatedUserDat = {
      ...updatedUserDat,
      triggerPatterns: updateTriggerPatterns(updatedUserDat.triggerPatterns || [], newTriggers),
    };
  }

  // Record mood snapshot at session end
  if (updatedUserDat.currentMood) {
    const snapshot = {
      timestamp: LocalDeviceTimeService.now().utcIso,
      sliders: sanitizeSliders(updatedUserDat.currentMood as unknown as Record<string, unknown>) as unknown as import('../ai/types').MoodSliders,
    };
    updatedUserDat = {
      ...updatedUserDat,
      moodHistory: [...(updatedUserDat.moodHistory || []), snapshot],
    };
  }

  // Add session analysis record to userDat
  const analysisRecord = {
    sessionNumber: currentUserDat.totalSessions,
    date: LocalDeviceTimeService.now().utcIso,
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

  // ── STEP 5a: Persist STOA session usage (cross-session cooldown) ──
  const stoaState = getStoaSessionState();
  if (stoaState.activated && stoaState.sessionId != null) {
    const existingStoa = updatedUserDat.stoaSessionsUsed ?? [];
    // Update or add the session usage record
    const filtered = existingStoa.filter(s => s.sessionId !== stoaState.sessionId);
    filtered.push({ sessionId: stoaState.sessionId, usedAtSession: currentUserDat.totalSessions });
    updatedUserDat = { ...updatedUserDat, stoaSessionsUsed: filtered };
    console.log(`[Pipeline] STOA persistence: session ${stoaState.sessionId} recorded at session #${currentUserDat.totalSessions}`);
  }

  // ── STEP 5a2: Schema/Mode tendency persistence with decay (hybrid model — patterns only, never identity) ──
  {
    const activatedModes = getSessionActivatedModes();
    const now = LocalDeviceTimeService.now().utcIso;
    const DECAY_RATE = 0.10; // 10% decay per session for unseen tendencies
    const PRUNE_THRESHOLD = 0.1; // Remove entries below this score
    const MAX_TENDENCIES = 10; // Cap per category

    // --- Mode tendencies: increment seen, decay unseen, prune, cap ---
    let modeTendencies = [...(updatedUserDat.modeTendencies ?? [])];
    for (const t of modeTendencies) {
      if (activatedModes.includes(t.modeId as ModeId)) {
        // Seen this session: increment frequency, update lastSeen
        t.frequency += 1;
        t.lastSeen = now;
      } else {
        // Not seen: decay by 10%
        t.frequency = t.frequency * (1 - DECAY_RATE);
      }
    }
    // Add new modes not yet in tendencies
    for (const modeId of activatedModes) {
      if (!modeTendencies.find(t => t.modeId === modeId)) {
        modeTendencies.push({ modeId, frequency: 1, lastSeen: now, effectiveInterventions: [] });
      }
    }
    // Prune below threshold
    modeTendencies = modeTendencies.filter(t => t.frequency >= PRUNE_THRESHOLD);
    // Cap at max 10 (keep highest frequency)
    if (modeTendencies.length > MAX_TENDENCIES) {
      modeTendencies.sort((a, b) => b.frequency - a.frequency);
      modeTendencies = modeTendencies.slice(0, MAX_TENDENCIES);
    }
    // Apply auto-confirmation to modes meeting threshold (freq≥5 AND conf≥0.7)
    modeTendencies = applyAutoConfirmation(modeTendencies, now);
    updatedUserDat = { ...updatedUserDat, modeTendencies };

    // --- Schema tendencies: decay unseen, prune, cap ---
    const activatedSchemas = getSessionActivatedSchemas();
    let schemaTendencies = [...(updatedUserDat.schemaTendencies ?? [])];
    for (const t of schemaTendencies) {
      if (activatedSchemas.includes(t.schemaId as SchemaId)) {
        // Seen this session: increment frequency, update lastSeen
        t.frequency += 1;
        t.lastSeen = now;
      } else {
        // Not seen: decay by 10%
        t.frequency = t.frequency * (1 - DECAY_RATE);
      }
    }
    // Add new schemas not yet in tendencies
    for (const schemaId of activatedSchemas) {
      if (!schemaTendencies.find(t => t.schemaId === schemaId)) {
        schemaTendencies.push({ schemaId, domain: 'unknown', frequency: 1, lastSeen: now, copingStyle: null });
      }
    }
    // Prune below threshold
    schemaTendencies = schemaTendencies.filter(t => t.frequency >= PRUNE_THRESHOLD);
    // Cap at max 10
    if (schemaTendencies.length > MAX_TENDENCIES) {
      schemaTendencies.sort((a, b) => b.frequency - a.frequency);
      schemaTendencies = schemaTendencies.slice(0, MAX_TENDENCIES);
    }
    // Apply auto-confirmation to schemas meeting threshold (freq≥5 AND conf≥0.7)
    schemaTendencies = applyAutoConfirmation(schemaTendencies, now);
    updatedUserDat = { ...updatedUserDat, schemaTendencies };

    const decayedModes = modeTendencies.length;
    const decayedSchemas = schemaTendencies.length;
    console.log(`[Pipeline] Tendency persistence: modes=${decayedModes} (activated=${activatedModes.length}), schemas=${decayedSchemas} (activated=${activatedSchemas.length})`);
  }

  // ── STEP 4d: ACT progress persistence ──
  {
    const actProcessesUsed = getSessionACTProcessesUsed();
    if (actProcessesUsed.length > 0) {
      const actNow = LocalDeviceTimeService.now().utcIso;
      const existingProgress = updatedUserDat.actProgress ?? createDefaultACTProgress();
      const updatedProgress = { ...existingProgress };
      updatedProgress.lastACTProcessUsed = actProcessesUsed[actProcessesUsed.length - 1];
      updatedProgress.lastACTSessionDate = actNow;
      updatedUserDat = { ...updatedUserDat, actProgress: updatedProgress };
      console.log(`[Pipeline] ACT persistence: processes_used=${actProcessesUsed.length}, last=${updatedProgress.lastACTProcessUsed}`);
    }
  }

  // ── STEP 4e: CBT/CGT progress persistence ──
  {
    const cbtProcessesUsed = getSessionCBTProcessesUsed();
    if (cbtProcessesUsed.length > 0) {
      const cbtNow = LocalDeviceTimeService.now().utcIso;
      const existingCBTProgress = updatedUserDat.cgtProgress ?? createDefaultCBTProgress();
      const updatedCBTProgress = { ...existingCBTProgress };
      updatedCBTProgress.lastCBTProcessUsed = cbtProcessesUsed[cbtProcessesUsed.length - 1];
      updatedCBTProgress.lastCBTSessionDate = cbtNow;
      updatedUserDat = { ...updatedUserDat, cgtProgress: updatedCBTProgress };
      console.log(`[Pipeline] CBT persistence: processes_used=${cbtProcessesUsed.length}, last=${updatedCBTProgress.lastCBTProcessUsed}`);
    }
  }

  // ── STEP 4f: DGT/DBT progress persistence ──
  {
    const dgtProcessesUsed = getSessionDGTProcessesUsed();
    if (dgtProcessesUsed.length > 0) {
      const dgtNow = LocalDeviceTimeService.now().utcIso;
      const existingDGTProgress = updatedUserDat.dgtProgress ?? createDefaultDGTProgress();
      const updatedDGTProgress = { ...existingDGTProgress };
      updatedDGTProgress.lastDGTProcessUsed = dgtProcessesUsed[dgtProcessesUsed.length - 1];
      updatedDGTProgress.lastDGTSessionDate = dgtNow;
      updatedUserDat = { ...updatedUserDat, dgtProgress: updatedDGTProgress };
      console.log(`[Pipeline] DGT persistence: processes_used=${dgtProcessesUsed.length}, last=${updatedDGTProgress.lastDGTProcessUsed}`);
    }
  }

  // ── STEP 4g: MBT++ progress persistence ──
  {
    const mbtProcessesUsed = getSessionMBTProcessesUsed();
    if (mbtProcessesUsed.length > 0) {
      const mbtNow = LocalDeviceTimeService.now().utcIso;
      const existingMBTProgress = updatedUserDat.mbtProgress ?? createDefaultMBTProgress();
      const updatedMBTProgress = { ...existingMBTProgress };
      updatedMBTProgress.lastMBTProcessUsed = mbtProcessesUsed[mbtProcessesUsed.length - 1];
      updatedMBTProgress.lastMBTSessionDate = mbtNow;
      updatedUserDat = { ...updatedUserDat, mbtProgress: updatedMBTProgress };
      console.log(`[Pipeline] MBT persistence: processes_used=${mbtProcessesUsed.length}, last=${updatedMBTProgress.lastMBTProcessUsed}`);
    }
  }

  // ── STEP 4h: KO1 Recognition & Validation progress persistence ──
  if (backpack.userType === 'kim') {
    const ko1PatternsUsed = getSessionKO1PatternsUsed();
    if (ko1PatternsUsed.length > 0) {
      const ko1Now = LocalDeviceTimeService.now().utcIso;
      const existingKO1Progress = (updatedUserDat as any).ko1Progress ?? createDefaultKO1Progress();
      const updatedKO1Progress = { ...existingKO1Progress };
      updatedKO1Progress.lastPatternDetected = ko1PatternsUsed[ko1PatternsUsed.length - 1];
      updatedKO1Progress.lastSessionDate = ko1Now;
      if (ko1PatternsUsed.includes('BURNOUT_RED_STATE')) {
        updatedKO1Progress.burnoutSignalCount = (updatedKO1Progress.burnoutSignalCount ?? 0) + 1;
      }
      if (ko1PatternsUsed.includes('REASSURANCE_ADDICTION')) {
        updatedKO1Progress.reassuranceLoopCount = (updatedKO1Progress.reassuranceLoopCount ?? 0) + 1;
      }
      updatedUserDat = { ...updatedUserDat, ko1Progress: updatedKO1Progress } as any;
      console.log(`[Pipeline] KO1 persistence: patterns_used=${ko1PatternsUsed.length}, last=${updatedKO1Progress.lastPatternDetected}`);
    }
  }

  // ── STEP 4i: K05 Communication Skills progress persistence ──
  if (backpack.userType === 'kim') {
    const k05ModesUsed = getSessionK05ModesUsed();
    if (k05ModesUsed.length > 0) {
      const k05Now = LocalDeviceTimeService.now().utcIso;
      const existingK05Progress = (updatedUserDat as any).k05Progress ?? createDefaultK05Progress();
      const updatedK05Progress = { ...existingK05Progress };
      updatedK05Progress.lastCommunicationMode = k05ModesUsed[k05ModesUsed.length - 1];
      updatedK05Progress.lastSessionDate = k05Now;
      if (k05ModesUsed.includes('PAUSE_CONVERSATION') || k05ModesUsed.includes('DE_ESCALATE')) {
        updatedK05Progress.escalationPatternsDetected = (updatedK05Progress.escalationPatternsDetected ?? 0) + 1;
      }
      updatedUserDat = { ...updatedUserDat, k05Progress: updatedK05Progress } as any;
      console.log(`[Pipeline] K05 persistence: modes_used=${k05ModesUsed.length}, last=${updatedK05Progress.lastCommunicationMode}`);
    }
  }

  // ── STEP 4j: K02 Enabling Awareness progress persistence ──
  if (backpack.userType === 'kim') {
    const k02FlagsUsed = getSessionK02FlagsUsed();
    const k02StatesUsed = getSessionK02InterventionStates();
    if (k02FlagsUsed.length > 0) {
      const k02Now = LocalDeviceTimeService.now().utcIso;
      const existingK02Progress = (updatedUserDat as any).k02Progress ?? createDefaultK02Progress();
      const updatedK02Progress = { ...existingK02Progress };
      updatedK02Progress.lastSessionDate = k02Now;
      updatedK02Progress.sessionCount = (updatedK02Progress.sessionCount ?? 0) + 1;
      // Track dominant flags
      const uniqueFlags = [...new Set(k02FlagsUsed)];
      updatedK02Progress.dominantFlags = uniqueFlags;
      // Update awareness level based on session count
      if (updatedK02Progress.sessionCount >= 3) updatedK02Progress.awarenessLevel = 'clear';
      else if (updatedK02Progress.sessionCount >= 1) updatedK02Progress.awarenessLevel = 'emerging';
      // Track microboundary if boundary warning was used
      if (k02StatesUsed.includes('BOUNDARY_WARNING') || k02StatesUsed.includes('CLEAR_REALITY_CHECK')) {
        updatedK02Progress.microboundaryAttempted = true;
      }
      updatedUserDat = { ...updatedUserDat, k02Progress: updatedK02Progress } as any;
      console.log(`[Pipeline] K02 persistence: flags_used=${k02FlagsUsed.length}, awareness=${updatedK02Progress.awarenessLevel}`);
    }

    // K04 Emotional Regulation persistence — re-detect from full session text
    const k04SessionDetection = detectK04EmotionalState(allUserText, userMessages.map(m => m.content).slice(-3));
    if (k04SessionDetection.activated) {
      const existingK04Progress = (updatedUserDat as any).k04Progress;
      const k04SessionResult = routeK04Engine(k04SessionDetection, existingK04Progress);
      const updatedK04Progress = updateK04Progress(existingK04Progress, k04SessionDetection, k04SessionResult.selectedMicrotool);
      updatedUserDat = { ...updatedUserDat, k04Progress: updatedK04Progress } as any;
      console.log(`[Pipeline] K04 persistence: state=${k04SessionDetection.primaryState}, severity=${k04SessionDetection.severity}, trend=${updatedK04Progress.emotionalStabilityTrend}`);
    }

    // K04-S4 Betrayal/Trust/Hope persistence — re-detect from full session text
    const k04s4SessionDetection = detectK04S4State(allUserText, userMessages.map(m => m.content).slice(-3));
    if (k04s4SessionDetection.activated) {
      const existingK04S4Progress = (updatedUserDat as any).k04s4Progress;
      const k04s4SessionResult = routeK04S4Engine(k04s4SessionDetection, existingK04S4Progress);
      const updatedK04S4Progress = updateK04S4Progress(existingK04S4Progress, k04s4SessionDetection, k04s4SessionResult.responseMode);
      updatedUserDat = { ...updatedUserDat, k04s4Progress: updatedK04S4Progress } as any;
      console.log(`[Pipeline] K04-S4 persistence: state=${k04s4SessionDetection.primaryState}, severity=${k04s4SessionDetection.severity}, trend=${updatedK04S4Progress.trustRecoveryTrend}`);
    }

    // K06 Self-Care & Sustainable Support persistence — re-detect from full session text
    const k06SessionDetection = detectK06State(allUserText, userMessages.map(m => m.content).slice(-3));
    if (k06SessionDetection.activated) {
      const existingK06Progress = (updatedUserDat as any).k06Progress;
      const k06SessionResult = routeK06Engine(k06SessionDetection, existingK06Progress);
      const updatedK06Progress = updateK06Progress(existingK06Progress, k06SessionDetection, k06SessionResult.responseMode);
      updatedUserDat = { ...updatedUserDat, k06Progress: updatedK06Progress } as any;
      console.log(`[Pipeline] K06 persistence: state=${k06SessionDetection.primaryState}, severity=${k06SessionDetection.severity}, sustainability=${k06SessionDetection.sustainabilityLevel}`);
    }

    // K01 Boundary Setting persistence — re-detect from full session text
    const k01SessionDetection = detectK01BoundaryState(allUserText, userMessages.map(m => m.content).slice(-3));
    if (k01SessionDetection.activated) {
      const existingK01Progress = (updatedUserDat as any).k01Progress;
      const k01BoundarySlider = (updatedUserDat.currentMood as any)?.boundaryFatigue ?? 3;
      const k01SessionResult = routeK01Engine(k01SessionDetection, k01BoundarySlider, existingK01Progress);
      const updatedK01Progress = updateK01Progress(existingK01Progress, k01SessionDetection, k01SessionResult.interventionType);
      updatedUserDat = { ...updatedUserDat, k01Progress: updatedK01Progress } as any;
      console.log(`[Pipeline] K01 persistence: state=${k01SessionDetection.primaryState}, severity=${k01SessionDetection.severity}, trend=${updatedK01Progress.boundaryStabilityTrend}`);
    }

    // ── KST01/KDL01/KBR01/KSC01 Kim Advanced Modules persistence ──
    {
      const kimAdvSessionInput = {
        userType: backpack.userType as 'elias' | 'kim',
        latestUserMessage: allUserText,
        recentMessages: userMessages.map(m => m.content).slice(-5),
        crisisLevel: sessionSummary.endRiskLevel === 'high' ? 2 : sessionSummary.endRiskLevel === 'elevated' ? 1 : 0,
        k06SafetyGate: 'cleared' as const,
        stabilizationStatus: 'stable' as const,
        caregiverShameLevel: (updatedUserDat.currentMood as any)?.emotionalBurden ?? 3,
        selfLossLevel: (updatedUserDat.currentMood as any)?.boundaryFatigue ?? 3,
        kst01Storage: (updatedUserDat as any).kst01Progress,
        kdl01Storage: (updatedUserDat as any).kdl01Progress,
        kbr01Storage: (updatedUserDat as any).kbr01Progress,
        ksc01Storage: (updatedUserDat as any).ksc01Progress,
      };
      const kimAdvResult = runKimAdvancedModules(kimAdvSessionInput);

      // Merge storage patches into user.dat
      if (kimAdvResult.kst01Active || Object.keys(kimAdvResult.kst01StoragePatch).length > 0) {
        const existingKST01 = (updatedUserDat as any).kst01Progress;
        const mergedKST01 = { ...(existingKST01 || {}), ...kimAdvResult.kst01StoragePatch };
        updatedUserDat = { ...updatedUserDat, kst01Progress: mergedKST01 } as any;
        console.log(`[Pipeline] KST01 persistence: activated=${kimAdvResult.kst01Active}, count=${mergedKST01.activationCount ?? 0}`);
      }
      if (kimAdvResult.kdl01Active || Object.keys(kimAdvResult.kdl01StoragePatch).length > 0) {
        const existingKDL01 = (updatedUserDat as any).kdl01Progress;
        const mergedKDL01 = { ...(existingKDL01 || {}), ...kimAdvResult.kdl01StoragePatch };
        updatedUserDat = { ...updatedUserDat, kdl01Progress: mergedKDL01 } as any;
        console.log(`[Pipeline] KDL01 persistence: activated=${kimAdvResult.kdl01Active}, count=${mergedKDL01.activationCount ?? 0}`);
      }
      if (kimAdvResult.kbr01Active || Object.keys(kimAdvResult.kbr01StoragePatch).length > 0) {
        const existingKBR01 = (updatedUserDat as any).kbr01Progress;
        const mergedKBR01 = { ...(existingKBR01 || {}), ...kimAdvResult.kbr01StoragePatch };
        updatedUserDat = { ...updatedUserDat, kbr01Progress: mergedKBR01 } as any;
        console.log(`[Pipeline] KBR01 persistence: activated=${kimAdvResult.kbr01Active}, count=${mergedKBR01.activationCount ?? 0}`);
      }
      if (kimAdvResult.ksc01Active || Object.keys(kimAdvResult.ksc01StoragePatch).length > 0) {
        const existingKSC01 = (updatedUserDat as any).ksc01Progress;
        const mergedKSC01 = { ...(existingKSC01 || {}), ...kimAdvResult.ksc01StoragePatch };
        updatedUserDat = { ...updatedUserDat, ksc01Progress: mergedKSC01 } as any;
        console.log(`[Pipeline] KSC01 persistence: activated=${kimAdvResult.ksc01Active}, count=${mergedKSC01.activationCount ?? 0}`);
      }
      if (kimAdvResult.kst01Active || kimAdvResult.kdl01Active || kimAdvResult.kbr01Active || kimAdvResult.ksc01Active) {
        console.log(`[Pipeline] Kim Advanced Modules session-end persistence complete. Route: ${kimAdvResult.routeTarget}`);
      }
    }
  }

  // ── K03 Self-Care persistence (Elias + Kim) ──
  {
    const k03SelfCareSlider = (updatedUserDat.currentMood as any)?.selfCare ?? 5;
    if (k03SelfCareSlider <= 3) {
      const k03CravingVal = (updatedUserDat.currentMood as any)?.craving ?? 0;
      const k03MoodVal = (updatedUserDat.currentMood as any)?.mood ?? 5;
      const k03SessionDetection = detectK03State(allUserText, k03SelfCareSlider, k03CravingVal, k03MoodVal, userMessages.map(m => m.content).slice(-3));
      const existingK03Progress: K03Progress = (updatedUserDat as any).k03Progress ?? createDefaultK03Progress();
      const k03SessionResult = routeK03Engine(k03SessionDetection, existingK03Progress, backpack.userType as 'elias' | 'kim');
      const updatedK03Progress = updateK03Progress(existingK03Progress, k03SessionDetection, k03SessionResult);
      updatedUserDat = { ...updatedUserDat, k03Progress: updatedK03Progress } as any;
      console.log(`[Pipeline] K03 persistence: sessions=${updatedK03Progress.sessionsActivated}, shadow=${updatedK03Progress.sessionsWithShadow}, consecutive=${updatedK03Progress.consecutiveLowCare}`);
    }
  }

  // ── SW01 Shadow Work persistence (Elias only) ──
  if (backpack.userType === 'elias') {
    const existingSW01Progress: SW01Progress = (updatedUserDat as any).sw01Progress ?? createDefaultSW01Progress();
    const updatedSW01Progress = updateSW01Progress(existingSW01Progress);
    updatedUserDat = { ...updatedUserDat, sw01Progress: updatedSW01Progress } as any;
    console.log(`[Pipeline] SW01 persistence: sessions=${updatedSW01Progress.sessionsWithShadowWork}, loops=${updatedSW01Progress.loopsIdentified.length}, projections=${updatedSW01Progress.projectionsProcessed}`);
  }

  // ── STO01 Stoicism persistence (Elias only) ──
  if (backpack.userType === 'elias') {
    const existingSTO01Progress: STO01Progress = (updatedUserDat as any).sto01Progress ?? createDefaultSTO01Progress();
    const sto01SessionSnapshot = getSTO01SessionState();
    const updatedSTO01Progress = updateSTO01Progress(existingSTO01Progress, sto01SessionSnapshot);
    updatedUserDat = { ...updatedUserDat, sto01Progress: updatedSTO01Progress } as any;
    console.log(`[Pipeline] STO01 persistence: sessions=${updatedSTO01Progress.sessionsWithStoicism}, activations=${updatedSTO01Progress.totalActivations}, principles=${updatedSTO01Progress.principlesUsedAllTime.length}`);
  }

  // ── MODULE_MEMORY_CROSS_SESSION persistence (persona-separated) ──
  {
    const existingMemory: ModuleMemoryState = (updatedUserDat as any).moduleMemory ?? createDefaultModuleMemoryState(backpack.userType as 'elias' | 'kim');
    const sessionId = `session_${currentUserDat.totalSessions + 1}`;
    const sessionStartedAt = (updatedUserDat as any).lastSessionDate ?? LocalDeviceTimeService.now().utcIso;
    const sessionEndedAt = LocalDeviceTimeService.now().utcIso;
    const dominantTheme = sessionSummary.themes[0] ?? undefined;

    if (backpack.userType === 'elias' && existingMemory.persona === 'elias') {
      const patch = buildEliasModuleMemoryPatch({
        sessionId,
        sessionStartedAt,
        sessionEndedAt,
        previousState: existingMemory,
        therapeuticTheme: dominantTheme,
        userStateSummary: sessionSummary.dominantEmotion,
      });
      const updatedMemory = applyEliasModuleMemoryPatch(existingMemory, patch);
      updatedUserDat = { ...updatedUserDat, moduleMemory: updatedMemory } as any;
      console.log(`[Pipeline] Module Memory (Elias): dominant=${updatedMemory.dominantModuleWindow.slice(-3).join(',')}, sessions=${updatedMemory.sessions.length}`);
    } else if (backpack.userType === 'kim' && existingMemory.persona === 'kim') {
      const patch = buildKimModuleMemoryPatch({
        sessionId,
        sessionStartedAt,
        sessionEndedAt,
        previousState: existingMemory,
        therapeuticTheme: dominantTheme,
        userStateSummary: sessionSummary.dominantEmotion,
      });
      const updatedMemory = applyKimModuleMemoryPatch(existingMemory, patch);
      updatedUserDat = { ...updatedUserDat, moduleMemory: updatedMemory } as any;
      console.log(`[Pipeline] Module Memory (Kim): dominant=${updatedMemory.dominantModuleWindow.slice(-3).join(',')}, sessions=${updatedMemory.sessions.length}`);
    }
  }

  // ── STEP 5c: Gratitude streak update (both Elias and Kim) ──
  {
    // Check today's diary entries for completed gratitude (all 3 fields filled)
    // The streak is updated based on lastGratitudeDate vs today
    const today = LocalDeviceTimeService.now().utcIso.slice(0, 10); // YYYY-MM-DD
    const lastDate = (updatedUserDat as any).lastGratitudeDate as string | null;
    const currentStreak = (updatedUserDat as any).gratitudeStreak ?? 0;

    // Diary entries are loaded from AsyncStorage in chat.tsx at session start;
    // here we check if the most recent entry (today) has all 3 gratitude fields filled
    const diaryEntries: Array<{ timestamp: string; gratitude?: { entry1: string; entry2: string; entry3: string } }> =
      (updatedUserDat as any)._sessionDiaryEntries ?? [];

    // Find today's entry with complete gratitude
    const todayGratitude = diaryEntries.find((e) => {
      const entryDate = e.timestamp?.slice(0, 10);
      return entryDate === today && e.gratitude?.entry1 && e.gratitude?.entry2 && e.gratitude?.entry3;
    });

    if (todayGratitude) {
      // Check if streak is consecutive (yesterday or today already counted)
      const yesterday = new Date(LocalDeviceTimeService.now().epochMs - 86400000).toISOString().slice(0, 10);
      const isConsecutive = lastDate === yesterday || lastDate === today;
      const newStreak = isConsecutive ? currentStreak + 1 : 1;
      updatedUserDat = { ...updatedUserDat, gratitudeStreak: newStreak, lastGratitudeDate: today } as any;
      console.log(`[Pipeline] Gratitude streak: ${newStreak} (consecutive: ${isConsecutive})`);
    } else if (lastDate && lastDate < new Date(LocalDeviceTimeService.now().epochMs - 86400000).toISOString().slice(0, 10)) {
      // Missed a day — reset streak
      updatedUserDat = { ...updatedUserDat, gratitudeStreak: 0 } as any;
      console.log(`[Pipeline] Gratitude streak reset (last: ${lastDate}, today: ${today})`);
    }
  }

  // ── STEP 5d: LOOPBLOCKER — Cross-session repeating pattern detection ──
  // If the same themes appear 3+ sessions without progression (mood improvement),
  // mark them as repeatingPatterns in user.dat for GPT loop-naming directive.
  {
    const existingPatterns: import('../ai/types').RepeatingPattern[] = (updatedUserDat as any).repeatingPatterns ?? [];
    const sessionThemes = sessionSummary.themes;
    const hasProgression = sessionSummary.moodDelta.distressChange < -1 || sessionSummary.moodDelta.resilienceChange > 1;
    const now = LocalDeviceTimeService.now().utcIso;

    let updatedPatterns = [...existingPatterns];

    for (const theme of sessionThemes) {
      const existing = updatedPatterns.find((p) => p.theme === theme);
      if (existing) {
        existing.sessionCount += 1;
        existing.lastSeenSession = now;
        if (hasProgression) {
          existing.progressionDetected = true;
        }
      } else {
        updatedPatterns.push({
          theme,
          sessionCount: 1,
          progressionDetected: hasProgression,
          firstSeenSession: now,
          lastSeenSession: now,
          loopNamed: false,
        });
      }
    }

    // Decay: themes NOT seen this session lose 0.5 count (min 0, prune at 0)
    updatedPatterns = updatedPatterns
      .map((p) => {
        if (!sessionThemes.includes(p.theme)) {
          return { ...p, sessionCount: p.sessionCount - 0.5 };
        }
        return p;
      })
      .filter((p) => p.sessionCount > 0);

    // Log detected loops
    const activeLoops = updatedPatterns.filter((p) => p.sessionCount >= 3 && !p.progressionDetected);
    if (activeLoops.length > 0) {
      console.log(`[Pipeline] LOOPBLOCKER: ${activeLoops.length} repeating pattern(s) detected without progression:`);
      for (const loop of activeLoops) {
        console.log(`[Pipeline]   LOOP: "${loop.theme}" (${loop.sessionCount} sessions, named=${loop.loopNamed})`);
      }
    }

    updatedUserDat = { ...updatedUserDat, repeatingPatterns: updatedPatterns } as any;
  }

  // ── STEP 5b: Archive old chat history to prevent unbounded growth ──
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

  // Reset session state
  resetSessionState();

  // Compose the final rugzak view (backpack unchanged)
  const updatedRugzak = composeRugzak(backpack, updatedUserDat);

  return {
    farewell,
    sessionSummary,
    updatedRugzak,
    updatedUserDat,
    promotionResult,
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
  // English + Dutch terms for theme detection
  if (/\b(family|parent|mother|father|sibling|brother|sister|familie|ouder|moeder|vader|broer|zus|mama|papa)\b/.test(lower)) themes.push('family');
  if (/\b(work|job|boss|colleague|career|werk|baan|baas|collega|carri[eè]re)\b/.test(lower)) themes.push('work');
  if (/\b(relationship|partner|spouse|boyfriend|girlfriend|relatie|vriendin|vriend|echtgeno[ot]|man|vrouw)\b/.test(lower)) themes.push('relationships');
  if (/\b(sleep|insomnia|nightmare|tired|exhausted|slaap|slapen|nachtmerrie|moe|uitgeput|vermoeid)\b/.test(lower)) themes.push('sleep');
  if (/\b(anger|angry|rage|furious|frustrated|boos|woede|kwaad|woedend|gefrustreerd|frustratie|ruzie|woordenwisseling)\b/.test(lower)) themes.push('anger');
  if (/\b(guilt|shame|ashamed|regret|schuld|schaamte|schaam|spijt|berouw)\b/.test(lower)) themes.push('guilt_shame');
  // Dutch-specific themes
  if (/\b(terugval|gebruik|zuipen|drinken|drugs|verslaving|clean|nuchter)\b/.test(lower)) themes.push('substance_use');
  if (/\b(eenzaam|alleen|afgezonderd|niemand|isolatie)\b/.test(lower) && !themes.includes('isolation')) themes.push('isolation');
  if (/\b(grens|grenzen|boundary|boundaries|nee\s+zeggen)\b/.test(lower)) themes.push('boundaries');

  return [...new Set(themes)];
}

// ─── Helper: Build therapeutic stance string for AI prompt ──────

/**
 * Build VSP Backpack Profile block for Elias prompt injection.
 * Parses zone labels from recurringThemes and formats as structured context.
 * Read-only: never modifies backpack. Only for Elias.
 */
function buildVspBackpackProfileBlock(sections: import('../ai/types').LifePhaseSection[]): string | undefined {
  const profile = parseVspProfileFromBackpack(sections);
  // If no zones detected, return undefined (no injection)
  if (!profile.green.length && !profile.yellow.length && !profile.orange.length && !profile.red.length && !profile.purple.length) {
    // No structured zones found, but if raw content exists, send it as-is
    if (profile.raw && profile.raw.trim().length > 0) {
      return `[USER VSP PROFILE — from backpack recurring themes]\n${profile.raw.trim().slice(0, 2000)}`;
    }
    return undefined;
  }

  const lines: string[] = ['[USER VSP PROFILE — personal relapse prevention plan from backpack]'];
  if (profile.green.length) lines.push(`GREEN signals: ${profile.green.join('; ')}`);
  if (profile.yellow.length) lines.push(`YELLOW signals: ${profile.yellow.join('; ')}`);
  if (profile.orange.length) lines.push(`ORANGE signals: ${profile.orange.join('; ')}`);
  if (profile.red.length) lines.push(`RED signals: ${profile.red.join('; ')}`);
  if (profile.purple.length) lines.push(`PURPLE signals: ${profile.purple.join('; ')}`);
  lines.push('INSTRUCTION: Reference this profile when user discusses zone-related content. Ask what makes them choose their current zone.');
  return lines.join('\n');
}

/**
 * Builds a prompt block from the user's structured VSP section (per-zone signals, whatHelps, anchorSentence).
 * This is the user's OWN words about their relapse prevention plan, structured per zone.
 */
function buildVspStructuredBlock(backpack: import('../ai/types').Backpack, currentZone?: string | null): string | undefined {
  const vspSection = backpack.vspSection;
  if (!vspSection) return undefined;

  // Helper: normalize signals/whatHelps which can be string OR string[] depending on data version
  const normalizeField = (val: unknown): string => {
    if (!val) return '';
    if (Array.isArray(val)) return val.filter(Boolean).join('; ');
    if (typeof val === 'string') return val;
    return String(val);
  };

  const lines: string[] = ['[USER SAFETY PLAN — personal early-warning plan for the CURRENT zone, written by the user themselves]'];

  // Determine the active zone (normalize to uppercase for matching)
  const activeZone = currentZone?.toUpperCase() ?? null;
  if (!activeZone) return undefined; // No zone selected = no VSP block needed

  lines.push(`⚠️ CURRENT ZONE: ${activeZone}`);
  lines.push('The user has self-reported being in this zone RIGHT NOW.');
  lines.push('');

  // Map Dutch zone names to English storage keys for matching
  const DUTCH_TO_ENGLISH: Record<string, string> = {
    'GROEN': 'GREEN', 'GEEL': 'YELLOW', 'ORANJE': 'ORANGE', 'ROOD': 'RED', 'PAARS': 'PURPLE',
  };
  const normalizedActiveZone = DUTCH_TO_ENGLISH[activeZone] ?? activeZone;

  // ONLY output the active zone content
  const zones = vspSection.zones;
  if (zones) {
    for (const [zoneName, entry] of Object.entries(zones)) {
      if (!entry) continue;
      const zoneUpper = zoneName.toUpperCase();
      if (zoneUpper !== normalizedActiveZone && zoneUpper !== activeZone) continue;
      const signalsStr = normalizeField((entry as any).signals);
      if (signalsStr.length > 0) {
        lines.push(`Recognition signals (user's words): ${signalsStr}`);
      }
      const whatHelpsStr = normalizeField((entry as any).whatHelps);
      if (whatHelpsStr.length > 0) {
        lines.push(`What helps (user's words): ${whatHelpsStr}`);
      }
      if ((entry as any).anchorSentence) {
        lines.push(`Anchor sentence: "${(entry as any).anchorSentence}"`);
      }
    }
  }

  if (vspSection.triggers && vspSection.triggers.length > 0) {
    lines.push('');
    lines.push('TRIGGERS:');
    for (const t of vspSection.triggers) {
      if (!t || !t.trigger) continue;
      lines.push(`  - ${t.trigger} → Counter-thought: "${t.counterThought ?? ''}"`);
    }
  }

  if (vspSection.recoveryRules && vspSection.recoveryRules.length > 0) {
    const validRules = vspSection.recoveryRules.filter((r: any) => r != null);
    if (validRules.length > 0) {
      lines.push(`RECOVERY RULES: ${validRules.join('; ')}`);
    }
  }

  if (vspSection.mainAnchorSentence) {
    lines.push(`MAIN ANCHOR SENTENCE: "${vspSection.mainAnchorSentence}"`);
  }

  if (lines.length <= 1) return undefined;

  lines.push('');
  lines.push('INSTRUCTION: This is the user\'s OWN safety plan. When the user is in the active zone, you MUST reference what THEY wrote helps them. Use their own words and anchor sentences. Do not give generic advice — use THEIR plan.');
  return lines.join('\n');
}

function buildTherapeuticStance(analysis: StateAnalysis): string {
  const parts: string[] = [];

  switch (analysis.tone) {
    case 'crisis':
      parts.push('TONE: CRISIS. Follow CRISIS RESPONSE PROTOCOL: (1) Presence first — "Ik ben hier." (2) Safety check — "Ben je nu veilig?" (3) Only then: crisis numbers. NEVER lead with numbers. NEVER skip presence or safety check.');
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


// ═══════════════════════════════════════════════════════════════════════════
// LANGUAGE RECOVERY ANALYZER
// Detects diminishing negative intensity in user language.
// NOT positive statements — only reduction of negative feelings.
// Runs after decay engine (step 3b), does NOT modify the decay engine.
// ═══════════════════════════════════════════════════════════════════════════

export interface LanguageRecoveryResult {
  detected: boolean;
  theme: string;
  delta: number;
  matchedIndicator: string | null;
}

/**
 * Recovery indicators: Dutch phrases that signal diminishing negative intensity.
 * These are NOT positive statements — they indicate the user experiences
 * LESS negativity than before, without claiming things are good.
 */
const RECOVERY_INDICATORS = [
  'minder erg',
  'niet meer zo',
  'wat rustiger',
  'gaat iets beter',
  'minder zwaar',
  'niet meer elke dag',
  'af en toe nog',
  'minder vaak',
  'begin te wennen',
  'het trekt wat weg',
  'minder last',
  'niet meer zo sterk',
  'wat minder',
  'iets afgenomen',
  'minder intens',
  'draaglijker',
  'begint te zakken',
  'niet meer constant',
  'wat afgevlakt',
  'minder overweldigend',
];

/**
 * Map recovery indicators to likely projection themes.
 * If the user says "minder erg" near a fear keyword, we link it to that fear.
 */
const THEME_KEYWORD_MAP: Record<string, string[]> = {
  verlatingsangst: ['verlaten', 'alleen', 'achterlaten', 'verlating', 'eenzaam', 'in de steek'],
  terugval: ['terugval', 'hervallen', 'opnieuw', 'weer beginnen', 'terug bij af'],
  schaamte: ['schaamte', 'schamen', 'schuld', 'schuldig'],
  hopeloosheid: ['hopeloos', 'zinloos', 'geen zin', 'opgeven', 'nutteloos'],
  angst: ['angst', 'bang', 'paniek', 'angstig', 'bezorgd', 'zorgen'],
  woede: ['woede', 'boos', 'kwaad', 'frustratie', 'geïrriteerd'],
  verdriet: ['verdriet', 'verdrietig', 'huilen', 'rouw', 'gemis'],
  craving: ['craving', 'trek', 'verlangen', 'zucht', 'drang', 'zin in'],
};

/**
 * Analyze user message for language recovery indicators.
 * Does NOT modify the decay engine — only produces a result for GPT injection.
 * If detected, applies a -0.5 score reduction to the matching projection entry.
 */
function analyzeLanguageRecovery(
  message: string,
  userType: 'elias' | 'kim'
): LanguageRecoveryResult {
  const lowerMessage = message.toLowerCase();
  const NO_RECOVERY: LanguageRecoveryResult = { detected: false, theme: '', delta: 0, matchedIndicator: null };

  // Step 1: Check for any recovery indicator in the message
  const matchedIndicator = RECOVERY_INDICATORS.find(indicator => lowerMessage.includes(indicator));
  if (!matchedIndicator) {
    return NO_RECOVERY;
  }

  // Step 2: Determine which theme the recovery relates to
  let detectedTheme = 'general';
  for (const [theme, keywords] of Object.entries(THEME_KEYWORD_MAP)) {
    if (keywords.some(kw => lowerMessage.includes(kw))) {
      detectedTheme = theme;
      break;
    }
  }

  // Step 3: Apply -0.5 decay to matching projection entry (if exists)
  const RECOVERY_DELTA = -0.5;
  try {
    const projectionState = getProjectionState();
    const matchingEntry = projectionState.entries.find(
      (e) => e.isActive && e.content.toLowerCase().includes(detectedTheme)
    );
    if (matchingEntry) {
      // Reduce decayScore by 5 points (equivalent to 0.5 on a 0-10 scale mapped to 0-100)
      const { entries, ...rest } = projectionState;
      const updatedEntries = entries.map((e) =>
        e.id === matchingEntry.id
          ? { ...e, decayScore: Math.max(0, e.decayScore - 5) }
          : e
      );
      // Update projection state with reduced score
      loadProjectionState({ ...rest, entries: updatedEntries });
    }
  } catch {
    // Projection state not available — skip score reduction, still report detection
  }

  return {
    detected: true,
    theme: detectedTheme,
    delta: RECOVERY_DELTA,
    matchedIndicator,
  };
}


// ─── Deferred Session Analysis ──────────────────────────────────────
// When the app went to background and the 10s timeout fired before
// endSession could complete, the session was saved with needsFullAnalysis: true.
// At the next session start, this function runs the full session-end analysis
// (without generating a farewell or GPT call) on the previous chatHistory,
// so that triggers, mood snapshots, promotions, and sessionAnalyses are still captured.

/**
 * Run a lightweight (no GPT call) session-end analysis on the previous session's chatHistory.
 * This is called at the start of a new session when a PENDING_CLOSE marker with
 * needsFullAnalysis: true was found.
 *
 * It performs:
 * - Theme extraction from all user messages
 * - Trigger pattern detection and promotion
 * - Mood snapshot recording
 * - Session analysis record creation
 * - Chat history archiving
 *
 * It does NOT:
 * - Generate a farewell message (session already ended)
 * - Call GPT (no network dependency)
 * - Modify the backpack (dual-store rule)
 */
export function runDeferredSessionAnalysis(
  backpack: Backpack,
  userDat: UserDat
): UserDat {
  const sessionMessages = userDat.chatHistory || [];
  if (sessionMessages.length === 0) return userDat;

  const sessionStartDate = userDat.lastSessionDate ? new Date(userDat.lastSessionDate) : new Date(LocalDeviceTimeService.now().epochMs);
  const durationMinutes = Math.floor((LocalDeviceTimeService.now().epochMs - sessionStartDate.getTime()) / 60000);

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

  const rugzak = composeRugzak(backpack, userDat);
  const endAnalysis = analyzeState(rugzak, '');
  const dominantEmotion = endAnalysis.emotionalState;

  // Compute mood delta
  const moodHistory = userDat.moodHistory || [];
  let distressChange = 0;
  let resilienceChange = 0;
  if (moodHistory.length >= 2) {
    const firstSliders = moodHistory[0].sliders;
    const lastSliders = moodHistory[moodHistory.length - 1].sliders;
    const userType = backpack.userType;
    const firstDistress = userType === 'elias'
      ? eliasDistressScore(firstSliders as any)
      : kimDistressScore(firstSliders as any);
    const lastDistress = userType === 'elias'
      ? eliasDistressScore(lastSliders as any)
      : kimDistressScore(lastSliders as any);
    distressChange = lastDistress - firstDistress;
    const firstResilience = userType === 'elias' ? eliasResilienceScore(firstSliders as any) : kimResilienceScore(firstSliders as any);
    const lastResilience = userType === 'elias' ? eliasResilienceScore(lastSliders as any) : kimResilienceScore(lastSliders as any);
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

  let updatedUserDat: UserDat = { ...userDat };

  // Update trigger patterns
  if (newTriggers.length > 0) {
    updatedUserDat = {
      ...updatedUserDat,
      triggerPatterns: updateTriggerPatterns(updatedUserDat.triggerPatterns || [], newTriggers),
    };
  }

  // Record mood snapshot
  if (updatedUserDat.currentMood) {
    const snapshot = {
      timestamp: LocalDeviceTimeService.now().utcIso,
      sliders: sanitizeSliders(updatedUserDat.currentMood as unknown as Record<string, unknown>) as unknown as import('../ai/types').MoodSliders,
    };
    updatedUserDat = {
      ...updatedUserDat,
      moodHistory: [...(updatedUserDat.moodHistory || []), snapshot],
    };
  }

  // Add session analysis record
  const analysisRecord = {
    sessionNumber: userDat.totalSessions,
    date: LocalDeviceTimeService.now().utcIso,
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

  // Archive old chat history
  const archived = archiveSessionHistory(
    updatedUserDat.chatHistory || [],
    (updatedUserDat as any).archivedSessions || [],
    userDat.totalSessions,
  );
  updatedUserDat = {
    ...updatedUserDat,
    chatHistory: archived.activeMessages,
  };
  (updatedUserDat as any).archivedSessions = archived.archivedSessions;

  console.log(`[Pipeline] DEFERRED ANALYSIS complete: themes=${themes.length}, triggers=${newTriggers.length}, modules=${modulesUsed.length}, archived=${archived.archivedSessions.length} sessions`);

  return updatedUserDat;
}
