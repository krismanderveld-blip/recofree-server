/**
 * LIVE_MESSAGE Payload Filter — LOCAL MODULE
 *
 * Purpose: Reduce the LIVE_MESSAGE payload from 50+ fields (most null) to ONLY
 * the fields that are active/relevant for THIS specific turn.
 *
 * Philosophy: Same as context.dat — only what the engine determined is relevant
 * for this message gets sent. No null fields, no empty strings, no inactive modules.
 *
 * Structure:
 *   ALWAYS_CORE: Identity + live dynamic data (always sent, ~12 fields)
 *   ACTIVE_CONTEXT: Only non-null engine context fields (0-5 per turn typically)
 *   COMPACT_META: knownUserPatterns + backpackAnalysis (always sent, compact)
 *
 * Result: Typical LIVE_MESSAGE drops from ~30+ null fields to ~15-20 active fields.
 */

import type { GPTPayload } from '../rugzak/gpt-payload-builder';
import type { ChatContext } from './types';

// ─── Types ────────────────────────────────────────────────────

export interface LiveMessagePayload {
  // Always present (core)
  [key: string]: unknown;
}

export interface FilterStats {
  totalFieldsBefore: number;
  totalFieldsAfter: number;
  droppedNullFields: number;
  activeContextFields: string[];
}

// ─── Module Context Field Keys ────────────────────────────────
// These are the optional context fields that should ONLY be included when non-null/non-undefined.
// If they are null/undefined/empty-string, they are omitted entirely from the payload.

const OPTIONAL_CONTEXT_KEYS: readonly string[] = [
  // Engine layers
  'interventionContinuity',
  'projectionContext',
  'projectionDeepening',
  'stoaContext',
  // Schema/Mode/Therapy engines
  'schemaModeContext',
  'actContext',
  'cgtContext',
  'dgtContext',
  'mbtContext',
  // Kim modules
  'ko1Context',
  'k05Context',
  'k02Context',
  'k04Context',
  'k04s4Context',
  'k06Context',
  'k01Context',
  'k03Context',
  // Elias modules
  'sw01Context',
  'sto01Context',
  // Kim advanced
  'kst01Context',
  'kdl01Context',
  'kbr01Context',
  'ksc01Context',
  // Elias advanced
  'vergv01Context',
  'igh01Context',
  'agc01Context',
  'hwk01Context',
  'fale01Context',
  'verg01Context',
  'rouw01Context',
  'iden01Context',
  'zink01Context',
  'terv01Context',
  'mi02Context',
  'slaap01EliasContext',
  'slaap01KimContext',
  'bedr01Context',
  'vetr01Context',
  'gasl01Context',
  'cdp01Context',
  'rnw01Context',
  'par01Context',
  'fin01Context',
  'iso01Context',
  // Kim clusters
  'relapseClusterContext',
  'dangerChildContext',
  'relationalDynamicsContext',
  'emotionalLossContext',
  'stoaKContext',
  // VSP system
  'vspInsightContext',
  'vspBackpackProfile',
  'vspStructuredSection',
  // Continuity clusters
  'psychoEducationContext',
  'steunpilarenContext',
  'selfAcceptanceContext',
  'kimPatternSupportContext',
  // Loop/Recovery directives
  'loopDetected',
  'languageRecovery',
  // Signal engine
  'relevanceScores',
  'contextSummary',
  // Past reference context (from logs.dat when user references past events)
  'pastReferenceContext',
  // Eigen Regie (Kim only — zone, meaning, impact directives)
  'eigenRegieContext',
  // KERP01: Eigen Regie Plan (Kim only — zone-specific signals, helps, anchors, triggers, boundary rules)
  'eigenRegiePlanContext',
  // DIST01: Distillation context (persons, life context, signals from continuous extraction)
  'distillationContext',
  // Kim Relational Stance Filter / Assessment Mode directive
  'relationalStanceFilter',
] as const;

// ─── Main Filter Function ─────────────────────────────────────

/**
 * Build a slim LIVE_MESSAGE payload by:
 * 1. Always including the core live fields (identity, message, sliders, etc.)
 * 2. Only including optional context fields when they have a truthy value
 * 3. Always including compact meta (knownUserPatterns, backpackAnalysis)
 *
 * This replaces the old pattern of explicitly listing all 50+ fields with `?? null`.
 */
export function buildSlimLivePayload(
  gptPayload: GPTPayload,
  context: ChatContext,
  helpers: {
    buildActiveSignals: (ctx: ChatContext) => unknown[];
    buildKnownUserPatterns: (userDat: ChatContext['userDat'], clinicalMode: boolean) => unknown;
  },
): { payload: LiveMessagePayload; stats: FilterStats } {
  // ── CORE: Always present (required by server schema) ──
  const core: LiveMessagePayload = {
    // Identity
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

    // User-controlled guidance depth
    guidanceDepth: gptPayload.guidanceDepth ?? 'normal',

    // Clinical Mode
    clinicalModeActive: context.userDat?.clinicalModeActive ?? false,

    // Backpack empty flag
    backpackEmpty: context.backpackEmpty ?? false,

    // User-selected app language
    locale: context.locale ?? null,
  };

  // ── BUFFER SNAPSHOT: Include when present ──
  if (gptPayload.bufferSnapshot) {
    core.bufferSnapshot = gptPayload.bufferSnapshot;
  }

  // ── REGULATION: Include when present ──
  if (gptPayload.regulationResult) {
    core.regulationResult = gptPayload.regulationResult;
  }

  // ── ENGINE DIRECTIVE: Include when present ──
  if (gptPayload.engineDirective) {
    core.engineDirective = gptPayload.engineDirective;
  }

  // ── COMPACT META: Always included (small, important for continuity) ──
  core.activeSignals = helpers.buildActiveSignals(context);
  core.knownUserPatterns = helpers.buildKnownUserPatterns(
    context.userDat,
    context.userDat?.clinicalModeActive ?? false,
  );
  if (context.userDat?.backpackAnalysis) {
    core.backpackAnalysis = context.userDat.backpackAnalysis;
  }

  // ── ACTIVE CONTEXT: Only include fields that have a truthy value ──
  const activeContextFields: string[] = [];
  const gptPayloadAny = gptPayload as unknown as Record<string, unknown>;
  const contextAny = context as unknown as Record<string, unknown>;

  for (const key of OPTIONAL_CONTEXT_KEYS) {
    // Check gptPayload first (module contexts come from payload builder)
    const value = gptPayloadAny[key] ?? contextAny[key];
    if (value != null && value !== '' && value !== false) {
      core[key] = value;
      activeContextFields.push(key);
    }
  }

  // ── STATS ──
  // Count what the old approach would have sent (all 50+ fields)
  const totalFieldsBefore = Object.keys(core).length + OPTIONAL_CONTEXT_KEYS.length;
  const totalFieldsAfter = Object.keys(core).length;
  const droppedNullFields = OPTIONAL_CONTEXT_KEYS.length - activeContextFields.length;

  return {
    payload: core,
    stats: {
      totalFieldsBefore,
      totalFieldsAfter,
      droppedNullFields,
      activeContextFields,
    },
  };
}
