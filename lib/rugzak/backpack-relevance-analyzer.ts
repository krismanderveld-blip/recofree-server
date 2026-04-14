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
  isolation: ['alone', 'lonely', 'nobody', 'isolated', 'by myself', 'no one', 'alleen', 'eenzaam', 'niemand'],
  rejection: ['rejected', 'pushed away', 'not wanted', 'unwanted', 'afgewezen', 'niet gewild'],
  abandonment: ['abandoned', 'left', 'walked away', 'gone', 'verlaten', 'achtergelaten', 'weg'],
  shame: ['ashamed', 'shame', 'embarrassed', 'disgusted with myself', 'schaamte', 'schaam'],
  self_worth: ['worthless', 'not good enough', 'failure', 'useless', 'waardeloos', 'niet goed genoeg'],
  craving: ['craving', 'urge', 'want to drink', 'want to use', 'tempted', 'relapse', 'verlangen', 'drang', 'terugval'],
  fear_of_loss: ['lose', 'losing', 'afraid to lose', 'scared of losing', 'verliezen', 'bang om te verliezen'],
  guilt: ['guilty', 'guilt', 'my fault', 'blame myself', 'schuld', 'schuldig', 'mijn fout'],
  anger: ['angry', 'furious', 'rage', 'hate', 'boos', 'woedend', 'kwaad'],
  hopelessness: ['hopeless', 'no hope', 'pointless', 'give up', 'hopeloos', 'geen hoop', 'opgeven'],
  control: ['control', 'controlling', 'manipulate', 'controle', 'manipuleren'],
  boundary_violation: ['boundary', 'boundaries', 'crossed the line', 'too much', 'grens', 'grenzen', 'te ver'],
  overgiving: ['too much for them', 'always giving', 'exhausted from caring', 'te veel geven', 'uitgeput'],
  disappointment: ['disappointed', 'let down', 'again', 'every time', 'teleurgesteld', 'weer', 'elke keer'],
};

// ─── Relationship Detection ────────────────────────────────────

const RELATIONSHIP_ROLES: Record<string, string[]> = {
  father: ['father', 'dad', 'papa', 'vader', 'pa'],
  mother: ['mother', 'mom', 'mama', 'moeder', 'ma', 'mam'],
  son: ['son', 'zoon', 'jongen'],
  daughter: ['daughter', 'dochter'],
  partner: ['partner', 'wife', 'husband', 'girlfriend', 'boyfriend', 'vrouw', 'man', 'vriendin', 'vriend', 'echtgenoot', 'echtgenote'],
  ex: ['ex', 'ex-partner', 'ex-vrouw', 'ex-man', 'ex-vriendin', 'ex-vriend'],
  sibling: ['brother', 'sister', 'broer', 'zus'],
  friend: ['friend', 'beste vriend', 'beste vriendin', 'vriend', 'vriendin'],
};

// ─── Core Wound Detection ──────────────────────────────────────

const CORE_WOUND_PATTERNS: Record<string, string[]> = {
  abandonment: ['abandoned', 'left behind', 'walked away', 'verlaten', 'achtergelaten', 'alleen gelaten', 'weg', 'iedereen gaat weg'],
  shame: ['ashamed', 'shame', 'not worthy', 'schaamte', 'schaam me', 'niet waard'],
  rejection: ['rejected', 'not accepted', 'pushed away', 'afgewezen', 'niet geaccepteerd'],
  self_worth: ['not good enough', 'worthless', 'failure', 'niet goed genoeg', 'waardeloos', 'mislukt'],
  depletion: ['exhausted', 'nothing left', 'empty', 'burned out', 'uitgeput', 'leeg', 'niets meer over', 'opgebrand'],
};

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

  // Slider match
  if (userType === 'elias') {
    const s = sliders as any;
    if (triggerId === 'craving' && s.craving >= 6) score += 2;
    if (triggerId === 'isolation' && s.focus <= 3) score += 2;
    if ((triggerId === 'shame' || triggerId === 'self_worth' || triggerId === 'hopelessness') && s.despondency >= 6) score += 2;
    if ((triggerId === 'anger' || triggerId === 'control') && s.frustration >= 6) score += 2;
  } else {
    const s = sliders as any;
    if ((triggerId === 'boundary_violation' || triggerId === 'control') && s.boundaryFatigue >= 6) score += 2;
    if ((triggerId === 'overgiving' || triggerId === 'depletion') && s.emotionalBurden >= 6) score += 2;
    if (triggerId === 'isolation' && s.selfCare <= 3) score += 2;
  }

  // user.dat weight: check if this trigger has been seen before
  const existingPattern = (userDat.triggerPatterns || []).find(
    (tp) => tp.trigger.toLowerCase() === triggerId.toLowerCase()
  );
  if (existingPattern) {
    score += Math.min(existingPattern.count, 5); // +0 to +5
  }

  // Module alignment
  const moduleAlignments: Record<string, string[]> = {
    E01_CRAVING: ['craving'],
    E01: ['craving'],
    E02_EMOTIONAL_REGULATION: ['shame', 'self_worth', 'hopelessness', 'anger'],
    E02: ['shame', 'self_worth', 'hopelessness', 'anger'],
    E03_PATTERN_REFLECTION: ['shame', 'self_worth', 'guilt', 'abandonment'],
    E03: ['shame', 'self_worth', 'guilt', 'abandonment'],
    E04_CONNECTION_RISK: ['isolation', 'rejection', 'abandonment', 'fear_of_loss'],
    E04: ['isolation', 'rejection', 'abandonment', 'fear_of_loss'],
    E05: ['isolation'],
    K_BOUNDARY_PRESSURE: ['boundary_violation', 'control', 'overgiving'],
    K01: ['boundary_violation', 'control', 'overgiving'],
    K_CAREGIVER_DEPLETION: ['overgiving', 'depletion', 'hopelessness'],
    K03: ['overgiving', 'depletion', 'hopelessness'],
    K_RELATIONAL_REFLECTION: ['guilt', 'disappointment', 'abandonment'],
    K02: ['guilt', 'disappointment', 'abandonment'],
  };

  const aligned = moduleAlignments[dominantModule] || [];
  if (aligned.includes(triggerId)) score += 2;

  return score;
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
    'liefde', 'mis', 'pijn', 'bang', 'boos', 'schuld', 'sorry', 'verdriet'];
  const hasEmotionalContext = emotionalWords.some((ew) => messageLower.includes(ew));
  if (hasEmotionalContext && (directMention || inBackpack)) score += 2;

  if (score < 5) return null; // Threshold from spec: only include if score >= 5

  // Try to extract a name from the backpack text near the role keyword
  const name = extractNameForRole(role, roleKeywords, backpackText);

  return { name: name || role, role, score };
}

/**
 * Try to extract a proper name associated with a relationship role from backpack text.
 * Looks for patterns like "mijn zoon Jules" or "my son Jules"
 */
function extractNameForRole(role: string, roleKeywords: string[], text: string): string | null {
  const textLower = text.toLowerCase();
  for (const kw of roleKeywords) {
    // Pattern: "mijn/my <role> <Name>" or "<role> <Name>"
    const patterns = [
      new RegExp(`(?:mijn|my|m'n)\\s+${kw}\\s+([A-Z][a-záéíóúàèìòùäëïöü]+)`, 'i'),
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

/**
 * Find the most relevant context line from backpack sections.
 * Looks for sentences that contain trigger-related or message-related keywords.
 */
function findRelevantContextLine(
  messageLower: string,
  sections: LifePhaseSection[],
  triggerIds: string[]
): string | null {
  // Extract meaningful words from the message (3+ chars, not common words)
  const stopWords = new Set(['the', 'and', 'but', 'for', 'are', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out',
    'het', 'een', 'van', 'dat', 'die', 'niet', 'met', 'ook', 'maar', 'ben', 'nog', 'wel', 'heb', 'mijn']);
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

  for (const section of sections) {
    if (!section.content || section.content.trim().length === 0) continue;

    // Split into sentences
    const sentences = section.content.split(/[.!?\n]+/).filter((s) => s.trim().length > 10);

    for (const sentence of sentences) {
      const sentLower = sentence.toLowerCase().trim();
      let score = 0;
      for (const term of searchTerms) {
        if (sentLower.includes(term)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestLine = sentence.trim();
      }
    }
  }

  // Only return if at least 2 terms matched (avoid noise)
  return bestScore >= 2 ? bestLine : null;
}
