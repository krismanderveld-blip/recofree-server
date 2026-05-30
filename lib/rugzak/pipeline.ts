/**
 * Message Processing Pipeline — DUAL-PROCESSING FLOW
 *
 * INTERNAL DUAL-PROCESSING (per message):
 *
 *   PRE-GPT (local, deterministic):
 *     1. Apply trigger decay to PREVIOUS buffer state (before new message merges)
 *     2. Update ShortTermMemoryBuffer with new message
 *     3. Apply RegulationDecayEngine zone decay
 *     4. Select DominantState (pre-GPT decision variable)
 *     5. Build stable BufferSnapshot for GPT payload
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
 *   - ZERO second GPT calls per message
 *   - Buffer is primary source; user.dat influences weighting only
 *   - Full buffer NEVER goes to GPT — only BufferSnapshot
 *   - Backpack + userDat NEVER sent per follow-up message
 *   - AI generates language ONLY. System makes decisions.
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
import { analyzeBackpackRelevance, resetTriggerDecay } from './backpack-relevance-analyzer';
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
  options?: { isSessionStart?: boolean; diaryEntries?: import('../ai/types').DiaryEntry[] }
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
    id: `msg_${Date.now()}`,
    role: 'user' as const,
    content: userMessage,
    timestamp: new Date().toISOString(),
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

  // Select dominant state (pre-GPT decision variable — NOT reselected after GPT)
  const preGPTDominantState = selectDominantState(
    sessionBuffer,
    analysis,
    currentUserDat.currentMood || (ELIAS_DEFAULT_MOOD as any),
    backpack.userType,
    currentUserDat.triggerPatterns || [],
    analysis.priorityModules,
  );
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

  const sessionStart = currentUserDat.lastSessionDate ? new Date(currentUserDat.lastSessionDate) : new Date();
  const sessionMinutes = Math.floor((Date.now() - sessionStart.getTime()) / 60000);

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
    activeModules: [activeDecision ? activeDecision.dominantModule : preGPTDominantState.dominantModule],
    crisisLevel: activeDecision ? activeDecision.crisisLevel : crisisLevel,
    isCrisis: (elisDecision?.zone.resolved?.isCrisis ?? false) || (kimDecision?.isKimCrisis ?? false),
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
  };

  let response: string;
  let tokenUsage: TokenUsage | undefined;
  let selectedModel: string | undefined;
  try {
    const result: AIResult = await provider.generateResponse(context);
    response = result.response;
    tokenUsage = result.tokenUsage;
    selectedModel = result.selectedModel;
  } catch (error) {
    console.error('AI generation error:', error);
    response = "I'm still here with you. Something went wrong on my end — please try again.";
  }

  // ══════════════════════════════════════════════════════════════
  // POST-GPT FLOW (all local, no second GPT call)
  // ══════════════════════════════════════════════════════════════

  // ── POST-GPT STEP 7: Update internal stored state ──
  // We do NOT reselect dominantState. The pre-GPT state is the decision variable.
  // We only update the buffer with the assistant response and adjust internal state.
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
    modulesUsed: [activeDecision ? activeDecision.dominantModule : preGPTDominantState.dominantModule],
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

  // 7d. Record module usage
  let tempRugzak = composeRugzak(backpack, updatedUserDat);
  for (const moduleId of [preGPTDominantState.dominantModule]) {
    tempRugzak = recordModuleUsage(tempRugzak, moduleId, userMessage.slice(0, 50));
  }
  updatedUserDat = {
    ...updatedUserDat,
    moduleUsage: tempRugzak.moduleUsage,
  };

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
    timestamp: new Date().toISOString(),
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

  // ── Build engine trace data for debug screen ──
  const traceData: EngineTraceInput = {
    messageIndex: sessionBuffer.messageCount,
    timestamp: new Date().toISOString(),
    userMessage,
    pipelineSteps: [
      { step: '1. Trigger decay', status: 'passed', reason: `applied to ${sessionBuffer.messageCount > 1 ? 'previous' : 'initial'} buffer` },
      { step: '2. Buffer update', status: 'passed', reason: `zone=${sessionBuffer.currentZoneColor}, score=${sessionBuffer.currentZoneScore}` },
      { step: '3. Zone decay', status: 'passed', reason: `decayApplied` },
      { step: '4. Dominant state', status: 'passed', reason: `module=${preGPTDominantState.dominantModule}, source=${preGPTDominantState.sourceLayer}` },
      { step: '5a. Buffer snapshot', status: 'passed', reason: `triggers=${relevance.triggers.length}` },
      { step: '5b. Regulation', status: regulationResult.wasSkipped ? 'skipped' : 'passed', reason: `action=${regulationResult.action}, depth=${regulationResult.effectiveDepth}` },
      { step: '5c. Relevance', status: 'passed', reason: `triggers=[${relevance.triggers.map(t => t.trigger).join(',')}]` },
      { step: '5d. Projection', status: projectionResult.injectionBlock ? 'passed' : 'skipped', reason: projectionResult.injectionBlock ? 'block injected' : 'no signal' },
      { step: '6a. Zone decision', status: elisDecision ? 'passed' : 'skipped', reason: elisDecision ? `zone=${elisDecision.zone.computed.label}` : 'kim user' },
      { step: '6b. Engine directive', status: engineDirective ? 'passed' : 'skipped', reason: engineDirective ? `engine=${engineDirective.engine}` : 'none' },
      { step: '6c. Intervention', status: interventionContinuity ? 'passed' : 'skipped', reason: interventionContinuity ? `type=${interventionContinuity.lastInterventionType}` : 'not active' },
      { step: '7. GPT call', status: 'passed', reason: `model=${selectedModel ?? 'unknown'}` },
      { step: '8. Post-GPT update', status: 'passed', reason: `patterns=[${markedPatterns.join(',')}]` },
    ],
    zoneDecision: elisDecision ? {
      vspInput: elisDecision.zone.resolved?.vspLevel ?? null,
      vspSeverity: elisDecision.zone.resolved?.finalSeverity ?? null,
      computedZone: elisDecision.zone.computed.label,
      computedSeverity: ({'GROEN':1,'LICHTGROEN':1,'GEEL':2,'ORANJE':3,'ROOD':4} as Record<string,number>)[elisDecision.zone.computed.level] ?? 0,
      finalZone: elisDecision.zone.resolved?.finalZoneLabel ?? null,
      source: elisDecision.zone.resolved?.source ?? 'computed',
      reason: elisDecision.zone.resolved?.reason ?? '',
      isBlocked: elisDecision.isBlocked,
      isCrisis: elisDecision.zone.resolved?.isCrisis ?? false,
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
    memory: {
      totalSessions: currentUserDat.totalSessions ?? 0,
      triggerPatterns: (currentUserDat.triggerPatterns || []).map(t => ({ trigger: t.trigger, count: t.count, weight: t.weight })),
      moduleUsage: (currentUserDat.moduleUsage || []).map((m) => ({ moduleId: m.moduleId, count: 1 })),
      changedUserDatFields: [],
      sliders: (currentUserDat.currentMood || {}) as unknown as Record<string, string | number>,
      changedStateFields: [],
      bufferZone: sessionBuffer.currentZoneColor,
      bufferEmotionalDirection: preGPTDominantState.dominantDirection,
      bufferLiveIntent: analysis.emotionalState || '',
      bufferDominantState: `${preGPTDominantState.dominantModule} (${preGPTDominantState.sourceLayer})`,
    },
    payload: {
      isSessionStart,
      fieldsIncluded: isSessionStart
        ? ['backpack', 'userDat', 'diaryEntries', 'moodSliders', 'bufferSnapshot', 'regulationResult', 'engineDirective', 'interventionContinuity', 'projectionContext']
        : ['message', 'conversationHistory', 'moodSliders', 'bufferSnapshot', 'regulationResult', 'engineDirective', 'interventionContinuity', 'projectionContext'],
      promptBlocks: {
        regulation: regulationResult.action !== 'reflect' ? regulationResult.action : 'skipped',
        engineDirective: engineDirective ? 'yes' : 'no',
        intervention: interventionContinuity ? 'yes' : 'no',
        projection: projectionResult.injectionBlock ? 'yes' : 'no',
      },
      estimatedTokens: estimateTokens(JSON.stringify(context)),
      usedModel: selectedModel ?? 'unknown',
    },
    tokens: tokenUsage ? {
      promptTokens: tokenUsage.promptTokens,
      completionTokens: tokenUsage.completionTokens,
      totalTokens: tokenUsage.totalTokens,
    } : null,
  };

  // Build and store the trace block
  buildTraceBlock(traceData);

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
  const now = new Date().toISOString();

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
  return new Date(signal.cooldownUntil).getTime() > Date.now();
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
  diaryEntries?: import('../ai/types').DiaryEntry[]
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

  const sessionStartDate = currentUserDat.lastSessionDate ? new Date(currentUserDat.lastSessionDate) : new Date();
  const sessionMinutes = Math.floor((Date.now() - sessionStartDate.getTime()) / 60000);

  const context: ChatContext = {
    userType: backpack.userType,
    userName: backpack.naam,
    currentMessage: '',
    conversationHistory: currentUserDat.chatHistory || [],
    moodSliders: currentUserDat.currentMood || (ELIAS_DEFAULT_MOOD as any),
    rugzak,
    backpack,
    userDat: currentUserDat,
    isSessionStart: true,
    diaryEntries: diaryEntries ?? [],
    activeModules: [analysis.priorityModules[0] || (backpack.userType === 'elias' ? ELIAS_DEFAULT_MODULE : KIM_DEFAULT_MODULE)],
    crisisLevel: 0,
    detectedEmotion: analysis.emotionalState,
    therapeuticStance: buildTherapeuticStance(analysis),
    sessionDurationMinutes: sessionMinutes,
    urgency: backpack.intakeContext?.urgency ?? 'midden',
    startEmotion: backpack.intakeContext?.startEmotion ?? '',
    guidanceDepth: currentUserDat.guidanceDepth ?? 'normal',
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

  console.log('[Pipeline] SESSION_INIT greeting generated, buffer initialized');

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
    };
  }

  // ── STEP 1: Analyze the full session ──
  const sessionMessages = currentUserDat.chatHistory || [];
  const sessionStartDate = currentUserDat.lastSessionDate ? new Date(currentUserDat.lastSessionDate) : new Date();
  const durationMinutes = Math.floor((Date.now() - sessionStartDate.getTime()) / 60000);

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
      ? `${name}, I've saved everything from our conversation. You showed real courage today. Take care of yourself, and I'll be here whenever you need me.`
      : `${name}, I've saved everything from our conversation. What you're doing for your loved one matters. Take care of yourself too, and I'll be here when you're ready.`;
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
    id: `msg_${Date.now()}`,
    role: 'assistant',
    content: farewell,
    timestamp: new Date().toISOString(),
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
  const sessionEndTimestamp = new Date().toISOString();
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
      timestamp: new Date().toISOString(),
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

  // ── STEP 5: Archive old chat history to prevent unbounded growth ──
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
