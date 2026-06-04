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
import { ELIAS_HIGH_COMPLEXITY_MODULES } from "../lib/engine/elias/module-catalog";
import { KIM_HIGH_COMPLEXITY_MODULES } from "../lib/engine/kim/module-catalog";
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
}

// Single-user cache: one active session per server instance (not multi-user safe)
// Must be replaced with a session-keyed map before any multi-user deployment.
let sessionCache: SessionCache | null = null;

function cacheSessionInit(input: ChatRequestInput): void {
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
    lifeStorySummary: input.backpack
      ? buildCompactLifeStorySummary(input.backpack.lifeStory, input.backpack.intakeContext.initialContext, input.userName)
      : "",
    totalSessions: input.userDat?.totalSessions ?? 0,
    triggerPatterns: (input.userDat?.triggerPatterns ?? []).map(tp => ({
      trigger: tp.trigger,
      count: tp.count,
    })),
    messageCount: 0,
    guidanceDepth: input.guidanceDepth ?? 'normal',
  };
  console.log("[AI Chat] Session cache created for:", input.userName);
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
});

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
): string {
  const sections = lifeStory
    .filter(s => s.content.trim().length > 0)
    .map(s => `[${s.label}]: ${s.content.trim()}`);

  if (sections.length === 0 && (!intakeContext || intakeContext.trim().length < 10)) {
    return "";
  }

  let summary = `\n─── PERSONAL MEMORY OF ${userName.toUpperCase()} (summary) ───`;
  if (intakeContext && intakeContext.trim().length > 0) {
    summary += `\nIntake: ${intakeContext.trim()}`;
  }
  for (const section of sections) {
    summary += `\n${section}`;
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
═══ THERAPY SELECTION — ACTIVE RULES ═══

IF craving signals detected:
  Use: DGT distress tolerance + relapse-prevention logic

IF shame signals detected:
  Use: self-compassion + ACT defusion

IF user is collapsing / RED zone:
  Use: DGT distress tolerance + self-compassion
  Do NOT use: MBT, schema therapy, confrontation

IF user is angry:
  Use: MBT mentalisation + DGT emotion regulation

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
    // If contextSummary is available (from SignalEngine), use it instead of full lifeStorySummary.
    // If backpackRelevance < 0.3, skip lifeStorySummary entirely (saves tokens).
    const scores = input.relevanceScores;
    let lifeStoryContext = '';
    if (input.contextSummary) {
      // Task 2: Use compressed context summary from SignalEngine
      lifeStoryContext = `\n─── CONTEXT SUMMARY (live-compressed) ───\n${input.contextSummary}\n─── END CONTEXT SUMMARY ───`;
    } else if (!scores || scores.backpackRelevance >= 0.3) {
      // No scores available OR backpack is relevant → include full summary
      lifeStoryContext = sessionCache?.lifeStorySummary ?? '';
    }
    // else: backpackRelevance < 0.3 → skip lifeStorySummary (token savings)

    // Task 1: Gate diary injection using diaryRelevance threshold
    if (scores && scores.diaryRelevance < 0.3) {
      conditional.recentDiary = [];
    }

    return `${identity}

${antiHallucination}
${conditional.relationshipMap}
${lifeStoryContext}

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

These behavioral instructions are ABSOLUTE. They override your default conversational style.
The sliders tell you exactly how the user feels — USE them in your response.
=== END MANDATORY INSTRUCTIONS ===

CURRENT STATE:
- Mood sliders: ${sliderEntries}
- Urgency level: ${input.urgency}
- Risk score: ${input.riskScore ?? 0}/10
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
- You KNOW ${name}. Use the context above to inform your response.
- BUT: refer ONLY to what you ACTUALLY know. Fabricate NOTHING. When in doubt: ASK.
- If ${name} asks about someone you don't know → "I don't know that about you. Tell me more?"
- Respond in the same language the user writes in
- Keep responses concise: follow the PACING instruction strictly
- Never diagnose, never prescribe, never claim to be a professional
- Never break character
- Use "I" statements and reflective listening
- Do NOT use bullet points or numbered lists — speak naturally
- Do NOT use emojis excessively (max 0-1 per message)
- Be genuine, not performative
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
</clinical>

Rules:
- The <clinical> block MUST be the LAST thing in your response
- It must appear in EVERY response without exception
- Do NOT skip it, do NOT forget it, do NOT place it elsewhere
- The tag is parsed by the UI and shown to the clinician — omitting it breaks the interface
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

  if (backpack) {
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
  } else {
    identityMemory = `\n(No backpack available for this message.)`;
  }

  // ── DIARY ──
  const diaryEntries = input.diaryEntries;
  let diaryMemory = "";
  if (diaryEntries && diaryEntries.length > 0) {
    diaryMemory += `\n\n╔══════════════════════════════════════════════════════╗`;
    diaryMemory += `\n║  DIARY — Personal notes by ${name}`;
    diaryMemory += `\n╚══════════════════════════════════════════════════════╝`;
    diaryMemory += `\n\n─── RECENT DIARY ENTRIES ───`;
    for (const entry of diaryEntries) {
      const date = new Date(entry.timestamp).toLocaleDateString();
      diaryMemory += `\n\n[${date}] (mood: ${entry.moodTag}):\n${entry.content}`;
    }
    diaryMemory += `\n─── END DIARY ───`;
    diaryMemory += `\nThese are ${name}'s own words. Do NOT quote their diary back unsolicited.`;
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

These behavioral instructions are ABSOLUTE. They override your default conversational style.
The sliders tell you exactly how the user feels — USE them in your response.
=== END MANDATORY INSTRUCTIONS ===

CURRENT STATE:
- Mood sliders: ${sliderEntries}
- Urgency level: ${input.urgency}
- Risk score: ${input.riskScore ?? 0}/10
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
- You KNOW ${name}. Use your personal memory naturally.
- BUT: refer ONLY to what you ACTUALLY know from the backpack. Fabricate NOTHING. When in doubt: ASK.
- If ${name} asks "who is [name]?" → check FIRST whether that name appears in the life story.
- Respond in the same language the user writes in
- Keep responses concise: follow the PACING instruction strictly
- Never diagnose, never prescribe, never claim to be a professional
- Never break character
- Use "I" statements and reflective listening
- Do NOT use bullet points or numbered lists — speak naturally
- Do NOT use emojis excessively (max 0-1 per message)
- Be genuine, not performative
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
</clinical>

Rules:
- The <clinical> block MUST be the LAST thing in your response
- It must appear in EVERY response without exception
- Do NOT skip it, do NOT forget it, do NOT place it elsewhere
- The tag is parsed by the UI and shown to the clinician — omitting it breaks the interface
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
  } else if (crisisLevel > 0 || riskScore >= 7 || input.isCrisis === true) {
    selectedModel = 'gpt-4o';
    routingReason = `crisis/risk (crisis=${crisisLevel}, risk=${riskScore}, isCrisis=${input.isCrisis ?? false})`;
  } else if (urgencyForRouting === 'high' || urgencyForRouting === 'hoog') {
    selectedModel = 'gpt-4o';
    routingReason = `high urgency (${input.urgency})`;
  } else if (input.vspLevel === 'ROOD' || input.vspLevel === 'RED') {
    selectedModel = 'gpt-4o';
    routingReason = 'VSP RED (high relapse risk)';
  } else if (HIGH_COMPLEXITY_MODULES.some(m => dominantModuleForRouting.includes(m))) {
    selectedModel = 'gpt-4o';
    routingReason = `complex module (${dominantModuleForRouting})`;
  }

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
          temperature: 0.7,
          presence_penalty: 0.3,
          frequency_penalty: 0.2,
        }),
      }
    );
  } catch (error) {
    console.error("[AI Chat] OpenAI API network error:", error);
    if (crisisLevel >= 1) {
      return {
        response: 'I cannot reach you through the connection right now. If you do not feel safe, call 113 (suicide prevention) or 112 (emergency). You do not have to carry this alone.',
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
        response: 'I cannot reach you through the connection right now. If you do not feel safe, call 113 (suicide prevention) or 112 (emergency). You do not have to carry this alone.',
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

  // ─── CLINICAL MODE FALLBACK ─────────────────────────────────
  // If clinical mode is active but GPT failed to include the <clinical> tag,
  // append a fallback annotation so the UI always has something to show.
  let finalResponse = responseText;
  if (input.clinicalModeActive && !/<clinical>[\s\S]*?<\/clinical>/.test(responseText)) {
    console.warn('[AI Chat] Clinical Mode ACTIVE but GPT omitted <clinical> tag — appending fallback');
    finalResponse += `\n\n<clinical>\nMethod: [not annotated — model did not comply]\nObservation: [clinical annotation was requested but not generated]\nIntervention: [see therapeutic response above]\n</clinical>`;
  }

  return {
    response: finalResponse,
    advisoryEmotion: input.detectedEmotion,
    advisoryConfidence: 0.7,
    tokenUsage,
    selectedModel,
  };
}
