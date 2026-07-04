/**
 * context.dat Distiller — LOCAL MODULE
 *
 * Purpose: Build a temporary, in-memory distilled context from the existing
 * encrypted memory layers. Reduces the first-turn GPT payload from ~16k tokens
 * to ~2-3k tokens.
 *
 * context.dat is NOT persisted or encrypted — it's a one-time distillation
 * built at the first user message after the greeting. The raw layers remain
 * the source of truth.
 *
 * Sources:
 * - backpack (lifeStory sections, kimBackpack) → key figures
 * - userDat (schemaTendencies, modeTendencies, triggerPatterns) → schemas, modes
 * - state.dat (moodHistory) → 7-day trend
 * - logs.dat (sessions) → last 3 session summaries
 * - projections.dat (fears, hopes) → top 2 active projections
 *
 * All extraction is deterministic — no GPT calls.
 */

import type { Backpack, UserDat, DiaryEntry } from '../ai/types';
import type { LogsDatPlaintext, SessionLogSummary } from '../types/memory/logsDat.types';
import type { StateDat, MoodHistoryRecord } from '../types/memory/stateDat.types';
import type { ProjectionsDat, ProjectionRecord } from '../types/memory/projectionsDat.types';
import type { UserDat as UserDatMemoryLayer } from '../types/memory/userDat.types';

// ─── Output Type ──────────────────────────────────────────────

export interface ContextDat {
  /** Key figures: persons with emotional role/meaning (max 7) */
  keyFigures: KeyFigure[];
  /** Top schemas by confidence (max 5) */
  schemas: SchemaEntry[];
  /** Top modes by confidence (max 5) */
  modes: ModeEntry[];
  /** 7-day mood trend per dimension */
  sevenDayTrend: TrendEntry[];
  /** Last 3 session summaries (newest first) */
  sessionSummaries: SessionSummaryCompact[];
  /** Active projections — top 2 by score (fears + hopes combined) */
  activeProjections: ProjectionCompact[];
  /** Intake context (compact) */
  intakeContext: string;
  /** User name */
  userName: string;
  /** Persona */
  persona: 'elias' | 'kim';
  /** Estimated token count of this distilled context */
  estimatedTokens: number;
}

export interface KeyFigure {
  name: string;
  role: string;
  emotionalWeight: string; // e.g. "conflictueus", "steunend", "afwezig"
  lastMentioned: string; // ISO date
}

export interface SchemaEntry {
  schemaId: string;
  schemaName: string;
  confidence: number;
  domain?: string;
}

export interface ModeEntry {
  modeId: string;
  modeName: string;
  confidence: number;
}

export interface TrendEntry {
  dimension: string;
  direction: 'rising' | 'falling' | 'stable';
  currentValue: number;
  deltaPercent: number;
}

export interface SessionSummaryCompact {
  date: string;
  topics: string[];
  emotionalThemes: string[];
  openEndpoints: string[];
  narrative: string; // max 100 words
}

export interface ProjectionCompact {
  kind: 'fear' | 'hope';
  label: string;
  score: number;
  category: string;
}

// ─── Distiller ────────────────────────────────────────────────

export interface DistillerInput {
  backpack: Backpack;
  userDat: UserDat;
  logsDat: LogsDatPlaintext | null;
  stateDat: StateDat | null;
  projectionsDat: ProjectionsDat | null;
  userDatMemory: UserDatMemoryLayer | null;
  diaryEntries: DiaryEntry[];
}

/**
 * Build context.dat from the raw layers. Fully deterministic, no GPT.
 * Handles missing/empty layers gracefully (new user scenario).
 */
export function distillContextDat(input: DistillerInput): ContextDat {
  const { backpack, userDat, logsDat, stateDat, projectionsDat, userDatMemory, diaryEntries } = input;

  const userName = backpack.naam || userDat.naam || 'gebruiker';
  const persona = (backpack.userType || 'elias') as 'elias' | 'kim';

  // ── 1. Key Figures (max 7) ──
  const keyFigures = extractKeyFigures(backpack, userDat, logsDat, diaryEntries);

  // ── 2. Schemas (max 5, by confidence) ──
  const schemas = extractSchemas(userDat, userDatMemory);

  // ── 3. Modes (max 5, by confidence) ──
  const modes = extractModes(userDat, userDatMemory);

  // ── 4. 7-day trend ──
  const sevenDayTrend = extractSevenDayTrend(stateDat);

  // ── 5. Last 3 session summaries ──
  const sessionSummaries = extractSessionSummaries(logsDat);

  // ── 6. Active projections (top 2) ──
  const activeProjections = extractActiveProjections(projectionsDat);

  // ── 7. Intake context (compact) ──
  const intakeContext = buildCompactIntakeContext(backpack);

  const result: ContextDat = {
    keyFigures,
    schemas,
    modes,
    sevenDayTrend,
    sessionSummaries,
    activeProjections,
    intakeContext,
    userName,
    persona,
    estimatedTokens: 0,
  };

  // Estimate tokens (~4 chars per token for Dutch/English mixed text)
  result.estimatedTokens = Math.ceil(JSON.stringify(result).length / 4);

  return result;
}

// ─── Key Figures Extraction ───────────────────────────────────

function extractKeyFigures(
  backpack: Backpack,
  userDat: UserDat,
  logsDat: LogsDatPlaintext | null,
  diaryEntries: DiaryEntry[],
): KeyFigure[] {
  const figureMap = new Map<string, KeyFigure>();

  // From relationalAnchors in userDat (most reliable source)
  if (userDat.relationalAnchors) {
    for (const anchor of userDat.relationalAnchors) {
      const key = anchor.name.toLowerCase().trim();
      if (!key) continue;
      figureMap.set(key, {
        name: anchor.name,
        role: anchor.role || anchor.roleEN || 'onbekend',
        emotionalWeight: anchor.emotionalWeight > 0.7 ? 'zwaar' : anchor.emotionalWeight > 0.4 ? 'gemiddeld' : 'licht',
        lastMentioned: userDat.lastSessionDate || new Date().toISOString(),
      });
    }
  }

  // From backpack lifeStory sections — extract names mentioned
  if (backpack.sections) {
    for (const section of backpack.sections) {
      const names = extractNamesFromText(section.content);
      for (const name of names) {
        const key = name.toLowerCase().trim();
        if (figureMap.has(key)) continue; // relationalAnchors take priority
        figureMap.set(key, {
          name,
          role: inferRoleFromContext(name, section.content),
          emotionalWeight: 'onbekend',
          lastMentioned: backpack.createdAt || new Date().toISOString(),
        });
      }
    }
  }

  // From Kim backpack
  if (backpack.kimBackpack) {
    const kimTexts = [
      backpack.kimBackpack.the_relationship || '',
      backpack.kimBackpack.the_impact || '',
    ].join(' ');
    const names = extractNamesFromText(kimTexts);
    for (const name of names) {
      const key = name.toLowerCase().trim();
      if (figureMap.has(key)) continue;
      figureMap.set(key, {
        name,
        role: 'betrokkene',
        emotionalWeight: 'zwaar',
        lastMentioned: backpack.createdAt || new Date().toISOString(),
      });
    }
  }

  // From logs.dat — recent sessions mention persons
  if (logsDat?.sessions) {
    const recentSessions = logsDat.sessions.slice(-5);
    for (const session of recentSessions) {
      // Extract names from session narrative and topics
      const sessionText = [session.compressedNarrative || '', ...(session.discussedTopics || [])].join(' ');
      const sessionNames = extractNamesFromText(sessionText);
      for (const name of sessionNames) {
        const key = name.toLowerCase().trim();
        if (!key || figureMap.has(key)) continue;
        figureMap.set(key, {
          name,
          role: inferRoleFromContext(name, sessionText),
          emotionalWeight: 'onbekend',
          lastMentioned: session.endedAt || session.startedAt,
        });
      }
    }
  }

  // Sort by recency + emotional weight, take max 7
  const sorted = [...figureMap.values()].sort((a, b) => {
    const weightOrder: Record<string, number> = { zwaar: 3, gemiddeld: 2, licht: 1, onbekend: 0 };
    const wA = weightOrder[a.emotionalWeight] || 0;
    const wB = weightOrder[b.emotionalWeight] || 0;
    if (wB !== wA) return wB - wA;
    return new Date(b.lastMentioned).getTime() - new Date(a.lastMentioned).getTime();
  });

  return sorted.slice(0, 7);
}

/** Simple name extraction — looks for capitalized words that appear to be names */
function extractNamesFromText(text: string): string[] {
  if (!text) return [];
  // Match capitalized words that are likely names (2+ chars, not at sentence start after period)
  const matches = text.match(/(?<=[,\s])[A-Z][a-zà-ÿ]{1,20}(?=[\s,.])/g) || [];
  // Filter common Dutch/English non-name words
  const nonNames = new Set([
    'Het', 'De', 'Een', 'Dit', 'Dat', 'Die', 'Deze', 'Mijn', 'Zijn', 'Haar',
    'The', 'This', 'That', 'When', 'Then', 'But', 'And', 'For', 'With',
    'Ik', 'Hij', 'Zij', 'Wij', 'Als', 'Maar', 'Want', 'Dus', 'Nog',
    'RecoFree', 'Elias', 'Kim', 'Nederland', 'België', 'France',
  ]);
  return [...new Set(matches.filter(m => !nonNames.has(m)))].slice(0, 10);
}

/** Infer role from surrounding text context */
function inferRoleFromContext(name: string, text: string): string {
  const lower = text.toLowerCase();
  const nameIdx = lower.indexOf(name.toLowerCase());
  if (nameIdx === -1) return 'onbekend';
  const surrounding = lower.slice(Math.max(0, nameIdx - 80), nameIdx + name.length + 80);

  if (/partner|man|vrouw|vriend|relatie|samenwon/i.test(surrounding)) return 'partner';
  if (/moeder|vader|ouder|mama|papa/i.test(surrounding)) return 'ouder';
  if (/broer|zus|familie/i.test(surrounding)) return 'familie';
  if (/therapeut|behandelaar|psycholoog|arts|huisarts/i.test(surrounding)) return 'behandelaar';
  if (/kind|zoon|dochter/i.test(surrounding)) return 'kind';
  if (/vriend|vriendin|collega/i.test(surrounding)) return 'vriend';
  if (/baas|werk|manager/i.test(surrounding)) return 'werk';
  return 'betrokkene';
}

// ─── Schema & Mode Extraction ─────────────────────────────────

function extractSchemas(userDat: UserDat, userDatMemory: UserDatMemoryLayer | null): SchemaEntry[] {
  // Prefer memory-layer schemaTendencies (more structured)
  // FIX: Use length-guard — empty array [] is truthy, so || won't fall through.
  // If memory-layer has data, use it; otherwise fall back to pipeline userDat.
  const memorySource = userDatMemory?.schemaTendencies;
  const pipelineSource = userDat.schemaTendencies;
  const source = (memorySource && memorySource.length > 0) ? memorySource
    : (pipelineSource && pipelineSource.length > 0) ? pipelineSource
    : [];
  if (source.length === 0) return [];

  return source
    .filter((s: any) => (s.confidence ?? s.confidenceAverage ?? 0) >= 0.3)
    .sort((a: any, b: any) => (b.confidence ?? b.confidenceAverage ?? 0) - (a.confidence ?? a.confidenceAverage ?? 0))
    .slice(0, 5)
    .map((s: any) => ({
      schemaId: s.schemaId,
      schemaName: s.schemaName || s.schemaId,
      confidence: s.confidence ?? s.confidenceAverage ?? 0,
      domain: s.domain,
    }));
}

function extractModes(userDat: UserDat, userDatMemory: UserDatMemoryLayer | null): ModeEntry[] {
  // FIX: Same length-guard as extractSchemas — empty [] won't block fallback.
  const memorySource = userDatMemory?.modeTendencies;
  const pipelineSource = userDat.modeTendencies;
  const source = (memorySource && memorySource.length > 0) ? memorySource
    : (pipelineSource && pipelineSource.length > 0) ? pipelineSource
    : [];
  if (source.length === 0) return [];

  return source
    .filter((m: any) => (m.confidence ?? m.confidenceAverage ?? 0) >= 0.3)
    .sort((a: any, b: any) => (b.confidence ?? b.confidenceAverage ?? 0) - (a.confidence ?? a.confidenceAverage ?? 0))
    .slice(0, 5)
    .map((m: any) => ({
      modeId: m.modeId,
      modeName: m.modeName || m.modeId,
      confidence: m.confidence ?? m.confidenceAverage ?? 0,
    }));
}

// ─── 7-Day Trend ──────────────────────────────────────────────

function extractSevenDayTrend(stateDat: StateDat | null): TrendEntry[] {
  // FIX: If stateDat is null or its moodHistory is empty, return early.
  // The stateDat store may return an empty object if the memory-layer key
  // wasn't registered with SessionMemoryCache.
  if (!stateDat?.moodHistory || stateDat.moodHistory.length === 0) return [];

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Filter to last 7 days
  const recent = stateDat.moodHistory.filter(
    (r: MoodHistoryRecord) => new Date(r.timestampIso).getTime() >= sevenDaysAgo
  );

  if (recent.length < 2) {
    // Not enough data for a trend — return current values as stable
    const latest = stateDat.moodHistory[stateDat.moodHistory.length - 1];
    return buildTrendFromSingle(latest);
  }

  // Split into first half and second half for direction
  const midpoint = Math.floor(recent.length / 2);
  const firstHalf = recent.slice(0, midpoint);
  const secondHalf = recent.slice(midpoint);

  const dimensions = ['craving', 'frustration', 'despondency', 'focus', 'stress', 'boundaryFatigue', 'emotionalBurden', 'selfCare'] as const;
  const trends: TrendEntry[] = [];

  for (const dim of dimensions) {
    const firstAvg = average(firstHalf.map((r: any) => r[dim]).filter((v: any) => v != null));
    const secondAvg = average(secondHalf.map((r: any) => r[dim]).filter((v: any) => v != null));

    if (firstAvg === null || secondAvg === null) continue;

    const delta = secondAvg - firstAvg;
    const deltaPercent = firstAvg !== 0 ? Math.round((delta / firstAvg) * 100) : 0;
    const direction: TrendEntry['direction'] = Math.abs(deltaPercent) < 10 ? 'stable' : delta > 0 ? 'rising' : 'falling';

    trends.push({
      dimension: dim,
      direction,
      currentValue: Math.round(secondAvg * 10) / 10,
      deltaPercent,
    });
  }

  return trends;
}

function buildTrendFromSingle(record: MoodHistoryRecord): TrendEntry[] {
  const dimensions = ['craving', 'frustration', 'despondency', 'focus', 'stress', 'boundaryFatigue', 'emotionalBurden', 'selfCare'] as const;
  const trends: TrendEntry[] = [];
  for (const dim of dimensions) {
    const val = (record as any)[dim];
    if (val == null) continue;
    trends.push({ dimension: dim, direction: 'stable', currentValue: val, deltaPercent: 0 });
  }
  return trends;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ─── Session Summaries ────────────────────────────────────────

function extractSessionSummaries(logsDat: LogsDatPlaintext | null): SessionSummaryCompact[] {
  if (!logsDat?.sessions || logsDat.sessions.length === 0) return [];

  // Take last 3, newest first
  const recent = logsDat.sessions.slice(-3).reverse();

  return recent.map((session: SessionLogSummary) => ({
    date: session.endedAt || session.startedAt,
    topics: (session.discussedTopics || []).slice(0, 5),
    emotionalThemes: (session.emotionalThemes || []).map(t => t.label).slice(0, 3),
    openEndpoints: (session.openEndpoints || []).map(e => e.label).slice(0, 3),
    narrative: truncateNarrative(session.compressedNarrative, 100),
  }));
}

/** Truncate narrative to ~100 words at word boundary */
function truncateNarrative(text: string | undefined, maxWords: number): string {
  if (!text) return '';
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '…';
}

// ─── Active Projections ───────────────────────────────────────

function extractActiveProjections(projectionsDat: ProjectionsDat | null): ProjectionCompact[] {
  if (!projectionsDat) return [];

  const all: (ProjectionRecord & { kind: 'fear' | 'hope' })[] = [
    ...(projectionsDat.fears || []).map(f => ({ ...f, kind: 'fear' as const })),
    ...(projectionsDat.hopes || []).map(h => ({ ...h, kind: 'hope' as const })),
  ];

  // Sort by currentScore descending, take top 2
  return all
    .filter(p => p.currentScore > 0.2)
    .sort((a, b) => b.currentScore - a.currentScore)
    .slice(0, 2)
    .map(p => ({
      kind: p.kind,
      label: p.label,
      score: Math.round(p.currentScore * 100) / 100,
      category: p.category,
    }));
}

// ─── Intake Context ───────────────────────────────────────────

function buildCompactIntakeContext(backpack: Backpack): string {
  const parts: string[] = [];
  const ic = backpack.intakeContext;
  if (ic) {
    if (ic.stageOfChange) parts.push(`stage: ${ic.stageOfChange}`);
    if (ic.startEmotion) parts.push(`startemotion: ${ic.startEmotion}`);
    if (ic.urgency) parts.push(`urgentie: ${ic.urgency}`);
    if (ic.initialContext) {
      // Truncate to 50 words
      const words = ic.initialContext.split(/\s+/);
      const truncated = words.length > 50 ? words.slice(0, 50).join(' ') + '…' : ic.initialContext;
      parts.push(`context: ${truncated}`);
    }
  }
  return parts.join(' | ');
}

// ─── Serializer (for GPT payload injection) ───────────────────

/**
 * Serialize context.dat into a compact text block for GPT system prompt injection.
 * Designed to be ~2000-3000 tokens.
 */
export function serializeContextDatForGPT(ctx: ContextDat): string {
  const lines: string[] = [];

  lines.push(`[CONTEXT: ${ctx.userName} (${ctx.persona})]`);
  lines.push(`Intake: ${ctx.intakeContext || 'geen'}`);
  lines.push('');

  // Key figures
  if (ctx.keyFigures.length > 0) {
    lines.push('[KEY FIGURES]');
    for (const kf of ctx.keyFigures) {
      lines.push(`- ${kf.name} (${kf.role}, gewicht: ${kf.emotionalWeight})`);
    }
    lines.push('');
  }

  // Schemas
  if (ctx.schemas.length > 0) {
    lines.push('[SCHEMAS]');
    for (const s of ctx.schemas) {
      lines.push(`- ${s.schemaName}${s.domain ? ` [${s.domain}]` : ''} (conf: ${(s.confidence * 100).toFixed(0)}%)`);
    }
    lines.push('');
  }

  // Modes
  if (ctx.modes.length > 0) {
    lines.push('[MODES]');
    for (const m of ctx.modes) {
      lines.push(`- ${m.modeName} (conf: ${(m.confidence * 100).toFixed(0)}%)`);
    }
    lines.push('');
  }

  // 7-day trend
  if (ctx.sevenDayTrend.length > 0) {
    lines.push('[7-DAY TREND]');
    for (const t of ctx.sevenDayTrend) {
      const arrow = t.direction === 'rising' ? '↑' : t.direction === 'falling' ? '↓' : '→';
      lines.push(`- ${t.dimension}: ${t.currentValue} ${arrow} (${t.deltaPercent > 0 ? '+' : ''}${t.deltaPercent}%)`);
    }
    lines.push('');
  }

  // Session summaries
  if (ctx.sessionSummaries.length > 0) {
    lines.push('[LAST SESSIONS]');
    for (let i = 0; i < ctx.sessionSummaries.length; i++) {
      const ss = ctx.sessionSummaries[i];
      lines.push(`Session ${i + 1} (${ss.date.split('T')[0]}):`);
      if (ss.narrative) lines.push(`  ${ss.narrative}`);
      if (ss.topics.length > 0) lines.push(`  Topics: ${ss.topics.join(', ')}`);
      if (ss.openEndpoints.length > 0) lines.push(`  Open: ${ss.openEndpoints.join(', ')}`);
    }
    lines.push('');
  }

  // Active projections
  if (ctx.activeProjections.length > 0) {
    lines.push('[ACTIVE PROJECTIONS]');
    for (const p of ctx.activeProjections) {
      lines.push(`- ${p.kind === 'fear' ? 'ANGST' : 'HOOP'}: ${p.label} (${p.category}, score: ${p.score})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
