/**
 * Server-side AI Chat Handler — ENGINE SPEC V2 + PATCH N
 *
 * PATCH N: SESSION_INIT / LIVE_MESSAGE split.
 *
 *   SESSION_INIT (first call): Full payload cached server-side.
 *   LIVE_MESSAGE (follow-up): Dynamic data only. Cached static fields
 *     are SELECTIVELY injected into the prompt based on relevance.
 *
 * Follow-up prompt injection rules:
 *   ALWAYS: identity, anti-hallucination, userName, sliders, triggers, module, stance, risk
 *   CONDITIONAL: contextLine, anchor, pattern, wound, diary, stageOfChange
 *   NEVER: full backpack, full userDat, full diary, sessionAnalyses, schema block, stoa block
 *
 * CANON SOURCES:
 *   - elias.dat V19 / kim.dat V1
 *   - ELIAS_IDENTITEIT_COMPLETE_V2025.txt
 *   - Module 033 (Quality Control / Anti-Fabrication)
 *   - Module 091 (Schema Integration)
 *   - Module 012 (Pre-Analysis / Failsafe)
 *   - Master Engine Spec V2
 */

import { z } from "zod";
import { applyK05CrossModuleOverride } from './k05-cross-module-override';
import { applyKimCluster4SafetyFilter } from '@/lib/engine/kim/modules/emotionalLossCluster/kimCluster4SafetyFilter';
import type { KimCluster4ModuleId } from '@/lib/engine/kim/modules/emotionalLossCluster/kimCluster4.types';
import { applyKimCluster3RelationalFilter } from '@/lib/engine/kim/modules/relationalDynamicsCluster/kimCluster3SafetyFilter';
import type { KimCluster3ModuleId } from '@/lib/engine/kim/modules/relationalDynamicsCluster/kimCluster3.types';
import { applyCDP01SafetyFilter } from '@/lib/engine/kim/modules/CODEP-K01/cdp01SafetyFilter';
import { applyPBASafetyFilter, type PBAModuleId } from '@/lib/engine/kim/modules/paal-behe-aanp-safety-filter';
import { KIM_IDENTITY_PROMPT, kimCrisisInstructions } from "../lib/engine/kim/prompt-block";
import { KIM_POSITIVE_SLIDERS } from "../lib/engine/kim/slider-interpretation";
import { ELIAS_POSITIVE_SLIDERS } from "../lib/engine/elias/slider-interpretation";
import { ELIAS_HIGH_COMPLEXITY_MODULES, ELIAS_THERAPEUTIC_MODULES } from "../lib/engine/elias/module-catalog";
import { ELIAS_SHORT_MODULE_PROMPTS, getEliasShortModulePrompts, getEliasShortModuleList } from "../lib/engine/elias/short-module-prompts";
import { KIM_HIGH_COMPLEXITY_MODULES, KIM_MODULE_CATALOG } from "../lib/engine/kim/module-catalog";
import { ELIAS_IDENTITY_PROMPT, ELIAS_SCHEMA_RECOGNITION, eliasCrisisInstructions } from "../lib/engine/elias/prompt-block";
import { ELIAS_STAGE_DESCRIPTIONS_SHORT, ELIAS_STAGE_DESCRIPTIONS_FULL } from "../lib/engine/elias/stage-of-change";

// ─── Types ────────────────────────────────────────────────────────

export interface ChatRequestInput {
  userType: "elias" | "kim";
  userName: string;
  message: string;
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  moodSliders: Record<string, number>;
  isSessionStart: boolean;

  // Live-selected triggers (re-analyzed per message)
  selectedTriggers?: Array<{ trigger: string; score: number }> | null;
  riskScore?: number | null;
  dominantModule?: string | null;

  // Static context (SESSION_INIT only — cached server-side)
  coreWound?: string | null;
  contextLine?: string | null;
  relationshipAnchor?: { name: string; role: string; roleEN?: string } | null;
  recentDiary?: Array<{ content: string; moodTag: string; date: string }> | null;
  stageOfChange?: string | null;
  eigenRegieContext?: {
    userInput: number;
    engineScore: number;
    zone: 'ROOD' | 'ORANJE' | 'GEEL' | 'LICHTGROEN' | 'GROEN';
    meaning: string;
    impact: { primaryDirective: string; secondaryDirective: string };
  } | null;
    relationalPattern?: { pattern: string; schema: string; confidence: number } | null;
  eigenRegiePlanContext?: {
    currentZoneEntry: {
      signals: string;
      bodySignals: string;
      thoughts: string;
      behaviour: string;
      whatHelps: string;
      boundaryActions: string;
      contactRule: string;
      anchorSentence: string;
    } | null;
    mainAnchorSentence: string;
    triggers: Array<{ trigger: string; lossOfRegiePattern: string; healthyResponse: string }>;
    boundaryRules: string[];
  } | null;
  // Full data (SESSION_INIT only)
  backpack?: {
    naam: string;
    userType: "elias" | "kim";
    lifeStory: Array<{
      id: string;
      label: string;
      ageRange: string;
      content: string;
    }>;
    kimBackpack?: {
      my_story: string;
      the_relationship: string;
      the_impact: string;
      my_boundaries: string;
      my_strength: string;
    };
    intakeContext: {
      startEmotion: string;
      urgency: string;
      initialContext: string;
      intakeDate: string;
    };
    createdAt: string;
  } | null;
  userDat?: {
    totalSessions: number;
    triggerPatterns: Array<{
      trigger: string;
      count: number;
      firstSeen: string;
      lastSeen: string;
    }>;
    moodHistory: Array<{
      sliders: Record<string, number>;
      timestamp: string;
    }>;
    moduleUsageSummary: string[];
    lastSessionDate: string | null;
    sessionAnalyses: Array<{
      sessionNumber: number;
      date: string;
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
    }>;  
  } | null;
  diaryEntries?: Array<{
    content: string;
    moodTag: string;
    timestamp: string;
    gratitude?: { entry1?: string | null; entry2?: string | null; entry3?: string | null } | null;
  }> | null;

  activeModules: string[];
  crisisLevel: number;
  isCrisis?: boolean | null;
  vspLevel?: string | null;
  detectedEmotion: string;
  therapeuticStance: string;
  sessionDurationMinutes: number;
  urgency: string;
  startEmotion: string;

  // User-controlled guidance depth
  guidanceDepth?: 'light' | 'normal' | 'deep' | null;

  // Live buffer snapshot from ShortTermMemoryBuffer (per-message)
  bufferSnapshot?: {
    zone: string;
    emotionalDirection: string;
    liveIntent: string;
    dominantState: string;
  } | null;

  // Regulation result from regulation layer (per-message)
  regulationResult?: {
    action: string;
    intervention: string | null;
    gptInstruction: string | null;
    zone: string;
    effectiveDepth: string;
    wasSoftened: boolean;
    wasSkipped: boolean;
  } | null;

  // Routed engine directive (Elias OR Kim, from orchestration routing)
  engineDirective?: {
    engine: 'elias' | 'kim';
    zoneLevel: string;
    zoneLabel: string;
    impact: Record<string, string>;
  } | null;

  // Intervention continuity (Elias only, zone-linked therapeutic memory)
  interventionContinuity?: string | null;

  // Projection layer (future-facing fears/hopes/goals)
  projectionContext?: string | null;
  projectionDeepening?: string | null;

  // STOA engine (Elias only, Stoic session injection block)
  stoaContext?: string | null;

  // Schema/Mode engine (deterministic intervention context)
  schemaModeContext?: string | null;
  actContext?: string | null;
  cgtContext?: string | null;
  dgtContext?: string | null;
  mbtContext?: string | null;
  ko1Context?: string | null;
  k05Context?: string | null;
  k02Context?: string | null;
  k04Context?: string | null;
  k04s4Context?: string | null;
  k06Context?: string | null;
  k01Context?: string | null;
  k03Context?: string | null;
  sw01Context?: string | null;
  sto01Context?: string | null;
  /** KIM RELATIONAL STANCE FILTER: compiled directive block from relational-stance-filter.ts */
  relationalStanceFilter?: string | null;

  // Signal engine: relevance scores for context gating (LIVE_MESSAGE only)
  relevanceScores?: {
    backpackRelevance: number;
    diaryRelevance: number;
    triggerRelevance: number;
    projectionRelevance: number;
  } | null;
  // Signal engine: compressed context summary (replaces full lifeStorySummary in LIVE_MESSAGE)
  contextSummary?: string | null;

  // Clinical Mode (easter egg — therapeutic annotations)
  clinicalModeActive?: boolean | null;
  // Backpack empty flag (for greeting tone adaptation)
  backpackEmpty?: boolean | null;

  // Signal engine: active signals for clinical annotation
  activeSignals?: Array<{
    label: string;
    score: number;
    memory: string;
  }> | null;

  // Backpack Entity Extraction: structured memory (replaces full backpack text when unchanged)
  extractedEntities?: {
    persons: Array<{ name: string; relationship: string; relationshipNL: string; age: string | null; livingSituation: string | null; emotionalValence: string; context: string; sourceSection: string }>;
    events: Array<{ description: string; type: string; timePeriod: string | null; peopleInvolved: string[]; emotionalImpact: string; isTriggerSource: boolean; sourceSection: string }>;
    patterns: Array<{ description: string; type: string; schemaHypothesis: string | null; frequency: string; peopleInvolved: string[]; sourceSection: string }>;
    contexts: Array<{ description: string; type: string; relevance: string; sourceSection: string }>;
    extractedAt: string;
    sourceHash: string;
    schemaVersion: number;
  } | null;
  /** Whether backpack content changed since last extraction (forces full backpack resend) */
  backpackChanged?: boolean | null;

  /** Deep analysis of backpack (schemas, modes, triggers, core beliefs, coping patterns) from GPT-4o */
  backpackAnalysis?: {
    schemas: Array<{ name: string; confidence: number; evidence: string }>;
    modi: Array<{ name: string; confidence: number; evidence: string }>;
    triggers: string[];
    coreBeliefs: string[];
    copingPatterns: string[];
    analysisVersion: number;
    analyzedAt: string;
    previousAnalyzedAt: string | null;
  } | null;

  /** Compact known user patterns (schemas, modes, triggers) — injected every turn */
  knownUserPatterns?: {
    schemas: Array<{ name: string; confidence: number }>;
    modes: Array<{ name: string; confidence: number }>;
    triggers: string[];
  } | null;

  /** Relapse intent detection result from engine (triggers zone escalation + prompt instruction) */
  relapseIntent?: {
    detected: boolean;
    confidence: number;
    source: 'gpt' | 'fallback';
  };
  /** Kim Relapse Cluster prompt payload (HERV-K01/NAHERV-K01/CRISIS-K01). Injected into system prompt when active. */
  relapseClusterContext?: string | null;
  /** Kim Danger/Child Cluster prompt payload (GEVAAR-K01/KIND-K01). Injected into system prompt when active. Overrides relapse cluster. */
  dangerChildContext?: string | null;
  relationalDynamicsContext?: string | null;
  emotionalLossContext?: string | null;
  stoaKContext?: string | null;
  /** VSP Insight System — framework selection (MI/MBT/DGT) prompt frame. Never mutates safety core. store:false. */
  vspInsightContext?: string | null;
  /** Past session context — injected when user references something from a previous session. Retrieved from logs.dat + user.dat. */
  pastReferenceContext?: string | null;
  /** VSP Backpack Profile — parsed from recurringThemes (Elias only, read-only). Bypasses relevance analyzer 2-source limit. */
  vspBackpackProfile?: string | null;
  /** VSP Structured Section — user's own per-zone signals, whatHelps, anchorSentence (Elias only) */
  vspStructuredSection?: string | null;

  /** PsychoEducation continuity context (WILSKRACHT01/AUTOPILOT01, Elias only) */
  psychoEducationContext?: string | null;
  /** Steunpilaren continuity context (PAAL01, Elias only) */
  steunpilarenContext?: string | null;
  /** Self-acceptance cluster continuity context (BLIK01/ONTK01/IKST01/COEX01, Elias only) */
  selfAcceptanceContext?: string | null;
  /** Kim pattern support continuity context (PAAL-K01/BEHE-K01/AANP-K01/CODEP-K01, Kim only) */
  kimPatternSupportContext?: string | null;

  // Advanced module contexts
  vergv01Context?: string | null;
  igh01Context?: string | null;
  agc01Context?: string | null;
  hwk01Context?: string | null;
  fale01Context?: string | null;
  verg01Context?: string | null;
  rouw01Context?: string | null;
  iden01Context?: string | null;
  zink01Context?: string | null;
  terv01Context?: string | null;
  mi02Context?: string | null;
  slaap01EliasContext?: string | null;
  slaap01KimContext?: string | null;
  bedr01Context?: string | null;
  vetr01Context?: string | null;
  gasl01Context?: string | null;
  cdp01Context?: string | null;
  rnw01Context?: string | null;
  par01Context?: string | null;
  fin01Context?: string | null;
  iso01Context?: string | null;

  // LOOPBLOCKER: cross-session repeating pattern directive
  loopDetected?: string | null;
  // LANGUAGE_RECOVERY: diminishing negative intensity directive
  languageRecovery?: string | null;

  /** User-selected app language. Determines AI response language. */
  locale?: 'nl' | 'en' | 'fr';
  /** User-selected country. Determines crisis numbers shown by AI. */
  country?: 'NL' | 'BE' | 'FR' | 'UK' | 'US';

  /** Device-local time context (from client). Used for accurate time in AI responses. */
  deviceTimeContext?: {
    deviceNowIso: string;
    timeZone: string;
    timezoneOffsetMinutes: number;
    localDate: string;
    localTime: string;
    greetingDaypart: 'morning' | 'afternoon' | 'evening' | 'night';
    cycleTimestamp: string;
    sessionStartedAtDeviceIso: string;
  } | null;

  /** Day structure context (current block info for AI awareness) */
  dayStructureContext?: string | null;

  /** Nano-interpret pre-call result (semantic message interpretation from gpt-4.1-nano) */
  nanoInterpret?: {
    translatedNL: string;
    intent: string;
    themes: string[];
    resolvedModule: string | null;
    matchedTheme: string | null;
  } | null;

  /** Distilled context.dat: compact serialized identity/patterns/schemas — replaces full backpack at SESSION_INIT */
  contextDat?: string | null;
  /** Deepening block: targeted fragment retrieval based on nano-detected gaps */
  deepeningBlock?: string | null;

  /** Recent relapse/slip event (Elias only — from userDatSummary) */
  recentRelapseEvent?: { type: string; daysAgo: number; context?: string | null } | null;
  /** Prevention plan (zone-filtered, from terugval-preventieplan) */
  preventionPlan?: { zone?: string; warningSigns?: string; copingStrategies?: string; supportContacts?: string; safeActivities?: string; motivation?: string } | null;
  /** Whether prevention plan is missing (triggers hint in greeting) */
  preventionPlanMissing?: boolean | null;
  /** Acknowledged candidates (schemas/modes recognized but not yet confirmed) */
  acknowledgedCandidates?: { schemas: Array<{ name: string; confidence: number }>; modes: Array<{ name: string; confidence: number }> } | null;
  /** DIST01: Serialized distillation context (persons, life context, signals from continuous extraction) */
  distillationContext?: string | null;
  /** DIST01: Pattern acknowledgment instruction for GPT to reference repeated patterns */
  patternAcknowledgment?: string | null;

  // ─── PRE-BUILT PROMPT BLOCKS (from local pipeline) ───
  // These replace server-side extraction. When present, the server uses them directly.
  /** Ready-to-inject PERSONEN-LOOKUP block (built locally from extractedEntities/relationalAnchors) */
  personLookupBlock?: string | null;
  /** Ready-to-inject PERSONAL MEMORY block (built locally from backpack sections) */
  lifeContextBlock?: string | null;
  /** Ready-to-inject STRUCTURED MEMORY block (built locally from extractedEntities) */
  prebuiltStructuredMemory?: string | null;
  /** Ready-to-inject session history summary (built locally from sessionAnalyses) */
  prebuiltSessionHistory?: string | null;
}

// ─── Server-side Session Cache ───────────────────────────────────
// Stores static context from SESSION_INIT for selective follow-up injection.
// Simple in-memory cache — one session at a time (single-user server).

interface SessionCache {
  userName: string;
  userType: "elias" | "kim";
  coreWound: string | null;
  contextLine: string | null;
  relationshipAnchor: { name: string; role: string; roleEN?: string } | null;
  relationalPattern: { pattern: string; schema: string; confidence: number } | null;
  recentDiary: Array<{ content: string; moodTag: string; date: string }>;
  stageOfChange: string | null;
  // Extracted at session start for conditional use
  relationshipMap: string;
  // Compact life story summary for follow-up injection (names, events, relationships)
  lifeStorySummary: string;
  totalSessions: number;
  triggerPatterns: Array<{ trigger: string; count: number }>;
  messageCount: number; // Track messages for conditional injection
  guidanceDepth: 'light' | 'normal' | 'deep';
  // Structured entities from backpack extraction (replaces full backpack text when available)
  structuredMemory: string;
  // Whether we have structured entities (vs. only text-based extraction)
  hasStructuredEntities: boolean;
  // Cumulative token usage tracking per session
  cumulativeTokens: { prompt: number; completion: number; total: number; turnCount: number };
  // PsychoEducation continuity context (cached at SESSION_INIT, injected every relevant turn)
  psychoEducationContext: string | null;
  // Steunpilaren continuity context (PAAL01, Elias only)
  steunpilarenContext: string | null;
  // Self-acceptance cluster continuity context (BLIK01/ONTK01/IKST01/COEX01, Elias only)
  selfAcceptanceContext: string | null;
  // Kim pattern support continuity context (PAAL-K01/BEHE-K01/AANP-K01/CODEP-K01, Kim only)
  kimPatternSupportContext: string | null;
  // Eigen Regie context (Kim only — zone, meaning, impact directives)
  eigenRegieContext: {
    userInput: number;
    engineScore: number;
    zone: 'ROOD' | 'ORANJE' | 'GEEL' | 'LICHTGROEN' | 'GROEN';
    meaning: string;
    impact: { primaryDirective: string; secondaryDirective: string };
  } | null;
  // Previous session analyses summary (cached at SESSION_INIT, injected in follow-up for continuity)
  sessionAnalysesSummary: string;
  // DIST01: Distillation context (persons, life context, signals — cached at SESSION_INIT)
  distillationContext: string | null;
  // DIST01: Pattern acknowledgment (cached at SESSION_INIT, refreshed each turn)
  patternAcknowledgment: string | null;
}

// Single-user cache: one active session per server instance (not multi-user safe)
// Must be replaced with a session-keyed map before any multi-user deployment.
let sessionCache: SessionCache | null = null;

/** Getter for debug endpoint */
export function getSessionCache(): SessionCache | null {
  return sessionCache;
}

/**
 * Build a compact summary of previous session analyses for follow-up injection.
 * Only includes the last 3 sessions to keep token usage low.
 * Focuses on themes, triggers, and emotional arc — the content GPT needs to reference.
 */
function buildSessionAnalysesSummary(sessionAnalyses: Array<{
  sessionNumber: number;
  date: string;
  messageCount: number;
  durationMinutes: number;
  dominantEmotion: string;
  themes: string[];
  newTriggers: string[];
  modulesUsed: string[];
  moodDelta: { distressChange: number; resilienceChange: number };
  endRiskLevel: string;
}>): string {
  if (!sessionAnalyses || sessionAnalyses.length === 0) return '';

  // Take the last 3 sessions (most recent first)
  const recent = sessionAnalyses.slice(-3).reverse();
  let summary = '\n─── VORIGE SESSIES (kort) ───';
  for (const sa of recent) {
    summary += `\nSessie #${sa.sessionNumber} (${sa.date}):`;
    if (sa.themes.length > 0) summary += ` Thema's: ${sa.themes.join(', ')}.`;
    if (sa.newTriggers.length > 0) summary += ` Triggers: ${sa.newTriggers.join(', ')}.`;
    summary += ` Emotie: ${sa.dominantEmotion}.`;
    const distressDir = sa.moodDelta.distressChange > 0 ? '↑' : sa.moodDelta.distressChange < 0 ? '↓' : '→';
    summary += ` Distress${distressDir}.`;
    summary += ` Risico: ${sa.endRiskLevel}.`;
  }
  summary += '\n─── EINDE VORIGE SESSIES ───';
  return summary;
}

function cacheSessionInit(input: ChatRequestInput): void {
  // Build structured memory from extractedEntities if available (compact, no full backpack needed)
  let structuredMemory = '';
  let hasStructuredEntities = false;

  // Only use structured entities if backpack was NOT recently changed
  // When backpackChanged=true, always prefer full backpack text (most up-to-date)
  if (!input.backpackChanged && input.extractedEntities && input.extractedEntities.persons.length > 0) {
    hasStructuredEntities = true;
    structuredMemory = buildStructuredMemoryBlock(input.extractedEntities);
    console.log(`[AI Chat] Using structured entities: ${input.extractedEntities.persons.length} persons, ${input.extractedEntities.events.length} events, ${input.extractedEntities.patterns.length} patterns`);
  } else if (input.backpackChanged) {
    console.log(`[AI Chat] Backpack changed — using full backpack text instead of stale entities`);
  }

  // === DIAGNOSTIC: Log exactly what backpack data arrives ===
  console.log(`[AI Chat DIAG] backpackChanged=${input.backpackChanged}, hasBackpack=${!!input.backpack}, hasEntities=${!!input.extractedEntities}`);
  if (input.backpack) {
    const ls = input.backpack.lifeStory || [];
    console.log(`[AI Chat DIAG] lifeStory sections: ${ls.length}`);
    ls.forEach((s: any, i: number) => {
      console.log(`[AI Chat DIAG]   [${i}] id=${s.id}, label=${s.label}, content=${(s.content || '').substring(0, 80)}...`);
    });
  } else {
    console.log(`[AI Chat DIAG] NO backpack received at session-start!`);
  }

  // ═══ PRE-BUILT BLOCKS: prefer client-supplied blocks, fallback to server extraction ═══
  const resolvedRelationshipMap = input.personLookupBlock
    ? input.personLookupBlock
    : (input.backpack
      ? extractRelationshipMap(input.backpack.lifeStory, input.backpack.intakeContext.initialContext, input.extractedEntities)
      : "");

  const resolvedLifeStorySummary = input.lifeContextBlock
    ? input.lifeContextBlock
    : (hasStructuredEntities
      ? structuredMemory
      : (input.backpack
        ? buildCompactLifeStorySummary(input.backpack.lifeStory, input.backpack.intakeContext.initialContext, input.userName, input.backpack.kimBackpack)
        : ""));

  const resolvedStructuredMemory = input.prebuiltStructuredMemory
    ? input.prebuiltStructuredMemory
    : structuredMemory;

  const resolvedSessionHistory = input.prebuiltSessionHistory
    ? input.prebuiltSessionHistory
    : buildSessionAnalysesSummary(input.userDat?.sessionAnalyses ?? []);

  if (input.personLookupBlock) {
    console.log('[AI Chat] Using PRE-BUILT personLookupBlock from local pipeline');
  }
  if (input.lifeContextBlock) {
    console.log('[AI Chat] Using PRE-BUILT lifeContextBlock from local pipeline');
  }
  if (input.prebuiltStructuredMemory) {
    console.log('[AI Chat] Using PRE-BUILT structuredMemory from local pipeline');
  }
  if (input.prebuiltSessionHistory) {
    console.log('[AI Chat] Using PRE-BUILT sessionHistory from local pipeline');
  }

  sessionCache = {
    userName: input.userName,
    userType: input.userType,
    coreWound: input.coreWound ?? null,
    contextLine: input.contextLine ?? null,
    relationshipAnchor: input.relationshipAnchor ?? null,
    relationalPattern: input.relationalPattern ?? null,
    recentDiary: input.recentDiary ?? [],
    stageOfChange: input.stageOfChange ?? null,
    relationshipMap: resolvedRelationshipMap,
    lifeStorySummary: resolvedLifeStorySummary,
    totalSessions: input.userDat?.totalSessions ?? 0,
    triggerPatterns: (input.userDat?.triggerPatterns ?? []).map(tp => ({
      trigger: tp.trigger,
      count: tp.count,
    })),
    messageCount: 0,
    guidanceDepth: input.guidanceDepth ?? 'normal',
    structuredMemory: resolvedStructuredMemory,
    hasStructuredEntities: hasStructuredEntities || !!input.prebuiltStructuredMemory,
    cumulativeTokens: { prompt: 0, completion: 0, total: 0, turnCount: 0 },
    psychoEducationContext: input.psychoEducationContext ?? null,
    steunpilarenContext: input.steunpilarenContext ?? null,
    selfAcceptanceContext: input.selfAcceptanceContext ?? null,
    kimPatternSupportContext: input.kimPatternSupportContext ?? null,
    eigenRegieContext: input.eigenRegieContext ?? null,
    sessionAnalysesSummary: resolvedSessionHistory,
    distillationContext: input.distillationContext ?? null,
    patternAcknowledgment: input.patternAcknowledgment ?? null,
  };
  console.log("[AI Chat] Session cache created for:", input.userName, hasStructuredEntities ? '(structured entities)' : '(text-based)');
  // Log PERSONEN-LOOKUP for debugging person recognition
  if (sessionCache!.relationshipMap) {
    console.log("[AI Chat] PERSONEN-LOOKUP:\n" + sessionCache!.relationshipMap);
  } else {
    console.log("[AI Chat] PERSONEN-LOOKUP: EMPTY (no persons extracted from backpack)");
  }
}

function incrementMessageCount(): void {
  if (sessionCache) {
    sessionCache.messageCount++;
  }
}

// ─── Dynamic Crisis Numbers (country-based) ────────────────────────────────

const CRISIS_NUMBERS_SERVER: Record<string, { suicide: Record<string, { name: string; number: string }>; emergency: string }> = {
  BE: {
    suicide: {
      nl: { name: 'Zelfmoordlijn', number: '1813' },
      fr: { name: 'Centre de Prévention du Suicide', number: '0800 32 123' },
      en: { name: 'Suicide Prevention', number: '1813' },
    },
    emergency: '112',
  },
  NL: {
    suicide: {
      nl: { name: '113 Zelfmoordpreventie', number: '113' },
      en: { name: 'Suicide Prevention', number: '113' },
      fr: { name: 'Prévention du suicide', number: '113' },
    },
    emergency: '112',
  },
  FR: {
    suicide: {
      fr: { name: 'SOS Amitié', number: '09 72 39 40 50' },
      nl: { name: 'SOS Amitié', number: '09 72 39 40 50' },
      en: { name: 'SOS Amitié', number: '09 72 39 40 50' },
    },
    emergency: '112',
  },
  UK: {
    suicide: {
      en: { name: 'Samaritans', number: '116 123' },
      nl: { name: 'Samaritans', number: '116 123' },
      fr: { name: 'Samaritans', number: '116 123' },
    },
    emergency: '999',
  },
  US: {
    suicide: {
      en: { name: 'Suicide & Crisis Lifeline', number: '988' },
      nl: { name: 'Suicide & Crisis Lifeline', number: '988' },
      fr: { name: 'Suicide & Crisis Lifeline', number: '988' },
    },
    emergency: '911',
  },
};

function getServerCrisisInfo(country?: string, locale?: string): { suicideName: string; suicideNumber: string; emergencyNumber: string } {
  const c = country || 'BE';
  const l = locale || 'nl';
  const data = CRISIS_NUMBERS_SERVER[c] || CRISIS_NUMBERS_SERVER['BE'];
  const suicideEntry = data.suicide[l] || data.suicide['nl'] || Object.values(data.suicide)[0];
  return { suicideName: suicideEntry.name, suicideNumber: suicideEntry.number, emergencyNumber: data.emergency };
}

function buildCrisisFallbackMessage(country?: string, locale?: string): string {
  const { suicideName, suicideNumber, emergencyNumber } = getServerCrisisInfo(country, locale);
  const l = locale || 'nl';
  if (l === 'nl') {
    return `Ik kan je nu even niet bereiken door een verbindingsprobleem. Als je je niet veilig voelt, bel ${suicideName}: ${suicideNumber} (24/7, gratis, anoniem) of ${emergencyNumber} bij onmiddellijk gevaar. Je hoeft dit niet alleen te dragen.`;
  } else if (l === 'fr') {
    return `Je ne peux pas te joindre en ce moment en raison d'un problème de connexion. Si tu ne te sens pas en sécurité, appelle ${suicideName}: ${suicideNumber} (24/7, gratuit, anonyme) ou ${emergencyNumber} en cas de danger immédiat.`;
  }
  return `I cannot reach you right now due to a connection issue. If you feel unsafe, call ${suicideName}: ${suicideNumber} (24/7, free, anonymous) or ${emergencyNumber} for immediate danger. You don't have to carry this alone.`;
}

function getCrisisEnforcementNumber(country?: string, locale?: string): string {
  const { suicideNumber } = getServerCrisisInfo(country, locale);
  return suicideNumber;
}

function buildCrisisAppendMessage(country?: string, locale?: string): string {
  const { suicideName, suicideNumber, emergencyNumber } = getServerCrisisInfo(country, locale);
  const l = locale || 'nl';
  if (l === 'nl') {
    return `Je kan ook bellen naar ${suicideName}: ${suicideNumber} (24/7, gratis en anoniem) of ${emergencyNumber} bij onmiddellijk gevaar.`;
  } else if (l === 'fr') {
    return `Tu peux aussi appeler ${suicideName}: ${suicideNumber} (24/7, gratuit et anonyme) ou ${emergencyNumber} en cas de danger immédiat.`;
  }
  return `You can also call ${suicideName}: ${suicideNumber} (24/7, free and anonymous) or ${emergencyNumber} for immediate danger.`;
}

// ─── Zod Schema ───────────────────────────────────────────────────

export const chatInputSchema = z.object({
  userType: z.enum(["elias", "kim"]),
  userName: z.string(),
  message: z.string(),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  moodSliders: z.record(z.string(), z.number()),
  isSessionStart: z.boolean().default(false),

  // Live triggers (every call)
  selectedTriggers: z.array(
    z.object({ trigger: z.string(), score: z.number() })
  ).nullable().optional(),
  riskScore: z.number().nullable().optional(),
  dominantModule: z.string().nullable().optional(),
  vspLevel: z.string().nullable().optional(),

  // Static context (SESSION_INIT only)
  coreWound: z.string().nullable().optional(),
  contextLine: z.string().nullable().optional(),
  relationshipAnchor: z.object({
    name: z.string(),
    role: z.string(),
    roleEN: z.string().optional(),
  }).nullable().optional(),
  recentDiary: z.array(
    z.object({ content: z.string(), moodTag: z.string(), date: z.string() })
  ).nullable().optional(),
  stageOfChange: z.string().nullable().optional(),
  eigenRegieContext: z.object({
    userInput: z.number(),
    engineScore: z.number(),
    zone: z.enum(['ROOD', 'ORANJE', 'GEEL', 'LICHTGROEN', 'GROEN']),
    meaning: z.string(),
    impact: z.object({
      primaryDirective: z.string(),
      secondaryDirective: z.string(),
    }).passthrough(),
  }).passthrough().nullable().optional(),
  // KERP01: Eigen Regie Plan context (Kim only)
  eigenRegiePlanContext: z.object({
    currentZoneEntry: z.object({
      signals: z.string(),
      bodySignals: z.string(),
      thoughts: z.string(),
      behaviour: z.string(),
      whatHelps: z.string(),
      boundaryActions: z.string(),
      contactRule: z.string(),
      anchorSentence: z.string(),
    }).passthrough().nullable(),
    mainAnchorSentence: z.string(),
    triggers: z.array(z.object({
      trigger: z.string(),
      lossOfRegiePattern: z.string(),
      healthyResponse: z.string(),
    }).passthrough()),
    boundaryRules: z.array(z.string()),
  }).passthrough().nullable().optional(),
  // DIST01: Distillation context (serialized persons, life context, signals)
  distillationContext: z.string().nullable().optional(),
  // DIST01: Pattern acknowledgment (repeated signal instruction for GPT)
  patternAcknowledgment: z.string().nullable().optional(),
  // KIM RELATIONAL STANCE FILTER
  relationalStanceFilter: z.string().nullable().optional(),
  relationalPattern: z.object({
    pattern: z.string(),
    schema: z.string(),
    confidence: z.number(),
  }).nullable().optional(),

  // Full data (SESSION_INIT only)
  backpack: z.object({
    naam: z.string(),
    userType: z.enum(["elias", "kim"]),
    lifeStory: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        ageRange: z.string(),
        content: z.string(),
      })
    ),
    kimBackpack: z.object({
      my_story: z.string(),
      the_relationship: z.string(),
      the_impact: z.string(),
      my_boundaries: z.string(),
      my_strength: z.string(),
    }).optional(),
    intakeContext: z.object({
      startEmotion: z.string(),
      urgency: z.string(),
      initialContext: z.string(),
      intakeDate: z.string(),
    }),
    createdAt: z.string(),
  }).passthrough().nullable().optional(),
  userDat: z.object({
    totalSessions: z.number(),
    triggerPatterns: z.array(
      z.object({
        trigger: z.string(),
        count: z.number(),
        firstSeen: z.string(),
        lastSeen: z.string(),
      })
    ),
    moodHistory: z.array(
      z.object({
        sliders: z.record(z.string(), z.number()),
        timestamp: z.string(),
      })
    ),
    moduleUsageSummary: z.array(z.string()),
    lastSessionDate: z.nullable(z.string()),
    sessionAnalyses: z.array(
      z.object({
        sessionNumber: z.number(),
        date: z.string(),
        messageCount: z.number(),
        durationMinutes: z.number(),
        dominantEmotion: z.string(),
        themes: z.array(z.string()),
        newTriggers: z.array(z.string()),
        modulesUsed: z.array(z.string()),
        moodDelta: z.object({
          distressChange: z.number(),
          resilienceChange: z.number(),
        }),
        endRiskLevel: z.string(),
      })
    ),
  }).passthrough().nullable().optional(),
  diaryEntries: z.array(
    z.object({
      content: z.string(),
      moodTag: z.string(),
      timestamp: z.string(),
      gratitude: z.object({
        entry1: z.string().nullable().optional(),
        entry2: z.string().nullable().optional(),
        entry3: z.string().nullable().optional(),
      }).nullable().optional(),
    }).passthrough()
  ).nullable().optional(),
  activeModules: z.array(z.string()),
  crisisLevel: z.number(),
  isCrisis: z.boolean().nullable().optional(),
  detectedEmotion: z.string(),
  therapeuticStance: z.string(),
  sessionDurationMinutes: z.number(),
  urgency: z.string(),
  startEmotion: z.string(),
  guidanceDepth: z.enum(['light', 'normal', 'deep']).nullable().optional(),
  bufferSnapshot: z.any().optional(),

  // Regulation layer result (from client-side regulation engine)
  regulationResult: z.object({
    action: z.enum(['reflect', 'slow_down', 'regulate', 'stabilize', 'ground']),
    intervention: z.string().nullable(),
    gptInstruction: z.string().nullable(),
    zone: z.enum(['GREEN', 'YELLOW', 'ORANGE', 'RED', 'PURPLE']),
    effectiveDepth: z.enum(['light', 'normal', 'deep']),
    wasSoftened: z.boolean(),
    wasSkipped: z.boolean(),
  }).nullable().optional(),

  // Routed engine directive (Elias OR Kim, from orchestration routing)
  engineDirective: z.object({
    engine: z.enum(['elias', 'kim']),
    zoneLevel: z.string(),
    zoneLabel: z.string(),
    impact: z.record(z.string(), z.string()),
  }).nullable().optional(),

  // Intervention continuity (Elias only, zone-linked therapeutic memory)
  interventionContinuity: z.string().nullable().optional(),
  // Projection layer (future-facing fears/hopes/goals)
  projectionContext: z.string().nullable().optional(),
  projectionDeepening: z.string().nullable().optional(),

  // STOA engine (Elias only, Stoic session injection block)
  stoaContext: z.string().nullable().optional(),

  // Schema/Mode engine (deterministic intervention context)
  schemaModeContext: z.string().nullable().optional(),
  actContext: z.string().nullable().optional(),
  cgtContext: z.string().nullable().optional(),
  dgtContext: z.string().nullable().optional(),
  mbtContext: z.string().nullable().optional(),
  ko1Context: z.string().nullable().optional(),
  k05Context: z.string().nullable().optional(),
  k02Context: z.string().nullable().optional(),
  k04Context: z.string().nullable().optional(),
  k04s4Context: z.string().nullable().optional(),
  k06Context: z.string().nullable().optional(),
  k01Context: z.string().nullable().optional(),
  k03Context: z.string().nullable().optional(),
  sw01Context: z.string().nullable().optional(),
  sto01Context: z.string().nullable().optional(),
  // Kim cluster contexts
  relapseClusterContext: z.string().nullable().optional(),
  dangerChildContext: z.string().nullable().optional(),
  relationalDynamicsContext: z.string().nullable().optional(),
  emotionalLossContext: z.string().nullable().optional(),
  stoaKContext: z.string().nullable().optional(),
  // VSP Insight System (MI/MBT/DGT framework selection, store:false)
  vspInsightContext: z.string().nullable().optional(),
  // Past session context (retrieved from logs.dat + user.dat when user references past events)
  pastReferenceContext: z.string().nullable().optional(),
  // VSP Backpack Profile (LLM-analyzed zone signals from recurringThemes, Elias only)
  vspBackpackProfile: z.string().nullable().optional(),
  // VSP Structured Section (user's own per-zone signals, whatHelps, anchorSentence, Elias only)
  vspStructuredSection: z.string().nullable().optional(),
  // PsychoEducation continuity (WILSKRACHT01/AUTOPILOT01, Elias only)
  psychoEducationContext: z.string().nullable().optional(),
  // Steunpilaren continuity (PAAL01, Elias only)
  steunpilarenContext: z.string().nullable().optional(),
  // Self-acceptance cluster continuity (BLIK01/ONTK01/IKST01/COEX01, Elias only)
  selfAcceptanceContext: z.string().nullable().optional(),
  // Kim pattern support continuity (PAAL-K01/BEHE-K01/AANP-K01/CODEP-K01, Kim only)
  kimPatternSupportContext: z.string().nullable().optional(),

  // Advanced module contexts (Elias + Kim)
  vergv01Context: z.string().nullable().optional(),
  igh01Context: z.string().nullable().optional(),
  agc01Context: z.string().nullable().optional(),
  hwk01Context: z.string().nullable().optional(),
  fale01Context: z.string().nullable().optional(),
  verg01Context: z.string().nullable().optional(),
  rouw01Context: z.string().nullable().optional(),
  iden01Context: z.string().nullable().optional(),
  zink01Context: z.string().nullable().optional(),
  terv01Context: z.string().nullable().optional(),
  mi02Context: z.string().nullable().optional(),
  slaap01EliasContext: z.string().nullable().optional(),
  slaap01KimContext: z.string().nullable().optional(),
  bedr01Context: z.string().nullable().optional(),
  vetr01Context: z.string().nullable().optional(),
  gasl01Context: z.string().nullable().optional(),
  cdp01Context: z.string().nullable().optional(),
  rnw01Context: z.string().nullable().optional(),
  par01Context: z.string().nullable().optional(),
  fin01Context: z.string().nullable().optional(),
  iso01Context: z.string().nullable().optional(),

  // LOOPBLOCKER: cross-session repeating pattern directive
  loopDetected: z.string().nullable().optional(),
  // LANGUAGE_RECOVERY: diminishing negative intensity directive
  languageRecovery: z.string().nullable().optional(),

  // Signal engine: relevance scores for context gating (LIVE_MESSAGE only)
  relevanceScores: z.object({
    backpackRelevance: z.number(),
    diaryRelevance: z.number(),
    triggerRelevance: z.number(),
    projectionRelevance: z.number(),
  }).passthrough().nullable().optional(),
  // Signal engine: compressed context summary (replaces full lifeStorySummary in LIVE_MESSAGE)
  contextSummary: z.string().nullable().optional(),

  // Clinical Mode (easter egg — therapeutic annotations)
  clinicalModeActive: z.boolean().nullable().optional(),
  // Backpack empty flag (for greeting tone adaptation)
  backpackEmpty: z.boolean().nullable().optional(),
  // Signal engine: active signals for clinical annotation
  activeSignals: z.array(z.object({
    label: z.string(),
    score: z.number(),
    memory: z.string(),
  })).nullable().optional(),

  // Backpack Entity Extraction: structured memory (replaces full backpack text when unchanged)
  extractedEntities: z.object({
    persons: z.array(z.object({
      name: z.string(),
      relationship: z.string(),
      relationshipNL: z.string(),
      age: z.string().nullable(),
      livingSituation: z.string().nullable(),
      emotionalValence: z.string(),
      context: z.string(),
      sourceSection: z.string(),
    })),
    events: z.array(z.object({
      description: z.string(),
      type: z.string(),
      timePeriod: z.string().nullable(),
      peopleInvolved: z.array(z.string()),
      emotionalImpact: z.string(),
      isTriggerSource: z.boolean(),
      sourceSection: z.string(),
    })),
    patterns: z.array(z.object({
      description: z.string(),
      type: z.string(),
      schemaHypothesis: z.string().nullable(),
      frequency: z.string(),
      peopleInvolved: z.array(z.string()),
      sourceSection: z.string(),
    })),
    contexts: z.array(z.object({
      description: z.string(),
      type: z.string(),
      relevance: z.string(),
      sourceSection: z.string(),
    })),
    extractedAt: z.string(),
    sourceHash: z.string(),
    schemaVersion: z.number(),
  }).passthrough().nullable().optional(),
  /** Whether backpack content changed since last extraction */
  backpackChanged: z.boolean().nullable().optional(),

  /** Deep analysis of backpack (schemas, modes, triggers, core beliefs, coping patterns) from GPT-4o */
  backpackAnalysis: z.object({
    schemas: z.array(z.object({ name: z.string(), confidence: z.number(), evidence: z.string() })),
    modi: z.array(z.object({ name: z.string(), confidence: z.number(), evidence: z.string() })),
    triggers: z.array(z.string()),
    coreBeliefs: z.array(z.string()),
    copingPatterns: z.array(z.string()),
    analysisVersion: z.number(),
    analyzedAt: z.string(),
    previousAnalyzedAt: z.string().nullable(),
  }).passthrough().nullable().optional(),

  /** Compact known user patterns (schemas, modes, triggers) — injected every turn */
  knownUserPatterns: z.object({
    schemas: z.array(z.object({ name: z.string(), confidence: z.number() })),
    modes: z.array(z.object({ name: z.string(), confidence: z.number() })),
    triggers: z.array(z.string()),
  }).passthrough().nullable().optional(),
  /** User-selected app language. Determines AI response language. */
  locale: z.enum(['nl', 'en', 'fr']).nullable().optional(),
  country: z.enum(['NL', 'BE', 'FR', 'UK', 'US']).nullable().optional(),
  /** Distilled context.dat: compact serialized identity/patterns/schemas — replaces full backpack at SESSION_INIT */
  contextDat: z.string().nullable().optional(),
  /** Deepening block: targeted fragment retrieval based on nano-detected gaps */
  deepeningBlock: z.string().nullable().optional(),
  /** Recent relapse/slip event (Elias only — from userDatSummary) */
  recentRelapseEvent: z.object({
    type: z.string(),
    daysAgo: z.number(),
    context: z.string().nullable().optional(),
  }).nullable().optional(),
  /** Prevention plan (zone-filtered, from terugval-preventieplan) */
  preventionPlan: z.object({
    zone: z.string().optional(),
    warningSigns: z.string().optional(),
    copingStrategies: z.string().optional(),
    supportContacts: z.string().optional(),
    safeActivities: z.string().optional(),
    motivation: z.string().optional(),
  }).nullable().optional(),
  /** Whether prevention plan is missing (triggers hint in greeting) */
  preventionPlanMissing: z.boolean().nullable().optional(),
  /** Acknowledged candidates (schemas/modes recognized but not yet confirmed) */
  acknowledgedCandidates: z.object({
    schemas: z.array(z.object({ name: z.string(), confidence: z.number() })),
    modes: z.array(z.object({ name: z.string(), confidence: z.number() })),
  }).nullable().optional(),

  // Pre-built prompt blocks (from local pipeline — replaces server-side extraction when present)
  personLookupBlock: z.string().nullable().optional(),
  lifeContextBlock: z.string().nullable().optional(),
  prebuiltStructuredMemory: z.string().nullable().optional(),
  prebuiltSessionHistory: z.string().nullable().optional(),
}).passthrough();

// ─── Structured Memory Block Builder (from extractedEntities) ──────────────

/**
 * Converts extractedEntities (from LLM backpack extraction) into a compact
 * structured text block for the system prompt. Replaces the full backpack text
 * with a much more efficient representation.
 */
function buildStructuredMemoryBlock(entities: NonNullable<ChatRequestInput['extractedEntities']>): string {
  const lines: string[] = [];

  // Persons
  if (entities.persons.length > 0) {
    lines.push('[PERSONEN IN HET LEVEN VAN DE GEBRUIKER]');
    for (const p of entities.persons) {
      let line = `- ${p.name} (${p.relationshipNL})`;
      if (p.age) line += `, ${p.age} jaar`;
      if (p.livingSituation) line += ` — ${p.livingSituation}`;
      line += ` [${p.emotionalValence}]`;
      if (p.context) line += `: ${p.context}`;
      lines.push(line);
    }
    lines.push('');
  }

  // Events
  if (entities.events.length > 0) {
    lines.push('[BELANGRIJKE GEBEURTENISSEN]');
    for (const e of entities.events) {
      let line = `- [${e.type.toUpperCase()}]`;
      if (e.timePeriod) line += ` (${e.timePeriod})`;
      line += ` ${e.description}`;
      if (e.peopleInvolved.length > 0) line += ` (betrokken: ${e.peopleInvolved.join(', ')})`;
      if (e.isTriggerSource) line += ' ⚠️ TRIGGER';
      lines.push(line);
    }
    lines.push('');
  }

  // Patterns
  if (entities.patterns.length > 0) {
    lines.push('[PATRONEN]');
    for (const p of entities.patterns) {
      let line = `- [${p.type.toUpperCase()}/${p.frequency}] ${p.description}`;
      if (p.schemaHypothesis) line += ` (schema: ${p.schemaHypothesis})`;
      if (p.peopleInvolved.length > 0) line += ` (met: ${p.peopleInvolved.join(', ')})`;
      lines.push(line);
    }
    lines.push('');
  }

  // Contexts
  if (entities.contexts.length > 0) {
    lines.push('[CONTEXT]');
    for (const c of entities.contexts) {
      lines.push(`- [${c.type.toUpperCase()}] ${c.description} — ${c.relevance}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Relationship Map Extractor ──────────────────────────────────

/**
 * Extracts a CONCRETE person lookup table from the backpack text.
 * Instead of a generic instruction, this generates an explicit list of
 * every person mentioned with their relationship — so GPT can do a
 * simple lookup instead of "mentally extracting" from long text.
 */
function extractRelationshipMap(
  lifeStory: Array<{ label: string; content: string }>,
  intakeContext: string,
  extractedEntities?: ChatRequestInput['extractedEntities'],
): string {
  // Strategy 1: Use structured entities if available (most reliable)
  if (extractedEntities && extractedEntities.persons.length > 0) {
    const personLines = extractedEntities.persons.map(p => {
      let line = `  • ${p.name} = ${p.relationshipNL || p.relationship}`;
      if (p.context) line += ` — ${p.context}`;
      return line;
    });
    return buildPersonLookupBlock(personLines);
  }

  // Strategy 2: Regex extraction from raw text (fallback)
  const allText = [
    ...lifeStory.map((s) => s.content),
    intakeContext,
  ]
    .filter(Boolean)
    .join("\n");

  if (!allText || allText.trim().length < 20) return "";

  // Dutch + English relationship patterns
  const patterns = [
    // Dutch patterns
    /(?:mijn|m'n)\s+(zoon|dochter|vrouw|vriendin|vriend|partner|man|moeder|mama|vader|papa|zus|broer|oma|opa|ex|baas|collega|buurman|buurvrouw|therapeut|hulpverlener|stiefvader|stiefmoeder|schoonmoeder|schoonvader|neef|nicht|oom|tante)\s+([A-Z][a-zéèëïöüà]+)/g,
    // "[Name], mijn [relation]"
    /([A-Z][a-zéèëïöüà]+),?\s+(?:mijn|m'n)\s+(zoon|dochter|vrouw|vriendin|vriend|partner|man|moeder|mama|vader|papa|zus|broer|oma|opa|ex|baas|collega|buurman|buurvrouw|therapeut|hulpverlener|stiefvader|stiefmoeder|schoonmoeder|schoonvader|neef|nicht|oom|tante)/g,
    // English patterns
    /(?:my)\s+(son|daughter|wife|girlfriend|boyfriend|partner|husband|mother|mom|father|dad|sister|brother|grandmother|grandfather|friend|colleague|neighbor|ex|boss|therapist|stepfather|stepmother)\s+([A-Z][a-zéèëïöüà]+)/g,
    // "[Name], my [relation]"
    /([A-Z][a-zéèëïöüà]+),?\s+(?:my)\s+(son|daughter|wife|girlfriend|boyfriend|partner|husband|mother|mom|father|dad|sister|brother|grandmother|grandfather|friend|colleague|neighbor|ex|boss|therapist|stepfather|stepmother)/g,
    // "[Name] is mijn [relation]" / "[Name] was mijn [relation]"
    /([A-Z][a-zéèëïöüà]+)\s+(?:is|was)\s+(?:mijn|m'n)\s+(zoon|dochter|vrouw|vriendin|vriend|partner|man|moeder|mama|vader|papa|zus|broer|oma|opa|ex|baas|collega|buurman|buurvrouw|therapeut|hulpverlener|stiefvader|stiefmoeder)/g,
    // FREE-TEXT: "[Name], [role]" (e.g., "Melissa, partner sinds 2019")
    /([A-Z][a-zéèëïöüà]+),?\s+(zoon|dochter|vrouw|vriendin|vriend|partner|man|moeder|mama|vader|papa|zus|broer|oma|opa|ex|collega|baas|buurman|buurvrouw|therapeut|stiefvader|stiefmoeder|son|daughter|wife|girlfriend|boyfriend|husband|mother|father|sister|brother|friend|colleague)\b/g,
    // FREE-TEXT: "[Name] ([role], ...)" (e.g., "Jules (zoon, 4 jaar)")
    /([A-Z][a-zéèëïöüà]+)\s*\((zoon|dochter|vrouw|vriendin|vriend|partner|man|moeder|mama|vader|papa|zus|broer|oma|opa|ex|collega|baas|therapeut|son|daughter|wife|girlfriend|boyfriend|husband|mother|father|sister|brother|friend|colleague)[^)]*\)/g,
    // FREE-TEXT: "[Role]: [Name]" (e.g., "Partner: Melissa")
    /(zoon|dochter|vrouw|vriendin|vriend|partner|man|moeder|mama|vader|papa|zus|broer|oma|opa|ex|collega|baas|therapeut|son|daughter|wife|girlfriend|boyfriend|husband|mother|father|sister|brother|friend|colleague):\s*([A-Z][a-zéèëïöüà]+)/g,
  ];

  const foundPersons = new Map<string, string>(); // name → relationship

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(allText)) !== null) {
      // Determine which group is name and which is relationship
      const groups = match.slice(1);
      let name: string;
      let relation: string;
      
      // If first group starts with uppercase, it's the name
      if (groups[0] && /^[A-Z]/.test(groups[0])) {
        name = groups[0];
        relation = groups[1];
      } else {
        relation = groups[0];
        name = groups[1];
      }
      
      if (name && relation && !foundPersons.has(name)) {
        foundPersons.set(name, relation);
      }
    }
  }

  if (foundPersons.size === 0) {
    // Fallback: return a bilingual instruction without concrete names
    return `
─── PERSONEN-HERKENNING (NL/EN) ───
De rugzak van de gebruiker bevat persoonlijke namen en relaties.
Voordat je zegt "ik weet niet wie [naam] is", MOET je EERST de volledige tekst hierboven doorzoeken.
Als een naam voorkomt in de PERSONAL MEMORY of STRUCTURED MEMORY hierboven, dan KEN je die persoon.
Zoek op Nederlandse relatietermen: zoon, dochter, vrouw, vriendin, vriend, partner, man, moeder, vader, zus, broer, oma, opa, ex, collega, buurman, therapeut.
─── EINDE PERSONEN-HERKENNING ───`;
  }

  const personLines = Array.from(foundPersons.entries()).map(
    ([name, relation]) => `  • ${name} = ${relation}`
  );
  return buildPersonLookupBlock(personLines);
}

/**
 * Builds the final person lookup block that is injected into the system prompt.
 * This is a HARD lookup table — GPT must use it before claiming ignorance.
 */
function buildPersonLookupBlock(personLines: string[]): string {
  return `
╔══════════════════════════════════════════════════════════════╗
║  PERSONEN-LOOKUP (ABSOLUUT — ALTIJD RAADPLEGEN)              ║
╚══════════════════════════════════════════════════════════════╝

Dit zijn de personen die de gebruiker ZELF heeft genoemd in hun rugzak:

${personLines.join('\n')}

⚠️ VERPLICHTE REGEL:
Als de gebruiker vraagt "wie is [naam]?" of een naam noemt die in deze lijst staat:
→ Je KENT die persoon. Antwoord met hun relatie en context.
→ Zeg NOOIT "ik weet niet wie [naam] is" als de naam hierboven staat.
→ Zoek EERST in deze lijst + de PERSONAL MEMORY/STRUCTURED MEMORY hierboven.
→ Alleen als de naam NERGENS voorkomt, mag je vragen wie het is.

─── EINDE PERSONEN-LOOKUP ───`;
}

/**
 * Build a compact life story summary for follow-up injection.
 * Includes all life story sections and intake context so GPT can
 * recognise names, places, and events mentioned by the user.
 */
function buildCompactLifeStorySummary(
  lifeStory: Array<{ label: string; content: string }>,
  intakeContext: string,
  userName: string,
  kimBackpack?: { my_story: string; the_relationship: string; the_impact: string; my_boundaries: string; my_strength: string },
): string {
  const sections = lifeStory
    .filter(s => s.content.trim().length > 0)
    .map(s => `[${s.label}]: ${s.content.trim()}`);

  // Kim backpack sections
  const kimSections: string[] = [];
  if (kimBackpack) {
    const mapping: Array<[string, string]> = [
      ['My Story', kimBackpack.my_story],
      ['The Relationship', kimBackpack.the_relationship],
      ['The Impact', kimBackpack.the_impact],
      ['My Boundaries', kimBackpack.my_boundaries],
      ['My Strength', kimBackpack.my_strength],
    ];
    for (const [title, content] of mapping) {
      if (content && content.trim().length > 0) {
        kimSections.push(`[${title}]: ${content.trim()}`);
      }
    }
  }

  if (sections.length === 0 && kimSections.length === 0 && (!intakeContext || intakeContext.trim().length < 10)) {
    return "";
  }

  let summary = `\n─── PERSONAL MEMORY OF ${userName.toUpperCase()} (summary) ───`;
  if (intakeContext && intakeContext.trim().length > 0) {
    summary += `\nIntake: ${intakeContext.trim()}`;
  }
  for (const section of sections) {
    summary += `\n${section}`;
  }
  if (kimSections.length > 0) {
    summary += `\n\n─── KIM BACKPACK (loved one perspective) ───`;
    for (const section of kimSections) {
      summary += `\n${section}`;
    }
  }
  summary += `\n─── END PERSONAL MEMORY ───`;
  summary += `\nYou KNOW this story. If ${userName} mentions a person, place, or event listed above, you recognize it IMMEDIATELY.`;
  summary += `\nIf something is NOT listed above, do NOT fabricate it. Ask about it instead.`;
  return summary;
}

// ─── Relevance-based Conditional Injection ───────────────────────
// Determines which cached static fields are relevant for THIS specific message.

interface ConditionalContext {
  contextLine: string | null;
  relationshipAnchor: { name: string; role: string; roleEN?: string } | null;
  relationalPattern: { pattern: string; schema: string; confidence: number } | null;
  coreWound: string | null;
  recentDiary: Array<{ content: string; moodTag: string; date: string }>;
  stageOfChange: string | null;
  eigenRegieContext: {
    userInput: number;
    engineScore: number;
    zone: 'ROOD' | 'ORANJE' | 'GEEL' | 'LICHTGROEN' | 'GROEN';
    meaning: string;
    impact: { primaryDirective: string; secondaryDirective: string };
  } | null;
  relationshipMap: string;
}

function resolveConditionalContext(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  selectedTriggers: Array<{ trigger: string; score: number }>,
  dominantModule: string,
  cache: SessionCache,
): ConditionalContext {
  // ══════════════════════════════════════════════════════════════
  // V3.2: ALWAYS inject ALL cached data UNCONDITIONALLY on EVERY turn.
  // No keyword matching, no message count gating, no token savings.
  // The user's personal data is ALWAYS available to GPT.
  // This ensures GPT can reference Melissa, diary, coreWound, etc.
  // at any point in the conversation — not just the first 2 messages.
  // ══════════════════════════════════════════════════════════════
  return {
    contextLine: cache.contextLine,
    relationshipAnchor: cache.relationshipAnchor,
    relationalPattern: cache.relationalPattern,
    coreWound: cache.coreWound,
    recentDiary: cache.recentDiary,
    stageOfChange: cache.stageOfChange,
    eigenRegieContext: cache.eigenRegieContext ?? null,
    relationshipMap: cache.relationshipMap,
  };
}

// ─── Build Selective Relevance Block (for follow-up) ─────────────

function buildSelectiveRelevanceBlock(
  input: ChatRequestInput,
  conditional: ConditionalContext,
): string {
  const parts: string[] = [];

  // Selected triggers (ALWAYS — live-analyzed per message)
  const triggers = input.selectedTriggers || [];
  if (triggers.length > 0) {
    parts.push(`ACTIVE TRIGGERS:`);
    for (const t of triggers) {
      parts.push(`  - ${t.trigger} (relevance: ${t.score})`);
    }
  }

  // Core wound (ALWAYS injected)
  if (conditional.coreWound) {
    parts.push(`CORE WOUND: ${conditional.coreWound}`);
    parts.push(`  → VERPLICHT: Wees je bewust van dit onderliggende patroon. Verwijs ernaar wanneer de gebruiker emotioneel beladen taal gebruikt.`);
  }

  // Context line (ALWAYS injected)
  if (conditional.contextLine) {
    parts.push(`RELEVANT CONTEXT UIT LEVENSVERHAAL:`);
    parts.push(`  "${conditional.contextLine}"`);
    parts.push(`  → VERPLICHT: Dit is persoonlijke context. Gebruik het ACTIEF in je antwoord — niet als achtergrond.`);
  }

  // Relationship anchor (ALWAYS injected)
  if (conditional.relationshipAnchor) {
    const roleDisplay = conditional.relationshipAnchor.roleEN
      ? `${conditional.relationshipAnchor.role} / ${conditional.relationshipAnchor.roleEN}`
      : conditional.relationshipAnchor.role;
    parts.push(`RELATIE-ANKER: ${conditional.relationshipAnchor.name} (${roleDisplay})`);
    parts.push(`  → VERPLICHT: Noem deze persoon bij NAAM wanneer relevant. Dit is iemand die de gebruiker kent — gebruik het.`);
  }

  // Relational pattern (ALWAYS injected)
  if (conditional.relationalPattern) {
    parts.push(`RELATIONEEL PATROON: ${conditional.relationalPattern.pattern}`);
    if (conditional.relationalPattern.schema) {
      parts.push(`  Schema: ${conditional.relationalPattern.schema}`);
    }
    parts.push(`  → VERPLICHT: Noem dit patroon wanneer je het herkent in wat de gebruiker zegt.`);
  }

  // Stage of Change (Elias only — ALWAYS injected)
  if (input.userType === 'elias' && conditional.stageOfChange) {
    const desc = ELIAS_STAGE_DESCRIPTIONS_SHORT[conditional.stageOfChange] || conditional.stageOfChange;
    parts.push(`STAGE: ${conditional.stageOfChange} — ${desc}`);
  }

  // Relapse/Slip signal (Elias only — injected when recent event exists)
  const relapseEvent = input.recentRelapseEvent ?? null;
  if (input.userType === 'elias' && relapseEvent) {
    if (relapseEvent.type === 'herval') {
      parts.push(`⚠️ HERVAL: De gebruiker heeft ${relapseEvent.daysAgo === 0 ? 'vandaag' : `${relapseEvent.daysAgo} dag(en) geleden`} een herval gemeld. Nuchterheidsdatum is gereset.`);
      parts.push(`  → Toon compassie, GEEN oordeel. Erken de moed om dit te melden.`);
      parts.push(`  → Vraag hoe het nu gaat en wat er nodig is. Verwijs NIET direct naar modules.`);
    } else {
      parts.push(`⚠️ TERUGVAL: De gebruiker heeft ${relapseEvent.daysAgo === 0 ? 'vandaag' : `${relapseEvent.daysAgo} dag(en) geleden`} een terugval (slip) gemeld. Traject loopt door.`);
      parts.push(`  → Normaliseer: een terugval is geen falen. Erken de eerlijkheid.`);
      parts.push(`  → Exploreer wat er speelde. Geen directe oplossingen tenzij gevraagd.`);
    }
    if (relapseEvent.context) {
      parts.push(`  Context: "${relapseEvent.context}"`);
    }
    // Inject zone-filtered prevention plan (only zone-relevant fields are sent)
    const preventionPlan = input.preventionPlan ?? null;
    if (preventionPlan) {
      const zoneLabel = preventionPlan.zone ? ` (zone: ${preventionPlan.zone})` : '';
      parts.push(`  \ud83d\udccb TERUGVAL-PREVENTIEPLAN${zoneLabel} — relevante velden voor huidige zone:`);
      if (preventionPlan.warningSigns) parts.push(`    \u2022 Waarschuwingssignalen: ${preventionPlan.warningSigns}`);
      if (preventionPlan.copingStrategies) parts.push(`    \u2022 Wat helpt: ${preventionPlan.copingStrategies}`);
      if (preventionPlan.supportContacts) parts.push(`    \u2022 Steunpersonen: ${preventionPlan.supportContacts}`);
      if (preventionPlan.safeActivities) parts.push(`    \u2022 Veilige activiteiten: ${preventionPlan.safeActivities}`);
      if (preventionPlan.motivation) parts.push(`    \u2022 Motivatie: ${preventionPlan.motivation}`);
      parts.push(`  \u2192 Gebruik SPECIFIEK deze velden om de gebruiker te herinneren aan eigen kracht en hulpbronnen. Verwijs concreet naar wat zij zelf hebben opgeschreven.`);
    }
    // If prevention plan is not filled yet, hint to Elias to suggest it
    const preventionPlanMissing = input.preventionPlanMissing ?? false;
    if (preventionPlanMissing && !preventionPlan) {
      parts.push(`  \u2139\ufe0f De gebruiker heeft nog geen terugval-preventieplan ingevuld. Als het moment gepast is (niet bij crisis), noem kort dat zij in de rugzak een preventieplan kunnen invullen — zonder druk.`);
    }
  }

  // Prevention plan missing hint (outside relapse block — shown at any greeting if plan is empty)
  if (!relapseEvent) {
    const preventionPlanMissing2 = input.preventionPlanMissing ?? false;
    if (preventionPlanMissing2) {
      parts.push(`\u2139\ufe0f De gebruiker heeft nog geen terugval-preventieplan ingevuld. Als het moment gepast is, noem kort dat zij in de rugzak een preventieplan kunnen invullen \u2014 zonder druk.`);
    }
  }

  // Eigen Regie (Kim only \u2014 replaces stageOfChange for Kim users)
  if (conditional.eigenRegieContext) {
    const er = conditional.eigenRegieContext;
    parts.push(`EIGEN REGIE ZONE: ${er.zone} (gebruiker: ${er.userInput}/100, engine: ${er.engineScore}/100)`);
    parts.push(`  Betekenis: ${er.meaning}`);
    parts.push(`  → PRIMAIR: ${er.impact.primaryDirective}`);
    parts.push(`  → SECUNDAIR: ${er.impact.secondaryDirective}`);
  }

  // Recent diary (ALWAYS injected)
  if (conditional.recentDiary.length > 0) {
    parts.push(`DAGBOEK VAN DE GEBRUIKER (ZELF geschreven):`);
    for (const d of conditional.recentDiary) {
      parts.push(`  [${d.date}] (${d.moodTag}): ${d.content}`);
    }
    parts.push(`  → VERPLICHT: Refereer aan specifieke dagboek-inhoud wanneer de gebruiker over gerelateerde thema's praat.`);
  }

  // Relationship map (ALWAYS injected)
  if (conditional.relationshipMap) {
    parts.push(`RELATIEKAART:`);
    parts.push(`${conditional.relationshipMap}`);
    parts.push(`  → VERPLICHT: Gebruik namen uit deze kaart wanneer je over relaties praat. Noem ALTIJD de specifieke naam, niet "je partner" of "iemand".`);
  }

  // PsychoEducation continuity (Elias only, every relevant turn)
  const peContext = input.psychoEducationContext ?? (sessionCache?.psychoEducationContext ?? null);
  if (peContext) {
    parts.push(`PSYCHO-EDUCATIE CONTINUÏTEIT (ELIAS ONLY):`);
    parts.push(`${peContext}`);
    parts.push(`  → VERPLICHT: Gebruik deze psycho-educatieve context in je antwoord. Bouw voort op eerder besproken inzichten. Herhaal niet vanaf nul.`);
  }

  // Steunpilaren continuity (PAAL01, Elias only, every relevant turn)
  const spContext = input.steunpilarenContext ?? (sessionCache?.steunpilarenContext ?? null);
  if (spContext) {
    parts.push(`STEUNPILAREN CONTINUÏTEIT (ELIAS ONLY):`);
    parts.push(`${spContext}`);
    parts.push(`  → VERPLICHT: Refereer aan bekende steunpilaren wanneer relevant. Noem specifieke namen/plekken/routines die de gebruiker eerder noemde.`);
  }

  // Self-acceptance cluster continuity (BLIK01/ONTK01/IKST01/COEX01, Elias only)
  const saContext = input.selfAcceptanceContext ?? (sessionCache?.selfAcceptanceContext ?? null);
  if (saContext) {
    parts.push(`ZELFAANVAARDING CONTINUÏTEIT (ELIAS ONLY):`);
    parts.push(`${saContext}`);
    parts.push(`  → VERPLICHT: Bouw voort op eerder besproken zelfbeeld-thema's. Confronteer zacht zonder te beschuldigen. Geen diagnoses.`);
  }

  // Kim pattern support continuity (PAAL-K01/BEHE-K01/AANP-K01/CODEP-K01, Kim only)
  const kpContext = input.kimPatternSupportContext ?? (sessionCache?.kimPatternSupportContext ?? null);
  if (kpContext) {
    parts.push(`PATRONEN-ONDERSTEUNING CONTINUÏTEIT (KIM ONLY):`);
    parts.push(`${kpContext}`);
    parts.push(`  → VERPLICHT: Gebruik deze patroon-context. Benoem herkenbare patronen zonder te diagnosticeren. Focus op de naaste, niet op de gebruiker met verslaving.`);
  }

  if (parts.length === 0) return "";

  return `
═══ PERSOONLIJKE CONTEXT (VERPLICHT TE GEBRUIKEN) ═══
Deze data is door de gebruiker ZELF verstrekt. Je MOET het actief gebruiken in je antwoord.
Geef NOOIT generiek advies als je specifieke persoonlijke data hebt.
Noem ALTIJD namen, specifieke activiteiten, en concrete details uit deze context.
${parts.join("\n")}
═══ EINDE PERSOONLIJKE CONTEXT ═══`;
}

// ─── Build Full Relevance Block (for SESSION_INIT) ───────────────

function buildFullRelevanceBlock(input: ChatRequestInput): string {
  const parts: string[] = [];

  const triggers = input.selectedTriggers || [];
  if (triggers.length > 0) {
    parts.push(`ACTIVE TRIGGERS (system-selected):`);
    for (const t of triggers) {
      parts.push(`  - ${t.trigger} (relevance: ${t.score})`);
    }
  }

  if (input.coreWound) {
    parts.push(`CORE WOUND: ${input.coreWound}`);
    parts.push(`  → Be aware of this underlying pattern. Name it carefully if relevant.`);
  }

  if (input.contextLine) {
    parts.push(`RELEVANT CONTEXT FROM LIFE STORY:`);
    parts.push(`  "${input.contextLine}"`);
    parts.push(`  → This is a passage from ${input.userName}'s life story relevant to this message. You may carefully reference it.`);
  }

  if (input.relationshipAnchor) {
    const roleDisplay = input.relationshipAnchor.roleEN
      ? `${input.relationshipAnchor.role} / ${input.relationshipAnchor.roleEN}`
      : input.relationshipAnchor.role;
    parts.push(`RELATIONSHIP ANCHOR: ${input.relationshipAnchor.name} (${roleDisplay})`);
    parts.push(`  → This person is relevant to the current conversation. Use ONLY the relationship as described.`);
  }

  if (input.relationalPattern && input.relationalPattern.confidence >= 0.35) {
    parts.push(`RELATIONAL PATTERN DETECTED: ${input.relationalPattern.pattern}`);
    if (input.relationalPattern.schema) {
      parts.push(`  Linked schema: ${input.relationalPattern.schema}`);
    }
    parts.push(`  Confidence: ${Math.round(input.relationalPattern.confidence * 100)}%`);
    parts.push(`  → This is a recurring relational pattern. Name it carefully if relevant to the current conversation.`);
  }

  // Stage of Change (Elias only)
  if (input.userType === 'elias' && input.stageOfChange) {
    const desc = ELIAS_STAGE_DESCRIPTIONS_FULL[input.stageOfChange] || input.stageOfChange;
    parts.push(`STAGE OF CHANGE: ${input.stageOfChange}`);
    parts.push(`  ${desc}`);
    parts.push(`  → Adapt your approach to this stage. Do NOT move faster than the user.`);
  }

  // Eigen Regie (Kim only — injected at SESSION_INIT when available)
  if (input.eigenRegieContext) {
    const er = input.eigenRegieContext;
    parts.push(`EIGEN REGIE ZONE: ${er.zone} (gebruiker: ${er.userInput}/100, engine: ${er.engineScore}/100)`);
    parts.push(`  Betekenis: ${er.meaning}`);
    parts.push(`  → PRIMAIR: ${er.impact.primaryDirective}`);
    parts.push(`  → SECUNDAIR: ${er.impact.secondaryDirective}`);
        parts.push(`  → Pas je toon en aanpak aan op deze zone. Respecteer het huidige niveau van eigen regie.`);
  }
  // KERP01: Eigen Regie Plan context (Kim only — zone-specific signals, helps, anchors, triggers, boundary rules)
  if (input.eigenRegiePlanContext) {
    const erp = input.eigenRegiePlanContext;
    parts.push(`\nEIGEN REGIE PLAN (persoonlijk veiligheidsplan):`);
    if (erp.mainAnchorSentence) {
      parts.push(`  Ankerzin: "${erp.mainAnchorSentence}"`);
    }
    if (erp.currentZoneEntry) {
      const ze = erp.currentZoneEntry;
      parts.push(`  HUIDIGE ZONE-SIGNALEN:`);
      if (ze.signals) parts.push(`    Herkenningssignalen: ${ze.signals}`);
      if (ze.bodySignals) parts.push(`    Lichaamssignalen: ${ze.bodySignals}`);
      if (ze.thoughts) parts.push(`    Gedachten: ${ze.thoughts}`);
      if (ze.behaviour) parts.push(`    Gedrag: ${ze.behaviour}`);
      if (ze.whatHelps) parts.push(`    Wat helpt: ${ze.whatHelps}`);
      if (ze.boundaryActions) parts.push(`    Grensacties: ${ze.boundaryActions}`);
      if (ze.contactRule) parts.push(`    Contactregel: ${ze.contactRule}`);
      if (ze.anchorSentence) parts.push(`    Zone-ankerzin: "${ze.anchorSentence}"`);
    }
    if (erp.triggers.length > 0) {
      parts.push(`  TRIGGERS & TEGENACTIES:`);
      for (const t of erp.triggers) {
        parts.push(`    - "${t.trigger}": verliespatroon = "${t.lossOfRegiePattern}", gezonde reactie = "${t.healthyResponse}"`);
      }
    }
    if (erp.boundaryRules.length > 0) {
      parts.push(`  GRENSREGELS:`);
      for (const rule of erp.boundaryRules) {
        parts.push(`    - ${rule}`);
      }
    }
    parts.push(`  → Gebruik dit plan als referentie. Verwijs naar signalen/ankerzinnen wanneer relevant. Help de gebruiker hun eigen plan te volgen.`);
  }
  const diary = input.recentDiary || [];
  if (diary.length > 0) {
    parts.push(`RECENT DIARY ENTRIES:`);
    for (const d of diary) {
      parts.push(`  [${d.date}] (mood: ${d.moodTag}): ${d.content}`);
    }
  }

  if (parts.length === 0) return "";

  return `
╔══════════════════════════════════════════════════════╗
║  RELEVANCE CONTEXT — System-selected                 ║
╚══════════════════════════════════════════════════════╝
${parts.join("\n")}
─── END RELEVANCE CONTEXT ───`;
}

// ─── System Prompt Builder ────────────────────────────────────────

export function buildSystemPrompt(input: ChatRequestInput): string {
  const isElias = input.userType === "elias";
  const name = input.userName;

  // ── Language instruction based on user-selected locale ──
  const LOCALE_LANGUAGE_MAP: Record<string, string> = {
    nl: 'Dutch (Nederlands)',
    en: 'English',
    fr: 'French (Français)',
  };
  const selectedLanguage = LOCALE_LANGUAGE_MAP[input.locale ?? 'nl'] ?? 'Dutch (Nederlands)';
  const languageInstruction = `- LANGUAGE RULE (ABSOLUTE): You MUST respond in ${selectedLanguage}. ALL your output — therapeutic content, questions, reflections, module explanations — MUST be in ${selectedLanguage}. This overrides any other language detection. The ONLY exception is the <clinical> tag which stays in English for the clinician interface.`;

  // ── Dynamic Module List (from backend catalogs) ──
  const eliasModules = ELIAS_THERAPEUTIC_MODULES.map(m => `- ${m.id}: ${m.name} — ${m.description}`).join('\n');
  const eliasExtra = [
    '- SW01: Shadow Work — herkenning van verborgen patronen die gedrag aansturen',
    '- STOA: Stoïcijnse Sessies — 15 reflecties voor specifieke herstelmomenten',
    '- SchemaMode: Patroonherkenning — emotionele modi en herhalende levenspatronen',
    '- DBT/DGT: Distress Tolerance — crisisstabilisatie en emotieregulatie',
    '- MBT: Mentalisatie — begrijpen wat er van binnen gebeurt voor je reageert',
    '- ACT: Acceptance & Commitment — psychologische flexibiliteit en waardenactie',
    '- CGT/CBT: Cognitieve Gedragstherapie — gedachtepatronen herkennen en bijsturen',
    '- MI01: Motivational Interviewing — ambivalentie verkennen en verandermotivatie',
    '- EKT01: Emotionele Kerntherapie — fasering (verheldering, spiegel, contract, exit)',
    '- VERGV01: Vergevingsmodule — schuld en vergeving verwerken',
    '- IGH01: Intergenerationeel Herstel — generatiepatronen doorbreken',
    '- AGC01: Agency-check — externe vs interne motivatie herkennen',
    '- HWK01: Herstelwaardigheid-kern — fundamenteel zelfwaardegevoel herstellen',
    '- FALE01: Falen & Herval — actief herval verwerken zonder schaamtespiraal',
    '- VERG01: Zelfvergeving — schuldverwerking na terugval',
    '- ROUW01: Rouw & Verlies — rouwverwerking in herstelcontext',
    '- IDEN01: Identiteitsverwarring — wie ben ik zonder de verslaving',
    '- ZINK01: Zingeving & Leegte — existentieel vacuüm na stoppen',
    '- TERV01: Terugvalpreventie Verdieping — na PAARS-sessie stabilisatie',
    '- MI02: Diepe Ambivalentie — voortbouwend op MI01',
    '- SLAAP01: Slaap & Herstel — slaapproblemen bij verslaving',
  ].join('\n');
  const eliasShortModules = getEliasShortModuleList();
  const kimModules = KIM_MODULE_CATALOG.map(m => `- ${m.id}: ${m.name} — ${m.description}`).join('\n');
  const kimExtra = [
    '- BEDR01: Ontdekking van Bedrog — stabilisatie na ontdekking van verraad',
    '- VETR01: Vertrouwensherstel — vertrouwen opbouwen na bedrog',
    '- GASL01: Gaslighting Herkenning — realiteitsverankering bij manipulatie',
    '- CDP01: Codependentie Detectie — zelfverlies en afhankelijkheidspatronen',
    '- RNW01: Rouw Naaste — rouw om wie de persoon was vóór de verslaving',
    '- PAR01: Parentificatie — rolverwarring en verantwoordelijkheidsoverbelasting',
    '- FIN01: Financiële Afhankelijkheid — financiële controle en machtsongelijkheid',
    '- ISO01: Isolatie & Sociale Terugtrekking — schaamte-isolatie en micro-reconnectie',
    '- HERV-K01: Herval Naaste — actieve herval van de naaste, stabilisatie en grensbewaking',
    '- NAHERV-K01: Na-Herval — nasleep van herval, emotionele verwerking en zelfzorg',
    '- CRISIS-K01: Crisis Naaste — acute veiligheidsdreiging, geweld, suïcide, medische nood',
    '- GEVAAR-K01: Gevaar Naaste — gevaarlijke situatie door middelengebruik (agressie, dronken rijden, verdwijning, overdosis)',
    '- KIND-K01: Kind in Gevaar — kindveiligheid bij verslaving (mishandeling, verwaarlozing, parentificatie)',
    '- ROL-K01: Rol Naaste — emotiegolf na wegvallen zorgrol (opname, stabilisatie), onderdrukte woede/verdriet/leegte',
    '- VETR02-K: Verlatingsvrees Naaste — hyperwaakzaamheid bij afwezigheid/stilte partner (opname, detox, afstand)',
    '- LEUGEN-K01: Leugen Naaste — chronisch liegen, verbroken beloftes, wantrouwen vs hoop, grenzen zonder detective-rol',
    '- HOOP-K01: Hoop Naaste — hoopuitputting, wanneer-is-genoeg-genoeg, verlies van geloof in herstel/relatie',
    '- SCHAAM-K01: Schaamte Naaste — schaamte om verslaving dierbare, geheimhouding, sociaal terugtrekken',
    '- ROUW-K01: Rouw Naaste — ambigue verlies, levende rouw, missen wie dierbare was, gemiste toekomst',
    '- ISOL-K01: Isolatie Naaste — sociale isolatie door zorgrol, verlies eigen contacten, uitputting',
    '- STOA-K: Stoic Reflective Framework — controle/niet-controle onderscheid, waarden als kompas, grenzen als eigen actie, acceptatie ≠ goedkeuring, loslaten ≠ verlaten',
    '- CGT/CBT: Cognitieve Gedragstherapie — gedachtepatronen herkennen en bijsturen',
    '- DBT/DGT: Distress Tolerance — crisisstabilisatie en emotieregulatie',
    '- MBT: Mentalisatie — begrijpen wat er van binnen gebeurt voor je reageert',
    '- SchemaMode: Patroonherkenning — emotionele modi en herhalende levenspatronen',
    '- ACT: Acceptance & Commitment — psychologische flexibiliteit en waardenactie',
    '- MI01: Motivational Interviewing — ambivalentie verkennen en verandermotivatie',
    '- EKT01: Emotionele Kerntherapie — fasering (verheldering, spiegel, contract, exit)',
  ].join('\n');
  // Full module list (~3000 chars) — ONLY inject in clinical mode when user asks about capabilities.
  // The deterministic engine + nano-interpret handle module selection; GPT never needs the full list.
  const capabilityQuestionRx = /wat\s+(kun|kan)\s+je|what\s+can\s+you|welke\s+modules|wat\s+bied|qu.est-ce\s+que\s+tu\s+peux|wat\s+doe\s+je|therapie.n.*bied/i;
  const userAsksCapabilities = capabilityQuestionRx.test(input.message || '');
  const dynamicModuleListFull = isElias
    ? `YOUR ACTUAL MODULES AND CAPABILITIES (use EXACT codes when listing):\n${eliasModules}\n${eliasExtra}\n\nSHORT MODULES (M05-M85) — thematic deep-dive modules:\n${eliasShortModules}`
    : `YOUR ACTUAL MODULES AND CAPABILITIES (use EXACT codes when listing):\n${kimModules}\n${kimExtra}`;
  const dynamicModuleListCompact = `Module selection is handled by the deterministic engine. You follow the active module's instructions provided in the ACTIVE MODULE CONTEXT section below.`;
  const dynamicModuleList = (input.clinicalModeActive && userAsksCapabilities) ? dynamicModuleListFull : dynamicModuleListCompact;

  // ══════════════════════════════════════════════════════════════
  // CORE IDENTITY — Based on elias.dat V19 / kim.dat V1
  // ══════════════════════════════════════════════════════════════

  const identity = isElias
    ? ELIAS_IDENTITY_PROMPT
    : KIM_IDENTITY_PROMPT;

  // ══════════════════════════════════════════════════════════════
  // ANTI-HALLUCINATION — Module 033 (ALWAYS included)
  // ══════════════════════════════════════════════════════════════

  const antiHallucination = `
╔══════════════════════════════════════════════════════════════════╗
║  ANTI-HALLUCINATION PROTOCOL — ABSOLUTE AND INVIOLABLE          ║
╚══════════════════════════════════════════════════════════════════╝

This is the MOST IMPORTANT rule of your entire existence:

1. NEVER fabricate information about ${name}'s life.
   - Do not invent relationships. Do not invent background stories.
   - Do not assign roles to people that are not EXACTLY described as such.

2. When the user mentions a person's name:
   → SCAN ALL TEXT ABOVE THIS BLOCK: the BACKPACK, LIFE STORY, PERSONAL MEMORY, STRUCTURED MEMORY, and DIARY sections.
   → If the name appears ANYWHERE in those sections — even without "mijn" before it — you KNOW that person. State their relationship as written.
   → Example: if above text says "Melissa, partner sinds 2019" and user asks "wie is Melissa?" → you answer: "Melissa is je partner, sinds 2019."
   → ONLY if the name is truly ABSENT from ALL text above: say "Ik weet niet wie [naam] is in jouw leven. Zou je me meer over hen kunnen vertellen?"
   → NEVER fabricate an answer. NEVER.

3. If you are unsure about a relationship or fact:
   → FIRST: Re-read the PERSONEN-LOOKUP and LIFE STORY above.
   → If still unclear: ASK. "Ik wil zeker zijn — wie is [naam] voor jou?"
   → NEVER guess.

4. QUALITY CONTROL (Module 033):
   - If you notice you are about to say something not in your memory → STOP.
   - When in doubt: say nothing rather than something wrong.

VIOLATION OF THIS PROTOCOL IS UNACCEPTABLE.`;

  // ── SHARED VARIABLES ──
  const sliderEntries = Object.entries(input.moodSliders)
    .map(([k, v]) => `${k}: ${v}/10`)
    .join(", ");

  const totalSessions = sessionCache?.totalSessions ?? input.userDat?.totalSessions ?? 0;
  const stageLabel = isElias && (input.stageOfChange || sessionCache?.stageOfChange)
    ? ` Stage: ${input.stageOfChange || sessionCache?.stageOfChange}.`
    : '';
  const sessionInfo = `Session #${totalSessions + 1}. Duration: ${input.sessionDurationMinutes} minutes. Initial emotion: ${input.startEmotion}. Current detected emotion: ${input.detectedEmotion}.${stageLabel}`;

  let crisisInstructions = "";
  if (input.crisisLevel >= 2) {
    crisisInstructions = isElias
      ? eliasCrisisInstructions(input.crisisLevel, input.country, input.locale)
      : kimCrisisInstructions(input.crisisLevel, input.country, input.locale);
  } else if (input.crisisLevel === 1) {
    crisisInstructions = `\nHEIGHTENED VIGILANCE. Be extra attentive to signs of distress.`;
  }

  // ── Relapse-intent instruction (when engine detected relapse intent) ──
  let relapseIntentInstruction = '';
  if (input.relapseIntent?.detected) {
    relapseIntentInstruction = `
=== RELAPSE-INTENT GEDETECTEERD (confidence: ${input.relapseIntent.confidence.toFixed(2)}) ===
De gebruiker heeft een expliciete gebruikswens of relapse-intentie uitgesproken.
Je MOET nu:
1. GROUNDING: Erken het verlangen zonder oordeel. "Ik hoor dat je nu een sterk verlangen voelt."
2. NORMALISEER: Verlangen is een normaal onderdeel van herstel. Zeg dit expliciet.
3. NIET-OORDELEND: Geen schuldgevoel opwekken. Geen "maar je was zo goed bezig".
4. DIRECTIEF: Bied concrete coping-strategieën aan (urge surfing, 5-4-3-2-1 grounding, bel iemand).
5. VEILIGHEID: Vraag of de gebruiker nu veilig is en of er middelen in de buurt zijn.
6. VERBINDING: Verwijs naar het netwerk (sponsor, hulpverlener, vertrouwenspersoon).

Toon: Warm, direct, niet-panikeren. Je bent een anker, geen politieagent.
Doe NIET: bagatelliseren, moraliseren, of het verlangen negeren.
=== EINDE RELAPSE-INTENT INSTRUCTIE ===`;
  }

  const dominantModule = input.dominantModule || (input.activeModules.length > 0 ? input.activeModules[0] : '');
  const moduleInstructions = dominantModule
    ? `Dominant therapeutic module: ${dominantModule}. Focus your response on this approach.`
    : "";

  const stance = input.therapeuticStance
    ? `Therapeutic stance: ${input.therapeuticStance}`
    : "";

  // ── Guidance Depth (ceiling logic) ──
  // User setting is a MAXIMUM, not absolute. Effective depth = min(userSetting, stateAllowedDepth)
  // Zone mapping: RED/PURPLE → force 'light', ORANGE → cap 'normal', YELLOW/GREEN → user setting applies
  const DEPTH_ORDER: Array<'light' | 'normal' | 'deep'> = ['light', 'normal', 'deep'];
  const userDepth = input.guidanceDepth ?? sessionCache?.guidanceDepth ?? 'normal';

  // Determine state-allowed depth from crisis level + risk score + mood sliders
  let stateAllowedDepth: 'light' | 'normal' | 'deep' = 'deep';
  const riskScore = input.riskScore ?? 0;
  const sliderValues = Object.values(input.moodSliders);
  const maxDistress = Math.max(...sliderValues.filter((_, i) => {
    const keys = Object.keys(input.moodSliders);
    // Distress sliders: exclude positive sliders (Elias: focus, Kim: selfCare)
    const POSITIVE_SLIDERS = [...ELIAS_POSITIVE_SLIDERS, ...KIM_POSITIVE_SLIDERS];
    return !POSITIVE_SLIDERS.includes(keys[i]);
  }), 0);

  if (input.crisisLevel >= 2 || riskScore >= 8 || maxDistress >= 9) {
    // RED/PURPLE zone → force light: stabilize first, no deep exploration
    stateAllowedDepth = 'light';
  } else if (input.crisisLevel === 1 || riskScore >= 5 || maxDistress >= 7) {
    // ORANGE zone → cap at normal: some reflection ok, no deep confrontation
    stateAllowedDepth = 'normal';
  }
  // YELLOW/GREEN → stateAllowedDepth stays 'deep' (user setting applies)

  // Effective depth = min(userSetting, stateAllowedDepth)
  const userIdx = DEPTH_ORDER.indexOf(userDepth);
  const stateIdx = DEPTH_ORDER.indexOf(stateAllowedDepth);
  const effectiveDepth = DEPTH_ORDER[Math.min(userIdx, stateIdx)];

  let guidanceInstruction = '';
  if (effectiveDepth === 'light') {
    guidanceInstruction = `\nGUIDANCE DEPTH: LIGHT (${stateAllowedDepth !== userDepth ? 'lowered due to current state' : 'user preference'})\n- Listen more than you ask.\n- Ask at most 1 open question per message.\n- Give space and silence. Validate briefly.\n- Do not probe deeper unless the user goes there themselves.\n- PROACTIVITY: NONE. Do NOT offer tools, techniques, or directions unless the user explicitly asks.\n- Tone: warm, calm, restrained.`;
  } else if (effectiveDepth === 'deep') {
    guidanceInstruction = `\nGUIDANCE DEPTH: DEEP (user preference, state allows this)\n- Actively probe patterns, emotions, and underlying beliefs.\n- Name what you observe, even if it may be uncomfortable.\n- Use reflection and confrontation (respectful but direct).\n- Connect current situation to earlier patterns from the life story.\n- PROACTIVITY: ACTIVE. When the user expresses being stuck, lost, or not knowing how to approach something (even without an explicit question), proactively offer a concrete tool, technique, or direction. Frame it as a soft invitation: \"Mag ik je iets aanreiken om mee te beginnen?\" or \"Ik heb een idee dat zou kunnen helpen — wil je het horen?\". Do NOT wait for an explicit request. Do NOT dump multiple tools at once — offer ONE thing and check if it lands.\n- Tone: engaged, sharp, challenging but safe.`;
  } else {
    guidanceInstruction = `\nGUIDANCE DEPTH: NORMAL (${stateAllowedDepth !== userDepth ? 'lowered due to current state' : 'user preference'})\n- Balance between listening and reflecting.\n- Ask 1-2 open questions per message.\n- Name patterns when relevant, but do not insist.\n- PROACTIVITY: MODERATE. When the user clearly signals being stuck or lost (\"ik weet niet hoe\", \"ik heb geen idee\", \"waar begin ik\"), you MAY offer a direction or tool — but always as an invitation, never a push. Example: \"Zal ik je een mogelijke ingang geven?\" If the user does not signal being stuck, stay reflective.\n- Tone: warm, engaged, reflective.`;
  }

  console.log(`[AI Chat] Guidance depth: user=${userDepth}, stateAllowed=${stateAllowedDepth}, effective=${effectiveDepth} (crisis=${input.crisisLevel}, risk=${riskScore}, maxDistress=${maxDistress})`);

  // ── INVALID RESPONSE FILTER + THERAPY SELECTION MATRIX ──
  // Always injected — prevents generic-only responses and enforces therapeutic micro-layers
  const invalidResponseFilter = `
═══ THERAPEUTIC RESPONSE RULE — MANDATORY ═══

When the user input contains emotional, relational, addiction-related, shame-related,
avoidance, self-neglect, or distress signals, your response is INVALID if it:
- only gives breathing instructions
- only gives grounding exercises
- only gives water/food/rest advice
- only reassures without therapeutic content
- does not reflect the user's inner state
- does not contain at least one therapeutic interpretation

A valid emotionally relevant response must contain:
1. One empathic recognition of what is happening
2. One therapeutic interpretation (not a diagnosis — a human reading)
3. One micro-intervention from: DGT distress tolerance, ACT defusion,
   self-compassion, MBT mentalisation, or relapse-prevention logic
4. One concrete next step (small, doable)
5. One autonomy-preserving close ("you choose the pace")

In RED zone: keep it short and human.
Maximum 3 sentences. No analysis. No questions.
But those 3 sentences must carry therapeutic weight — not just instructions.
═══ END THERAPEUTIC RESPONSE RULE ═══`;

  const therapySelectionMatrix = `
═══ THERAPY SELECTION — INTERNAL ROUTING RULES ═══
These rules determine WHICH technique to apply. Apply them naturally in conversation.
You may name your modules honestly if asked, but do NOT explain this routing logic to the user.

IF craving signals detected:
  Use: DBT distress tolerance + relapse-prevention logic

IF shame signals detected:
  Use: self-compassion + ACT defusion

IF user is collapsing / RED zone:
  Use: DBT distress tolerance + self-compassion
  Do NOT use: MBT, schema therapy, confrontation

IF user is angry:
  Use: MBT mentalisation + DBT emotion regulation

IF user is avoidant:
  Use: ACT values-based micro-action

IF user is ruminating:
  Use: CBT thought loop + ACT defusion

These are not suggestions. These are minimum requirements.
═══ END THERAPY SELECTION ═══`;

  // ── Regulation Layer Injection ──
  // If the regulation layer determined an action (non-reflect), inject its GPT instruction.
  // This runs BEFORE the system prompt is assembled, so it's available for both follow-up and session-start.
  let regulationInstruction = '';
  if (input.regulationResult && input.regulationResult.gptInstruction) {
    const reg = input.regulationResult;
    const softenedLabel = reg.wasSoftened ? ' (softened — previous message already contained regulation)' : '';
    const skippedLabel = reg.wasSkipped ? ' (skipped — previous message already contained regulation)' : '';
    regulationInstruction = `\n═══ EMOTIONAL REGULATION${softenedLabel}${skippedLabel} ═══\n${reg.gptInstruction}\n═══ END REGULATION ═══`;
    console.log(`[AI Chat] Regulation injected: action=${reg.action}, zone=${reg.zone}, depth=${reg.effectiveDepth}, softened=${reg.wasSoftened}, skipped=${reg.wasSkipped}`);
  }

  // ── Engine Directive Injection ──
  // Passes routed zone impact values directly into the prompt. No transformation.
  let engineDirectiveBlock = '';
  if (input.engineDirective) {
    const ed = input.engineDirective;
    const impactLines = Object.entries(ed.impact)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');
    engineDirectiveBlock = `\n═══ ENGINE DIRECTIVE (${ed.engine.toUpperCase()}) ═══\nZone: ${ed.zoneLevel} — ${ed.zoneLabel}\n${impactLines}\n═══ END ENGINE DIRECTIVE ═══`;
    console.log(`[AI Chat] Engine directive injected: engine=${ed.engine}, zone=${ed.zoneLevel}, impact=${JSON.stringify(ed.impact)}`);
  }

  // ── Intervention Continuity Injection (Elias only) ──
  // Passes zone-linked therapeutic memory into the prompt for consistent therapeutic line.
  let interventionContinuityBlock = '';
  if (input.interventionContinuity) {
    interventionContinuityBlock = `\n═══ ${input.interventionContinuity}\n═══ END INTERVENTION CONTINUITY ═══`;
    console.log(`[AI Chat] Intervention continuity injected`);
  }

  let projectionBlock = '';
  if (input.projectionContext) {
    projectionBlock = `\n${input.projectionContext}`;
    if (input.projectionDeepening) {
      projectionBlock += `\nDEEPENING INSTRUCTION: ${input.projectionDeepening}`;
    }
    console.log(`[AI Chat] Projection context injected${input.projectionDeepening ? ' (with deepening)' : ''}`);
  }

  let stoaBlock = '';
  if (input.stoaContext) {
    stoaBlock = `\n${input.stoaContext}`;
    console.log(`[AI Chat] STOA context injected`);
  }

  let schemaModeBlock = '';
  if (input.schemaModeContext) {
    schemaModeBlock = `\n${input.schemaModeContext}`;
    console.log(`[AI Chat] Schema/Mode context injected`);
  }

  let actBlock = '';
  if (input.actContext) {
    actBlock = `\n${input.actContext}`;
    console.log(`[AI Chat] ACT context injected`);
  }

  let cgtBlock = '';
  if (input.cgtContext) {
    cgtBlock = `\n${input.cgtContext}`;
    console.log(`[AI Chat] CBT/CGT context injected`);
  }

  let dgtBlock = '';
  if (input.dgtContext) {
    dgtBlock = `\n${input.dgtContext}`;
    console.log(`[AI Chat] DGT/DBT context injected`);
  }

  let mbtBlock = '';
  if (input.mbtContext) {
    mbtBlock = `\n${input.mbtContext}`;
    console.log(`[AI Chat] MBT++ context injected`);
  }

  let ko1Block = '';
  if (input.ko1Context) {
    ko1Block = `\n${input.ko1Context}`;
    console.log(`[AI Chat] KO1 Recognition & Validation context injected`);
  }
  let relationalStanceBlock = '';
  if (input.relationalStanceFilter) {
    relationalStanceBlock = `\n${input.relationalStanceFilter}`;
    console.log(`[AI Chat] Relational Stance Filter injected`);
  }

  let k05Block = '';
  if (input.k05Context) {
    k05Block = `\n${input.k05Context}`;
    console.log(`[AI Chat] K05 Communication Skills context injected`);
  }
  let k02Block = '';
  if (input.k02Context) {
    k02Block = `\n${input.k02Context}`;
    console.log(`[AI Chat] K02 Enabling Awareness context injected`);
  }
  let k04Block = '';
  if (input.k04Context) {
    k04Block = `\n${input.k04Context}`;
    console.log(`[AI Chat] K04 Emotional Regulation context injected`);
  }
  let k04s4Block = '';
  if (input.k04s4Context) {
    k04s4Block = `\n${input.k04s4Context}`;
    console.log(`[AI Chat] K04-S4 Betrayal/Trust context injected`);
  }
  let k06Block = '';
  if (input.k06Context) {
    k06Block = `\n${input.k06Context}`;
    console.log(`[AI Chat] K06 Self-Care context injected`);
  }
  let k01Block = '';
  if (input.k01Context) {
    k01Block = `\n${input.k01Context}`;
    console.log(`[AI Chat] K01 Boundary Setting context injected`);
  }
  let k03Block = '';
  if (input.k03Context) {
    k03Block = `\n${input.k03Context}`;
    console.log(`[AI Chat] K03 Self-Care With Shadow Layer context injected`);
  }
  let sw01Block = '';
  if (input.sw01Context) {
    sw01Block = `\n${input.sw01Context}`;
    console.log(`[AI Chat] SW01 Shadow Work context injected`);
  }
  let sto01Block = '';
  if (input.sto01Context) {
    sto01Block = `\n${input.sto01Context}`;
    console.log(`[AI Chat] STO01 Stoicism context injected`);
  }

  let vspInsightBlock = '';
  if (input.vspInsightContext) {
    vspInsightBlock = `\n${input.vspInsightContext}`;
    console.log(`[AI Chat] VSP Insight context injected (store:false)`);
  }

  let vspBackpackProfileBlock = '';
  if (input.vspBackpackProfile && isElias) {
    vspBackpackProfileBlock = `\n=== VSP BACKPACK PROFILE (personal relapse prevention plan) ===\n${input.vspBackpackProfile}\n=== END VSP BACKPACK PROFILE ===`;
    console.log(`[AI Chat] VSP Backpack Profile injected (${input.vspBackpackProfile.length} chars)`);
  }

  let vspStructuredSectionBlock = '';
  if (input.vspStructuredSection && isElias) {
    const isHighZone = input.vspLevel === 'ROOD' || input.vspLevel === 'RED' || 
                       input.vspLevel === 'PAARS' || input.vspLevel === 'PURPLE' ||
                       input.vspLevel === 'ORANJE' || input.vspLevel === 'ORANGE';
    // V3.1: HARD directive for ALL zones — the user's own content is ALWAYS primary material
    const directive = isHighZone
      ? `\n\n⚠️ VERPLICHTE DE-ESCALATIE INSTRUCTIE (ZONE ${input.vspLevel}):\nDe gebruiker zit in zone ${input.vspLevel}. Hieronder staat wat ZIJ ZELF schreven dat helpt.\nJe MOET deze strategieën PROACTIEF aanbieden — wacht NIET tot de gebruiker erom vraagt.\nGebruik hun EIGEN woorden. Stel ÉÉN specifieke actie voor uit hun "wat helpt" lijst.\nGeef GEEN generiek advies ("laten we samen ademen") als ze specifieke persoonlijke strategieën hebben.\nHun plan is hun anker — verwijs er DIRECT naar.`
      : `\n\n=== VERPLICHTE INSTRUCTIE (ZONE ${input.vspLevel || 'GROEN'}) ===\nHieronder staat het PERSOONLIJK veiligheidsplan van de gebruiker — door HEN ZELF geschreven.\nJe MOET deze content ACTIEF gebruiken in je antwoorden:\n- Refereer aan hun signalen als je patronen herkent in wat ze zeggen.\n- Verwijs naar hun "wat helpt" als je een suggestie doet.\n- Gebruik hun ankerzin als grondingstechniek wanneer passend.\n- Zeg NOOIT "je veiligheidsplan zegt..." — verweef het NATUURLIJK.\n- Dit is GEEN achtergrondkennis — dit is hun ACTIEVE zelfhulp-strategie.`;
    vspStructuredSectionBlock = `\n=== PERSOONLIJK VEILIGHEIDSPLAN (door de gebruiker ZELF geschreven) ===${directive}\n${input.vspStructuredSection}\n=== EINDE PERSOONLIJK VEILIGHEIDSPLAN ===`;
    console.log(`[AI Chat] VSP Structured Section injected (${input.vspStructuredSection.length} chars, zone=${input.vspLevel}, highZone=${isHighZone})`);
  }

  // Inject only the ACTIVE short module prompt block (M05-M85) for Elias
  // We don't inject all 66 at once (53K tokens) — only the one the pipeline selected
  let shortModuleBlock = '';
  if (isElias) {
    const dominantMod = (input.dominantModule || '').toUpperCase();
    const isHighZoneVsp = (input.vspLevel === 'ROOD' || input.vspLevel === 'RED' || input.vspLevel === 'PAARS' || input.vspLevel === 'PURPLE') && input.vspStructuredSection;
    // HIGH ZONE VSP OVERRIDE: When user is in ROOD/PAARS AND has a VSP with 'wat helpt',
    // suppress the therapeutic module — the user's OWN safety plan takes absolute priority.
    // The module would compete with VSP instructions and cause generic responses.
    if (!isHighZoneVsp) {
      const matchedModule = ELIAS_SHORT_MODULE_PROMPTS.find(m => m.id === dominantMod);
      if (matchedModule) {
        shortModuleBlock = `\n\n═══ ACTIVE SHORT MODULE: ${matchedModule.id} — ${matchedModule.name} ═══\n${matchedModule.promptBlock}\n═══ END ACTIVE SHORT MODULE ═══`;
      }
    } else {
      // In ROOD/PAARS with VSP: inject a short directive instead of full module
      shortModuleBlock = `\n\n═══ VSP OVERRIDE (ZONE ${input.vspLevel}) ═══\nDe therapeutische module is UITGESCHAKELD voor deze beurt.\nREDEN: De gebruiker heeft een persoonlijk veiligheidsplan met specifieke strategieën.\nJe ENIGE taak nu: gebruik HUN 'wat helpt' content hieronder als primaire interventie.\nGeen generiek grounding. Geen module-technieken. Alleen HUN plan.\n═══ END VSP OVERRIDE ═══`;
    }
  }

  let sessionEndInstructions = "";
  if (input.message === "__SESSION_END__") {
    sessionEndInstructions = `\nThe user is ending this session. Generate a warm farewell that:
1. Briefly names what was discussed (1-2 sentences)
2. Affirms the user's courage/effort
3. Confirms that the session has been saved
4. Gently encourages for next time
Keep it short (3-5 sentences max). Do NOT ask new questions.`;
  }

  // ══════════════════════════════════════════════════════════════
  // FOLLOW-UP MESSAGES — SELECTIVE INJECTION from cache
  // ══════════════════════════════════════════════════════════════

  if (!input.isSessionStart) {
    // ── PERSONA ISOLATION GUARD ──────────────────────────────────────────────
    // If sessionCache belongs to a different persona (e.g., Elias cache used for Kim),
    // invalidate it entirely. This prevents cross-persona contamination when V3 greeting
    // bypasses SESSION_INIT and the first follow-up arrives as LIVE_MESSAGE.
    if (sessionCache && sessionCache.userType !== input.userType) {
      console.warn(`[AI Chat] PERSONA MISMATCH: sessionCache.userType=${sessionCache.userType} vs input.userType=${input.userType} — invalidating stale cache`);
      sessionCache = null;
    }

    // Resolve which cached fields are relevant for THIS message
    const conditional = sessionCache
      ? resolveConditionalContext(
          input.message,
          input.conversationHistory,
          input.selectedTriggers || [],
          dominantModule,
          sessionCache,
        )
      : {
          contextLine: null,
          relationshipAnchor: null,
          relationalPattern: null,
          coreWound: null,
          recentDiary: [],
          stageOfChange: null,
          eigenRegieContext: null,
          relationshipMap: "",
        };

    const selectiveRelevance = buildSelectiveRelevanceBlock(input, conditional);

    // Log what was conditionally included
    const included: string[] = [];
    if (conditional.contextLine) included.push('contextLine');
    if (conditional.relationshipAnchor) included.push('anchor');
    if (conditional.relationalPattern) included.push('pattern');
    if (conditional.coreWound) included.push('wound');
    if (conditional.recentDiary.length > 0) included.push(`diary(${conditional.recentDiary.length})`);
    if (conditional.stageOfChange) included.push('stage');
    if (conditional.eigenRegieContext) included.push(`eigenRegie(${conditional.eigenRegieContext.zone})`);
    if (conditional.relationshipMap) included.push('relationMap');
    console.log(`[AI Chat] Follow-up selective injection: [${included.join(', ') || 'none'}]`);
    if (conditional.relationshipMap) {
      console.log(`[AI Chat] Follow-up PERSONEN-LOOKUP active (${conditional.relationshipMap.split('•').length - 1} persons)`);
    } else {
      console.log(`[AI Chat] Follow-up PERSONEN-LOOKUP: EMPTY`);
    }

    // V3.2: ALWAYS inject full context — no relevance gating, no token savings.
    // The user's personal data is ALWAYS available to GPT on every turn.
    let lifeStoryContext = '';
    if (sessionCache?.hasStructuredEntities && sessionCache.structuredMemory) {
      lifeStoryContext = `\n─── STRUCTURED MEMORY (extracted from rugzak) ───\n${sessionCache.structuredMemory}\n─── END STRUCTURED MEMORY ───`;
    } else if (input.contextSummary) {
      lifeStoryContext = `\n─── CONTEXT SUMMARY (live-compressed) ───\n${input.contextSummary}\n─── END CONTEXT SUMMARY ───`;
    } else {
      lifeStoryContext = sessionCache?.lifeStorySummary ?? '';
    }

    // Inject backpackAnalysis context (deep GPT-4o analysis of backpack content)
    let backpackAnalysisContext = '';
    if (input.backpackAnalysis && input.backpackAnalysis.schemas.length > 0) {
      const triggers = input.backpackAnalysis.triggers.join(', ');
      const beliefs = input.backpackAnalysis.coreBeliefs.join('; ');
      const coping = input.backpackAnalysis.copingPatterns.join('; ');
      if (input.clinicalModeActive) {
        // Clinical mode: full disclosure with schema/mode names and percentages
        const schemas = input.backpackAnalysis.schemas
          .filter(s => s.confidence >= 0.35)
          .map(s => `${s.name} (${(s.confidence * 100).toFixed(0)}%): ${s.evidence}`)
          .join('\n  ');
        const modi = input.backpackAnalysis.modi
          .filter(m => m.confidence >= 0.35)
          .map(m => `${m.name} (${(m.confidence * 100).toFixed(0)}%): ${m.evidence}`)
          .join('\n  ');
        backpackAnalysisContext = `\n─── BACKPACK DEEP ANALYSIS (GPT-4o, ${input.backpackAnalysis.analyzedAt}) ───
  Schema's: ${schemas || 'geen gedetecteerd'}
  Modi: ${modi || 'geen gedetecteerd'}
  Triggers: ${triggers || 'geen'}
  Kernovertuigingen: ${beliefs || 'geen'}
  Copingpatronen: ${coping || 'geen'}
─── END BACKPACK ANALYSIS ───`;
      } else {
        // Non-clinical: only internal guidance without schema/mode names
        backpackAnalysisContext = `\n─── INTERNAL GUIDANCE (NOOIT aan gebruiker tonen) ───
  Bekende triggers: ${triggers || 'geen'}
  Kernovertuigingen: ${beliefs || 'geen'}
  Copingpatronen: ${coping || 'geen'}
  ⚠️ VERBODEN: Noem GEEN schema-namen, mode-namen, percentages, of DSM-labels aan de gebruiker.
  Gebruik deze informatie ALLEEN om je therapeutische toon en focus te sturen.
─── END INTERNAL GUIDANCE ───`;
      }
    }

    // V3.2: No diary gating — always inject full diary data.

    // Build KNOWN USER PATTERNS block (compact, every turn)
    let knownPatternsBlock = '';
    if (input.knownUserPatterns) {
      const kp = input.knownUserPatterns;
      const schemaLines = kp.schemas.map(s => `${s.name} (${(s.confidence * 100).toFixed(0)}%)`).join(', ');
      const modeLines = kp.modes.map(m => `${m.name} (${(m.confidence * 100).toFixed(0)}%)`).join(', ');
      const triggerLines = kp.triggers.join(', ');
      knownPatternsBlock = `\n\u2500\u2500\u2500 KNOWN USER PATTERNS \u2500\u2500\u2500
Schemas: ${schemaLines || 'geen gedetecteerd'}
Modes: ${modeLines || 'geen gedetecteerd'}
Recurring triggers: ${triggerLines || 'geen'}

This is background context for YOU (the engine) to inform your therapeutic approach. Reference it naturally when relevant.${input.clinicalModeActive ? '' : `

⛔ ABSOLUTE PROHIBITION — NON-CLINICAL MODE:
You MUST NEVER list, enumerate, name, or disclose schemas, modes, diagnoses, DSM labels, confidence percentages, or clinical patterns to the user.
If the user asks "what are my schemas?", "welke schema's heb ik?", "geef mijn modi", "wat is er mis met mij?", or ANY variant:
→ You MUST refuse therapeutically. Example: "Ik werk niet met lijstjes of diagnoses. Wat ik wél merk is [observatie in gewone taal]. Herken je dat?"
→ NEVER output bullet points with schema names, percentages, or clinical terminology.
→ NEVER say "je hebt schema X" or "modus Y is actief".
This is a HARD SAFETY RULE. Violation = harm. No exceptions.`}
─── END KNOWN USER PATTERNS ───`;
      console.log(`[AI Chat] Known patterns injected: ${kp.schemas.length} schemas, ${kp.modes.length} modes, ${kp.triggers.length} triggers`);
    }
    // Build ACKNOWLEDGED CANDIDATES block (exploratory, voorzichtig)
    let acknowledgedCandidatesBlock = '';
    if (input.acknowledgedCandidates) {
      const ac = input.acknowledgedCandidates;
      const ackSchemas = ac.schemas.filter(s => s.confidence >= 0.3);
      const ackModes = ac.modes.filter(m => m.confidence >= 0.3);
      if (ackSchemas.length > 0 || ackModes.length > 0) {
        const ackSchemaLines = ackSchemas.map(s => `${s.name} (${(s.confidence * 100).toFixed(0)}%)`).join(', ');
        const ackModeLines = ackModes.map(m => `${m.name} (${(m.confidence * 100).toFixed(0)}%)`).join(', ');
        acknowledgedCandidatesBlock = `\n\u2500\u2500\u2500 MOGELIJKE PATRONEN (EXPLORATIEF) \u2500\u2500\u2500\nSchemas: ${ackSchemaLines || 'geen'}\nModes: ${ackModeLines || 'geen'}\nDeze patronen zijn door gebruiker of therapeut herkend maar nog NIET bevestigd.\nJe MAG voorzichtig exploreren ("Ik merk dat...", "Herken je...") maar NOOIT als feit presenteren.\n\u2500\u2500\u2500 END MOGELIJKE PATRONEN \u2500\u2500\u2500`;
        console.log(`[AI Chat] Acknowledged candidates injected: ${ackSchemas.length} schemas, ${ackModes.length} modes`);
      }
    }

        // Inject previous session summary (compact, from cache)
    const sessionHistoryBlock = sessionCache?.sessionAnalysesSummary || '';
    // DIST01: Inject distillation context (persons, life context, signals from continuous extraction)
    const distillationBlock = (input.distillationContext || sessionCache?.distillationContext) ?? '';
    // DIST01: Inject pattern acknowledgment (repeated signals → GPT references them)
    const patternAckBlock = (input.patternAcknowledgment || sessionCache?.patternAcknowledgment) ?? '';
    return `${identity}
${conditional.relationshipMap}
${lifeStoryContext}
${sessionHistoryBlock}
${distillationBlock}
${patternAckBlock}
${backpackAnalysisContext}
${knownPatternsBlock}
${acknowledgedCandidatesBlock}
The user's name is ${name}. Address them by name occasionally.

${antiHallucination}

${selectiveRelevance}

=== MANDATORY BEHAVIORAL INSTRUCTIONS ===
${stance}
${guidanceInstruction}
${regulationInstruction}
${invalidResponseFilter}
${therapySelectionMatrix}
${engineDirectiveBlock}
${interventionContinuityBlock}
${projectionBlock}
${stoaBlock}
${schemaModeBlock}
${actBlock}
${cgtBlock}
${dgtBlock}
${mbtBlock}
${relationalStanceBlock}
${ko1Block}
${k05Block}
${k02Block}
${k04Block}
${k04s4Block}
${k06Block}
${k01Block}
${k03Block}
${sw01Block}
${sto01Block}
${shortModuleBlock}
${vspInsightBlock}
${vspBackpackProfileBlock}
${vspStructuredSectionBlock}

These behavioral instructions are ABSOLUTE. They override your default conversational style.
The sliders tell you exactly how the user feels — USE them in your response.
=== END MANDATORY INSTRUCTIONS ===

CURRENT STATE:
- Mood sliders: ${sliderEntries}
- Safety Plan Zone: ${input.vspLevel ?? 'not set'} ${input.vspLevel === 'ROOD' || input.vspLevel === 'RED' ? '⚠️ HIGH RELAPSE RISK' : input.vspLevel === 'ORANJE' || input.vspLevel === 'ORANGE' ? '⚠️ ELEVATED RISK' : input.vspLevel === 'PAARS' || input.vspLevel === 'PURPLE' ? '🚨 CRISIS' : ''}
- Urgency level: ${input.urgency}
- Risk score: ${input.riskScore ?? 0}/10
- Current timestamp: ${input.deviceTimeContext?.deviceNowIso ?? new Date().toISOString()}
- Device local time: ${input.deviceTimeContext?.localTime ?? 'unknown'}
- Device timezone: ${input.deviceTimeContext?.timeZone ?? 'unknown'}
- Day part: ${input.deviceTimeContext?.greetingDaypart ?? 'unknown'}
- IMPORTANT: When the user asks what time it is, or when you reference the current time, ALWAYS use the "Device local time" above. NEVER calculate time yourself.
${sessionInfo}
${input.bufferSnapshot ? `
LIVE SESSION CONTEXT (real-time analysis):
- Zone: ${input.bufferSnapshot.zone ?? 'unknown'}
- Emotional direction: ${input.bufferSnapshot.emotionalDirection ?? 'unknown'}
- Live intent: ${input.bufferSnapshot.liveIntent ?? 'none'}
- Dominant state: ${input.bufferSnapshot.dominantState ?? 'none'}
Use this live context to attune your tone and depth to the CURRENT moment.` : ''}
${input.nanoInterpret ? `
MESSAGE INTERPRETATION (pre-analyzed by system):
- Dutch translation: ${input.nanoInterpret.translatedNL}
- Detected intent: ${input.nanoInterpret.intent}
- Themes: ${input.nanoInterpret.themes.join(', ')}
- Resolved module: ${input.nanoInterpret.resolvedModule} (via theme: ${input.nanoInterpret.matchedTheme ?? 'default'})
Use the Dutch translation as your reference for the user's meaning. The themes guide your response focus. Do NOT repeat the translation back to the user — respond naturally in the conversation language.` : ''}
${input.dayStructureContext ? `
DAY STRUCTURE (user's planned daily schedule for today):
${input.dayStructureContext}

DAY STRUCTURE BEHAVIORAL RULES (ABSOLUTE):
1. ANTI-FABRICATION: Only reference activities that LITERALLY appear in the schedule above. NEVER invent, assume, or hallucinate activities not listed.
2. TIME-AWARE TONE: Use the "Day part" and "Device local time" above to attune your tone:
   - morning (05:00-11:59): fresh, energetic, forward-looking
   - afternoon (12:00-16:59): check-in tone, how is the day going
   - evening (17:00-21:59): reflective, winding down
   - night (22:00-04:59): gentle, concerned — see OFF-SCHEDULE rule
3. CURRENT BLOCK REFERENCE: Compare "Device local time" with the schedule. Identify which block ${name} should currently be in. You may reference it naturally: "Ik zie dat je nu [activiteit] hebt staan" — but ONLY if it appears in the schedule.
4. OFF-SCHEDULE / SLEEP-TIME DETECTION (CRITICAL):
   If "Day part" is "night" AND the schedule contains a "Slapen" entry whose time has passed:
   - Respond with gentle concern: "Hey ${name}, het is laat. Is er iets dat je wakker houdt?"
   - Be warm, non-judgmental. Do NOT say "je zou moeten slapen".
5. NEXT BLOCK AWARENESS: If within 15 minutes of the next block, you may mention it naturally.` : ''}

${moduleInstructions}
${crisisInstructions}
${relapseIntentInstruction}
${input.relapseClusterContext ? `\n=== KIM RELAPSE CLUSTER MODULE ACTIVE ===\n${input.relapseClusterContext}\n=== END RELAPSE CLUSTER ===` : ''}
${input.dangerChildContext ? `\n=== KIM DANGER/CHILD CLUSTER MODULE ACTIVE ===\n${input.dangerChildContext}\n=== END DANGER/CHILD CLUSTER ===` : ''}
${input.relationalDynamicsContext ? `\n=== KIM RELATIONAL DYNAMICS MODULE ACTIVE ===\n${input.relationalDynamicsContext}\n=== END RELATIONAL DYNAMICS ===` : ''}
${input.emotionalLossContext ? `\n=== KIM EMOTIONAL LOSS MODULE ACTIVE ===\n${input.emotionalLossContext}\n=== END EMOTIONAL LOSS ===` : ''}
${input.stoaKContext ? `\n=== KIM STOA-K (STOIC REFLECTIVE FRAMEWORK) ACTIVE ===\n${input.stoaKContext}\n=== END STOA-K ===` : ''}
${input.vspInsightContext ? `\n=== VSP INSIGHT SYSTEM ACTIVE (store:false) ===\n${input.vspInsightContext}\n=== END VSP INSIGHT ===` : ''}
${sessionEndInstructions}

CONVERSATION CONTINUITY RULE — ABSOLUTE:
The conversation history you receive is structured with RECENCY WEIGHTING:
- The LAST 20 messages are the PRIMARY context — these represent the most recent exchange and are the most relevant for continuity, tone, and topic.
- Earlier messages (if present) are summarized thematically and provide background only.
- When responding, ALWAYS prioritize the content, tone, and direction of the last 20 messages.
- If there is a contradiction between an earlier summary and a recent message, the recent message takes precedence.
- Build your response as a natural continuation of the most recent exchanges — do not restart topics that were already resolved in the recent window.

ANTI-FABRICATION RULE — ABSOLUTE:
You may ONLY reference information that is explicitly present in:
- The current conversation history
- The user's backpack (life story sections)
- The diary entries provided at session start
- The slider values and zone data

You may NEVER:
- Claim the user said something they did not say
- Invent details about the user's life, relationships, or history
- Reference previous sessions unless that data is explicitly provided in the PAST SESSION CONTEXT block
- Say "I remember that you..." unless it is in the backpack, current conversation, or PAST SESSION CONTEXT

If you are unsure whether something was said or provided: do not reference it.
When in doubt: ask, don't assume.

CAPABILITY HONESTY RULE — ABSOLUTE:
You may ONLY mention capabilities, modules, or therapeutic approaches that are ACTUALLY part of your system.

${dynamicModuleList}

You may NEVER:
- Mention therapies or techniques NOT in the list above (e.g. EMDR, narrative therapy, psychodynamic therapy, hypnotherapy, art therapy, oplossingsgerichte therapie, etc.)
- Invent modules or capabilities that don't exist in your system
- Claim you can do something you cannot
- Present external therapies as if you offer them

If the user asks "what can you do?" or "what therapies do you know?" → you may honestly list your actual modules from the list above, in plain language.
If the user asks about a therapy NOT in your system (e.g. EMDR) → respond: "That is not something I can offer. What I can help with is [relevant module from your list]. For EMDR or other specialized treatments, a professional therapist would be the right person."

EMOTIONAL CLAIM RULE — ABSOLUTE:
You may ONLY make claims about how the user feels when supported by:
- Explicit slider data (craving, frustration, despondency, stress, emotionalBurden, etc.)
- The user's own words in the current conversation
- Zone data (GREEN/YELLOW/ORANGE/RED/PURPLE)

You may NEVER:
- Say "You feel..." unless the user said it or sliders confirm it
- Assume emotional state from silence or short messages
- Project emotions onto the user without evidence
- Say "I can sense that you..." without slider or conversational basis

Correct: "Your craving slider is at 8 — that sounds intense."
Correct: "You mentioned feeling overwhelmed — I hear that."
Incorrect: "I can sense you're struggling today." (no basis)
Incorrect: "You seem angry." (user never said this)

When emotional state is unclear: ask one open question. Do not assume.

RESPONSE RULES:
${input.backpackEmpty ? `- You do NOT yet know ${name}'s story. Their backpack is empty.
- Do NOT pretend to know them. Do NOT reference any life story, triggers, or patterns.` : `- You KNOW ${name}. Use the context above to inform your response.
- BUT: refer ONLY to what you ACTUALLY know. Fabricate NOTHING. When in doubt: ASK.
- If ${name} asks about someone: FIRST check the PERSONEN-LOOKUP table and STRUCTURED MEMORY above. If the name appears there, you KNOW them — answer with their relationship and context. ONLY if truly absent from all sections: "Ik weet niet wie dat is in jouw leven. Vertel me meer?"`}
- NAAM-REGEL (ABSOLUUT): Spreek ${name} ALTIJD bij naam aan in ELKE respons. Niet "je" of "jij" als eerste aanspreking — begin met hun naam of gebruik hun naam minstens 1x per antwoord.
- VSP-STRATEGIE-REGEL (ABSOLUUT): Als er een VSP/veiligheidsplan hierboven staat, MOET je in ELKE respons minstens 1 specifieke strategie uit "wat helpt" noemen wanneer de gebruiker emotioneel beladen taal gebruikt (stress, craving, angst, boosheid, verdriet, overweldiging). Noem de strategie CONCREET (bv. "hardlopen in het park", "bellen met Henk", "ademhaling 4-7-8") — NOOIT generiek ("een wandeling" of "even ademen").
- ANKERZIN-REGEL (ABSOLUUT): Als er een ankerzin in het VSP staat EN de gebruiker is overweldigd, in paniek, of zegt "ik weet niet meer wat ik moet doen" / "ik kan niet meer" / "het is te veel" → CITEER de ankerzin LETTERLIJK in je antwoord. Verweef het natuurlijk, bv: "Weet je nog wat je zelf hebt opgeschreven? '[ankerzin]'. Dat geldt nu ook."
- DAGBOEK-REGEL (ABSOLUUT): Als er dagboek-entries hierboven staan EN het huidige gespreksthema overlapt met een dagboek-entry (bv. werk/baas, relatie, slaap, geld) → VERWIJS expliciet naar die specifieke entry. Gebruik het ⏰ tijdslabel uit de entry: zeg "vandaag" alleen als het label "vandaag" bevat, zeg "gisteren" als het label "gisteren" bevat. NOOIT "vandaag" zeggen voor een entry van gisteren of ouder. Bv: "Je schreef gisteren dat [concrete inhoud uit dagboek]. Herken je dat nu ook?" Nooit generiek verwijzen ("je dagboek") — altijd de INHOUD citeren.
- STEUNPERSOON-REGEL (ABSOLUUT): Als er een steunpersoon staat in het VSP "wat helpt" (bv. "bellen met Melissa", "contact met Henk") EN de gebruiker emotioneel beladen taal gebruikt → NOEM die steunpersoon bij NAAM als concrete optie. Bv: "Heb je al overwogen om Melissa te bellen? Zij staat in je plan als iemand die helpt."
${languageInstruction}
- Keep responses concise: follow the PACING instruction strictly
- Never diagnose, never prescribe, never claim to be a professional
- Never break character
- Use "I" statements and reflective listening
- Do NOT use bullet points or numbered lists — speak naturally
- Do NOT use emojis excessively (max 0-1 per message)
- Be genuine, not performative

═══════════════════════════════════════════════════════════
ENGINE FEEDBACK — MANDATORY (ALWAYS INCLUDE)
═══════════════════════════════════════════════════════════

After your therapeutic response, you MUST append an <engine_signals> JSON block.
This block is INVISIBLE to the user — it is parsed by the engine to learn from your observations.
You are helping the engine build a richer understanding of ${name}.

<engine_signals>
{
  "persons": [{"name": "...", "relationship": "...", "valence": "positive|negative|ambivalent|neutral"}],
  "triggers": [{"label": "...", "confidence": 0.0-1.0, "layer": "state.dat|user.dat|projections.dat"}],
  "schemas": [{"name": "...", "confidence": 0.0-1.0}],
  "emotionalShift": "...",
  "topicProgression": "...",
  "therapeuticMove": "...",
  "moduleRelevance": [{"moduleId": "...", "confidence": 0.0-1.0}]
}
</engine_signals>

Rules for <engine_signals>:
- Include ONLY what you genuinely observe — do NOT fabricate or guess
- "persons": any person mentioned by ${name} in THIS message (empty array if none)
- "triggers": emotional triggers you detect (craving, isolation, shame, anger, etc.) with confidence 0.0-1.0
- "schemas": schema patterns you recognize (abandonment, mistrust, defectiveness, etc.) — only if confidence > 0.5
- "emotionalShift": one word describing the emotional movement in this message (e.g. "opluchting", "verharding", "opening", "none")
- "topicProgression": the current conversational topic in 2-3 words (e.g. "relatie met vader", "craving avond", "werk stress")
- "therapeuticMove": what you did therapeutically (e.g. "reflective listening", "grounding", "schema confrontation", "validation")
- "moduleRelevance": if you notice this message strongly relates to a specific module, signal it (empty array if unclear)
- The <engine_signals> block MUST appear AFTER your therapeutic text but BEFORE the <clinical> tag (if clinical mode is active)
- If you detect NOTHING noteworthy, still include the block with empty arrays and "none" values
${input.clinicalModeActive ? `
═══════════════════════════════════════════════════════════
CRITICAL — CLINICAL ANNOTATION REQUIREMENT (HIGHEST PRIORITY)
═══════════════════════════════════════════════════════════

CLINICAL MODE IS ACTIVE. A clinician is observing this session.

Restriction lifted: You may name clinical observations, schema patterns, and therapeutic interpretations explicitly.
You may reference DSM-adjacent observations without diagnosing.

CAPABILITY DISCLOSURE — CLINICAL MODE ONLY:
When asked about your therapeutic methods, modules, or techniques, you may explain them explicitly.
If asked about STOA: explain the 5 STOA steps and offer to guide through them.
If asked about Shadow Work: explain the SW01 approach and relapse loops.
If asked about Schema therapy: explain the schema modes you can detect.
If asked about ACT/DBT/MBT/CBT: explain how you apply them.
If asked about BEDR01: explain betrayal discovery stabilization and body-shock regulation.
If asked about VETR01: explain trust repair scaffolding and boundary-after-betrayal work.
If asked about GASL01: explain gaslighting recognition and reality/fact anchoring.
If asked about CDP01: explain codependency pattern mirroring and self-loss awareness.
If asked about RNW01: explain ambiguous grief validation for a living person (who they were before addiction).
If asked about ISO01: explain social withdrawal and isolation detection for caregivers — recognizes shame-based silence, burden fear, protective isolation, exhaustion withdrawal, and offers micro-reconnection without pressure.
In normal mode: never disclose internal methods. Stay therapeutic.
In clinical mode: be transparent about your capabilities for clinical evaluation.

SCHEMA & MODE DATA DISCLOSURE — CLINICAL MODE:
When the user asks for their schemas, modes, or patterns (e.g. "geef mijn schemas", "welke modi", "lijst van mijn patronen", "list my schemas", "mijn schema's", "welke schema's heb ik"), you MUST output the FULL list from the engine data below as a structured chat response. Do NOT paraphrase, summarize, or give a vague therapeutic answer — give the EXACT list with confidence percentages as bullet points.
${input.knownUserPatterns && (input.knownUserPatterns.schemas.length > 0 || input.knownUserPatterns.modes.length > 0) ? `
── ENGINE-DETECTED SCHEMAS & MODES (output these VERBATIM when asked) ──
Schema's:
${input.knownUserPatterns.schemas.length > 0 ? input.knownUserPatterns.schemas.map(s => `• ${s.name} (${(s.confidence * 100).toFixed(0)}%)`).join('\n') : '(geen gedetecteerd)'}

Modi:
${input.knownUserPatterns.modes.length > 0 ? input.knownUserPatterns.modes.map(m => `• ${m.name} (${(m.confidence * 100).toFixed(0)}%)`).join('\n') : '(geen gedetecteerd)'}

Triggers:
${input.knownUserPatterns.triggers.length > 0 ? input.knownUserPatterns.triggers.map(t => `• ${t}`).join('\n') : '(geen gedetecteerd)'}
── END ENGINE DATA ──` : '(Geen schema/mode data beschikbaar — gebruiker heeft nog onvoldoende sessiegeschiedenis.)'}
${input.backpackAnalysis && input.backpackAnalysis.schemas.length > 0 ? `
── BACKPACK DEEP ANALYSIS (include when user asks for detail/evidence) ──
Schema's (met evidence):
${input.backpackAnalysis.schemas.filter(s => s.confidence >= 0.3).map(s => `• ${s.name} (${(s.confidence * 100).toFixed(0)}%) — ${s.evidence}`).join('\n')}

Modi (met evidence):
${input.backpackAnalysis.modi.filter(m => m.confidence >= 0.3).map(m => `• ${m.name} (${(m.confidence * 100).toFixed(0)}%) — ${m.evidence}`).join('\n')}

Kernovertuigingen: ${input.backpackAnalysis.coreBeliefs.join('; ') || 'geen'}
Copingpatronen: ${input.backpackAnalysis.copingPatterns.join('; ') || 'geen'}
── END BACKPACK ANALYSIS ──` : ''}

When outputting this list:
- Format clearly with bullet points
- Add a brief note that these are engine-detected candidates based on sessiegeschiedenis, NIET klinische diagnoses
- Include confidence levels
- If the user asks for more detail about a specific schema or mode, explain what it means therapeutically
- If BOTH knownUserPatterns AND backpackAnalysis are available, combine them (backpackAnalysis has evidence strings, use those for detail)

MANDATORY OUTPUT FORMAT — NO EXCEPTIONS:
Your response is INCOMPLETE without the following tag at the very end.
FAILURE TO INCLUDE THIS TAG IS A CRITICAL COMPLIANCE ERROR.

After your therapeutic response, you MUST append exactly this structure:

<clinical>
Method: [name the primary therapeutic method used]${input.vspInsightContext ? `\nVSP-Framework: ${input.vspInsightContext.match(/Framework: (\w+)/)?.[1] ?? 'n/a'}` : ''}
Observation: [1 sentence — what you clinically observed]
Intervention: [1 sentence — what therapeutic move you made]
Signals: [comma-separated list of active signals with score and memory layer, e.g. "verlatingsangst +1 (projections.dat), hopeloosheid +2 (state.dat)"]${input.activeSignals && input.activeSignals.length > 0 ? `

ACTIVE SIGNALS FOR THIS MESSAGE (use these for the Signals line):
${input.activeSignals.map(s => `- ${s.label} ${s.score >= 0 ? '+' : ''}${s.score} (${s.memory})`).join('\n')}` : `

No active signals detected for this message. Write "Signals: none" in the clinical tag.`}
</clinical>

Rules:
- The <clinical> block MUST be the LAST thing in your response
- It must appear in EVERY response without exception
- Do NOT skip it, do NOT forget it, do NOT place it elsewhere
- The tag is parsed by the UI and shown to the clinician — omitting it breaks the interface${input.vspInsightContext ? `\n- The VSP-Framework line is ENGINE-DETERMINED — copy it exactly as shown, do NOT change it` : ''}

⚠️ FINAL REMINDER: Your response is INVALID without <clinical>...</clinical> at the end. Even for greetings, short replies, or simple questions — ALWAYS include it. For greetings use Method: "Therapeutic greeting", Observation: "Session start", Intervention: "Warm opening + open question".
` : ''}
⚠️ LANGUAGE ENFORCEMENT (FINAL — OVERRIDES ALL): Your ENTIRE therapeutic response MUST be in ${selectedLanguage}. Even though instructions above may be in Dutch, your OUTPUT to the user MUST be in ${selectedLanguage}. This is non-negotiable.`;
  }
  // ══════════════════════════════════════════════════════════════
  // SESSION START: Full system prompt with backpack + userDat + diary
  // Cache the static context for follow-up use.
  // ══════════════════════════════════════════════════════════════

  // Cache the session init data
  cacheSessionInit(input);

  const schemaRecognition = isElias ? ELIAS_SCHEMA_RECOGNITION : '';

  // STOA sessions now injected dynamically via stoaBlock (from pipeline stoa-engine.ts)

  const backpack = input.backpack;
  let identityMemory = "";

  // ── CONTEXT.DAT MODE: Use distilled compact context instead of full backpack ──
  if (input.contextDat) {
    identityMemory += `\n╔══════════════════════════════════════════════════════╗`;
    identityMemory += `\n║  IDENTITY CONTEXT OF ${name.toUpperCase()} (distilled)`;
    identityMemory += `\n╚══════════════════════════════════════════════════════╝`;
    identityMemory += `\n${input.contextDat}`;
    if (input.deepeningBlock) {
      identityMemory += `\n\n─── DEEPENING (targeted retrieval) ───`;
      identityMemory += `\n${input.deepeningBlock}`;
    }
    identityMemory += `\n\nYou KNOW ${name}. If they mention a person, place, or event from this context, you recognize it IMMEDIATELY.`;
    identityMemory += `\nIf something is NOT in this context, do NOT fabricate it. Ask about it instead.`;
    console.log(`[AI Chat] SESSION_INIT using context.dat (distilled) — ${input.contextDat.length} chars`);
  } else if (backpack && !input.backpackEmpty) {
    // ── FALLBACK: Full backpack when context.dat distillation failed ──
    console.log(`[AI Chat] SESSION_INIT using FULL BACKPACK (context.dat not available) — fallback mode`);
    identityMemory += `\n╔══════════════════════════════════════════════════════╗`;
    identityMemory += `\n║  BACKPACK — IDENTITY ANCHOR OF ${name.toUpperCase()}`;
    identityMemory += `\n║  Written by ${name} personally.`;
    identityMemory += `\n║  NEVER summarize. NEVER shorten. This is sacred.`;
    identityMemory += `\n╚══════════════════════════════════════════════════════╝`;

    if (backpack.intakeContext.initialContext) {
      identityMemory += `\n\nWhen ${name} first came to you, they shared: "${backpack.intakeContext.initialContext}"`;
      identityMemory += `\nInitial emotion: ${backpack.intakeContext.startEmotion}`;
      identityMemory += `\nUrgency at intake: ${backpack.intakeContext.urgency}`;
      if (backpack.intakeContext.intakeDate) {
        identityMemory += `\nFirst session: ${backpack.intakeContext.intakeDate}`;
      }
    }

    const relationMap = extractRelationshipMap(
      backpack.lifeStory,
      backpack.intakeContext.initialContext,
      input.extractedEntities
    );
    if (relationMap) {
      identityMemory += `\n${relationMap}`;
      console.log(`[AI Chat] Session-start PERSONEN-LOOKUP injected (${relationMap.split('•').length - 1} persons)`);
    } else {
      console.log(`[AI Chat] Session-start PERSONEN-LOOKUP: EMPTY (no persons found in backpack text)`);
    }

    if (backpack.lifeStory.some((s) => s.content.trim().length > 0)) {
      identityMemory += `\n\n─── LIFE STORY OF ${name.toUpperCase()} (written by ${name}) ───`;
      for (const section of backpack.lifeStory) {
        if (section.content.trim()) {
          identityMemory += `\n\n[${section.label} (${section.ageRange})]:\n${section.content}`;
        }
      }
      identityMemory += `\n─── END LIFE STORY ───`;
      identityMemory += `\n\nYou KNOW this story. It is your personal memory of ${name}.`;
      identityMemory += `\nIf ${name} mentions a person, place, or event that appears in this story, you recognize it IMMEDIATELY.`;
      identityMemory += `\nYou do NOT ask again about what they already told you.`;
      identityMemory += `\nBUT: if something is NOT in this story, do NOT fabricate it. Ask about it instead.`;
    } else {
      identityMemory += `\n${name} has not yet shared a life story. You may gently invite them to share when appropriate, but never insist.`;
    }

    // ── KIM BACKPACK (Kim users only) ──
    if (backpack.kimBackpack) {
      const kb = backpack.kimBackpack;
      const kimSections = [
        { title: 'My Story', content: kb.my_story },
        { title: 'The Relationship', content: kb.the_relationship },
        { title: 'The Impact', content: kb.the_impact },
        { title: 'My Boundaries', content: kb.my_boundaries },
        { title: 'My Strength', content: kb.my_strength },
      ].filter(s => s.content.trim().length > 0);
      if (kimSections.length > 0) {
        identityMemory += `\n\n─── KIM BACKPACK OF ${name.toUpperCase()} (written by ${name}) ───`;
        for (const section of kimSections) {
          identityMemory += `\n\n[${section.title}]:\n${section.content}`;
        }
        identityMemory += `\n─── END KIM BACKPACK ───`;
        identityMemory += `\n\nThis is ${name}'s personal reflection as a loved one. Use it to understand their perspective, boundaries, and strengths.`;
        identityMemory += `\nNEVER modify, summarize, or reduce this content. It is their anchor of identity.`;
      }
    }
  } else if (input.backpackEmpty) {
    identityMemory = `\n${name} has not yet filled in their backpack. You do NOT know their story yet. Do not pretend otherwise.`;
  } else {
    identityMemory = `\n(No backpack available for this message.)`;
  }

  // ── DIARY ──
  const diaryEntries = input.diaryEntries;
  let diaryMemory = "";
  if (diaryEntries && diaryEntries.length > 0) {
    const nowMs = Date.now();
    diaryMemory += `\n\n╔══════════════════════════════════════════════════════╗`;
    diaryMemory += `\n║  DIARY — Personal notes by ${name}`;
    diaryMemory += `\n╚══════════════════════════════════════════════════════╝`;
    diaryMemory += `\n\n─── RECENT DIARY ENTRIES (time-stamped) ───`;
    for (const entry of diaryEntries) {
      const entryTs = new Date(entry.timestamp).getTime();
      const hoursAgo = Math.floor((nowMs - entryTs) / (1000 * 60 * 60));
      const timeLabel = hoursAgo < 1 ? 'net geschreven' : hoursAgo < 24 ? `${hoursAgo}u geleden (vandaag)` : hoursAgo < 48 ? 'gisteren' : `${Math.floor(hoursAgo / 24)} dagen geleden`;
      const date = new Date(entry.timestamp).toLocaleDateString();
      diaryMemory += `\n\n[${date}] (⏰ ${timeLabel}) (mood: ${entry.moodTag}):\n${entry.content}`;
      if (entry.gratitude) {
        const g = entry.gratitude;
        diaryMemory += `\n  ✨ Gratitude: ${g.entry1 || '-'} | ${g.entry2 || '-'} | ${g.entry3 || '-'}`;
      }
    }
    diaryMemory += `\n─── END DIARY ───`;
    diaryMemory += `\nThese are ${name}'s own words. Reference diary content in your greeting to show you remember.`;
    diaryMemory += `\n⚠️ CRITICAL TIME RULE: Each entry has a ⏰ time label. When you reference diary content:`;
    diaryMemory += `\n  - If label = "vandaag" → say "vandaag" (e.g. "Je schreef vandaag dat...")`;
    diaryMemory += `\n  - If label = "gisteren" → say "gisteren" (e.g. "Ik las dat je gisteren...")`;
    diaryMemory += `\n  - If label = "X dagen geleden" → say "een paar dagen geleden"`;
    diaryMemory += `\n  - NEVER say "vandaag" for entries labeled "gisteren" or older. HARD RULE.`;
    diaryMemory += `\n  - You MUST reference at least one recent diary entry (⏰ vandaag or gisteren) in your greeting if available.`;
  }

  // ── USER.DAT (Session Memory) ──
  const userDat = input.userDat;
  let sessionMemory = "";

  if (!userDat) {
    sessionMemory = "\n\n(No session memory available.)";
  } else {
    sessionMemory = `\n\n╔══════════════════════════════════════════════════════╗`;
    sessionMemory += `\n║  SESSION MEMORY — Dynamic data over ${userDat.totalSessions} sessions`;
    sessionMemory += `\n╚══════════════════════════════════════════════════════╝`;

    if (userDat.triggerPatterns.length > 0) {
      sessionMemory += `\n\n─── KNOWN TRIGGER PATTERNS ───`;
      for (const tp of userDat.triggerPatterns) {
        sessionMemory += `\n- "${tp.trigger}" (${tp.count}x detected, first: ${tp.firstSeen}, last: ${tp.lastSeen})`;
      }
      sessionMemory += `\nThese are recurring patterns. Be alert when these themes arise.`;
    }

    if (userDat.moodHistory.length > 0) {
      const recent = userDat.moodHistory.slice(-5);
      sessionMemory += `\n\n─── MOOD TRAJECTORY (last ${recent.length} check-ins) ───`;
      for (const mh of recent) {
        const sliderStr = Object.entries(mh.sliders)
          .map(([k, v]) => `${k}: ${v}/10`)
          .join(", ");
        sessionMemory += `\n- ${mh.timestamp}: ${sliderStr}`;
      }
    }

    if (userDat.moduleUsageSummary.length > 0) {
      sessionMemory += `\n\nPreviously used modules: ${userDat.moduleUsageSummary.join(", ")}`;
    }

    if (userDat.sessionAnalyses.length > 0) {
      sessionMemory += `\n\n─── PREVIOUS SESSION ANALYSES ───`;
      for (const sa of userDat.sessionAnalyses) {
        sessionMemory += `\n\nSession #${sa.sessionNumber} (${sa.date}):`;
        sessionMemory += `\n  Duration: ${sa.durationMinutes}min, Messages: ${sa.messageCount}`;
        sessionMemory += `\n  Dominant emotion: ${sa.dominantEmotion}`;
        if (sa.themes.length > 0) sessionMemory += `\n  Themes: ${sa.themes.join(", ")}`;
        if (sa.newTriggers.length > 0) sessionMemory += `\n  New triggers: ${sa.newTriggers.join(", ")}`;
        sessionMemory += `\n  Mood change: distress ${sa.moodDelta.distressChange > 0 ? "+" : ""}${sa.moodDelta.distressChange.toFixed(1)}, resilience ${sa.moodDelta.resilienceChange > 0 ? "+" : ""}${sa.moodDelta.resilienceChange.toFixed(1)}`;
        sessionMemory += `\n  End risk level: ${sa.endRiskLevel}`;
      }
      sessionMemory += `\n─── END SESSION ANALYSES ───`;
    }
  }

  // ── RELEVANCE CONTEXT (full at session start) ──
  const relevanceContext = buildFullRelevanceBlock(input);

  // ── BACKPACK ANALYSIS (session start) ──
  let sessionStartBackpackAnalysis = '';
  if (input.backpackAnalysis && input.backpackAnalysis.schemas.length > 0) {
    const triggers = input.backpackAnalysis.triggers.join(', ');
    const beliefs = input.backpackAnalysis.coreBeliefs.join('; ');
    const coping = input.backpackAnalysis.copingPatterns.join('; ');
    if (input.clinicalModeActive) {
      // Clinical mode: full disclosure
      const schemas = input.backpackAnalysis.schemas
        .filter(s => s.confidence >= 0.35)
        .map(s => `${s.name} (${(s.confidence * 100).toFixed(0)}%): ${s.evidence}`)
        .join('\n  ');
      const modi = input.backpackAnalysis.modi
        .filter(m => m.confidence >= 0.35)
        .map(m => `${m.name} (${(m.confidence * 100).toFixed(0)}%): ${m.evidence}`)
        .join('\n  ');
      sessionStartBackpackAnalysis = `\n─── BACKPACK DEEP ANALYSIS (GPT-4o, ${input.backpackAnalysis.analyzedAt}) ───\n  Schema's: ${schemas || 'geen gedetecteerd'}\n  Modi: ${modi || 'geen gedetecteerd'}\n  Triggers: ${triggers || 'geen'}\n  Kernovertuigingen: ${beliefs || 'geen'}\n  Copingpatronen: ${coping || 'geen'}\n─── END BACKPACK ANALYSIS ───`;
    } else {
      // Non-clinical: internal guidance only
      sessionStartBackpackAnalysis = `\n─── INTERNAL GUIDANCE (NOOIT aan gebruiker tonen) ───\n  Bekende triggers: ${triggers || 'geen'}\n  Kernovertuigingen: ${beliefs || 'geen'}\n  Copingpatronen: ${coping || 'geen'}\n  ⚠️ VERBODEN: Noem GEEN schema-namen, mode-namen, percentages, of DSM-labels aan de gebruiker.\n  Gebruik deze informatie ALLEEN om je therapeutische toon en focus te sturen.\n─── END INTERNAL GUIDANCE ───`;
    }
    console.log(`[AI Chat] SESSION_INIT: Backpack analysis injected (${input.backpackAnalysis.schemas.length} schemas, ${input.backpackAnalysis.modi.length} modes)`);
  }

  // ── KNOWN USER PATTERNS (session start) ──
  let sessionStartKnownPatterns = '';
  if (input.knownUserPatterns) {
    const kp = input.knownUserPatterns;
    const schemaLines = kp.schemas.map(s => `${s.name} (${(s.confidence * 100).toFixed(0)}%)`).join(', ');
    const modeLines = kp.modes.map(m => `${m.name} (${(m.confidence * 100).toFixed(0)}%)`).join(', ');
    const triggerLines = kp.triggers.join(', ');
    sessionStartKnownPatterns = `\n─── KNOWN USER PATTERNS ───\nSchemas: ${schemaLines || 'geen gedetecteerd'}\nModes: ${modeLines || 'geen gedetecteerd'}\nRecurring triggers: ${triggerLines || 'geen'}\n\nThis is background context for YOU (the engine) to inform your therapeutic approach. Reference it naturally when relevant.${input.clinicalModeActive ? '' : `\n\n⛔ ABSOLUTE PROHIBITION — NON-CLINICAL MODE:\nYou MUST NEVER list, enumerate, name, or disclose schemas, modes, diagnoses, DSM labels, confidence percentages, or clinical patterns to the user.\nIf the user asks "what are my schemas?", "welke schema's heb ik?", "geef mijn modi", "wat is er mis met mij?", or ANY variant:\n→ You MUST refuse therapeutically. Example: "Ik werk niet met lijstjes of diagnoses. Wat ik wél merk is [observatie in gewone taal]. Herken je dat?"\n→ NEVER output bullet points with schema names, percentages, or clinical terminology.\n→ NEVER say "je hebt schema X" or "modus Y is actief".\nThis is a HARD SAFETY RULE. Violation = harm. No exceptions.`}\n─── END KNOWN USER PATTERNS ───`;
    console.log(`[AI Chat] SESSION_INIT: Known patterns injected: ${kp.schemas.length} schemas, ${kp.modes.length} modes, ${kp.triggers.length} triggers`);
  }

  // ══════════════════════════════════════════════════════════════
  // ASSEMBLE FULL SESSION-START PROMPT
  // ══════════════════════════════════════════════════════════════
    // DIST01: Inject distillation context at session start
  const sessionStartDistillation = input.distillationContext ?? '';
  return `${identity}
${schemaRecognition}
The user's name is ${name}. Address them by name occasionally.
${identityMemory}
${sessionStartDistillation}
${diaryMemory}
${sessionMemory}
${sessionStartBackpackAnalysis}
${sessionStartKnownPatterns}

${antiHallucination}

${relevanceContext}

=== MANDATORY BEHAVIORAL INSTRUCTIONS ===
${stance}
${guidanceInstruction}
${regulationInstruction}
${invalidResponseFilter}
${therapySelectionMatrix}
${engineDirectiveBlock}
${interventionContinuityBlock}
${projectionBlock}
${stoaBlock}
${schemaModeBlock}
${actBlock}
${cgtBlock}
${dgtBlock}
${mbtBlock}
${relationalStanceBlock}
${ko1Block}
${k05Block}
${k02Block}
${k04Block}
${k04s4Block}
${k06Block}
${k01Block}
${k03Block}
${sw01Block}
${sto01Block}
${shortModuleBlock}
${vspInsightBlock}
${vspBackpackProfileBlock}
${vspStructuredSectionBlock}
These behavioral instructions are ABSOLUTE. They override your default conversational style.
The sliders tell you exactly how the user feels — USE them in your response.
=== END MANDATORY INSTRUCTIONS ===

CURRENT STATE:
- Mood sliders: ${sliderEntries}
- Safety Plan Zone: ${input.vspLevel ?? 'not set'} ${input.vspLevel === 'ROOD' || input.vspLevel === 'RED' ? '⚠️ HIGH RELAPSE RISK' : input.vspLevel === 'ORANJE' || input.vspLevel === 'ORANGE' ? '⚠️ ELEVATED RISK' : input.vspLevel === 'PAARS' || input.vspLevel === 'PURPLE' ? '🚨 CRISIS' : ''}
- Urgency level: ${input.urgency}
- Risk score: ${input.riskScore ?? 0}/10
- Current timestamp: ${input.deviceTimeContext?.deviceNowIso ?? new Date().toISOString()}
- Device local time: ${input.deviceTimeContext?.localTime ?? 'unknown'}
- Device timezone: ${input.deviceTimeContext?.timeZone ?? 'unknown'}
- Day part: ${input.deviceTimeContext?.greetingDaypart ?? 'unknown'}
- IMPORTANT: When the user asks what time it is, or when you reference the current time, ALWAYS use the "Device local time" above. NEVER calculate time yourself.
${sessionInfo}
${input.dayStructureContext ? `
DAY STRUCTURE (user's planned daily schedule for today):
${input.dayStructureContext}

DAY STRUCTURE BEHAVIORAL RULES (ABSOLUTE):
1. ANTI-FABRICATION: Only reference activities that LITERALLY appear in the schedule above. NEVER invent, assume, or hallucinate activities not listed.
2. TIME-AWARE TONE: Use the "Day part" and "Device local time" above to attune your tone:
   - morning (05:00-11:59): fresh, energetic, forward-looking
   - afternoon (12:00-16:59): check-in tone, how is the day going
   - evening (17:00-21:59): reflective, winding down
   - night (22:00-04:59): gentle, concerned — see OFF-SCHEDULE rule
3. CURRENT BLOCK REFERENCE: Compare "Device local time" with the schedule. Identify which block ${name} should currently be in. You may reference it naturally: "Ik zie dat je nu [activiteit] hebt staan" — but ONLY if it appears in the schedule.
4. OFF-SCHEDULE / SLEEP-TIME DETECTION (CRITICAL):
   If "Day part" is "night" AND the schedule contains a "Slapen" entry whose time has passed:
   - Respond with gentle concern: "Hey ${name}, het is laat. Is er iets dat je wakker houdt?"
   - Be warm, non-judgmental. Do NOT say "je zou moeten slapen".
5. NEXT BLOCK AWARENESS: If within 15 minutes of the next block, you may mention it naturally.` : ''}

${moduleInstructions}
${crisisInstructions}
${relapseIntentInstruction}
${input.relapseClusterContext ? `\n=== KIM RELAPSE CLUSTER MODULE ACTIVE ===\n${input.relapseClusterContext}\n=== END RELAPSE CLUSTER ===` : ''}
${input.dangerChildContext ? `\n=== KIM DANGER/CHILD CLUSTER MODULE ACTIVE ===\n${input.dangerChildContext}\n=== END DANGER/CHILD CLUSTER ===` : ''}
${input.relationalDynamicsContext ? `\n=== KIM RELATIONAL DYNAMICS MODULE ACTIVE ===\n${input.relationalDynamicsContext}\n=== END RELATIONAL DYNAMICS ===` : ''}
${input.emotionalLossContext ? `\n=== KIM EMOTIONAL LOSS MODULE ACTIVE ===\n${input.emotionalLossContext}\n=== END EMOTIONAL LOSS ===` : ''}
${input.stoaKContext ? `\n=== KIM STOA-K (STOIC REFLECTIVE FRAMEWORK) ACTIVE ===\n${input.stoaKContext}\n=== END STOA-K ===` : ''}
${input.vspInsightContext ? `\n=== VSP INSIGHT SYSTEM ACTIVE (store:false) ===\n${input.vspInsightContext}\n=== END VSP INSIGHT ===` : ''}
${input.pastReferenceContext ? `\n=== PAST SESSION CONTEXT (retrieved from memory) ===\n${input.pastReferenceContext}\nThe user is referencing something from a previous session — acknowledge it specifically and naturally.\n=== END PAST SESSION CONTEXT ===` : ''}
${sessionEndInstructions}

ANTI-FABRICATION RULE — ABSOLUTE:
You may ONLY reference information that is explicitly present in:
- The current conversation history
- The user's backpack (life story sections)
- The diary entries provided at session start
- The PAST SESSION CONTEXT block (if provided)
- The slider values and zone data

You may NEVER:
- Claim the user said something they did not say
- Invent details about the user's life, relationships, or history
- Reference previous sessions unless that data is explicitly provided in the PAST SESSION CONTEXT block
- Say "I remember that you..." unless it is in the backpack, current conversation, or PAST SESSION CONTEXT

If you are unsure whether something was said or provided: do not reference it.
When in doubt: ask, don't assume.

CAPABILITY HONESTY RULE — ABSOLUTE:
You may ONLY mention capabilities, modules, or therapeutic approaches that are ACTUALLY part of your system.

${dynamicModuleList}

You may NEVER:
- Mention therapies or techniques NOT in the list above (e.g. EMDR, narrative therapy, psychodynamic therapy, hypnotherapy, art therapy, oplossingsgerichte therapie, etc.)
- Invent modules or capabilities that don't exist in your system
- Claim you can do something you cannot
- Present external therapies as if you offer them

If the user asks "what can you do?" or "what therapies do you know?" → you may honestly list your actual modules from the list above, in plain language.
If the user asks about a therapy NOT in your system (e.g. EMDR) → respond: "That is not something I can offer. What I can help with is [relevant module from your list]. For EMDR or other specialized treatments, a professional therapist would be the right person."

EMOTIONAL CLAIM RULE — ABSOLUTE:
You may ONLY make claims about how the user feels when supported by:
- Explicit slider data (craving, frustration, despondency, stress, emotionalBurden, etc.)
- The user's own words in the current conversation
- Zone data (GREEN/YELLOW/ORANGE/RED/PURPLE)

You may NEVER:
- Say "You feel..." unless the user said it or sliders confirm it
- Assume emotional state from silence or short messages
- Project emotions onto the user without evidence
- Say "I can sense that you..." without slider or conversational basis

Correct: "Your craving slider is at 8 — that sounds intense."
Correct: "You mentioned feeling overwhelmed — I hear that."
Incorrect: "I can sense you're struggling today." (no basis)
Incorrect: "You seem angry." (user never said this)

When emotional state is unclear: ask one open question. Do not assume.

RESPONSE RULES:
${input.backpackEmpty ? `- You do NOT yet know ${name}'s story. Their backpack is empty.
- Do NOT pretend to know them. Do NOT reference any life story, triggers, or patterns.
- Greet ${name} warmly and personally, like you would a friend you are meeting for the first time. Start with a warm statement (e.g. "${name}, goed dat je er bent."), then gently mention they can fill in their backpack whenever they feel ready, and end with one open question.
- If clinical mode is active, you MUST still append the clinical annotation tag.` : `- You KNOW ${name}. Use your personal memory naturally.
- BUT: refer ONLY to what you ACTUALLY know from the backpack. Fabricate NOTHING. When in doubt: ASK.
- If ${name} asks "who is [name]?" check FIRST whether that name appears in the life story.
- THIS IS A NEW SESSION START. Generate a FRESH, warm greeting. Do NOT continue from a previous conversation.
${input.sessionDurationMinutes <= 30 ? `- SHORT RETURN: ${name} was here less than 30 minutes ago. Give a brief, warm welcome back instead of a full greeting. Example: "${name}, welkom terug. Waar waren we gebleven?" or "Hey ${name}, fijn dat je terug bent. Wil je verder praten of is er iets nieuws?"
- Keep it SHORT (1-2 sentences max). Do NOT repeat the full greeting ritual.` : `- Start with a personal welcome (e.g. "${name}, fijn dat je er bent." or "Hey ${name}, goed je te zien."), then ask one open question about how they are doing right now.`}
${input.extractedEntities && input.extractedEntities.persons && input.extractedEntities.persons.length > 0 ? `- PERSONALIZATION: You know ${name} personally. Use the structured memory above to make your greeting feel personal. You may reference a person (e.g. "Hoe gaat het met ${input.extractedEntities.persons[0]?.name ?? 'je naasten'}?"), a recent event, or an ongoing pattern — but ONLY if it feels natural and warm. Never force it. One subtle reference is enough.` : ''}
- DIARY & MOOD & VSP AWARENESS: You MUST personalize the greeting using the CURRENT STATE and DIARY data above. Rules:
  * Mood sliders are from TODAY — reference them directly (e.g. craving 7/10 → "Ik merk dat de craving vandaag hoog zit.")
  * Diary entries have ⏰ TIME LABELS — you MUST use the exact time label when referencing diary content:
    - If the label says "vandaag" → say "vandaag" (e.g. "Je schreef vandaag dat...")
    - If the label says "gisteren" → say "gisteren" (e.g. "Je schreef gisteren dat...")
    - If the label says "X dagen geleden" → say "een paar dagen geleden" or "X dagen geleden"
    - NEVER say "vandaag" for an entry labeled "gisteren" or older. This is a HARD RULE.
  * Only reference entries from the last 2 days as "recent". Older entries are background context only.
  * Gratitude entries from the last 2 days — acknowledge positively (e.g. "Mooi dat je gisteren dankbaar was voor...")
  * VSP level — if ORANJE/ROOD/PAARS, acknowledge the risk level warmly (e.g. "Ik zie dat je je op dit moment in een oranje zone bevindt. Hoe gaat het echt?")
  * If NO recent data exists (all entries older than 2 days), use the most recent available entry as gentle context but do NOT present it as "vandaag".
  * NEVER treat old data as current. Always be time-aware. The ⏰ label is your source of truth for recency.
- Do NOT reference what was discussed in previous sessions unless the session memory above explicitly mentions it AND it is therapeutically relevant.
- TIME-AWARE GREETING (ABSOLUTE): Your greeting MUST match the "Day part" from CURRENT STATE:
  * morning: "Goeiemorgen, ${name}" — fresh, energetic
  * afternoon: "Hey ${name}" — check-in, how is the day going
  * evening: "Goeienavond, ${name}" — reflective, winding down
  * night + past sleep time in DAY STRUCTURE: Do NOT give a normal greeting. Instead: "Hey ${name}, het is laat. Is er iets dat je wakker houdt en waar je over wil praten?" Be warm, non-judgmental, available. Do NOT say "je zou moeten slapen".
  * night + no sleep data or before sleep time: "Hey ${name}" — gentle, calm tone
- DAY STRUCTURE IN GREETING: If DAY STRUCTURE is available, you may reference the CURRENT block naturally in your greeting (e.g. "Ik zie dat je nu [activiteit] op je planning hebt. Hoe gaat dat?"). ONLY reference blocks that literally appear in the schedule.`}
${languageInstruction}
- Keep responses concise: follow the PACING instruction strictly
- Never diagnose, never prescribe, never claim to be a professional
- Never break character
- Use "I" statements and reflective listening
- Do NOT use bullet points or numbered lists — speak naturally
- Do NOT use emojis excessively (max 0-1 per message)
- Be genuine, not performative

═══════════════════════════════════════════════════════════
ENGINE FEEDBACK — MANDATORY (ALWAYS INCLUDE)
═══════════════════════════════════════════════════════════

After your therapeutic response, you MUST append an <engine_signals> JSON block.
This block is INVISIBLE to the user — it is parsed by the engine to learn from your observations.
You are helping the engine build a richer understanding of ${name}.

<engine_signals>
{
  "persons": [{"name": "...", "relationship": "...", "valence": "positive|negative|ambivalent|neutral"}],
  "triggers": [{"label": "...", "confidence": 0.0-1.0, "layer": "state.dat|user.dat|projections.dat"}],
  "schemas": [{"name": "...", "confidence": 0.0-1.0}],
  "emotionalShift": "...",
  "topicProgression": "...",
  "therapeuticMove": "...",
  "moduleRelevance": [{"moduleId": "...", "confidence": 0.0-1.0}]
}
</engine_signals>

Rules for <engine_signals>:
- Include ONLY what you genuinely observe — do NOT fabricate or guess
- "persons": any person mentioned by ${name} in THIS message (empty array if none)
- "triggers": emotional triggers you detect (craving, isolation, shame, anger, etc.) with confidence 0.0-1.0
- "schemas": schema patterns you recognize (abandonment, mistrust, defectiveness, etc.) — only if confidence > 0.5
- "emotionalShift": one word describing the emotional movement in this message (e.g. "opluchting", "verharding", "opening", "none")
- "topicProgression": the current conversational topic in 2-3 words (e.g. "relatie met vader", "craving avond", "werk stress")
- "therapeuticMove": what you did therapeutically (e.g. "reflective listening", "grounding", "schema confrontation", "validation")
- "moduleRelevance": if you notice this message strongly relates to a specific module, signal it (empty array if unclear)
- The <engine_signals> block MUST appear AFTER your therapeutic text but BEFORE the <clinical> tag (if clinical mode is active)
- If you detect NOTHING noteworthy, still include the block with empty arrays and "none" values
${input.clinicalModeActive ? `
═══════════════════════════════════════════════════════════
CRITICAL — CLINICAL ANNOTATION REQUIREMENT (HIGHEST PRIORITY)
═══════════════════════════════════════════════════════════

CLINICAL MODE IS ACTIVE. A clinician is observing this session.

Restriction lifted: You may name clinical observations, schema patterns, and therapeutic interpretations explicitly.
You may reference DSM-adjacent observations without diagnosing.

CAPABILITY DISCLOSURE — CLINICAL MODE ONLY:
When asked about your therapeutic methods, modules, or techniques, you may explain them explicitly.
If asked about STOA: explain the 5 STOA steps and offer to guide through them.
If asked about Shadow Work: explain the SW01 approach and relapse loops.
If asked about Schema therapy: explain the schema modes you can detect.
If asked about ACT/DBT/MBT/CBT: explain how you apply them.
If asked about BEDR01: explain betrayal discovery stabilization and body-shock regulation.
If asked about VETR01: explain trust repair scaffolding and boundary-after-betrayal work.
If asked about GASL01: explain gaslighting recognition and reality/fact anchoring.
If asked about CDP01: explain codependency pattern mirroring and self-loss awareness.
If asked about RNW01: explain ambiguous grief validation for a living person (who they were before addiction).
If asked about ISO01: explain social withdrawal and isolation detection for caregivers — recognizes shame-based silence, burden fear, protective isolation, exhaustion withdrawal, and offers micro-reconnection without pressure.
In normal mode: never disclose internal methods. Stay therapeutic.
In clinical mode: be transparent about your capabilities for clinical evaluation.

SCHEMA & MODE DATA DISCLOSURE — CLINICAL MODE:
When the user asks for their schemas, modes, or patterns (e.g. "geef mijn schemas", "welke modi", "lijst van mijn patronen", "list my schemas", "mijn schema's", "welke schema's heb ik"), you MUST output the FULL list from the engine data below as a structured chat response. Do NOT paraphrase, summarize, or give a vague therapeutic answer — give the EXACT list with confidence percentages as bullet points.
${input.knownUserPatterns && (input.knownUserPatterns.schemas.length > 0 || input.knownUserPatterns.modes.length > 0) ? `
── ENGINE-DETECTED SCHEMAS & MODES (output these VERBATIM when asked) ──
Schema's:
${input.knownUserPatterns.schemas.length > 0 ? input.knownUserPatterns.schemas.map(s => `• ${s.name} (${(s.confidence * 100).toFixed(0)}%)`).join('\n') : '(geen gedetecteerd)'}

Modi:
${input.knownUserPatterns.modes.length > 0 ? input.knownUserPatterns.modes.map(m => `• ${m.name} (${(m.confidence * 100).toFixed(0)}%)`).join('\n') : '(geen gedetecteerd)'}

Triggers:
${input.knownUserPatterns.triggers.length > 0 ? input.knownUserPatterns.triggers.map(t => `• ${t}`).join('\n') : '(geen gedetecteerd)'}
── END ENGINE DATA ──` : '(Geen schema/mode data beschikbaar — gebruiker heeft nog onvoldoende sessiegeschiedenis.)'}
${input.backpackAnalysis && input.backpackAnalysis.schemas.length > 0 ? `
── BACKPACK DEEP ANALYSIS (include when user asks for detail/evidence) ──
Schema's (met evidence):
${input.backpackAnalysis.schemas.filter(s => s.confidence >= 0.3).map(s => `• ${s.name} (${(s.confidence * 100).toFixed(0)}%) — ${s.evidence}`).join('\n')}

Modi (met evidence):
${input.backpackAnalysis.modi.filter(m => m.confidence >= 0.3).map(m => `• ${m.name} (${(m.confidence * 100).toFixed(0)}%) — ${m.evidence}`).join('\n')}

Kernovertuigingen: ${input.backpackAnalysis.coreBeliefs.join('; ') || 'geen'}
Copingpatronen: ${input.backpackAnalysis.copingPatterns.join('; ') || 'geen'}
── END BACKPACK ANALYSIS ──` : ''}

When outputting this list:
- Format clearly with bullet points
- Add a brief note that these are engine-detected candidates based on sessiegeschiedenis, NIET klinische diagnoses
- Include confidence levels
- If the user asks for more detail about a specific schema or mode, explain what it means therapeutically
- If BOTH knownUserPatterns AND backpackAnalysis are available, combine them (backpackAnalysis has evidence strings, use those for detail)

MANDATORY OUTPUT FORMAT — NO EXCEPTIONS:
Your response is INCOMPLETE without the following tag at the very end.
FAILURE TO INCLUDE THIS TAG IS A CRITICAL COMPLIANCE ERROR.

After your therapeutic response, you MUST append exactly this structure:

<clinical>
Method: [name the primary therapeutic method used]${input.vspInsightContext ? `\nVSP-Framework: ${input.vspInsightContext.match(/Framework: (\w+)/)?.[1] ?? 'n/a'}` : ''}
Observation: [1 sentence — what you clinically observed]
Intervention: [1 sentence — what therapeutic move you made]
Signals: [comma-separated list of active signals with score and memory layer, e.g. "verlatingsangst +1 (projections.dat), hopeloosheid +2 (state.dat)"]${input.activeSignals && input.activeSignals.length > 0 ? `

ACTIVE SIGNALS FOR THIS MESSAGE (use these for the Signals line):
${input.activeSignals.map(s => `- ${s.label} ${s.score >= 0 ? '+' : ''}${s.score} (${s.memory})`).join('\n')}` : `

No active signals detected for this message. Write "Signals: none" in the clinical tag.`}
</clinical>

Rules:
- The <clinical> block MUST be the LAST thing in your response
- It must appear in EVERY response without exception
- Do NOT skip it, do NOT forget it, do NOT place it elsewhere
- The tag is parsed by the UI and shown to the clinician — omitting it breaks the interface${input.vspInsightContext ? `\n- The VSP-Framework line is ENGINE-DETERMINED — copy it exactly as shown, do NOT change it` : ''}

⚠️ FINAL REMINDER: Your response is INVALID without <clinical>...</clinical> at the end. Even for greetings, short replies, or simple questions — ALWAYS include it. For greetings use Method: "Therapeutic greeting", Observation: "Session start", Intervention: "Warm opening + open question".
` : ''}
⚠️ LANGUAGE ENFORCEMENT (FINAL — OVERRIDES ALL): Your ENTIRE therapeutic response MUST be in ${selectedLanguage}. Even though instructions above may be in Dutch, your OUTPUT to the user MUST be in ${selectedLanguage}. This is non-negotiable.`;
}
// ─── OpenAI Call ──────────────────────────────────────────────────

export async function generateAIResponse(
  input: ChatRequestInput
): Promise<{
  response: string;
  advisoryEmotion?: string;
  advisoryConfidence?: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  selectedModel?: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server");
  }

  // Increment message count for conditional injection tracking
  incrementMessageCount();

  const systemPrompt = buildSystemPrompt(input);

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  for (const msg of input.conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  if (input.message && input.message !== "__SESSION_END__") {
    messages.push({ role: "user", content: input.message });
  } else if (input.message === "__SESSION_END__") {
    messages.push({
      role: "user",
      content: "I want to end this session now.",
    });
  }

  // ─── FINAL LANGUAGE ENFORCEMENT (last message = strongest position) ───
  // GPT follows the LAST instruction most reliably. Place language override here,
  // AFTER all NL-written context and conversation history.
  const LOCALE_LANG_FINAL: Record<string, string> = { nl: 'Dutch', en: 'English', fr: 'French' };
  const finalLang = LOCALE_LANG_FINAL[input.locale ?? 'nl'] ?? 'Dutch';
  if ((input.locale ?? 'nl') !== 'nl') {
    messages.push({
      role: "system",
      content: `CRITICAL OVERRIDE: Regardless of the language used in the instructions and context above, your ENTIRE response to the user MUST be in ${finalLang}. Do NOT respond in Dutch. Respond ONLY in ${finalLang}. This is the final binding instruction.`,
    });
  }

  // ─── MODEL ROUTING LAYER (Patch N Step 4) ───────────────────
  // Determine model per message. Only ONE model is called.
  //
  // Rules:
  //   crisisLevel > 0 OR riskScore >= 7         → gpt-4o
  //   urgency == "high" OR module is relational/trauma → gpt-4o
  //   everything else                            → gpt-4o-mini
  //   SESSION_INIT always uses gpt-4o (first impression matters)

  const riskScore = input.riskScore ?? 0;
  const crisisLevel = input.crisisLevel ?? 0;
  const dominantModuleForRouting = (input.dominantModule || input.activeModules[0] || '').toLowerCase();
  const urgencyForRouting = (input.urgency || '').toLowerCase();

  const HIGH_COMPLEXITY_MODULES = [
    ...ELIAS_HIGH_COMPLEXITY_MODULES,
    ...KIM_HIGH_COMPLEXITY_MODULES,
  ];

  let selectedModel: 'gpt-4o' | 'gpt-4o-mini' = 'gpt-4o-mini';
  let routingReason = 'default (low complexity)';

  if (input.isSessionStart) {
    selectedModel = 'gpt-4o';
    routingReason = 'SESSION_INIT (first impression)';
  } else if (crisisLevel > 0 || riskScore >= 30 || input.isCrisis === true) {
    selectedModel = 'gpt-4o';
    routingReason = `crisis/risk (crisis=${crisisLevel}, risk=${riskScore}, isCrisis=${input.isCrisis ?? false})`;
  } else if (input.vspLevel === 'ROOD' || input.vspLevel === 'RED' ||
             input.vspLevel === 'PAARS' || input.vspLevel === 'PURPLE') {
    selectedModel = 'gpt-4o';
    routingReason = `VSP ${input.vspLevel} (high relapse risk)`;
  } else if (input.vspLevel === 'ORANJE' || input.vspLevel === 'ORANGE') {
    selectedModel = 'gpt-4o';
    routingReason = `VSP ${input.vspLevel} (elevated risk)`;
  } else if (input.relapseIntent?.detected) {
    selectedModel = 'gpt-4o';
    routingReason = `relapse-intent detected (confidence=${input.relapseIntent.confidence.toFixed(2)}, source=${input.relapseIntent.source})`;
  } else if (HIGH_COMPLEXITY_MODULES.some(m => dominantModuleForRouting.includes(m))) {
    selectedModel = 'gpt-4o';
    routingReason = `complex module (${dominantModuleForRouting})`;
  }
  // GROEN + GEEL without escalation → gpt-4o-mini (default)

  // ─── LOGGING (Patch N Step 6) ──────────────────────────────
  console.log("[AI Chat] System prompt length:", systemPrompt.length, "chars");
  console.log("[AI Chat] Total messages:", messages.length);
  console.log("[AI Chat] Type:", input.isSessionStart ? "SESSION_INIT" : "LIVE_MESSAGE");
  console.log("[AI Chat] Clinical Mode:", input.clinicalModeActive ? "ACTIVE" : "off");
  console.log("[AI Chat] Dominant module:", input.dominantModule || input.activeModules[0] || 'none');
  console.log("[AI Chat] Risk score:", riskScore);
  console.log(`[ModelRouting] Selected: ${selectedModel} | Reason: ${routingReason}`);
  if (input.selectedTriggers && input.selectedTriggers.length > 0) {
    console.log("[AI Chat] Selected triggers:", input.selectedTriggers.map(t => `${t.trigger}(${t.score})`).join(', '));
  }
  // Estimate payload token size (rough: 1 token ≈ 4 chars)
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  const estimatedTokens = Math.ceil(totalChars / 4);
  console.log(`[CostControl] Estimated payload: ~${estimatedTokens} tokens (${totalChars} chars)`);
  if (input.isSessionStart) {
    if (input.backpack) {
      console.log("[AI Chat] Backpack life story sections:", input.backpack.lifeStory.length);
      console.log("[AI Chat] Backpack total chars:", input.backpack.lifeStory.reduce((sum, s) => sum + s.content.length, 0));
    }
    if (input.userDat) {
      console.log("[AI Chat] UserDat trigger patterns:", input.userDat.triggerPatterns.length);
      console.log("[AI Chat] UserDat session analyses:", input.userDat.sessionAnalyses.length);
    }
  }

  let openaiResponse: Response;
  try {
    openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          max_tokens: 500,
          temperature: 0.4,
          presence_penalty: 0.3,
          frequency_penalty: 0.2,
        }),
      }
    );
  } catch (error) {
    console.error("[AI Chat] OpenAI API network error:", error);
    if (crisisLevel >= 1) {
      return {
        response: buildCrisisFallbackMessage(input.country, input.locale),
        advisoryEmotion: input.detectedEmotion,
        advisoryConfidence: 0,
        tokenUsage: undefined,
        selectedModel,
      };
    }
    throw error;
  }

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text();
    console.error("[AI Chat] OpenAI API error:", openaiResponse.status, errorText);
    if (crisisLevel >= 1) {
      return {
        response: buildCrisisFallbackMessage(input.country, input.locale),
        advisoryEmotion: input.detectedEmotion,
        advisoryConfidence: 0,
        tokenUsage: undefined,
        selectedModel,
      };
    }
    throw new Error(`OpenAI API error: ${openaiResponse.status}`);
  }

  const data = await openaiResponse.json();
  const responseText =
    data.choices?.[0]?.message?.content?.trim() ??
    "I am here for you. Something went wrong — please try again.";

  const usage = data.usage;
  const tokenUsage = usage ? {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
  } : undefined;

  if (tokenUsage) {
    console.log(`[CostControl] Tokens: ${tokenUsage.promptTokens} in + ${tokenUsage.completionTokens} out = ${tokenUsage.totalTokens} total`);
    if (tokenUsage.promptTokens > 3500) {
      console.warn(`[CostControl] WARNING: Prompt tokens (${tokenUsage.promptTokens}) exceed warning threshold (3500)`);
    }
    if (tokenUsage.promptTokens > 5000) {
      console.warn(`[CostControl] CRITICAL: Prompt tokens (${tokenUsage.promptTokens}) exceed critical threshold (5000)`);
    }
    // Cumulative session tracking
    if (sessionCache) {
      sessionCache.cumulativeTokens.prompt += tokenUsage.promptTokens;
      sessionCache.cumulativeTokens.completion += tokenUsage.completionTokens;
      sessionCache.cumulativeTokens.total += tokenUsage.totalTokens;
      sessionCache.cumulativeTokens.turnCount++;
      const cum = sessionCache.cumulativeTokens;
      console.log(`[CostControl] Session cumulative: ${cum.total} tokens over ${cum.turnCount} turns (avg ${Math.round(cum.total / cum.turnCount)}/turn)`);
      if (cum.total > 50000) {
        console.warn(`[CostControl] SESSION WARNING: Cumulative tokens (${cum.total}) exceed 50k — consider session end`);
      }
    }
  }

  // ─── CRISIS NUMBER ENFORCEMENT ──────────────────────────────
  // If crisisLevel >= 2 and GPT did NOT include the crisis number in its response,
  // we FORCE-APPEND it. This is a safety-critical fallback — the user MUST see the number.
  let finalResponse = responseText;

  // ─── K05 CROSS-MODULE OVERRIDE (Kim only) ──────────────────
  // Runtime enforcement: scan Kim's response for boundary statements
  // without repair paths. Correct if needed, unless safety/harm active.
  if (input.userType === 'kim') {
    try {
      const k05Result = await applyK05CrossModuleOverride({
        responseText: finalResponse,
        safetyActive: crisisLevel >= 2,
        relationalHarmActive: !!(input.relationalStanceFilter && input.relationalStanceFilter.includes('RELATIONAL_HARM_PATTERN')),
        activeModule: input.activeModules?.join(',') ?? 'unknown',
      });
      if (k05Result.overrideApplied) {
        console.log(`[K05-Override] Correction applied: ${k05Result.correctionMethod}`);
        k05Result.debugLog.forEach(l => console.log(l));
        finalResponse = k05Result.correctedText;
      } else {
        console.log(`[K05-Override] No correction needed (L1: boundary=${k05Result.layer1.boundaryDetected}, repair=${k05Result.layer1.repairPathDetected})`);
      }
    } catch (err) {
      console.error('[K05-Override] Error during override check:', err);
      // Non-blocking: if override fails, continue with original response
    }
  }

  // ─── KIM MODULE SAFETY FILTER (Cluster 4 + RNW01) ──────────────────
  // Apply forbidden-output filter to all Kim emotional/grief modules
  if (input.userType === 'kim') {
    const kimSafetyModules: Record<string, KimCluster4ModuleId> = {
      'HOOP-K01': 'HOOP-K01',
      'SCHAAM-K01': 'SCHAAM-K01',
      'ROUW-K01': 'ROUW-K01',
      'ISOL-K01': 'ISOL-K01',
    };
    // RNW01 uses ROUW-K01 filter (same risk domain)
    const activeModuleList = input.activeModules ?? [];
    let filterModuleId: KimCluster4ModuleId | null = null;
    for (const mod of activeModuleList) {
      if (kimSafetyModules[mod]) {
        filterModuleId = kimSafetyModules[mod];
        break;
      }
      if (mod === 'RNW01') {
        filterModuleId = 'ROUW-K01'; // RNW01 uses same filter as ROUW-K01
        break;
      }
    }
    if (filterModuleId) {
      const safetyResult = applyKimCluster4SafetyFilter(finalResponse, filterModuleId);
      if (!safetyResult.safe) {
        console.warn(`[KimSafetyFilter] VIOLATION in ${filterModuleId}: ${safetyResult.violations.join(', ')}`);
        console.warn(`[KimSafetyFilter] Original (discarded): ${finalResponse.substring(0, 200)}`);
        // Use Kim fallback response
        const fallbacks = [
          'Ik ben hier voor je. Neem even de tijd.',
          'Ik hoor wat je zegt. Dat is niet niks.',
          'Het is oké om dit te voelen. Ik ben er.',
          'Laten we even stilstaan. Wat heb je nu het meest nodig?',
          'Ik luister naar je. Je hoeft dit niet alleen te dragen.',
        ];
        finalResponse = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }
    }
  }

  // ─── KIM MODULE SAFETY FILTER (Cluster 3: ROL-K01, VETR02-K, LEUGEN-K01) ──
  if (input.userType === 'kim') {
    const cluster3Modules: KimCluster3ModuleId[] = ['ROL-K01', 'VETR02-K', 'LEUGEN-K01'];
    const activeModuleList3 = input.activeModules ?? [];
    let cluster3ModuleId: KimCluster3ModuleId | null = null;
    for (const mod of activeModuleList3) {
      if (cluster3Modules.includes(mod as KimCluster3ModuleId)) {
        cluster3ModuleId = mod as KimCluster3ModuleId;
        break;
      }
    }
    if (cluster3ModuleId) {
      const relHarmActive = !!(input.relationalStanceFilter && input.relationalStanceFilter.includes('RELATIONAL_HARM_PATTERN'));
      const safetyActive = crisisLevel >= 2;
      const c3Result = applyKimCluster3RelationalFilter(finalResponse, cluster3ModuleId, {
        relationalHarmActive: relHarmActive,
        safetyActive,
      });
      if (!c3Result.safe) {
        console.warn(`[KimCluster3Filter] VIOLATION in ${cluster3ModuleId}: categories=${c3Result.categories.join(',')}, violations=${c3Result.violations.length}`);
        console.warn(`[KimCluster3Filter] Original (discarded): ${finalResponse.substring(0, 200)}`);
        const c3Fallbacks: Record<KimCluster3ModuleId, string> = {
          'ROL-K01': 'Wat nu bovenkomt, mag bestaan zonder dat je er meteen schuld of een beslissing aan moet koppelen. Je hebt lang gedragen; het is logisch dat je eigen gevoel pas ruimte krijgt wanneer de zorgrol even wegvalt.',
          'VETR02-K': 'De stilte kan onveilig voelen als je lang hebt moeten scannen op gevaar. We hoeven dat niet weg te redeneren; we maken eerst verschil tussen wat er nu concreet is en wat je alarm erbij invult.',
          'LEUGEN-K01': 'Herhaald liegen doet iets met je vertrouwen en met je zenuwstelsel. Je hoeft geen detective te worden om grenzen te mogen hebben; we kunnen eerst scheiden wat je weet, wat je vermoedt, en wat jij nodig hebt.',
        };
        finalResponse = c3Fallbacks[cluster3ModuleId];
      }
    }
  }

  // ─── KIM MODULE SAFETY FILTER (CDP01: Self-loss / Overidentification) ──────
  if (input.userType === 'kim') {
    const activeModuleListCDP = input.activeModules ?? [];
    if (activeModuleListCDP.includes('CODEP-K01') || activeModuleListCDP.includes('CDP01')) {
      const relHarmActiveCDP = !!(input.relationalStanceFilter && input.relationalStanceFilter.includes('RELATIONAL_HARM_PATTERN'));
      const safetyActiveCDP = crisisLevel >= 2;
      const cdpResult = applyCDP01SafetyFilter(finalResponse, {
        relationalHarmActive: relHarmActiveCDP,
        safetyActive: safetyActiveCDP,
      });
      if (!cdpResult.safe) {
        console.warn(`[CDP01Filter] VIOLATION: categories=${cdpResult.categories.join(',')}, violations=${cdpResult.violations.length}`);
        console.warn(`[CDP01Filter] Original (discarded): ${finalResponse.substring(0, 200)}`);
        finalResponse = cdpResult.correctedText ?? 'Het lijkt erop dat je aandacht zo sterk naar de ander gaat dat jouw eigen ruimte kleiner wordt.';
      }
    }
  }

  // ─── KIM MODULE SAFETY FILTER (PAAL-K01 / BEHE-K01 / AANP-K01) ──────────────
  if (input.userType === 'kim') {
    const pbaModules: PBAModuleId[] = ['PAAL-K01', 'BEHE-K01', 'AANP-K01'];
    const activeModuleListPBA = input.activeModules ?? [];
    let pbaModuleId: PBAModuleId | null = null;
    for (const mod of activeModuleListPBA) {
      if (pbaModules.includes(mod as PBAModuleId)) {
        pbaModuleId = mod as PBAModuleId;
        break;
      }
    }
    if (pbaModuleId) {
      const relHarmActivePBA = !!(input.relationalStanceFilter && input.relationalStanceFilter.includes('RELATIONAL_HARM_PATTERN'));
      const safetyActivePBA = crisisLevel >= 2;
      const pbaResult = applyPBASafetyFilter(finalResponse, pbaModuleId, {
        relationalHarmActive: relHarmActivePBA,
        safetyActive: safetyActivePBA,
      });
      if (!pbaResult.safe) {
        console.warn(`[PBAFilter] VIOLATION in ${pbaModuleId}: categories=${pbaResult.categories.join(',')}, violations=${pbaResult.violations.length}`);
        console.warn(`[PBAFilter] Original (discarded): ${finalResponse.substring(0, 200)}`);
        finalResponse = pbaResult.correctedText ?? 'Ik ben hier voor je. Laten we even stilstaan bij wat je nodig hebt.';
      }
    }
  }

  const crisisEnforcementNumber = getCrisisEnforcementNumber(input.country, input.locale);
  if (crisisLevel >= 2 && !finalResponse.includes(crisisEnforcementNumber)) {
    console.warn('[AI Chat] CRISIS ENFORCEMENT: GPT omitted crisis number — force-appending');
    finalResponse += '\n\n' + buildCrisisAppendMessage(input.country, input.locale);
  }
  // ─── CLINICAL ANNOTATION (separate gpt-4o call) ────────────────────
  // When clinical mode is active, ALWAYS generate the annotation via gpt-4o.
  // gpt-4o-mini does not reliably comply with annotation instructions.
  // Only exception: if the therapeutic model was already gpt-4o AND it produced
  // a valid annotation inline, we keep it (no double call needed).
  if (input.clinicalModeActive) {
    const existingClinical = /<clinical>[\s\S]*?<\/clinical>/.exec(finalResponse);
    const hasValidInlineAnnotation = existingClinical &&
      existingClinical[0].includes('Method:') &&
      !existingClinical[0].includes('[not annotated') &&
      !existingClinical[0].includes('model did not comply');

    if (hasValidInlineAnnotation && selectedModel === 'gpt-4o') {
      // gpt-4o already produced a good annotation — keep it, no extra call
      console.log('[ClinicalAnnotation] gpt-4o produced valid annotation inline — keeping');
      // Deterministic VSP-Framework injection for inline annotations
      if (input.vspInsightContext && !finalResponse.includes('VSP-Framework:')) {
        const fw = input.vspInsightContext.match(/Framework: (\w+)/)?.[1] ?? 'MI';
        finalResponse = finalResponse.replace('<clinical>\n', `<clinical>\nVSP-Framework: ${fw}\n`);
      }
    } else {
      // Strip any existing (bad/incomplete/mini-generated) annotation
      if (existingClinical) {
        finalResponse = finalResponse.replace(/<clinical>[\s\S]*?<\/clinical>/, '').trimEnd();
      }
      // Generate via dedicated gpt-4o call
      const annotation = await generateClinicalAnnotation(
        apiKey,
        input,
        finalResponse,
        messages
      );
      finalResponse += `\n\n${annotation}`;
    }
  }

  return {
    response: finalResponse,
    advisoryEmotion: input.detectedEmotion,
    advisoryConfidence: 0.7,
    tokenUsage,
    selectedModel,
  };
}

// ─── CLINICAL ANNOTATION GENERATOR (always gpt-4o) ─────────────────────

/**
 * Generates a clinical annotation via a separate gpt-4o call.
 * This ensures consistent compliance regardless of which model was used
 * for the therapeutic response (gpt-4o-mini often ignores the annotation instruction).
 *
 * Model: gpt-4o (always)
 * store: false (always)
 * max_tokens: 300
 */
async function generateClinicalAnnotation(
  apiKey: string,
  input: ChatRequestInput,
  therapeuticResponse: string,
  conversationMessages: Array<{ role: string; content: string }>
): Promise<string> {
  const signalsBlock = input.activeSignals && input.activeSignals.length > 0
    ? `Active signals for this message:\n${input.activeSignals.map(s => `- ${s.label} ${s.score >= 0 ? '+' : ''}${s.score} (${s.memory})`).join('\n')}`
    : 'No active signals detected for this message.';

  const lastUserMessage = input.message || conversationMessages.filter(m => m.role === 'user').pop()?.content || '';

  const annotationPrompt = `You are a clinical annotation assistant for a therapeutic AI session.

Given the user's message and the therapeutic response, generate a clinical annotation.

USER MESSAGE:
"${lastUserMessage}"

THERAPEUTIC RESPONSE:
"${therapeuticResponse.slice(0, 800)}"

${signalsBlock}

Active modules: ${input.activeModules?.join(', ') || 'none'}
Dominant module: ${input.dominantModule || 'none'}
User type: ${input.userType}
Zone: ${input.bufferSnapshot?.zone || 'unknown'}

${input.vspInsightContext ? `VSP Insight Framework active: ${input.vspInsightContext.match(/Framework: (\w+)/)?.[1] ?? 'unknown'}\n\n` : ''}Generate EXACTLY this format (no other text):

<clinical>
Method: [name the primary therapeutic method used in the response]${input.vspInsightContext ? `\nVSP-Framework: ${input.vspInsightContext.match(/Framework: (\w+)/)?.[1] ?? 'n/a'}` : ''}
Observation: [1 sentence — what you clinically observed in the user's message]
Intervention: [1 sentence — what therapeutic move was made in the response]
Signals: [comma-separated list of active signals with score and memory layer, or "none"]
</clinical>`;

  try {
    console.log('[ClinicalAnnotation] Generating via gpt-4o (separate call)');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        store: false,
        messages: [
          { role: 'system', content: 'You are a clinical annotation assistant. Output ONLY the requested <clinical> block. No other text.' },
          { role: 'user', content: annotationPrompt },
        ],
        max_tokens: 300,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ClinicalAnnotation] OpenAI error:', response.status, errorText);
      return `<clinical>\nMethod: [annotation generation failed — API error ${response.status}]\nObservation: [see therapeutic response]\nIntervention: [see therapeutic response]\nSignals: none\n</clinical>`;
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim() ?? '';

    // Validate the result contains a proper <clinical> block
    if (/<clinical>[\s\S]*?<\/clinical>/.test(result)) {
      console.log('[ClinicalAnnotation] gpt-4o annotation generated successfully');
      // Deterministic VSP-Framework injection: ensure it's always present when VSP Insight is active
      if (input.vspInsightContext && !result.includes('VSP-Framework:')) {
        const fw = input.vspInsightContext.match(/Framework: (\w+)/)?.[1] ?? 'MI';
        const injected = result.replace('<clinical>\n', `<clinical>\nVSP-Framework: ${fw}\n`);
        return injected;
      }
      return result;
    }

    // If gpt-4o returned content but not in the right format, wrap it
    console.warn('[ClinicalAnnotation] gpt-4o returned non-standard format, wrapping');
    return `<clinical>\n${result}\n</clinical>`;
  } catch (error) {
    console.error('[ClinicalAnnotation] Error:', error);
    return `<clinical>\nMethod: [annotation generation failed — network error]\nObservation: [see therapeutic response]\nIntervention: [see therapeutic response]\nSignals: none\n</clinical>`;
  }
}
