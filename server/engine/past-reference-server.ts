/**
 * Past-Reference Search — Server-safe version
 *
 * Searches logs.dat sessions + user.dat for references to a given topic.
 * Replaces LocalDeviceTimeService with Date.now() and removes @/ imports.
 * Pure function — no side effects, no react-native dependencies.
 */

// ─── Types (inlined to avoid @/ imports) ────────────────────────
interface SessionLogSummary {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  compressedNarrative: string;
  discussedTopics: string[];
  emotionalThemes: string[];
  openEndpoints: string[];
  moduleTrace: string[];
  zoneTrace: string[];
}

interface PastReferenceMatch {
  source: "logs.dat" | "user.dat";
  category: string;
  content: string;
  timestamp: string | null;
  relevance: number;
}

export interface PastReferenceSearchResult {
  query: string;
  found: boolean;
  matches: PastReferenceMatch[];
  contextForGPT: string;
}

// Minimal UserDat shape needed for search
interface UserDatForSearch {
  triggerPatterns?: Array<{ trigger: string; context?: string; lastSeen?: string }>;
  schemaTendencies?: Array<{ schema: string; evidence?: string }>;
  modeTendencies?: Array<{ mode: string; frequency?: string }>;
  relationalAnchors?: Array<{ person: string; role?: string; dynamic?: string }>;
  sessionAnalyses?: Array<{ date: string; summary: string }>;
}

// ─── Core Search Function ───────────────────────────────────────
export function searchPastReferencesServer(
  query: string,
  logsSessions: SessionLogSummary[],
  userDat: UserDatForSearch
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

  // Take top 5 matches
  const topMatches = allMatches.slice(0, 5);

  // Build GPT context string
  const contextForGPT = buildContextForGPT(topMatches, query);

  return {
    query,
    found: topMatches.length > 0,
    matches: topMatches,
    contextForGPT,
  };
}

// ─── Logs.dat Search ────────────────────────────────────────────
function searchLogsDat(
  queryTerms: string[],
  normalizedQuery: string,
  sessions: SessionLogSummary[]
): PastReferenceMatch[] {
  const matches: PastReferenceMatch[] = [];

  for (const session of sessions) {
    // Search discussedTopics
    for (const topic of session.discussedTopics || []) {
      const score = scoreMatch(queryTerms, normalizedQuery, topic.toLowerCase());
      if (score > 0.3) {
        matches.push({
          source: "logs.dat",
          category: "discussedTopic",
          content: topic,
          timestamp: session.endedAt,
          relevance: score,
        });
      }
    }

    // Search compressedNarrative
    if (session.compressedNarrative) {
      const score = scoreMatch(queryTerms, normalizedQuery, session.compressedNarrative.toLowerCase());
      if (score > 0.2) {
        // Extract relevant sentence
        const relevantSnippet = extractRelevantSnippet(session.compressedNarrative, queryTerms);
        matches.push({
          source: "logs.dat",
          category: "sessionNarrative",
          content: relevantSnippet,
          timestamp: session.endedAt,
          relevance: score * 0.9, // Slightly lower than exact topic match
        });
      }
    }

    // Search emotionalThemes
    for (const theme of session.emotionalThemes || []) {
      const score = scoreMatch(queryTerms, normalizedQuery, theme.toLowerCase());
      if (score > 0.3) {
        matches.push({
          source: "logs.dat",
          category: "emotionalTheme",
          content: theme,
          timestamp: session.endedAt,
          relevance: score * 0.85,
        });
      }
    }

    // Search openEndpoints
    for (const endpoint of session.openEndpoints || []) {
      const score = scoreMatch(queryTerms, normalizedQuery, endpoint.toLowerCase());
      if (score > 0.3) {
        matches.push({
          source: "logs.dat",
          category: "openEndpoint",
          content: endpoint,
          timestamp: session.endedAt,
          relevance: score * 0.95,
        });
      }
    }
  }

  return matches;
}

// ─── User.dat Search ────────────────────────────────────────────
function searchUserDat(
  queryTerms: string[],
  normalizedQuery: string,
  userDat: UserDatForSearch
): PastReferenceMatch[] {
  const matches: PastReferenceMatch[] = [];

  // Search triggerPatterns
  for (const trigger of userDat.triggerPatterns || []) {
    const searchText = `${trigger.trigger} ${trigger.context || ""}`.toLowerCase();
    const score = scoreMatch(queryTerms, normalizedQuery, searchText);
    if (score > 0.3) {
      matches.push({
        source: "user.dat",
        category: "triggerPattern",
        content: `${trigger.trigger}${trigger.context ? ` (${trigger.context})` : ""}`,
        timestamp: trigger.lastSeen || null,
        relevance: score,
      });
    }
  }

  // Search schemaTendencies
  for (const schema of userDat.schemaTendencies || []) {
    const searchText = `${schema.schema} ${schema.evidence || ""}`.toLowerCase();
    const score = scoreMatch(queryTerms, normalizedQuery, searchText);
    if (score > 0.3) {
      matches.push({
        source: "user.dat",
        category: "schemaTendency",
        content: `${schema.schema}${schema.evidence ? `: ${schema.evidence}` : ""}`,
        timestamp: null,
        relevance: score * 0.9,
      });
    }
  }

  // Search relationalAnchors
  for (const anchor of userDat.relationalAnchors || []) {
    const searchText = `${anchor.person} ${anchor.role || ""} ${anchor.dynamic || ""}`.toLowerCase();
    const score = scoreMatch(queryTerms, normalizedQuery, searchText);
    if (score > 0.3) {
      matches.push({
        source: "user.dat",
        category: "relationalAnchor",
        content: `${anchor.person}${anchor.role ? ` (${anchor.role})` : ""}${anchor.dynamic ? `: ${anchor.dynamic}` : ""}`,
        timestamp: null,
        relevance: score * 0.85,
      });
    }
  }

  // Search sessionAnalyses
  for (const analysis of userDat.sessionAnalyses || []) {
    const score = scoreMatch(queryTerms, normalizedQuery, analysis.summary.toLowerCase());
    if (score > 0.2) {
      const snippet = extractRelevantSnippet(analysis.summary, queryTerms);
      matches.push({
        source: "user.dat",
        category: "sessionAnalysis",
        content: snippet,
        timestamp: analysis.date,
        relevance: score * 0.8,
      });
    }
  }

  return matches;
}

// ─── Scoring Helpers ────────────────────────────────────────────
function scoreMatch(queryTerms: string[], fullQuery: string, text: string): number {
  // Exact phrase match = highest score
  if (text.includes(fullQuery)) return 1.0;

  // Count how many query terms appear
  let termHits = 0;
  for (const term of queryTerms) {
    if (text.includes(term)) termHits++;
  }

  if (termHits === 0) return 0;
  return termHits / queryTerms.length;
}

function extractRelevantSnippet(text: string, queryTerms: string[]): string {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  const lowerTerms = queryTerms.map((t) => t.toLowerCase());

  // Find the sentence with the most term hits
  let bestSentence = "";
  let bestScore = 0;

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    let score = 0;
    for (const term of lowerTerms) {
      if (lower.includes(term)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence.trim();
    }
  }

  // Limit to ~100 chars
  if (bestSentence.length > 120) {
    return bestSentence.slice(0, 117) + "...";
  }
  return bestSentence || text.slice(0, 100);
}

// ─── GPT Context Builder ────────────────────────────────────────
function buildContextForGPT(matches: PastReferenceMatch[], query: string): string {
  if (matches.length === 0) return "";

  const lines: string[] = [
    `[PAST REFERENCE: "${query}"]`,
    `Gevonden in eerdere gesprekken/data:`,
  ];

  for (const match of matches.slice(0, 4)) {
    const timeStr = match.timestamp ? ` (${formatRelativeTime(match.timestamp)})` : "";
    lines.push(`- [${match.category}]${timeStr}: ${match.content}`);
  }

  return lines.join("\n");
}

function formatRelativeTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const now = new Date(); // Replaces LocalDeviceTimeService.now().epochMs
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "vandaag";
  if (diffDays === 1) return "gisteren";
  if (diffDays < 7) return `${diffDays} dagen geleden`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weken geleden`;
  return `${Math.floor(diffDays / 30)} maanden geleden`;
}
