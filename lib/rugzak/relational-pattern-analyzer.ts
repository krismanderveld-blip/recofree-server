/**
 * Relational Pattern Analyzer — Engine Spec V2, Section 17
 *
 * Kim-critical module, also available for Elias where relevant.
 *
 * Detects repeated wounding relational dynamics and links them to likely schemas.
 * Runs locally before backpack relevance analysis.
 *
 * GPT does NOT diagnose patterns. Kim/Elias gently reflect recurrence.
 *
 * Patterns detected:
 *   - repeated_boundary_violation
 *   - emotional_neglect
 *   - inconsistency
 *   - control_behavior
 *   - repeated_disappointment
 *   - guilt_cycle
 *   - collapse_after_overgiving
 *
 * Schema links:
 *   - abandonment
 *   - rejection
 *   - shame
 *   - self_worth
 *   - depletion
 */

import type { Backpack, UserDat, ChatMessage } from '../ai/types';
import type { RelationalAnchor } from './relational-anchor-detector';

// ─── Types ────────────────────────────────────────────────────────

export type RelationalPatternId =
  | 'repeated_boundary_violation'
  | 'emotional_neglect'
  | 'inconsistency'
  | 'control_behavior'
  | 'repeated_disappointment'
  | 'guilt_cycle'
  | 'collapse_after_overgiving';

export type SchemaId =
  | 'abandonment'
  | 'rejection'
  | 'shame'
  | 'self_worth'
  | 'depletion';

export interface RelationalPatternResult {
  /** The detected relational pattern (null if none detected) */
  detectedPattern: RelationalPatternId | null;
  /** The linked schema (null if no pattern detected) */
  linkedSchema: SchemaId | null;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Evidence snippets that contributed to detection */
  evidence: string[];
  /** Patch J: Repeat count within current session */
  repeatCountSession: number;
  /** Patch J: Repeat count across historical sessions */
  repeatCountHistorical: number;
}

// ─── Pattern Definitions ──────────────────────────────────────────

interface PatternDef {
  id: RelationalPatternId;
  /** Keywords/phrases that indicate this pattern */
  keywords: RegExp[];
  /** Linked schemas (first = most likely) */
  schemas: SchemaId[];
  /** Base confidence when keyword matches */
  baseConfidence: number;
}

const PATTERN_DEFINITIONS: PatternDef[] = [
  {
    id: 'repeated_boundary_violation',
    keywords: [
      /\b(boundary|boundaries)\b/i,
      /\b(violated|violating|crossed|overstepped)\b/i,
      /\b(too much asked|always available|taken advantage)\b/i,
      /\b(can't say no|cannot refuse|unable to refuse)\b/i,
      /\b(happened again|once again|keeps happening)\b/i,
      /\b(doesn't respect|ignores|disregards)\b/i,
    ],
    schemas: ['depletion', 'self_worth'],
    baseConfidence: 0.4,
  },
  {
    id: 'emotional_neglect',
    keywords: [
      /\b(ignored|invisible|not seen|overlooked)\b/i,
      /\b(emotionally neglect|absent|emotionally unavailable)\b/i,
      /\b(never listened|not heard|nobody listens)\b/i,
      /\b(left alone|abandoned|deserted)\b/i,
      /\b(cold|distant|indifferent|detached)\b/i,
      /\b(nobody who|nobody asks|no one cares)\b/i,
    ],
    schemas: ['abandonment', 'rejection'],
    baseConfidence: 0.4,
  },
  {
    id: 'inconsistency',
    keywords: [
      /\b(promised|promise|broke their word)\b/i,
      /\b(again not|didn't follow through|never follows through)\b/i,
      /\b(unreliable|inconsistent|unpredictable)\b/i,
      /\b(one moment|then again|back and forth)\b/i,
      /\b(never know|can't predict|don't know what to expect)\b/i,
      /\b(hot and cold|mixed signals)\b/i,
    ],
    schemas: ['abandonment', 'rejection'],
    baseConfidence: 0.35,
  },
  {
    id: 'control_behavior',
    keywords: [
      /\b(control|controlling|controlled)\b/i,
      /\b(decides|decides for me|dictates)\b/i,
      /\b(manipulat|manipulating|manipulated)\b/i,
      /\b(has to|force|forced|coerced)\b/i,
      /\b(no choice|no voice|no say)\b/i,
      /\b(threaten|blackmail|intimidate)\b/i,
    ],
    schemas: ['self_worth', 'shame'],
    baseConfidence: 0.4,
  },
  {
    id: 'repeated_disappointment',
    keywords: [
      /\b(disappointed|disappointment)\b/i,
      /\b(disappointed again|always the same|same thing)\b/i,
      /\b(expected|hoped|thought it would be different)\b/i,
      /\b(lets me down|let down|failed me)\b/i,
      /\b(never good enough|not enough|insufficient)\b/i,
    ],
    schemas: ['rejection', 'self_worth'],
    baseConfidence: 0.35,
  },
  {
    id: 'guilt_cycle',
    keywords: [
      /\b(guilt|guilty)\b/i,
      /\b(my fault|I caused|I'm to blame)\b/i,
      /\b(should have|if only I|could have prevented)\b/i,
      /\b(responsible for|it's on me|all on me)\b/i,
      /\b(shame|ashamed|disgusted with myself)\b/i,
      /\b(don't deserve|punishment|deserve this)\b/i,
    ],
    schemas: ['shame', 'self_worth'],
    baseConfidence: 0.4,
  },
  {
    id: 'collapse_after_overgiving',
    keywords: [
      /\b(exhausted|burned out|empty|depleted)\b/i,
      /\b(given too much|gave everything|overextended)\b/i,
      /\b(nothing left|no more|can't anymore)\b/i,
      /\b(collapse|crash|breaking down|falling apart)\b/i,
      /\b(for everyone|always ready|always there for others)\b/i,
      /\b(forget myself|lost myself|not myself)\b/i,
    ],
    schemas: ['depletion', 'self_worth'],
    baseConfidence: 0.4,
  },
];

// ─── Repetition Indicators ───────────────────────────────────────

/**
 * Words that indicate repetition/recurrence — boosts confidence.
 */
const REPETITION_INDICATORS = [
  /\b(again|once more|always|every time|keeps happening)\b/i,
  /\b(pattern|repeats|the same|same thing)\b/i,
  /\b(for years|for a long time|my whole life|since forever)\b/i,
  /\b(never changes|keeps on|won't stop|doesn't stop)\b/i,
];

/**
 * Patch J: Repeated event signals for Kim.
 * Detect recurrence language that indicates the user is experiencing
 * the same relational pain again.
 */
const REPEATED_EVENT_SIGNALS = [
  /\b(again)\b/i,
  /\b(always)\b/i,
  /\b(every time)\b/i,
  /\b(same thing|the same)\b/i,
  /\b(keeps doing|keeps happening)\b/i,
  /\b(never changes)\b/i,
  /\b(over and over)\b/i,
  /\b(just like last time|like before)\b/i,
  /\b(for so long)\b/i,
  /\b(it doesn't stop|it won't stop)\b/i,
];

// ─── Analysis ─────────────────────────────────────────────────────

/**
 * Analyze a single text for relational patterns.
 */
function analyzeText(text: string): Array<{ pattern: RelationalPatternId; confidence: number; evidence: string }> {
  if (!text || text.trim().length < 10) return [];

  const results: Array<{ pattern: RelationalPatternId; confidence: number; evidence: string }> = [];
  const hasRepetition = REPETITION_INDICATORS.some(ri => ri.test(text));

  for (const pd of PATTERN_DEFINITIONS) {
    let matchCount = 0;
    const matchedKeywords: string[] = [];

    for (const kw of pd.keywords) {
      kw.lastIndex = 0;
      const match = kw.exec(text);
      if (match) {
        matchCount++;
        matchedKeywords.push(match[0]);
      }
    }

    if (matchCount > 0) {
      let confidence = pd.baseConfidence;
      // Multiple keyword matches boost confidence
      confidence += Math.min(0.3, (matchCount - 1) * 0.1);
      // Repetition language boosts confidence
      if (hasRepetition) confidence += 0.15;
      // Cap at 0.95
      confidence = Math.min(0.95, confidence);

      results.push({
        pattern: pd.id,
        confidence,
        evidence: matchedKeywords.join(', '),
      });
    }
  }

  return results;
}

/**
 * Full relational pattern analysis.
 *
 * Inputs:
 *   - user message (current)
 *   - user.dat (session history, recent flags)
 *   - backpack relationships (via relational anchors)
 *   - recent flags
 *
 * Returns the single strongest detected pattern with linked schema.
 */
export function analyzeRelationalPatterns(
  message: string,
  backpack: Backpack,
  userDat: UserDat,
  relationalAnchors: RelationalAnchor[] = [],
): RelationalPatternResult {
  const allDetections: Array<{ pattern: RelationalPatternId; confidence: number; evidence: string }> = [];

  // 1. Analyze current message (highest weight)
  const msgResults = analyzeText(message);
  for (const r of msgResults) {
    allDetections.push({ ...r, confidence: r.confidence * 1.2 }); // Boost current message
  }

  // 2. Analyze recent chat history (last 6 user messages)
  const recentUserMsgs = (userDat.chatHistory || [])
    .filter((m: ChatMessage) => m.role === 'user')
    .slice(-6);
  for (const msg of recentUserMsgs) {
    const histResults = analyzeText(msg.content);
    for (const r of histResults) {
      allDetections.push({ ...r, confidence: r.confidence * 0.7 }); // Lower weight for history
    }
  }

  // 3. Analyze backpack sections for long-standing patterns
  for (const section of (backpack.sections || [])) {
    if (!section.content || section.content.trim().length < 20) continue;
    const bpResults = analyzeText(section.content);
    for (const r of bpResults) {
      allDetections.push({ ...r, confidence: r.confidence * 0.8 }); // Medium weight for backpack
    }
  }

  // 4. Aggregate: find the pattern with highest total confidence
  const patternScores = new Map<RelationalPatternId, { totalConf: number; evidence: string[] }>();

  for (const det of allDetections) {
    const existing = patternScores.get(det.pattern);
    if (existing) {
      // Use max confidence (not sum) to avoid inflation, but track evidence
      existing.totalConf = Math.max(existing.totalConf, det.confidence);
      if (det.evidence) existing.evidence.push(det.evidence);
    } else {
      patternScores.set(det.pattern, {
        totalConf: det.confidence,
        evidence: det.evidence ? [det.evidence] : [],
      });
    }
  }

  // 5. Boost if pattern appears in multiple sources (message + history + backpack)
  for (const [patternId, data] of patternScores) {
    const inMessage = msgResults.some(r => r.pattern === patternId);
    const inHistory = recentUserMsgs.some((msg: ChatMessage) =>
      analyzeText(msg.content).some(r => r.pattern === patternId)
    );
    const inBackpack = (backpack.sections || []).some(s =>
      analyzeText(s.content || '').some(r => r.pattern === patternId)
    );

    const sourceCount = [inMessage, inHistory, inBackpack].filter(Boolean).length;
    if (sourceCount >= 2) {
      data.totalConf = Math.min(0.95, data.totalConf + 0.15);
    }
    if (sourceCount >= 3) {
      data.totalConf = Math.min(0.95, data.totalConf + 0.1);
    }
  }

  // 6. Select the strongest pattern
  let bestPattern: RelationalPatternId | null = null;
  let bestConf = 0;
  let bestEvidence: string[] = [];

  for (const [patternId, data] of patternScores) {
    if (data.totalConf > bestConf) {
      bestConf = data.totalConf;
      bestPattern = patternId;
      bestEvidence = data.evidence;
    }
  }

  // Only report if confidence >= 0.35
  if (!bestPattern || bestConf < 0.35) {
    return { detectedPattern: null, linkedSchema: null, confidence: 0, evidence: [], repeatCountSession: 0, repeatCountHistorical: 0 };
  }

  // Find linked schema
  const patternDef = PATTERN_DEFINITIONS.find(pd => pd.id === bestPattern);
  const linkedSchema = patternDef?.schemas[0] ?? null;

  // Patch J: Count repeated event signals in current message + recent history
  const repeatCountSession = countRepeatedEventSignals(message, recentUserMsgs);

  // Patch J: Count historical recurrence from user.dat session analyses
  const repeatCountHistorical = countHistoricalRecurrence(bestPattern, userDat);

  // Patch J: Boost confidence if repeated events are detected
  if (repeatCountSession >= 2) bestConf = Math.min(0.95, bestConf + 0.1);
  if (repeatCountHistorical >= 2) bestConf = Math.min(0.95, bestConf + 0.1);

  return {
    detectedPattern: bestPattern,
    linkedSchema,
    confidence: Math.round(bestConf * 100) / 100,
    evidence: [...new Set(bestEvidence)].slice(0, 5), // Deduplicate, max 5
    repeatCountSession,
    repeatCountHistorical,
  };
}

// ─── Patch J: Repeated Event Detection ──────────────────────────

/**
 * Count repeated event signals across current message and recent session messages.
 * Kim prioritizes: repeated pattern > relational wound > boundary strain
 * over generic empathy or surface-level suggestions.
 */
function countRepeatedEventSignals(currentMessage: string, recentMessages: ChatMessage[]): number {
  let count = 0;
  const allTexts = [currentMessage, ...recentMessages.map(m => m.content)];

  for (const text of allTexts) {
    for (const signal of REPEATED_EVENT_SIGNALS) {
      signal.lastIndex = 0;
      if (signal.test(text)) {
        count++;
        break; // Count once per message per signal group
      }
    }
  }

  return count;
}

/**
 * Count how many historical sessions had the same relational pattern.
 * Uses session analyses from user.dat.
 */
function countHistoricalRecurrence(pattern: RelationalPatternId, userDat: UserDat): number {
  const analyses = userDat.sessionAnalyses || [];
  let count = 0;

  for (const analysis of analyses) {
    // Check if this session's themes or modules relate to the pattern
    const themes = analysis.themes || [];
    const patternWords = pattern.split('_');
    const hasMatch = themes.some((theme: string) =>
      patternWords.some(word => theme.toLowerCase().includes(word))
    );
    if (hasMatch) count++;
  }

  // Also check user.dat's lastRelationalPattern
  if (userDat.lastRelationalPattern?.pattern === pattern) count++;

  return count;
}
