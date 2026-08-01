/**
 * DIST01 — Context Injector
 *
 * Builds a compact, serialized context block from the Distillation Store
 * for injection into the GPT system prompt.
 *
 * This gives the AI "memory" of persons, patterns, and life context
 * that the user has shared across sessions — enabling continuity like:
 * "Hoe gaat het met Melissa?" or "Je had het vorige keer over je nachtdiensten."
 *
 * Design principles:
 * - Token-efficient: max ~300 tokens for the injected block
 * - Relevance-sorted: most recent and most mentioned first
 * - Suppression-aware: never includes user-suppressed items
 * - Decay-aware: older contexts have lower relevance
 */
import type {
  DistillationStoreData,
  DistilledEntity,
  DistilledSignal,
  DistilledContext,
  DistillationContextForChat,
} from './dist01-types';

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_PERSONS_IN_CONTEXT = 7;
const MAX_CONTEXTS_IN_PROMPT = 5;
const MAX_SIGNALS_IN_PROMPT = 5;
const DECAY_HALF_LIFE_DAYS = 14; // Relevance halves every 14 days

// ─── Main Function ─────────────────────────────────────────────────────────

/**
 * Build the distillation context for chat injection.
 * Returns both structured data and a serialized text block for the GPT prompt.
 */
export function buildDistillationContext(
  store: DistillationStoreData,
  currentSessionId?: string,
): DistillationContextForChat {
  const now = Date.now();

  // ── 1. Persons (sorted by mention count × recency) ──────────────────
  const knownPersons = store.entities
    .filter((e) => e.entityType === 'person' && !e.suppressedByUser)
    .map((e) => ({
      name: e.name,
      relation: e.relation,
      valence: e.valence,
      lastMentionedAt: e.lastMentionedAt,
      mentionCount: e.mentionCount,
      // Score: mentionCount × recency factor
      _score: e.mentionCount * computeRecencyFactor(e.lastMentionedAt, now),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, MAX_PERSONS_IN_CONTEXT)
    .map(({ _score, ...rest }) => rest);

  // ── 2. Context items (sorted by relevance × recency) ────────────────
  const recentContext = store.contexts
    .map((c) => ({
      summary: c.summary,
      contextType: c.contextType,
      relevance: c.relevanceDecay * computeRecencyFactor(c.lastMentionedAt, now),
    }))
    .filter((c) => c.relevance > 0.1)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, MAX_CONTEXTS_IN_PROMPT);

  // ── 3. Active signals (high confidence, not suppressed) ─────────────
  const activeSignals = store.signals
    .filter((s) =>
      s.confidence === 'high' &&
      !s.suppressedByUser &&
      s.promotionStatus === 'in_store'
    )
    .sort((a, b) => b.detectionCount - a.detectionCount)
    .slice(0, MAX_SIGNALS_IN_PROMPT)
    .map((s) => ({
      normalizedText: s.normalizedText,
      signalType: s.signalType,
      detectionCount: s.detectionCount,
    }));

  // ── 4. Serialize for prompt ─────────────────────────────────────────
  const serializedForPrompt = serializeForPrompt(knownPersons, recentContext, activeSignals);

  return {
    knownPersons,
    recentContext,
    activeSignals,
    serializedForPrompt,
  };
}

// ─── Serialization ─────────────────────────────────────────────────────────

function serializeForPrompt(
  persons: DistillationContextForChat['knownPersons'],
  contexts: DistillationContextForChat['recentContext'],
  signals: DistillationContextForChat['activeSignals'],
): string {
  // If nothing to inject, return empty
  if (persons.length === 0 && contexts.length === 0 && signals.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('[DIST01 — Gekende context uit eerdere gesprekken]');

  // Persons block
  if (persons.length > 0) {
    lines.push('Personen:');
    for (const p of persons) {
      const relPart = p.relation ? ` (${p.relation})` : '';
      const valencePart = p.valence !== 'neutral' ? ` [${valenceLabel(p.valence)}]` : '';
      lines.push(`• ${p.name}${relPart}${valencePart}`);
    }
  }

  // Context block
  if (contexts.length > 0) {
    lines.push('Levenssituatie:');
    for (const c of contexts) {
      lines.push(`• ${c.summary}`);
    }
  }

  // Signals block (only high-value ones)
  if (signals.length > 0) {
    lines.push('Gedetecteerde patronen:');
    for (const s of signals) {
      lines.push(`• ${s.normalizedText} (${s.detectionCount}×)`);
    }
  }

  lines.push('[/DIST01]');
  return lines.join('\n');
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function computeRecencyFactor(isoDate: string, nowMs: number): number {
  const ageMs = nowMs - new Date(isoDate).getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  // Exponential decay with half-life of DECAY_HALF_LIFE_DAYS
  return Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);
}

function valenceLabel(valence: 'positive' | 'negative' | 'ambivalent' | 'neutral'): string {
  switch (valence) {
    case 'positive': return 'steunend';
    case 'negative': return 'belastend';
    case 'ambivalent': return 'ambivalent';
    default: return '';
  }
}

/**
 * Check if the distillation store has any meaningful content to inject.
 * Used to skip injection when store is empty (new users).
 */
export function hasDistillationContent(store: DistillationStoreData): boolean {
  return (
    store.entities.some((e) => !e.suppressedByUser) ||
    store.contexts.length > 0 ||
    store.signals.some((s) => s.confidence === 'high' && !s.suppressedByUser)
  );
}
