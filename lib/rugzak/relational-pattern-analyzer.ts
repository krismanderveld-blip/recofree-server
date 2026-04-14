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
}

// ─── Pattern Definitions ──────────────────────────────────────────

interface PatternDef {
  id: RelationalPatternId;
  /** Keywords/phrases that indicate this pattern (Dutch + English) */
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
      /\b(grens|grenzen|boundary|boundaries)\b/i,
      /\b(overschrijd|overschrijden|oversteppen|violated|violating|crossed)\b/i,
      /\b(te veel gevraagd|too much asked|altijd beschikbaar|always available)\b/i,
      /\b(nee zeggen|can't say no|kan niet weigeren|cannot refuse)\b/i,
      /\b(weer gebeurd|happened again|opnieuw|once again)\b/i,
      /\b(respecteert niet|doesn't respect|negeert|ignores)\b/i,
    ],
    schemas: ['depletion', 'self_worth'],
    baseConfidence: 0.4,
  },
  {
    id: 'emotional_neglect',
    keywords: [
      /\b(genegeerd|ignored|onzichtbaar|invisible|niet gezien|not seen)\b/i,
      /\b(emotioneel verwaarloos|emotionally neglect|afwezig|absent)\b/i,
      /\b(nooit geluisterd|never listened|niet gehoord|not heard)\b/i,
      /\b(alleen gelaten|left alone|in de steek|abandoned)\b/i,
      /\b(koud|cold|afstandelijk|distant|onverschillig|indifferent)\b/i,
      /\b(niemand die|nobody who|niemand vraagt|nobody asks)\b/i,
    ],
    schemas: ['abandonment', 'rejection'],
    baseConfidence: 0.4,
  },
  {
    id: 'inconsistency',
    keywords: [
      /\b(beloofd|promised|belofte|promise)\b/i,
      /\b(weer niet|again not|niet nagekomen|didn't follow through)\b/i,
      /\b(onbetrouwbaar|unreliable|wisselend|inconsistent)\b/i,
      /\b(ene moment|one moment|dan weer|then again)\b/i,
      /\b(nooit weet|never know|weet nooit|unpredictable)\b/i,
      /\b(hot and cold|warm en koud)\b/i,
    ],
    schemas: ['abandonment', 'rejection'],
    baseConfidence: 0.35,
  },
  {
    id: 'control_behavior',
    keywords: [
      /\b(controle|control|controleren|controlling)\b/i,
      /\b(bepaalt|decides|beslist voor|decides for)\b/i,
      /\b(manipulat|manipuleer|manipulating)\b/i,
      /\b(moet van|has to|dwing|force|gedwongen|forced)\b/i,
      /\b(geen keuze|no choice|geen stem|no voice)\b/i,
      /\b(dreig|threaten|chantage|blackmail)\b/i,
    ],
    schemas: ['self_worth', 'shame'],
    baseConfidence: 0.4,
  },
  {
    id: 'repeated_disappointment',
    keywords: [
      /\b(teleurgesteld|disappointed|teleurstelling|disappointment)\b/i,
      /\b(weer teleurgesteld|disappointed again|altijd hetzelfde|always the same)\b/i,
      /\b(verwacht|expected|hoopte|hoped)\b/i,
      /\b(laat me vallen|lets me down|in de steek|let down)\b/i,
      /\b(nooit goed genoeg|never good enough|niet genoeg|not enough)\b/i,
    ],
    schemas: ['rejection', 'self_worth'],
    baseConfidence: 0.35,
  },
  {
    id: 'guilt_cycle',
    keywords: [
      /\b(schuld|guilt|schuldig|guilty)\b/i,
      /\b(mijn fout|my fault|ik ben de oorzaak|I caused)\b/i,
      /\b(had moeten|should have|had ik maar|if only I)\b/i,
      /\b(verantwoordelijk voor|responsible for|op mij|on me)\b/i,
      /\b(schaamte|shame|schaam me|ashamed)\b/i,
      /\b(verdien het niet|don't deserve|straf|punishment)\b/i,
    ],
    schemas: ['shame', 'self_worth'],
    baseConfidence: 0.4,
  },
  {
    id: 'collapse_after_overgiving',
    keywords: [
      /\b(uitgeput|exhausted|op|burned out|leeg|empty)\b/i,
      /\b(te veel gegeven|given too much|alles gegeven|gave everything)\b/i,
      /\b(niets over|nothing left|niks meer|no more)\b/i,
      /\b(instorten|collapse|crashen|crash|ineenstorten)\b/i,
      /\b(voor iedereen|for everyone|altijd klaar|always ready)\b/i,
      /\b(vergeet mezelf|forget myself|zelf niet|not myself)\b/i,
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
  /\b(weer|again|opnieuw|once more|steeds|always|altijd|elke keer|every time)\b/i,
  /\b(patroon|pattern|herhaalt|repeats|hetzelfde|the same)\b/i,
  /\b(al jaren|for years|al lang|for a long time|al mijn hele leven|my whole life)\b/i,
  /\b(nooit verandert|never changes|blijft maar|keeps on)\b/i,
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
    return { detectedPattern: null, linkedSchema: null, confidence: 0, evidence: [] };
  }

  // Find linked schema
  const patternDef = PATTERN_DEFINITIONS.find(pd => pd.id === bestPattern);
  const linkedSchema = patternDef?.schemas[0] ?? null;

  return {
    detectedPattern: bestPattern,
    linkedSchema,
    confidence: Math.round(bestConf * 100) / 100,
    evidence: [...new Set(bestEvidence)].slice(0, 5), // Deduplicate, max 5
  };
}
