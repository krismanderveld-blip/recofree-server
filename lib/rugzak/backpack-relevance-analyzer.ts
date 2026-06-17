/**
 * Backpack Relevance Analyzer — LOCAL MODULE
 *
 * Purpose: Select ONLY the relevant parts of backpack for the current message.
 * This module runs locally BEFORE every AI request.
 *
 * GPT must NEVER decide backpack relevance.
 * Selection happens locally, deterministically.
 *
 * Outputs:
 * - max 2 triggers
 * - max 1 core wound (inferred from life story patterns)
 * - max 1 context line (relevant life story excerpt)
 * - max 1 relationship anchor
 *
 * Based on: Master Engine Spec V2, Section 15 + Patch 3
 */

import type { Backpack, UserDat, MoodSliders, TriggerPattern, LifePhaseSection } from '../ai/types';
import type { StateAnalysis } from './state-analyzer';
import { kimBackpackSliderScore } from '../engine/kim/slider-interpretation';
import { KIM_MODULE_ALIGNMENTS } from '../engine/kim/module-catalog';
import { eliasBackpackSliderScore, ELIAS_MODULE_ALIGNMENTS } from '../engine/elias/module-catalog';

// ─── Output Types ──────────────────────────────────────────────

export interface BackpackRelevanceResult {
  /** Max 2 selected triggers relevant to this message */
  triggers: SelectedTrigger[];
  /** Max 1 core wound if detected and relevant */
  coreWound: string | null;
  /** Max 1 context line from life story relevant to this message */
  contextLine: string | null;
  /** Max 1 relationship anchor relevant to this message */
  relationshipAnchor: SelectedRelationshipAnchor | null;
}

export interface SelectedTrigger {
  trigger: string;
  score: number;
}

export interface SelectedRelationshipAnchor {
  name: string;
  role: string;
  roleEN?: string;
  score: number;
}

// ─── Trigger Keywords ──────────────────────────────────────────

const TRIGGER_KEYWORDS: Record<string, string[]> = {
  isolation: ['alone', 'lonely', 'nobody', 'isolated', 'by myself', 'no one'],
  rejection: ['rejected', 'pushed away', 'not wanted', 'unwanted'],
  abandonment: ['abandoned', 'left', 'walked away', 'gone'],
  shame: ['ashamed', 'shame', 'embarrassed', 'disgusted with myself'],
  self_worth: ['worthless', 'not good enough', 'failure', 'useless'],
  craving: ['craving', 'urge', 'want to drink', 'want to use', 'tempted', 'relapse'],
  fear_of_loss: ['lose', 'losing', 'afraid to lose', 'scared of losing'],
  guilt: ['guilty', 'guilt', 'my fault', 'blame myself'],
  anger: ['angry', 'furious', 'rage', 'hate'],
  hopelessness: ['hopeless', 'no hope', 'pointless', 'give up'],
  control: ['control', 'controlling', 'manipulate'],
  boundary_violation: ['boundary', 'boundaries', 'crossed the line', 'too much'],
  overgiving: ['too much for them', 'always giving', 'exhausted from caring'],
  disappointment: ['disappointed', 'let down', 'again', 'every time'],
};

// ─── Relationship Detection ────────────────────────────────────

const RELATIONSHIP_ROLES: Record<string, string[]> = {
  father: ['father', 'dad', 'papa'],
  mother: ['mother', 'mom', 'mama'],
  son: ['son', 'boy'],
  daughter: ['daughter'],
  partner: ['partner', 'wife', 'husband', 'girlfriend', 'boyfriend'],
  ex: ['ex', 'ex-partner', 'ex-wife', 'ex-husband', 'ex-girlfriend', 'ex-boyfriend'],
  sibling: ['brother', 'sister'],
  friend: ['friend', 'best friend'],
};

// ─── Core Wound Detection ──────────────────────────────────────

const CORE_WOUND_PATTERNS: Record<string, string[]> = {
  abandonment: ['abandoned', 'left behind', 'walked away', 'everyone leaves'],
  shame: ['ashamed', 'shame', 'not worthy'],
  rejection: ['rejected', 'not accepted', 'pushed away'],
  self_worth: ['not good enough', 'worthless', 'failure'],
  depletion: ['exhausted', 'nothing left', 'empty', 'burned out'],
};

// ─── Trigger Decay State ──────────────────────────────────────
// Tracks per-trigger state for decay calculation.
// Persists within a session (module-level state).

interface TriggerDecayState {
  /** Number of messages since this trigger last matched */
  messagesSinceMatch: number;
  /** Timestamp of last match */
  lastMatchTime: number;
  /** Last computed decay penalty */
  lastDecay: number;
}

const triggerDecayMap = new Map<string, TriggerDecayState>();

/**
 * Reset trigger decay state (call at session start).
 */
export function resetTriggerDecay(): void {
  triggerDecayMap.clear();
}

/**
 * Compute trigger-specific decay for a given trigger.
 *
 * Rules (Patch N):
 * - -1 per 2 messages without trigger match
 * - -2 per 5 minutes inactivity
 * - Minimum score = 0
 * - Decay runs BEFORE Top-N selection
 */
function computeTriggerDecay(triggerId: string, hasMatch: boolean): number {
  const now = Date.now();
  let state = triggerDecayMap.get(triggerId);

  if (!state) {
    state = { messagesSinceMatch: 0, lastMatchTime: now, lastDecay: 0 };
    triggerDecayMap.set(triggerId, state);
  }

  if (hasMatch) {
    // Reset decay on match
    state.messagesSinceMatch = 0;
    state.lastMatchTime = now;
    state.lastDecay = 0;
    return 0;
  }

  // Increment messages since match
  state.messagesSinceMatch++;

  let decay = 0;

  // -1 per 2 messages without match
  decay -= Math.floor(state.messagesSinceMatch / 2);

  // -2 per 5 minutes inactivity
  const minutesSinceMatch = (now - state.lastMatchTime) / (1000 * 60);
  decay -= Math.floor(minutesSinceMatch / 5) * 2;

  state.lastDecay = decay;
  return decay;
}

// ─── Scoring Functions ─────────────────────────────────────────

/**
 * Score a trigger against the current message and context.
 *
 * Scoring rules (from spec):
 * - direct message keyword match → +3
 * - semantic implied match → +2
 * - slider match → +2
 * - user.dat weight → +0 to +5
 * - recent flag support → +2
 * - main module alignment → +2
 */
function scoreTrigger(
  triggerId: string,
  keywords: string[],
  messageLower: string,
  sliders: MoodSliders,
  userDat: UserDat,
  dominantModule: string,
  userType: 'elias' | 'kim'
): number {
  let score = 0;

  // Direct keyword match in message
  const hasDirectMatch = keywords.some((kw) => messageLower.includes(kw));
  if (hasDirectMatch) score += 3;

  // PATCH N: Apply trigger-specific decay BEFORE other scoring
  // Decay runs before Top-N selection
  const decay = computeTriggerDecay(triggerId, hasDirectMatch);
  // Decay is applied at the end (after all positive scoring)

  // Slider match
  if (userType === 'elias') {
    score += eliasBackpackSliderScore(triggerId, sliders as any);
  } else {
    score += kimBackpackSliderScore(triggerId, sliders);
  }

  // user.dat weight: check if this trigger has been seen before
  const existingPattern = (userDat.triggerPatterns || []).find(
    (tp) => tp.trigger.toLowerCase() === triggerId.toLowerCase()
  );
  if (existingPattern) {
    score += Math.min(existingPattern.count, 5); // +0 to +5
  }

  // Module alignment
  const moduleAlignments: Record<string, readonly string[]> = {
    ...ELIAS_MODULE_ALIGNMENTS,
    ...KIM_MODULE_ALIGNMENTS,
  };

  const aligned = moduleAlignments[dominantModule] || [];
  if (aligned.includes(triggerId)) score += 2;

  // PATCH N: Apply decay (computed earlier)
  // finalScore = baseScore + historicalWeight + moduleAlignment - timeDecay
  score += decay; // decay is negative

  // Minimum score = 0
  return Math.max(0, score);
}

/**
 * Score a relationship anchor against the current message.
 *
 * Scoring rules (from spec):
 * - direct mention → +4
 * - implicit mention → +2
 * - emotional language around the relation → +2
 * - stored emotional_weight (1-5) → +weight (future: from backpack.relationships)
 */
function scoreRelationshipAnchor(
  role: string,
  roleKeywords: string[],
  messageLower: string,
  backpackText: string
): { name: string; role: string; score: number } | null {
  let score = 0;

  // Direct mention in message
  const directMention = roleKeywords.some((kw) => messageLower.includes(kw));
  if (directMention) score += 4;

  // Check if the role appears in backpack text (implicit relevance)
  const inBackpack = roleKeywords.some((kw) => backpackText.includes(kw));
  if (inBackpack && !directMention) score += 2;

  // Emotional language around the relation
  const emotionalWords = ['love', 'miss', 'hurt', 'afraid', 'angry', 'guilt', 'sorry',
    'grief', 'pain', 'scared', 'sad', 'lonely', 'lost'];
  const hasEmotionalContext = emotionalWords.some((ew) => messageLower.includes(ew));
  if (hasEmotionalContext && (directMention || inBackpack)) score += 2;

  if (score < 5) return null; // Threshold from spec: only include if score >= 5

  // Try to extract a name from the backpack text near the role keyword
  const name = extractNameForRole(role, roleKeywords, backpackText);

  return { name: name || role, role, score };
}

/**
 * Try to extract a proper name associated with a relationship role from backpack text.
 * Looks for patterns like "my son Jules" or "son Jules"
 */
function extractNameForRole(role: string, roleKeywords: string[], text: string): string | null {
  const textLower = text.toLowerCase();
  for (const kw of roleKeywords) {
    // Pattern: "my <role> <Name>" or "<role> <Name>"
    const patterns = [
      new RegExp(`(?:my)\\s+${kw}\\s+([A-Z][a-záéíóúàèìòùäëïöü]+)`, 'i'),
      new RegExp(`${kw}\\s+([A-Z][a-záéíóúàèìòùäëïöü]+)`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) return match[1];
    }
  }
  return null;
}

// ─── Main Analyzer ─────────────────────────────────────────────

/**
 * Analyze backpack relevance for the current message.
 *
 * This runs LOCALLY before every GPT call.
 * GPT never decides relevance.
 *
 * @param message - The current user message
 * @param backpack - The full backpack (identity anchor)
 * @param userDat - The dynamic session memory
 * @param sliders - Current mood slider values
 * @param dominantModule - The single dominant module selected by the engine
 * @returns BackpackRelevanceResult with selected triggers, wound, context, anchor
 */
export function analyzeBackpackRelevance(
  message: string,
  backpack: Backpack,
  userDat: UserDat,
  sliders: MoodSliders,
  dominantModule: string,
): BackpackRelevanceResult {
  const messageLower = message.toLowerCase();
  const userType = backpack.userType;

  // Combine all backpack text for searching
  const backpackText = (backpack.sections || [])
    .map((s) => s.content || '')
    .join('\n')
    + '\n' + (backpack.intakeContext?.initialContext || '');

  const backpackTextLower = backpackText.toLowerCase();

  // ── 1. TRIGGER SELECTION (max 2) ──
  const triggerScores: SelectedTrigger[] = [];
  for (const [triggerId, keywords] of Object.entries(TRIGGER_KEYWORDS)) {
    const score = scoreTrigger(triggerId, keywords, messageLower, sliders, userDat, dominantModule, userType);
    if (score >= 4) { // Threshold from spec
      triggerScores.push({ trigger: triggerId, score });
    }
  }
  // Sort by score descending
  triggerScores.sort((a, b) => b.score - a.score);
  // Max 2, and if second is much weaker than first, only include first
  let selectedTriggers = triggerScores.slice(0, 2);
  if (selectedTriggers.length === 2 && selectedTriggers[1].score < selectedTriggers[0].score * 0.5) {
    selectedTriggers = [selectedTriggers[0]];
  }

  // ── 2. CORE WOUND SELECTION (max 1) ──
  let coreWound: string | null = null;
  const selectedTriggerIds = selectedTriggers.map((t) => t.trigger);

  // Core wound must be linked to a selected trigger or supported by the message
  for (const [wound, patterns] of Object.entries(CORE_WOUND_PATTERNS)) {
    const inMessage = patterns.some((p) => messageLower.includes(p));
    const linkedToTrigger = selectedTriggerIds.includes(wound);
    const inBackpack = patterns.some((p) => backpackTextLower.includes(p));

    if ((inMessage || linkedToTrigger) && inBackpack) {
      coreWound = wound;
      break; // Only 1
    }
  }

  // ── 3. CONTEXT LINE SELECTION (max 1) ──
  let contextLine: string | null = null;

  // Find the most relevant sentence from the backpack that relates to the message
  if (backpackText.trim().length > 0) {
    contextLine = findRelevantContextLine(messageLower, backpack.sections, selectedTriggerIds);
  }

  // ── 4. RELATIONSHIP ANCHOR SELECTION (max 1) ──
  let relationshipAnchor: SelectedRelationshipAnchor | null = null;
  let bestAnchorScore = 0;

  for (const [role, keywords] of Object.entries(RELATIONSHIP_ROLES)) {
    const result = scoreRelationshipAnchor(role, keywords, messageLower, backpackText);
    if (result && result.score > bestAnchorScore) {
      relationshipAnchor = result;
      bestAnchorScore = result.score;
    }
  }

  return {
    triggers: selectedTriggers,
    coreWound,
    contextLine,
    relationshipAnchor,
  };
}

// ─── VSP Keywords for Detection ──────────────────────────────

const VSP_KEYWORDS = ['vsp', 'groen', 'green', 'geel', 'yellow', 'oranje', 'orange', 'rood', 'red', 'paars', 'purple', 'zone', 'fase'];

const VSP_ZONE_LABELS: Record<string, RegExp> = {
  green: /(?:^|\n)\s*(?:GROEN|GREEN|🟢)[:\s-]*/i,
  yellow: /(?:^|\n)\s*(?:GEEL|YELLOW|🟡)[:\s-]*/i,
  orange: /(?:^|\n)\s*(?:ORANJE|ORANGE|🟠)[:\s-]*/i,
  red: /(?:^|\n)\s*(?:ROOD|RED|🔴)[:\s-]*/i,
  purple: /(?:^|\n)\s*(?:PAARS|PURPLE|🟣)[:\s-]*/i,
};

/**
 * VSP Profile extracted from backpack recurringThemes section.
 * Read-only — never writes to backpack.
 */
export interface VspBackpackProfile {
  green: string[];
  yellow: string[];
  orange: string[];
  red: string[];
  purple: string[];
  raw: string | null;
}

/**
 * Parse VSP zone labels from the recurringThemes section content.
 * Extracts sentences per zone (GROEN/GREEN, GEEL/YELLOW, etc.).
 * Read-only: never modifies backpack.
 */
export function parseVspProfileFromBackpack(sections: LifePhaseSection[], vspSection?: import('../ai/types').VspStructuredPlan | null): VspBackpackProfile {
  const profile: VspBackpackProfile = { green: [], yellow: [], orange: [], red: [], purple: [], raw: null };

  // PRIMARY: Use structured vspSection if available (user's own per-zone input)
  if (vspSection && vspSection.zones) {
    const zoneMap: Record<string, keyof Omit<VspBackpackProfile, 'raw'>> = {
      groen: 'green', geel: 'yellow', oranje: 'orange', rood: 'red', paars: 'purple'
    };
    for (const [zoneName, entry] of Object.entries(vspSection.zones)) {
      if (!entry) continue;
      const key = zoneMap[zoneName];
      if (!key) continue;
      const items: string[] = [];
      if (entry.signals) {
        // signals is a string (semicolon/newline separated)
        const signalList = entry.signals.split(/[;\n]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        items.push(...signalList);
      }
      if (entry.whatHelps) {
        const helpList = entry.whatHelps.split(/[;\n]+/).map((h: string) => h.trim()).filter((h: string) => h.length > 0);
        items.push(...helpList.map((h: string) => `[helpt] ${h}`));
      }
      if (entry.anchorSentence) items.push(`[anker] ${entry.anchorSentence}`);
      profile[key] = items;
    }
    // Build raw from structured
    const rawParts: string[] = [];
    for (const [zoneName, entry] of Object.entries(vspSection.zones)) {
      if (!entry) continue;
      rawParts.push(`${zoneName.toUpperCase()}: ${[entry.signals || '', entry.whatHelps || ''].filter(Boolean).join('; ')}`);
    }
    if (rawParts.length > 0) profile.raw = rawParts.join('\n');
    return profile;
  }

  // FALLBACK: Parse from recurringThemes section (legacy)
  const themesSection = sections.find((s) => s.id === 'themes');
  if (!themesSection?.content || themesSection.content.trim().length === 0) return profile;

  profile.raw = themesSection.content;
  const content = themesSection.content;

  // Find zone boundaries
  const zoneOrder: { zone: keyof typeof VSP_ZONE_LABELS; start: number }[] = [];
  for (const [zone, regex] of Object.entries(VSP_ZONE_LABELS)) {
    const match = content.match(regex);
    if (match && match.index !== undefined) {
      zoneOrder.push({ zone: zone as keyof typeof VSP_ZONE_LABELS, start: match.index + match[0].length });
    }
  }

  if (zoneOrder.length === 0) return profile;

  // Sort by position in text
  zoneOrder.sort((a, b) => a.start - b.start);

  // Extract content between zone labels
  for (let i = 0; i < zoneOrder.length; i++) {
    const start = zoneOrder[i].start;
    const end = i + 1 < zoneOrder.length ? zoneOrder[i + 1].start - (content.slice(0, zoneOrder[i + 1].start).match(/(?:GROEN|GREEN|GEEL|YELLOW|ORANJE|ORANGE|ROOD|RED|PAARS|PURPLE|🟢|🟡|🟠|🔴|🟣)[:\s-]*/i)?.[0]?.length || 0) : content.length;
    const rawEnd = i + 1 < zoneOrder.length
      ? content.lastIndexOf('\n', zoneOrder[i + 1].start) > start
        ? content.lastIndexOf('\n', zoneOrder[i + 1].start)
        : zoneOrder[i + 1].start
      : content.length;
    const zoneContent = content.slice(start, rawEnd).trim();
    const lines = zoneContent.split(/[\n;,]+/).map((l) => l.trim()).filter((l) => l.length > 3);
    profile[zoneOrder[i].zone as keyof Omit<VspBackpackProfile, 'raw'>] = lines as string[];
  }

  return profile;
}

/**
 * Check if the user message is asking about VSP content.
 */
function isVspRelatedMessage(messageLower: string): boolean {
  return VSP_KEYWORDS.some((kw) => messageLower.includes(kw));
}

/**
 * Find the most relevant context line from backpack sections.
 * Looks for sentences that contain trigger-related or message-related keywords.
 *
 * Fix 1: recurringThemes section gets 1.5x weight multiplier.
 * Fix 2: If message is VSP-related, return full recurringThemes content.
 */
function findRelevantContextLine(
  messageLower: string,
  sections: LifePhaseSection[],
  triggerIds: string[]
): string | null {
  // Fix 2: VSP-related message → return full recurringThemes section
  if (isVspRelatedMessage(messageLower)) {
    const themesSection = sections.find((s) => s.id === 'themes');
    if (themesSection?.content && themesSection.content.trim().length > 0) {
      // Return full content (capped at 2000 chars to avoid token overflow)
      return themesSection.content.trim().slice(0, 2000);
    }
  }

  // Extract meaningful words from the message (3+ chars, not common words)
  const stopWords = new Set(['the', 'and', 'but', 'for', 'are', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out',
    'this', 'that', 'with', 'from', 'have', 'been', 'will', 'just', 'also', 'still', 'more', 'than']);
  const messageWords = messageLower.split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  // Also include trigger keywords
  const triggerWords: string[] = [];
  for (const tid of triggerIds) {
    const kws = TRIGGER_KEYWORDS[tid];
    if (kws) triggerWords.push(...kws);
  }

  const searchTerms = [...new Set([...messageWords, ...triggerWords])];
  if (searchTerms.length === 0) return null;

  let bestLine: string | null = null;
  let bestScore = 0;

  // Fix 1: recurringThemes gets 1.5x weight
  const THEMES_WEIGHT = 1.5;

  for (const section of sections) {
    if (!section.content || section.content.trim().length === 0) continue;

    const isThemes = section.id === 'themes';
    const weightMultiplier = isThemes ? THEMES_WEIGHT : 1.0;

    // Split into sentences
    const sentences = section.content.split(/[.!?\n]+/).filter((s) => s.trim().length > 10);

    for (const sentence of sentences) {
      const sentLower = sentence.toLowerCase().trim();
      let score = 0;
      for (const term of searchTerms) {
        if (sentLower.includes(term)) score++;
      }
      score *= weightMultiplier;
      if (score > bestScore) {
        bestScore = score;
        bestLine = sentence.trim();
      }
    }
  }

  // Only return if at least 2 terms matched (avoid noise)
  // For themes with 1.5x weight, effective threshold is 1.33 raw matches
  return bestScore >= 2 ? bestLine : null;
}
