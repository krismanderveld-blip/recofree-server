/**
 * Past-Reference Search — Searches logs.dat + user.dat for a given topic/term.
 *
 * Used by the per-message pipeline when the user references something from the past.
 * Returns matched context from both sources (parallel search, not sequential).
 *
 * Search targets:
 * - logs.dat: discussedTopics, compressedNarrative, emotionalThemes, openEndpoints
 * - user.dat: triggerPatterns, schemaTendencies, modeTendencies, relationalAnchors, sessionAnalyses
 */
import type { SessionLogSummary } from "@/lib/types/memory/logsDat.types";
import type { UserDat } from "@/lib/ai/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PastReferenceMatch {
  source: "logs.dat" | "user.dat";
  category: string;
  content: string;
  /** ISO timestamp of the matched entry (for recency ranking) */
  timestamp: string | null;
  /** 0-1 relevance score based on match quality */
  relevance: number;
}

export interface PastReferenceSearchResult {
  query: string;
  found: boolean;
  matches: PastReferenceMatch[];
  /** Summary string for GPT injection (max ~300 tokens) */
  contextForGPT: string;
}

// ─── Core Search Function ───────────────────────────────────────────────────

/**
 * Search logs.dat sessions + user.dat for references to a given topic.
 * Both sources are searched in parallel (Promise.all).
 * Returns sorted matches (most relevant first) and a GPT-ready context string.
 */
export function searchPastReferences(
  query: string,
  logsSessions: SessionLogSummary[],
  userDat: UserDat
): PastReferenceSearchResult {
  if (!query || query.trim().length < 2) {
    return { query, found: false, matches: [], contextForGPT: "" };
  }

  const normalizedQuery = query.toLowerCase().trim();
  const queryTerms = normalizedQuery.split(/\s+/).filter((t) => t.length >= 2);

  // Search both sources
  const logsMatches = searchLogsDat(queryTerms, normalizedQuery, logsSessions);
  const userDatMatches = searchUserDat(queryTerms, normalizedQuery, userDat);

  // Combine and sort by relevance (descending)
  const allMatches = [...logsMatches, ...userDatMatches].sort(
    (a, b) => b.relevance - a.relevance
  );

  // Take top 5 matches max
  const topMatches = allMatches.slice(0, 5);

  const found = topMatches.length > 0;
  const contextForGPT = found
    ? buildContextString(query, topMatches)
    : `[GEHEUGEN] Onderwerp "${query}" is niet eerder besproken of opgeslagen. Dit is onbekend voor jou.`;

  return { query, found, matches: topMatches, contextForGPT };
}

// ─── logs.dat Search ────────────────────────────────────────────────────────

function searchLogsDat(
  queryTerms: string[],
  fullQuery: string,
  sessions: SessionLogSummary[]
): PastReferenceMatch[] {
  const matches: PastReferenceMatch[] = [];

  for (const session of sessions) {
    // Search discussedTopics
    for (const topic of session.discussedTopics) {
      const score = computeMatchScore(queryTerms, fullQuery, topic.toLowerCase());
      if (score > 0.3) {
        matches.push({
          source: "logs.dat",
          category: "besproken onderwerp",
          content: topic,
          timestamp: session.endedAt,
          relevance: score,
        });
      }
    }

    // Search compressedNarrative
    const narrativeScore = computeMatchScore(
      queryTerms,
      fullQuery,
      session.compressedNarrative.toLowerCase()
    );
    if (narrativeScore > 0.25) {
      // Extract relevant sentence from narrative
      const relevantSnippet = extractRelevantSnippet(
        session.compressedNarrative,
        queryTerms
      );
      matches.push({
        source: "logs.dat",
        category: "sessie-samenvatting",
        content: relevantSnippet,
        timestamp: session.endedAt,
        relevance: narrativeScore,
      });
    }

    // Search emotionalThemes
    for (const theme of session.emotionalThemes) {
      const score = computeMatchScore(queryTerms, fullQuery, theme.label.toLowerCase());
      if (score > 0.3) {
        matches.push({
          source: "logs.dat",
          category: "emotioneel thema",
          content: `${theme.label} (intensiteit: ${theme.intensity}/10)`,
          timestamp: session.endedAt,
          relevance: score * (theme.intensity / 10), // weight by intensity
        });
      }
    }

    // Search openEndpoints
    for (const endpoint of session.openEndpoints) {
      const score = computeMatchScore(queryTerms, fullQuery, endpoint.label.toLowerCase());
      if (score > 0.3) {
        matches.push({
          source: "logs.dat",
          category: "open punt",
          content: `${endpoint.label} (${endpoint.category})`,
          timestamp: session.endedAt,
          relevance: score,
        });
      }
    }
  }

  return matches;
}

// ─── user.dat Search ────────────────────────────────────────────────────────

function searchUserDat(
  queryTerms: string[],
  fullQuery: string,
  userDat: UserDat
): PastReferenceMatch[] {
  const matches: PastReferenceMatch[] = [];

  // Search triggerPatterns
  for (const trigger of userDat.triggerPatterns ?? []) {
    const score = computeMatchScore(queryTerms, fullQuery, trigger.trigger.toLowerCase());
    if (score > 0.3) {
      matches.push({
        source: "user.dat",
        category: "trigger-patroon",
        content: `${trigger.trigger} (${trigger.count}x herkend)`,
        timestamp: null,
        relevance: score * Math.min(trigger.count / 3, 1), // weight by frequency
      });
    }
  }

  // Search schemaTendencies
  for (const schema of userDat.schemaTendencies ?? []) {
    const score = computeMatchScore(queryTerms, fullQuery, schema.schemaId.toLowerCase());
    if (score > 0.3) {
      matches.push({
        source: "user.dat",
        category: "schema-tendens",
        content: `${schema.schemaId} (domein: ${schema.domain}, ${schema.frequency}x)`,
        timestamp: schema.lastSeen,
        relevance: score,
      });
    }
  }

  // Search modeTendencies
  for (const mode of userDat.modeTendencies ?? []) {
    const score = computeMatchScore(queryTerms, fullQuery, mode.modeId.toLowerCase());
    if (score > 0.3) {
      matches.push({
        source: "user.dat",
        category: "modus-tendens",
        content: `${mode.modeId} (${mode.frequency}x, laatst: ${mode.lastSeen})`,
        timestamp: mode.lastSeen,
        relevance: score,
      });
    }
  }

  // Search relationalAnchors
  for (const anchor of userDat.relationalAnchors ?? []) {
    const nameScore = computeMatchScore(queryTerms, fullQuery, anchor.name.toLowerCase());
    const roleScore = computeMatchScore(queryTerms, fullQuery, anchor.role.toLowerCase());
    const score = Math.max(nameScore, roleScore);
    if (score > 0.3) {
      matches.push({
        source: "user.dat",
        category: "relationeel anker",
        content: `${anchor.name} (${anchor.role})`,
        timestamp: null,
        relevance: score * (anchor.emotionalWeight / 10),
      });
    }
  }

  // Search sessionAnalyses (legacy — themes from old sessions)
  for (const analysis of (userDat.sessionAnalyses ?? []).slice(-10)) {
    for (const theme of analysis.themes ?? []) {
      const score = computeMatchScore(queryTerms, fullQuery, theme.toLowerCase());
      if (score > 0.3) {
        matches.push({
          source: "user.dat",
          category: "sessie-thema (oud)",
          content: theme,
          timestamp: analysis.date,
          relevance: score * 0.7, // lower weight for legacy data
        });
      }
    }
  }

  return matches;
}

// ─── Scoring Helpers ────────────────────────────────────────────────────────

/**
 * Compute a 0-1 relevance score for a query against a target string.
 * Uses term overlap + substring matching.
 */
function computeMatchScore(
  queryTerms: string[],
  fullQuery: string,
  target: string
): number {
  if (!target || target.length === 0) return 0;

  // Exact substring match = highest score
  if (target.includes(fullQuery)) return 1.0;

  // Term overlap scoring
  let matchedTerms = 0;
  for (const term of queryTerms) {
    if (target.includes(term)) {
      matchedTerms++;
    }
  }

  if (matchedTerms === 0) return 0;

  // Proportion of query terms found in target
  return matchedTerms / queryTerms.length;
}

/**
 * Extract the most relevant sentence from a longer text based on query terms.
 */
function extractRelevantSnippet(text: string, queryTerms: string[]): string {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  if (sentences.length === 0) return text.slice(0, 150);

  let bestSentence = sentences[0];
  let bestScore = 0;

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      if (lower.includes(term)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }

  return bestSentence.trim().slice(0, 200);
}

// ─── GPT Context Builder ────────────────────────────────────────────────────

/**
 * Build a concise context string for GPT injection from matched results.
 * Max ~300 tokens to keep payload manageable.
 */
function buildContextString(query: string, matches: PastReferenceMatch[]): string {
  const lines: string[] = [
    `[GEHEUGEN] Over "${query}" is het volgende bekend:`,
  ];

  for (const match of matches.slice(0, 4)) {
    const timeInfo = match.timestamp
      ? ` (${formatRelativeTime(match.timestamp)})`
      : "";
    lines.push(`- [${match.category}]${timeInfo}: ${match.content}`);
  }

  lines.push(
    `\nGebruik deze context om natuurlijk op voort te bouwen. Herhaal niet letterlijk, maar toon dat je het weet.`
  );

  return lines.join("\n");
}

/**
 * Format an ISO timestamp as a relative time string (e.g., "3 dagen geleden").
 */
function formatRelativeTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "vandaag";
  if (diffDays === 1) return "gisteren";
  if (diffDays < 7) return `${diffDays} dagen geleden`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weken geleden`;
  return `${Math.floor(diffDays / 30)} maanden geleden`;
}
