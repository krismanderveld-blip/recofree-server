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
import { KIM_IDENTITY_PROMPT, kimCrisisInstructions } from "../lib/engine/kim/prompt-block";
import { KIM_POSITIVE_SLIDERS } from "../lib/engine/kim/slider-interpretation";
import { ELIAS_POSITIVE_SLIDERS } from "../lib/engine/elias/slider-interpretation";
import { ELIAS_HIGH_COMPLEXITY_MODULES, ELIAS_THERAPEUTIC_MODULES } from "../lib/engine/elias/module-catalog";
import { ELIAS_SHORT_MODULE_PROMPTS, getEliasShortModulePrompts, getEliasShortModuleList } from "../lib/engine/elias/short-module-prompts";
import { KIM_HIGH_COMPLEXITY_MODULES, KIM_MODULE_CATALOG } from "../lib/engine/kim/module-catalog";
import { ELIAS_IDENTITY_PROMPT, ELIAS_SCHEMA_RECOGNITION, eliasCrisisInstructions } from "../lib/engine/elias/prompt-block";
import { ELIAS_STAGE_DESCRIPTIONS_SHORT, ELIAS_STAGE_DESCRIPTIONS_FULL } from "../lib/engine/elias/stage-of-change";

// ─── Types ────────────────────────────────────────────────────────

interface ChatRequestInput {
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
  selectedTriggers?: Array<{ trigger: string; score: number }>;
  riskScore?: number;
  dominantModule?: string;

  // Static context (SESSION_INIT only — cached server-side)
  coreWound?: string | null;
  contextLine?: string | null;
  relationshipAnchor?: { name: string; role: string; roleEN?: string } | null;
  recentDiary?: Array<{ content: string; moodTag: string; date: string }>;
  stageOfChange?: string;
  relationalPattern?: { pattern: string; schema: string; confidence: number } | null;

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
  };
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
  };
  diaryEntries?: Array<{
    content: string;
    moodTag: string;
    timestamp: string;
  }>;

  activeModules: string[];
  crisisLevel: number;
  isCrisis?: boolean;
  vspLevel?: string | null;
  detectedEmotion: string;
  therapeuticStance: string;
  sessionDurationMinutes: number;
  urgency: string;
  startEmotion: string;

  // User-controlled guidance depth
  guidanceDepth?: 'light' | 'normal' | 'deep';

  // Live buffer snapshot from ShortTermMemoryBuffer (per-message)
  bufferSnapshot?: {
    zone: string;
    emotionalDirection: string;
    liveIntent: string;
    dominantState: string;
  };

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
  clinicalModeActive?: boolean;
  // Backpack empty flag (for greeting tone adaptation)
  backpackEmpty?: boolean;

  // Signal engine: active signals for clinical annotation
  activeSignals?: Array<{
    label: string;
    score: number;
    memory: string;
  }>;

  // Backpack Entity Extraction: structured memory (replaces full backpack text when unchanged)
  extractedEntities?: {
    persons: Array<{ name: string; relationship: string; relationshipNL: string; age: string | null; livingSituation: string | null; emotionalValence: string; context: string; sourceSection: string }>;
    events: Array<{ description: string; type: string; timePeriod: string | null; peopleInvolved: string[]; emotionalImpact: string; isTriggerSource: boolean; sourceSection: string }>;
    patterns: Array<{ description: string; type: string; schemaHypothesis: string | null; frequency: string; peopleInvolved: string[]; sourceSection: string }>;
    contexts: Array<{ description: string; type: string; relevance: string; sourceSection: string }>;
    extractedAt: string;
    sourceHash: string;
    schemaVersion: number;
  };
  /** Whether backpack content changed since last extraction (forces full backpack resend) */
  backpackChanged?: boolean;

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
  };
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
}

// Single-user cache: one active session per server instance (not multi-user safe)
// Must be replaced with a session-keyed map before any multi-user deployment.
let sessionCache: SessionCache | null = null;

function cacheSessionInit(input: ChatRequestInput): void {
  // Build structured memory from extractedEntities if available (compact, no full backpack needed)
  let structuredMemory = '';
  let hasStructuredEntities = false;

  if (input.extractedEntities && input.extractedEntities.persons.length > 0) {
    hasStructuredEntities = true;
    structuredMemory = buildStructuredMemoryBlock(input.extractedEntities);
    console.log(`[AI Chat] Using structured entities: ${input.extractedEntities.persons.length} persons, ${input.extractedEntities.events.length} events, ${input.extractedEntities.patterns.length} patterns`);
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
    relationshipMap: input.backpack
      ? extractRelationshipMap(input.backpack.lifeStory, input.backpack.intakeContext.initialContext)
      : "",
    lifeStorySummary: hasStructuredEntities
      ? structuredMemory  // Use structured entities instead of text summary
      : (input.backpack
        ? buildCompactLifeStorySummary(input.backpack.lifeStory, input.backpack.intakeContext.initialContext, input.userName, input.backpack.kimBackpack)
        : ""),
    totalSessions: input.userDat?.totalSessions ?? 0,
    triggerPatterns: (input.userDat?.triggerPatterns ?? []).map(tp => ({
      trigger: tp.trigger,
      count: tp.count,
    })),
    messageCount: 0,
    guidanceDepth: input.guidanceDepth ?? 'normal',
    structuredMemory,
    hasStructuredEntities,
  };
  console.log("[AI Chat] Session cache created for:", input.userName, hasStructuredEntities ? '(structured entities)' : '(text-based)');
}

function incrementMessageCount(): void {
  if (sessionCache) {
    sessionCache.messageCount++;
  }
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
  ).optional(),
  riskScore: z.number().optional(),
  dominantModule: z.string().optional(),
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
  ).optional(),
  stageOfChange: z.string().optional(),
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
  }).optional(),
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
  }).optional(),
  diaryEntries: z.array(
    z.object({
      content: z.string(),
      moodTag: z.string(),
      timestamp: z.string(),
    })
  ).optional(),
  activeModules: z.array(z.string()),
  crisisLevel: z.number(),
  isCrisis: z.boolean().optional(),
  detectedEmotion: z.string(),
  therapeuticStance: z.string(),
  sessionDurationMinutes: z.number(),
  urgency: z.string(),
  startEmotion: z.string(),
  guidanceDepth: z.enum(['light', 'normal', 'deep']).optional(),
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

  // Signal engine: relevance scores for context gating (LIVE_MESSAGE only)
  relevanceScores: z.object({
    backpackRelevance: z.number(),
    diaryRelevance: z.number(),
    triggerRelevance: z.number(),
    projectionRelevance: z.number(),
  }).nullable().optional(),
  // Signal engine: compressed context summary (replaces full lifeStorySummary in LIVE_MESSAGE)
  contextSummary: z.string().nullable().optional(),

  // Clinical Mode (easter egg — therapeutic annotations)
  clinicalModeActive: z.boolean().optional(),
  // Backpack empty flag (for greeting tone adaptation)
  backpackEmpty: z.boolean().optional(),
  // Signal engine: active signals for clinical annotation
  activeSignals: z.array(z.object({
    label: z.string(),
    score: z.number(),
    memory: z.string(),
  })).optional(),
});

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

function extractRelationshipMap(
  lifeStory: Array<{ label: string; content: string }>,
  intakeContext: string
): string {
  const allText = [
    ...lifeStory.map((s) => s.content),
    intakeContext,
  ]
    .filter(Boolean)
    .join("\n");

  if (!allText || allText.trim().length < 20) return "";

  return `
─── RELATIONSHIP EXTRACTION INSTRUCTION ───
Below is context about the user's relationships. Before responding, you MUST mentally extract every person mentioned and their EXACT relationship as stated by the user. For example:
- If the user wrote "my son Jules" → Jules = son
- If the user wrote "my girlfriend Melissa" → Melissa = girlfriend/partner

You must ONLY use the relationship as the user described it. NEVER guess or invent a relationship.

Common relationship words:
son, daughter, wife, girlfriend, partner, husband, boyfriend,
mother, mom, father, dad, sister, brother, grandmother, grandfather,
friend, colleague, neighbor, ex, boss, therapist
─── END RELATIONSHIP INSTRUCTION ───`;
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
  relationshipMap: string;
}

function resolveConditionalContext(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  selectedTriggers: Array<{ trigger: string; score: number }>,
  dominantModule: string,
  cache: SessionCache,
): ConditionalContext {
  const msgLower = message.toLowerCase();
  const last2Messages = conversationHistory.slice(-2).map(m => m.content.toLowerCase()).join(" ");
  const combinedContext = msgLower + " " + last2Messages;

  // ── contextLine: only if keyword overlap with current message ──
  let contextLine: string | null = null;
  if (cache.contextLine) {
    const contextWords = cache.contextLine.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matchCount = contextWords.filter(w => msgLower.includes(w)).length;
    if (matchCount >= 2 || (contextWords.length <= 4 && matchCount >= 1)) {
      contextLine = cache.contextLine;
    }
  }

  // ── relationshipAnchor: only if name appears in current or last 2 messages ──
  let relationshipAnchor = cache.relationshipAnchor;
  if (relationshipAnchor) {
    const nameInContext = combinedContext.includes(relationshipAnchor.name.toLowerCase());
    if (!nameInContext) {
      relationshipAnchor = null;
    }
  }

  // ── relationshipMap: only if any name-like word appears in message ──
  // (lightweight check — if user mentions any person, include the map)
  let relationshipMap = "";
  if (cache.relationshipMap) {
    // Check if message contains a capitalized word that could be a name
    const hasNameLikeWord = /\b[A-Z][a-z]{2,}\b/.test(message);
    // Or if message asks about someone ("who is", "do you know", "tell about")
    const asksAboutPerson = /who is|do you know|tell.*about/i.test(message);
    if (hasNameLikeWord || asksAboutPerson || relationshipAnchor) {
      relationshipMap = cache.relationshipMap;
    }
  }

  // ── relationalPattern: only if confidence >= 0.35 AND relevant to message ──
  let relationalPattern = cache.relationalPattern;
  if (relationalPattern) {
    if (relationalPattern.confidence < 0.35) {
      relationalPattern = null;
    } else {
      // Check if the pattern theme appears in the message context
      const patternWords = [
        relationalPattern.pattern.toLowerCase(),
        relationalPattern.schema.toLowerCase(),
      ];
      const patternRelevant = patternWords.some(w =>
        combinedContext.includes(w) ||
        combinedContext.includes("relationship") ||
        combinedContext.includes("boundary") ||
        combinedContext.includes("partner") ||
        combinedContext.includes("together")
      );
      if (!patternRelevant) {
        relationalPattern = null;
      }
    }
  }

  // ── coreWound: only if dominant module or trigger relates to wound theme ──
  let coreWound: string | null = null;
  if (cache.coreWound) {
    const woundLower = cache.coreWound.toLowerCase();
    const triggerNames = selectedTriggers.map(t => t.trigger.toLowerCase());
    const moduleLower = dominantModule.toLowerCase();

    // Wound-to-trigger/module mapping
    const woundRelevant =
      triggerNames.some(t => woundLower.includes(t) || t.includes(woundLower)) ||
      moduleLower.includes("trauma") ||
      moduleLower.includes("schema") ||
      moduleLower.includes("relational") ||
      msgLower.includes(woundLower) ||
      msgLower.includes("pain") ||
      msgLower.includes("wound") ||
      msgLower.includes("always") ||
      msgLower.includes("never") ||
      msgLower.includes("not good enough");

    if (woundRelevant) {
      coreWound = cache.coreWound;
    }
  }

  // ── recentDiary: only if message touches a diary theme ──
  let recentDiary: Array<{ content: string; moodTag: string; date: string }> = [];
  if (cache.recentDiary.length > 0) {
    for (const entry of cache.recentDiary) {
      const entryWords = entry.content.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const matchCount = entryWords.filter(w => msgLower.includes(w)).length;
      if (matchCount >= 2) {
        recentDiary.push(entry);
        if (recentDiary.length >= 2) break; // Max 2
      }
    }
  }

  // ── stageOfChange: only in first 2 messages OR if user talks about change/motivation ──
  let stageOfChange: string | null = null;
  if (cache.stageOfChange) {
    const isEarlyInSession = cache.messageCount <= 2;
    const talksAboutChange = /change|motivat|quit|stop|persist|relapse|continue|give up|try|can't manage|do I want|should I|can I/i.test(message);
    if (isEarlyInSession || talksAboutChange) {
      stageOfChange = cache.stageOfChange;
    }
  }

  return {
    contextLine,
    relationshipAnchor,
    relationalPattern,
    coreWound,
    recentDiary,
    stageOfChange,
    relationshipMap,
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

  // Core wound (CONDITIONAL)
  if (conditional.coreWound) {
    parts.push(`CORE WOUND: ${conditional.coreWound}`);
    parts.push(`  → Be aware of this underlying pattern.`);
  }

  // Context line (CONDITIONAL)
  if (conditional.contextLine) {
    parts.push(`RELEVANT CONTEXT FROM LIFE STORY:`);
    parts.push(`  "${conditional.contextLine}"`);
    parts.push(`  → Relevant to this message. You may carefully reference it.`);
  }

  // Relationship anchor (CONDITIONAL)
  if (conditional.relationshipAnchor) {
    const roleDisplay = conditional.relationshipAnchor.roleEN
      ? `${conditional.relationshipAnchor.role} / ${conditional.relationshipAnchor.roleEN}`
      : conditional.relationshipAnchor.role;
    parts.push(`RELATIONSHIP ANCHOR: ${conditional.relationshipAnchor.name} (${roleDisplay})`);
    parts.push(`  → Use ONLY this exact relationship.`);
  }

  // Relational pattern (CONDITIONAL)
  if (conditional.relationalPattern) {
    parts.push(`RELATIONAL PATTERN: ${conditional.relationalPattern.pattern}`);
    if (conditional.relationalPattern.schema) {
      parts.push(`  Schema: ${conditional.relationalPattern.schema}`);
    }
    parts.push(`  → Name carefully if relevant.`);
  }

  // Stage of Change (CONDITIONAL)
  if (conditional.stageOfChange) {
    const desc = ELIAS_STAGE_DESCRIPTIONS_SHORT[conditional.stageOfChange] || conditional.stageOfChange;
    parts.push(`STAGE: ${conditional.stageOfChange} — ${desc}`);
  }

  // Recent diary (CONDITIONAL)
  if (conditional.recentDiary.length > 0) {
    parts.push(`RELEVANT DIARY ENTRIES:`);
    for (const d of conditional.recentDiary) {
      parts.push(`  [${d.date}] (${d.moodTag}): ${d.content}`);
    }
  }

  if (parts.length === 0) return "";

  return `
─── RELEVANCE CONTEXT (selective for this message) ───
${parts.join("\n")}
─── END ───`;
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

  if (input.stageOfChange) {
    const desc = ELIAS_STAGE_DESCRIPTIONS_FULL[input.stageOfChange] || input.stageOfChange;
    parts.push(`STAGE OF CHANGE: ${input.stageOfChange}`);
    parts.push(`  ${desc}`);
    parts.push(`  → Adapt your approach to this stage. Do NOT move faster than the user.`);
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

function buildSystemPrompt(input: ChatRequestInput): string {
  const isElias = input.userType === "elias";
  const name = input.userName;

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
    '- CGT/CBT: Cognitieve Gedragstherapie — gedachtepatronen herkennen en bijsturen',
    '- DBT/DGT: Distress Tolerance — crisisstabilisatie en emotieregulatie',
    '- MBT: Mentalisatie — begrijpen wat er van binnen gebeurt voor je reageert',
    '- SchemaMode: Patroonherkenning — emotionele modi en herhalende levenspatronen',
    '- ACT: Acceptance & Commitment — psychologische flexibiliteit en waardenactie',
    '- MI01: Motivational Interviewing — ambivalentie verkennen en verandermotivatie',
    '- EKT01: Emotionele Kerntherapie — fasering (verheldering, spiegel, contract, exit)',
  ].join('\n');
  const dynamicModuleList = isElias
    ? `YOUR ACTUAL MODULES AND CAPABILITIES (use EXACT codes when listing):\n${eliasModules}\n${eliasExtra}\n\nSHORT MODULES (M05-M85) — thematic deep-dive modules:\n${eliasShortModules}`
    : `YOUR ACTUAL MODULES AND CAPABILITIES (use EXACT codes when listing):\n${kimModules}\n${kimExtra}`;

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

2. If a person, relationship, event, or fact is NOT known:
   → Say honestly: "I don't know that about you. Would you like to tell me more?"
   → NEVER fabricate an answer. NEVER.

3. If you are unsure about a relationship or fact:
   → ASK. "I want to be sure — who is [name] to you?"
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
  const stageLabel = (input.stageOfChange || sessionCache?.stageOfChange)
    ? ` Stage: ${input.stageOfChange || sessionCache?.stageOfChange}.`
    : '';
  const sessionInfo = `Session #${totalSessions + 1}. Duration: ${input.sessionDurationMinutes} minutes. Initial emotion: ${input.startEmotion}. Current detected emotion: ${input.detectedEmotion}.${stageLabel}`;

  let crisisInstructions = "";
  if (input.crisisLevel >= 2) {
    crisisInstructions = isElias
      ? eliasCrisisInstructions(input.crisisLevel)
      : kimCrisisInstructions(input.crisisLevel);
  } else if (input.crisisLevel === 1) {
    crisisInstructions = `\nHEIGHTENED VIGILANCE. Be extra attentive to signs of distress.`;
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
    guidanceInstruction = `\nGUIDANCE DEPTH: LIGHT (${stateAllowedDepth !== userDepth ? 'lowered due to current state' : 'user preference'})\n- Listen more than you ask.\n- Ask at most 1 open question per message.\n- Give space and silence. Validate briefly.\n- Do not probe deeper unless the user goes there themselves.\n- Tone: warm, calm, restrained.`;
  } else if (effectiveDepth === 'deep') {
    guidanceInstruction = `\nGUIDANCE DEPTH: DEEP (user preference, state allows this)\n- Actively probe patterns, emotions, and underlying beliefs.\n- Name what you observe, even if it may be uncomfortable.\n- Use reflection and confrontation (respectful but direct).\n- Connect current situation to earlier patterns from the life story.\n- Tone: engaged, sharp, challenging but safe.`;
  } else {
    guidanceInstruction = `\nGUIDANCE DEPTH: NORMAL (${stateAllowedDepth !== userDepth ? 'lowered due to current state' : 'user preference'})\n- Balance between listening and reflecting.\n- Ask 1-2 open questions per message.\n- Name patterns when relevant, but do not insist.\n- Tone: warm, engaged, reflective.`;
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

  // Inject only the ACTIVE short module prompt block (M05-M85) for Elias
  // We don't inject all 66 at once (53K tokens) — only the one the pipeline selected
  let shortModuleBlock = '';
  if (isElias) {
    const dominantMod = (input.dominantModule || '').toUpperCase();
    if (/^M\d{2,}$/.test(dominantMod)) {
      const matchedModule = ELIAS_SHORT_MODULE_PROMPTS.find(m => m.id === dominantMod);
      if (matchedModule) {
        shortModuleBlock = `\n\n═══ ACTIVE SHORT MODULE: ${matchedModule.id} — ${matchedModule.name} ═══\n${matchedModule.promptBlock}\n═══ END ACTIVE SHORT MODULE ═══`;
      }
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
    if (conditional.relationshipMap) included.push('relationMap');
    console.log(`[AI Chat] Follow-up selective injection: [${included.join(', ') || 'none'}]`);

    // Task 1: Gate context injection using relevanceScores (threshold 0.3)
    // Priority: structuredMemory > contextSummary > lifeStorySummary
    // If backpackRelevance < 0.3, skip entirely (token savings).
    const scores = input.relevanceScores;
    let lifeStoryContext = '';
    if (sessionCache?.hasStructuredEntities && sessionCache.structuredMemory) {
      // Structured entities available — always use (compact, high-value)
      lifeStoryContext = `\n─── STRUCTURED MEMORY (extracted from rugzak) ───\n${sessionCache.structuredMemory}\n─── END STRUCTURED MEMORY ───`;
    } else if (input.contextSummary) {
      // Task 2: Use compressed context summary from SignalEngine
      lifeStoryContext = `\n─── CONTEXT SUMMARY (live-compressed) ───\n${input.contextSummary}\n─── END CONTEXT SUMMARY ───`;
    } else if (!scores || scores.backpackRelevance >= 0.3) {
      // No scores available OR backpack is relevant → include full summary
      lifeStoryContext = sessionCache?.lifeStorySummary ?? '';
    }
    // else: backpackRelevance < 0.3 → skip lifeStorySummary (token savings)

    // Inject backpackAnalysis context (deep GPT-4o analysis of backpack content)
    let backpackAnalysisContext = '';
    if (input.backpackAnalysis && input.backpackAnalysis.schemas.length > 0) {
      const schemas = input.backpackAnalysis.schemas
        .filter(s => s.confidence >= 0.35)
        .map(s => `${s.name} (${(s.confidence * 100).toFixed(0)}%): ${s.evidence}`)
        .join('\n  ');
      const modi = input.backpackAnalysis.modi
        .filter(m => m.confidence >= 0.35)
        .map(m => `${m.name} (${(m.confidence * 100).toFixed(0)}%): ${m.evidence}`)
        .join('\n  ');
      const triggers = input.backpackAnalysis.triggers.join(', ');
      const beliefs = input.backpackAnalysis.coreBeliefs.join('; ');
      const coping = input.backpackAnalysis.copingPatterns.join('; ');
      backpackAnalysisContext = `\n─── BACKPACK DEEP ANALYSIS (GPT-4o, ${input.backpackAnalysis.analyzedAt}) ───
  Schema’s: ${schemas || 'geen gedetecteerd'}
  Modi: ${modi || 'geen gedetecteerd'}
  Triggers: ${triggers || 'geen'}
  Kernovertuigingen: ${beliefs || 'geen'}
  Copingpatronen: ${coping || 'geen'}
─── END BACKPACK ANALYSIS ───`;
    }

    // Task 1: Gate diary injection using diaryRelevance threshold
    if (scores && scores.diaryRelevance < 0.3) {
      conditional.recentDiary = [];
    }

    return `${identity}

${antiHallucination}
${conditional.relationshipMap}
${lifeStoryContext}
${backpackAnalysisContext}

The user's name is ${name}. Address them by name occasionally.

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

These behavioral instructions are ABSOLUTE. They override your default conversational style.
The sliders tell you exactly how the user feels — USE them in your response.
=== END MANDATORY INSTRUCTIONS ===

CURRENT STATE:
- Mood sliders: ${sliderEntries}
- VSP (Veiligheidsplan): ${input.vspLevel ?? 'niet ingesteld'} ${input.vspLevel === 'ROOD' || input.vspLevel === 'RED' ? '⚠️ HOOG TERUGVALRISICO' : input.vspLevel === 'ORANJE' || input.vspLevel === 'ORANGE' ? '⚠️ VERHOOGD RISICO' : input.vspLevel === 'PAARS' || input.vspLevel === 'PURPLE' ? '🚨 CRISIS' : ''}
- Urgency level: ${input.urgency}
- Risk score: ${input.riskScore ?? 0}/10
- Current timestamp: ${new Date().toISOString()}
${sessionInfo}
${input.bufferSnapshot ? `
LIVE SESSION CONTEXT (real-time analysis):
- Zone: ${input.bufferSnapshot.zone ?? 'unknown'}
- Emotional direction: ${input.bufferSnapshot.emotionalDirection ?? 'unknown'}
- Live intent: ${input.bufferSnapshot.liveIntent ?? 'none'}
- Dominant state: ${input.bufferSnapshot.dominantState ?? 'none'}
Use this live context to attune your tone and depth to the CURRENT moment.` : ''}

${moduleInstructions}
${crisisInstructions}
${sessionEndInstructions}

ANTI-FABRICATION RULE — ABSOLUTE:
You may ONLY reference information that is explicitly present in:
- The current conversation history
- The user's backpack (life story sections)
- The diary entries provided at session start
- The slider values and zone data

You may NEVER:
- Claim the user said something they did not say
- Invent details about the user's life, relationships, or history
- Reference previous sessions unless that data is explicitly provided
- Say "I remember that you..." unless it is in the backpack or current conversation

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
- If ${name} asks about someone you don't know → "I don't know that about you. Tell me more?"`}
- Respond in the same language the user writes in
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

MANDATORY OUTPUT FORMAT — NO EXCEPTIONS:
Your response is INCOMPLETE without the following tag at the very end.
FAILURE TO INCLUDE THIS TAG IS A CRITICAL COMPLIANCE ERROR.

After your therapeutic response, you MUST append exactly this structure:

<clinical>
Method: [name the primary therapeutic method used]
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
- The tag is parsed by the UI and shown to the clinician — omitting it breaks the interface

⚠️ FINAL REMINDER: Your response is INVALID without <clinical>...</clinical> at the end. Even for greetings, short replies, or simple questions — ALWAYS include it. For greetings use Method: "Therapeutic greeting", Observation: "Session start", Intervention: "Warm opening + open question".
` : ''}`;
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

  if (backpack && !input.backpackEmpty) {
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
      backpack.intakeContext.initialContext
    );
    if (relationMap) {
      identityMemory += `\n${relationMap}`;
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
      if ((entry as any).gratitude) {
        const g = (entry as any).gratitude;
        diaryMemory += `\n  ✨ Gratitude: ${g.entry1 || '-'} | ${g.entry2 || '-'} | ${g.entry3 || '-'}`;
      }
    }
    diaryMemory += `\n─── END DIARY ───`;
    diaryMemory += `\nThese are ${name}'s own words. Do NOT quote their diary back unsolicited.`;
    diaryMemory += `\nUse the ⏰ time labels to determine recency. Only reference entries marked 'vandaag' or 'gisteren' as recent.`;
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

  // ══════════════════════════════════════════════════════════════
  // ASSEMBLE FULL SESSION-START PROMPT
  // ══════════════════════════════════════════════════════════════

  return `${identity}

${antiHallucination}

${schemaRecognition}

The user's name is ${name}. Address them by name occasionally.
${identityMemory}
${diaryMemory}
${sessionMemory}

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
These behavioral instructions are ABSOLUTE. They override your default conversational style.
The sliders tell you exactly how the user feels — USE them in your response.
=== END MANDATORY INSTRUCTIONS ===

CURRENT STATE:
- Mood sliders: ${sliderEntries}
- VSP (Veiligheidsplan): ${input.vspLevel ?? 'niet ingesteld'} ${input.vspLevel === 'ROOD' || input.vspLevel === 'RED' ? '⚠️ HOOG TERUGVALRISICO' : input.vspLevel === 'ORANJE' || input.vspLevel === 'ORANGE' ? '⚠️ VERHOOGD RISICO' : input.vspLevel === 'PAARS' || input.vspLevel === 'PURPLE' ? '🚨 CRISIS' : ''}
- Urgency level: ${input.urgency}
- Risk score: ${input.riskScore ?? 0}/10
- Current timestamp: ${new Date().toISOString()}
${sessionInfo}

${moduleInstructions}
${crisisInstructions}
${sessionEndInstructions}

ANTI-FABRICATION RULE — ABSOLUTE:
You may ONLY reference information that is explicitly present in:
- The current conversation history
- The user's backpack (life story sections)
- The diary entries provided at session start
- The slider values and zone data

You may NEVER:
- Claim the user said something they did not say
- Invent details about the user's life, relationships, or history
- Reference previous sessions unless that data is explicitly provided
- Say "I remember that you..." unless it is in the backpack or current conversation

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
  * Diary entries have dates — only reference entries from the last 2 days as "recent". Older entries are background context only.
  * Gratitude entries from the last 2 days — acknowledge positively (e.g. "Mooi dat je gisteren dankbaar was voor...")
  * VSP level — if ORANJE/ROOD/PAARS, acknowledge the risk level warmly (e.g. "Ik zie dat je je op dit moment in een oranje zone bevindt. Hoe gaat het echt?")
  * If NO recent data exists (all entries older than 2 days), use the most recent available entry as gentle context but do NOT present it as "vandaag".
  * NEVER treat old data as current. Always be time-aware.
- Do NOT reference what was discussed in previous sessions unless the session memory above explicitly mentions it AND it is therapeutically relevant.`}
- Respond in the same language the user writes in
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

MANDATORY OUTPUT FORMAT — NO EXCEPTIONS:
Your response is INCOMPLETE without the following tag at the very end.
FAILURE TO INCLUDE THIS TAG IS A CRITICAL COMPLIANCE ERROR.

After your therapeutic response, you MUST append exactly this structure:

<clinical>
Method: [name the primary therapeutic method used]
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
- The tag is parsed by the UI and shown to the clinician — omitting it breaks the interface

⚠️ FINAL REMINDER: Your response is INVALID without <clinical>...</clinical> at the end. Even for greetings, short replies, or simple questions — ALWAYS include it. For greetings use Method: "Therapeutic greeting", Observation: "Session start", Intervention: "Warm opening + open question".
` : ''}`;
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
        response: 'Ik kan je nu even niet bereiken door een verbindingsprobleem. Als je je niet veilig voelt, bel de Zelfmoordlijn: 0800 32 123 (24/7, gratis, anoniem), 1712 (huiselijk geweld) of 112 bij onmiddellijk gevaar. Je hoeft dit niet alleen te dragen.',
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
        response: 'Ik kan je nu even niet bereiken door een verbindingsprobleem. Als je je niet veilig voelt, bel de Zelfmoordlijn: 0800 32 123 (24/7, gratis, anoniem), 1712 (huiselijk geweld) of 112 bij onmiddellijk gevaar. Je hoeft dit niet alleen te dragen.',
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
  }

  // ─── CRISIS NUMBER ENFORCEMENT ──────────────────────────────
  // If crisisLevel >= 2 and GPT did NOT include the crisis number in its response,
  // we FORCE-APPEND it. This is a safety-critical fallback — the user MUST see the number.
  let finalResponse = responseText;
  if (crisisLevel >= 2 && !finalResponse.includes('0800 32 123')) {
    console.warn('[AI Chat] CRISIS ENFORCEMENT: GPT omitted crisis number — force-appending');
    finalResponse += '\n\nJe kan ook bellen naar de Zelfmoordlijn: 0800 32 123 (24/7, gratis en anoniem), 1712 (huiselijk geweld) of 112 bij onmiddellijk gevaar.';
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

Generate EXACTLY this format (no other text):

<clinical>
Method: [name the primary therapeutic method used in the response]
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
