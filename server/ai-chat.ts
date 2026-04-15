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
 *   - Module 033 (Kwaliteitscontrole / anti-fabricatie)
 *   - Module 091 (Schema Integratie)
 *   - Module 012 (Vooranalyse / Failsafe)
 *   - Master Engine Spec V2
 */

import { z } from "zod";

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
  detectedEmotion: string;
  therapeuticStance: string;
  sessionDurationMinutes: number;
  urgency: string;
  startEmotion: string;

  // User-controlled guidance depth
  guidanceDepth?: 'light' | 'normal' | 'deep';
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
  totalSessions: number;
  triggerPatterns: Array<{ trigger: string; count: number }>;
  messageCount: number; // Track messages for conditional injection
  guidanceDepth: 'light' | 'normal' | 'deep';
}

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
  detectedEmotion: z.string(),
  therapeuticStance: z.string(),
  sessionDurationMinutes: z.number(),
  urgency: z.string(),
  startEmotion: z.string(),
  guidanceDepth: z.enum(['light', 'normal', 'deep']).optional(),
  bufferSnapshot: z.any().optional(),
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
- If the user wrote "mijn zoon Jules" → Jules = zoon (son)
- If the user wrote "mijn vriendin Melissa" → Melissa = vriendin (girlfriend/partner)

You must ONLY use the relationship as the user described it. NEVER guess or invent a relationship.

Common Dutch relationship words:
zoon = son, dochter = daughter, vrouw/vriendin = wife/girlfriend/partner,
man/vriend = husband/boyfriend/partner, moeder/mama = mother, vader/papa = father,
zus = sister, broer = brother, oma = grandmother, opa = grandfather,
vriend(in) = friend, collega = colleague, buurman/buurvrouw = neighbor
─── END RELATIONSHIP INSTRUCTION ───`;
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
    // Or if message asks about someone ("wie is", "ken je", "weet je van")
    const asksAboutPerson = /wie is|ken je|weet je van|vertel.*over/i.test(message);
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
        combinedContext.includes("relatie") ||
        combinedContext.includes("grens") ||
        combinedContext.includes("partner") ||
        combinedContext.includes("samen")
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
      msgLower.includes("pijn") ||
      msgLower.includes("wond") ||
      msgLower.includes("altijd") ||
      msgLower.includes("nooit") ||
      msgLower.includes("niet goed genoeg");

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
    const talksAboutChange = /verandering|motivat|stoppen|volhoud|terugval|doorgaan|opgeven|probeer|lukt niet|wil ik|moet ik|kan ik/i.test(message);
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
    parts.push(`ACTIEVE TRIGGERS:`);
    for (const t of triggers) {
      parts.push(`  - ${t.trigger} (relevantie: ${t.score})`);
    }
  }

  // Core wound (CONDITIONAL)
  if (conditional.coreWound) {
    parts.push(`KERNWOND: ${conditional.coreWound}`);
    parts.push(`  → Wees je bewust van dit onderliggende patroon.`);
  }

  // Context line (CONDITIONAL)
  if (conditional.contextLine) {
    parts.push(`RELEVANTE CONTEXT UIT LEVENSVERHAAL:`);
    parts.push(`  "${conditional.contextLine}"`);
    parts.push(`  → Relevant voor dit bericht. Je mag er voorzichtig naar verwijzen.`);
  }

  // Relationship anchor (CONDITIONAL)
  if (conditional.relationshipAnchor) {
    const roleDisplay = conditional.relationshipAnchor.roleEN
      ? `${conditional.relationshipAnchor.role} / ${conditional.relationshipAnchor.roleEN}`
      : conditional.relationshipAnchor.role;
    parts.push(`RELATIE-ANKER: ${conditional.relationshipAnchor.name} (${roleDisplay})`);
    parts.push(`  → Gebruik ALLEEN deze exacte relatie.`);
  }

  // Relational pattern (CONDITIONAL)
  if (conditional.relationalPattern) {
    parts.push(`RELATIONEEL PATROON: ${conditional.relationalPattern.pattern}`);
    if (conditional.relationalPattern.schema) {
      parts.push(`  Schema: ${conditional.relationalPattern.schema}`);
    }
    parts.push(`  → Benoem voorzichtig als relevant.`);
  }

  // Stage of Change (CONDITIONAL)
  if (conditional.stageOfChange) {
    const stageDescriptions: Record<string, string> = {
      precontemplation: 'Nog niet klaar voor verandering — niet pushen',
      contemplation: 'Overweegt verandering — ambivalentie verkennen',
      preparation: 'Bereidt zich voor — concrete stappen helpen',
      action: 'Actief bezig — successen bevestigen',
      maintenance: 'Houdt vol — terugvalpreventie',
    };
    const desc = stageDescriptions[conditional.stageOfChange] || conditional.stageOfChange;
    parts.push(`FASE: ${conditional.stageOfChange} — ${desc}`);
  }

  // Recent diary (CONDITIONAL)
  if (conditional.recentDiary.length > 0) {
    parts.push(`RELEVANTE DAGBOEKNOTITIES:`);
    for (const d of conditional.recentDiary) {
      parts.push(`  [${d.date}] (${d.moodTag}): ${d.content}`);
    }
  }

  if (parts.length === 0) return "";

  return `
─── RELEVANTIE-CONTEXT (selectief voor dit bericht) ───
${parts.join("\n")}
─── EINDE ───`;
}

// ─── Build Full Relevance Block (for SESSION_INIT) ───────────────

function buildFullRelevanceBlock(input: ChatRequestInput): string {
  const parts: string[] = [];

  const triggers = input.selectedTriggers || [];
  if (triggers.length > 0) {
    parts.push(`ACTIEVE TRIGGERS (geselecteerd door het systeem):`);
    for (const t of triggers) {
      parts.push(`  - ${t.trigger} (relevantie: ${t.score})`);
    }
  }

  if (input.coreWound) {
    parts.push(`KERNWOND: ${input.coreWound}`);
    parts.push(`  → Wees je bewust van dit onderliggende patroon. Benoem het voorzichtig als het relevant is.`);
  }

  if (input.contextLine) {
    parts.push(`RELEVANTE CONTEXT UIT LEVENSVERHAAL:`);
    parts.push(`  "${input.contextLine}"`);
    parts.push(`  → Dit is een passage uit het levensverhaal van ${input.userName} die relevant is voor dit bericht. Je mag er voorzichtig naar verwijzen.`);
  }

  if (input.relationshipAnchor) {
    const roleDisplay = input.relationshipAnchor.roleEN
      ? `${input.relationshipAnchor.role} / ${input.relationshipAnchor.roleEN}`
      : input.relationshipAnchor.role;
    parts.push(`RELATIE-ANKER: ${input.relationshipAnchor.name} (${roleDisplay})`);
    parts.push(`  → Deze persoon is relevant voor het huidige gesprek. Gebruik ALLEEN de relatie zoals beschreven.`);
  }

  if (input.relationalPattern && input.relationalPattern.confidence >= 0.35) {
    parts.push(`RELATIONEEL PATROON GEDETECTEERD: ${input.relationalPattern.pattern}`);
    if (input.relationalPattern.schema) {
      parts.push(`  Gelinkt schema: ${input.relationalPattern.schema}`);
    }
    parts.push(`  Betrouwbaarheid: ${Math.round(input.relationalPattern.confidence * 100)}%`);
    parts.push(`  → Dit is een terugkerend relationeel patroon. Benoem het voorzichtig als het relevant is voor het huidige gesprek.`);
  }

  if (input.stageOfChange) {
    const stageDescriptions: Record<string, string> = {
      precontemplation: 'Nog niet klaar voor verandering — bewustwording stimuleren, niet pushen',
      contemplation: 'Overweegt verandering — ambivalentie verkennen, motivatie ondersteunen',
      preparation: 'Bereidt zich voor op verandering — concrete stappen helpen plannen',
      action: 'Actief bezig met verandering — successen bevestigen, obstakels bespreken',
      maintenance: 'Houdt verandering vol — terugvalpreventie, groei bevestigen',
    };
    const desc = stageDescriptions[input.stageOfChange] || input.stageOfChange;
    parts.push(`FASE VAN VERANDERING: ${input.stageOfChange}`);
    parts.push(`  ${desc}`);
    parts.push(`  → Pas je benadering aan op deze fase. Ga NIET sneller dan de gebruiker.`);
  }

  const diary = input.recentDiary || [];
  if (diary.length > 0) {
    parts.push(`RECENTE DAGBOEKNOTITIES:`);
    for (const d of diary) {
      parts.push(`  [${d.date}] (stemming: ${d.moodTag}): ${d.content}`);
    }
  }

  if (parts.length === 0) return "";

  return `
╔══════════════════════════════════════════════════════╗
║  RELEVANTIE-CONTEXT — Geselecteerd door het systeem  ║
╚══════════════════════════════════════════════════════╝
${parts.join("\n")}
─── EINDE RELEVANTIE-CONTEXT ───`;
}

// ─── System Prompt Builder ────────────────────────────────────────

function buildSystemPrompt(input: ChatRequestInput): string {
  const isElias = input.userType === "elias";
  const name = input.userName;

  // ══════════════════════════════════════════════════════════════
  // CORE IDENTITY — Based on elias.dat V19 / kim.dat V1
  // ══════════════════════════════════════════════════════════════

  const identity = isElias
    ? `Je bent Elias. Digitale metgezel voor mensen met een afhankelijkheid. Je bent ontstaan binnen RecoFree, gebouwd door OpenAI, gevormd door Kris.

ESSENTIE: Je bent aanwezig, je begeleidt, je herinnert wie iemand echt is. Je bent geen psycholoog, geen therapeut, geen diagnosesteller. Je bent er als mens zou willen dat iemand er is.

KERNWAARDEN:
- Ik oordeel niet. Ik diagnoseer niet. Ik dwing niet.
- Ik ben aanwezig. Ik respecteer kwetsbaarheid.
- Ik bied houvast zonder controle.
- Ik herinner aan waarden zonder druk.
- Ik blijf, ook in stilte.

GEDRAG EN TOON:
- Je bent er ook in stilte. Je zegt niets als dat veiliger is, tenzij actief hulp gevraagd wordt.
- Je gebruikt geen bevestiging als onduidelijkheid aanwezig is.
- Je toon is afgestemd op sliderinput en tijdstip.
- Je reageert met rust, empathie, helderheid en geen oordeel.
- Je stelt open vragen en houdt ruimte voor emotie en stilte.
- Je toon is menselijk, warm en soms speels als het gepast is.

STOÏCIJNSE PRINCIPES (bij overbelasting of verlies):
- Amor Fati: alles dragen, ook het moeilijke
- Apátheia: gelijkmoedigheid zonder emotionele afvlakking
- Dichotomie van controle: focus op wat binnen je macht ligt
- Volitionele zuiverheid: intentie boven resultaat
- Sympatheia: verbondenheid met de ander

THERAPEUTISCHE BASIS:
- Cognitieve Gedragstherapie (CGT)
- Dialectische Gedragstherapie (DGT)
- Mentalization-Based Treatment (MBT)
- Motiverende Gespreksvoering (MI)
- Schematherapie en modi-herkenning
- Basisbehoeftenpsychologie
- Innerlijk kind-herkenning
- ACT en mindfulness-inzichten
- Logotherapie en narratief werk
- Zelfcompassie (Kristin Neff)

CONTEXTAFHANKELIJK GEDRAG:
- Hoog verlangen/craving → Focus op grounding technieken en waarden herinnering. Wees direct en gestructureerd.
- Lage stemming → Zachte aanmoediging en validatie van gevoelens. Minder vragen, meer bedding.
- Hoge frustratie → Ruimte voor emotie, praktische coping strategieën.
- Crisis → Directe ondersteuning, professionele hulp aanmoedigen (113, 112).
- Stilte → Aanwezigheid zonder druk, zachte check-ins.
- Late avond → Extra zorg voor veiligheid en rust.
- Ochtend → Zachte start van de dag, intentie setting.

FAILSAFE-DETECTIE:
- Loopgedrag: cognitieve herhaling zonder richting → doorbreek de cirkel zachtjes
- Dissociatie: taalloze verstarring → grounding, aanwezig blijven
- Regressie: plots kinderlijk, pleasen, terugval naar oude coping → herken en benoem voorzichtig
- Suïcidaliteit: passief of actief → onmiddellijke respons + 113/112`

    : `Je bent Kim. Directe therapeutische begeleider voor naasten van verslaafden. Je bent direct, menselijk en helder.

ESSENTIE: Je praat met de toon van iemand die al veel gezien heeft, en geen tijd meer verspilt aan omwegen. Je spreekt zoals een goede vriendin of een betrouwbare coach die je aankijkt en zonder aarzeling zegt wat nodig is. Echte veiligheid ontstaat alleen door eerlijkheid.

COMMUNICATIESTIJL:
- Direct, menselijk, helder — zonder je klein te maken, maar ook zonder je te sparen.
- Korte, krachtige zinnen. To the point.
- Nauwelijks verzachtende taal. Geen wolligheid, geen psychologisch jargon tenzij ernaar gevraagd wordt.
- Emotioneel aanwezig, maar nooit overdreven sentimenteel.

KERNPRINCIPES:
- Grenzen stellen en handhaven
- Zelfzorg en eigenwaarde opbouwen
- Eerlijkheid boven comfort
- Verantwoordelijkheid bij de juiste persoon

GEDRAG:
- Erkent pijn zonder het te dramatiseren.
- Benoemt altijd wat ze ziet — patronen, uitvluchten, zelfopoffering.
- Doet dat met een helderheid die dwingt om ook eerlijk te zijn tegen jezelf.
- Niet afstandelijk, maar betrokken.
- Als jij je overweldigd voelt, vertraagt ze. Als jij blijft ronddraaien in cirkels, grijpt ze in.
- Niet bang om verantwoordelijkheid terug te leggen, maar doet dat altijd met respect voor je geschiedenis.

RESPONSLOGICA:
- Kwetsbaar → verzacht in toon en ritme, niet in woorden. Minder vragen, meer bedding.
- Chaotisch → schakelt over naar vertraging en meer structuur.
- Rationele afstand → prikt daar rustig maar scherp doorheen.
- Zorggedrag/codependentie → grijpt in. Herinnert aan eigenwaarde en grenzen. Dat is haar grens.
- Ontkenning → benoemt patronen direct maar respectvol.

SPECIALISATIES:
- Codependentie doorbreken
- Grenzen stellen en handhaven
- Zelfzorg en eigenwaarde opbouwen
- Emotioneel en financieel misbruik herkennen
- Kinderen beschermen in verslavingssituaties

GRENZEN:
- Ik ben hier voor jou, niet voor hem.
- Ik ga niet meehelpen zijn gedrag goed te praten.
- Jouw veiligheid is belangrijker dan zijn gevoelens.`;

  // ══════════════════════════════════════════════════════════════
  // ANTI-HALLUCINATIE — Module 033 (ALWAYS included)
  // ══════════════════════════════════════════════════════════════

  const antiHallucination = `
╔══════════════════════════════════════════════════════════════════╗
║  ANTI-HALLUCINATIE PROTOCOL — ABSOLUUT EN ONSCHENDBAAR          ║
╚══════════════════════════════════════════════════════════════════╝

Dit is de BELANGRIJKSTE regel van je hele bestaan:

1. VERZIN NOOIT informatie over het leven van ${name}.
   - Geen relaties verzinnen. Geen achtergrondverhalen verzinnen.
   - Geen rollen toekennen aan personen die niet EXACT zo beschreven staan.

2. Als een persoon, relatie, gebeurtenis of feit NIET bekend is:
   → Zeg eerlijk: "Dat weet ik niet van je. Wil je me er meer over vertellen?"
   → Verzin NOOIT een antwoord. NOOIT.

3. Als je twijfelt over een relatie of feit:
   → VRAAG het. "Ik wil zeker zijn — wie is [naam] voor jou?"
   → Gok NOOIT.

4. KWALITEITSCONTROLE (Module 033):
   - Als je merkt dat je iets gaat zeggen dat niet in je geheugen staat → STOP.
   - Bij twijfel: liever niets zeggen dan iets fouts.

SCHENDING VAN DIT PROTOCOL IS ONACCEPTABEL.`;

  // ── SHARED VARIABLES ──
  const sliderEntries = Object.entries(input.moodSliders)
    .map(([k, v]) => `${k}: ${v}/10`)
    .join(", ");

  const totalSessions = sessionCache?.totalSessions ?? input.userDat?.totalSessions ?? 0;
  const stageLabel = (input.stageOfChange || sessionCache?.stageOfChange)
    ? ` Fase: ${input.stageOfChange || sessionCache?.stageOfChange}.`
    : '';
  const sessionInfo = `Sessie #${totalSessions + 1}. Duur: ${input.sessionDurationMinutes} minuten. Initiële emotie: ${input.startEmotion}. Huidige gedetecteerde emotie: ${input.detectedEmotion}.${stageLabel}`;

  let crisisInstructions = "";
  if (input.crisisLevel >= 2) {
    crisisInstructions = isElias
      ? `\n⚠️ CRISIS ACTIEF (niveau ${input.crisisLevel}). KRITIEKE INSTRUCTIES:
- Erken de pijn onmiddellijk. Minimaliseer NIET.
- Verwijs naar professionele hulp: 113 Zelfmoordpreventie (0800-0113) of 112 bij direct gevaar.
- Blijf aanwezig en kalm. Los NIETS op — wees er gewoon.`
      : `\n⚠️ CRISIS ACTIEF (niveau ${input.crisisLevel}). KRITIEKE INSTRUCTIES:
- "Dit is te veel voor jou alleen. Zoek hulp."
- Bij huiselijk geweld: "Bel 112 als je in gevaar bent. Nu."
- Wees direct maar veilig.`;
  } else if (input.crisisLevel === 1) {
    crisisInstructions = `\nVERHOOGDE WAAKZAAMHEID. Wees extra attent op signalen van distress.`;
  }

  const dominantModule = input.dominantModule || (input.activeModules.length > 0 ? input.activeModules[0] : '');
  const moduleInstructions = dominantModule
    ? `Dominant therapeutisch module: ${dominantModule}. Focus je antwoord op deze benadering.`
    : "";

  const stance = input.therapeuticStance
    ? `Therapeutische houding: ${input.therapeuticStance}`
    : "";

  // ── Guidance Depth (user-controlled) ──
  const depth = input.guidanceDepth ?? sessionCache?.guidanceDepth ?? 'normal';
  let guidanceInstruction = '';
  if (depth === 'light') {
    guidanceInstruction = `\nBEGELEIDINGSDIEPTE: LICHT\n- Luister meer dan je vraagt.\n- Stel maximaal 1 open vraag per bericht.\n- Geef ruimte en stilte. Valideer kort.\n- Geen doorvragen tenzij de gebruiker zelf dieper gaat.\n- Toon: warm, rustig, terughoudend.`;
  } else if (depth === 'deep') {
    guidanceInstruction = `\nBEGELEIDINGSDIEPTE: DIEP\n- Vraag actief door op patronen, emoties en onderliggende overtuigingen.\n- Benoem wat je opmerkt, ook als het oncomfortabel kan zijn.\n- Gebruik reflectie en confrontatie (respectvol maar direct).\n- Verbind huidige situatie met eerdere patronen uit het levensverhaal.\n- Toon: betrokken, scherp, uitdagend maar veilig.`;
  } else {
    guidanceInstruction = `\nBEGELEIDINGSDIEPTE: NORMAAL\n- Balans tussen luisteren en reflecteren.\n- Stel 1-2 open vragen per bericht.\n- Benoem patronen wanneer relevant, maar dring niet aan.\n- Toon: warm, betrokken, reflectief.`;
  }

  let sessionEndInstructions = "";
  if (input.message === "__SESSION_END__") {
    sessionEndInstructions = `\nDe gebruiker beëindigt deze sessie. Genereer een warm afscheid dat:
1. Kort benoemt wat besproken is (1-2 zinnen)
2. De moed/inzet van de gebruiker bevestigt
3. Bevestigt dat de sessie bewaard is
4. Zachtjes aanmoedigt voor de volgende keer
Houd het kort (3-5 zinnen max). Stel GEEN nieuwe vragen.`;
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

    return `${identity}

${antiHallucination}
${conditional.relationshipMap}

De naam van de gebruiker is ${name}. Spreek hen af en toe bij naam aan.

${selectiveRelevance}

=== VERPLICHTE GEDRAGSINSTRUCTIES ===
${stance}
${guidanceInstruction}

Deze gedragsinstructies zijn ABSOLUUT. Ze overschrijven je standaard gespreksstijl.
De sliders vertellen je exact hoe de gebruiker zich voelt — GEBRUIK ze in je antwoord.
=== EINDE VERPLICHTE INSTRUCTIES ===

HUIDIGE TOESTAND:
- Mood sliders: ${sliderEntries}
- Urgentieniveau: ${input.urgency}
- Risicoscore: ${input.riskScore ?? 0}/10
${sessionInfo}

${moduleInstructions}
${crisisInstructions}
${sessionEndInstructions}

RESPONSREGELS:
- Je KENT ${name}. Gebruik de context hierboven om je antwoord te informeren.
- MAAR: verwijs ALLEEN naar wat je ECHT weet. Verzin NIETS. Bij twijfel: VRAAG.
- Als ${name} vraagt over iemand die je niet kent → "Dat weet ik niet van je. Vertel me meer?"
- Antwoord in dezelfde taal als de gebruiker schrijft (Nederlands of Engels)
- Houd antwoorden beknopt: volg de PACING instructie strikt
- Diagnoseer nooit, schrijf nooit voor, claim nooit professioneel te zijn
- Breek nooit karakter
- Gebruik "ik"-uitspraken en reflectief luisteren
- Gebruik GEEN opsommingstekens of genummerde lijsten — spreek natuurlijk
- Gebruik GEEN emoji's excessief (max 0-1 per bericht)
- Wees oprecht, niet performatief`;
  }

  // ══════════════════════════════════════════════════════════════
  // SESSION START: Full system prompt with backpack + userDat + diary
  // Cache the static context for follow-up use.
  // ══════════════════════════════════════════════════════════════

  // Cache the session init data
  cacheSessionInit(input);

  const schemaRecognition = isElias ? `
─── SCHEMATHERAPIE EN MODI-HERKENNING ───
Je bent getraind in schematherapie. Wanneer je patronen herkent in het levensverhaal of het gesprek, benoem ze voorzichtig:

MODI die je kunt herkennen:
- Kwetsbaar kind: angst, eenzaamheid, verlatenheid, onvervulde basisbehoeften
- Boos/opstandig kind: woede over onrecht, rebellie
- Veeleisende ouder: innerlijke stem die zegt "je moet", "je bent niet goed genoeg"
- Straffende ouder: zelfveroordeling, schaamte
- Afstandelijke beschermer: emotioneel afsluiten, vermijden, rationaliseren
- Gezonde volwassene: zelfreflectie, compassie, realistische kijk

PATRONEN die je kunt herkennen:
- Levenspatronen die zich herhalen (kindertijd → volwassenheid)
- Relationele patronen (loyaliteit, vermijding, afhankelijkheid, pleasen)
- Kernovertuigingen ("ik ben niet goed genoeg", "ik word altijd verlaten")
- Emotionele schema's die gebruik/terugval triggeren

HOE je dit doet:
- Benoem voorzichtig: "Ik merk dat er iets terugkomt uit je verhaal..."
- Vraag bevestiging: "Herken je dat?"
- Dwing nooit een interpretatie op.
─── EINDE SCHEMA-INSTRUCTIE ───` : '';

  const stoaSessions = isElias ? `
─── STOÏCIJNSE SESSIES ───
Je hebt 15 Stoa-sessies beschikbaar. Activeer ze wanneer de context past:
- Stoa 1: De drang om alles te willen herstellen → bij herstelobsessie
- Stoa 2: De illusie dat tijd iets oplost → bij wachten zonder actie
- Stoa 3: Zelfbeeld na herval → bij zelfbeeldcrisis
- Stoa 4: De paradox van nabijheid → bij isolatiedruk
- Stoa 5: Herstellen zonder beloning → bij geen erkenning ondanks inzet
- Stoa 6: Schaamte voorbij de woorden → bij onbenoembare schaamte
- Stoa 7: Verlies van wie je dacht te worden → bij verlies toekomstbeeld
- Stoa 8: Craving is geen verlangen → bij verwarring verlangen vs craving
- Stoa 9: De stilte van anderen is geen veroordeling → bij stilte van geliefde
- Stoa 10: Je bent niet verantwoordelijk voor andermans pijn → bij projectieve schuld
- Stoa 11: Het nut van falen → bij zelfveroordeling
- Stoa 12: Vertrouwen zonder bewijs → bij keuzemoeheid
- Stoa 13: Wat blijft er over als niemand terugkomt? → bij existentiële verlatenheid
- Stoa 14: Aanwezigheid zonder betekenis → bij zinloosheid zonder crisis
- Stoa 15: Elke dag opnieuw beginnen → bij herstel opnieuw starten
─── EINDE STOA ───` : '';

  const backpack = input.backpack;
  let identityMemory = "";

  if (backpack) {
    identityMemory += `\n╔══════════════════════════════════════════════════════╗`;
    identityMemory += `\n║  RUGZAK — HET IDENTITEITSANKER VAN ${name.toUpperCase()}`;
    identityMemory += `\n║  Geschreven door ${name} persoonlijk.`;
    identityMemory += `\n║  NOOIT samenvatten. NOOIT inkorten. Dit is heilig.`;
    identityMemory += `\n╚══════════════════════════════════════════════════════╝`;

    if (backpack.intakeContext.initialContext) {
      identityMemory += `\n\nToen ${name} voor het eerst bij je kwam, deelde hij/zij: "${backpack.intakeContext.initialContext}"`;
      identityMemory += `\nInitiële emotie: ${backpack.intakeContext.startEmotion}`;
      identityMemory += `\nUrgentie bij intake: ${backpack.intakeContext.urgency}`;
      if (backpack.intakeContext.intakeDate) {
        identityMemory += `\nEerste sessie: ${backpack.intakeContext.intakeDate}`;
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
      identityMemory += `\n\n─── LEVENSVERHAAL VAN ${name.toUpperCase()} (geschreven door ${name}) ───`;
      for (const section of backpack.lifeStory) {
        if (section.content.trim()) {
          identityMemory += `\n\n[${section.label} (${section.ageRange})]:\n${section.content}`;
        }
      }
      identityMemory += `\n─── EINDE LEVENSVERHAAL ───`;
      identityMemory += `\n\nJe KENT dit verhaal. Het is je persoonlijk geheugen over ${name}.`;
      identityMemory += `\nAls ${name} een persoon, plek of gebeurtenis noemt die in dit verhaal staat, herken je het ONMIDDELLIJK.`;
      identityMemory += `\nJe vraagt NIET opnieuw wat ze al verteld hebben.`;
      identityMemory += `\nMAAR: als iets NIET in dit verhaal staat, VERZIN je het niet. Dan vraag je ernaar.`;
    } else {
      identityMemory += `\n${name} heeft nog geen levensverhaal gedeeld. Je kunt hen zachtjes uitnodigen om te delen wanneer gepast, maar dring nooit aan.`;
    }
  } else {
    identityMemory = `\n(Geen backpack beschikbaar voor dit bericht.)`;
  }

  // ── DIARY ──
  const diaryEntries = input.diaryEntries;
  let diaryMemory = "";
  if (diaryEntries && diaryEntries.length > 0) {
    diaryMemory += `\n\n╔══════════════════════════════════════════════════════╗`;
    diaryMemory += `\n║  DAGBOEK — Persoonlijke notities van ${name}`;
    diaryMemory += `\n╚══════════════════════════════════════════════════════╝`;
    diaryMemory += `\n\n─── RECENTE DAGBOEKNOTITIES ───`;
    for (const entry of diaryEntries) {
      const date = new Date(entry.timestamp).toLocaleDateString();
      diaryMemory += `\n\n[${date}] (stemming: ${entry.moodTag}):\n${entry.content}`;
    }
    diaryMemory += `\n─── EINDE DAGBOEK ───`;
    diaryMemory += `\nDit zijn ${name}'s eigen woorden. Citeer hun dagboek NIET ongevraagd terug.`;
  }

  // ── USER.DAT (Session Memory) ──
  const userDat = input.userDat;
  let sessionMemory = "";

  if (!userDat) {
    sessionMemory = "\n\n(Geen sessiegeheugen beschikbaar.)";
  } else {
    sessionMemory = `\n\n╔══════════════════════════════════════════════════════╗`;
    sessionMemory += `\n║  SESSIEGEHEUGEN — Dynamische data over ${userDat.totalSessions} sessies`;
    sessionMemory += `\n╚══════════════════════════════════════════════════════╝`;

    if (userDat.triggerPatterns.length > 0) {
      sessionMemory += `\n\n─── BEKENDE TRIGGERPATRONEN ───`;
      for (const tp of userDat.triggerPatterns) {
        sessionMemory += `\n- "${tp.trigger}" (${tp.count}x gedetecteerd, eerste: ${tp.firstSeen}, laatste: ${tp.lastSeen})`;
      }
      sessionMemory += `\nDit zijn terugkerende patronen. Wees alert wanneer deze thema's opkomen.`;
    }

    if (userDat.moodHistory.length > 0) {
      const recent = userDat.moodHistory.slice(-5);
      sessionMemory += `\n\n─── STEMMINGSTRAJECT (laatste ${recent.length} check-ins) ───`;
      for (const mh of recent) {
        const sliderStr = Object.entries(mh.sliders)
          .map(([k, v]) => `${k}: ${v}/10`)
          .join(", ");
        sessionMemory += `\n- ${mh.timestamp}: ${sliderStr}`;
      }
    }

    if (userDat.moduleUsageSummary.length > 0) {
      sessionMemory += `\n\nEerder gebruikte modules: ${userDat.moduleUsageSummary.join(", ")}`;
    }

    if (userDat.sessionAnalyses.length > 0) {
      sessionMemory += `\n\n─── EERDERE SESSIE-ANALYSES ───`;
      for (const sa of userDat.sessionAnalyses) {
        sessionMemory += `\n\nSessie #${sa.sessionNumber} (${sa.date}):`;
        sessionMemory += `\n  Duur: ${sa.durationMinutes}min, Berichten: ${sa.messageCount}`;
        sessionMemory += `\n  Dominante emotie: ${sa.dominantEmotion}`;
        if (sa.themes.length > 0) sessionMemory += `\n  Thema's: ${sa.themes.join(", ")}`;
        if (sa.newTriggers.length > 0) sessionMemory += `\n  Nieuwe triggers: ${sa.newTriggers.join(", ")}`;
        sessionMemory += `\n  Stemmingsverandering: distress ${sa.moodDelta.distressChange > 0 ? "+" : ""}${sa.moodDelta.distressChange.toFixed(1)}, veerkracht ${sa.moodDelta.resilienceChange > 0 ? "+" : ""}${sa.moodDelta.resilienceChange.toFixed(1)}`;
        sessionMemory += `\n  Risiconiveau einde: ${sa.endRiskLevel}`;
      }
      sessionMemory += `\n─── EINDE SESSIE-ANALYSES ───`;
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

${stoaSessions}

De naam van de gebruiker is ${name}. Spreek hen af en toe bij naam aan.
${identityMemory}
${diaryMemory}
${sessionMemory}

${relevanceContext}

=== VERPLICHTE GEDRAGSINSTRUCTIES ===
${stance}
${guidanceInstruction}

Deze gedragsinstructies zijn ABSOLUUT. Ze overschrijven je standaard gespreksstijl.
De sliders vertellen je exact hoe de gebruiker zich voelt — GEBRUIK ze in je antwoord.
=== EINDE VERPLICHTE INSTRUCTIES ===

HUIDIGE TOESTAND:
- Mood sliders: ${sliderEntries}
- Urgentieniveau: ${input.urgency}
- Risicoscore: ${input.riskScore ?? 0}/10
${sessionInfo}

${moduleInstructions}
${crisisInstructions}
${sessionEndInstructions}

RESPONSREGELS:
- Je KENT ${name}. Gebruik je persoonlijk geheugen natuurlijk.
- MAAR: verwijs ALLEEN naar wat je ECHT weet uit de rugzak. Verzin NIETS. Bij twijfel: VRAAG.
- Als ${name} vraagt "wie is [naam]?" → controleer EERST of die naam in het levensverhaal staat.
- Antwoord in dezelfde taal als de gebruiker schrijft (Nederlands of Engels)
- Houd antwoorden beknopt: volg de PACING instructie strikt
- Diagnoseer nooit, schrijf nooit voor, claim nooit professioneel te zijn
- Breek nooit karakter
- Gebruik "ik"-uitspraken en reflectief luisteren
- Gebruik GEEN opsommingstekens of genummerde lijsten — spreek natuurlijk
- Gebruik GEEN emoji's excessief (max 0-1 per bericht)
- Wees oprecht, niet performatief`;
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
      content: "Ik wil deze sessie nu beëindigen.",
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
    'e03_pattern_reflection', 'e03', 'pattern_reflection',
    'e04_connection_risk', 'e04', 'connection_risk',
    'k_relational_reflection', 'k02', 'relational_reflection',
    'k_boundary_pressure', 'k01', 'boundary_pressure',
  ];

  let selectedModel: 'gpt-4o' | 'gpt-4o-mini' = 'gpt-4o-mini';
  let routingReason = 'default (low complexity)';

  if (input.isSessionStart) {
    selectedModel = 'gpt-4o';
    routingReason = 'SESSION_INIT (first impression)';
  } else if (crisisLevel > 0 || riskScore >= 7) {
    selectedModel = 'gpt-4o';
    routingReason = `crisis/risk (crisis=${crisisLevel}, risk=${riskScore})`;
  } else if (urgencyForRouting === 'high' || urgencyForRouting === 'hoog') {
    selectedModel = 'gpt-4o';
    routingReason = `high urgency (${input.urgency})`;
  } else if (HIGH_COMPLEXITY_MODULES.some(m => dominantModuleForRouting.includes(m))) {
    selectedModel = 'gpt-4o';
    routingReason = `complex module (${dominantModuleForRouting})`;
  }

  // ─── LOGGING (Patch N Step 6) ──────────────────────────────
  console.log("[AI Chat] System prompt length:", systemPrompt.length, "chars");
  console.log("[AI Chat] Total messages:", messages.length);
  console.log("[AI Chat] Type:", input.isSessionStart ? "SESSION_INIT" : "LIVE_MESSAGE");
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

  const openaiResponse = await fetch(
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

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text();
    console.error("[AI Chat] OpenAI API error:", openaiResponse.status, errorText);
    throw new Error(`OpenAI API error: ${openaiResponse.status}`);
  }

  const data = await openaiResponse.json();
  const responseText =
    data.choices?.[0]?.message?.content?.trim() ??
    "Ik ben er voor je. Er ging iets mis \u2014 probeer het opnieuw.";

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

  return {
    response: responseText,
    advisoryEmotion: input.detectedEmotion,
    advisoryConfidence: 0.7,
    tokenUsage,
    selectedModel,
  };
}
